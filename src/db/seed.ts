import { pool, execute, queryOne, query } from "../config/db";
import type { RowDataPacket } from "mysql2";
import { toPaise } from "../utils/index";

const APP = process.env.APP_URL ?? "http://localhost:3000";

// Local seed images (served at /uploads/seed/*)
const IMG = {
  rajma: `${APP}/uploads/seed/rajma.jpg`,
  chana: `${APP}/uploads/seed/chana.jpg`,
  moong: `${APP}/uploads/seed/moong.jpg`,
  masoor: `${APP}/uploads/seed/masoor.jpg`,
  urad: `${APP}/uploads/seed/urad.jpg`,
  kabli: `${APP}/uploads/seed/kabli.jpg`,
  matar: `${APP}/uploads/seed/matar.jpg`,
  lobiya: `${APP}/uploads/seed/lobiya.jpg`,
  shop1: `${APP}/uploads/seed/shop1.jpg`,
  shop2: `${APP}/uploads/seed/shop2.jpg`,
  shop3: `${APP}/uploads/seed/shop3.jpg`,
  logo1: `${APP}/uploads/seed/logo1.jpg`,
  logo2: `${APP}/uploads/seed/logo2.jpg`,
  logo3: `${APP}/uploads/seed/logo3.jpg`,
};

const CATEGORIES: Array<{ name: string; tagline: string; icon: string; subs: Array<{ name: string; icon: string }> }> = [
  {
    name: "Rajma",
    tagline: "Chitra, Lal varieties",
    icon: IMG.rajma,
    subs: [
      { name: "Chitra", icon: IMG.rajma },
      { name: "Rajma Lal", icon: IMG.rajma },
    ],
  },
  {
    name: "Kabli",
    tagline: "Garbanzo, Balay Balay",
    icon: IMG.kabli,
    subs: [
      { name: "Garbanzo", icon: IMG.kabli },
      { name: "Balay Balay", icon: IMG.kabli },
    ],
  },
  {
    name: "Chana",
    tagline: "Whole, Dal, Besan",
    icon: IMG.chana,
    subs: [
      { name: "Whole", icon: IMG.chana },
      { name: "Dal", icon: IMG.chana },
      { name: "Besan", icon: IMG.chana },
    ],
  },
  {
    name: "Matar",
    tagline: "Safed, Hari, Besan",
    icon: IMG.matar,
    subs: [
      { name: "Safed", icon: IMG.matar },
      { name: "Hari", icon: IMG.matar },
      { name: "Besan", icon: IMG.matar },
    ],
  },
  {
    name: "Urad",
    tagline: "Whole, Dhuli, Chilka",
    icon: IMG.urad,
    subs: [
      { name: "Whole", icon: IMG.urad },
      { name: "Dhuli", icon: IMG.urad },
      { name: "Chilka", icon: IMG.urad },
    ],
  },
  {
    name: "Moong",
    tagline: "Whole, Dhuli, Chilka",
    icon: IMG.moong,
    subs: [
      { name: "Whole", icon: IMG.moong },
      { name: "Dhuli", icon: IMG.moong },
      { name: "Chilka", icon: IMG.moong },
    ],
  },
  {
    name: "Masoor",
    tagline: "Whole, Malka, Dal",
    icon: IMG.masoor,
    subs: [
      { name: "Whole", icon: IMG.masoor },
      { name: "Malka", icon: IMG.masoor },
      { name: "Dal", icon: IMG.masoor },
    ],
  },
  {
    name: "Lobiya",
    tagline: "Safed, Lal",
    icon: IMG.lobiya,
    subs: [
      { name: "Safed", icon: IMG.lobiya },
      { name: "Lal", icon: IMG.lobiya },
    ],
  },
];

type ShopSeed = {
  phone: string;
  name: string;
  slug: string;
  description: string;
  city: string;
  pincode: string;
  addressLine: string;
  note: string;
  banner: string;
  logo: string;
  verified: boolean;
  contacts: Array<{ kind: "phone" | "email"; value: string; label?: string }>;
  products: Array<{
    cat: string;
    sub?: string;
    title: string;
    pack: string;
    price: number | null;
    stock: number;
    image: string;
  }>;
};

