## OpenClaw Integration Development Path

Based on my analysis, here's a structured dev path for integrating OpenClaw into your custom solution:

---

### 📊 Architecture Overview

OpenClaw is a **personal AI assistant platform** with these key components:

| Layer | Description | Key Files |
|-------|-------------|-----------|
| **Gateway** | WebSocket control plane (port 18789) | gateway |
| **Agent Runtime** | Pi agent with embedded tool execution | agents |
| **Channels** | Messaging surfaces (WhatsApp, Telegram, etc.) | channels, extensions |
| **Plugin SDK** | Extension API for custom channels/tools | plugin-sdk |
| **Nodes** | Device-local actions (camera, screen, canvas) | node-host |
| **Apps** | macOS/iOS/Android companions | apps |

---

### 🛤️ Recommended Integration Phases

#### **Phase 1: Core Gateway Integration (Week 1-2)**

**Goal:** Get the Gateway running and understand the WebSocket protocol.

1. **Install & run locally:**
   ```bash
   npm install -g openclaw@latest
   openclaw onboard --install-daemon
   openclaw gateway --port 18789 --verbose
   ```

2. **Study the WS protocol:**
   - Connect via WebSocket to `ws://127.0.0.1:18789`
   - First frame must be `connect` with device identity
   - Requests: `{type:"req", id, method, params}` → `{type:"res", id, ok, payload|error}`
   - Events: `{type:"event", event, payload}`

3. **Key integration points:**
   - architecture.md – protocol flow
   - configuration.md – all config keys
   - Config location: `~/.openclaw/openclaw.json` (JSON5)

---

#### **Phase 2: Custom Channel Plugin (Week 2-4)**

**Goal:** Create a channel plugin for your messaging surface.

**Plugin structure:**
```
my-channel/
├── openclaw.plugin.json    # Manifest
├── package.json            # Dependencies
├── index.ts                # Entry point
└── src/
    └── channel.ts          # Channel implementation
```

**Minimal plugin (index.ts as reference):**
```typescript
import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import { emptyPluginConfigSchema } from "openclaw/plugin-sdk";

export default {
  id: "my-channel",
  name: "My Channel",
  description: "Custom channel plugin",
  configSchema: emptyPluginConfigSchema(),
  register(api: OpenClawPluginApi) {
    api.registerChannel({ plugin: myChannelPlugin });
  },
};
```

**Key adapters to implement** (see types.ts):
- `ChannelMessagingAdapter` – send/receive messages
- `ChannelAuthAdapter` – login/logout
- `ChannelOutboundAdapter` – reply delivery
- `ChannelSecurityAdapter` – DM policy/allowlists

---

#### **Phase 3: Agent & Tools Customization (Week 4-6)**

**Goal:** Customize the AI agent behavior and add custom tools.

1. **Workspace setup:**
   - Default: `~/.openclaw/workspace`
   - Injected prompts: AGENTS.md, `SOUL.md`, `TOOLS.md`
   - Skills: `~/.openclaw/workspace/skills/<skill>/SKILL.md`

2. **Custom tools via plugins:**
   ```typescript
   api.registerAgentTools([{
     name: "my_tool",
     description: "Does something custom",
     parameters: { /* TypeBox schema */ },
     execute: async (params, ctx) => { /* ... */ }
   }]);
   ```

3. **Model configuration** (`~/.openclaw/openclaw.json`):
   ```json5
   {
     agent: {
       model: "claude-sonnet-4-20250514",
       thinkingLevel: "medium"
     }
   }
   ```

---

#### **Phase 4: Multi-Agent Routing (Week 6-8)**

**Goal:** Route different channels/accounts to isolated agents.

**Config structure:**
```json5
{
  routing: {
    agents: {
      "main": { workspace: "~/.openclaw/workspace" },
      "support": { workspace: "~/.openclaw/support-workspace" },
      "sales": { workspace: "~/.openclaw/sales-workspace" }
    },
    rules: [
      { channel: "telegram", group: "*support*", agent: "support" },
      { channel: "whatsapp", sender: "+1555*", agent: "sales" }
    ]
  }
}
```

**Session tools for agent coordination:**
- `sessions_list` – discover active sessions
- `sessions_send` – message another session
- `sessions_history` – fetch transcript logs

---

#### **Phase 5: Security & Production (Week 8-10)**

**Goal:** Harden for production deployment.

1. **DM Security (critical):**
   ```json5
   {
     channels: {
       whatsapp: {
         dmPolicy: "pairing",  // or "open" with explicit allowlist
         allowFrom: ["+1234567890"]
       }
     }
   }
   ```

2. **Sandbox mode for non-main sessions:**
   ```json5
   {
     agents: {
       defaults: {
         sandbox: { mode: "non-main" }  // Docker isolation
       }
     }
   }
   ```

3. **Gateway auth:**
   ```json5
   {
     gateway: {
       auth: {
         mode: "password",
         password: "your-secure-password"
       }
     }
   }
   ```

4. **Remote access via Tailscale:**
   ```json5
   {
     gateway: {
       tailscale: { mode: "serve" }  // or "funnel" for public
     }
   }
   ```

---

### 🔌 Key Integration APIs

| API | Purpose | Docs |
|-----|---------|------|
| **Plugin SDK** | Register channels, tools, HTTP routes | plugin.md |
| **Gateway WS** | Control plane protocol | architecture.md |
| **Config RPC** | `config.get`, `config.patch`, `config.apply` | configuration.md |
| **Agent RPC** | `agent` method for AI invocation | agent.md |
| **Webhook** | External triggers | webhook.md |

---

### 🎯 Quick Decision Matrix

| Your Need | OpenClaw Approach |
|-----------|-------------------|
| Custom chat surface | Create a **channel plugin** |
| Custom AI tools | Register via **plugin SDK** or workspace skills |
| Headless API-only | Use **Gateway WS protocol** directly |
| White-label mobile | Fork ios or android |
| Custom model provider | Add to `models.providers` config |
| Webhook integrations | Use built-in webhook surface |

---

### 📁 Files to Study First

1. index.ts – all exported SDK types
2. telegram – reference channel plugin
3. configuration.md – full config schema
4. pi-embedded-runner.ts – agent execution
5. server.impl.ts – gateway startup

---

### 🚀 Next Steps

What's your specific use case? I can provide more targeted guidance for:
- **A)** Building a custom channel (e.g., your own messaging platform)
- **B)** Embedding OpenClaw as a backend service (headless API)
- **C)** Extending the agent with domain-specific tools
- **D)** White-labeling the mobile/desktop apps
- **E)** Multi-tenant deployment architecture