import axios from 'axios';

interface MetaEventParams {
    eventName: string;
    customData?: any;
    userData?: {
        email?: string;
        phone?: string;
    };
}

const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || '/api'
});

export const AnalyticsService = {
    sendEvent({ eventName, customData, userData }: MetaEventParams) {
        const eventID = 'evt_' + Math.random().toString(36).substring(2, 15) + Date.now();
        const eventSourceUrl = window.location.href;

        // 1. Enviar via Navegador (Pixel JS)
        if ((window as any).fbq) {
            (window as any).fbq('track', eventName, customData, { eventID });
        }

        // 2. Enviar via Servidor (CAPI)
        // Não bloqueamos a UI esperando o CAPI, disparar e esquecer (ou logar erro)
        api.post('/meta/event', {
            eventName,
            eventSourceUrl,
            eventID,
            customData,
            userData
        }).catch(err => {
            console.error('Falha ao enviar evento para CAPI:', err);
        });
    },

    pageView() {
        this.sendEvent({ eventName: 'PageView' });
    }
};