const SHOPS: ShopSeed[] = [
  {
    phone: "+919810817196",
    name: "Rajat & Company Commodities Pvt Ltd",
    slug: "rajat-company-commodities-pvt-ltd-demo",
    description: "Wholesale supplier of premium pulses, dals and besan since 2014. Delivery from godown.",
    city: "Delhi",
    pincode: "110006",
    addressLine: "Naya Bazar",
    note: "After order confirmation, goods must be outward within 2 days only. Program receive only before 5 PM.",
    banner: IMG.shop1,
    logo: IMG.logo1,
    verified: true,
    contacts: [
      { kind: "phone", value: "+919810871966", label: "Ratan" },
      { kind: "phone", value: "+917665899003", label: "Sanjay" },
      { kind: "phone", value: "+918950278270", label: "Naveen" },
      { kind: "email", value: "orders@rajatco.in" },
    ],
    products: [
      { cat: "Rajma", sub: "Chitra", title: "Chitra Pila Badshah", pack: "30 kg", price: 12600, stock: 40, image: IMG.rajma },
      { cat: "Rajma", sub: "Chitra", title: "Chitra Sky Badshah", pack: "30 kg", price: 12500, stock: 28, image: IMG.rajma },
      { cat: "Kabli", sub: "Garbanzo", title: "Garbanzo Premium", pack: "45 kg", price: 9300, stock: 15, image: IMG.kabli },
      { cat: "Kabli", sub: "Balay Balay", title: "Mexico Banarsi Babu", pack: "30 kg", price: 8300, stock: 22, image: IMG.kabli },
      { cat: "Moong", sub: "Dhuli", title: "Dhowa Mota 2X", pack: "30 kg", price: 8850, stock: 18, image: IMG.moong },
      { cat: "Moong", sub: "Dhuli", title: "Dhowa Orange 2X", pack: "30 kg", price: null, stock: 10, image: IMG.moong },
      { cat: "Masoor", sub: "Malka", title: "Malka Gold", pack: "30 kg", price: 7200, stock: 35, image: IMG.masoor },
    ],
  },
  {
    phone: "+919811122233",
    name: "Shree Mandi Traders",
    slug: "shree-mandi-traders-demo",
    description: "Family-run mandi traders specialising in chana, matar and urad. Bulk bags only.",
    city: "Jaipur",
    pincode: "302001",
    addressLine: "MI Road Grain Market",
    note: "No tempo loading after 10 PM. Prices subject to market.",
    banner: IMG.shop2,
    logo: IMG.logo2,
    verified: true,
    contacts: [
      { kind: "phone", value: "+919811122233", label: "Office" },
      { kind: "email", value: "sales@shreemanditraders.in" },
    ],
    products: [
      { cat: "Chana", sub: "Whole", title: "Desi Chana Bold", pack: "30 kg", price: 5400, stock: 50, image: IMG.chana },
      { cat: "Chana", sub: "Dal", title: "Chana Dal Special", pack: "30 kg", price: 6100, stock: 30, image: IMG.chana },
      { cat: "Matar", sub: "Safed", title: "White Matar Export", pack: "30 kg", price: 7800, stock: 12, image: IMG.matar },
      { cat: "Urad", sub: "Dhuli", title: "Urad Dhuli Soft", pack: "30 kg", price: 9200, stock: 20, image: IMG.urad },
    ],
  },
  {
    phone: "+919988776655",
    name: "GreenField Agro Hub",
    slug: "greenfield-agro-hub-demo",
    description: "Farm-gate to godown supply for hotels and kirana chains across NCR.",
    city: "Ghaziabad",
    pincode: "201001",
    addressLine: "Sahibabad Industrial Area",
    note: "Minimum order 5 bags. Call before placing large program.",
    banner: IMG.shop3,
    logo: IMG.logo3,
    verified: false,
    contacts: [
      { kind: "phone", value: "+919988776655", label: "Amit" },
      { kind: "phone", value: "+919988776656", label: "Warehouse" },
    ],
    products: [
      { cat: "Lobiya", sub: "Safed", title: "White Lobiya Grade A", pack: "30 kg", price: 6800, stock: 25, image: IMG.lobiya },
      { cat: "Lobiya", sub: "Lal", title: "Red Lobiya Fresh Lot", pack: "30 kg", price: 7100, stock: 14, image: IMG.lobiya },
      { cat: "Masoor", sub: "Dal", title: "Masoor Dal Split", pack: "30 kg", price: 6900, stock: 40, image: IMG.masoor },
    ],
  },
];

console.log("Seeding categories…");
// Ensure subcategory icon column exists (TiDB / existing DBs)
try {
  await execute(`ALTER TABLE subcategories ADD COLUMN icon_url VARCHAR(500) NULL`);
} catch {
  /* already exists */
}

for (let i = 0; i < CATEGORIES.length; i++) {
  const c = CATEGORIES[i]!;
  await execute(
    `INSERT INTO categories (name, tagline, icon_url, sort_order) VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE tagline = VALUES(tagline), icon_url = VALUES(icon_url), sort_order = VALUES(sort_order)`,
    [c.name, c.tagline, c.icon, i]
  );
  const row = await queryOne(`SELECT id FROM categories WHERE name = ?`, [c.name]);
  const catId = (row as { id: number }).id;
  for (const s of c.subs) {
    await execute(
      `INSERT INTO subcategories (category_id, name, icon_url) VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE icon_url = VALUES(icon_url)`,
      [catId, s.name, s.icon]
    );
  }
}

