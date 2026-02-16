import axios from 'axios';

interface MetaEventParams {
    eventName: string;
    customData?: any;
    userData?: {
        email?: string;
        phone?: string;
        externalId?: string;
    };
}

const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || '/api',
    timeout: 6000
});

const getCookie = (name: string) => {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop()?.split(';').shift();
    return undefined;
};

export const AnalyticsService = {
    getStoredUser() {
        try {
            const raw = localStorage.getItem('user');
            if (!raw) return null;
            return JSON.parse(raw) as { id?: string; email?: string | null };
        } catch (_err) {
            return null;
        }
    },

    buildEventId() {
        const canUseCrypto = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function';
        return canUseCrypto
            ? `evt_${crypto.randomUUID()}`
            : `evt_${Math.random().toString(36).slice(2)}${Date.now()}`;
    },

    sendEvent({ eventName, customData, userData }: MetaEventParams) {
        const eventID = this.buildEventId();
        const eventSourceUrl = window.location.href;
        const userFromStorage = this.getStoredUser();

        // Captura cookes da Meta para aumentar a qualidade do Match (Dataset Quality)
        const fbc = getCookie('_fbc');
        const fbp = getCookie('_fbp');

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
            userData: {
                ...userData,
                email: userData?.email || userFromStorage?.email || undefined,
                externalId: userData?.externalId || userFromStorage?.id || undefined,
                fbc,
                fbp
            }
        }).catch(err => {
            console.error('Falha ao enviar evento para CAPI:', err);
        });
    },

    pageView() {
        this.sendEvent({ eventName: 'PageView' });
    }
};
