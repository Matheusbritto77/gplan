import axios from 'axios';

const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || '/api',
    withCredentials: true
});

export const AuthService = {
    async register(email: string, password: string) {
        const response = await api.post('/auth/register', { email, password });
        this.setSession(response.data.user);
        return response.data;
    },

    async login(email: string, password: string) {
        const response = await api.post('/auth/login', { email, password });
        this.setSession(response.data.user);
        return response.data;
    },

    async getMe() {
        const response = await api.get('/user/me');
        localStorage.setItem('user', JSON.stringify(response.data));
        return response.data;
    },

    setSession(user: any) {
        localStorage.setItem('user', JSON.stringify(user));
    },

    async logout() {
        try {
            await api.post('/auth/logout');
        } finally {
            localStorage.removeItem('user');
        }
    },

    async createCheckoutPreference() {
        const response = await api.post('/checkout/preference');
        return response.data;
    }
};

export { api };
