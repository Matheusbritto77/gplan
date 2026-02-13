import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../modules/auth/AuthService';

const authService = new AuthService();

export interface AuthRequest extends Request {
    user?: {
        sub: string;
        email: string | null;
        isGuest: boolean;
    };
}

export const authMiddleware = async (req: AuthRequest, res: Response, next: NextFunction) => {
    const token = extractToken(req);
    if (!token) {
        return res.status(401).json({ error: 'Token não fornecido' });
    }

    try {
        const decoded = await authService.validateToken(token);
        req.user = decoded;
        next();
    } catch (err) {
        return res.status(401).json({ error: 'Token inválido' });
    }
};

export const optionalAuthMiddleware = async (req: AuthRequest, _res: Response, next: NextFunction) => {
    const token = extractToken(req);
    if (!token) {
        return next();
    }

    try {
        req.user = await authService.validateToken(token);
    } catch (_err) {
        req.user = undefined;
    }

    next();
};

function extractToken(req: Request): string | null {
    const headerToken = extractBearerToken(req.headers.authorization);
    if (headerToken) {
        return headerToken;
    }

    const cookies = parseCookieHeader(req.headers.cookie);
    return cookies.auth_token || null;
}

function extractBearerToken(authHeader: string | undefined): string | null {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return null;
    }

    const token = authHeader.slice('Bearer '.length).trim();
    return token.length > 0 ? token : null;
}

function parseCookieHeader(cookieHeader: string | undefined): Record<string, string> {
    if (!cookieHeader) {
        return {};
    }

    return cookieHeader
        .split(';')
        .map((cookiePart) => cookiePart.trim())
        .filter(Boolean)
        .reduce<Record<string, string>>((acc, cookiePart) => {
            const separatorIndex = cookiePart.indexOf('=');
            if (separatorIndex <= 0) {
                return acc;
            }

            const key = cookiePart.slice(0, separatorIndex).trim();
            const value = cookiePart.slice(separatorIndex + 1).trim();
            try {
                acc[key] = decodeURIComponent(value);
            } catch (_err) {
                acc[key] = value;
            }
            return acc;
        }, {});
}
