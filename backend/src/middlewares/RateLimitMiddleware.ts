import { Request, Response, NextFunction } from 'express';

type RateLimitOptions = {
    windowMs: number;
    max: number;
    keyPrefix: string;
};

type Entry = {
    count: number;
    resetAt: number;
};

const rateLimitStore = new Map<string, Entry>();

export function createRateLimiter(options: RateLimitOptions) {
    const { windowMs, max, keyPrefix } = options;

    return (req: Request, res: Response, next: NextFunction) => {
        const ip = req.ip || req.socket.remoteAddress || 'unknown';
        const key = `${keyPrefix}:${ip}`;
        const now = Date.now();
        const entry = rateLimitStore.get(key);

        if (!entry || entry.resetAt <= now) {
            rateLimitStore.set(key, { count: 1, resetAt: now + windowMs });
            return next();
        }

        if (entry.count >= max) {
            const retryAfterSeconds = Math.max(1, Math.ceil((entry.resetAt - now) / 1000));
            res.setHeader('Retry-After', retryAfterSeconds.toString());
            return res.status(429).json({ error: 'Muitas requisições. Tente novamente em instantes.' });
        }

        entry.count += 1;
        rateLimitStore.set(key, entry);
        next();
    };
}
