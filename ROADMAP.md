# Roadmap

This roadmap tracks the development milestones of **Daemon Dashboard**. Only completed work is marked as complete.

- [x] **Milestone 1: Dashboard Foundation**
  - Establish Next.js App Router + TypeScript modular monolith.
  - Implement utilitarian system administration design system with CSS Modules.
  - Create the home dashboard grid (`DAEMON DASHBOARD` / `SYSTEM: ONLINE`).
  - Create reusable module tile primitive with varying dimensions.
  - Create placeholder Real-Debrid module tile and dedicated `/modules/real-debrid` page.
  - Create Stremio Switch and generic future module placeholders.
  - Document architectural decisions, project roadmap, and development guidelines.

- [x] **Milestone 2: Security & Provider Authentication Boundary**
  - [x] **Milestone 2A: Neon Auth Application Access Boundary**
    - Integrate current first-party Neon Auth (Managed Better Auth via `@neondatabase/auth`).
    - Protect `/` and `/modules/*` routes with Next.js proxy and server session checks.
    - Implement utilitarian restricted access & sign-in screen at `/auth/sign-in`.
    - Implement header session status and sign-out control.
  - [x] **Milestone 2B: Real-Debrid Open-Source Device OAuth Connection**
    - Server-side open-source device OAuth flow (`/device/code`, `/device/credentials`, `/token`) using public client ID `X245A4XAIBGVM`.
    - Interactive UI with user code display, copy helper, countdown, and cancellation.
    - Serverless polling architecture with encrypted HttpOnly device code cookies.
    - AES-256-GCM encryption for generated user-bound credentials and tokens in Neon Postgres.
    - Automatic token refresh with stored generated credentials and documented device grant.
    - Real-Debrid connection lifecycle toggle in `/modules/real-debrid`.

- [ ] **Milestone 3: Real-Debrid Connection & Account Status**
  - Connect to Real-Debrid API endpoints via server actions/routes.
  - Display real-time account status, expiration time, points, and connection health on the Real-Debrid module.

- [ ] **Milestone 4: URL Checking & Link Unrestriction**
  - Implement link verification and debrid unrestrict engine.
  - Direct unrestricted download link generator with streaming playback options.

- [ ] **Milestone 5: Magnet / Torrent Workflow**
  - Real-Debrid torrent ingestion, progress tracking, and file selection.
  - Torrent download/stream orchestrator within the Real-Debrid module.

- [ ] **Milestone 6: Deliberate Stremio Switch Integration Assessment**
  - Evaluate Stremio Switch multi-profile capabilities for direct integration or unified control.
