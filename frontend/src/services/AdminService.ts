import { api } from './AuthService';

export type AdminWidgets = {
    totalUsers: number;
    totalRegisteredUsers: number;
    totalGuestUsers: number;
    totalFreeUsers: number;
    totalPremiumUsers: number;
    newUsersToday: number;
    generationsToday: number;
    activeUsers30d: number;
    creditsInWallets: number;
    consumedCredits: number;
    purchasesThisMonth: number;
    estimatedRevenueMonthBRL: number;
    conversionRate: number;
};

export type AdminOverviewResponse = {
    generatedAt: string;
    widgets: AdminWidgets;
};

export type AdminUserItem = {
    id: string;
    email: string | null;
    isGuest: boolean;
    credits: number;
    plan: 'FREE' | 'PREMIUM';
    createdAt: string;
    subscriptionEndsAt: string | null;
    lastActivityAt: string | null;
    generations: number;
    consumedCredits: number;
    purchasedCredits: number;
};

export type AdminUsersResponse = {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    users: AdminUserItem[];
};

export const AdminService = {
    async getOverview(): Promise<AdminOverviewResponse> {
        const response = await api.get('/admin/overview');
        return response.data;
    },

    async listUsers(params: {
        page?: number;
        limit?: number;
        search?: string;
        includeGuests?: boolean;
    }): Promise<AdminUsersResponse> {
        const response = await api.get('/admin/users', { params });
        return response.data;
    }
};
