# Security Specification & Threat Model — DIAMOND STORE

## 1. Data Invariants
1. Customer PII (`users/{uid}`, `orders/{orderId}`) may only be read by the owning authenticated user (`request.auth.uid`) or an authorized administrator.
2. Customers cannot elevate their own role or write to `admins/{adminId}`. Only verified Super Admins (`graysolution4@gmail.com` or `admins/{uid}.role == 'super_admin'`) can provision or modify staff accounts.
3. Payment gateway secret API keys and webhook secrets are NEVER stored in Firestore `payment_gateways` documents; only public keys, display names, bank transfer details, and mode flags reside in Firestore.
4. `order_tracking_public/{orderNumber}` disables `list` queries (`allow list: if false`) to prevent order enumeration and never exposes full street addresses or raw emails.
5. All document IDs (`isValidId`) are bounded (`<= 128` chars) and alphanumeric/underscore/hyphen (`^[a-zA-Z0-9_\\-]+$`).
6. Every `create` and `update` enforces strict key allowlists (`hasAll`/`hasOnly` on create, `affectedKeys().hasOnly(...)` on update) and explicit size limits on every string and array.
7. Terminal order statuses (`Delivered`, `Cancelled`, `Refunded`) cannot be altered by non-admin clients.
8. `createdAt` is immutable after creation (`incoming().createdAt == existing().createdAt`).

## 2. The "Dirty Dozen" Adversarial Payloads
1. **Privilege Escalation on Admin Doc**: Customer writes `admins/{uid}` with `{ role: "super_admin", active: true }` -> `PERMISSION_DENIED`.
2. **Shadow Field Injection on User Profile**: User creates `users/{uid}` with extra field `{ isAdmin: true }` -> `PERMISSION_DENIED` (`hasOnly` rejects).
3. **Identity Spoofing on Order**: User A creates `orders/ord_1` with `userId: "user_B"` -> `PERMISSION_DENIED`.
4. **PII Blanket Read on Orders**: Unauthenticated or non-owner queries `orders` collection -> `PERMISSION_DENIED`.
5. **Email Spoof Attack**: Attacker sets email to admin email with `email_verified: false` -> `PERMISSION_DENIED`.
6. **ID Poisoning**: Attacker creates document with 1500-char or slash-injected ID -> `PERMISSION_DENIED` (`isValidId`).
7. **Denial of Wallet String Bomb**: User posts a 1MB `comment` on `reviews` -> `PERMISSION_DENIED` (`comment.size() <= 1000`).
8. **Unbounded Array Injection**: User writes `items` with 500 elements on `carts/{uid}` -> `PERMISSION_DENIED` (`items.size() <= 50`).
9. **Customer Modifying Order Payment Status**: User updates `orders/{orderId}` setting `paymentStatus: "paid"` -> `PERMISSION_DENIED`.
10. **Order Scraping via Tracking Projection**: Unauthenticated user runs `list` on `order_tracking_public` -> `PERMISSION_DENIED`.
11. **Temporal Tampering**: User creates review with backdated `createdAt` not matching `request.time` -> `PERMISSION_DENIED`.
12. **Audit Log Deletion**: Store Manager attempts to delete `admin_activity_logs/{logId}` -> `PERMISSION_DENIED` (logs are immutable).
