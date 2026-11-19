# DIAMOND STORE — Production Deployment Guide

## Architecture Summary
- **Frontend**: React 19 + TypeScript + Tailwind CSS v4 + Vite
- **Server / API**: Node.js + Express (`server.ts`, port `3000` or `$PORT`)
- **Database & Auth**: Firebase Firestore & Firebase Authentication (`firebase-applet-config.json`, `firestore.rules`)
- **Server Encrypted Vault**: `.data/vault.json` (AES-256-GCM encrypted payment secret keys, webhook secrets, email/WhatsApp tokens, `scrypt` password hashes)
- **Payment Adapters**: Real HTTP integrations for Paystack, Flutterwave, Stripe, plus Direct Bank Transfer and Cash on Delivery.

---

## 1. Environment Variables
Configure these variables in your hosting provider's secret/environment panel (never commit secrets to Git):

| Variable | Required | Description |
| :--- | :--- | :--- |
| `PORT` | Optional | Defaults to `3000`. Set by Render/Railway/Cloud Run automatically. |
| `NODE_ENV` | Production | Set to `production` to serve optimized `/dist` assets. |
| `APP_URL` | Recommended | Public HTTPS URL of your deployment (e.g., `https://diamondstore.ng`) for sitemap, webhook references, and payment callbacks. |
| `VAULT_MASTER_KEY` | Recommended | 64-char hex or strong passphrase used to derive the AES-256-GCM master encryption key for `.data/vault.json`. |
| `SESSION_SIGNING_SECRET` | Recommended | Random 64-char secret for signing server HMAC session tokens. |
| `PAYSTACK_SECRET_KEY` | Optional | Fallback if not configured via Admin -> Payment Gateways. |
| `FLUTTERWAVE_SECRET_KEY` | Optional | Fallback if not configured via Admin -> Payment Gateways. |
| `STRIPE_SECRET_KEY` | Optional | Fallback if not configured via Admin -> Payment Gateways. |

---

## 2. Production Build & Start Commands
```bash
npm install
npm run build
NODE_ENV=production npm start
```
`npm run build` compiles the Vite React bundle into `/dist` (and copies `/src/assets` into `/dist/src/assets`).  
`npm start` launches `node server.ts` (Node 22 native TypeScript support).

---

## 3. Hosting Compatibility

### Option A: Render / Railway / Fly.io / VPS (Full-Stack Node.js)
1. Connect your repository.
2. Build Command: `npm install && npm run build`
3. Start Command: `npm start`
4. Mount persistent disk storage at `/app/.data` and `/app/public/uploads` so encrypted secrets and uploaded product imagery persist across restarts.
5. Configure your custom domain with HTTPS/SSL enabled.

### Option B: Shared / Cloud Hosting (e.g., Hostinger Node.js VPS or Cloud)
1. Point Node.js application root to project folder, entry point `server.ts`.
2. Ensure Node.js `v22+` is active (`node -v`).
3. Put Nginx/Cloudflare in front forwarding `https://yourdomain.com` -> `http://127.0.0.1:3000`.

### Option C: Firebase Hosting / Vercel
- Deploy static frontend from `dist/` or route `/api/*` and `/uploads/*` to your Cloud Run / Express server endpoint.

---

## 4. First-Time Super Administrator Initialization
1. Open `https://your-domain/admin/login`.
2. Because no admin account exists yet, the **First-Time Super Admin Setup** screen appears automatically.
3. Create the primary Super Administrator account.
4. Immediately afterward, public admin registration locks permanently (`403 Forbidden` on `/api/admin-auth/init`). Additional staff (`store_manager`, `content_manager`) can only be added inside **Admin Dashboard -> Staff & Audit Logs**.

---

## 5. Payment Webhooks Configuration
Once deployed over HTTPS, register these webhook URLs in each payment provider's dashboard:
- **Paystack**: `https://your-domain/api/webhooks/paystack`
- **Flutterwave**: `https://your-domain/api/webhooks/flutterwave`
- **Stripe**: `https://your-domain/api/webhooks/stripe`

Always use **Test Connection** inside **Admin Dashboard -> Payment Gateways** after entering keys to verify live HTTP authentication before switching a gateway from `test` to `live` mode.

---

## 6. Database Security & Backups
- Validate rules before any rules edit: `npx eslint firestore.rules`
- Enable scheduled Firestore exports in Google Cloud Console -> Firestore -> Import/Export.
- Periodically back up `.data/vault.json` and `public/uploads/` to encrypted object storage.
