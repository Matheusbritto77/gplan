import dotenv from "dotenv";
import path from "path";
import fs from "fs";

const envCandidates = [
    path.resolve(process.cwd(), ".env"),
    path.resolve(__dirname, "../.env"),
    path.resolve(__dirname, "../../.env")
];

for (const envPath of envCandidates) {
    if (fs.existsSync(envPath)) {
        dotenv.config({ path: envPath, override: false });
    }
}

import express from "express";
import cors from "cors";
import { body, validationResult } from "express-validator";
import { SpreadsheetController } from "./controllers/SpreadsheetController";
import { MetaController } from "./controllers/MetaController";
import { AuthController } from "./modules/auth/AuthController";
import { PaymentController } from "./modules/payment/PaymentController";
import { authMiddleware, AuthRequest } from "./middlewares/AuthMiddleware";
import { CreditService } from "./modules/credits/CreditService";
import { createRateLimiter } from "./middlewares/RateLimitMiddleware";
import { downloadRequestSchema, metaEventRequestSchema, processRequestSchema } from "./validators/requestSchemas";
import { adminMiddleware } from "./middlewares/AdminMiddleware";
import { AdminController } from "./modules/admin/AdminController";
import { isAdminEmail } from "./utils/AdminUtils";

const app = express();
const port = process.env.PORT || 80;
const allowedOrigins = (process.env.CORS_ORIGINS || process.env.APP_URL || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

app.set("trust proxy", 1);
app.disable("x-powered-by");
app.use(cors({
    origin: (origin, callback) => {
        if (!origin) {
            return callback(null, true);
        }

        if (allowedOrigins.includes(origin)) {
            return callback(null, true);
        }

        const isLocalhost = /^http:\/\/localhost(:\d+)?$/i.test(origin) || /^http:\/\/127\.0\.0\.1(:\d+)?$/i.test(origin);
        if (process.env.NODE_ENV !== "production" && isLocalhost) {
            return callback(null, true);
        }

        return callback(new Error("Origem não permitida pelo CORS"));
    },
    credentials: true,
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"]
}));
app.use((_, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");

    if (process.env.NODE_ENV === "production") {
        res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    }

    next();
});
app.use(express.json({ limit: "2mb" }));

const apiKey = process.env.GEMINI_API_KEY || "";
const controller = new SpreadsheetController(apiKey);
const metaController = new MetaController();
const authController = new AuthController();
const paymentController = new PaymentController();
const adminController = new AdminController();
const creditService = new CreditService();
const CREDITS_PER_GENERATION = 20;
const authLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 30, keyPrefix: "auth" });
const processLimiter = createRateLimiter({ windowMs: 60 * 1000, max: 20, keyPrefix: "process" });
const downloadLimiter = createRateLimiter({ windowMs: 60 * 1000, max: 40, keyPrefix: "download" });
const checkoutLimiter = createRateLimiter({ windowMs: 5 * 60 * 1000, max: 15, keyPrefix: "checkout" });
const webhookLimiter = createRateLimiter({ windowMs: 60 * 1000, max: 120, keyPrefix: "webhook" });
const analyticsLimiter = createRateLimiter({ windowMs: 60 * 1000, max: 90, keyPrefix: "meta" });

if (!apiKey) {
    console.warn("Aviso: GEMINI_API_KEY não configurada. As rotas de IA irão falhar.");
}
if (!process.env.MP_ACCESS_TOKEN) {
    console.warn("Aviso: MP_ACCESS_TOKEN não configurado. Checkout premium ficará indisponível.");
}

// Health Check
app.get("/apihealth", (req, res) => {
    res.send("API is running");
});

// Auth Routes
const validate = (req: any, res: any, next: any) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });
    next();
};

