import type {
  ChannelAccountSnapshot,
  ChannelPlugin,
  ChannelSecurityDmPolicy,
  ChannelGroupContext,
  ChannelSetupInput,
  ChannelOutboundContext,
  OpenClawConfig,
} from "openclaw/plugin-sdk";
import { DEFAULT_ACCOUNT_ID, normalizeAccountId } from "openclaw/plugin-sdk";

import type {
  ResolvedWebhookAccount,
  WebhookAccountConfig,
  WebhookAccountRuntime,
} from "./types.js";
import { getWebhookRuntime } from "./runtime.js";

// ============================================================================
// Account runtime state (in-memory)
// ============================================================================

const accountRuntimes = new Map<string, WebhookAccountRuntime>();

function getOrCreateRuntime(accountId: string): WebhookAccountRuntime {
  let runtime = accountRuntimes.get(accountId);
  if (!runtime) {
    runtime = {
      accountId,
      running: false,
      connected: false,
      messageCount: 0,
    };
    accountRuntimes.set(accountId, runtime);
  }
  return runtime;
}

// ============================================================================
// Config resolution helpers
// ============================================================================

function getWebhookConfig(cfg: OpenClawConfig): Record<string, unknown> | undefined {
  return (cfg.channels as Record<string, unknown> | undefined)?.webhook as
    | Record<string, unknown>
    | undefined;
}

function listWebhookAccountIds(cfg: OpenClawConfig): string[] {
  const webhookCfg = getWebhookConfig(cfg);
  if (!webhookCfg) return [];

  const accounts = webhookCfg.accounts as Record<string, unknown> | undefined;
  const accountIds = accounts ? Object.keys(accounts) : [];

  // Check if there's top-level config (default account)
  const hasTopLevel =
    webhookCfg.webhookPath || webhookCfg.callbackUrl || webhookCfg.authToken;
  if (hasTopLevel && !accountIds.includes(DEFAULT_ACCOUNT_ID)) {
    accountIds.unshift(DEFAULT_ACCOUNT_ID);
  }

  return accountIds;
}

function resolveWebhookAccount(params: {
  cfg: OpenClawConfig;
  accountId?: string | null;
}): ResolvedWebhookAccount {
  const { cfg, accountId } = params;
  const normalizedId = normalizeAccountId(accountId);
  const webhookCfg = getWebhookConfig(cfg);

  // Start with defaults
  const accountConfig: WebhookAccountConfig = {
    enabled: true,
    dmPolicy: "pairing",
    allowFrom: [],
  };

  if (webhookCfg) {
    // Check for account-specific config first
    const accounts = webhookCfg.accounts as
      | Record<string, WebhookAccountConfig>
      | undefined;
    const accountSpecific = accounts?.[normalizedId];

    if (accountSpecific) {
      Object.assign(accountConfig, accountSpecific);
    } else if (normalizedId === DEFAULT_ACCOUNT_ID) {
      // Fall back to top-level config for default account
      Object.assign(accountConfig, {
        enabled: webhookCfg.enabled ?? true,
        name: webhookCfg.name,
        webhookPath: webhookCfg.webhookPath,
        callbackUrl: webhookCfg.callbackUrl,
        callbackHeaders: webhookCfg.callbackHeaders,
        authToken: webhookCfg.authToken,
        dmPolicy: webhookCfg.dmPolicy ?? "pairing",
        allowFrom: webhookCfg.allowFrom,
        groups: webhookCfg.groups,
        groupPolicy: webhookCfg.groupPolicy,
      });
    }
  }

  return {
    accountId: normalizedId,
    name: accountConfig.name,
    enabled: accountConfig.enabled ?? true,
    config: accountConfig,
    webhookPath: accountConfig.webhookPath,
    callbackUrl: accountConfig.callbackUrl,
    hasAuthToken: Boolean(accountConfig.authToken?.trim()),
  };
}

// ============================================================================
// Channel Plugin Definition
// ============================================================================

