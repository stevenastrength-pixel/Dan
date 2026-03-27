# DAN × OpenClaw Integration

This document describes the integration that DAN now uses for OpenClaw.

## Summary

DAN no longer depends on a custom synchronous adapter to use OpenClaw. It calls the official OpenClaw Gateway `POST /v1/responses` endpoint directly.

That means the target architecture is:

```text
Browser
  -> DAN (Next.js)
  -> OpenClaw Gateway /v1/responses
  -> OpenClaw agent runtime
```

## Why this changed

The earlier DAN implementation assumed OpenClaw only exposed an async webhook flow, so it introduced a custom `{ reply: string }` bridge contract.

That assumption was outdated. OpenClaw now documents synchronous Gateway APIs, including:

- [OpenResponses API](https://docs.openclaw.ai/gateway/openresponses-http-api)
- [OpenAI-compatible API](https://docs.openclaw.ai/gateway/openai-http-api)

For DAN, the OpenResponses API is the better fit because project chat already uses model tool calls.

## Current DAN behavior

### Project chat without tools

For simple OpenClaw chat, DAN sends:

- `instructions`: the assembled project system prompt
- `input`: the current chat history as OpenResponses message items

and extracts assistant text from the response output items.

### Project chat with tools

For tool-enabled project chat, DAN:

1. sends a `/v1/responses` request with function tools
2. reads `function_call` output items
3. executes the requested local tool
4. sends `function_call_output` back to `/v1/responses`
5. repeats until assistant text is returned

### Session routing

When DAN has a stable project-chat session key for the current user, it sends:

```http
x-openclaw-session-key: <key>
```

This is what allows multi-turn tool continuation with the Gateway.

## What DAN does not do

- DAN does not call OpenClaw's older custom bridge format for normal OpenClaw use anymore.
- DAN does not rely on Telegram-specific delivery/webhook behavior.
- DAN does not need a separate adapter container if the Gateway `/v1/responses` endpoint is enabled.

## Legacy compatibility

`src/app/api/openclaw-bridge/route.ts` still exists, but it is now explicitly legacy.

That route:

- accepts DAN's older private payload format
- calls Anthropic or OpenAI directly
- returns `{ reply: string }`

It is not a native OpenClaw integration path.
