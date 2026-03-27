# Testing Strategy

This project did not previously have an automated test suite. The first pass adds a lightweight Vitest setup and starts with stable unit coverage around the AI abstraction layer.

## Current Coverage

Initial automated tests live in `tests/lib/ai.test.ts` and validate:

- `buildSystemPrompt()` formatting and fallback behavior
- `streamOpenClaw()` request payload construction
- OpenClaw error propagation
- OpenClaw response-shape validation
- OpenClaw mixed assistant-text plus function-call handling

These tests were chosen first because they are:

- high value
- deterministic
- independent of a live database
- independent of live provider APIs

## Recommended Coverage Layers

### 1. Unit tests

Best targets:

- prompt builders
- provider adapters
- auth cookie helpers
- route-level validation helpers extracted into pure functions
- document/chapter patching helpers if those are factored out of route handlers

### 2. API route integration tests

Next targets to add:

- auth registration and login flows
- project creation and automatic core-document bootstrapping
- settings save/load behavior
- project message posting with and without `@Daneel`
- task assignment and poll creation tool execution

Recommended approach:

- use Vitest in node environment
- stand up an isolated SQLite test database
- seed only the minimum fixtures each suite needs
- mock provider SDK calls and external fetches

### 3. End-to-end browser coverage

Once the route layer is under test, add Playwright for:

- first-user registration
- login/logout
- project creation
- editing a core project document
- creating and voting in polls
- viewing and completing tasks
- sending a project chat message that triggers an AI response

## Suggested Refactors To Improve Testability

These code changes would make the next wave of tests much easier:

- extract project-chat prompt assembly from route handlers into pure helper functions
- extract tool execution from `src/app/api/projects/[projectSlug]/messages/route.ts` into a dedicated module
- centralize provider configuration validation so it can be tested once
- allow Prisma client injection in route-level helpers for isolated DB tests

## Running Tests

```bash
npm test
```

For watch mode:

```bash
npm run test:watch
```
