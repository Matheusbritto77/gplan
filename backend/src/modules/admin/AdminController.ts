import { Request, Response } from "express";
import { AdminService } from "./AdminService";

type ParsedUserQuery = {
    page: number;
    limit: number;
    search?: string;
    includeGuests: boolean;
};

export class AdminController {
    private adminService: AdminService;

    constructor() {
        this.adminService = new AdminService();
    }

    async getOverview(_req: Request, res: Response) {
        try {
            const overview = await this.adminService.getOverview();
            res.json(overview);
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : "Erro interno";
            res.status(500).json({ error: message });
        }
    }

    async listUsers(req: Request, res: Response) {
        try {
            const query = this.parseUsersQuery(req);
            const users = await this.adminService.listUsers(query);
            res.json(users);
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : "Erro interno";
            res.status(400).json({ error: message });
        }
    }

    private parseUsersQuery(req: Request): ParsedUserQuery {
        const page = this.parseInteger(req.query.page, 1, 1, 100000);
        const limit = this.parseInteger(req.query.limit, 20, 1, 100);
        const includeGuests = this.parseBoolean(req.query.includeGuests, true);
        const search = this.parseSearch(req.query.search);

        return { page, limit, search, includeGuests };
    }

    private parseInteger(value: unknown, fallback: number, min: number, max: number): number {
        if (value === undefined) {
            return fallback;
        }

        const rawValue = Array.isArray(value) ? value[0] : value;
        const parsed = Number(rawValue);
        if (!Number.isInteger(parsed)) {
            throw new Error("Parâmetro numérico inválido");
        }

        if (parsed < min || parsed > max) {
            throw new Error(`Parâmetro fora do intervalo permitido (${min}-${max})`);
        }

        return parsed;
    }

    private parseBoolean(value: unknown, fallback: boolean): boolean {
        if (value === undefined) {
            return fallback;
        }

        const rawValue = String(Array.isArray(value) ? value[0] : value).toLowerCase().trim();
        if (rawValue === "true" || rawValue === "1") {
            return true;
        }

        if (rawValue === "false" || rawValue === "0") {
            return false;
        }

        throw new Error("Parâmetro booleano inválido");
    }

    private parseSearch(value: unknown): string | undefined {
        if (value === undefined) {
            return undefined;
        }

        const rawValue = String(Array.isArray(value) ? value[0] : value).trim();
        if (!rawValue) {
            return undefined;
        }

        return rawValue.slice(0, 120);
    }
}
