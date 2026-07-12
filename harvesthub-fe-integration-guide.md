# HarvestHub — Frontend Integration Guide

**API version:** 1.0.0 · **Base URL (dev):** `http://localhost:3000` · **All app endpoints are under** `/api`

This document tells the mobile/web frontend team exactly which API to call on every screen of the app, with request/response examples. Screen numbers (4.1, 4.2 …) match the "App Flow — Simple Guide" document.

---

## 1. Conventions

### 1.1 Response envelope
Every endpoint returns the same shape. Branch on `ok`:

```json
// Success
{ "ok": true, "data": { ... } }

// Failure — show `error` to the user as-is (messages are user-friendly)
{ "ok": false, "error": "That code is not correct" }
```

Validation failures may also include a `details` object (zod field errors) for inline form highlighting.

### 1.2 HTTP status codes
| Code | Meaning | Frontend action |
|---|---|---|
| 200 / 201 | Success | Use `data` |
| 400 | Bad input | Show `error`, highlight fields from `details` |
| 401 | No/expired token | Clear stored token → go to Phone Number screen (4.1) |
| 403 | Not allowed (e.g. no shop yet) | Route to the missing step (e.g. shop setup 4.3) |
| 404 | Not found | Show empty/error state |
| 409 | Conflict (out of stock, N/A price) | Show `error`, keep user on screen |
| 413 / 415 | File too large / wrong type | Show `error` |
| 429 | Rate limited (OTP cooldown/attempts) | Show `error`, keep Resend timer running |
| 500 | Server error | Generic "something went wrong" + retry |

### 1.3 Authentication header
After login, send on every authenticated call:

```
Authorization: Bearer <token>
```

- The token lasts **30 days** — store it in secure storage (Keychain / EncryptedSharedPreferences). This is what makes "every other day" open straight to Home.
- Any `401` at any time means the session is gone (logout elsewhere, expiry) → wipe the token and return to screen 4.1.

### 1.4 Money
All amounts travel as **integer paise** in fields named `*Paise` (e.g. `pricePaise: 1260000` = ₹12,600).
- **Display:** `₹` + Indian grouping → `(pricePaise / 100).toLocaleString('en-IN')`
- **Sending:** product create/edit accepts `priceRupees` / `mrpRupees` as plain numbers (rupees) — the backend converts.
- **`pricePaise: null` ⇒ render "N/A"** and show the "please ring the seller" hint (screen 4.7). The Add-to-cart button must be disabled for these items (the API also rejects with 409).

### 1.5 Phone numbers
Send whatever the user types; the backend normalises. A bare 10-digit number is assumed Indian and becomes `+91XXXXXXXXXX` (matches the +91 default on screen 4.1). Responses always return E.164 (`+919810817196`).

### 1.6 Dates
All timestamps are ISO-8601 UTC (`2026-07-08T16:07:44.000Z`). Convert to local time on device.

### 1.7 Images
Upload first, then reference by URL (see §9). Product photos: max 4, first = cover.

---

## 2. App launch — routing decision

The very first diamond in the flow ("Have you logged in before?"):

```
token in storage?
  no  → Phone Number screen (4.1)
  yes → GET /api/auth/me
          200 → data.onboarded ? Home (4.5) : Shop Setup (4.3)
          401 → clear token → Phone Number screen (4.1)
```

`GET /api/auth/me` →
```json
{ "ok": true, "data": { "id": 1, "phone": "+919810817196", "onboarded": true, "shopId": 1 } }
```

---

## 3. Login flow (screens 4.1 → 4.2 → 4.3)

### 4.1 Phone Number screen
**`POST /api/auth/request-otp`**
```json
// request
{ "phone": "9810817196" }

// 200
{ "ok": true, "data": { "phone": "+919810817196", "resendAfterSeconds": 30, "expiresInSeconds": 300 } }
```
- Start the **Resend countdown** from `resendAfterSeconds` (30 s). Tapping Resend calls the same endpoint again; a 429 means the cooldown hasn't elapsed — keep the timer visible.
- Disable Continue until the field has ≥ 10 digits.

