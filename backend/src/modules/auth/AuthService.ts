import { PrismaClient, User } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();
const JWT_EXPIRATION = '7d';

export type PublicUser = Omit<User, 'password'>;

type AuthTokenPayload = {
    sub: string;
    email: string | null;
    isGuest: boolean;
};

export class AuthService {
    async register(email: string, password: string, guestId?: string): Promise<{ user: PublicUser; token: string }> {
        const hashedPassword = await bcrypt.hash(password, 10);

        let user: User;

        if (guestId) {
            const guestUser = await prisma.user.findUnique({ where: { id: guestId } });
            if (!guestUser || !guestUser.isGuest) {
                throw new Error("Conta convidada inválida");
            }

            user = await prisma.user.update({
                where: { id: guestId },
                data: {
                    email,
                    password: hashedPassword,
                    isGuest: false,
                    credits: 100 // Garante os 100 créditos iniciais se ele era guest
                }
            });
        } else {
            user = await prisma.user.create({
                data: {
                    email,
                    password: hashedPassword,
                    isGuest: false,
                    credits: 0
                }
            });
        }

        const token = this.generateToken(user);
        return { user: this.toPublicUser(user), token };
    }

    async login(email: string, password: string): Promise<{ user: PublicUser; token: string }> {
        const user = await prisma.user.findUnique({ where: { email: email || '' } });

        if (!user || !user.password) {
            throw new Error('Credenciais inválidas');
        }

        const isValid = await bcrypt.compare(password, user.password);
        if (!isValid) {
            throw new Error('Credenciais inválidas');
        }

        const token = this.generateToken(user);
        return { user: this.toPublicUser(user), token };
    }

    async createGuest(): Promise<{ user: PublicUser; token: string }> {
        const user = await prisma.user.create({
            data: {
                isGuest: true,
                credits: 100
            }
        });

        const token = this.generateToken(user);
        return { user: this.toPublicUser(user), token };
    }

    private generateToken(user: User): string {
        const payload: AuthTokenPayload = {
            sub: user.id,
            email: user.email,
            isGuest: user.isGuest
        };

        return jwt.sign(payload, this.getJwtSecret(), { expiresIn: JWT_EXPIRATION });
    }

    async validateToken(token: string): Promise<AuthTokenPayload> {
        return jwt.verify(token, this.getJwtSecret()) as AuthTokenPayload;
    }

    private toPublicUser(user: User): PublicUser {
        const { password: _password, ...safeUser } = user;
        return safeUser;
    }

    private getJwtSecret(): string {
        const secret = process.env.JWT_SECRET;

        if (!secret || secret.length < 32) {
            throw new Error('JWT_SECRET não configurado com segurança (mínimo 32 caracteres).');
        }

        return secret;
    }
}
