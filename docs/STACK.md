# Technical Stack — Compote

## Runtime & Build

| Tool | Role |
|---|---|
| **Bun** | Package manager, script runner, server runtime (self-host mode) |
| **Vite 5** | Dev server and production bundler |
| **TypeScript 5** | Strict mode across the full codebase |

## Frontend

| Tool | Role |
|---|---|
| **React 18** | UI framework |
| **React Router v6** | Client-side routing (`/hosts`, `/hosts/:id`, `/hosts/:id/:composeId`) |
| **Zustand 4** | Global state — `useHostStore`, `useComposeStore` |
| **Tailwind CSS 3** | Utility-first styling with CSS variable theme |
| **shadcn/ui** | UI primitives (local copies, not installed as a package) |
| **Radix UI** | Headless primitives backing shadcn/ui |
| **Lucide React** | Icon library |

## Data & Persistence

| Tool | Role |
|---|---|
| **idb-keyval** | IndexedDB wrapper (static/Cloudflare mode) |
| **bun:sqlite** | SQLite driver (server/Docker mode) |
| **StorageDriver** | Interface abstracting both — selected at build time via `VITE_STORAGE_MODE` |
| **JSZip** | ZIP bundle generation |
| **js-yaml** | Compose YAML parsing and rendering |

## Catalog & Bundles

| Tool | Role |
|---|---|
| `vite-plugin-catalog.ts` | Scans `public/catalog/*/metadata.json` → emits `catalog.json` |
| `vite-plugin-bundles.ts` | Scans `public/bundles/*/bundle.json` → emits `bundles.json` |
| `fetch-icons.mjs` | Fetches SVG icons from Simple Icons / selfh.st / Dashboard Icons |

## Testing

| Tool | Role |
|---|---|
| **Vitest** | Test runner — shares Vite config, zero extra setup |
| **@vitest/coverage-v8** | V8-based coverage reports |
| **jsdom** | DOM environment for Zustand store tests |

## Deployment

| Target | Tooling |
|---|---|
| **Cloudflare Pages** | `bun run build` → `wrangler pages deploy dist` |
| **Docker (self-host)** | `bun run build:server` → `docker build` |

## Design System

- **Theme**: Custom dark palette via CSS variables (HSL), compatible with shadcn/ui color system
- **Typography**: Geist Variable font
- **Density**: High-density, information-rich layouts targeting desktop/tablet
- **Motion**: `tailwindcss-animate` for entry animations (`animate-in`, `fade-in`, `slide-in-from-*`)
