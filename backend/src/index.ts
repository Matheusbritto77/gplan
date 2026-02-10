import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { SpreadsheetController } from "./controllers/SpreadsheetController";

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '50mb' }));

const apiKey = process.env.GEMINI_API_KEY || '';
const controller = new SpreadsheetController(apiKey);

app.get("/", (req, res) => {
    res.send("Spreadsheet-as-a-Service API (Node.js) is running");
});

app.post("/process", async (req, res) => {
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

app.post("/download", async (req, res) => {
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

app.listen(port, () => {
    console.log(`🚀 Backend (Node.js) rodando em http://localhost:${port}`);
});
