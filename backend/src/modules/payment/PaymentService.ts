import { MercadoPagoConfig, Preference, Payment } from 'mercadopago';
import { PrismaClient } from '@prisma/client';
import { CreditService } from '../credits/CreditService';

const prisma = new PrismaClient();
const MP_ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN || '';

const client = new MercadoPagoConfig({ accessToken: MP_ACCESS_TOKEN });
const creditService = new CreditService();

export class PaymentService {
    async createSubscriptionPreference(userId: string) {
        const preference = new Preference(client);

        const response = await preference.create({
            body: {
                items: [
                    {
                        id: 'plan_600_credits',
                        title: 'Assinatura Mensal - 600 Créditos',
                        quantity: 1,
                        unit_price: 30.00,
                        currency_id: 'BRL'
                    }
                ],
                metadata: {
                    user_id: userId,
                    type: 'subscription'
                },
                back_urls: {
                    success: `${process.env.FRONTEND_URL || 'http://localhost'}/?payment=success`,
                    failure: `${process.env.FRONTEND_URL || 'http://localhost'}/?payment=failure`,
                    pending: `${process.env.FRONTEND_URL || 'http://localhost'}/?payment=pending`
                },
                auto_return: 'approved',
                notification_url: `${process.env.BACKEND_URL || 'http://localhost'}/api/checkout/webhook`
            }
        });

        return { init_point: response.init_point };
    }

    async handleWebhook(payload: any) {
        const { type, data } = payload;

        if (type === 'payment') {
            const payment = new Payment(client);
            const paymentData = await payment.get({ id: data.id });

            if (paymentData.status === 'approved') {
                const userId = paymentData.metadata?.user_id;
                const externalId = paymentData.id?.toString();

                if (userId && externalId) {
                    const existing = await prisma.transaction.findUnique({ where: { externalId } });
                    if (!existing) {
                        await creditService.addCredits(userId, 600, externalId);

                        await prisma.subscription.create({
                            data: {
                                userId,
                                plan: 'monthly',
                                status: 'active',
                                startDate: new Date(),
                                endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
                            }
                        });
                    }
                }
            }
        }

        return { success: true };
    }
}
