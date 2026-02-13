import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export class CreditService {
    async consumeCredits(userId: string, amount: number = 1): Promise<void> {
        const user = await prisma.user.findUnique({ where: { id: userId } });

        if (!user) throw new Error('Usuário não encontrado');
        if (user.credits < amount) {
            throw new Error(user.isGuest ? 'Seus créditos grátis acabaram. Crie uma conta para continuar!' : 'Créditos insuficientes. Recarregue sua conta!');
        }

        await prisma.$transaction([
            prisma.user.update({
                where: { id: userId },
                data: { credits: { decrement: amount } }
            }),
            prisma.transaction.create({
                data: {
                    userId,
                    amount: -amount,
                    type: 'USAGE',
                    status: 'completed',
                    description: 'Geração de planilha'
                }
            })
        ]);
    }

    async addCredits(userId: string, amount: number, transactionId?: string): Promise<void> {
        await prisma.$transaction([
            prisma.user.update({
                where: { id: userId },
                data: { credits: { increment: amount } }
            }),
            prisma.transaction.create({
                data: {
                    userId,
                    amount,
                    type: 'CREDIT_PURCHASE',
                    status: 'completed',
                    externalId: transactionId,
                    description: `Compra de ${amount} créditos`
                }
            })
        ]);
    }

    async getUserBalance(userId: string): Promise<number> {
        const user = await prisma.user.findUnique({ where: { id: userId } });
        return user?.credits || 0;
    }
}
