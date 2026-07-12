import { Hono } from "hono";
import { z } from "zod";
import type { RowDataPacket } from "mysql2";
import { execute, query, queryOne, withTransaction } from "../config/db";
import { requireAuth, type AppEnv } from "../middleware/auth";
import { newOrderNumber, formatINR } from "../utils";
import { paymentService, notificationService } from "../services";
import { env } from "../config/env";

export const cartRoutes = new Hono<AppEnv>();
export const orderRoutes = new Hono<AppEnv>();
export const paymentRoutes = new Hono<AppEnv>();

/* ============================================================
 * Cart — "remembers what the buyer has put in the basket"
 * ==========================================================*/
async function getOrCreateCart(userId: number): Promise<number> {
  await execute(`INSERT IGNORE INTO carts (user_id) VALUES (?)`, [userId]);
  const cart = await queryOne<RowDataPacket & { id: number }>(
    `SELECT id FROM carts WHERE user_id = ?`, [userId]
  );
  return cart!.id;
}

cartRoutes.get("/", requireAuth, async (c) => {
  const cartId = await getOrCreateCart(c.get("user").id);
  const items = await query<RowDataPacket>(
    `SELECT ci.id, ci.quantity, p.id AS productId, p.title, p.pack_size AS packSize,
            p.price_paise AS pricePaise, p.in_stock AS inStock,
            s.id AS shopId, s.name AS shopName,
            (SELECT url FROM product_photos ph WHERE ph.product_id = p.id
              ORDER BY ph.is_cover DESC, ph.position LIMIT 1) AS coverUrl
       FROM cart_items ci
       JOIN products p ON p.id = ci.product_id
       JOIN shops s ON s.id = p.shop_id
      WHERE ci.cart_id = ?`,
    [cartId]
  );
  const totalPaise = items.reduce((sum, i) => sum + Number(i.pricePaise ?? 0) * Number(i.quantity), 0);
  return c.json({ ok: true, data: { items, totalPaise, totalDisplay: formatINR(totalPaise) } });
});

cartRoutes.post("/items", requireAuth, async (c) => {
  const schema = z.object({ productId: z.number().int().positive(), quantity: z.number().int().min(1).max(999).default(1) });
  const body = schema.safeParse(await c.req.json().catch(() => ({})));
  if (!body.success) return c.json({ ok: false, error: "productId and quantity are required" }, 400);

  const product = await queryOne<RowDataPacket & { price_paise: number | null; in_stock: number; shop_id: number }>(
    `SELECT price_paise, in_stock, shop_id FROM products WHERE id = ? AND status = 'live'`,
    [body.data.productId]
  );
  if (!product) return c.json({ ok: false, error: "Product not found" }, 404);
  if (!product.in_stock) return c.json({ ok: false, error: "This product is out of stock" }, 409);
  if (product.price_paise === null) {
    return c.json({ ok: false, error: "Price is N/A — please ring the seller before ordering" }, 409);
  }

  const cartId = await getOrCreateCart(c.get("user").id);
  await execute(
    `INSERT INTO cart_items (cart_id, product_id, quantity) VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE quantity = quantity + VALUES(quantity)`,
    [cartId, body.data.productId, body.data.quantity]
  );
  return c.json({ ok: true, data: { message: "Added to cart" } }, 201);
});

cartRoutes.put("/items/:id", requireAuth, async (c) => {
  const schema = z.object({ quantity: z.number().int().min(1).max(999) });
  const body = schema.safeParse(await c.req.json().catch(() => ({})));
  if (!body.success) return c.json({ ok: false, error: "quantity is required" }, 400);
  const cartId = await getOrCreateCart(c.get("user").id);
  const res = await execute(
    `UPDATE cart_items SET quantity = ? WHERE id = ? AND cart_id = ?`,
    [body.data.quantity, Number(c.req.param("id")), cartId]
  );
  if (res.affectedRows === 0) return c.json({ ok: false, error: "Item not in your cart" }, 404);
  return c.json({ ok: true, data: { message: "Quantity updated" } });
});

cartRoutes.delete("/items/:id", requireAuth, async (c) => {
  const cartId = await getOrCreateCart(c.get("user").id);
  await execute(`DELETE FROM cart_items WHERE id = ? AND cart_id = ?`, [Number(c.req.param("id")), cartId]);
  return c.json({ ok: true, data: { message: "Removed from cart" } });
});

/* ============================================================
 * Orders — "Tap Add to Cart and pay → Order placed, done"
 * Checkout splits the cart into one order per shop.
 * ==========================================================*/
