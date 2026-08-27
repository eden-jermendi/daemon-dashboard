# Architecture Decision Records (ADRs) & Settled Decisions

This document records the foundational architectural decisions established for **Daemon Dashboard**.

---

### 1. Modular Monolith Architecture
- **Decision**: Build Daemon Dashboard as a Next.js App Router modular monolith.
- **Rationale**: Keeps development velocity high with zero operational overhead for cross-service RPCs, complex deployments, or multi-repo synchronization. Features live under standard modular directories (`src/app/modules/*`, `src/components/*`, `src/features/*`).

### 2. Vercel-Oriented Hosted Web Application Initially
- **Decision**: Deploy and optimize for Vercel / serverless edge hosting first.
- **Rationale**: Prioritizes immediate availability, simplified CI/CD, and fast iteration without premature infrastructure complexity.

### 3. Application Authentication via Neon Auth
- **Decision**: Use **Neon Auth** for application-level authentication.
- **Rationale**: Integrates natively with the Postgres database layer and provides managed auth sessions for the single-user control plane.
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

### 10. Database Persistence Introduced on Actual Requirement
- **Decision**: Defer Neon / PostgreSQL schema configuration until persistent state (Neon Auth / OAuth tokens) is actively required in Milestone 2.
- **Rationale**: Avoids maintaining empty migrations or idle database schemas before functional requirements demand them.
