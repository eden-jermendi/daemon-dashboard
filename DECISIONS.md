# Architecture Decision Records (ADRs) & Settled Decisions

This document records the foundational architectural decisions established for **Daemon Dashboard**.

---

### 1. Modular Monolith Architecture
- **Decision**: Build Daemon Dashboard as a Next.js App Router modular monolith.
- **Rationale**: Keeps development velocity high with zero operational overhead for cross-service RPCs, complex deployments, or multi-repo synchronization. Features live under standard modular directories (`src/app/modules/*`, `src/components/*`, `src/features/*`).

### 2. Vercel-Oriented Hosted Web Application Initially
- **Decision**: Deploy and optimize for Vercel / serverless edge hosting first.
- **Rationale**: Prioritizes immediate availability, simplified CI/CD, and fast iteration without premature infrastructure complexity.

### 3. Application Authentication via Current Neon Auth (Managed Better Auth)
- **Decision**: Use **current first-party Neon Auth** (`@neondatabase/auth`) backed by Managed Better Auth, avoiding legacy Stack Auth, Clerk, Auth.js, or custom cookie sessions.
- **Rationale**: Integrates natively with the Neon Postgres database layer, supports branch-aware authentication, and provides Next.js middleware and server component session caching.
- **Boundary**:
  ```text
  User -> Neon Auth -> Daemon Dashboard
  ```

### 4. Single-User Personal Scope
- **Decision**: Design purely for a single user; omit multi-tenant organizations, invitations, team roles, and SaaS billing.
- **Rationale**: Daemon Dashboard is a personal control plane. Over-engineering multi-tenancy adds unnecessary code and security attack surface.

### 5. Real-Debrid Provider Integration via Official Open-Source / Device OAuth
- **Decision**: Authenticate with Real-Debrid using its officially documented **"Workflow for opensource apps"** (`/oauth/v2/device/code`, `/oauth/v2/device/credentials`, `/oauth/v2/token`) using the public open-source client ID `X245A4XAIBGVM` instead of pre-registering a website OAuth callback with manual client secrets.
- **Rationale**: Real-Debrid does not expose a practical self-service web application client registration portal. The open-source device flow generates user-bound client credentials upon user authorization that are safely persisted server-side.
- **Boundary**:
  ```text
  User -> Neon Auth -> Daemon Dashboard (Device Code Flow) -> Real-Debrid Authorization -> Generated User Credentials & Tokens -> Real-Debrid API
  ```

### 6. Strict Server-Side Secret Management
- **Decision**: Provider credentials, generated OAuth client credentials, and refresh/access tokens must remain strictly server-side.
- **Rationale**: Never expose provider secrets, device codes, or credentials to client bundles or browser runtime.

### 7. No Premature Docker or Homelab Infrastructure
- **Decision**: Defer containerization, Dockerfiles, and self-hosted homelab setups until local hardware deployment is explicitly required.
- **Rationale**: Avoids unnecessary devops maintenance during core feature development.

### 8. Ordinary Application Features Over Runtime Plugin Architecture
- **Decision**: Dashboard modules are standard application components and routes, not dynamic runtime plugins or sandboxed extensions.
- **Rationale**: Maintains simplicity, static typing, and direct component reuse without plugin system scaffolding.

### 9. Stremio Switch Remains Independent for Now
- **Decision**: Do not migrate the separate Stremio Switch repository into Daemon Dashboard yet.
- **Rationale**: Stremio Switch already functions independently. Migration will be formally evaluated at Milestone 6 after provider and core capabilities are established.

### 10. Database Persistence via Lightweight Serverless Driver
- **Decision**: Adopt `@neondatabase/serverless` SQL template tagged queries for Neon Postgres persistence without introducing a heavy ORM.
- **Rationale**: Keeps bundle overhead minimal and cold starts low in serverless environments while supporting parameterized SQL queries and schema migrations.

