import type { OpenClawConfig } from "openclaw/plugin-sdk";

/**
 * Runtime context for the webhook channel plugin.
 * Set during plugin registration and accessed by channel adapters.
 */
export type WebhookPluginRuntime = {
  config: OpenClawConfig;
  logger: {
    info: (message: string) => void;
    warn: (message: string) => void;
    error: (message: string) => void;
    debug?: (message: string) => void;
  };
  resolvePath: (input: string) => string;
};

let webhookRuntime: WebhookPluginRuntime | null = null;

export function setWebhookRuntime(runtime: WebhookPluginRuntime): void {
  webhookRuntime = runtime;
}

export function getWebhookRuntime(): WebhookPluginRuntime {
  if (!webhookRuntime) {
    throw new Error("Webhook runtime not initialized. Plugin not registered?");
  }
  return webhookRuntime;
}

export function hasWebhookRuntime(): boolean {
  return webhookRuntime !== null;
}
