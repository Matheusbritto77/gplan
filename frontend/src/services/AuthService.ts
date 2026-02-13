import axios from 'axios';
import { CookieService } from './CookieService';

const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || '/api'
});

api.interceptors.request.use(config => {
    const token = localStorage.getItem('token') || CookieService.get('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

export const AuthService = {
    async register(email: string, password: string, guestId?: string) {
        const response = await api.post('/auth/register', { email, password, guestId });
        if (response.data.token) {
            this.setSession(response.data.token, response.data.user);
        }
        return response.data;
    },

    async login(email: string, password: string) {
        const response = await api.post('/auth/login', { email, password });
        if (response.data.token) {
            this.setSession(response.data.token, response.data.user);
        }
        return response.data;
    },

    async getGuestToken() {
        // Tenta recuperar do cookie antes de criar um novo
        const existingToken = CookieService.get('token');
        if (existingToken) {
            try {
                const user = await this.getMe();
                return { token: existingToken, user };
            } catch (e) {
                // Token expirado ou inválido
            }
        }

        const response = await api.post('/auth/guest');
        if (response.data.token) {
            this.setSession(response.data.token, response.data.user);
        }
        return response.data;
    },

    async getMe() {
        const response = await api.get('/user/me');
        localStorage.setItem('user', JSON.stringify(response.data));
        return response.data;
    },

    setSession(token: string, user: any) {
        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(user));
        CookieService.set('token', token, 7);
    },

    logout() {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        CookieService.set('token', '', -1);
    },

    async createCheckoutPreference() {
        const response = await api.post('/checkout/preference');
        return response.data;
    }
};

export { api };
