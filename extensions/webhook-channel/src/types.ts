/**
 * Type definitions for the webhook channel plugin.
 */

/**
 * Configuration for a webhook channel account.
 */
export type WebhookAccountConfig = {
  /** Whether this account is enabled */
  enabled?: boolean;
  /** Display name for this account */
  name?: string;
  /** Incoming webhook path (e.g., /webhook/incoming) */
  webhookPath?: string;
  /** URL to POST replies to */
  callbackUrl?: string;
  /** Headers to include in callback requests */
  callbackHeaders?: Record<string, string>;
  /** Bearer token for authenticating incoming webhooks */
  authToken?: string;
  /** DM policy: open, pairing, or allowlist */
  dmPolicy?: "open" | "pairing" | "allowlist";
  /** Allowlist of sender IDs */
  allowFrom?: string[];
  /** Groups configuration */
  groups?: Record<string, WebhookGroupConfig>;
  /** Group policy */
  groupPolicy?: "open" | "allowlist";
};

/**
 * Configuration for a webhook group.
 */
export type WebhookGroupConfig = {
  /** Whether mentions are required in this group */
  requireMention?: boolean;
  /** Custom name for this group */
  name?: string;
};

/**
 * Resolved webhook account (config + runtime state).
 */
export type ResolvedWebhookAccount = {
  accountId: string;
  name?: string;
  enabled: boolean;
  config: WebhookAccountConfig;
  webhookPath?: string;
  callbackUrl?: string;
  hasAuthToken: boolean;
};

/**
 * Incoming webhook message payload.
 * This is the expected format for messages POSTed to the webhook endpoint.
 */
export type WebhookIncomingMessage = {
  /** Unique message ID */
  messageId: string;
  /** Sender identifier */
  senderId: string;
  /** Sender display name (optional) */
  senderName?: string;
  /** Message text content */
  text?: string;
  /** Chat/conversation ID (for groups) */
  chatId?: string;
  /** Whether this is a group message */
  isGroup?: boolean;
  /** Group name (if group message) */
  groupName?: string;
  /** Timestamp (ISO 8601 or Unix ms) */
  timestamp?: string | number;
  /** Reply-to message ID (for threaded replies) */
  replyToId?: string;
  /** Thread ID (for threaded conversations) */
  threadId?: string;
  /** Media attachments */
  media?: WebhookMediaAttachment[];
  /** Custom metadata */
  metadata?: Record<string, unknown>;
};

/**
 * Media attachment in an incoming message.
 */
export type WebhookMediaAttachment = {
  /** Media type: image, audio, video, document */
  type: "image" | "audio" | "video" | "document";
  /** URL to fetch the media from */
  url: string;
  /** MIME type */
  mimeType?: string;
  /** Filename */
  filename?: string;
  /** File size in bytes */
  size?: number;
  /** Caption for this media */
  caption?: string;
};

/**
 * Outgoing webhook message payload.
 * This is the format sent to the callback URL.
 */
export type WebhookOutgoingMessage = {
  /** Message ID (generated) */
  messageId: string;
  /** Target chat/user ID */
  to: string;
  /** Message text content */
  text?: string;
  /** Media URL (if sending media) */
  mediaUrl?: string;
  /** Media type */
  mediaType?: "image" | "audio" | "video" | "document";
  /** Reply-to message ID */
  replyToId?: string;
  /** Thread ID */
  threadId?: string;
  /** Timestamp (ISO 8601) */
  timestamp: string;
  /** Custom metadata */
  metadata?: Record<string, unknown>;
};

/**
 * Response from the callback URL after sending a message.
 */
export type WebhookCallbackResponse = {
  /** Whether the message was accepted */
  success: boolean;
  /** Assigned message ID from the external system */
  messageId?: string;
  /** Error message if not successful */
  error?: string;
  /** Additional response data */
  data?: Record<string, unknown>;
};

/**
 * Runtime state for a webhook account.
 */
export type WebhookAccountRuntime = {
  accountId: string;
  running: boolean;
  connected: boolean;
  lastMessageAt?: number;
  lastInboundAt?: number;
  lastOutboundAt?: number;
  lastError?: string;
  messageCount: number;
};
