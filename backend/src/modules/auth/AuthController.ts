import { Request, Response } from 'express';
import { AuthService } from './AuthService';

export class AuthController {
    private authService: AuthService;

    constructor() {
        this.authService = new AuthService();
    }

    async register(req: Request, res: Response) {
        try {
            const { email, password, guestId } = req.body;
            const result = await this.authService.register(email, password, guestId);
            res.json(result);
        } catch (error: any) {
            res.status(400).json({ error: error.message });
        }
    }

    async login(req: Request, res: Response) {
        try {
            const { email, password } = req.body;
            const result = await this.authService.login(email, password);
            res.json(result);
        } catch (error: any) {
            res.status(400).json({ error: error.message });
        }
    }

    async guest(req: Request, res: Response) {
        try {
            const result = await this.authService.createGuest();
            res.json(result);
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    }
}
