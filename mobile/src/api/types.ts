export type Me = {
  id: number;
  phone: string;
  onboarded: boolean;
  shopId: number | null;
};

export type Category = {
  id: number;
  name: string;
  tagline: string | null;
  iconUrl: string | null;
  itemCount: number;
};

export type Subcategory = {
  id: number;
  name: string;
  iconUrl?: string | null;
  itemCount: number;
};

export type ProductListItem = {
  id: number;
  title: string;
  packSize: string | null;
  pricePaise: number | null;
  inStock: number;
  shopId: number;
  category: string;
  subcategory: string | null;
  shopName: string;
  shopCity: string | null;
  shopRating: string | null;
  coverUrl: string | null;
};

export type ProductDetail = {
  id: number;
  title: string;
  description: string | null;
  packSize: string | null;
  pricePaise: number | null;
  mrpPaise: number | null;
  inStock: number;
  stockUnits: number | null;
  categoryId: number;
  category: string;
  subcategoryId: number | null;
  subcategory: string | null;
  shopId: number;
  shopName: string;
  shopCity: string | null;
  shopRating: string | null;
  shopVerified: number;
  shopSlug: string;
  photos: { url: string; isCover: number; position: number }[];
  sellerPhones: { value: string; label: string | null }[];
  sellerEmails?: { value: string; label: string | null }[];
};

export type CartItem = {
  id: number;
  quantity: number;
  productId: number;
  title: string;
  packSize: string | null;
  pricePaise: number;
  inStock: number;
  shopId: number;
  shopName: string;
  coverUrl: string | null;
};

export type Cart = {
  items: CartItem[];
  totalPaise: number;
  totalDisplay: string;
};

export type NotificationItem = {
  id: number;
  type: string;
  title: string;
  body: string;
  data: Record<string, unknown> | null;
  isRead: number;
  createdAt: string;
};

export type OrderSummary = {
  id: number;
  orderNumber: string;
  status: string;
  itemsCount: number;
  totalPaise: number;
  createdAt: string;
  shopName?: string;
  buyerPhone?: string;
};

export type Shop = {
  id: number;
  slug: string;
  name: string;
  description: string | null;
  bannerUrl: string | null;
  logoUrl: string | null;
  addressLine: string | null;
  city: string | null;
  pincode: string | null;
  noteForBuyers: string | null;
  isVerified: number;
  ratingAvg: string;
  ratingCount: number;
  yearsOnPlatform: number;
  contacts: { kind: string; value: string; label?: string | null }[];
  products: ProductListItem[];
  productCount: number;
};