### 4.2 6-Number Code screen
**`POST /api/auth/verify-otp`**
```json
// request
{ "phone": "9810817196", "code": "482915" }

// 200
{
  "ok": true,
  "data": {
    "token": "eyJhbGciOi...",
    "isNewUser": true,
    "userId": 1,
    "phone": "+919810817196"
  }
}
```
- Save `token`.
- **`isNewUser: true` → Shop Setup (4.3, "STEP 2 OF 2"). `false` → Home (4.5).**
- Errors to surface inline: `"That code is not correct"` (400), `"Code expired — tap Resend for a new one"` (400), `"Too many wrong tries — request a new code"` (429).
- Auto-submit when 6 digits are filled.

### Logout
**`POST /api/auth/logout`** (Bearer) → then wipe local token. Next open will ask for the SMS code again, as the guide promises.

---

## 4. Shop profile (screens 4.3, 4.4, 4.9)

### 4.3 Set Up Your Shop / 4.4 Edit profile — same endpoint
**`PUT /api/shops/me`** (Bearer) — idempotent; creates the shop the first time, updates after.

```json
{
  "name": "Rajat & Company Commodities Pvt Ltd",
  "description": "Wholesale supplier of premium pulses, dals and besan since 2014...",
  "bannerUrl": "http://localhost:3000/uploads/1751990000-abc.jpg",
  "logoUrl": "http://localhost:3000/uploads/1751990001-def.jpg",
  "addressLine": "Naya Bazar",
  "city": "Delhi",
  "pincode": "110006",
  "noteForBuyers": "After order confirmation, goods must be outward within 2 days only. ...",
  "contacts": [
    { "kind": "phone", "value": "+919810817196", "label": "Ratan" },
    { "kind": "phone", "value": "+917665899003", "label": "Sanjay" },
    { "kind": "email", "value": "orders@rajatco.in" }
  ],
  "deliveryPincodes": ["110006", "302001"]
}
```
→ `{ "ok": true, "data": { "shopId": 1, "message": "Shop saved" } }`

Notes:
- Upload banner/logo via §9 first, then pass the URLs. All fields except `name` are optional — the "Skip" button can submit name-only.
- `contacts` and `deliveryPincodes` are **full replacements** — always send the complete lists when editing.
- For the prefilled edit form (4.4), load **`GET /api/shops/me`** (same shape as the public page below).

### 4.9 The Shop's Full Page (public seller profile)
**`GET /api/shops/:idOrSlug`** — no auth needed. Accepts numeric id or slug (from share links).

```json
{
  "ok": true,
  "data": {
    "id": 1,
    "slug": "rajat-company-commodities-pvt-ltd-yehc2",
    "name": "Rajat & Company Commodities Pvt Ltd",
    "description": "Wholesale supplier of premium pulses...",
    "bannerUrl": null, "logoUrl": null,
    "addressLine": "Naya Bazar", "city": "Delhi", "pincode": "110006",
    "noteForBuyers": "After order confirmation, goods must be outward within 2 days only.",
    "isVerified": 1,
    "ratingAvg": "5.0", "ratingCount": 1,
    "yearsOnPlatform": 0,
    "createdAt": "2026-07-08T16:05:58.000Z",
    "contacts": [ { "kind": "phone", "value": "+919810817196", "label": "Ratan" } ],
    "products": [
      { "id": 1, "title": "Chitra Pila Badshah", "packSize": "30 kg",
        "pricePaise": 1260000, "inStock": 1, "category": "Rajma",
        "subcategory": "Chitra", "coverUrl": null }
    ],
    "productCount": 1
  }
}
```
UI mapping: `isVerified` → green tick · `ratingAvg` → star badge · `yearsOnPlatform` → "12 yrs on platform" chip · `noteForBuyers` → yellow "Note from seller" box · each phone contact → row with a **Call** button (`tel:` link) · `products` → the shop's product grid.

