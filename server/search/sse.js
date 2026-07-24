export function setSseHeaders(res, origin = "*") {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.flushHeaders?.();
}

export function writeSse(res, payload) {
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

export function writeAgentSse(res, type, payload = {}) {
  writeSse(res, { type, ...payload });
}
