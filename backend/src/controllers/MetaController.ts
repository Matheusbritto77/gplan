import { Request, Response } from 'express';
import { MetaService, MetaEventData, MetaUserData } from '../services/MetaService';

export class MetaController {
    private metaService: MetaService;

    constructor() {
        this.metaService = new MetaService();
    }

    async handleEvent(req: Request, res: Response) {
        try {
            const { eventName, eventSourceUrl, eventID, customData, userData } = req.body;

            const clientIpAddress = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;
            const clientUserAgent = req.headers['user-agent'];

            const event: MetaEventData = {
                eventName,
                eventSourceUrl,
                eventID,
                customData
            };

            const user: MetaUserData = {
                ...userData,
                clientIpAddress: Array.isArray(clientIpAddress) ? clientIpAddress[0] : clientIpAddress,
                clientUserAgent
            };

            const result = await this.metaService.sendEvent(event, user);

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
