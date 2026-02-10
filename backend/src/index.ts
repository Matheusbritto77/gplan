import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { SpreadsheetController } from "./controllers/SpreadsheetController";

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '50mb' }));

const apiKey = process.env.GEMINI_API_KEY || '';
const controller = new SpreadsheetController(apiKey);

// API Routes prefixadas com /api
app.get("/apihealth", (req, res) => {
    res.send("API is running");
});

app.post("/api/process", async (req, res) => {
    try {
        const { prompt } = req.body;
        if (!prompt) {
            return res.status(400).json({ error: "Prompt is required" });
        }
        const result = await controller.processRequest(prompt);
        res.json(result);
    } catch (error: any) {
        console.error("Error processing request:", error);
        res.status(500).json({ error: error.message });
    }
});

app.post("/api/download", async (req, res) => {
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

// Fallback para o frontend handle routing (SPA)
app.get("*", (req, res) => {
    res.sendFile(path.join(frontendPath, "index.html"));
});

app.listen(port, () => {
    console.log(`🚀 Backend (Node.js) rodando em http://localhost:${port}`);
});