export const webhookChannelPlugin: ChannelPlugin<ResolvedWebhookAccount> = {
  id: "webhook",

  meta: {
    id: "webhook",
    label: "Webhook Channel",
    selectionLabel: "Custom HTTP Webhook",
    docsPath: "/channels/webhook",
    docsLabel: "webhook",
    blurb: "Generic HTTP webhook channel for custom messaging platforms",
    order: 100,
    aliases: ["http", "custom"],
    quickstartAllowFrom: true,
  },

  capabilities: {
    chatTypes: ["direct", "group"],
    reactions: false,
    threads: true,
    media: true,
    nativeCommands: false,
    blockStreaming: true,
  },

  reload: {
    configPrefixes: ["channels.webhook"],
  },

  // -------------------------------------------------------------------------
  // Config Adapter
  // -------------------------------------------------------------------------
  config: {
    listAccountIds: (cfg: OpenClawConfig) => listWebhookAccountIds(cfg),

    resolveAccount: (cfg: OpenClawConfig, accountId?: string | null) =>
      resolveWebhookAccount({ cfg, accountId }),

    defaultAccountId: () => DEFAULT_ACCOUNT_ID,

    isEnabled: (account: ResolvedWebhookAccount) => account.enabled,

    isConfigured: (account: ResolvedWebhookAccount) =>
      Boolean(account.webhookPath?.trim()) && Boolean(account.callbackUrl?.trim()),

    unconfiguredReason: (account: ResolvedWebhookAccount) => {
      if (!account.webhookPath?.trim()) return "webhookPath not set";
      if (!account.callbackUrl?.trim()) return "callbackUrl not set";
      return "unknown";
    },

    describeAccount: (account: ResolvedWebhookAccount): ChannelAccountSnapshot => ({
      accountId: account.accountId,
      name: account.name,
      enabled: account.enabled,
      configured:
        Boolean(account.webhookPath?.trim()) && Boolean(account.callbackUrl?.trim()),
      webhookPath: account.webhookPath,
    }),

    resolveAllowFrom: (params: { cfg: OpenClawConfig; accountId?: string | null }) =>
      resolveWebhookAccount({ cfg: params.cfg, accountId: params.accountId }).config.allowFrom ?? [],

    formatAllowFrom: (params: { allowFrom: Array<string | number> }) =>
      params.allowFrom
        .map((entry: string | number) => String(entry).trim().toLowerCase())
        .filter(Boolean),
  },

  // -------------------------------------------------------------------------
  // Security Adapter
  // -------------------------------------------------------------------------
  security: {
    resolveDmPolicy: (params: {
      cfg: OpenClawConfig;
      accountId?: string | null;
      account: ResolvedWebhookAccount;
    }): ChannelSecurityDmPolicy => {
      const { cfg, accountId, account } = params;
      const resolvedAccountId = accountId ?? account.accountId ?? DEFAULT_ACCOUNT_ID;
      const webhookCfg = getWebhookConfig(cfg);
      const hasAccountConfig = Boolean(
        (webhookCfg?.accounts as Record<string, unknown> | undefined)?.[resolvedAccountId]
      );

      const basePath = hasAccountConfig
        ? `channels.webhook.accounts.${resolvedAccountId}.`
        : "channels.webhook.";

      return {
        policy: account.config.dmPolicy ?? "pairing",
        allowFrom: account.config.allowFrom ?? [],
        policyPath: `${basePath}dmPolicy`,
        allowFromPath: `${basePath}allowFrom`,
        approveHint: `openclaw pairing approve webhook <code>`,
        normalizeEntry: (raw: string) => raw.trim().toLowerCase(),
      };
    },

    collectWarnings: (params: { account: ResolvedWebhookAccount }) => {
      const { account } = params;
      const warnings: string[] = [];
      const policy = account.config.dmPolicy ?? "pairing";

      if (policy === "open") {
        const hasAllowlist =
          account.config.allowFrom && account.config.allowFrom.length > 0;
        if (!hasAllowlist) {
          warnings.push(
            `- Webhook channel: dmPolicy="open" with no allowFrom; anyone can send messages. Consider setting dmPolicy="allowlist" or "pairing".`
          );
        }
      }

      if (!account.hasAuthToken) {
        warnings.push(
          `- Webhook channel: no authToken configured; incoming webhooks are not authenticated. Consider setting channels.webhook.authToken.`
        );
      }

      return warnings;
    },
  },

  // -------------------------------------------------------------------------
  // Pairing Adapter
  // -------------------------------------------------------------------------
  pairing: {
    idLabel: "senderId",
    normalizeAllowEntry: (entry: string) => entry.trim().toLowerCase(),
    notifyApproval: async (params: { id: string }) => {
      const runtime = getWebhookRuntime();
      runtime.logger.info(`Webhook pairing approved for sender: ${params.id}`);
      // Note: For production, you'd POST a notification to the callback URL
    },
  },

  // -------------------------------------------------------------------------
  // Groups Adapter
  // -------------------------------------------------------------------------
  groups: {
    resolveRequireMention: (params: ChannelGroupContext) => {
      const { cfg, groupId } = params;
      if (!groupId) return undefined;
      const webhookCfg = getWebhookConfig(cfg);
      const groups = webhookCfg?.groups as
        | Record<string, { requireMention?: boolean }>
        | undefined;
      return groups?.[groupId]?.requireMention;
    },
  },

  // -------------------------------------------------------------------------
  // Messaging Adapter
  // -------------------------------------------------------------------------
  messaging: {
    normalizeTarget: (target: string | undefined) => target?.trim() ?? "",
    targetResolver: {
      looksLikeId: (target: string | undefined) => Boolean(target?.trim()),
      hint: "<senderId or chatId>",
    },
  },

  // -------------------------------------------------------------------------
  // Setup Adapter
  // -------------------------------------------------------------------------
  setup: {
    resolveAccountId: (params: { accountId?: string }) =>
      normalizeAccountId(params.accountId),

    applyAccountConfig: (params: {
      cfg: OpenClawConfig;
      accountId: string;
      input: ChannelSetupInput;
    }) => {
      const { cfg, accountId, input } = params;
      const normalizedId = normalizeAccountId(accountId);
      const updated = { ...cfg };

      // Ensure channels.webhook exists
      if (!updated.channels) {
        updated.channels = {};
      }
      const channels = updated.channels as Record<string, unknown>;
      if (!channels.webhook) {
        channels.webhook = {};
      }
      const webhookCfg = channels.webhook as Record<string, unknown>;

      if (normalizedId === DEFAULT_ACCOUNT_ID) {
        // Apply to top-level
        if (input.webhookPath) webhookCfg.webhookPath = input.webhookPath;
        if (input.webhookUrl) webhookCfg.callbackUrl = input.webhookUrl;
        if (input.name) webhookCfg.name = input.name;
      } else {
        // Apply to account-specific config
        if (!webhookCfg.accounts) {
          webhookCfg.accounts = {};
        }
        const accounts = webhookCfg.accounts as Record<string, WebhookAccountConfig>;
        if (!accounts[normalizedId]) {
          accounts[normalizedId] = {};
        }
        const accountCfg = accounts[normalizedId];
        if (input.webhookPath) accountCfg.webhookPath = input.webhookPath;
        if (input.webhookUrl) accountCfg.callbackUrl = input.webhookUrl;
        if (input.name) accountCfg.name = input.name;
      }

      return updated;
    },

    validateInput: (params: { input: ChannelSetupInput }) => {
      const { input } = params;
      if (!input.webhookPath && !input.webhookUrl) {
        return "Webhook channel requires webhookPath and callbackUrl (webhookUrl).";
      }
      return null;
    },
  },

  // -------------------------------------------------------------------------
  // Status Adapter
  // -------------------------------------------------------------------------
  status: {
    defaultRuntime: {
      accountId: DEFAULT_ACCOUNT_ID,
      running: false,
      connected: false,
    },

    buildAccountSnapshot: (params: {
      account: ResolvedWebhookAccount;
    }): ChannelAccountSnapshot => {
      const { account } = params;
      const runtime = getOrCreateRuntime(account.accountId);
      return {
        accountId: account.accountId,
        name: account.name,
        enabled: account.enabled,
        configured:
          Boolean(account.webhookPath?.trim()) && Boolean(account.callbackUrl?.trim()),
        running: runtime.running,
        connected: runtime.connected,
        lastMessageAt: runtime.lastMessageAt,
        lastInboundAt: runtime.lastInboundAt,
        lastOutboundAt: runtime.lastOutboundAt,
        lastError: runtime.lastError,
        webhookPath: account.webhookPath,
        dmPolicy: account.config.dmPolicy,
        allowFrom: account.config.allowFrom,
      };
    },

    collectStatusIssues: (accounts: ChannelAccountSnapshot[]) => {
      const issues: Array<{
        channel: string;
        accountId: string;
        kind: "intent" | "permissions" | "config" | "auth" | "runtime";
        message: string;
        fix?: string;
      }> = [];

      for (const account of accounts) {
        if (!account.configured) {
          issues.push({
            channel: "webhook",
            accountId: account.accountId,
            kind: "config",
            message: "Webhook channel not configured (missing webhookPath or callbackUrl)",
            fix: "Set channels.webhook.webhookPath and channels.webhook.callbackUrl",
          });
        }
      }

      return issues;
    },
  },

  // -------------------------------------------------------------------------
  // Outbound Adapter
  // -------------------------------------------------------------------------
  outbound: {
    deliveryMode: "direct",
    textChunkLimit: 4096,

    resolveTarget: (params: { to?: string }) => {
      const { to } = params;
      if (!to?.trim()) {
        return { ok: false, error: new Error("Missing target (to)") };
      }
      return { ok: true, to: to.trim() };
    },

    sendText: async (ctx: ChannelOutboundContext) => {
      const { cfg, to, text, replyToId, threadId, accountId } = ctx;
      const account = resolveWebhookAccount({ cfg, accountId });

      if (!account.callbackUrl) {
        return {
          ok: false,
          error: "Callback URL not configured",
        };
      }

      const messageId = `webhook-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      const payload = {
        messageId,
        to,
        text,
        replyToId,
        threadId,
        timestamp: new Date().toISOString(),
      };

      try {
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
          ...account.config.callbackHeaders,
        };

        const response = await fetch(account.callbackUrl, {
          method: "POST",
          headers,
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          const errorText = await response.text().catch(() => "Unknown error");
          return {
            ok: false,
            error: `Callback failed: ${response.status} ${errorText}`,
          };
        }

        // Update runtime state
        const runtime = getOrCreateRuntime(account.accountId);
        runtime.lastOutboundAt = Date.now();
        runtime.messageCount += 1;

        return { ok: true, messageId };
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        return {
          ok: false,
          error: `Callback error: ${errorMessage}`,
        };
      }
    },

    sendMedia: async (ctx: ChannelOutboundContext) => {
      const { cfg, to, text, mediaUrl, replyToId, threadId, accountId } = ctx;
      const account = resolveWebhookAccount({ cfg, accountId });

      if (!account.callbackUrl) {
        return {
          ok: false,
          error: "Callback URL not configured",
        };
      }

      const messageId = `webhook-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      const payload = {
        messageId,
        to,
        text,
        mediaUrl,
        replyToId,
        threadId,
        timestamp: new Date().toISOString(),
      };

      try {
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
          ...account.config.callbackHeaders,
        };

        const response = await fetch(account.callbackUrl, {
          method: "POST",
          headers,
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          const errorText = await response.text().catch(() => "Unknown error");
          return {
            ok: false,
            error: `Callback failed: ${response.status} ${errorText}`,
          };
        }

        // Update runtime state
        const runtime = getOrCreateRuntime(account.accountId);
        runtime.lastOutboundAt = Date.now();
        runtime.messageCount += 1;

        return { ok: true, messageId };
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        return {
          ok: false,
          error: `Callback error: ${errorMessage}`,
        };
      }
    },
  },

  // -------------------------------------------------------------------------
  // Threading Adapter
  // -------------------------------------------------------------------------
  threading: {
    resolveReplyToMode: () => "first",
  },
};
