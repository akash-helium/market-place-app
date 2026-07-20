import type { PoolConnection, RowDataPacket } from "mysql2/promise";
import { execute, queryOne } from "../config/db";

export type PriceHistorySource = "create" | "edit" | "bulk" | "seed" | "adjust";

/** Append a price snapshot. Skips if identical to the latest row. */
export async function recordProductPrice(
  productId: number,
  pricePaise: number | null,
  opts: {
    mrpPaise?: number | null;
    source?: PriceHistorySource;
    recordedAt?: Date | string;
    conn?: PoolConnection;
  } = {}
): Promise<void> {
  const source = opts.source ?? "edit";
  const latest = await queryLatest(productId, opts.conn);
  if (
    latest &&
    latest.price_paise === pricePaise &&
    (opts.mrpPaise === undefined || latest.mrp_paise === (opts.mrpPaise ?? null))
  ) {
    return;
  }

  const mrp = opts.mrpPaise ?? null;
  if (opts.conn) {
    if (opts.recordedAt) {
      await opts.conn.execute(
        `INSERT INTO product_price_history (product_id, price_paise, mrp_paise, source, recorded_at)
         VALUES (?, ?, ?, ?, ?)`,
        [productId, pricePaise, mrp, source, opts.recordedAt]
      );
    } else {
      await opts.conn.execute(
        `INSERT INTO product_price_history (product_id, price_paise, mrp_paise, source)
         VALUES (?, ?, ?, ?)`,
        [productId, pricePaise, mrp, source]
      );
    }
    return;
  }

  if (opts.recordedAt) {
    await execute(
      `INSERT INTO product_price_history (product_id, price_paise, mrp_paise, source, recorded_at)
       VALUES (?, ?, ?, ?, ?)`,
      [productId, pricePaise, mrp, source, opts.recordedAt]
    );
  } else {
    await execute(
      `INSERT INTO product_price_history (product_id, price_paise, mrp_paise, source)
       VALUES (?, ?, ?, ?)`,
      [productId, pricePaise, mrp, source]
    );
  }
}

async function queryLatest(
  productId: number,
  conn?: PoolConnection
): Promise<{ price_paise: number | null; mrp_paise: number | null } | null> {
  const sql = `SELECT price_paise, mrp_paise FROM product_price_history
               WHERE product_id = ? ORDER BY recorded_at DESC, id DESC LIMIT 1`;
  if (conn) {
    const [rows] = await conn.query<RowDataPacket[]>(sql, [productId]);
    return (rows[0] as { price_paise: number | null; mrp_paise: number | null } | undefined) ?? null;
  }
  return queryOne<RowDataPacket & { price_paise: number | null; mrp_paise: number | null }>(sql, [productId]);
}
