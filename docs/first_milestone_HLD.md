# High-Level Design (HLD) – Short URL Service (Milestone 1)

## 1. Goal & Scope
The purpose of this milestone is to deliver a minimal yet functional Short URL service.  
**In scope:**
- Create short links (`POST /api/links`)
- Redirect users from short → long URL (`GET /:slug`)
- Basic expiration and deactivation
- Basic rate limiting
- Observability: logs + metrics

**Out of scope (future milestones):**
- Advanced analytics
- Custom domains and custom aliases
- Multi-user accounts and authentication
- Admin dashboard/UI

---

## 2. Non-Functional Requirements (NFRs)
- **Latency (Redirect):** P95 ≤ 50ms (cache hit), ≤ 150ms (cache miss)
- **Availability:** 99.9% (single region)
- **Throughput Target:** ~1–2k RPS for redirects, ≤ 50 RPS for link creation
- **Data volume:** Up to 10M links in database (scale-up)
- **Security:** Input validation, blocklist for domains, rate limiting

---

## 3. Architecture Overview
- **Gateway/Ingress** → routes traffic  
- **Redirect Service** – handles GET `/slug` (read-heavy path)  
- **API Service** – handles link creation and management (write path)  
- **Redis Cache** – slug → target mappings (fast lookups)  
- **PostgreSQL Database** – source of truth for URLs  
- **Observability Stack** – metrics, structured logs, tracing

---

## 4. Components

### Redirect Service
- Endpoint: `GET /:slug`
- Look up slug in Redis (fast path)
- On cache miss → query PostgreSQL, validate, repopulate Redis
- Return HTTP 302 Found with `Location: target_url`

### API Service
- `POST /api/links` – create a new short link
- `GET /api/links/:slug` – retrieve link details
- `PATCH /api/links/:slug` – update expiration/active status
- `DELETE /api/links/:slug` – delete link
- Performs validation + rate limiting

### Redis
- Keys: `s:{slug}` → `{ "u": "<target>", "x": "<expires_at>", "a": true }`
- TTL ~24h + jitter
- Cache policy: only store active + valid links

### PostgreSQL
- Table `urls`
  - `id` (PK)
  - `slug` (unique, indexed)
  - `target_url`
  - `created_at`
  - `expires_at` (nullable)
  - `is_active` (boolean)
  - `created_ip_hash` (optional, for abuse prevention)

---

## 5. Slug Generation
- Random Base62 (length: 7 chars)
- Collision check with `INSERT … ON CONFLICT DO NOTHING`
- Retry max 3 times
- Custom aliases: **not included in milestone 1**

---

## 6. API Specification (MVP)

### Create Link
**POST** `/api/links`  
Request body:
```json
{
  "target_url": "https://example.com/long",
  "expires_at": "2025-12-31T23:59:59Z"
}