orderRoutes.post("/checkout", requireAuth, async (c) => {
  const schema = z.object({
    deliveryAddress: z.string().max(500).optional(),
    deliveryPincode: z.string().regex(/^\d{6}$/).optional(),
  });
  const body = schema.safeParse(await c.req.json().catch(() => ({})));
  if (!body.success) return c.json({ ok: false, error: "Invalid delivery details" }, 400);

  const user = c.get("user");
  const cartId = await getOrCreateCart(user.id);

  const items = await query<RowDataPacket & {
    product_id: number; quantity: number; title: string; price_paise: number | null;
    in_stock: number; shop_id: number;
  }>(
    `SELECT ci.product_id, ci.quantity, p.title, p.price_paise, p.in_stock, p.shop_id
       FROM cart_items ci JOIN products p ON p.id = ci.product_id AND p.status = 'live'
      WHERE ci.cart_id = ?`,
    [cartId]
  );
  if (items.length === 0) return c.json({ ok: false, error: "Your cart is empty" }, 400);

  const bad = items.find((i) => !i.in_stock || i.price_paise === null);
  if (bad) return c.json({ ok: false, error: `"${bad.title}" is not orderable right now — remove it or ring the seller` }, 409);

  // Group by shop
  const byShop = new Map<number, typeof items>();
  for (const item of items) {
    if (!byShop.has(item.shop_id)) byShop.set(item.shop_id, []);
    byShop.get(item.shop_id)!.push(item);
  }

  const orders = await withTransaction(async (conn) => {
    const created: Array<{ orderId: number; orderNumber: string; shopId: number; totalPaise: number; itemsCount: number }> = [];
    for (const [shopId, shopItems] of byShop) {
      const totalPaise = shopItems.reduce((s, i) => s + Number(i.price_paise) * i.quantity, 0);
      const orderNumber = newOrderNumber();
      const [res] = await conn.execute(
        `INSERT INTO orders (order_number, buyer_id, shop_id, status, items_count, total_paise,
                             delivery_address, delivery_pincode)
         VALUES (?, ?, ?, 'pending_payment', ?, ?, ?, ?)`,
        [orderNumber, user.id, shopId, shopItems.length, totalPaise,
         body.data.deliveryAddress ?? null, body.data.deliveryPincode ?? null]
      );
      const orderId = (res as { insertId: number }).insertId;
      for (const item of shopItems) {
        await conn.execute(
          `INSERT INTO order_items (order_id, product_id, title_snapshot, price_paise, quantity)
           VALUES (?, ?, ?, ?, ?)`,
          [orderId, item.product_id, item.title, item.price_paise, item.quantity]
        );
      }
      created.push({ orderId, orderNumber, shopId, totalPaise, itemsCount: shopItems.length });
    }
    await conn.execute(`DELETE FROM cart_items WHERE cart_id = ?`, [cartId]);
    return created;
  });

  // One payment intent per order (Payment service)
  const payments = [];
  for (const o of orders) {
    const intent = await paymentService.createIntent(o.orderId, o.totalPaise);
    await execute(
      `INSERT INTO payments (order_id, provider, provider_ref, amount_paise, status)
       VALUES (?, ?, ?, ?, 'created')`,
      [o.orderId, intent.provider, intent.providerRef, intent.amountPaise]
    );
    payments.push({ orderId: o.orderId, orderNumber: o.orderNumber, ...intent });
  }

  return c.json({ ok: true, data: { orders, payments } }, 201);
});

/** My orders (as buyer) or my shop's orders (?as=seller) */
orderRoutes.get("/", requireAuth, async (c) => {
  const user = c.get("user");
  const asSeller = c.req.query("as") === "seller";
  if (asSeller && !user.shopId) return c.json({ ok: false, error: "You have no shop yet" }, 403);

  const rows = await query<RowDataPacket>(
    `SELECT o.id, o.order_number AS orderNumber, o.status, o.items_count AS itemsCount,
            o.total_paise AS totalPaise, o.created_at AS createdAt,
            s.name AS shopName, u.phone AS buyerPhone
       FROM orders o
       JOIN shops s ON s.id = o.shop_id
       JOIN users u ON u.id = o.buyer_id
      WHERE ${asSeller ? "o.shop_id = ?" : "o.buyer_id = ?"}
      ORDER BY o.created_at DESC LIMIT 100`,
    [asSeller ? user.shopId : user.id]
  );
  return c.json({ ok: true, data: { orders: rows } });
});

orderRoutes.get("/:id", requireAuth, async (c) => {
  const user = c.get("user");
  const order = await queryOne<RowDataPacket & { buyer_id: number; shop_id: number }>(
    `SELECT o.*, s.name AS shopName FROM orders o JOIN shops s ON s.id = o.shop_id WHERE o.id = ?`,
    [Number(c.req.param("id"))]
  );
  if (!order) return c.json({ ok: false, error: "Order not found" }, 404);
  if (order.buyer_id !== user.id && order.shop_id !== user.shopId) {
    return c.json({ ok: false, error: "Not your order" }, 403);
  }
  const items = await query(
    `SELECT title_snapshot AS title, price_paise AS pricePaise, quantity FROM order_items WHERE order_id = ?`,
    [order.id]
  );
  return c.json({ ok: true, data: { ...order, items } });
});