### Share link (WhatsApp)
**`GET /api/shops/:id/share-link`**
```json
{ "ok": true, "data": {
  "url": "http://localhost:3000/shop/rajat-company-commodities-pvt-ltd-yehc2",
  "whatsapp": "https://wa.me/?text=Rajat%20%26%20Company..." } }
```
Open `whatsapp` directly, or feed `url` into the native share sheet.

### Delivery-area check (Location service)
**`GET /api/shops/:id/delivers-to/:pincode`** → `{ "ok": true, "data": { "delivers": true } }`
Call before checkout with the buyer's pincode; if `false`, warn the buyer. A shop with no configured areas returns `delivers: true` with a `note`.

---

## 5. Browsing & buying (screens 4.5 → 4.8)

### 4.5 Home screen — category tiles
**`GET /api/categories`** — no auth needed.
```json
{ "ok": true, "data": { "categories": [
  { "id": 1, "name": "Rajma", "tagline": "Chitra, Lal varieties", "iconUrl": null, "itemCount": 18 },
  { "id": 2, "name": "Kabli", "tagline": "Garbanzo, Balay Balay", "iconUrl": null, "itemCount": 12 }
], "count": 8 } }
```
Render each tile with `name`, `tagline` and the "`itemCount` items" chip.
For the bell badge on the tab bar, use `unread` from `GET /api/notifications` (§7).

### 4.6 Picking a type — subcategory rail
**`GET /api/categories/:id/subcategories`**
```json
{ "ok": true, "data": { "subcategories": [
  { "id": 1, "name": "Chitra", "itemCount": 15 },
  { "id": 2, "name": "Rajma Lal", "itemCount": 3 }
] } }
```

### 4.7 Product list with prices
**`GET /api/products`** — query params, all optional:

| Param | Example | Notes |
|---|---|---|
| `categoryId` | `1` | tile tapped |
| `subcategoryId` | `1` | sub-type tapped |
| `q` | `chitra` | the search box (works alone for global search) |
| `sort` | `price_asc` \| `price_desc` \| `newest` | the "Sort" dropdown; default newest |
| `shopId` | `1` | a shop's own list |
| `page`, `limit` | `1`, `20` | max limit 50 |

```json
{ "ok": true, "data": { "products": [
  { "id": 1, "title": "Chitra Pila Badshah", "packSize": "30 kg",
    "pricePaise": 1260000, "inStock": 1, "shopId": 1,
    "category": "Rajma", "subcategory": "Chitra",
    "shopName": "Rajat & Company Commodities Pvt Ltd",
    "shopCity": "Delhi", "shopRating": "5.0", "coverUrl": null }
], "page": 1, "limit": 20 } }
```
Pagination: request the next `page` when the list scrolls near the end; stop when a page returns fewer than `limit` items. **`pricePaise: null` → show "N/A"** per §1.4.

### 4.8 Product detail card (bottom sheet)
**`GET /api/products/:id`**
```json
{ "ok": true, "data": {
  "id": 1, "title": "Chitra Pila Badshah",
  "description": "Premium quality, direct godown",
  "packSize": "30 kg", "pricePaise": 1260000, "mrpPaise": null,
  "inStock": 1, "stockUnits": 37,
  "categoryId": 1, "category": "Rajma", "subcategoryId": 1, "subcategory": "Chitra",
  "shopId": 1, "shopName": "Rajat & Company Commodities Pvt Ltd",
  "shopCity": "Delhi", "shopRating": "5.0", "shopVerified": 1,
  "shopSlug": "rajat-company-commodities-pvt-ltd-yehc2",
  "photos": [ { "url": "...", "isCover": 1, "position": 0 } ],
  "sellerPhones": [ { "value": "+919810817196", "label": "Ratan" } ]
} }
```
UI mapping: header line = `CATEGORY · SUBCATEGORY · title` · green **Call** button → `tel:` first `sellerPhones` entry · seller row tap → shop page via `shopId`/`shopSlug` · **Query product** button → §8 · **Add to cart** button → below.

---

## 6. Cart, checkout & payment

All cart/order endpoints require Bearer auth.

