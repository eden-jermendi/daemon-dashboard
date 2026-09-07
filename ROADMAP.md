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

- [x] **Milestone 5: Magnet / Torrent Workflow**
  - BitTorrent magnet URI validation (BTIH/BTMH info hashes) rejecting malformed inputs locally.
  - Server-side integration with Real-Debrid `POST /torrents/addMagnet`, `GET /torrents/info/{id}`, `POST /torrents/selectFiles/{id}`, and `DELETE /torrents/delete/{id}`.
  - Application-owned normalized torrent model covering `magnet_conversion`, `waiting_files_selection`, `queued`, `downloading`, `processing`, `downloaded`, and terminal error states.
  - Interactive file selection tree with checkboxes, byte formatting, and select all / clear actions.
  - Serverless-friendly bounded polling (3.5s) updating transfer progress, speed, and active seeders without long-lived server connections.
  - Direct integration with Milestone 4 link unrestriction machinery for completed torrent download links.
  - Torrent removal and reset workflow.
  - Comprehensive unit test suite covering validation, normalization, status mapping, file serialization, and error handling.

- [ ] **Milestone 6: Deliberate Stremio Switch Integration Assessment**
  - [x] **Milestone 6A: Torrentio Domain Engine Integration**
    - Pure TypeScript domain engine ported (`src/features/stremio-switch/domain/torrentio/`).
    - Full behavioral test suite ported and passing (`tests/torrentio.test.mjs`).
  - [x] **Milestone 6B: Torrentio ↔ Real-Debrid OAuth Compatibility & Credential Architecture**
    - Proved live upstream compatibility of Real-Debrid OAuth access tokens in `realdebrid=<token>` resolver requests with Real-Debrid CDN redirects.
    - Verified negative control behavior with invalid tokens.
    - Settled unified credential architecture (zero duplicate secret storage, dynamic request-time injection).
    - Established domain helper and server-only credential bridge (`src/features/stremio-switch/server/real-debrid-credential.ts`).
  - [x] **Milestone 6C: Stremio Switch Persistence & Addon Configuration Management**
    - Database migration `003_stremio_provider_configs.sql` for persisting public addon configuration and capability `proxy_id`.
    - Zero duplicate credential storage invariant: strictly stores only non-secret `public_config` (JSONB) and unguessable `proxy_id` (UUID).
    - URL import parsing through domain engine strictly discards any supplied provider credentials.
    - Server repository & service boundary (`src/features/stremio-switch/server/`).
    - Authenticated management API routes (`GET /api/integrations/stremio/providers`, `POST /api/integrations/stremio/providers`, `DELETE /api/integrations/stremio/providers/[id]`) with strict Neon Auth session derivation and SQL ownership enforcement.
    - Automated unit test suite with 12 focused tests covering import sanitization, ownership scoping, upsert behavior, proxy ID format, and public config validation (`tests/stremio-persistence.test.mjs`).
  - [x] **Milestone 6D: Stremio Public Capability Proxy & Stream Resolver Routing**
    - Public Next.js App Router capability endpoints (`/api/stremio/[proxyId]/manifest.json`, `/api/stremio/[proxyId]/stream/[type]/[id]`, `/api/stremio/[proxyId]/resolve/[...resolverPath]`) authenticated solely by unguessable `proxy_id` UUID.
    - Updated `src/proxy.ts` matcher to exclude `/api/stremio` from Neon Auth browser session redirects.
    - Runtime Real-Debrid OAuth token injection into ephemeral upstream Torrentio URLs with zero token persistence, logging, or client exposure.
    - Protocol-aware stream JSON rewriting replacing credential-bearing Torrentio resolver URLs with safe Daemon capability URLs.
    - Safe resolver data model strictly parsing only non-secret components (`infoHash`, `torrentId`, `fileIdx`, `filename`) and failing closed on malformed inputs.
    - Direct Real-Debrid CDN hand-off via HTTP 302 redirects with strict allowlist validation (`*.download.real-debrid.com`, `download.real-debrid.com`) and zero media byte proxying.
    - Torrentio failure video redirect interception converted to normalized safe 503 errors.
    - In-flight token refresh promise coalescing preventing simultaneous refresh race conditions.
    - Comprehensive unit test suite with 31 new tests (total 128 tests passing) and live verification against Real-Debrid and Torrentio upstream.
  - [ ] **Milestone 6E: Stremio Switch Management UI & Addon Installation Workflow**
  
- [ ] **Milestone 7: Modular Design Pattern Refactoring**
  - Analyze current codebase to identify opportunities for modularity improvements.
  - Design a modular architecture that separates concerns and improves maintainability.
  - Improve with dogfooding and agent-driven iterative refactoring.
  
  
