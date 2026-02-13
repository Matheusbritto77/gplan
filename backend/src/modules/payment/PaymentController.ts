import { Request, Response } from 'express';
import { PaymentService } from './PaymentService';
import { AuthRequest } from '../../middlewares/AuthMiddleware';

export class PaymentController {
    private paymentService: PaymentService;

    constructor() {
        this.paymentService = new PaymentService();
    }

    async createPreference(req: AuthRequest, res: Response) {
        try {
            const userId = req.user.sub;
            const result = await this.paymentService.createSubscriptionPreference(userId);
            res.json(result);
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    }

    async webhook(req: Request, res: Response) {
        try {
            const result = await this.paymentService.handleWebhook(req.body);
            res.json(result);
        } catch (error: any) {
            console.error('Webhook error:', error);
            res.status(200).json({ ok: false });
        }
    }
}
