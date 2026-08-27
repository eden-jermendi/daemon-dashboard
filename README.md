# Daemon Dashboard

Daemon Dashboard is a modular personal dashboard and control plane for services, media tooling, integrations, experiments, and personal infrastructure.

## Current Status

**Milestone 2: Security & Provider Authentication Boundary** (Complete)

- **Application Authentication (Milestone 2A)**: Protected by Neon Auth (Managed Better Auth via `@neondatabase/auth`). Unauthenticated visitors are redirected to `/auth/sign-in`.
- **Real-Debrid OAuth2 Connection (Milestone 2B)**: 3-legged OAuth2 web flow established with encrypted token persistence in Neon Postgres (AES-256-GCM) and automatic token refresh via documented device grant.
- **Real-Debrid Module (Milestone 3 - Next)**: Account status, subscription watch, and health monitoring.
- **Stremio Switch (Milestone 6 - Planned)**: Operates as an independent application; integration assessment deferred.

## Tech Stack

- **Framework**: [Next.js](https://nextjs.org/) (App Router, React 19, Next.js 16.3.3)
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **Authentication**: [Neon Auth](https://neon.tech/docs/neon-auth) (`@neondatabase/auth` - Managed Better Auth)
- **Persistence**: [Neon Serverless Postgres](https://neon.tech/docs/serverless/serverless-driver) (`@neondatabase/serverless`)
- **Security**: Node.js `crypto` (AES-256-GCM token encryption, timing-safe OAuth CSRF validation)
- **Styling**: Pure CSS / CSS Modules (Utilitarian systems aesthetic)
- **Code Quality**: ESLint

## Getting Started

### Prerequisites

- Node.js 20+ (Node.js 24 recommended)
- npm
- Neon Project with Managed Better Auth and Postgres database
- Real-Debrid Account (for OAuth Client credentials at https://real-debrid.com/api)

### Environment Configuration

Copy `.env.example` to `.env.local` and configure your environment parameters:

```bash
cp .env.example .env.local
```

#### 1. Neon Auth Configuration
- `NEON_AUTH_BASE_URL` — Neon Auth URL from Neon Console (Auth -> Configuration)
- `NEON_AUTH_COOKIE_SECRET` — 32+ character string for cookie signing (`openssl rand -base64 32`)
- `NEXT_PUBLIC_NEON_AUTH_URL` — Public Auth base URL for client authentication requests

#### 2. Neon Database Connection
- `DATABASE_URL` — Pooled Postgres connection URL (`-pooler` endpoint)
- `DATABASE_URL_UNPOOLED` — Direct Postgres connection URL (for schema migrations)

#### 3. Real-Debrid OAuth2 Configuration
- Register an application in the [Real-Debrid API Dashboard](https://real-debrid.com/api) with your redirect URL (e.g. `http://localhost:3000/api/integrations/real-debrid/callback` for local dev or `https://your-domain.vercel.app/api/integrations/real-debrid/callback` for production).
- `REAL_DEBRID_CLIENT_ID` — OAuth Client ID
- `REAL_DEBRID_CLIENT_SECRET` — OAuth Client Secret (strictly server-only)
- `REAL_DEBRID_REDIRECT_URI` — Configured OAuth callback URL

#### 4. Token Encryption Key
Generate a secure 32-byte (256-bit) encryption key:
```bash
openssl rand -hex 32
```
- `PROVIDER_TOKEN_ENCRYPTION_KEY` — 64-character hex string used for AES-256-GCM token encryption.

### Database Migrations

Apply database migrations to your Neon database:

```bash
npm run db:migrate
```

### Development Scripts

- `npm run dev` — Starts the Next.js development server
- `npm run build` — Builds the application for production
- `npm run start` — Starts the production server
- `npm run lint` — Runs ESLint checks (`eslint .`)
- `npm run typecheck` — Validates TypeScript types (`tsc --noEmit`)
- `npm run db:migrate` — Executes database migrations
- `npm test` — Runs unit test suites

## Documentation

- [ROADMAP.md](file:///Users/eden/Documents/Documents/code/personal-projects/nextjs/daemon-dashboard/ROADMAP.md) — Phased milestone plan and current progress.
- [DECISIONS.md](file:///Users/eden/Documents/Documents/code/personal-projects/nextjs/daemon-dashboard/DECISIONS.md) — Architectural and technical decision records.
- [GEMINI.md](file:///Users/eden/Documents/Documents/code/personal-projects/nextjs/daemon-dashboard/GEMINI.md) — Project guidelines and agent memory.