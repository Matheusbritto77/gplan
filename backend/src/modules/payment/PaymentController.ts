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
            if (!req.user?.sub) {
                return res.status(401).json({ error: 'Token inválido' });
            }

            const userId = req.user.sub;
            const result = await this.paymentService.createSubscriptionPreference(userId);
            res.json(result);
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    }

    async webhook(req: Request, res: Response) {
        try {
            if (!this.paymentService.isWebhookSignatureValid(req.headers, req.body)) {
                return res.status(401).json({ error: 'Assinatura de webhook inválida' });
            }

            const result = await this.paymentService.handleWebhook(req.body);
            res.json(result);
        } catch (error: any) {
            console.error('Webhook error:', error);
            res.status(500).json({ ok: false });
        }
    }
}
