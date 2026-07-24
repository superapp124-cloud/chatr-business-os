import express from "express";
import { config } from "./server/search/config.js";
import { createSearchRouter } from "./server/search/routes.js";
import { createConversationRouter } from "./server/conversation/routes.js";
import { startWorker } from "./server/jobs/worker.js";

const app = express();

app.use(express.json({ limit: "1mb" }));
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", config.clientOrigin);
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});
app.use("/api/search", createSearchRouter());
app.use("/api/v1/conversation", createConversationRouter());

app.get("/api/search/health", (_req, res) => {
  res.json({
    ok: true,
    currentDate: config.currentDate,
    freeOnly: config.freeOnly,
    allowApiModels: config.allowApiModels,
    searchProvider: config.searchProvider,
    searxng: config.searxngUrl ? "configured" : "off",
    braveFallback: config.braveFallbackEnabled,
    localModel: config.ollamaEnabled ? `ollama:${config.ollamaModel}` : "extractive-only",
  });
});

app.listen(config.port, () => {
  console.log(`Chatr AI pipeline active on port ${config.port}`);
  
  // Start the background job processor
  startWorker();
});
