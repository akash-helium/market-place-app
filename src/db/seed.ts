import { pool, execute, queryOne, query } from "../config/db";
import type { RowDataPacket } from "mysql2";
import { toPaise } from "../utils/index";
import { recordProductPrice } from "../services/priceHistory";

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
  toor: `${APP}/uploads/seed/chana.jpg`,
  shop1: `${APP}/uploads/seed/shop1.jpg`,
  shop2: `${APP}/uploads/seed/shop2.jpg`,
  shop3: `${APP}/uploads/seed/shop3.jpg`,
  shopPremier: `${APP}/uploads/seed/shop-premier.png`,
  shopVictoria: `${APP}/uploads/seed/shop-victoria.png`,
  shopParkash: `${APP}/uploads/seed/shop-parkash.png`,
  logo1: `${APP}/uploads/seed/logo1.jpg`,
  logo2: `${APP}/uploads/seed/logo2.jpg`,
  logo3: `${APP}/uploads/seed/logo3.jpg`,
};

const CATEGORIES: Array<{ name: string; tagline: string; icon: string; subs: Array<{ name: string; icon: string }> }> = [
  {
    name: "Rajma",
    tagline: "Chitra, Lal, Cranberry, China",
    icon: IMG.rajma,
    subs: [
      { name: "Chitra", icon: IMG.rajma },
      { name: "Rajma Lal", icon: IMG.rajma },
      { name: "Cranberry", icon: IMG.rajma },
      { name: "China", icon: IMG.rajma },
      { name: "Button", icon: IMG.rajma },
      { name: "Pink", icon: IMG.rajma },
      { name: "Srinagar", icon: IMG.rajma },
    ],
  },
  {
    name: "Kabli",
    tagline: "Mexico, Russian, Garbanzo",
    icon: IMG.kabli,
    subs: [
      { name: "Garbanzo", icon: IMG.kabli },
      { name: "Balay Balay", icon: IMG.kabli },
      { name: "Mexico", icon: IMG.kabli },
      { name: "Russian", icon: IMG.kabli },
    ],
  },
  {
    name: "Chana",
    tagline: "Whole, Dal, Kabuli, Kala",
    icon: IMG.chana,
    subs: [
      { name: "Whole", icon: IMG.chana },
      { name: "Dal", icon: IMG.chana },
      { name: "Besan", icon: IMG.chana },
      { name: "Kala", icon: IMG.chana },
      { name: "Kabuli", icon: IMG.chana },
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
    tagline: "Whole, Dhuli, Chilka, Dhowa",
    icon: IMG.urad,
    subs: [
      { name: "Whole", icon: IMG.urad },
      { name: "Dhuli", icon: IMG.urad },
      { name: "Chilka", icon: IMG.urad },
      { name: "Dhowa", icon: IMG.urad },
    ],
  },
  {
    name: "Moong",
    tagline: "Whole, Dhuli, Chilka, Talai",
    icon: IMG.moong,
    subs: [
      { name: "Whole", icon: IMG.moong },
      { name: "Dhuli", icon: IMG.moong },
      { name: "Chilka", icon: IMG.moong },
      { name: "Talai", icon: IMG.moong },
      { name: "Dhowa", icon: IMG.moong },
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
    tagline: "Safed, Lal, Black Eye",
    icon: IMG.lobiya,
    subs: [
      { name: "Safed", icon: IMG.lobiya },
      { name: "Lal", icon: IMG.lobiya },
      { name: "Black Eye", icon: IMG.lobiya },
    ],
  },
  {
    name: "Toor",
    tagline: "Arhar / Toor dal grades",
    icon: IMG.toor,
    subs: [
      { name: "Dal", icon: IMG.toor },
      { name: "Tukdi", icon: IMG.toor },
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
  // ---------- From rate sheets 13 Jul 2026 ----------
  {
    phone: "+919971976976",
    name: "Premier Pulses Ltd (P P Products)",
    slug: "premier-pulses-pp-products",
    description: "P P Products / Premier Pulses — wholesale urad, toor, kabli, lobia & rajma. Contact Yogesh Jain.",
    city: "Delhi",
    pincode: "110006",
    addressLine: "Naya Bazar / Godown",
    note: "NOTE — Prices are subject to market condition. Please confirm price before placing order. Rate sheet dated 13 July 2026.",
    banner: IMG.shop1,
    logo: IMG.logo1,
    verified: true,
    contacts: [
      { kind: "phone", value: "+919971976976", label: "Yogesh Jain" },
      { kind: "phone", value: "+919958295851", label: "Mobile 2" },
      { kind: "phone", value: "+919958295855", label: "Godown" },
      { kind: "phone", value: "01171838576", label: "Office Sales" },
    ],
    products: [
      { cat: "Urad", sub: "Dhuli", title: "URAD PP MUSKAN", pack: "quintal", price: 12300, stock: 40, image: IMG.urad },
      { cat: "Urad", sub: "Dhuli", title: "URAD PP ATOM", pack: "quintal", price: 11650, stock: 40, image: IMG.urad },
      { cat: "Urad", sub: "Dhuli", title: "URAD PP SUPER", pack: "quintal", price: 11350, stock: 35, image: IMG.urad },
      { cat: "Urad", sub: "Dhuli", title: "URAD PP SEWAK", pack: "quintal", price: 10950, stock: 35, image: IMG.urad },
      { cat: "Urad", sub: "Dhuli", title: "URAD PP 24 CARAT", pack: "quintal", price: 10650, stock: 30, image: IMG.urad },
      { cat: "Urad", sub: "Dhuli", title: "URAD PP SILVER", pack: "quintal", price: 10400, stock: 30, image: IMG.urad },
      { cat: "Urad", sub: "Dhuli", title: "URAD PP DLX", pack: "quintal", price: 10000, stock: 30, image: IMG.urad },
      { cat: "Urad", sub: "Dhowa", title: "DHOWA URAD EXTRA BOLD JOLLY", pack: "quintal", price: 14100, stock: 20, image: IMG.urad },
      { cat: "Urad", sub: "Dhowa", title: "DHOWA URAD BOLD GREEN", pack: "quintal", price: 12800, stock: 20, image: IMG.urad },
      { cat: "Urad", sub: "Dhowa", title: "DHOWA URAD ATOM", pack: "quintal", price: 12500, stock: 25, image: IMG.urad },
      { cat: "Urad", sub: "Dhowa", title: "DHOWA URAD SUPER", pack: "quintal", price: 12100, stock: 25, image: IMG.urad },
      { cat: "Urad", sub: "Dhowa", title: "DHOWA URAD 24 CARAT", pack: "quintal", price: 11700, stock: 25, image: IMG.urad },
      { cat: "Urad", sub: "Dhowa", title: "DHOWA URAD ORANGE", pack: "quintal", price: 11350, stock: 25, image: IMG.urad },
      { cat: "Urad", sub: "Chilka", title: "URAD CHILKA EXTRA BOLD ATOM", pack: "quintal", price: 11750, stock: 20, image: IMG.urad },
      { cat: "Urad", sub: "Chilka", title: "URAD CHILKA SUPER", pack: "quintal", price: 10950, stock: 20, image: IMG.urad },
      { cat: "Urad", sub: "Chilka", title: "URAD CHILKA 24 CARAT", pack: "quintal", price: 10750, stock: 20, image: IMG.urad },
      { cat: "Toor", sub: "Dal", title: "TOOR DAL PP PATKA NEW (MS)", pack: "quintal", price: 12600, stock: 30, image: IMG.toor },
      { cat: "Toor", sub: "Dal", title: "TOOR DAL PP SATKAR (MS)", pack: "quintal", price: 11600, stock: 30, image: IMG.toor },
      { cat: "Toor", sub: "Dal", title: "TOOR DAL IMP PATKA (RAJBOGH)", pack: "quintal", price: 7900, stock: 25, image: IMG.toor },
      { cat: "Toor", sub: "Dal", title: "TOOR DAL IMP PATKA (KASTURI)", pack: "quintal", price: 6900, stock: 25, image: IMG.toor },
      { cat: "Toor", sub: "Dal", title: "TOOR DAL DESI REJ (ANGOOR)", pack: "quintal", price: 7600, stock: 20, image: IMG.toor },
      { cat: "Lobiya", sub: "Black Eye", title: "LOBIA BLACK EYE", pack: "quintal", price: 8200, stock: 30, image: IMG.lobiya },
      { cat: "Lobiya", sub: "Safed", title: "LOBIA BRAZIL", pack: "quintal", price: 8000, stock: 30, image: IMG.lobiya },
      { cat: "Kabli", sub: "Mexico", title: "KABLI MEXICO 2000", pack: "quintal", price: null, stock: 15, image: IMG.kabli },
      { cat: "Kabli", sub: "Mexico", title: "KABLI MEXICO WHITE PEARL", pack: "quintal", price: 8750, stock: 20, image: IMG.kabli },
      { cat: "Kabli", sub: "Mexico", title: "KABLI MEXICO PP ATOM", pack: "quintal", price: 10300, stock: 20, image: IMG.kabli },
      { cat: "Kabli", sub: "Mexico", title: "KABLI MEXICO GRADE A", pack: "quintal", price: 7400, stock: 25, image: IMG.kabli },
      { cat: "Kabli", sub: "Mexico", title: "KABLI MEXICO GRADE B", pack: "quintal", price: 6500, stock: 25, image: IMG.kabli },
      { cat: "Kabli", sub: "Russian", title: "KABLI RUSSIAN PP MUSKAN", pack: "quintal", price: 8800, stock: 20, image: IMG.kabli },
      { cat: "Rajma", sub: "Cranberry", title: "RAJMA CRANBERRY", pack: "quintal", price: 16000, stock: 15, image: IMG.rajma },
      { cat: "Rajma", sub: "China", title: "RAJMA CHINA", pack: "quintal", price: 12200, stock: 20, image: IMG.rajma },
      { cat: "Rajma", sub: "Button", title: "RAJMA BUTTON OLD", pack: "quintal", price: 6150, stock: 20, image: IMG.rajma },
      { cat: "Rajma", sub: "Pink", title: "RAJMA PINK", pack: "quintal", price: 12200, stock: 18, image: IMG.rajma },
    ],
  },
  {
    phone: "+918178879587",
    name: "Victoria Foods Pvt. Ltd.",
    slug: "victoria-foods-pvt-ltd",
    description: "Ex-mill wholesale pulses in 30kg BOPP bags — SELECT, Rajdhani, Fiesta & All Seasons brands. Lawrence Road & Naya Bazar, Delhi.",
    city: "Delhi",
    pincode: "110035",
    addressLine: "B-32, Lawrence Road Indl Area (also 4049, Naya Bazar)",
    note: "ALL TRADES WITH A 10 DAY MAX LIFTING CONDITION. 0.5% DISCOUNT IF PAYMENT IS MADE BEFORE LIFTING. Rates ex mill as on 13.07.26 (listed as ₹/qtl ≈ ₹/kg × 100).",
    banner: IMG.shop2,
    logo: IMG.logo2,
    verified: true,
    contacts: [
      { kind: "phone", value: "+918178879587", label: "Naya Bazar Mobile" },
      { kind: "phone", value: "01171838799", label: "Naya Bazar" },
      { kind: "phone", value: "01145325500", label: "Lawrence Road" },
    ],
    products: [
      // Victoria sheet is ₹/kg for 30kg bags → store as ₹/qtl (×100) to match marketplace
      { cat: "Moong", sub: "Whole", title: "MOONG SABUT — Rajdhani", pack: "30 kg BOPP", price: 9650, stock: 40, image: IMG.moong },
      { cat: "Moong", sub: "Whole", title: "MOONG SABUT — Fiesta", pack: "30 kg BOPP", price: 9050, stock: 40, image: IMG.moong },
      { cat: "Moong", sub: "Chilka", title: "MOONG CHILKA — Rajdhani", pack: "30 kg BOPP", price: 10250, stock: 35, image: IMG.moong },
      { cat: "Moong", sub: "Chilka", title: "MOONG CHILKA — Fiesta", pack: "30 kg BOPP", price: 9750, stock: 35, image: IMG.moong },
      { cat: "Moong", sub: "Dhuli", title: "MOONG DHULI KORA — SELECT", pack: "30 kg BOPP", price: 9050, stock: 30, image: IMG.moong },
      { cat: "Moong", sub: "Dhuli", title: "MOONG DHULI KORA — Rajdhani", pack: "30 kg BOPP", price: 11550, stock: 30, image: IMG.moong },
      { cat: "Moong", sub: "Dhuli", title: "MOONG DHULI KORA — Fiesta", pack: "30 kg BOPP", price: 9900, stock: 30, image: IMG.moong },
      { cat: "Moong", sub: "Dhuli", title: "MOONG DHULI KORA — All Seasons", pack: "30 kg BOPP", price: 9150, stock: 30, image: IMG.moong },
      { cat: "Moong", sub: "Dhuli", title: "MOONG DHULI POLISH — SELECT", pack: "30 kg BOPP", price: 8950, stock: 25, image: IMG.moong },
      { cat: "Moong", sub: "Dhuli", title: "MOONG DHULI POLISH — Fiesta", pack: "30 kg BOPP", price: 9800, stock: 25, image: IMG.moong },
      { cat: "Moong", sub: "Dhuli", title: "MOONG DHULI POLISH — All Seasons", pack: "30 kg BOPP", price: 9050, stock: 25, image: IMG.moong },
      { cat: "Toor", sub: "Dal", title: "ARHAR DAL — SELECT", pack: "30 kg BOPP", price: 8750, stock: 40, image: IMG.toor },
      { cat: "Toor", sub: "Dal", title: "ARHAR DAL — Rajdhani", pack: "30 kg BOPP", price: 12200, stock: 40, image: IMG.toor },
      { cat: "Toor", sub: "Dal", title: "ARHAR DAL — Fiesta", pack: "30 kg BOPP", price: 11550, stock: 40, image: IMG.toor },
      { cat: "Toor", sub: "Dal", title: "ARHAR DAL — All Seasons", pack: "30 kg BOPP", price: 11200, stock: 40, image: IMG.toor },
      { cat: "Urad", sub: "Whole", title: "URAD SABUT — Rajdhani", pack: "30 kg BOPP", price: 11500, stock: 30, image: IMG.urad },
      { cat: "Urad", sub: "Whole", title: "URAD SABUT — Fiesta", pack: "30 kg BOPP", price: 10700, stock: 30, image: IMG.urad },
      { cat: "Urad", sub: "Chilka", title: "URAD CHILKA — Rajdhani", pack: "30 kg BOPP", price: 11900, stock: 25, image: IMG.urad },
      { cat: "Urad", sub: "Chilka", title: "URAD CHILKA — Fiesta", pack: "30 kg BOPP", price: 10900, stock: 25, image: IMG.urad },
      { cat: "Urad", sub: "Dhuli", title: "URAD DHULI — Rajdhani", pack: "30 kg BOPP", price: 13200, stock: 25, image: IMG.urad },
      { cat: "Urad", sub: "Dhuli", title: "URAD DHULI — Fiesta", pack: "30 kg BOPP", price: 12300, stock: 25, image: IMG.urad },
      { cat: "Chana", sub: "Dal", title: "CHANA DAL — Rajdhani", pack: "30 kg BOPP", price: 7600, stock: 40, image: IMG.chana },
      { cat: "Chana", sub: "Dal", title: "CHANA DAL — Fiesta", pack: "30 kg BOPP", price: 7400, stock: 40, image: IMG.chana },
      { cat: "Chana", sub: "Dal", title: "CHANA DAL — All Seasons", pack: "30 kg BOPP", price: 7300, stock: 40, image: IMG.chana },
      { cat: "Chana", sub: "Kala", title: "CHANA KALA — SELECT", pack: "30 kg BOPP", price: 7350, stock: 30, image: IMG.chana },
      { cat: "Chana", sub: "Kala", title: "CHANA KALA — Rajdhani", pack: "30 kg BOPP", price: 7900, stock: 30, image: IMG.chana },
      { cat: "Chana", sub: "Kala", title: "CHANA KALA — Fiesta", pack: "30 kg BOPP", price: 7200, stock: 30, image: IMG.chana },
      { cat: "Chana", sub: "Kabuli", title: "CHANA KABULI — Rajdhani", pack: "30 kg BOPP", price: 8350, stock: 25, image: IMG.chana },
      { cat: "Chana", sub: "Kabuli", title: "CHANA KABULI — Fiesta", pack: "30 kg BOPP", price: 8150, stock: 25, image: IMG.chana },
      { cat: "Chana", sub: "Kabuli", title: "CHANA KABULI — All Seasons", pack: "30 kg BOPP", price: 6850, stock: 25, image: IMG.chana },
      { cat: "Kabli", sub: "Garbanzo", title: "KABULI $$$ — SELECT", pack: "30 kg BOPP", price: 10300, stock: 20, image: IMG.kabli },
      { cat: "Kabli", sub: "Garbanzo", title: "KABULI $$$ — Rajdhani", pack: "30 kg BOPP", price: 11000, stock: 20, image: IMG.kabli },
      { cat: "Kabli", sub: "Garbanzo", title: "KABULI $$$ — Fiesta", pack: "30 kg BOPP", price: 9000, stock: 20, image: IMG.kabli },
      { cat: "Masoor", sub: "Whole", title: "MASOOR SABUT — Rajdhani", pack: "30 kg BOPP", price: 9400, stock: 30, image: IMG.masoor },
      { cat: "Masoor", sub: "Whole", title: "MASOOR SABUT — Fiesta", pack: "30 kg BOPP", price: 7050, stock: 30, image: IMG.masoor },
      { cat: "Masoor", sub: "Malka", title: "MALKA KORA — Rajdhani", pack: "30 kg BOPP", price: 7350, stock: 25, image: IMG.masoor },
      { cat: "Masoor", sub: "Malka", title: "MALKA POLISH — Rajdhani", pack: "30 kg BOPP", price: 7250, stock: 25, image: IMG.masoor },
      { cat: "Masoor", sub: "Dal", title: "MASRI DAL POLISH — Rajdhani", pack: "30 kg BOPP", price: 7950, stock: 25, image: IMG.masoor },
      { cat: "Masoor", sub: "Dal", title: "MASRI DAL POLISH — Fiesta", pack: "30 kg BOPP", price: 8150, stock: 25, image: IMG.masoor },
      { cat: "Moong", sub: "Whole", title: "MOTH SABUT — Rajdhani", pack: "30 kg BOPP", price: 9000, stock: 20, image: IMG.moong },
      { cat: "Rajma", sub: "Chitra", title: "RAJMA CHITRA — Rajdhani", pack: "30 kg BOPP", price: 12700, stock: 20, image: IMG.rajma },
      { cat: "Rajma", sub: "Chitra", title: "RAJMA CHITRA — Fiesta", pack: "30 kg BOPP", price: 10100, stock: 20, image: IMG.rajma },
      { cat: "Rajma", sub: "Rajma Lal", title: "RAJMA LAL — Rajdhani", pack: "30 kg BOPP", price: 12050, stock: 20, image: IMG.rajma },
      { cat: "Rajma", sub: "Srinagar", title: "RAJMA SRINAGAR — Rajdhani", pack: "30 kg BOPP", price: 10100, stock: 20, image: IMG.rajma },
      { cat: "Rajma", sub: "Srinagar", title: "RAJMA SRINAGAR — Fiesta", pack: "30 kg BOPP", price: 7900, stock: 20, image: IMG.rajma },
      { cat: "Lobiya", sub: "Safed", title: "LOBHIYA SAFED — Rajdhani", pack: "30 kg BOPP", price: 8200, stock: 25, image: IMG.lobiya },
      { cat: "Lobiya", sub: "Lal", title: "LOBHIYA LAL — Rajdhani", pack: "30 kg BOPP", price: 10200, stock: 25, image: IMG.lobiya },
      { cat: "Matar", sub: "Safed", title: "MATAR SAFED — Rajdhani", pack: "30 kg BOPP", price: 4950, stock: 30, image: IMG.matar },
      { cat: "Matar", sub: "Hari", title: "MATAR HARA — Rajdhani", pack: "30 kg BOPP", price: 5700, stock: 30, image: IMG.matar },
      { cat: "Masoor", sub: "Dal", title: "MIX DAL — Rajdhani", pack: "30 kg BOPP", price: 9400, stock: 25, image: IMG.masoor },
      { cat: "Masoor", sub: "Dal", title: "WHOLE DAL MIX — Rajdhani", pack: "30 kg BOPP", price: 9200, stock: 25, image: IMG.masoor },
      { cat: "Masoor", sub: "Malka", title: "MALKA CHANTI — All Seasons", pack: "30 kg BOPP", price: 8350, stock: 20, image: IMG.masoor },
      { cat: "Moong", sub: "Dhuli", title: "MOONG DAL TUKDI — Rajdhani", pack: "30 kg BOPP", price: 6150, stock: 20, image: IMG.moong },
      { cat: "Toor", sub: "Tukdi", title: "ARHAR DAL TUKDI — Rajdhani", pack: "30 kg BOPP", price: 6200, stock: 20, image: IMG.toor },
      { cat: "Masoor", sub: "Dal", title: "MASOOR DAL TUKDI — Rajdhani", pack: "30 kg BOPP", price: 6500, stock: 20, image: IMG.masoor },
      { cat: "Masoor", sub: "Dal", title: "MASOOR BOLD TUKDI — Rajdhani", pack: "30 kg BOPP", price: 6750, stock: 20, image: IMG.masoor },
      { cat: "Matar", sub: "Safed", title: "MATAR DAL — Rajdhani", pack: "30 kg BOPP", price: 5050, stock: 20, image: IMG.matar },
      { cat: "Moong", sub: "Talai", title: "MOONG TALAI — Rajdhani", pack: "30 kg BOPP", price: 12150, stock: 20, image: IMG.moong },
    ],
  },
  {
    phone: "+919811316851",
    name: "Parkash Pulses",
    slug: "parkash-pulses",
    description: "Parkash Pulses / Cherry Pulses / Parkash Food / Sunbeam — malka, moong chilka, masoor, moong sabut & chana. Family mill network across NCR.",
    city: "Delhi",
    pincode: "110006",
    addressLine: "Delhi NCR mills & godowns",
    note: "Rate list 13.07.2026 · 03:40 PM. Confirm stock & mill before lifting. Items marked N/A — please ring the seller.",
    banner: IMG.shop3,
    logo: IMG.logo3,
    verified: true,
    contacts: [
      { kind: "phone", value: "+919811316851", label: "Sunil Bansal" },
      { kind: "phone", value: "+919811316852", label: "Sunil Bansal 2" },
      { kind: "phone", value: "+919999990587", label: "Vishal Bansal" },
      { kind: "phone", value: "+918383813459", label: "Vishal Bansal 2" },
      { kind: "phone", value: "+919810820275", label: "Mayank Bansal" },
      { kind: "phone", value: "+918383970503", label: "Ashish Bansal Sales" },
      { kind: "phone", value: "+919911500420", label: "Amit Sharma" },
      { kind: "phone", value: "+919971634075", label: "Chander Shekhar" },
    ],
    products: [
      { cat: "Masoor", sub: "Malka", title: "Malka Kori Bold (Orange)", pack: "quintal", price: null, stock: 10, image: IMG.masoor },
      { cat: "Masoor", sub: "Malka", title: "Malka Kori (Black)", pack: "quintal", price: 7600, stock: 30, image: IMG.masoor },
      { cat: "Masoor", sub: "Malka", title: "Malka Polish (Blue)", pack: "quintal", price: 7500, stock: 30, image: IMG.masoor },
      { cat: "Moong", sub: "Chilka", title: "Cherry Moong Chilka Bold (Red)", pack: "quintal", price: 10150, stock: 35, image: IMG.moong },
      { cat: "Moong", sub: "Chilka", title: "Cherry Moong Chilka Moti (Green)", pack: "quintal", price: 9750, stock: 35, image: IMG.moong },
      { cat: "Moong", sub: "Chilka", title: "Cherry Moong Chilka Choti (Purple)", pack: "quintal", price: 9250, stock: 35, image: IMG.moong },
      { cat: "Masoor", sub: "Dal", title: "Dall Moti Polish (Brown)", pack: "quintal", price: 7600, stock: 25, image: IMG.masoor },
      { cat: "Masoor", sub: "Dal", title: "Dall Medium Kori (Red)", pack: "quintal", price: null, stock: 15, image: IMG.masoor },
      { cat: "Masoor", sub: "Dal", title: "Dall Medium Polish (Green)", pack: "quintal", price: null, stock: 15, image: IMG.masoor },
      { cat: "Masoor", sub: "Dal", title: "Dall Medium W/P (Yellow)", pack: "quintal", price: null, stock: 15, image: IMG.masoor },
      { cat: "Masoor", sub: "Dal", title: "Dall Baarik Kori (Black)", pack: "quintal", price: 11000, stock: 20, image: IMG.masoor },
      { cat: "Masoor", sub: "Dal", title: "Dall Baarik Polish (Purple)", pack: "quintal", price: null, stock: 15, image: IMG.masoor },
      { cat: "Masoor", sub: "Dal", title: "Dall Baarik W/P (Blue)", pack: "quintal", price: null, stock: 15, image: IMG.masoor },
      { cat: "Masoor", sub: "Dal", title: "Dall Ginni (Golden)", pack: "quintal", price: 11500, stock: 20, image: IMG.masoor },
      { cat: "Moong", sub: "Whole", title: "Moong Sabut Bold (Orange)", pack: "quintal", price: 9550, stock: 40, image: IMG.moong },
      { cat: "Moong", sub: "Whole", title: "Moong Sabut Moti (Green)", pack: "quintal", price: 9250, stock: 40, image: IMG.moong },
      { cat: "Moong", sub: "Whole", title: "Moong Sabut Choti (Blue)", pack: "quintal", price: 8750, stock: 40, image: IMG.moong },
      { cat: "Masoor", sub: "Whole", title: "Masoor Bold (Green)", pack: "quintal", price: null, stock: 15, image: IMG.masoor },
      { cat: "Masoor", sub: "Whole", title: "Masoor Medium Kori (Silver) NEW", pack: "quintal", price: 7300, stock: 30, image: IMG.masoor },
      { cat: "Masoor", sub: "Whole", title: "Masoor Polish (Orange) NEW", pack: "quintal", price: 7300, stock: 30, image: IMG.masoor },
      { cat: "Masoor", sub: "Whole", title: "Masoor Baarik Kori (Golden) NEW", pack: "quintal", price: null, stock: 15, image: IMG.masoor },
      { cat: "Masoor", sub: "Whole", title: "Masoor Baarik Polish (Blue) NEW", pack: "quintal", price: null, stock: 15, image: IMG.masoor },
      { cat: "Moong", sub: "Talai", title: "Moong Talai Bold", pack: "quintal", price: null, stock: 10, image: IMG.moong },
      { cat: "Moong", sub: "Talai", title: "Moong Talai Moti", pack: "quintal", price: null, stock: 10, image: IMG.moong },
      { cat: "Moong", sub: "Talai", title: "Moong Talai Choti (Orange)", pack: "quintal", price: 9100, stock: 25, image: IMG.moong },
      { cat: "Moong", sub: "Dhowa", title: "Moong Dhowa Mota (Green)", pack: "quintal", price: 10400, stock: 25, image: IMG.moong },
      { cat: "Moong", sub: "Dhowa", title: "Moong Dhowa Chota (Blue)", pack: "quintal", price: 9000, stock: 25, image: IMG.moong },
      { cat: "Masoor", sub: "Malka", title: "Imported Malka Kori (Orange)", pack: "quintal", price: 7250, stock: 30, image: IMG.masoor },
      { cat: "Masoor", sub: "Malka", title: "Imported Malka Polish (Green)", pack: "quintal", price: 7150, stock: 30, image: IMG.masoor },
      { cat: "Masoor", sub: "Dal", title: "Imported Masoor Dall Moti (Blue)", pack: "quintal", price: null, stock: 10, image: IMG.masoor },
      { cat: "Masoor", sub: "Dal", title: "Imported Masoor Dall Moti (Pink)", pack: "quintal", price: null, stock: 10, image: IMG.masoor },
      { cat: "Masoor", sub: "Whole", title: "Imported Masoor Sabut (Grey)", pack: "quintal", price: null, stock: 10, image: IMG.masoor },
      { cat: "Chana", sub: "Whole", title: "Chana Chappa Dhotiwala (Brown)", pack: "quintal", price: null, stock: 15, image: IMG.chana },
      { cat: "Chana", sub: "Whole", title: "Chana Annagiri Dhotiwala", pack: "quintal", price: 7200, stock: 30, image: IMG.chana },
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
    await recordProductPrice(productId, p.price != null ? toPaise(p.price) : null, {
      source: "seed",
    });
  }
  console.log(`  ✓ ${shop.name} (shop #${shopId})`);
}

// Backfill stock-style history (~14 trading days) so charts look alive
console.log("Backfilling price history for charts…");
const liveProducts = await query<RowDataPacket & { id: number; price_paise: number | null }>(
  `SELECT id, price_paise FROM products WHERE status = 'live'`
);

const needBackfill: Array<{ id: number; price_paise: number | null }> = [];
for (const prod of liveProducts) {
  const countRow = await queryOne<RowDataPacket & { n: number }>(
    `SELECT COUNT(*) AS n FROM product_price_history WHERE product_id = ?`,
    [prod.id]
  );
  if ((countRow?.n ?? 0) < 8) needBackfill.push(prod);
}

const CHUNK = 40;
for (let i = 0; i < needBackfill.length; i += CHUNK) {
  const chunk = needBackfill.slice(i, i + CHUNK);
  const ids = chunk.map((p) => p.id);
  if (ids.length) {
    await execute(
      `DELETE FROM product_price_history WHERE product_id IN (${ids.map(() => "?").join(",")})`,
      ids
    );
  }
  const values: unknown[] = [];
  const placeholders: string[] = [];
  for (const prod of chunk) {
    if (prod.price_paise == null) {
      placeholders.push("(?, NULL, 'seed', ?)");
      values.push(prod.id, new Date());
      continue;
    }
    const base = prod.price_paise;
    for (let daysAgo = 13; daysAgo >= 0; daysAgo--) {
      const wobble =
        1 + Math.sin(prod.id * 0.7 + daysAgo) * 0.035 + (daysAgo % 3 === 0 ? 0.012 : -0.008);
      const paise = daysAgo === 0 ? base : Math.max(100, Math.round(base * wobble));
      const at = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
      placeholders.push("(?, ?, 'seed', ?)");
      values.push(prod.id, paise, at);
    }
  }
  if (placeholders.length) {
    await execute(
      `INSERT INTO product_price_history (product_id, price_paise, source, recorded_at)
       VALUES ${placeholders.join(",")}`,
      values
    );
  }
  console.log(`  history ${Math.min(i + CHUNK, needBackfill.length)}/${needBackfill.length}`);
}

console.log(`✅ Seed complete. Product photos at ${APP}/uploads/seed/`);
await pool.end();
