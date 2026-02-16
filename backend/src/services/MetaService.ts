import axios from 'axios';
import crypto from 'crypto';

export interface MetaUserData {
    email?: string;
    phone?: string;
    externalId?: string;
    firstName?: string;
    lastName?: string;
    city?: string;
    state?: string;
    country?: string;
    zip?: string;
    clientIpAddress?: string;
    clientUserAgent?: string;
    fbc?: string;
    fbp?: string;
}

export interface MetaEventData {
    eventName: string;
    eventSourceUrl: string;
    eventID?: string;
    eventTime?: number;
    customData?: unknown;
}

export interface MetaSendEventResult {
    status: 'sent' | 'failed' | 'skipped';
    eventID?: string;
    httpStatus?: number;
    response?: unknown;
    error?: string;
}

export class MetaService {
    private pixelId: string;
    private accessToken: string;
    private apiVersion: string;
    private testEventCode: string;
    private timeoutMs: number;

    constructor() {
        this.pixelId = process.env.META_PIXEL_ID || '';
        this.accessToken = process.env.META_ACCESS_TOKEN || '';
        this.apiVersion = process.env.META_API_VERSION || 'v21.0';
        this.testEventCode = process.env.META_TEST_EVENT_CODE || '';
        this.timeoutMs = Number(process.env.META_API_TIMEOUT_MS || 8000);
    }

    private get apiUrl(): string {
        return `https://graph.facebook.com/${this.apiVersion}/${this.pixelId}/events`;
    }

    private hash(raw: string | undefined): string | undefined {
        const normalized = raw?.trim().toLowerCase();
        if (!normalized) {
            return undefined;
        }

        return crypto.createHash('sha256').update(normalized).digest('hex');
    }

    private normalizePhone(phone: string | undefined): string | undefined {
        const digitsOnly = (phone || '').replace(/[^\d]/g, '');
        return digitsOnly.length >= 8 ? digitsOnly : undefined;
    }

    private normalizeEventName(eventName: string): string {
        const normalized = eventName.trim();
        return normalized.length > 0 ? normalized.slice(0, 64) : 'CustomEvent';
    }

    private normalizeEventTime(eventTime: number | undefined): number {
        const now = Math.floor(Date.now() / 1000);
        if (!eventTime || !Number.isFinite(eventTime) || eventTime <= 0) {
            return now;
        }

        const maxFutureSeconds = 60;
        return Math.min(Math.floor(eventTime), now + maxFutureSeconds);
    }

    private sanitizeCustomData(customData: unknown): Record<string, unknown> | undefined {
        if (!customData || typeof customData !== 'object' || Array.isArray(customData)) {
            return undefined;
        }

        const safe: Record<string, unknown> = {};
        Object.entries(customData as Record<string, unknown>).forEach(([key, value]) => {
            const normalizedKey = key.trim();
            if (!normalizedKey) {
                return;
            }

            if (typeof value === 'string') {
                safe[normalizedKey] = value.slice(0, 2000);
                return;
            }

            if (typeof value === 'number' || typeof value === 'boolean' || value === null) {
                safe[normalizedKey] = value;
                return;
            }
        });

        return Object.keys(safe).length > 0 ? safe : undefined;
    }

    private shouldRetry(httpStatus: number | undefined): boolean {
        if (!httpStatus) {
            return true;
        }

        return httpStatus === 429 || httpStatus >= 500;
    }

    private async wait(ms: number): Promise<void> {
        await new Promise((resolve) => setTimeout(resolve, ms));
    }

    async sendEvent(event: MetaEventData, user: MetaUserData): Promise<MetaSendEventResult> {
        if (!this.pixelId || !this.accessToken) {
            console.warn('Meta Pixel ID ou Access Token não configurados.');
            return { status: 'skipped' };
        }

        const eventID = event.eventID?.trim() || crypto.randomUUID();
        const payload: Record<string, unknown> = {
            data: [{
                event_name: this.normalizeEventName(event.eventName),
                event_time: this.normalizeEventTime(event.eventTime),
                action_source: 'website',
                event_source_url: event.eventSourceUrl,
                event_id: eventID,
                user_data: {
                    em: this.hash(user.email),
                    ph: this.hash(this.normalizePhone(user.phone)),
                    external_id: this.hash(user.externalId),
                    fn: this.hash(user.firstName),
                    ln: this.hash(user.lastName),
                    ct: this.hash(user.city),
                    st: this.hash(user.state),
                    country: this.hash(user.country),
                    zp: this.hash(user.zip),
                    client_ip_address: user.clientIpAddress,
                    client_user_agent: user.clientUserAgent,
                    fbc: user.fbc,
                    fbp: user.fbp
                },
                custom_data: this.sanitizeCustomData(event.customData)
            }],
            access_token: this.accessToken
        };

        if (this.testEventCode) {
            payload.test_event_code = this.testEventCode;
        }

        for (let attempt = 1; attempt <= 2; attempt += 1) {
            try {
                const response = await axios.post(this.apiUrl, payload, {
                    timeout: this.timeoutMs,
                    validateStatus: () => true
                });

                const httpStatus = response.status;
                const hasMetaError = Boolean((response.data as { error?: unknown })?.error);
                if (httpStatus >= 200 && httpStatus < 300 && !hasMetaError) {
                    return {
                        status: 'sent',
                        eventID,
                        httpStatus,
                        response: response.data
                    };
                }

                if (attempt < 2 && this.shouldRetry(httpStatus)) {
                    await this.wait(350);
                    continue;
                }

                const metaError = (response.data as { error?: { message?: string; fbtrace_id?: string } })?.error;
                const details = metaError?.message || `HTTP ${httpStatus}`;
                const trace = metaError?.fbtrace_id ? ` (fbtrace_id: ${metaError.fbtrace_id})` : '';

                return {
                    status: 'failed',
                    eventID,
                    httpStatus,
                    error: `${details}${trace}`,
                    response: response.data
                };
            } catch (error: unknown) {
                const axiosError = error as { response?: { status?: number; data?: unknown }; message?: string };
                const httpStatus = axiosError.response?.status;

                if (attempt < 2 && this.shouldRetry(httpStatus)) {
                    await this.wait(350);
                    continue;
                }

                return {
                    status: 'failed',
                    eventID,
                    httpStatus,
                    error: axiosError.message || 'Falha ao enviar evento para Meta CAPI',
                    response: axiosError.response?.data
                };
            }
        }

        return {
            status: 'failed',
            eventID,
            error: 'Falha desconhecida ao enviar evento para Meta CAPI'
        };
    }
}
