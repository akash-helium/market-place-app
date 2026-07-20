-- ============================================================
-- HarvestHub schema  (MySQL 8+)
-- Maps 1:1 to the "helpers" in section 5 of the proposal:
--   SMS service, Login keeper, Profile keeper, Photo storage,
--   Product list, Bulk upload helper, Cart & order, Payment,
--   Notification, Ratings, KYC, Search, Location, Customer chat,
--   Share link.
-- ============================================================

CREATE DATABASE IF NOT EXISTS harvesthub
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE harvesthub;

-- ---------- Login keeper / SMS service ----------
CREATE TABLE IF NOT EXISTS users (
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  phone         VARCHAR(20)  NOT NULL UNIQUE,        -- E.164, e.g. +919810817196
  is_verified   TINYINT(1)   NOT NULL DEFAULT 0,
  onboarded     TINYINT(1)   NOT NULL DEFAULT 0,     -- finished "Set up your shop"?
  created_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS otp_codes (
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  phone         VARCHAR(20)  NOT NULL,
  code_hash     CHAR(64)     NOT NULL,               -- sha256(code), never store plain
  attempts      TINYINT      NOT NULL DEFAULT 0,
  expires_at    DATETIME     NOT NULL,
  consumed_at   DATETIME     NULL,
  created_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_otp_phone (phone, created_at)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS sessions (
  id            CHAR(21)     PRIMARY KEY,            -- nanoid, embedded in JWT (jti)
  user_id       BIGINT UNSIGNED NOT NULL,
  device_info   VARCHAR(255) NULL,
  revoked_at    DATETIME     NULL,
  created_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_seen_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_sessions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_sessions_user (user_id)
) ENGINE=InnoDB;

-- ---------- Profile keeper ----------
CREATE TABLE IF NOT EXISTS shops (
  id             BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id        BIGINT UNSIGNED NOT NULL UNIQUE,
  slug           VARCHAR(80)  NOT NULL UNIQUE,       -- for the WhatsApp share link
  name           VARCHAR(150) NOT NULL,              -- "Rajat & Company Commodities Pvt Ltd"
  description    TEXT         NULL,                  -- what you sell, since when, certificates
  banner_url     VARCHAR(500) NULL,                  -- big banner photo
  logo_url       VARCHAR(500) NULL,                  -- small logo/photo
  address_line   VARCHAR(255) NULL,                  -- street/area
  city           VARCHAR(100) NULL,
  pincode        VARCHAR(10)  NULL,
  note_for_buyers TEXT        NULL,                  -- yellow "Note from seller" box
  is_verified    TINYINT(1)   NOT NULL DEFAULT 0,    -- green tick after KYC
  rating_avg     DECIMAL(2,1) NOT NULL DEFAULT 0.0,  -- e.g. 4.8
  rating_count   INT UNSIGNED NOT NULL DEFAULT 0,
  created_at     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_shops_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_shops_name (name)
) ENGINE=InnoDB;

-- "you can add more than one" phone/email
CREATE TABLE IF NOT EXISTS shop_contacts (
  id        BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  shop_id   BIGINT UNSIGNED NOT NULL,
  kind      ENUM('phone','email') NOT NULL,
  value     VARCHAR(150) NOT NULL,
  label     VARCHAR(50)  NULL,                       -- "Ratan", "Sanjay", "Naveen"
  CONSTRAINT fk_contacts_shop FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE,
  INDEX idx_contacts_shop (shop_id)
) ENGINE=InnoDB;

-- ---------- Location service ----------
CREATE TABLE IF NOT EXISTS shop_delivery_areas (
  id       BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  shop_id  BIGINT UNSIGNED NOT NULL,
  pincode  VARCHAR(10) NOT NULL,
  UNIQUE KEY uq_shop_pin (shop_id, pincode),
  CONSTRAINT fk_delivery_shop FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---------- Product list ----------
CREATE TABLE IF NOT EXISTS categories (
  id        INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name      VARCHAR(80)  NOT NULL UNIQUE,            -- Rajma, Kabli, Chana...
  tagline   VARCHAR(150) NULL,                       -- "Chitra, Lal varieties"
  icon_url  VARCHAR(500) NULL,
  sort_order INT NOT NULL DEFAULT 0
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS subcategories (
  id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  category_id  INT UNSIGNED NOT NULL,
  name         VARCHAR(80) NOT NULL,                 -- Chitra, Rajma Lal...
  icon_url     VARCHAR(500) NULL,
  UNIQUE KEY uq_subcat (category_id, name),
  CONSTRAINT fk_subcat_cat FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS products (
  id             BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  shop_id        BIGINT UNSIGNED NOT NULL,
  category_id    INT UNSIGNED NOT NULL,
  subcategory_id INT UNSIGNED NULL,
  title          VARCHAR(200) NOT NULL,              -- "Chitra Pila Badshah"
  description    TEXT NULL,                          -- quality, origin, packaging, shelf life
  pack_size      VARCHAR(50) NULL,                   -- "30 kg"
  price_paise    BIGINT UNSIGNED NULL,               -- NULL => shows "N/A", ring the seller
  mrp_paise      BIGINT UNSIGNED NULL,
  in_stock       TINYINT(1) NOT NULL DEFAULT 1,
  stock_units    INT UNSIGNED NULL,                  -- for "Low stock" alerts
  status         ENUM('live','draft','removed') NOT NULL DEFAULT 'live',
  created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_products_shop   FOREIGN KEY (shop_id)        REFERENCES shops(id)        ON DELETE CASCADE,
  CONSTRAINT fk_products_cat    FOREIGN KEY (category_id)    REFERENCES categories(id),
  CONSTRAINT fk_products_subcat FOREIGN KEY (subcategory_id) REFERENCES subcategories(id) ON DELETE SET NULL,
  INDEX idx_products_browse (category_id, subcategory_id, status),
  INDEX idx_products_shop (shop_id, status),
  INDEX idx_products_title (title)
) ENGINE=InnoDB;

-- ---------- Photo storage ----------
CREATE TABLE IF NOT EXISTS product_photos (
  id         BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  product_id BIGINT UNSIGNED NOT NULL,
  url        VARCHAR(500) NOT NULL,
  is_cover   TINYINT(1) NOT NULL DEFAULT 0,          -- "first photo is the cover"
  position   TINYINT NOT NULL DEFAULT 0,             -- up to 4 photos
  CONSTRAINT fk_photos_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  INDEX idx_photos_product (product_id)
) ENGINE=InnoDB;

-- ---------- Price history (stock-style chart) ----------
-- One row per price change (and initial list). NULL price_paise = N/A.
CREATE TABLE IF NOT EXISTS product_price_history (
  id           BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  product_id   BIGINT UNSIGNED NOT NULL,
  price_paise  BIGINT UNSIGNED NULL,
  mrp_paise    BIGINT UNSIGNED NULL,
  source       ENUM('create','edit','bulk','seed','adjust') NOT NULL DEFAULT 'edit',
  recorded_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_pph_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  INDEX idx_pph_product_time (product_id, recorded_at)
) ENGINE=InnoDB;

-- ---------- Bulk upload helper ----------
CREATE TABLE IF NOT EXISTS bulk_uploads (
  id           BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  shop_id      BIGINT UNSIGNED NOT NULL,
  filename     VARCHAR(255) NOT NULL,
  total_rows   INT NOT NULL DEFAULT 0,
  ok_rows      INT NOT NULL DEFAULT 0,
  failed_rows  INT NOT NULL DEFAULT 0,
  errors_json  JSON NULL,
  created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_bulk_shop FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---------- Cart and order ----------
CREATE TABLE IF NOT EXISTS carts (
  id         BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id    BIGINT UNSIGNED NOT NULL UNIQUE,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_cart_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS cart_items (
  id         BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  cart_id    BIGINT UNSIGNED NOT NULL,
  product_id BIGINT UNSIGNED NOT NULL,
  quantity   INT UNSIGNED NOT NULL DEFAULT 1,
  UNIQUE KEY uq_cart_product (cart_id, product_id),
  CONSTRAINT fk_ci_cart    FOREIGN KEY (cart_id)    REFERENCES carts(id)    ON DELETE CASCADE,
  CONSTRAINT fk_ci_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS orders (
  id             BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  order_number   VARCHAR(20) NOT NULL UNIQUE,        -- "#4821"
  buyer_id       BIGINT UNSIGNED NOT NULL,
  shop_id        BIGINT UNSIGNED NOT NULL,           -- one order per shop (cart is split)
  status         ENUM('pending_payment','placed','confirmed','dispatched','delivered','cancelled')
                 NOT NULL DEFAULT 'pending_payment',
  items_count    INT UNSIGNED NOT NULL,
  total_paise    BIGINT UNSIGNED NOT NULL,
  delivery_address VARCHAR(500) NULL,
  delivery_pincode VARCHAR(10)  NULL,
  created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_orders_buyer FOREIGN KEY (buyer_id) REFERENCES users(id),
  CONSTRAINT fk_orders_shop  FOREIGN KEY (shop_id)  REFERENCES shops(id),
  INDEX idx_orders_buyer (buyer_id, created_at),
  INDEX idx_orders_shop  (shop_id, created_at)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS order_items (
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  order_id      BIGINT UNSIGNED NOT NULL,
  product_id    BIGINT UNSIGNED NULL,
  title_snapshot VARCHAR(200) NOT NULL,              -- keep name/price even if product changes
  price_paise   BIGINT UNSIGNED NOT NULL,
  quantity      INT UNSIGNED NOT NULL,
  CONSTRAINT fk_oi_order   FOREIGN KEY (order_id)   REFERENCES orders(id)   ON DELETE CASCADE,
  CONSTRAINT fk_oi_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ---------- Payment service ----------
CREATE TABLE IF NOT EXISTS payments (
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  order_id      BIGINT UNSIGNED NOT NULL,
  provider      VARCHAR(30) NOT NULL,                -- mock / razorpay ...
  provider_ref  VARCHAR(100) NULL,                   -- gateway order/payment id
  amount_paise  BIGINT UNSIGNED NOT NULL,
  status        ENUM('created','paid','failed','refunded','settled') NOT NULL DEFAULT 'created',
  settled_at    DATETIME NULL,                       -- "₹12,480 settled to your bank"
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_pay_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  INDEX idx_pay_order (order_id)
) ENGINE=InnoDB;

-- ---------- Notification service (the bell) ----------
CREATE TABLE IF NOT EXISTS notifications (
  id         BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id    BIGINT UNSIGNED NOT NULL,
  type       ENUM('order','query','payout','review','low_stock','pricing_tip','system') NOT NULL,
  title      VARCHAR(150) NOT NULL,                  -- "New order received"
  body       VARCHAR(500) NULL,                      -- "Order #4821 · 3 items · ₹540"
  data_json  JSON NULL,                              -- deep-link payload
  is_read    TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_notif_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_notif_user (user_id, is_read, created_at)
) ENGINE=InnoDB;

-- Push tokens so alerts arrive "even when the app is closed"
CREATE TABLE IF NOT EXISTS push_tokens (
  id       BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id  BIGINT UNSIGNED NOT NULL,
  token    VARCHAR(255) NOT NULL,
  platform ENUM('android','ios','web') NOT NULL DEFAULT 'android',
  UNIQUE KEY uq_push_token (token),
  CONSTRAINT fk_push_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---------- Ratings ----------
CREATE TABLE IF NOT EXISTS reviews (
  id         BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  shop_id    BIGINT UNSIGNED NOT NULL,
  user_id    BIGINT UNSIGNED NOT NULL,
  order_id   BIGINT UNSIGNED NULL,
  stars      TINYINT UNSIGNED NOT NULL,              -- 1..5
  comment    VARCHAR(1000) NULL,                     -- "Fresh and fast delivery"
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_review_order (user_id, order_id),
  CONSTRAINT fk_rev_shop  FOREIGN KEY (shop_id)  REFERENCES shops(id)  ON DELETE CASCADE,
  CONSTRAINT fk_rev_user  FOREIGN KEY (user_id)  REFERENCES users(id)  ON DELETE CASCADE,
  CONSTRAINT fk_rev_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL,
  INDEX idx_rev_shop (shop_id, created_at)
) ENGINE=InnoDB;

-- ---------- Customer chat (product queries) ----------
CREATE TABLE IF NOT EXISTS product_queries (
  id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  product_id  BIGINT UNSIGNED NOT NULL,
  shop_id     BIGINT UNSIGNED NOT NULL,
  buyer_id    BIGINT UNSIGNED NOT NULL,
  question    VARCHAR(1000) NOT NULL,                -- "bulk pricing for Premium Basmati?"
  reply       VARCHAR(1000) NULL,
  replied_at  DATETIME NULL,
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_q_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  CONSTRAINT fk_q_shop    FOREIGN KEY (shop_id)    REFERENCES shops(id)    ON DELETE CASCADE,
  CONSTRAINT fk_q_buyer   FOREIGN KEY (buyer_id)   REFERENCES users(id)    ON DELETE CASCADE,
  INDEX idx_q_shop (shop_id, created_at)
) ENGINE=InnoDB;

-- ---------- Verification (KYC) ----------
CREATE TABLE IF NOT EXISTS kyc_submissions (
  id           BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  shop_id      BIGINT UNSIGNED NOT NULL,
  doc_type     ENUM('FSSAI','GSTIN') NOT NULL,
  doc_number   VARCHAR(50) NOT NULL,
  doc_file_url VARCHAR(500) NULL,
  status       ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  reviewed_at  DATETIME NULL,
  reject_reason VARCHAR(255) NULL,
  created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_kyc_shop FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE,
  INDEX idx_kyc_shop (shop_id)
) ENGINE=InnoDB;

-- ---------- Photo storage index (uploaded files) ----------
CREATE TABLE IF NOT EXISTS uploads (
  id         BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id    BIGINT UNSIGNED NOT NULL,
  url        VARCHAR(500) NOT NULL,
  mime       VARCHAR(100) NOT NULL,
  size_bytes INT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_up_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;
