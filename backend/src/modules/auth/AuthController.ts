import { Request, Response } from 'express';
import { AuthService } from './AuthService';

const SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export class AuthController {
    private authService: AuthService;

    constructor() {
        this.authService = new AuthService();
    }

    async register(req: Request, res: Response) {
        try {
            const { email, password } = req.body;

            const result = await this.authService.register(email, password);
            this.setAuthCookie(res, result.token);
            res.json({ user: result.user });
        } catch (error: any) {
            if (error?.code === "P2002") {
                return res.status(409).json({ error: "Este e-mail já está em uso." });
            }

            res.status(400).json({ error: error.message || "Falha no cadastro." });
        }
    }

    async login(req: Request, res: Response) {
        try {
            const { email, password } = req.body;
            const result = await this.authService.login(email, password);
            this.setAuthCookie(res, result.token);
            res.json({ user: result.user });
        } catch (error: any) {
            res.status(401).json({ error: "Credenciais inválidas" });
        }
    }

    async guest(req: Request, res: Response) {
        try {
            const result = await this.authService.createGuest();
            this.setAuthCookie(res, result.token);
            res.json({ user: result.user });
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    }

    async logout(_req: Request, res: Response) {
        res.clearCookie('auth_token', this.getCookieOptions());
        res.json({ status: 'ok' });
    }

    private setAuthCookie(res: Response, token: string) {
        res.cookie('auth_token', token, this.getCookieOptions());
    }

    private getCookieOptions() {
        return {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict' as const,
            maxAge: SESSION_MAX_AGE_MS,
            path: '/'
        };
    }
}
