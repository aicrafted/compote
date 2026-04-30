# Compote — Compose Templater

A browser-based visual editor for Docker Compose configurations. No backend, no sign-up — everything runs locally in your browser.

## What it does

Compote lets you build and manage Docker Compose setups through a point-and-click UI instead of hand-writing YAML. You organize services into Compose projects, and projects onto hosts (physical or virtual machines). When you're done, export a ready-to-deploy ZIP bundle with your `docker-compose.yml` and a generated README.

**Key capabilities:**

- **Validation** — real-time rule-based checks catch misconfigured services before you deploy
- **Connectivity tracking** — detects port conflicts, missing network links, unresolved service dependencies, and cross-project collisions
- **Visual service editor** — configure images, ports, volumes, environment variables, and `depends_on` through forms; see the rendered YAML in real time
- **Multi-host management** — model your infrastructure as hosts (with OS/architecture metadata), each carrying one or more Compose projects
- **Registry search** — browse Docker Hub and GitHub Container Registry to pick images directly in the UI
- **README generation** — produces a Markdown README from your Compose file automatically
- **ZIP export** — download a bundle with `docker-compose.yml`, `.env`, and generated docs
- **Serverless** — runs entirely in the browser; no backend, no account, all data stays in local IndexedDB

## Tech stack

| Layer | Technology |
|---|---|
| Framework | React 18 + TypeScript 5 |
| Build | Vite 5 + Bun |
| Styling | Tailwind CSS 3 + shadcn/ui |
| State | Zustand |
| Storage | IndexedDB (idb-keyval) |
| Routing | React Router v6 |

## Getting started

**Prerequisites:** [Bun](https://bun.sh) ≥ 1.0

```bash
# Install dependencies
bun install

# Start dev server (http://localhost:3010)
bun run dev
```

## Build

```bash
# Production build
bun run build

# Preview production build
bun run preview
```

## Project structure

```
src/
├── components/ui/     # shadcn/ui primitives
├── features/          # Feature modules (builder, hosts)
├── lib/core/          # Pure logic: importers, exporters, renderers, validation rules
└── stores/            # Zustand stores
```

Data model: **Host → Compose Projects → Services**

Routes: `/hosts` → `/hosts/:hostId` → `/hosts/:hostId/:composeId`

## License

[MIT](LICENSE)
