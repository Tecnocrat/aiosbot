import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import { emptyPluginConfigSchema } from "openclaw/plugin-sdk";

import { webhookChannelPlugin } from "./src/channel.js";
import { setWebhookRuntime, type WebhookPluginRuntime } from "./src/runtime.js";

/**
 * @aiosbot/webhook-channel
 *
 * A generic HTTP webhook channel for integrating custom messaging platforms.
 *
 * Features:
 * - Receives messages via HTTP POST to configurable webhook path
 * - Sends replies via HTTP POST to configurable callback URL
 * - Supports DMs and groups
 * - Full media support (images, audio, video, documents)
 * - Configurable authentication (bearer token)
 * - Allowlist-based security
 *
 * Configuration example (in ~/.openclaw/openclaw.json):
 * ```json5
 * {
 *   channels: {
 *     webhook: {
 *       webhookPath: "/webhook/incoming",
 *       callbackUrl: "https://your-service.com/api/messages",
 *       callbackHeaders: {
 *         "Authorization": "Bearer your-token",
 *         "X-Custom-Header": "value"
 *       },
 *       authToken: "your-incoming-auth-token",
 *       dmPolicy: "allowlist",
 *       allowFrom: ["user-123", "user-456"]
 *     }
 *   }
 * }
 * ```
 */
const plugin = {
  id: "webhook",
  name: "Webhook Channel",
  description: "Generic HTTP webhook channel for custom messaging integrations",
  configSchema: emptyPluginConfigSchema(),
  register(api: OpenClawPluginApi) {
    const runtime: WebhookPluginRuntime = {
      config: api.config,
      logger: api.logger,
      resolvePath: api.resolvePath,
    };
    setWebhookRuntime(runtime);
    api.registerChannel({ plugin: webhookChannelPlugin });
  },
};

export default plugin;
