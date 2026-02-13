import { MercadoPagoConfig, Preference, Payment } from 'mercadopago';
import { PrismaClient } from '@prisma/client';
import { CreditService } from '../credits/CreditService';
import crypto from 'crypto';
import { IncomingHttpHeaders } from 'http';

const prisma = new PrismaClient();
const creditService = new CreditService();
const MONTHLY_CREDITS = 600;
const MONTHLY_DURATION_MS = 30 * 24 * 60 * 60 * 1000;

export class PaymentService {
    async createSubscriptionPreference(userId: string) {
        const accessToken = this.getAccessToken();
        if (!accessToken) {
            throw new Error('MP_ACCESS_TOKEN não configurado');
        }

        const client = new MercadoPagoConfig({ accessToken });
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
                external_reference: userId,
                back_urls: {
                    success: `${process.env.APP_URL || 'http://localhost'}/?payment=success`,
                    failure: `${process.env.APP_URL || 'http://localhost'}/?payment=failure`,
                    pending: `${process.env.APP_URL || 'http://localhost'}/?payment=pending`
                },
                auto_return: 'approved',
                notification_url: `${process.env.APP_URL || 'http://localhost'}/api/checkout/webhook`
            }
        });

        return { init_point: response.init_point };
    }

    isWebhookSignatureValid(headers: IncomingHttpHeaders, payload: any): boolean {
        const webhookSecret = this.getWebhookSecret();
        if (!webhookSecret) {
            return process.env.NODE_ENV !== 'production';
        }

        const signatureHeader = this.getHeaderValue(headers['x-signature']);
        const requestId = this.getHeaderValue(headers['x-request-id']);
        const dataId = payload?.data?.id?.toString() || payload?.id?.toString();

        if (!signatureHeader || !requestId || !dataId) {
            return false;
        }

        const signatureParts = this.parseSignatureHeader(signatureHeader);
        if (!signatureParts.ts || !signatureParts.v1) {
            return false;
        }

        const manifest = `id:${dataId};request-id:${requestId};ts:${signatureParts.ts};`;
        const expected = crypto
            .createHmac('sha256', webhookSecret)
            .update(manifest)
            .digest('hex');

        return this.secureCompare(expected, signatureParts.v1);
    }

    async handleWebhook(payload: any) {
        const accessToken = this.getAccessToken();
        if (!accessToken) {
            throw new Error('MP_ACCESS_TOKEN não configurado');
        }

        const client = new MercadoPagoConfig({ accessToken });
        const type = payload?.type || payload?.topic;
        const paymentId = payload?.data?.id || payload?.id;

        if (type === 'payment' && paymentId) {
            const payment = new Payment(client);
            const paymentData = await payment.get({ id: paymentId });

            if (paymentData.status === 'approved') {
                const userId = paymentData.metadata?.user_id || paymentData.external_reference;
                const externalId = paymentData.id?.toString();

                if (userId && externalId) {
                    const existing = await prisma.transaction.findUnique({ where: { externalId } });
                    if (!existing) {
                        await creditService.addCredits(userId, MONTHLY_CREDITS, externalId);
                        await this.activateOrExtendSubscription(userId);
                    }
                }
            }
        }

        return { success: true };
    }

    private parseSignatureHeader(signatureHeader: string): Record<string, string> {
        return signatureHeader
            .split(',')
            .map((item) => item.trim())
            .filter(Boolean)
            .reduce<Record<string, string>>((acc, item) => {
                const [key, value] = item.split('=');
                if (!key || !value) {
                    return acc;
                }

                acc[key.trim()] = value.trim();
                return acc;
            }, {});
    }

    private getHeaderValue(header: string | string[] | undefined): string | null {
        if (!header) {
            return null;
        }

        if (Array.isArray(header)) {
            return header[0] || null;
        }

        return header;
    }

    private secureCompare(a: string, b: string): boolean {
        if (a.length !== b.length) {
            return false;
        }

        return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
    }

    private async activateOrExtendSubscription(userId: string) {
        const now = new Date();

        await prisma.subscription.updateMany({
            where: {
                userId,
                status: 'active',
                endDate: { lte: now }
            },
            data: { status: 'expired' }
        });

        const activeSubscription = await prisma.subscription.findFirst({
            where: {
                userId,
                status: 'active',
                OR: [
                    { endDate: null },
                    { endDate: { gt: now } }
                ]
            },
            orderBy: { endDate: 'desc' }
        });

        if (!activeSubscription) {
            await prisma.subscription.create({
                data: {
                    userId,
                    plan: 'monthly',
                    status: 'active',
                    startDate: now,
                    endDate: new Date(now.getTime() + MONTHLY_DURATION_MS)
                }
            });
            return;
        }

        const baseDate = activeSubscription.endDate && activeSubscription.endDate > now
            ? activeSubscription.endDate
            : now;

        await prisma.subscription.update({
            where: { id: activeSubscription.id },
            data: {
                status: 'active',
                endDate: new Date(baseDate.getTime() + MONTHLY_DURATION_MS)
            }
        });
    }

    private getAccessToken(): string {
        return process.env.MP_ACCESS_TOKEN || '';
    }

    private getWebhookSecret(): string {
        return process.env.MP_WEBHOOK_SECRET || '';
    }
}
