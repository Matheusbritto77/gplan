import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

type AdminListUsersInput = {
    page: number;
    limit: number;
    search?: string;
    includeGuests?: boolean;
};

type UserDashboardItem = {
    id: string;
    email: string | null;
    isGuest: boolean;
    credits: number;
    plan: "FREE" | "PREMIUM";
    createdAt: Date;
    subscriptionEndsAt: Date | null;
    lastActivityAt: Date | null;
    generations: number;
    consumedCredits: number;
    purchasedCredits: number;
};

export class AdminService {
    async getOverview() {
        const now = new Date();
        const startToday = new Date(now);
        startToday.setHours(0, 0, 0, 0);

        const startMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

        const [
            totalUsers,
            totalRegisteredUsers,
            totalGuestUsers,
            usersCreditsAggregate,
            totalUsageAggregate,
            newUsersToday,
            generationsToday,
            purchasesThisMonth,
            activePremiumSubscriptions,
            activeUsers30dGrouped
        ] = await Promise.all([
            prisma.user.count(),
            prisma.user.count({ where: { isGuest: false } }),
            prisma.user.count({ where: { isGuest: true } }),
            prisma.user.aggregate({ _sum: { credits: true } }),
            prisma.transaction.aggregate({
                where: { type: "USAGE" },
                _sum: { amount: true }
            }),
            prisma.user.count({
                where: {
                    isGuest: false,
                    createdAt: { gte: startToday }
                }
            }),
            prisma.transaction.count({
                where: {
                    type: "USAGE",
                    createdAt: { gte: startToday }
                }
            }),
            prisma.transaction.count({
                where: {
                    type: "CREDIT_PURCHASE",
                    createdAt: { gte: startMonth }
                }
            }),
            prisma.subscription.findMany({
                where: {
                    status: "active",
                    OR: [
                        { endDate: null },
                        { endDate: { gt: now } }
                    ]
                },
                select: { userId: true },
                distinct: ["userId"]
            }),
            prisma.transaction.groupBy({
                by: ["userId"],
                where: {
                    createdAt: { gte: last30Days }
                }
            })
        ]);

        const premiumUserIdSet = new Set(activePremiumSubscriptions.map((item) => item.userId));
        const totalPremiumUsers = premiumUserIdSet.size;
        const totalFreeUsers = Math.max(0, totalRegisteredUsers - totalPremiumUsers);
        const creditsInWallets = usersCreditsAggregate._sum.credits || 0;
        const consumedCredits = Math.abs(totalUsageAggregate._sum.amount || 0);
        const activeUsers30d = activeUsers30dGrouped.length;
        const conversionRate = totalRegisteredUsers > 0
            ? Number(((totalPremiumUsers / totalRegisteredUsers) * 100).toFixed(2))
            : 0;

        return {
            generatedAt: now.toISOString(),
            widgets: {
                totalUsers,
                totalRegisteredUsers,
                totalGuestUsers,
                totalFreeUsers,
                totalPremiumUsers,
                newUsersToday,
                generationsToday,
                activeUsers30d,
                creditsInWallets,
                consumedCredits,
                purchasesThisMonth,
                estimatedRevenueMonthBRL: purchasesThisMonth * 30,
                conversionRate
            }
        };
    }

    async listUsers(input: AdminListUsersInput) {
        const { page, limit, search, includeGuests } = input;
        const skip = (page - 1) * limit;
        const now = new Date();

        const normalizedSearch = (search || "").trim();
        const whereClause = {
            ...(includeGuests ? {} : { isGuest: false }),
            ...(normalizedSearch
                ? {
                    email: {
                        contains: normalizedSearch,
                        mode: "insensitive" as const
                    }
                }
                : {})
        };

        const [total, users] = await Promise.all([
            prisma.user.count({ where: whereClause }),
            prisma.user.findMany({
                where: whereClause,
                orderBy: { createdAt: "desc" },
                skip,
                take: limit,
                select: {
                    id: true,
                    email: true,
                    isGuest: true,
                    credits: true,
                    createdAt: true
                }
            })
        ]);

        const userIds = users.map((user) => user.id);
        if (userIds.length === 0) {
            return {
                page,
                limit,
                total,
                totalPages: Math.max(1, Math.ceil(total / limit)),
                users: [] as UserDashboardItem[]
            };
        }

        const [usageByUser, purchasesByUser, lastActivityByUser, activeSubscriptions] = await Promise.all([
            prisma.transaction.groupBy({
                by: ["userId"],
                where: {
                    userId: { in: userIds },
                    type: "USAGE"
                },
                _count: { id: true },
                _sum: { amount: true }
            }),
            prisma.transaction.groupBy({
                by: ["userId"],
                where: {
                    userId: { in: userIds },
                    type: "CREDIT_PURCHASE"
                },
                _sum: { amount: true }
            }),
            prisma.transaction.groupBy({
                by: ["userId"],
                where: {
                    userId: { in: userIds }
                },
                _max: { createdAt: true }
            }),
            prisma.subscription.findMany({
                where: {
                    userId: { in: userIds },
                    status: "active",
                    OR: [
                        { endDate: null },
                        { endDate: { gt: now } }
                    ]
                },
                select: {
                    userId: true,
                    endDate: true
                },
                orderBy: { endDate: "desc" }
            })
        ]);

        const usageMap = new Map(
            usageByUser.map((item) => [
                item.userId,
                {
                    generations: item._count.id,
                    consumedCredits: Math.abs(item._sum.amount || 0)
                }
            ])
        );

        const purchaseMap = new Map(
            purchasesByUser.map((item) => [
                item.userId,
                item._sum.amount || 0
            ])
        );

        const activityMap = new Map(
            lastActivityByUser.map((item) => [
                item.userId,
                item._max.createdAt || null
            ])
        );

        const subscriptionMap = new Map<string, Date | null>();
        for (const subscription of activeSubscriptions) {
            if (!subscriptionMap.has(subscription.userId)) {
                subscriptionMap.set(subscription.userId, subscription.endDate);
            }
        }

        const usersDashboard = users.map<UserDashboardItem>((user) => {
            const usage = usageMap.get(user.id) || { generations: 0, consumedCredits: 0 };
            const subscriptionEndsAt = subscriptionMap.get(user.id) || null;
            return {
                id: user.id,
                email: user.email,
                isGuest: user.isGuest,
                credits: user.credits,
                plan: subscriptionMap.has(user.id) ? "PREMIUM" : "FREE",
                createdAt: user.createdAt,
                subscriptionEndsAt,
                lastActivityAt: activityMap.get(user.id) || null,
                generations: usage.generations,
                consumedCredits: usage.consumedCredits,
                purchasedCredits: purchaseMap.get(user.id) || 0
            };
        });

        return {
            page,
            limit,
            total,
            totalPages: Math.max(1, Math.ceil(total / limit)),
            users: usersDashboard
        };
    }
}
