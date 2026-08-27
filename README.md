# Daemon Dashboard

Daemon Dashboard is a modular personal dashboard and control plane for services, media tooling, integrations, experiments, and personal infrastructure.

## Current Status

**Milestone 2A: Neon Auth Access Boundary** (Active / In Progress)

- **Application Authentication (Implemented - Milestone 2A)**: Protected by Neon Auth (Managed Better Auth via `@neondatabase/auth`). Unauthenticated visitors are redirected to `/auth/sign-in`.
- **Single-User Owner Bootstrap (Implemented - Milestone 2A)**: Initial account registration flow available at `/auth/sign-up` before permanently locking signups in Neon Console.
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

### Single-User Account Bootstrap & Lockout Procedure

1. **Start Dev Server**:
   ```bash
   npm run dev
   ```
2. **Create Owner Account**:
   Navigate to [http://localhost:3000/auth/sign-up](http://localhost:3000/auth/sign-up) (or click `[ Initial Setup / Create Owner Account ]` from the sign-in screen). Enter your email and password to create the dashboard owner account.
3. **Lock Future Registrations**:
   In your [Neon Console](https://console.neon.tech):
   - Go to **Auth** -> **Email & Password**.
   - Enable **Disable sign-ups** (or via Neon API `PATCH` with `disable_sign_up: true`).
   - This prevents any subsequent registrations while preserving your owner account login.

### Development Scripts

- `npm run dev` — Starts the Next.js development server
- `npm run build` — Builds the application for production
- `npm run start` — Starts the production server
- `npm run lint` — Runs ESLint checks (`eslint .`)
- `npm run typecheck` — Validates TypeScript types (`tsc --noEmit`)

## Documentation

- [ROADMAP.md](file:///Users/eden/Documents/Documents/code/personal-projects/nextjs/daemon-dashboard/ROADMAP.md) — Phased milestone plan and current progress.
- [DECISIONS.md](file:///Users/eden/Documents/Documents/code/personal-projects/nextjs/daemon-dashboard/DECISIONS.md) — Architectural and technical decision records.
- [GEMINI.md](file:///Users/eden/Documents/Documents/code/personal-projects/nextjs/daemon-dashboard/GEMINI.md) — Project guidelines and agent memory.