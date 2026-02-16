import { Request, Response } from 'express';
import { MetaService, MetaEventData, MetaUserData } from '../services/MetaService';

export class MetaController {
    private metaService: MetaService;

    constructor() {
        this.metaService = new MetaService();
    }

    private extractClientIp(req: Request): string | undefined {
        const forwardedFor = req.headers['x-forwarded-for'];
        if (typeof forwardedFor === 'string' && forwardedFor.trim().length > 0) {
            const first = forwardedFor.split(',')[0]?.trim();
            if (first) {
                return first;
            }
        }

        if (Array.isArray(forwardedFor) && forwardedFor.length > 0) {
            const first = forwardedFor[0]?.split(',')[0]?.trim();
            if (first) {
                return first;
            }
        }

        const fallback = req.ip || req.socket.remoteAddress;
        return Array.isArray(fallback) ? fallback[0] : fallback;
    }

    async handleEvent(req: Request, res: Response) {
        try {
            const { eventName, eventSourceUrl, eventID, eventTime, customData, userData } = req.body;

            const clientIpAddress = this.extractClientIp(req);
            const clientUserAgent = req.headers['user-agent'];

            const event: MetaEventData = {
                eventName,
                eventSourceUrl,
                eventID,
                eventTime,
                customData
            };

            const user: MetaUserData = {
                ...userData,
                clientIpAddress,
                clientUserAgent
            };

            const result = await this.metaService.sendEvent(event, user);

            if (result.status === 'failed') {
                return res.status(202).json({
                    status: 'accepted_with_warning',
                    message: 'Evento recebido, mas o envio para Meta CAPI falhou.',
                    data: result
                });
            }

            if (result.status === 'skipped') {
                return res.status(200).json({
                    status: 'skipped',
                    message: 'Meta CAPI não configurada. Evento apenas registrado localmente.'
                });
            }

            return res.json({
                status: 'success',
                message: 'Evento enviado com sucesso para Meta CAPI',
                data: result
            });
        } catch (error: any) {
            return res.status(500).json({
                status: 'error',
                message: error.message
            });
        }
    }
}