### 11. Application-Side AES-256-GCM Token & Credential Encryption
- **Decision**: Encrypt provider access tokens, refresh tokens, and generated user-bound OAuth client credentials (`client_id`, `client_secret`) at rest in Neon Postgres using native Node.js `crypto` AES-256-GCM authenticated encryption with `PROVIDER_TOKEN_ENCRYPTION_KEY`.
- **Rationale**: Provides defense-in-depth for high-value provider credentials, ensuring no plaintext secrets exist in database columns.

### 12. Documented Device Grant Refresh with User-Bound Credentials
- **Decision**: Refresh access tokens using the stored user-bound client credentials and Real-Debrid's documented device grant (`grant_type=http://oauth.net/grant_type/device/1.0` with `code=<refresh_token>`).
- **Rationale**: Strictly preserves Real-Debrid's provider-specific token endpoint requirements for open-source applications.

### 13. Direct Download URL Control Plane Hand-off
- **Decision**: Daemon Dashboard operates strictly as the control plane for URL verification and link unrestriction. Generated direct download URLs are returned directly to the authenticated client for direct browser download, external opening, or clipboard copy. Daemon never proxies large file bytes, stream chunks, or data plane traffic.
- **Rationale**: Prevents bandwidth exhaustion, latency bottlenecks, memory spikes, and proxy timeout failures on serverless/hosted infrastructure.

### 14. Real-Debrid as Single Source of Truth for Torrent State
- **Decision**: Keep torrent job state and active lifecycle strictly on Real-Debrid. Do not duplicate active or completed torrent records into a PostgreSQL database table.
- **Rationale**: Real-Debrid is the authoritative state machine for metadata resolution, DHT peer swarms, caching, and link generation. Persisting transient torrent jobs in PostgreSQL adds unnecessary schema complexity, synchronization edge cases, and state divergence risks without providing operational value for a single-user control plane.

### 15. Stremio Switch Unified Real-Debrid OAuth & Dynamic Credential Injection
- **Decision**: Stremio Switch integration in Daemon Dashboard reuses the existing Real-Debrid OAuth connection (`getValidRealDebridAccessToken(userId)`). Future Stremio provider persistence will store only public addon configuration, ownership, and proxy capability metadata—with zero duplicate Real-Debrid secret persistence. Upstream Torrentio URLs are dynamically constructed at request time with the user's fresh OAuth access token.
- **Rationale**: Live interoperability testing in Milestone 6B proved conclusively that upstream Torrentio accepts Real-Debrid OAuth Bearer access tokens directly in `realdebrid=<token>` and resolves streams directly to Real-Debrid CDN endpoints (`*.download.real-debrid.com`). Reusing the existing OAuth lifecycle avoids duplicate credential storage, eliminates manual API key copying, leverages automatic token refresh, and preserves strict single-credential management.

### 16. Non-Blocking Provider Telemetry & Request-Scoped Database Memoization
- **Decision**: External provider telemetry (e.g., live Real-Debrid account status, tier, expiration) must not block the rendering or navigation of module control surfaces. Module shells, navigation links, and operational controls render immediately from local connection status, while live provider telemetry streams independently behind React Suspense boundaries. Provider database queries within a single render pass are deduplicated using React's request-scoped `cache()`.
- **Rationale**: External third-party provider APIs (such as Real-Debrid servers in France) introduce significant WAN latency (~1.6s from Oceania/APAC) that degrades navigation when placed on the critical SSR path. Isolating provider I/O behind streaming ensures near-instant route transitions while retaining full live telemetry and strict server-side credential isolation without layout shifts.