### Cart
**`GET /api/cart`**
```json
{ "ok": true, "data": {
  "items": [ { "id": 1, "quantity": 3, "productId": 1, "title": "Chitra Pila Badshah",
               "packSize": "30 kg", "pricePaise": 1260000, "inStock": 1,
               "shopId": 1, "shopName": "Rajat & Company...", "coverUrl": null } ],
  "totalPaise": 3780000, "totalDisplay": "₹37,800" } }
```
Group items by `shopName` in the UI — checkout creates **one order per shop**.

**`POST /api/cart/items`** `{ "productId": 1, "quantity": 3 }` — adding the same product again **adds to** the quantity. 409s to handle: out of stock, price N/A.
**`PUT /api/cart/items/:id`** `{ "quantity": 5 }` — set absolute quantity (steppers).
**`DELETE /api/cart/items/:id`** — remove row.

### Checkout ("Tap Add to Cart and pay")
**`POST /api/orders/checkout`**
```json
// request
{ "deliveryAddress": "MI Road, Jaipur", "deliveryPincode": "302001" }

// 201
{ "ok": true, "data": {
  "orders": [ { "orderId": 1, "orderNumber": "#734062", "shopId": 1,
                "totalPaise": 3780000, "itemsCount": 1 } ],
  "payments": [ { "orderId": 1, "orderNumber": "#734062", "provider": "mock",
                  "providerRef": "mock_1_1783526796070", "amountPaise": 3780000,
                  "clientPayload": { } } ] } }
```
- The cart is emptied on success. A 409 names the exact item that's no longer orderable — remove it and let the user retry.
- Orders start as `pending_payment`. For each entry in `payments`, open the payment flow:
  - **Dev (mock provider):** `POST /api/payments/mock/confirm` `{ "orderId": 1 }` → order becomes `placed` → show the "Order placed — done" screen.
  - **Prod (real gateway):** use `providerRef` + `clientPayload` to open the gateway SDK's payment sheet; the backend webhook flips the order to `placed`. After the sheet closes, poll `GET /api/orders/:id` until `status` leaves `pending_payment`.

### Order history & tracking
**`GET /api/orders`** — buyer's orders. **`GET /api/orders?as=seller`** — the shop's order book (403 if no shop).
```json
{ "ok": true, "data": { "orders": [
  { "id": 1, "orderNumber": "#734062", "status": "confirmed", "itemsCount": 1,
    "totalPaise": 3780000, "createdAt": "2026-07-08T16:06:36.000Z",
    "shopName": "Rajat & Company...", "buyerPhone": "+917665899003" } ] } }
```
**`GET /api/orders/:id`** — full detail incl. `items` (title/price snapshots) and delivery fields.

**Status lifecycle** (drive the tracker UI):
`pending_payment → placed → confirmed → dispatched → delivered` (or `cancelled`).
Seller advances it with **`PATCH /api/orders/:id/status`** `{ "status": "confirmed" }` — the buyer automatically receives a bell notification.

---

## 7. Notifications — the bell (screen 4.11)

**`GET /api/notifications`** (Bearer)
```json
{ "ok": true, "data": { "notifications": [
  { "id": 1, "type": "order", "title": "New order received",
    "body": "Order #734062 · 1 items · ₹37,800",
    "data": { "orderId": 1 }, "isRead": 0,
    "createdAt": "2026-07-08T16:06:41.000Z" }
], "unread": 1 } }
```

| `type` | Icon in guide | Deep link via `data` |
|---|---|---|
| `order` | cart | `orderId` → order detail |
| `query` | speech bubble | `queryId`, `productId` → query thread |
| `payout` | ₹ circle | — |
| `review` | star | — (open own shop page) |
| `low_stock` | box | `productId` → edit product |
| `pricing_tip` | info | `productId` |
| `system` | info | — |

- `unread` → red dot / count on the bell tab. Group rows into TODAY / THIS WEEK client-side using `createdAt`.
- **"Mark all read"** → `POST /api/notifications/mark-all-read`. Single row → `PATCH /api/notifications/:id/read` when tapped.
- **Push:** on login and on FCM/APNs token refresh, register the device:
  `POST /api/notifications/push-token` `{ "token": "<fcm-token>", "platform": "android" }`.

