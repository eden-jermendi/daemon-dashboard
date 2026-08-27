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

- [x] **Milestone 3: Real-Debrid Connection & Account Status**
  - Authenticated server integration with official `GET /rest/1.0/user`.
  - Application-owned normalized account model (username, account tier, expiration, remaining time, fidelity points).
  - Defensive response validation omitting private provider details.
  - Live glanceable account status and countdown on Home Dashboard Real-Debrid tile.
  - Dedicated account overview grid and external portal link on Real-Debrid module page.

- [x] **Milestone 4: URL Checking & Link Unrestriction**
  - Authenticated server integration with official `POST /rest/1.0/unrestrict/check` and `POST /rest/1.0/unrestrict/link`.
  - Strict server-only provider boundary; no direct host fetching, SSRF, or large file byte proxying through Daemon Dashboard.
  - Ephemeral host password support without persistence or logging.
  - Application-owned normalized models for link checks and multi-result unrestricted downloads.
  - Interactive utilitarian Link Tool in `/modules/real-debrid` with status indicators, byte formatting, direct URL copy, and safe external open.
  - Comprehensive automated test suite for URL validation, byte formatting, check/unrestrict normalization, and error handling.

- [ ] **Milestone 5: Magnet / Torrent Workflow**
  - Real-Debrid torrent ingestion, progress tracking, and file selection.
  - Torrent download/stream orchestrator within the Real-Debrid module.

- [ ] **Milestone 6: Deliberate Stremio Switch Integration Assessment**
  - Evaluate Stremio Switch multi-profile capabilities for direct integration or unified control.