function buildContentDisposition(filename: string): string {
    const safeFilename = String(filename || "planilha.xlsx")
        .replace(/[\r\n]/g, " ")
        .trim() || "planilha.xlsx";

    const asciiFallback = toAsciiFilenameFallback(safeFilename);
    const utf8Encoded = encodeURIComponent(safeFilename)
        .replace(/['()]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`)
        .replace(/\*/g, "%2A");

    return `attachment; filename="${asciiFallback}"; filename*=UTF-8''${utf8Encoded}`;
}

function toAsciiFilenameFallback(filename: string): string {
    const extensionMatch = filename.match(/\.(xlsx|csv)$/i);
    const extension = extensionMatch ? `.${extensionMatch[1].toLowerCase()}` : "";
    const baseName = extension ? filename.slice(0, -extension.length) : filename;

    const asciiBase = baseName
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^A-Za-z0-9._ -]/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .replace(/^\.+/, "");

    const fallbackBase = asciiBase.length > 0 ? asciiBase : "planilha";
    const fallback = `${fallbackBase}${extension}`;

    return fallback.slice(0, 120);
}

function resolveHttpErrorStatus(message: string, fallback = 500): number {
    if (message.includes("créditos")) {
        return 402;
    }

    if (message.startsWith("SCHEMA_INVALID:") || message.startsWith("AI_VALIDATION_ERROR:")) {
        return 400;
    }

    return fallback;
}

function toClientSafeErrorMessage(message: string): string {
    return message
        .replace(/^SCHEMA_INVALID:\s*/i, "")
        .replace(/^AI_VALIDATION_ERROR:\s*/i, "")
        .trim();
}

app.post(
    "/api/auth/register",
    authLimiter as any,
    [
        body("email").isEmail().withMessage("E-mail inválido"),
        body("password").isLength({ min: 8 }).withMessage("A senha deve ter pelo menos 8 caracteres"),
        validate
    ],
    (req: any, res: any) => authController.register(req, res)
);

app.post(
    "/api/auth/login",
    authLimiter as any,
    [
        body("email").isEmail().withMessage("E-mail inválido"),
        body("password").notEmpty().withMessage("Senha é obrigatória"),
        validate
    ],
    (req: any, res: any) => authController.login(req, res)
);
app.post("/api/auth/logout", (req, res) => authController.logout(req, res));

// Payment Routes
app.post("/api/checkout/preference", authMiddleware as any, checkoutLimiter as any, (req, res) => paymentController.createPreference(req as AuthRequest, res));
app.post("/api/checkout/webhook", webhookLimiter as any, (req, res) => paymentController.webhook(req, res));

// User Info
app.get("/api/user/me", authMiddleware as any, async (req, res) => {
    const authReq = req as AuthRequest;
    if (!authReq.user) {
        return res.status(401).json({ error: "Token inválido" });
    }

    const account = await creditService.getAccountStatus(authReq.user.sub);
    res.json({
        id: account.id,
        email: account.email,
        isGuest: account.isGuest,
        credits: account.credits,
        plan: account.plan,
        subscriptionEndsAt: account.subscriptionEndsAt,
        isAdmin: isAdminEmail(account.email)
    });
});

app.get("/api/admin/overview", authMiddleware as any, adminMiddleware as any, (req, res) => {
    return adminController.getOverview(req, res);
});

app.get("/api/admin/users", authMiddleware as any, adminMiddleware as any, (req, res) => {
    return adminController.listUsers(req, res);
});

app.post("/api/meta/event", analyticsLimiter as any, (req, res) => {
    const parsed = metaEventRequestSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ error: "Payload de analytics inválido" });
    }

    req.body = parsed.data;
    return metaController.handleEvent(req, res);
});

app.post("/api/process", authMiddleware as any, processLimiter as any, async (req, res) => {
    try {
        const authReq = req as AuthRequest;
        if (!authReq.user) {
            return res.status(401).json({ error: "Token inválido" });
        }

        const account = await creditService.getAccountStatus(authReq.user.sub);
        if (account.isGuest) {
            return res.status(401).json({ error: "Faça login para gerar planilhas." });
        }

        const parsed = processRequestSchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({ error: "Prompt inválido" });
        }

        const { prompt, generationMode } = parsed.data;
        await creditService.consumeCredits(authReq.user.sub, CREDITS_PER_GENERATION);

        const result = await controller.processRequest(prompt, generationMode);
        res.json(result);
    } catch (error: unknown) {
        console.error("Error processing request:", error);
        const message = error instanceof Error ? error.message : "Erro interno";
        const status = resolveHttpErrorStatus(message, 500);
        const errorMessage = status === 500 ? "Erro interno" : toClientSafeErrorMessage(message);
        res.status(status).json({ error: errorMessage || "Erro ao processar solicitação" });
    }
});

app.post("/api/download", authMiddleware as any, downloadLimiter as any, async (req, res) => {
    try {
        const parsed = downloadRequestSchema.safeParse(req.body);
        if (!parsed.success) {
            const firstIssue = parsed.error.issues[0];
            if (!firstIssue) {
                return res.status(400).json({ error: "Payload de download inválido" });
            }

            const issuePath = firstIssue.path.join(".") || "payload";
            return res.status(400).json({
                error: `Payload de download inválido em "${issuePath}": ${firstIssue.message}`
            });
        }

        const { schema, format } = parsed.data;
        const { buffer, filename, mimeType } = await controller.generateFile(schema, format);

        res.setHeader("Content-Type", mimeType);
        res.setHeader("Content-Disposition", buildContentDisposition(filename));
        res.send(buffer);
    } catch (error: unknown) {
        console.error("Error generating file:", error);
        const message = error instanceof Error ? error.message : "Erro interno";
        const status = resolveHttpErrorStatus(message, 500);
        const errorMessage = status === 500 ? "Erro interno" : toClientSafeErrorMessage(message);
        res.status(status).json({ error: errorMessage || "Erro ao gerar arquivo" });
    }
});

// Serve frontend static files
const frontendPath = path.join(__dirname, "../../frontend/dist");
app.use(express.static(frontendPath));

app.get("*", (req, res) => {
    res.sendFile(path.join(frontendPath, "index.html"));
});

app.listen(port, () => {
    console.log(`🚀 Backend (Node.js) rodando em http://localhost:${port}`);
});

