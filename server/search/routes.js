import express from "express";
import { config } from "./config.js";
import { runSearchPipeline, SearchInputError } from "./orchestrator.js";
import { setSseHeaders, writeAgentSse, writeSse } from "./sse.js";
import { compactText } from "./text.js";

function sendSearchEvent(res, shape, typeOrPayload, payload = {}) {
  if (shape === "agent") {
    writeAgentSse(res, typeOrPayload, payload);
    return;
  }
  writeSse(res, typeOrPayload);
}

function sendStep(res, shape, message) {
  if (shape === "agent") sendSearchEvent(res, shape, "step", { message });
  else sendSearchEvent(res, shape, { status: message.toLowerCase().replace(/\s+/g, "_") });
}

function sendSources(res, shape, sources, fallback, intent = {}) {
  if (shape === "agent") sendSearchEvent(res, shape, "sources", { cards: sources, fallback, intent });
  else sendSearchEvent(res, shape, { status: "synthesizing", sources, fallback, intent });
}

function sendToken(res, shape, text, provider, extra = {}) {
  if (shape === "agent") sendSearchEvent(res, shape, "token", { text, provider, ...extra });
  else sendSearchEvent(res, shape, { token: text, provider, ...extra });
}

function sendStatus(res, shape, payload) {
  if (shape === "agent") sendSearchEvent(res, shape, "status", payload);
  else sendSearchEvent(res, shape, payload);
}

function sendMeta(res, shape, metadata) {
  if (shape === "agent") sendSearchEvent(res, shape, "meta", metadata);
  else sendSearchEvent(res, shape, { status: "meta", ...metadata });
}

function createSseEvents(res, shape) {
  return {
    onStep: (message) => sendStep(res, shape, message),
    onSources: (sources, fallback, intent) => sendSources(res, shape, sources, fallback, intent),
    onMeta: (metadata) => sendMeta(res, shape, metadata),
    onToken: (text, provider, extra = {}) => sendToken(res, shape, text, provider, extra),
    onStatus: (payload) => {
      if (shape === "agent" && payload.status === "model_stream_start") {
        sendStep(res, shape, `Streaming ${payload.provider || "model"} response...`);
      }
      if (shape === "agent" && payload.status === "provider_fallback") {
        sendStep(res, shape, `Switching from ${payload.provider || "provider"}...`);
      }
      sendStatus(res, shape, payload);
    },
  };
}

async function handleSearchRequest(req, res, shape = "agent") {
  if (!compactText(req.query.q)) {
    return res.status(400).json({ error: "Missing query string parameter 'q'." });
  }

  setSseHeaders(res, config.clientOrigin);

  const abortController = new AbortController();
  req.on("close", () => abortController.abort());

  try {
    await runSearchPipeline({
      rawQuery: req.query.q,
      category: req.query.category || "web",
      signal: abortController.signal,
      events: createSseEvents(res, shape),
      useCache: req.query.cache !== "false",
    });
  } catch (error) {
    console.error("Search processing failed:", error);
    if (shape === "agent") {
      sendSearchEvent(res, shape, "error", {
        message: "Search was interrupted during processing.",
      });
    } else {
      sendSearchEvent(res, shape, {
        error: "Search was interrupted during processing.",
      });
    }
  } finally {
    if (!res.writableEnded) res.end();
  }
}

async function handleAnswerRequest(req, res) {
  const abortController = new AbortController();
  req.on("close", () => abortController.abort());

  try {
    const result = await runSearchPipeline({
      rawQuery: req.query.q,
      category: req.query.category || "web",
      signal: abortController.signal,
      useCache: req.query.cache !== "false",
    });

    res.json(result);
  } catch (error) {
    if (error instanceof SearchInputError) {
      return res.status(error.statusCode).json({ error: error.message });
    }

    console.error("Search answer request failed:", error);
    res.status(500).json({ error: "Search was interrupted during processing." });
  }
}

export function createSearchRouter() {
  const router = express.Router();
  router.get("/agent", (req, res) => handleSearchRequest(req, res, "agent"));
  router.get("/stream", (req, res) => handleSearchRequest(req, res, "stream"));
  router.get("/answer", handleAnswerRequest);
  return router;
}
