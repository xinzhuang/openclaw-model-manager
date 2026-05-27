# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

OpenClaw Model Router — a web-based configuration UI for OpenClaw (a Claude Code alternative). This tool manages AI model provider configurations (`openclaw.json`) and per-agent model definitions. The app is a single-page dashboard with a left panel for provider management and a right panel for agent settings.

## Commands

```bash
npm run dev              # Start both backend + frontend via concurrently (dev mode)
npm run dev:ui           # Vite dev server only (port 7123, proxies /api to :3457)
npm run dev:server       # Express backend only (port 3457, watches with tsx)
npm run build            # Vite build → single HTML file in dist/
npm start                # Production: Express serves built frontend + API
omm start               # CLI: start server (after npm link), opens browser
omm model               # CLI: interactive global model selector
```

No test framework is configured. No lint/format scripts are set up.

## Architecture

### Two-Part App (Express API + React SPA)

**Backend** (`server/`):
- `server/index.ts` — Express app, mounts routes, serves built frontend in production
- `server/routes/config.ts` — All API routes under `/api/config`. Handles global config (openclaw.json) and per-agent model configs (agents/{id}/agent/models.json)
- `server/utils/config.ts` — File I/O for `~/.openclaw/openclaw.json`. Uses atomic writes (tmp → rename), creates backups (keeps last 5), enforces 0o600 permissions, and implements optimistic locking via SHA-256 hash (`baseHash`)
- `server/cli.ts` — CLI tool (`omm` command) for start/stop/status/model/install
- `server/commands/model.ts` — `omm model` interactive selector: reads providers from config, presents `@inquirer/prompts` select, writes to `agents.defaults.model` via `patchConfig`

**Frontend** (`src/`):
- `src/App.tsx` — Root: wraps everything in `ConfigProvider`, renders `Dashboard`
- `src/pages/Dashboard.tsx` — Two-column layout: `Providers` (left 3/5) + `Agents` (right 2/5)
- `src/context/ConfigProvider.tsx` — Global state: loads config from API, provides `config`, `save()`, `refresh()`, `baseHash` for optimistic locking
- `src/lib/api.ts` — `ApiClient` class singleton (`api`). All backend communication. Uses `/api/config` for global config and `/api/config/agents/...` for per-agent configs
- `src/lib/constants.ts` — `BUILTIN_PROVIDERS` list and `API_TYPES` array. Also exports `parseModelRef`/`formatModelRef` for `providerId/modelId` string refs

### Key Types (`src/types.ts`)

- `OpenClawConfig` — Root config shape mirroring openclaw.json
- `ProviderConfig` — Per-provider config: `baseUrl`, `apiKey`, `api` (ApiType), `models[]`
- `ModelDefinition` — Model entry with `id`, `name`, `reasoning`, `input[]` (e.g., `["text", "image"]`), `contextWindow`, `maxTokens`, `cost`, `compat{}`
- `ApiType` — Union of supported API types: `"openai-completions" | "anthropic-messages" | "google-generative-ai"` etc.

### Component Structure

- `src/components/providers/` — Provider management: `Providers` (list), `ProviderCard` (expandable card), `ProviderDialog` (add/edit with model management)
- `src/components/agents/` — Agent management: `Agents` (list + auth profiles), `AgentDialog`, `AuthProfiles`
- `src/components/ui/` — Radix-based UI primitives (dialog, switch, combobox, select, etc.) styled with Tailwind CSS

### Config File Locations

- Global: `~/.openclaw/openclaw.json` (JSON5 format, managed by `server/utils/config.ts`)
- Per-agent models: `~/.openclaw/agents/{agentId}/agent/models.json`
- Per-agent auth: `~/.openclaw/agents/{agentId}/agent/auth-profiles.json`

## i18n

Dual-language (en/zh) via i18next. Translation files in `src/locales/en.json` and `src/locales/zh.json`. Runtime detection via `i18next-browser-languagedetector`.

## Build Notes

- Vite config uses `vite-plugin-singlefile` — production build outputs a single HTML file with inlined assets
- Path alias: `@/` maps to `./src/` (both Vite and tsconfig)
- Server TypeScript is run directly via `tsx` in dev, no separate build step for server code
- `tsconfig.json` — frontend (ES2022, React JSX)
- `tsconfig.server.json` — server (CommonJS-compatible settings, outputs to `dist-server/`)
