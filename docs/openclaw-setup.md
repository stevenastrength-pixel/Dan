# DAN × OpenClaw Setup

This project now targets the official OpenClaw Gateway HTTP API instead of DAN's older custom `{ reply: string }` adapter contract.

## What to run

You should have two separate services:

| Service | Example port | Purpose |
|---|---:|---|
| DAN | `3000` | Web UI and application server |
| OpenClaw Gateway | `18789` | Agent runtime and HTTP API |

The intended deployment is exactly the use case we discussed: DAN in one container, OpenClaw in another, on the same machine or Docker network.

## Which OpenClaw API DAN uses

DAN now talks to the official OpenClaw Gateway `POST /v1/responses` endpoint.

Official docs:

- [OpenClaw OpenResponses API](https://docs.openclaw.ai/gateway/openresponses-http-api)

## DAN Settings

Go to `Settings → AI Provider → OpenClaw` and set:

| Field | Value |
|---|---|
| Server URL | OpenClaw Gateway base URL or full `/v1/responses` URL |
| Agent ID | Optional. If set, DAN sends it as `x-openclaw-agent-id` |
| API Key | Gateway bearer token, if auth is enabled |

Examples:

- `http://localhost:18789`
- `http://localhost:18789/v1/responses`
- `http://openclaw:18789` when both apps run in Docker on the same network

If you enter the base URL, DAN appends `/v1/responses` automatically.

## Request shape

DAN sends OpenResponses-style requests:

```json
{
  "model": "openclaw",
  "instructions": "system prompt with project context",
  "input": [
    { "type": "message", "role": "user", "content": "..." },
    { "type": "message", "role": "assistant", "content": "..." }
  ],
  "tools": [
    {
      "type": "function",
      "function": {
        "name": "patch_chapter",
        "description": "...",
        "parameters": { "type": "object", "properties": {} }
      }
    }
  ]
}
```

Headers used by DAN:

```http
Content-Type: application/json
Authorization: Bearer <openClawApiKey>
x-openclaw-agent-id: <openClawAgentId>
x-openclaw-session-key: <stable-session-key>
```

`x-openclaw-session-key` is sent for project tool-use flows so OpenClaw can continue a tool turn across requests.

## Tool loop

For project chat with tools enabled:

1. DAN sends the initial `/v1/responses` request with function tools.
2. OpenClaw may return one or more `function_call` output items.
3. DAN executes those tools locally.
4. DAN sends a follow-up `/v1/responses` request with `function_call_output` items.
5. This repeats until OpenClaw returns assistant text.

## Legacy bridge

The route `src/app/api/openclaw-bridge/route.ts` still exists, but it is now legacy compatibility code.

It does **not** call a real OpenClaw agent. It calls Anthropic or OpenAI directly.

Use it only if you deliberately need the older DAN-specific adapter behavior.
