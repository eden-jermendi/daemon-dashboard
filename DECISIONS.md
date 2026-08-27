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

### 5. Real-Debrid Provider Integration via OAuth2 Web Flow
- **Decision**: Authenticate with Real-Debrid using its official OAuth2 web flow instead of manual long-lived private API tokens.
- **Rationale**: Provides standards-compliant authorization, refresh token rotation, and safer credential management.
- **Boundary**:
  ```text
  User -> Neon Auth -> Daemon Dashboard Backend -> Real-Debrid OAuth2 Credentials -> Real-Debrid API
  ```

### 6. Strict Server-Side Secret Management
- **Decision**: Provider credentials, OAuth client secrets, and refresh/access tokens must remain strictly server-side.
- **Rationale**: Never expose provider secrets or credentials to client bundles or browser runtime.

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

### 11. Application-Side AES-256-GCM Token Encryption
- **Decision**: Encrypt provider access and refresh tokens at rest in Neon Postgres using native Node.js `crypto` AES-256-GCM authenticated encryption with a dedicated `PROVIDER_TOKEN_ENCRYPTION_KEY`.
- **Rationale**: Provides defense-in-depth for high-value provider credentials, ensuring tokens are never stored in plaintext within database columns.

### 12. Provider-Specific Real-Debrid Refresh Grant Implementation
- **Decision**: Implement the official Real-Debrid documented refresh grant (`http://oauth.net/grant_type/device/1.0` with `code=<refresh_token>`) rather than standard generic `grant_type=refresh_token`.
- **Rationale**: Real-Debrid's token endpoint strictly enforces this non-standard device grant for refreshing website and application credentials.
