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

- [ ] **Milestone 2: Neon Auth Single-User Access Boundary & Real-Debrid OAuth Foundation**
  - Establish Neon Auth application login flow for single-user control plane.
  - Scaffold server-side Real-Debrid OAuth2 web flow (credentials and token storage).
  - Secure dashboard routes behind the Neon Auth session boundary.

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
