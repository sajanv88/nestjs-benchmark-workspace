import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { RunConfig } from "@repo/types";
import * as v from "valibot";
import { env } from "./env.js";
import { createRunManager } from "./run-manager.js";

const MAX_BODY_BYTES = 4096;
const HEARTBEAT_MS = 15_000;
const RECONNECT_MS = 2_000;

const manager = createRunManager(env.RESULTS_PATH);
const allowedHosts = new Set([`127.0.0.1:${env.PORT}`, `localhost:${env.PORT}`]);
const allowedOrigins = new Set(env.ALLOWED_ORIGINS);

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
}

type Body = { ok: true; value: unknown } | { ok: false; status: number; error: string };

async function readJsonBody(req: IncomingMessage): Promise<Body> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const buffer = Buffer.from(chunk as Uint8Array);
    size += buffer.length;
    if (size > MAX_BODY_BYTES) return { ok: false, status: 413, error: "body too large" };
    chunks.push(buffer);
  }
  if (size === 0) return { ok: true, value: {} };
  try {
    return { ok: true, value: JSON.parse(Buffer.concat(chunks).toString("utf8")) };
  } catch {
    return { ok: false, status: 400, error: "body is not valid JSON" };
  }
}

async function postRun(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const body = await readJsonBody(req);
  if (!body.ok) {
    sendJson(res, body.status, { error: body.error });
    return;
  }
  const config = v.safeParse(RunConfig, body.value);
  if (!config.success) {
    const issues = v.flatten(config.issues);
    sendJson(res, 400, { error: "invalid config", issues: issues.nested ?? issues.root });
    return;
  }
  if (!manager.start(config.output)) {
    sendJson(res, 409, { error: "a run is already active" });
    return;
  }
  sendJson(res, 202, { config: config.output });
}

function postStop(res: ServerResponse): void {
  if (manager.stop()) sendJson(res, 202, { stopping: true });
  else sendJson(res, 409, { error: "no run is active" });
}

function lastEventIdOf(req: IncomingMessage): number | null {
  const id = Number(req.headers["last-event-id"]);
  return Number.isInteger(id) && id >= 0 && req.headers["last-event-id"] ? id : null;
}

function getEvents(req: IncomingMessage, res: ServerResponse): void {
  res.writeHead(200, {
    "content-type": "text/event-stream",
    "cache-control": "no-cache, no-transform",
    connection: "keep-alive",
  });
  res.write(`retry: ${RECONNECT_MS}\n\n`);

  const unsubscribe = manager.subscribe(lastEventIdOf(req), ({ id, event }) => {
    res.write(`id: ${id}\nevent: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
  });
  const heartbeat = setInterval(() => res.write(": ping\n\n"), HEARTBEAT_MS);

  req.on("close", () => {
    clearInterval(heartbeat);
    unsubscribe();
  });
}

// Loopback isn't a boundary against the browser: any site the user visits can send requests
// to it. The Origin check stops cross-site runs and the Host check stops DNS rebinding.
function refuse(req: IncomingMessage, res: ServerResponse): boolean {
  const { host, origin } = req.headers;
  if (!host || !allowedHosts.has(host)) {
    sendJson(res, 403, { error: "host not allowed" });
    return true;
  }
  if (origin && !allowedOrigins.has(origin)) {
    sendJson(res, 403, { error: "origin not allowed" });
    return true;
  }
  if (origin) {
    res.setHeader("access-control-allow-origin", origin);
    res.setHeader("vary", "Origin");
  }
  return false;
}

async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (refuse(req, res)) return;

  const { pathname } = new URL(req.url ?? "/", "http://runner");
  switch (`${req.method} ${pathname}`) {
    case "POST /run":
      return postRun(req, res);
    case "POST /stop":
      return postStop(res);
    case "GET /events":
      return getEvents(req, res);
    case "GET /health":
      return sendJson(res, 200, { status: "ok", running: manager.isRunning() });
    case "OPTIONS /run":
    case "OPTIONS /stop":
      res.writeHead(204, {
        "access-control-allow-methods": "POST",
        "access-control-allow-headers": "content-type",
      });
      res.end();
      return;
    default:
      return sendJson(res, 404, { error: "not found" });
  }
}

const server = createServer((req, res) => {
  handle(req, res).catch((error: unknown) => {
    console.error("request failed:", error);
    if (!res.headersSent) sendJson(res, 500, { error: "internal error" });
    else res.end();
  });
});

// Node is PID 1 in the container, where a signal without a handler does nothing.
function shutdown(): void {
  manager.stop();
  server.close();
  // Open event streams would otherwise hold the server open forever.
  server.closeAllConnections();
}
process.once("SIGTERM", shutdown);
process.once("SIGINT", shutdown);

server.listen(env.PORT, env.HOST, () => {
  process.stdout.write(`runner: listening on ${env.HOST}:${env.PORT}\n`);
});
