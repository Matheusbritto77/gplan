import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.join(__dirname, "../../.env") });

import express from "express";
import cors from "cors";
import { SpreadsheetController } from "./controllers/SpreadsheetController";
import { MetaController } from "./controllers/MetaController";
import { AuthController } from "./modules/auth/AuthController";
import { PaymentController } from "./modules/payment/PaymentController";
import { authMiddleware, AuthRequest } from "./middlewares/AuthMiddleware";
import { CreditService } from "./modules/credits/CreditService";

const app = express();
const port = process.env.PORT || 80;

app.use(cors());
app.use(express.json({ limit: '50mb' }));

const apiKey = process.env.GEMINI_API_KEY || '';
const controller = new SpreadsheetController(apiKey);
const metaController = new MetaController();
const authController = new AuthController();
const paymentController = new PaymentController();
const creditService = new CreditService();

// Health Check
app.get("/apihealth", (req, res) => {
    res.send("API is running");
});

// Auth Routes
app.post("/api/auth/guest", (req, res) => authController.guest(req, res));
app.post("/api/auth/register", (req, res) => authController.register(req, res));
app.post("/api/auth/login", (req, res) => authController.login(req, res));

// Payment Routes
app.post("/api/checkout/preference", authMiddleware as any, (req, res) => paymentController.createPreference(req as AuthRequest, res));
app.post("/api/checkout/webhook", (req, res) => paymentController.webhook(req, res));

// User Info
app.get("/api/user/me", authMiddleware as any, async (req, res) => {
    const authReq = req as AuthRequest;
    const balance = await creditService.getUserBalance(authReq.user.sub);
    res.json({ ...authReq.user, credits: balance });
});

app.post("/api/meta/event", (req, res) => metaController.handleEvent(req, res));

app.post("/api/process", authMiddleware as any, async (req, res) => {
    try {
        const authReq = req as AuthRequest;
        const { prompt } = req.body;

        if (!prompt) {
            return res.status(400).json({ error: "Prompt is required" });
        }

        // Consumir 1 crédito por geração
        await creditService.consumeCredits(authReq.user.sub, 1);

        const result = await controller.processRequest(prompt);
        res.json(result);
    } catch (error: any) {
        console.error("Error processing request:", error);
        res.status(error.message.includes('créditos') ? 402 : 500).json({ error: error.message });
    }
});

app.post("/api/download", authMiddleware as any, async (req, res) => {
    try {
        const { schema, format } = req.body;
        const { buffer, filename, mimeType } = await controller.generateFile(schema, format);

        res.setHeader('Content-Type', mimeType);
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(buffer);
    } catch (error: any) {
        console.error("Error generating file:", error);
        res.status(500).json({ error: error.message });
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

