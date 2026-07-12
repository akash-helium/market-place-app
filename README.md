# HarvestHub Backend

Bun + TypeScript + Hono + MySQL/TiDB API for the wholesale grains marketplace.

This repo is **backend-only**. Mobile (`mobile/`) and admin (`admin/`) stay on your machine (gitignored) — push only what is here.

## Quick start

```bash
cp .env.example .env        # fill TiDB/MySQL + JWT_SECRET
bun install
bun run db:migrate
bun run db:seed
bun run dev                 # http://localhost:3000
```

**Demo login (no SMS):** phone `9810817196`, OTP `000000` (`SMS_PROVIDER=console`).

## Deploy (Render free)

1. Push this repo to GitHub  
2. Render → New Web Service → Docker  
3. Copy env from `.env.example` (set `APP_URL`, `DB_*`, `JWT_SECRET`, `SMS_PROVIDER=console`, `OTP_DEV_CODE=000000`)

Health check: `GET /health`

## The whole journey, as API calls

```
1. POST /api/auth/request-otp   {"phone":"9810817196"}        → use OTP 000000 in console mode
2. POST /api/auth/verify-otp    {"phone":"...","code":"000000"} → { token, isNewUser }
3. PUT  /api/shops/me           (Bearer token) shop name, photos, address, note, contacts
4. GET  /api/categories         → home screen tiles with item counts
5. GET  /api/products?categoryId=1&subcategoryId=1&sort=price_desc
6. POST /api/cart/items         {"productId":1,"quantity":3}
7. POST /api/orders/checkout    → order(s) + payment intent
8. POST /api/payments/mock/confirm {"orderId":1}               → order placed, seller gets bell alert
```

## Endpoint reference

### Auth — SMS service + Login keeper
| Method | Path | Notes |
|---|---|---|
| POST | `/api/auth/request-otp` | 30 s resend cooldown, 5 min expiry, hashed codes |
| POST | `/api/auth/verify-otp` | max 5 attempts; returns 30-day JWT + `isNewUser` |
| POST | `/api/auth/logout` | revokes the session (next open asks for SMS again) |
| GET | `/api/auth/me` | session check on app open |

### Shops — Profile keeper, Location, Share link
| Method | Path | Notes |
|---|---|---|
| PUT | `/api/shops/me` | create/edit shop: banner, logo, name, description, address, note for buyers, multiple phones/emails, delivery pincodes |
| GET | `/api/shops/me` | own profile (prefilled edit form) |
| GET | `/api/shops/:idOrSlug` | public seller page: green tick, rating, years on platform, note from seller, contacts with call numbers, full product list |
| GET | `/api/shops/:id/share-link` | shop URL + ready-made WhatsApp link |
| GET | `/api/shops/:id/delivers-to/:pincode` | delivery-area check |

### Catalog — Product list, Search helper, Bulk upload helper
| Method | Path | Notes |
|---|---|---|
| GET | `/api/categories` | 8 tiles with live item counts |
| GET | `/api/categories/:id/subcategories` | e.g. Chitra (15 items), Rajma Lal (3 items) |
| GET | `/api/products` | filters: `categoryId, subcategoryId, shopId, q, sort=price_asc\|price_desc\|newest, page, limit`; `pricePaise: null` renders as N/A |
| GET | `/api/products/:id` | detail card: photos, pack size, MRP, seller name/city/rating/phones |
| POST | `/api/products` | "Add one": up to 4 photo URLs (first is cover), price, MRP, in-stock switch |
| PUT | `/api/products/:id` | edit / stock toggle |
| DELETE | `/api/products/:id` | soft remove |
| GET | `/api/products/bulk/template` | downloadable .xlsx template |
| POST | `/api/products/bulk` | multipart Excel/CSV up to 10 MB, per-row error report |

### Cart & Orders
| Method | Path | Notes |
|---|---|---|
| GET | `/api/cart` | items + total; blocks N/A-price and out-of-stock items at add time |
| POST | `/api/cart/items` · PUT/DELETE `/api/cart/items/:id` | |
| POST | `/api/orders/checkout` | splits cart into one order per shop; creates payment intent(s) |
| GET | `/api/orders` (`?as=seller`) | buyer history or seller order book |
| GET | `/api/orders/:id` | with item snapshots |
| PATCH | `/api/orders/:id/status` | seller: confirmed → dispatched → delivered / cancelled; buyer gets a bell alert |

### Payments
| Method | Path | Notes |
|---|---|---|
| POST | `/api/payments/mock/confirm` | dev-only: simulates capture → order becomes `placed`, stock decremented, seller notified, low-stock alerts fired |
| POST | `/api/payments/webhook` | signature-verified gateway webhook for production |

### Notifications — the bell
| Method | Path | Notes |
|---|---|---|
| GET | `/api/notifications` | typed alerts exactly as in the guide: new order, buyer query, payout credited, N-star review, low stock, pricing tip |
| POST | `/api/notifications/mark-all-read` · PATCH `/api/notifications/:id/read` | |
| POST | `/api/notifications/push-token` | register FCM/APNs token so alerts arrive with the app closed |

### Ratings, Queries (customer chat), KYC, Uploads
| Method | Path | Notes |
|---|---|---|
| GET/POST | `/api/shops/:shopId/reviews` | 1–5 stars; shop `rating_avg` (the 4.8) recomputed transactionally |
| POST | `/api/products/:id/queries` | "Query product" — seller gets a bell alert |
| GET | `/api/queries` / `/api/queries/mine` | seller inbox / buyer's own questions |
| POST | `/api/queries/:id/reply` | buyer gets a bell alert |
| POST | `/api/kyc` · GET `/api/kyc/status` | FSSAI/GSTIN submission |
| POST | `/api/kyc/:id/approve` | grants the green tick (put behind admin auth in prod) |
| POST | `/api/uploads` | multipart image (jpeg/png/webp ≤ 5 MB) → public URL, served at `/uploads/*` |

## Project layout

```
src/
  index.ts            server, route mounting, static /uploads
  config/env.ts       all tunables (OTP TTL, cooldown, limits, providers)
  config/db.ts        mysql2 pool + query/execute/withTransaction helpers
  middleware/auth.ts  JWT + session validation, requireAuth / requireShop
  utils/index.ts      JWT, OTP hashing, phone normalisation (+91), money, slugs
  services/index.ts   SMS, photo storage, payment, notification services (pluggable)
  routes/
    auth.ts           OTP login flow
    shops.ts          profile, public page, share link, delivery areas
    products.ts       categories, browse/search, CRUD, bulk upload + template
    orders.ts         cart, checkout, orders, payments/webhook
    misc.ts           notifications, reviews, queries, KYC, uploads
  db/
    schema.sql        full schema (18 tables), FULLTEXT search indexes
    migrate.ts / seed.ts
```

## Design notes

- **Money is stored in paise** (integer) — never floats. `priceRupees` in/out at the API edge.
- **OTP codes are stored as SHA-256 hashes** with attempt limits, expiry, and resend cooldown.
- **Sessions table backs the JWT** (`jti`), so logout / device change genuinely revokes access.
- **Order items are snapshotted** (title + price at purchase time) so later edits don't rewrite history.
- **Checkout is transactional** and splits multi-seller carts into one order per shop.
- **All responses share one envelope**: `{ ok: true, data } | { ok: false, error }`.
