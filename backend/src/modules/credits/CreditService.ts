import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export class CreditService {
    async consumeCredits(userId: string, amount: number = 1): Promise<void> {
        const user = await this.findUser(userId);
        this.validateCredits(user, amount);

        await prisma.$transaction([
            this.updateUserCredits(userId, -amount),
            this.logTransaction(userId, -amount, 'USAGE', 'Geração de planilha')
        ]);
    }

    async addCredits(userId: string, amount: number, externalId?: string): Promise<void> {
        await prisma.$transaction([
            this.updateUserCredits(userId, amount),
            this.logTransaction(userId, amount, 'CREDIT_PURCHASE', `Compra de ${amount} créditos`, externalId)
        ]);
    }

    async getUserBalance(userId: string): Promise<number> {
        const user = await prisma.user.findUnique({ where: { id: userId }, select: { credits: true } });
        return user?.credits || 0;
    }

    private async findUser(id: string) {
        const user = await prisma.user.findUnique({ where: { id } });
        if (!user) throw new Error('Usuário não localizado no sistema.');
        return user;
    }

    private validateCredits(user: any, amount: number) {
        if (user.credits < amount) {
            const msg = user.isGuest
                ? 'Seus créditos de teste terminaram. Registre-se agora para ganhar créditos mensais!'
                : 'Você atingiu seu limite de créditos. Recarregue para continuar criando.';
            throw new Error(msg);
        }
    }

    private updateUserCredits(userId: string, amount: number) {
        return prisma.user.update({
            where: { id: userId },
            data: { credits: { increment: amount } }
        });
    }

    private logTransaction(userId: string, amount: number, type: any, description: string, externalId?: string) {
        return prisma.transaction.create({
            data: { userId, amount, type, status: 'completed', description, externalId }
        });
    }
}
