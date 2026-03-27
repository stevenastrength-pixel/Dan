# DAN × OpenClaw Integration

> How DAN's built-in bridge and a local OpenClaw server coexist on the same machine.

---

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Why They Don't Talk to Each Other](#why-they-dont-talk-to-each-other)
- [Request Flow](#request-flow)
- [The Bridge Route](#the-bridge-route)
- [The Payload Format](#the-payload-format)
- [Configuration](#configuration)
- [The sessionKey Field](#the-sessionkey-field)
- [OpenClaw Side — What Stays the Same](#openclaw-side--what-stays-the-same)
- [Wiring Them Together More Tightly (Optional)](#wiring-them-together-more-tightly-optional)

---

## Overview

Two independent systems run on the same machine. They share the same underlying LLM and agent personality, but operate on completely separate HTTP paths.

| System | Port | Handles |
|---|---|---|
| DAN (Next.js) | 3000 | Web UI chat |
| OpenClaw Gateway | 18789 | Telegram |

Neither system calls the other. OpenClaw is unaware DAN exists.

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                    Your Server                      │
│                                                     │
│  ┌─────────────────┐       ┌─────────────────────┐  │
│  │   DAN (Next.js) │       │  OpenClaw Gateway   │  │
│  │   :3000         │       │  :18789             │  │
│  │                 │       │                     │  │
│  │  /api/openclaw- │       │  Telegram Bot API ──┼──┼── Telegram
│  │    bridge       │       │  LLM Provider       │  │
│  └────────┬────────┘       └─────────────────────┘  │
│           │                                          │
│           └──── Anthropic / OpenAI API               │
└─────────────────────────────────────────────────────┘
         │                          │
    DAN web users              Telegram users
```

---

## Why They Don't Talk to Each Other

OpenClaw's `/hooks/agent` webhook is **async by design**. It returns `202 Accepted` immediately and delivers the LLM response to a configured channel (Telegram, Discord, etc.) — there is no synchronous reply body.

DAN's chat UI needs a synchronous response to stream into the chat window. Routing through OpenClaw's webhook would require:

- A custom delivery channel on the OpenClaw side
- A callback endpoint in DAN
- Request/response correlation logic
- Handling timeouts

The built-in bridge sidesteps all of this by calling the LLM directly.

---

## Request Flow

When a user sends a message tagged `@Daneel` in a project chat:

```
Browser
  │
  └─► POST /api/projects/:slug/agent/chat
            │
            ├─ buildSystemPrompt()
            │    Assembles characters, world entries, documents,
            │    and style guide into a single system prompt string.
            │
            └─ streamOpenClaw()
                 Formats DAN's payload, POSTs to openClawBaseUrl.
                 │
                 └─► POST /api/openclaw-bridge
                           │
                           ├─ Separates system message from chat history
                           ├─ Calls Anthropic or OpenAI SDK directly
                           └─► LLM API
                                 │
                           ◄─────┘  { reply: "..." }
                           │
                 ◄──────────┘  { reply: "..." }
                 │
            Streams reply back to browser as SSE
            │
  ◄─────────┘
  Renders in chat window
```

---

## The Bridge Route

**File:** `src/app/api/openclaw-bridge/route.ts`

The bridge is a standard Next.js API route. It accepts DAN's OpenClaw payload format (the same format sent to any external OpenClaw-compatible server) and returns `{ reply: string }` synchronously.

```typescript
// Simplified — Anthropic path
const response = await client.messages.create({
  model: 'claude-opus-4-6',
  max_tokens: 4096,
  system: systemPrompt,   // full DAN-built prompt: characters, world, docs, style
  messages: chatMessages, // conversation history
})

return { reply: response.content[0].text }
```

Fields received in the payload (`context`, `project`, `agentId`, `sessionKey`) are available to the bridge but not currently forwarded to the LLM — they're part of the shared payload spec for forward compatibility with a real OpenClaw-side adapter.

---

## The Payload Format

DAN always sends this structure to `openClawBaseUrl`, whether that's the built-in bridge or an external server:

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
    "documents": [
      { "key": "bible", "title": "Story Bible", "content": "..." }
    ],
    "characters": [
      { "name": "Elara", "role": "Protagonist", "description": "...", "notes": "..." }
    ],
    "worldEntries": [
      { "name": "The Citadel", "type": "Location", "description": "..." }
    ],
    "styleGuide": "Terse prose, Hemingway-esque..."
  },
  "messages": [
    { "role": "system", "content": "You are a collaborative fiction writing assistant..." },
    { "role": "user",   "content": "Write the opening of chapter 3" }
  ]
}
```

**Headers:**
```
Content-Type: application/json
Authorization: Bearer <openClawApiKey>   (if set in DAN settings)
```

**Expected response:**
```json
{ "reply": "The morning broke cold over the Citadel..." }
```

For tool-use flows (when Daneel uses write/edit chapter tools), the protocol extends to:

```json
{ "toolCalls": [{ "id": "tc_1", "name": "patch_chapter", "input": { ... } }] }
```

DAN executes the tools and sends back:

```json
{ "toolResults": [{ "id": "tc_1", "result": "Chapter updated." }] }
```

This multi-turn loop repeats until a `{ "reply": "..." }` is received.

---

## Configuration

### In DAN Settings

| Field | Value |
|---|---|
| AI Provider | Anthropic or OpenAI |
| API Key | Your LLM key (same one OpenClaw uses, or a separate one) |
| Model | Optional — e.g. `claude-sonnet-4-6`. Leave blank for default. |
| Provider selector | **OpenClaw** |
| Server URL | Click **⚡ Use built-in bridge** — auto-fills `http://localhost:3000/api/openclaw-bridge` |
| Agent ID | Optional. Passes through in the payload; bridge ignores it currently. |

> The **⚡ Use built-in bridge** button reads `window.location.origin` and appends `/api/openclaw-bridge`, so it works regardless of what port DAN is running on.

### Personality Consistency

For the Telegram bot and DAN's web UI to behave identically, ensure:

- Same LLM model configured in both DAN and OpenClaw
- DAN's **Style Guide** field matches the system prompt / identity config in OpenClaw
- Same temperature/sampling settings if your OpenClaw setup exposes those

---

## The sessionKey Field

Every DAN user has an `openClawSessionKey` column in the database (a `cuid`, generated on account creation). This is sent with every request as `sessionKey`.

The built-in bridge ignores it. It's included because:

- **Forward compatibility:** If you later replace the bridge with a real OpenClaw-side adapter, the session key lets OpenClaw maintain per-user conversation memory across requests
- **OpenClaw's session format** would be `agent:<agentId>:<sessionKey>` — the `cuid` slots in as the `<mainKey>` portion, giving each DAN user an isolated conversation context on the OpenClaw side

---

## OpenClaw Side — What Stays the Same

Nothing changes on the OpenClaw side. It continues to:

- Listen on Telegram via its bot token
- Use its own internal LLM configuration (model, system prompt, SOUL.md, etc.)
- Maintain its own session state per Telegram user
- Run on port 18789 as normal

DAN never makes a request to port 18789. OpenClaw never receives a request from DAN.

---

## Wiring Them Together More Tightly (Optional)

If you want DAN and Telegram to share the same OpenClaw agent — including session state, memory, and tool access — you can build a custom synchronous endpoint on the OpenClaw server side.

DAN's payload format is the handshake spec. A compatible endpoint would:

1. Receive DAN's full JSON (`characters`, `worldEntries`, `documents`, `styleGuide`, `messages`, `agentId`, `sessionKey`)
2. Feed the context into OpenClaw's internal agent (appending to the system prompt, injecting into a session, etc.)
3. Run the agent turn synchronously (or long-poll)
4. Return `{ "reply": "..." }` — or `{ "toolCalls": [...] }` if the agent wants to use DAN's tools

Then in DAN Settings, replace the bridge URL with your endpoint URL. Everything else stays the same — `Authorization: Bearer`, `agentId`, `sessionKey`, and the full context all arrive exactly as shown in [The Payload Format](#the-payload-format) section above.

The built-in bridge and a real adapter are fully interchangeable from DAN's perspective.
