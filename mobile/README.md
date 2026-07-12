# HarvestHub Mobile (Expo)

React Native app for **iOS + Android**, wired to the HarvestHub backend API flow.

## Run

1. Backend must be running at port 3000 (`bun run dev` in repo root).
2. Start the app:

```bash
cd mobile
npm start
```

Then press `i` (iOS Simulator), `a` (Android emulator), or scan the QR with **Expo Go** on a phone.

### API URL on a physical phone

Expo auto-uses your machine’s LAN IP from the Metro host. If that fails, set in `mobile/.env`:

```env
EXPO_PUBLIC_API_URL=http://YOUR_LAN_IP:3000
```

Android emulator fallback: `http://10.0.2.2:3000`  
iOS simulator: `http://localhost:3000`

## Screens mapped to the guide

| Screen | Route |
|---|---|
| Phone (4.1) | `/(auth)/phone` |
| OTP (4.2) | `/(auth)/otp` |
| Shop setup (4.3) | `/(onboarding)/shop-setup` |
| Home (4.5) | `/(tabs)` |
| Subtypes (4.6) | `/category/[id]` |
| Product list (4.7) | `/products` |
| Product detail (4.8) | `/product/[id]` |
| Cart / checkout | `/(tabs)/cart`, `/checkout` |
| Seller page (4.9) | `/shop/[id]` |
| Sell / add (4.10) | `/(tabs)/sell`, `/sell/add` |
| Bell (4.11) | `/(tabs)/notifications` |
| Profile / edit | `/(tabs)/profile`, `/shop/edit` |
| Orders | `/orders`, `/orders/[id]` |

Dev OTP is printed in the **backend terminal**. Checkout uses **mock payment**.
