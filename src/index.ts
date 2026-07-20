import { Hono } from "hono";
import { logger } from "hono/logger";
import { cors } from "hono/cors";
import { serveStatic } from "hono/bun";
import { env } from "./config/env";
import { storageService } from "./services";
import type { AppEnv } from "./middleware/auth";

import { authRoutes } from "./routes/auth";
import { shopRoutes } from "./routes/shops";
import { categoryRoutes, productRoutes } from "./routes/products";
import { cartRoutes, orderRoutes, paymentRoutes } from "./routes/orders";
import {
  notificationRoutes, reviewRoutes, queryRoutes, kycRoutes, uploadRoutes,
} from "./routes/misc";
import { adminRoutes } from "./routes/admin";

storageService.init();

const app = new Hono<AppEnv>();

app.use("*", logger());
app.use(
  "/api/*",
  cors({
    origin: ["http://localhost:3000", "http://localhost:5173", "http://127.0.0.1:5173"],
    allowHeaders: ["Content-Type", "Authorization", "X-Admin-Key"],
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  })
);

// Serve stored photos (Photo storage)
app.use("/uploads/*", serveStatic({ root: "./" }));

app.get("/", (c) =>
  c.json({
    ok: true,
    data: {
      name: "Agro Bazaar API",
      version: "1.0.0",
      docs: "See README.md for the full endpoint list",
    },
  })
);
app.get("/health", (c) => c.json({ ok: true, data: { status: "up" } }));

// The whole journey, route by route
app.route("/api/auth", authRoutes);            // SMS service + Login keeper
app.route("/api/shops", shopRoutes);           // Profile keeper + Location + Share link
app.route("/api/categories", categoryRoutes);  // Home screen tiles
app.route("/api/products", productRoutes);     // Product list + Search + Bulk upload
app.route("/api/cart", cartRoutes);            // Cart
app.route("/api/orders", orderRoutes);         // Orders
app.route("/api/payments", paymentRoutes);     // Payment service
app.route("/api/notifications", notificationRoutes); // The bell
app.route("/api", reviewRoutes);               // Ratings (nested under /shops/:id/reviews)
app.route("/api", queryRoutes);                // Customer chat
app.route("/api/kyc", kycRoutes);              // Verification (green tick)
app.route("/api/uploads", uploadRoutes);       // Photo storage
app.route("/api/admin", adminRoutes);          // Ops admin panel

app.notFound((c) => c.json({ ok: false, error: "Route not found" }, 404));
app.onError((err, c) => {
  console.error(err);
  return c.json({ ok: false, error: "Something went wrong on our side" }, 500);
});

export default {
  port: env.PORT,
  fetch: app.fetch,
};

console.log(`🌾 Agro Bazaar API running on ${env.APP_URL} (port ${env.PORT})`);