---

## 8. Query product & seller inbox (customer chat)

**Buyer asks (the "Query product" button, 4.8):**
`POST /api/products/:productId/queries` `{ "question": "What is the bulk price for 100 bags?" }`
→ `{ "ok": true, "data": { "queryId": 1, "message": "Question sent to the seller" } }`

**Buyer's own questions:** `GET /api/queries/mine` — shows `reply`/`repliedAt` (null until answered).

**Seller inbox:** `GET /api/queries` (requires shop)
```json
{ "ok": true, "data": { "queries": [
  { "id": 1, "question": "What is the bulk price for 100 bags?", "reply": null,
    "repliedAt": null, "createdAt": "...", "productId": 1,
    "productTitle": "Chitra Pila Badshah", "buyerPhone": "+917665899003" } ] } }
```
**Seller replies:** `POST /api/queries/:id/reply` `{ "reply": "₹12,400 per bag for 100+" }` — buyer gets a bell alert automatically.

---

## 9. Image upload (Photo storage)

**`POST /api/uploads`** (Bearer) — `multipart/form-data`, field name **`file`**. JPEG/PNG/WebP, ≤ 5 MB.

```
→ 201 { "ok": true, "data": { "url": "http://localhost:3000/uploads/1751990000-abc12345.jpg" } }
```

Flow for any image in the app (shop banner/logo, product photos):
1. User picks image → compress client-side to keep under 5 MB.
2. `POST /api/uploads` → get `url`.
3. Pass `url` in the subsequent JSON call (`bannerUrl`, `photoUrls[]`, `docFileUrl`).

Errors: 415 wrong type, 413 too large — show `error` next to the picker.

---

## 10. Selling (screen 4.10)

### "Add one"
**`POST /api/products`** (Bearer, requires shop — a 403 here means route the user to shop setup)
```json
{
  "categoryId": 1,
  "subcategoryId": 1,
  "title": "Premium Aged Basmati",
  "description": "Quality, origin, packaging, shelf life...",
  "packSize": "30 kg",
  "priceRupees": 12600,
  "mrpRupees": 13000,
  "inStock": true,
  "stockUnits": 40,
  "photoUrls": ["<upload url 1>", "<upload url 2>"]
}
```
→ 201 `{ "ok": true, "data": { "productId": 12, "message": "Your product is now live" } }` — show this as the success screen text.

- Populate the Category/Subcategory dropdowns from §5 endpoints.
- Omit `priceRupees` to list with price "N/A".
- First `photoUrls` entry becomes the cover (the MAIN badge).
- **Edit:** `PUT /api/products/:id` with any subset of the same fields (send `photoUrls` in full to replace photos; `inStock` drives the stock switch). **Remove:** `DELETE /api/products/:id`.

### "Bulk upload"
1. **Template download:** `GET /api/products/bulk/template` → binary `.xlsx` (columns: `category, subcategory, title, description, pack_size, price_rupees, mrp_rupees, in_stock, stock_units`). Save/open with the device's file handler.
2. **Upload:** `POST /api/products/bulk` — `multipart/form-data`, field **`file`**, Excel or CSV ≤ 10 MB.
```json
{ "ok": true, "data": { "totalRows": 20, "listed": 18, "failed": 2,
  "errors": [ { "row": 5, "error": "Unknown category \"Rajmaa\"" },
              { "row": 9, "error": "Missing product title" } ] } }
```
Show a summary ("18 of 20 listed") and render `errors` as a fix-list (row numbers match the spreadsheet, header = row 1).

---

## 11. Ratings & reviews

**Read (shop page):** `GET /api/shops/:shopId/reviews`
```json
{ "ok": true, "data": { "reviews": [
  { "id": 1, "stars": 5, "comment": "Fresh and fast delivery",
    "createdAt": "...", "reviewerPhone": "+917665899003" } ] } }
```
Mask `reviewerPhone` in the UI (e.g. `+91 76•••• 9003`).

