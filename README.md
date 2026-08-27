# Daemon Dashboard

Daemon Dashboard is a modular personal dashboard and control plane for services, media tooling, integrations, experiments, and personal infrastructure.

## Current Status

**Milestone 2A: Neon Auth Access Boundary** (Active / In Progress)

- **Application Authentication (Implemented - Milestone 2A)**: Protected by Neon Auth (Managed Better Auth via `@neondatabase/auth`). Unauthenticated visitors are redirected to `/auth/sign-in`.
- **Real-Debrid Module (Planned - Milestone 2B/3)**: Dedicated route and UI shell established (`/modules/real-debrid`). OAuth2 web flow integration will be introduced in Milestone 2B.
- **Stremio Switch (Planned - Milestone 6)**: Operates as an independent application; integration assessment deferred.

## Tech Stack

- **Framework**: [Next.js](https://nextjs.org/) (App Router, React 19, Next.js 16.3.3)
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **Authentication**: [Neon Auth](https://neon.tech/docs/neon-auth) (`@neondatabase/auth` - Managed Better Auth)
- **Styling**: Pure CSS / CSS Modules (Utilitarian systems aesthetic)
- **Code Quality**: ESLint

## Getting Started

### Prerequisites

- Node.js 20+ (Node.js 24 recommended)
- npm
- Neon Project with Managed Better Auth enabled

### Environment Configuration

Copy `.env.example` to `.env.local` and configure your Neon Auth parameters:

```bash
cp .env.example .env.local
```

Required variables:
- `NEON_AUTH_BASE_URL` — Neon Auth URL from Neon Console (Auth -> Configuration)
- `NEON_AUTH_COOKIE_SECRET` — 32+ character string for cookie signing (`openssl rand -base64 32`)
- `NEXT_PUBLIC_NEON_AUTH_URL` — Public Auth base URL for client authentication requests

### Development

Install dependencies and start the local development server:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Scripts

- `npm run dev` — Starts the Next.js development server
- `npm run build` — Builds the application for production
- `npm run start` — Starts the production server
- `npm run lint` — Runs ESLint checks (`eslint .`)
- `npm run typecheck` — Validates TypeScript types (`tsc --noEmit`)

## Documentation

- [ROADMAP.md](file://daemon-dashboard/ROADMAP.md) — Phased milestone plan and current progress.
- [DECISIONS.md](file://daemon-dashboard/DECISIONS.md) — Architectural and technical decision records.
- [GEMINI.md](file://daemon-dashboard/GEMINI.md) — Project guidelines and agent memory.