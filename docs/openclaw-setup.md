# DAN × OpenClaw Setup

---

## Table of Contents

- [What's Running](#whats-running)
- [DAN Settings](#dan-settings)
- [The Bridge Endpoint](#the-bridge-endpoint)
- [Payload Reference](#payload-reference)
- [Tool Loop](#tool-loop)
- [Building a Custom Adapter](#building-a-custom-adapter)

---

## What's Running

| Process | Port | Handles |
|---|---|---|
| DAN (Next.js) | 3000 | Web UI |
| OpenClaw Gateway | 18789 | Telegram |

These run independently. No cross-talk required.

---

## DAN Settings

`Settings → AI Provider → OpenClaw`

| Field | Value |
|---|---|
| AI Provider | Anthropic or OpenAI |
| API Key | LLM key |
| Model | e.g. `claude-sonnet-4-6` — blank = default |
| Provider | **OpenClaw** |
| Server URL | Click **⚡ Use built-in bridge** |
| Agent ID | Optional |

**⚡ Use built-in bridge** auto-fills Server URL with `http://localhost:3000/api/openclaw-bridge`.

---

## The Bridge Endpoint

**File:** `src/app/api/openclaw-bridge/route.ts`

- Accepts DAN's payload format (see below)
- Calls Anthropic or OpenAI directly using DAN's configured key
- Returns `{ reply: string }` synchronously

---

## Payload Reference

DAN sends this to `openClawBaseUrl` on every message:

```json
{
  "agentId": "my-agent",
  "sessionKey": "clx3k9m2p0000abc123",
  "mode": "agent",
  "project": {
    "id": 1,
    "slug": "my-novel",
    "name": "My Novel"
  },
  "context": {
    "documents":    [{ "key": "bible", "title": "Story Bible", "content": "..." }],
    "characters":   [{ "name": "Elara", "role": "Protagonist", "description": "...", "notes": "..." }],
    "worldEntries": [{ "name": "The Citadel", "type": "Location", "description": "..." }],
    "styleGuide":   "..."
  },
  "messages": [
    { "role": "system",    "content": "..." },
    { "role": "user",      "content": "Write the opening of chapter 3" },
    { "role": "assistant", "content": "..." }
  ]
}
```

**Headers:**
```
Content-Type: application/json
Authorization: Bearer <openClawApiKey>
```

**Response:**
```json
{ "reply": "..." }
```

---

## Tool Loop

When the agent invokes tools (e.g. writing/editing a chapter), the exchange is multi-turn:

**1 — DAN sends initial payload** (same as above, plus `tools` array)

**2 — Server responds with tool calls:**
```json
{
  "toolCalls": [
    { "id": "tc_1", "name": "patch_chapter", "input": { "chapterId": "...", "patch": "..." } }
  ]
}
```

**3 — DAN executes tools, sends results:**
```json
{
  "toolResults": [
    { "id": "tc_1", "result": "Chapter updated." }
  ]
}
```

Steps 2–3 repeat until the server sends `{ "reply": "..." }`.

---

## Building a Custom Adapter

To replace the built-in bridge with a real OpenClaw-side adapter:

1. Expose an HTTP endpoint on your server
2. Accept DAN's payload (see [Payload Reference](#payload-reference))
3. Feed `messages`, `context`, and `sessionKey` into your OpenClaw agent
4. Return `{ "reply": "..." }` synchronously — or `{ "toolCalls": [...] }` to invoke DAN's tools
5. In DAN Settings → Server URL, replace the bridge URL with your endpoint

The `sessionKey` value is a stable per-user `cuid`. Map it to an OpenClaw session key as:
```
agent:<agentId>:<sessionKey>
```

Everything else (`Authorization` header, `agentId`, full context) arrives exactly as shown above.
