/**
 * Test script for webhook-channel plugin
 * Validates structure and types without requiring full OpenClaw runtime
 */

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const PLUGIN_DIR = "./extensions/webhook-channel";

type TestResult = { name: string; passed: boolean; error?: string };
const results: TestResult[] = [];

function test(name: string, fn: () => void) {
  try {
    fn();
    results.push({ name, passed: true });
    console.log(`✅ ${name}`);
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    results.push({ name, passed: false, error });
    console.log(`❌ ${name}: ${error}`);
  }
}

function assertExists(path: string) {
  if (!existsSync(path)) {
    throw new Error(`File not found: ${path}`);
  }
}

function assertJsonField(obj: unknown, field: string, expected?: unknown) {
  const value = (obj as Record<string, unknown>)?.[field];
  if (value === undefined) {
    throw new Error(`Missing field: ${field}`);
  }
  if (expected !== undefined && value !== expected) {
    throw new Error(`Expected ${field}="${expected}", got "${value}"`);
  }
}

console.log("\n🧪 Testing webhook-channel plugin structure\n");

// Test 1: Required files exist
test("package.json exists", () => {
  assertExists(join(PLUGIN_DIR, "package.json"));
});

test("openclaw.plugin.json exists", () => {
  assertExists(join(PLUGIN_DIR, "openclaw.plugin.json"));
});

test("index.ts exists", () => {
  assertExists(join(PLUGIN_DIR, "index.ts"));
});

test("src/channel.ts exists", () => {
  assertExists(join(PLUGIN_DIR, "src/channel.ts"));
});

test("src/types.ts exists", () => {
  assertExists(join(PLUGIN_DIR, "src/types.ts"));
});

test("src/runtime.ts exists", () => {
  assertExists(join(PLUGIN_DIR, "src/runtime.ts"));
});

test("src/http-handler.ts exists", () => {
  assertExists(join(PLUGIN_DIR, "src/http-handler.ts"));
});

// Test 2: package.json structure
test("package.json has correct structure", () => {
  const pkg = JSON.parse(readFileSync(join(PLUGIN_DIR, "package.json"), "utf8"));
  assertJsonField(pkg, "name", "@aiosbot/webhook-channel");
  assertJsonField(pkg, "type", "module");
  assertJsonField(pkg, "openclaw");
  assertJsonField(pkg.openclaw, "extensions");
});

// Test 3: Plugin manifest structure
test("openclaw.plugin.json has correct structure", () => {
  const manifest = JSON.parse(
    readFileSync(join(PLUGIN_DIR, "openclaw.plugin.json"), "utf8")
  );
  assertJsonField(manifest, "id", "webhook");
  assertJsonField(manifest, "channels");
  assertJsonField(manifest, "configSchema");
});

// Test 4: Channel implementation exports
test("channel.ts exports webhookChannelPlugin", () => {
  const content = readFileSync(join(PLUGIN_DIR, "src/channel.ts"), "utf8");
  if (!content.includes("export const webhookChannelPlugin")) {
    throw new Error("Missing export: webhookChannelPlugin");
  }
});

// Test 5: Required adapters implemented
test("channel.ts implements config adapter", () => {
  const content = readFileSync(join(PLUGIN_DIR, "src/channel.ts"), "utf8");
  if (!content.includes("config:")) {
    throw new Error("Missing config adapter");
  }
  if (!content.includes("listAccountIds:")) {
    throw new Error("Missing listAccountIds in config adapter");
  }
  if (!content.includes("resolveAccount:")) {
    throw new Error("Missing resolveAccount in config adapter");
  }
});

test("channel.ts implements security adapter", () => {
  const content = readFileSync(join(PLUGIN_DIR, "src/channel.ts"), "utf8");
  if (!content.includes("security:")) {
    throw new Error("Missing security adapter");
  }
  if (!content.includes("resolveDmPolicy:")) {
    throw new Error("Missing resolveDmPolicy in security adapter");
  }
});

test("channel.ts implements outbound adapter", () => {
  const content = readFileSync(join(PLUGIN_DIR, "src/channel.ts"), "utf8");
  if (!content.includes("outbound:")) {
    throw new Error("Missing outbound adapter");
  }
  if (!content.includes("sendText:")) {
    throw new Error("Missing sendText in outbound adapter");
  }
  if (!content.includes("sendMedia:")) {
    throw new Error("Missing sendMedia in outbound adapter");
  }
});

test("channel.ts implements status adapter", () => {
  const content = readFileSync(join(PLUGIN_DIR, "src/channel.ts"), "utf8");
  if (!content.includes("status:")) {
    throw new Error("Missing status adapter");
  }
  if (!content.includes("buildAccountSnapshot:")) {
    throw new Error("Missing buildAccountSnapshot in status adapter");
  }
});

// Test 6: HTTP handler structure
test("http-handler.ts exports createIncomingWebhookHandler", () => {
  const content = readFileSync(join(PLUGIN_DIR, "src/http-handler.ts"), "utf8");
  if (!content.includes("export function createIncomingWebhookHandler")) {
    throw new Error("Missing export: createIncomingWebhookHandler");
  }
});

// Test 7: Types structure
test("types.ts defines WebhookIncomingMessage", () => {
  const content = readFileSync(join(PLUGIN_DIR, "src/types.ts"), "utf8");
  if (!content.includes("export type WebhookIncomingMessage")) {
    throw new Error("Missing type: WebhookIncomingMessage");
  }
});

test("types.ts defines ResolvedWebhookAccount", () => {
  const content = readFileSync(join(PLUGIN_DIR, "src/types.ts"), "utf8");
  if (!content.includes("export type ResolvedWebhookAccount")) {
    throw new Error("Missing type: ResolvedWebhookAccount");
  }
});

// Summary
console.log("\n" + "=".repeat(50));
const passed = results.filter((r) => r.passed).length;
const failed = results.filter((r) => !r.passed).length;
console.log(`\n📊 Results: ${passed} passed, ${failed} failed\n`);

if (failed > 0) {
  console.log("❌ Failed tests:");
  results.filter((r) => !r.passed).forEach((r) => {
    console.log(`   - ${r.name}: ${r.error}`);
  });
  process.exit(1);
} else {
  console.log("✅ All tests passed! Plugin structure is valid.\n");
}
