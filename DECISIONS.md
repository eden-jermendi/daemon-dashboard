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
