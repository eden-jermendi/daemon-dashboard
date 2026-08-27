# Daemon Dashboard — Project Instructions & AI Guidelines

## Communication & Formatting
- **Communication Style**: Direct and forward. Be less conversational and more to-the-point.
- **Date Format**: `DD-MM-YYYY` (e.g., 27-08-2026).
- **Code Edits & Tests**: Do not edit existing code or run tests unless explicitly requested.

## Git & Version Control Workflow
- **Push Policy**: **ALWAYS check with the user before pushing to remote (`git push`). Never push automatically without explicit confirmation.**
- **Remotes**: Local git repository is connected to upstream `git@github.com:eden-jermendi/daemon-dashboard.git`.
- **Commit Conventions**: Use conventional commits (e.g., `feat: ...`, `fix: ...`, `refactor: ...`, `docs: ...`).

## Architecture & Project Boundaries
- **Core Stack**: Next.js (App Router), React 19, TypeScript, ESLint, `src/` directory layout.
- **Styling**: Pure CSS / CSS Modules with a utilitarian systems-administration aesthetic. Avoid Tailwind or heavy UI frameworks unless explicitly requested.
- **Modular Monolith**: Features and modules live in standard application directories (`src/app/modules/*`, `src/components/*`, `src/features/*`). No dynamic runtime plugin frameworks.
- **Single-User Scope**: Personal dashboard for a single user. Do not introduce multi-tenant organizations, invitations, team roles, or billing.
- **Application Auth**: **Neon Auth** is the designated auth layer (Milestone 2+).
- **Provider Auth (Real-Debrid)**: **OAuth2 Web Flow** (Milestone 2/3+). All client secrets, access tokens, and refresh tokens must remain strictly server-side.
- **Stremio Switch**: Remains in its separate repository until explicit Milestone 6 integration evaluation. Do not migrate code prematurely.
- **No Premature Infrastructure**: No Docker, no Redis, no background queues/microservices, and no database scaffolding before active functional requirements.
