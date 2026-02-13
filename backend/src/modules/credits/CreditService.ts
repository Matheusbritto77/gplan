import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

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

    private validateCredits(user: { credits: number; isGuest: boolean }, amount: number) {
        if (user.credits < amount) {
            const msg = user.isGuest
                ? 'Seus créditos de teste terminaram. Registre-se agora para ganhar créditos mensais!'
                : 'Você atingiu seu limite de créditos. Recarregue para continuar criando.';
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
