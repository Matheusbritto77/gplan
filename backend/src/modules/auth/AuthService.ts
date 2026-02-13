import { PrismaClient, User } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key';

export class AuthService {
    async register(email: string, password: string, guestId?: string): Promise<{ user: User; token: string }> {
        const hashedPassword = await bcrypt.hash(password, 10);

        let user: User;

        if (guestId) {
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
        return { user, token };
    }

    async login(email: string, password: string): Promise<{ user: User; token: string }> {
        const user = await prisma.user.findUnique({ where: { email: email || '' } });

        if (!user || !user.password) {
            throw new Error('Usuário não encontrado ou sem senha cadastrada');
        }

        const isValid = await bcrypt.compare(password, user.password);
        if (!isValid) {
            throw new Error('Senha inválida');
        }

        const token = this.generateToken(user);
        return { user, token };
    }

    async createGuest(): Promise<{ user: User; token: string }> {
        const user = await prisma.user.create({
            data: {
                isGuest: true,
                credits: 100
            }
        });

        const token = this.generateToken(user);
        return { user, token };
    }

    private generateToken(user: User): string {
        return jwt.sign({ sub: user.id, email: user.email, isGuest: user.isGuest }, JWT_SECRET, { expiresIn: '7d' });
    }

    async validateToken(token: string): Promise<any> {
        return jwt.verify(token, JWT_SECRET);
    }
}