/** Seller updates status: confirmed → dispatched → delivered (or cancelled) */
orderRoutes.patch("/:id/status", requireAuth, async (c) => {
  const schema = z.object({ status: z.enum(["confirmed", "dispatched", "delivered", "cancelled"]) });
  const body = schema.safeParse(await c.req.json().catch(() => ({})));
  if (!body.success) return c.json({ ok: false, error: "Invalid status" }, 400);

  const user = c.get("user");
  const order = await queryOne<RowDataPacket & { id: number; shop_id: number; buyer_id: number; order_number: string }>(
    `SELECT id, shop_id, buyer_id, order_number FROM orders WHERE id = ?`, [Number(c.req.param("id"))]
  );
  if (!order) return c.json({ ok: false, error: "Order not found" }, 404);
  if (order.shop_id !== user.shopId) return c.json({ ok: false, error: "Only the seller can update this order" }, 403);

  await execute(`UPDATE orders SET status = ? WHERE id = ?`, [body.data.status, order.id]);
  await notificationService.notify(order.buyer_id, "order",
    `Order ${order.order_number} ${body.data.status}`, undefined, { orderId: order.id });
  return c.json({ ok: true, data: { message: `Order ${body.data.status}` } });
});

/* ============================================================
 * Payment service endpoints
 * ==========================================================*/

/** Dev-only: simulate a successful payment on the mock gateway */
paymentRoutes.post("/mock/confirm", requireAuth, async (c) => {
  if (env.PAYMENT_PROVIDER !== "mock") return c.json({ ok: false, error: "Mock gateway is disabled" }, 403);
  const schema = z.object({ orderId: z.number().int().positive() });
  const body = schema.safeParse(await c.req.json().catch(() => ({})));
  if (!body.success) return c.json({ ok: false, error: "orderId required" }, 400);
  await settlePayment(body.data.orderId);
  return c.json({ ok: true, data: { message: "Payment marked as paid; order placed" } });
});

/** Real-gateway webhook (Razorpay-style) */
paymentRoutes.post("/webhook", async (c) => {
  const raw = await c.req.text();
  const signature = c.req.header("X-Webhook-Signature") ?? "";
  if (!paymentService.verifyWebhookSignature(raw, signature)) {
    return c.json({ ok: false, error: "Bad signature" }, 401);
  }
  const payload = JSON.parse(raw) as { orderId?: number; event?: string };
  if (payload.event === "payment.captured" && payload.orderId) {
    await settlePayment(payload.orderId);
  }
  return c.json({ ok: true });
});

async function settlePayment(orderId: number): Promise<void> {
  const order = await queryOne<RowDataPacket & {
    id: number; order_number: string; shop_id: number; items_count: number; total_paise: number;
  }>(`SELECT id, order_number, shop_id, items_count, total_paise FROM orders WHERE id = ?`, [orderId]);
  if (!order) return;

  await withTransaction(async (conn) => {
    await conn.execute(`UPDATE payments SET status = 'paid' WHERE order_id = ?`, [orderId]);
    await conn.execute(`UPDATE orders SET status = 'placed' WHERE id = ? AND status = 'pending_payment'`, [orderId]);
    // Decrement stock + low-stock alerts
    const [items] = await conn.query<RowDataPacket[]>(
      `SELECT oi.product_id, oi.quantity FROM order_items oi WHERE oi.order_id = ? AND oi.product_id IS NOT NULL`,
      [orderId]
    );
    for (const item of items) {
      await conn.execute(
        `UPDATE products SET stock_units = GREATEST(0, stock_units - ?) WHERE id = ? AND stock_units IS NOT NULL`,
        [item.quantity, item.product_id]
      );
    }
  });

  // Notify seller: "New order received — Order #4821 · 3 items · ₹540"
  const seller = await queryOne<RowDataPacket & { user_id: number }>(
    `SELECT user_id FROM shops WHERE id = ?`, [order.shop_id]
  );
  if (seller) {
    await notificationService.newOrder(seller.user_id, order.order_number, order.items_count, Number(order.total_paise), order.id);
    // Low-stock check
    const low = await query<RowDataPacket & { id: number; title: string; stock_units: number; user_id: number }>(
      `SELECT p.id, p.title, p.stock_units, s.user_id
         FROM products p JOIN shops s ON s.id = p.shop_id
        WHERE p.shop_id = ? AND p.stock_units IS NOT NULL AND p.stock_units <= 5 AND p.in_stock = 1`,
      [order.shop_id]
    );
    for (const p of low) {
      await notificationService.lowStock(p.user_id, p.title, p.stock_units, p.id);
    }
  }
}