### 17. Stremio Provider Configuration Persistence & Public Configuration Storage
- **Decision**: Stremio provider configurations in `stremio_provider_configs` persist strictly public, non-sensitive options (`public_config` JSONB) and an unguessable capability identifier (`proxy_id` UUID). Stremio configurations must NEVER store Real-Debrid API tokens, OAuth secrets, or credential-bearing URLs. Credential injection occurs purely at runtime using Daemon's existing Real-Debrid OAuth subsystem (`getTorrentioRealDebridCredential(userId)`). When users import an existing configured Torrentio URL, the domain parser extracts `publicConfig` and immediately discards any supplied credential.
- **Rationale**: Prevents duplicate secret storage, eliminates desynchronization when OAuth tokens refresh, and avoids credential leakage in configuration management endpoints or database backups.

### 18. Mandatory Protocol-Aware Stream URL Rewriting in Public Proxy
- **Decision**: Daemon must NOT transparently forward Torrentio stream response JSON to Stremio clients. Upstream Torrentio responses embed direct resolver URLs shaped like `/resolve/realdebrid/<OAUTH_TOKEN>/...`. The Daemon proxy must rewrite those resolver URLs into Daemon-owned capability URLs (`/api/stremio/[proxy_id]/resolve/...`) before returning them to Stremio.
- **Rationale**: Torrentio stream responses embed the Bearer token directly in stream URLs. If Daemon forward-proxied those JSON responses transparently, the user's OAuth access token would be exposed to Stremio clients, add-on sync logs, and external players. Protocol-aware rewriting keeps the provider token strictly server-side.

### 19. Secure Stremio Capability Proxy & Stream Resolver Architecture
- **Decision**: Public Stremio capability endpoints (`/api/stremio/[proxyId]/manifest.json`, `/api/stremio/[proxyId]/stream/[type]/[id]`, `/api/stremio/[proxyId]/resolve/[...resolverPath]`) authenticate solely by possession of the unguessable `proxy_id` UUID, bypassing Neon Auth browser session checks in Next.js proxy matcher. Real-Debrid OAuth tokens are injected ephemerally into server memory for upstream Torrentio calls and never returned to clients, persisted, or logged. Upstream stream resolver URLs are rewritten into safe Daemon capability paths retaining only non-secret components (`infoHash`, `torrentId`, `fileIdx`, optional `filename`). Stream resolution requests are validated and relayed as HTTP 302 redirects strictly to allowlisted Real-Debrid CDN hosts (`*.download.real-debrid.com`, `download.real-debrid.com`), while Torrentio failure videos are intercepted as safe 503 responses. Simultaneous token refresh operations for the same user are coalesced in-process.
- **Rationale**: Completely isolates provider OAuth credentials from external Stremio clients, add-on sync logs, and external players while supporting direct CDN streaming with zero media byte proxying through Daemon.

### 20. Hash-Only Stremio Public Capability Tokens & Rotation
- **Decision**: Stremio public capability tokens are high-entropy bearer tokens stored only as cryptographic hashes. Plaintext capabilities are displayed only at creation/rotation and cannot be recovered from the database.
- **Rationale**:
  - **Database Compromise Protection**: A database leak, accidental SQL inspection, AI-assisted database exploration, logging anomaly, or database backup exposure alone must not provide a usable Stremio capability. Storing only the lowercase hex `SHA-256` digest of 256 bits of cryptographically secure random bytes (`crypto.randomBytes(32)` as URL-safe `st_<base64url>`) prevents token recovery from persisted records.
  - **One-Time Display Tradeoff**: Plaintext tokens exist strictly in transient request memory during initial generation or rotation. The database never persists the plaintext token or an invertible encrypted ciphertext. If a user loses their token or suspects compromise, they must rotate the capability rather than read it from the database.
  - **Rotation & Revocation**: Rotation atomically updates the stored `capability_hash` to a new digest and sets a non-secret hint (`st_xxxx...yyyy`), immediately invalidating the previous capability. Revocation sets `capability_hash` to `null`. Any request presenting an old, revoked, malformed, or nonexistent capability fails closed with a generic `404 Not Found` ("Unknown addon capability.") without revealing whether the token format was valid or previously existed.
