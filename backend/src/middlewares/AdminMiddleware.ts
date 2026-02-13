import { NextFunction, Response } from "express";
import { AuthRequest } from "./AuthMiddleware";
import { isAdminEmail } from "../utils/AdminUtils";

export function adminMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
    if (!req.user) {
        return res.status(401).json({ error: "Token inválido" });
    }

    if (!isAdminEmail(req.user.email)) {
        return res.status(403).json({ error: "Acesso restrito a administradores" });
    }

    next();
}
