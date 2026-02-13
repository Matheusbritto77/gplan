import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

export type AccountStatus = {
    id: string;
    email: string | null;
    credits: number;
    isGuest: boolean;
    plan: 'FREE' | 'PREMIUM';
    subscriptionEndsAt: Date | null;
};

export class CreditService {
    async consumeCredits(userId: string, amount: number = 1): Promise<void> {
        await prisma.$transaction(async (tx) => {
            const updated = await tx.user.updateMany({
                where: {
                    id: userId,
                    credits: { gte: amount }
                },
                data: {
                    credits: { decrement: amount }
                }
            });

            if (updated.count === 0) {
                const user = await tx.user.findUnique({
                    where: { id: userId },
                    select: { id: true, credits: true, isGuest: true }
                });

                if (!user) {
                    throw new Error('Usuário não localizado no sistema.');
                }

                this.validateCredits(user, amount);
            }

            await this.logTransaction(tx, userId, -amount, 'USAGE', 'Geração de planilha');
        });
    }

    async addCredits(userId: string, amount: number, externalId?: string): Promise<void> {
        await prisma.$transaction(async (tx) => {
            await tx.user.update({
                where: { id: userId },
                data: {
                    credits: { increment: amount }
                }
            });

            await this.logTransaction(tx, userId, amount, 'CREDIT_PURCHASE', `Compra de ${amount} créditos`, externalId);
        });
    }

    async getUserBalance(userId: string): Promise<number> {
        const user = await prisma.user.findUnique({ where: { id: userId }, select: { credits: true } });
        return user?.credits || 0;
    }

    async getAccountStatus(userId: string): Promise<AccountStatus> {
        const now = new Date();

        await prisma.subscription.updateMany({
            where: {
                userId,
                status: 'active',
                endDate: { lte: now }
            },
            data: { status: 'expired' }
        });

        const [user, activeSubscription] = await prisma.$transaction([
            prisma.user.findUnique({
                where: { id: userId },
                select: { id: true, email: true, credits: true, isGuest: true }
            }),
            prisma.subscription.findFirst({
                where: {
                    userId,
                    status: 'active',
                    OR: [
                        { endDate: null },
                        { endDate: { gt: now } }
                    ]
                },
                orderBy: { endDate: 'desc' }
            })
        ]);

        if (!user) {
            throw new Error('Usuário não localizado no sistema.');
        }

        return {
            id: user.id,
            email: user.email,
            credits: user.credits,
            isGuest: user.isGuest,
            plan: activeSubscription ? 'PREMIUM' : 'FREE',
            subscriptionEndsAt: activeSubscription?.endDate || null
        };
    }

    private validateCredits(user: { credits: number; isGuest: boolean }, amount: number) {
        if (user.credits < amount) {
            const msg = user.isGuest
                ? 'Faça login para liberar seus 100 créditos iniciais.'
                : 'Você atingiu seu limite de créditos. Faça upgrade para o plano premium.';
            throw new Error(msg);
        }
    }

    private logTransaction(
        tx: Prisma.TransactionClient,
        userId: string,
        amount: number,
        type: string,
        description: string,
        externalId?: string
    ) {
        return tx.transaction.create({
            data: { userId, amount, type, status: 'completed', description, externalId }
        });
    }
}
