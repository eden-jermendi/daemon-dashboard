# Daemon Dashboard

Daemon Dashboard is a modular personal dashboard and control plane for services, media tooling, integrations, experiments, and personal infrastructure.

## Current Status

**Milestone 1: Dashboard Foundation** (Active / Initial Shell)

The project is currently an initial application shell providing the modular control panel layout, module primitives, and placeholder pages. No external integrations or databases are active yet.

- **Real-Debrid**: The first planned functional integration module. Dedicated route and UI shell established (`/modules/real-debrid`).
- **Stremio Switch**: Remains an independent external service for now; integration will be evaluated in a later milestone.
- **Application Authentication**: Neon Auth is the planned authentication mechanism (to be introduced in Milestone 2).
- **Provider Authentication**: Real-Debrid will integrate via its official OAuth2 web flow with server-side token management.

## Tech Stack

- **Framework**: [Next.js](https://nextjs.org/) (App Router, React 19)
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **Styling**: Pure CSS / CSS Modules (Utilitarian systems aesthetic)
- **Code Quality**: ESLint

## Getting Started

### Prerequisites

- Node.js 20+ (Node.js 24 recommended)
- npm

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
- `npm run lint` — Runs ESLint checks
- `npm run typecheck` — Validates TypeScript types (`tsc --noEmit`)

## Documentation

- [ROADMAP.md](file:///Users/eden/Documents/Documents/code/personal-projects/nextjs/daemon-dashboard/ROADMAP.md) — Phased milestone plan and current progress.
- [DECISIONS.md](file:///Users/eden/Documents/Documents/code/personal-projects/nextjs/daemon-dashboard/DECISIONS.md) — Architectural and technical decision records.
- [GEMINI.md](file:///Users/eden/Documents/Documents/code/personal-projects/nextjs/daemon-dashboard/GEMINI.md) — Project guidelines and agent memory.