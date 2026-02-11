import axios from 'axios';
import crypto from 'crypto';

export interface MetaUserData {
    email?: string;
    phone?: string;
    clientIpAddress?: string;
    clientUserAgent?: string;
    fbc?: string;
    fbp?: string;
}

export interface MetaEventData {
    eventName: string;
    eventSourceUrl: string;
    eventID?: string;
    customData?: any;
}

export class MetaService {
    private pixelId: string;
    private accessToken: string;
    private apiUrl: string;

    constructor() {
        this.pixelId = process.env.META_PIXEL_ID || '';
        this.accessToken = process.env.META_ACCESS_TOKEN || '';
        this.apiUrl = `https://graph.facebook.com/v17.0/${this.pixelId}/events`;
    }

    private hash(data: string | undefined): string | null {
        return data
            ? crypto.createHash('sha256').update(data.trim().toLowerCase()).digest('hex')
            : null;
    }

    async sendEvent(event: MetaEventData, user: MetaUserData) {
        if (!this.pixelId || !this.accessToken) {
            console.warn('Meta Pixel ID ou Access Token não configurados.');
            return;
        }

        const payload = {
            data: [{
                event_name: event.eventName,
                event_time: Math.floor(Date.now() / 1000),
                action_source: 'website',
                event_source_url: event.eventSourceUrl,
                event_id: event.eventID,
                user_data: {
                    em: this.hash(user.email),
                    ph: this.hash(user.phone),
                    client_ip_address: user.clientIpAddress,
                    client_user_agent: user.clientUserAgent,
                    fbc: user.fbc,
                    fbp: user.fbp
                },
                custom_data: event.customData
            }],
            access_token: this.accessToken
        };

        try {
            const response = await axios.post(this.apiUrl, payload);
            return response.data;
        } catch (error: any) {
            console.error('Erro ao enviar evento para Meta CAPI:', error.response?.data || error.message);
            throw error;
        }
    }
}
