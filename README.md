# DAN

DAN, short for Distributed Authoring Nexus, is a web application for collaborative novel development with built-in AI assistance. It gives a writing team a shared workspace for project chat, chapters, canon documents, characters, worldbuilding, polls, and task assignment, while letting the AI backend be swapped between OpenAI, Anthropic, and an OpenClaw Gateway endpoint.

The current implementation is a Next.js 14 app with Prisma and SQLite. Authentication is built in, projects are multi-tenant, and project chat can trigger an AI agent named `Daneel` that can read project context and perform structured tool actions such as editing documents, creating chapters, opening polls, and assigning tasks.

## Status

- OpenAI and Anthropic are the primary working providers.
- OpenClaw support is present through the official OpenClaw Gateway `POST /v1/responses` API.
- There are no automated tests in the repository yet.

## Core Capabilities

- Multi-user auth with admin and contributor roles
- Invite-code based registration for all users after the first account
- Multiple writing projects, each with its own isolated data
- Project chat with optional AI participation when users mention `@Daneel`
- Global chat page outside any single project
- Auto-created core project documents:
  - Story Bible
  - Style Guide
  - Project Instructions
  - Wake Prompt
- Chapter authoring with autosave, version history, comments, and inline AI help
- Character and world-entry management
- Poll creation, voting, and completion tracking
- Task assignment and progress tracking
- Project-scoped notifications for pending polls and tasks
- AI tool-use workflows for structured project updates
- Docker support for simple self-hosted deployment

## How DAN Is Organized

At a high level, DAN combines three layers:

1. The web UI, built with the Next.js App Router, for chat, editing, and project management.
2. The application/API layer, implemented as Next.js route handlers under `src/app/api`.
3. The persistence layer, using Prisma with SQLite.

Most of the AI behavior is routed through two code paths:

- `src/app/api/projects/[projectSlug]/messages/route.ts` for project chat with tool use
- `src/app/api/projects/[projectSlug]/agent/chat/route.ts` and `src/app/api/agent/chat/route.ts` for streamed chat responses

The provider abstraction lives in `src/lib/ai.ts`.

## Product Model

Each project contains its own:

- documents
- chapters
- characters
- world entries
- polls
- tasks
- project chat history

Global app state also includes:

- users
- auth/session data
- presence
- global messages
- shared AI/provider settings

The Prisma schema is in [`prisma/schema.prisma`](/Users/oberon/Projects/coding/other/Dan/prisma/schema.prisma).

## AI Behavior

### Providers

DAN supports three provider modes:

- `anthropic`
- `openai`
- `openclaw`

The active provider and credentials are stored in the `Settings` table and managed in the Settings UI.

Default models in the code today:

- Anthropic chat: `claude-opus-4-6`
- Anthropic tool loop: `claude-sonnet-4-6`
- OpenAI chat: `gpt-5.4`
- OpenAI tool loop: `gpt-5.4-nano`

### How project chat works

When a user posts in project chat:

- The message is saved immediately.
- If the content does not mention `@Daneel`, no AI call is made.
- If `@Daneel` is mentioned, DAN assembles project context from documents, chapters, characters, world entries, recent messages, and tasks.
- DAN then calls the configured provider.
- If the model chooses to use tools, DAN executes them server-side and posts the resulting assistant message back into the project chat.

### Tool actions currently exposed to the AI

The project chat route gives the model structured tools for:

- `get_document`
- `patch_document`
- `update_document`
- `create_chapter`
- `get_chapter`
- `patch_chapter`
- `update_chapter`
- `assign_task`
- `get_tasks`
- `create_poll`

This is the key mechanism that makes the AI more than a chatbot. Daneel can make real project changes instead of only suggesting them in prose.

## OpenClaw Notes

OpenClaw support now targets the official OpenClaw Gateway `POST /v1/responses` API.

DAN can be configured to talk to:

1. an OpenClaw Gateway root URL, such as `http://localhost:18789`
2. a full OpenClaw responses URL, such as `http://localhost:18789/v1/responses`

There is also a legacy compatibility route at `/api/openclaw-bridge`, but it is not a real OpenClaw agent integration. It simply calls Anthropic or OpenAI directly using DAN's configured key.

Important caveats:

- The legacy built-in bridge remains in the repo for backwards compatibility.
- Tool-use with OpenClaw depends on the Gateway `responses` endpoint being enabled and reachable.
- Provider credentials for the Gateway are still stored in the app database today.

For more detail, see:

- [`docs/openclaw-setup.md`](/Users/oberon/Projects/coding/other/Dan/docs/openclaw-setup.md)
- [`docs/openclaw-integration.md`](/Users/oberon/Projects/coding/other/Dan/docs/openclaw-integration.md)

## Authentication and Roles