**Write (after delivery):** `POST /api/shops/:shopId/reviews` (Bearer)
`{ "stars": 5, "comment": "Fresh and fast delivery", "orderId": 1 }`
- Pass `orderId` when reviewing from an order — the backend verifies ownership (403 otherwise) and blocks duplicate reviews per order.
- The shop's `ratingAvg`/`ratingCount` update immediately; refetch the shop page after posting.

---

## 12. KYC / green tick

**Submit:** `POST /api/kyc` (Bearer, requires shop)
`{ "docType": "FSSAI", "docNumber": "10014051001234", "docFileUrl": "<upload url>" }` → 201 `{ "submissionId": 1, "status": "pending" }`
(`docType` is `"FSSAI"` or `"GSTIN"`; upload the document photo via §9 first.)

**Status:** `GET /api/kyc/status`
```json
{ "ok": true, "data": { "verified": true, "submissions": [
  { "id": 1, "docType": "FSSAI", "docNumber": "10014051001234",
    "status": "approved", "rejectReason": null, "createdAt": "..." } ] } }
```
`verified: true` → show the green tick on the shop's own profile. `status: "rejected"` → show `rejectReason` with a resubmit CTA.

> `POST /api/kyc/:id/approve` exists for the admin/ops tool only — do not expose it in the consumer app.

---

## 13. Screen → endpoint cheat sheet

| Screen | Calls |
|---|---|
| App launch | `GET /api/auth/me` |
| 4.1 Phone number | `POST /api/auth/request-otp` |
| 4.2 6-number code | `POST /api/auth/verify-otp` (Resend = request-otp again) |
| 4.3 Shop setup | `POST /api/uploads` ×2 → `PUT /api/shops/me` |
| 4.4 Edit profile | `GET /api/shops/me` → `PUT /api/shops/me` |
| 4.5 Home | `GET /api/categories` + `GET /api/notifications` (badge) |
| 4.5 Search box | `GET /api/products?q=` |
| 4.6 Pick a type | `GET /api/categories/:id/subcategories` |
| 4.7 Price list | `GET /api/products?categoryId&subcategoryId&sort` |
| 4.8 Product card | `GET /api/products/:id` · Query → §8 · Add to cart → `POST /api/cart/items` |
| Cart & pay | `GET /api/cart` → `POST /api/orders/checkout` → pay → poll `GET /api/orders/:id` |
| 4.9 Seller page | `GET /api/shops/:idOrSlug` (+ `/reviews`, `/share-link`, `/delivers-to/:pin`) |
| 4.10 List a product | `POST /api/uploads` ×N → `POST /api/products` · Bulk: template GET + `POST /api/products/bulk` |
| 4.11 Bell | `GET /api/notifications` · mark-all-read · `PATCH .../:id/read` |
| Seller order book | `GET /api/orders?as=seller` · `PATCH /api/orders/:id/status` |
| Logout | `POST /api/auth/logout` → wipe token |

---

## 14. Recommended client-side handling

- **Single fetch wrapper** that injects the Bearer header, parses the envelope, throws typed errors, and globally intercepts 401 → logout + navigate to 4.1.
- **Retry** idempotent GETs (network flakiness is common on mobile data); never auto-retry POSTs to checkout/payments.
- **Optimistic UI** is safe for cart quantity changes and mark-as-read; reconcile on failure.
- **Cache** `GET /api/categories` (changes rarely) with a pull-to-refresh escape hatch.
- **Don't hardcode** category/subcategory ids — always resolve from the API; ids can differ per environment.

## 15. Environments

| | Dev | Production |
|---|---|---|
| Base URL | `http://localhost:3000` | your deployed URL (HTTPS mandatory) |
| OTP delivery | printed in server console | real SMS |
| Payment | mock (`POST /api/payments/mock/confirm`) | gateway SDK using `providerRef` + `clientPayload` |

The mock-confirm endpoint returns 403 in production — gate that code path on a build flag.
