import type { IncomingMessage, ServerResponse } from "node:http";
import type { OpenClawConfig } from "openclaw/plugin-sdk";
import { registerPluginHttpRoute } from "openclaw/plugin-sdk";

import type { WebhookIncomingMessage, WebhookAccountConfig } from "./types.js";
import { getWebhookRuntime } from "./runtime.js";

/**
 * HTTP handler for incoming webhook messages.
 *
 * Expected request format:
 * - Method: POST
 * - Content-Type: application/json
 * - Authorization: Bearer <authToken> (if configured)
 *
 * Request body: WebhookIncomingMessage
 *
 * Response:
 * - 200: Message accepted
 * - 400: Invalid request
 * - 401: Unauthorized
 * - 500: Internal error
 */

type IncomingWebhookHandlerDeps = {
  cfg: OpenClawConfig;
  accountId: string;
  onMessage: (message: WebhookIncomingMessage, accountId: string) => Promise<void>;
  log?: (message: string) => void;
};

function getWebhookConfig(cfg: OpenClawConfig): Record<string, unknown> | undefined {
  return (cfg.channels as Record<string, unknown> | undefined)?.webhook as
    | Record<string, unknown>
    | undefined;
}

function getAccountConfig(
  cfg: OpenClawConfig,
  accountId: string
): WebhookAccountConfig {
  const webhookCfg = getWebhookConfig(cfg);
  if (!webhookCfg) return {};

  // Check for account-specific config
  const accounts = webhookCfg.accounts as
    | Record<string, WebhookAccountConfig>
    | undefined;
  if (accounts?.[accountId]) {
    return accounts[accountId];
  }

  // Fall back to top-level for default account
  if (accountId === "default") {
    return webhookCfg as WebhookAccountConfig;
  }

  return {};
}

function parseRequestBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => {
      try {
        const body = Buffer.concat(chunks).toString("utf8");
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        reject(err);
      }
    });
    req.on("error", reject);
  });
}

function validateIncomingMessage(body: unknown): body is WebhookIncomingMessage {
  if (!body || typeof body !== "object") return false;
  const msg = body as Record<string, unknown>;

  // Required: messageId and senderId
  if (typeof msg.messageId !== "string" || !msg.messageId.trim()) return false;
  if (typeof msg.senderId !== "string" || !msg.senderId.trim()) return false;

  // Optional fields type checks
  if (msg.text !== undefined && typeof msg.text !== "string") return false;
  if (msg.chatId !== undefined && typeof msg.chatId !== "string") return false;
  if (msg.isGroup !== undefined && typeof msg.isGroup !== "boolean") return false;

  return true;
}

function sendJsonResponse(
  res: ServerResponse,
  statusCode: number,
  body: Record<string, unknown>
): void {
  res.writeHead(statusCode, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

export function createIncomingWebhookHandler(deps: IncomingWebhookHandlerDeps) {
  const { cfg, accountId, onMessage, log } = deps;

  return async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    // Only accept POST
    if (req.method !== "POST") {
      sendJsonResponse(res, 405, {
        success: false,
        error: "Method not allowed. Use POST.",
      });
      return;
    }

    // Check authorization
    const accountConfig = getAccountConfig(cfg, accountId);
    const expectedToken = accountConfig.authToken;

    if (expectedToken) {
      const authHeader = req.headers.authorization;
      const providedToken = authHeader?.startsWith("Bearer ")
        ? authHeader.slice(7).trim()
        : null;

      if (providedToken !== expectedToken) {
        log?.(`Webhook auth failed for account ${accountId}`);
        sendJsonResponse(res, 401, {
          success: false,
          error: "Unauthorized",
        });
        return;
      }
    }

    // Parse request body
    let body: unknown;
    try {
      body = await parseRequestBody(req);
    } catch (err) {
      log?.(`Webhook parse error: ${err}`);
      sendJsonResponse(res, 400, {
        success: false,
        error: "Invalid JSON body",
      });
      return;
    }

    // Validate message format
    if (!validateIncomingMessage(body)) {
      sendJsonResponse(res, 400, {
        success: false,
        error: "Invalid message format. Required: messageId, senderId",
      });
      return;
    }

    // Process the message
    try {
      await onMessage(body, accountId);
      sendJsonResponse(res, 200, {
        success: true,
        messageId: body.messageId,
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      log?.(`Webhook processing error: ${errorMessage}`);
      sendJsonResponse(res, 500, {
        success: false,
        error: "Internal error processing message",
      });
    }
  };
}

/**
 * Register the webhook HTTP route with the plugin system.
 */
export function registerWebhookHttpRoute(params: {
  webhookPath: string;
  accountId: string;
  cfg: OpenClawConfig;
  onMessage: (message: WebhookIncomingMessage, accountId: string) => Promise<void>;
}): () => void {
  const { webhookPath, accountId, cfg, onMessage } = params;
  const runtime = getWebhookRuntime();

  const handler = createIncomingWebhookHandler({
    cfg,
    accountId,
    onMessage,
    log: runtime.logger.info.bind(runtime.logger),
  });

  return registerPluginHttpRoute({
    path: webhookPath,
    handler,
    pluginId: "webhook",
    source: "webhook-channel",
    accountId,
    log: runtime.logger.info.bind(runtime.logger),
  });
}