- Auth is cookie-based using signed JWTs.
- All non-public routes are protected by `src/middleware.ts`.
- The first registered user becomes `admin`.
- Every later user must register with the current invite code.
- Admins can:
  - view users
  - change user roles
  - remove users
  - regenerate invite codes

Relevant files:

- [`src/lib/auth.ts`](/Users/oberon/Projects/coding/other/Dan/src/lib/auth.ts)
- [`src/middleware.ts`](/Users/oberon/Projects/coding/other/Dan/src/middleware.ts)
- [`src/app/api/admin/users/route.ts`](/Users/oberon/Projects/coding/other/Dan/src/app/api/admin/users/route.ts)
- [`src/app/api/admin/invite/route.ts`](/Users/oberon/Projects/coding/other/Dan/src/app/api/admin/invite/route.ts)

## Local Development

### Prerequisites

- Node.js 20+
- npm

### 1. Install dependencies

```bash
npm ci
```

### 2. Create your environment file

```bash
cp .env.example .env
```

Minimum required values:

```env
DATABASE_URL="file:./dev.db"
JWT_SECRET="replace-this-with-a-long-random-secret"
```

Notes:

- `JWT_SECRET` is required for login/session handling.
- Provider API keys are stored in the database through the Settings page, not in `.env`.
- SQLite is the only configured database backend in this repository.

### 3. Initialize the database

```bash
npm run db:setup
```

This runs `prisma db push` and then the seed script.

### 4. Start the app

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 5. Create the first user

The first registered account automatically becomes the admin and does not need an invite code.

After that:

- log in as admin
- open Settings
- generate or copy the invite code
- share it with additional contributors

## Docker Deployment

The repo includes both a `Dockerfile` and `docker-compose.yml`.

### Start with Docker Compose

```bash
docker compose up --build
```

This will:

- build the Next.js app
- persist the SQLite database in a named Docker volume
- expose the app on port `3000`

Set a real JWT secret before using this anywhere outside local development:

```bash
JWT_SECRET="$(openssl rand -base64 48)" docker compose up --build
```

The compose setup uses:

- `DATABASE_URL=file:/app/data/dan.db`
- a persistent volume named `dan-data`

## Project Bootstrapping

Creating a new project automatically creates four core documents with starter templates:

- Story Bible
- Style Guide
- Project Instructions
- Wake Prompt

This happens in [`src/app/api/projects/route.ts`](/Users/oberon/Projects/coding/other/Dan/src/app/api/projects/route.ts).

Those templates are important because they are a major part of the context sent to the AI.

## Notable Routes

### Pages

- `/projects` - project list and creation
- `/projects/[slug]/agent` - main project workspace
- `/projects/[slug]/polls` - project polls
- `/projects/[slug]/tasks` - project tasks
- `/settings` - provider settings, OpenClaw settings, and admin controls
- `/agent` - global chat

### API

- `/api/projects`
- `/api/projects/[projectSlug]/messages`
- `/api/projects/[projectSlug]/agent/chat`
- `/api/projects/[projectSlug]/documents`
- `/api/projects/[projectSlug]/tasks`
- `/api/projects/[projectSlug]/polls`
- `/api/settings`
- `/api/openclaw-bridge`
- `/api/auth/login`
- `/api/auth/register`

There is also a separate agent API reference here:

- [`docs/agent-api.md`](/Users/oberon/Projects/coding/other/Dan/docs/agent-api.md)

## Useful Scripts

From [`package.json`](/Users/oberon/Projects/coding/other/Dan/package.json):

- `npm run dev` - start the Next.js dev server
- `npm run build` - generate Prisma client and build production assets
- `npm run start` - start the production server
- `npm run db:push` - push the Prisma schema to SQLite
- `npm run db:seed` - run the seed script
- `npm run db:setup` - push schema and run seed
- `npm run db:studio` - open Prisma Studio

## Repository Layout

```text
.
├── docs/                  Additional implementation notes
├── prisma/                Prisma schema and seed script
├── src/app/               Next.js App Router pages and API routes
├── src/components/        Shared UI components
├── src/contexts/          React context providers
├── src/lib/               Auth, AI, Prisma helpers
├── Dockerfile
├── docker-compose.yml
└── package.json
```

## Known Gaps and Follow-Up Work

- OpenClaw integration should still be exercised against a real Gateway container before relying on it in production.
- Secrets for providers are stored in the database in plaintext today.
- There are no automated tests, lint scripts, or CI configuration in the repository.
- The Prisma seed script currently does not create sample data.
- The app uses SQLite, which is convenient for single-instance deployment but may become limiting if you want heavier concurrent usage.

## Suggested Next Steps

If you are picking this project up, the most useful near-term improvements would be:

1. Add integration tests against a real OpenClaw Gateway container.
2. Add automated tests around auth, project creation, tool execution, and provider selection.
3. Add secret-management improvements for stored provider credentials.
4. Add migrations and deployment guidance for non-SQLite production environments if the project needs to scale.