const cats = await query<RowDataPacket & { id: number; name: string }>(`SELECT id, name FROM categories`);
const subs = await query<RowDataPacket & { id: number; name: string; category_id: number }>(
  `SELECT id, name, category_id FROM subcategories`
);
const catByName = new Map(cats.map((c) => [c.name.toLowerCase(), c.id]));
const subBy = new Map(subs.map((s) => [`${s.category_id}:${s.name.toLowerCase()}`, s.id]));

console.log("Seeding mock shops, contacts & products…");
for (const shop of SHOPS) {
  let user = await queryOne<RowDataPacket & { id: number }>(`SELECT id FROM users WHERE phone = ?`, [shop.phone]);
  if (!user) {
    await execute(`INSERT INTO users (phone, is_verified, onboarded) VALUES (?, 1, 1)`, [shop.phone]);
    user = await queryOne(`SELECT id FROM users WHERE phone = ?`, [shop.phone]);
  } else {
    await execute(`UPDATE users SET is_verified = 1, onboarded = 1 WHERE id = ?`, [user.id]);
  }
  const userId = (user as { id: number }).id;

  let existing = await queryOne<RowDataPacket & { id: number }>(`SELECT id FROM shops WHERE user_id = ?`, [userId]);
  let shopId: number;
  if (existing) {
    shopId = existing.id;
    await execute(
      `UPDATE shops SET name=?, slug=?, description=?, banner_url=?, logo_url=?, address_line=?, city=?, pincode=?,
       note_for_buyers=?, is_verified=?, rating_avg=?, rating_count=? WHERE id=?`,
      [
        shop.name, shop.slug, shop.description, shop.banner, shop.logo, shop.addressLine, shop.city, shop.pincode,
        shop.note, shop.verified ? 1 : 0, 4.8, 12, shopId,
      ]
    );
  } else {
    const res = await execute(
      `INSERT INTO shops (user_id, slug, name, description, banner_url, logo_url, address_line, city, pincode,
        note_for_buyers, is_verified, rating_avg, rating_count)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId, shop.slug, shop.name, shop.description, shop.banner, shop.logo, shop.addressLine, shop.city,
        shop.pincode, shop.note, shop.verified ? 1 : 0, 4.8, 12,
      ]
    );
    shopId = Number(res.insertId);
  }

  await execute(`DELETE FROM shop_contacts WHERE shop_id = ?`, [shopId]);
  for (const c of shop.contacts) {
    await execute(
      `INSERT INTO shop_contacts (shop_id, kind, value, label) VALUES (?, ?, ?, ?)`,
      [shopId, c.kind, c.value, c.label ?? null]
    );
  }
  await execute(`DELETE FROM shop_delivery_areas WHERE shop_id = ?`, [shopId]);
  for (const pin of [shop.pincode, "110006", "302001", "201001"]) {
    await execute(`INSERT IGNORE INTO shop_delivery_areas (shop_id, pincode) VALUES (?, ?)`, [shopId, pin]);
  }

  // Replace demo products for this shop (by matching seeded titles)
  for (const p of shop.products) {
    const catId = catByName.get(p.cat.toLowerCase());
    if (!catId) continue;
    const subId = p.sub ? subBy.get(`${catId}:${p.sub.toLowerCase()}`) ?? null : null;
    const found = await queryOne<RowDataPacket & { id: number }>(
      `SELECT id FROM products WHERE shop_id = ? AND title = ?`,
      [shopId, p.title]
    );
    let productId: number;
    if (found) {
      productId = found.id;
      await execute(
        `UPDATE products SET category_id=?, subcategory_id=?, pack_size=?, price_paise=?, in_stock=1, stock_units=?, status='live'
         WHERE id=?`,
        [catId, subId, p.pack, p.price != null ? toPaise(p.price) : null, p.stock, productId]
      );
      await execute(`DELETE FROM product_photos WHERE product_id = ?`, [productId]);
    } else {
      const res = await execute(
        `INSERT INTO products (shop_id, category_id, subcategory_id, title, description, pack_size, price_paise, in_stock, stock_units, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, 'live')`,
        [shopId, catId, subId, p.title, "Premium godown stock", p.pack, p.price != null ? toPaise(p.price) : null, p.stock]
      );
      productId = Number(res.insertId);
    }
    await execute(
      `INSERT INTO product_photos (product_id, url, is_cover, position) VALUES (?, ?, 1, 0)`,
      [productId, p.image]
    );
  }
  console.log(`  ✓ ${shop.name} (shop #${shopId})`);
}

console.log(`✅ Seed complete. Product photos at ${APP}/uploads/seed/`);
await pool.end();
