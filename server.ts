import crypto from 'crypto';
import dotenv from 'dotenv';
import express, { NextFunction, Request, Response } from 'express';
import { getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import fs from 'fs';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import firebaseConfig from './firebase-applet-config.json' with { type: 'json' };
import { buildBrandedEmailHtml, dispatchBrandedEmail } from './src/server/emailService.ts';
import {
  AVAILABLE_INTEGRATIONS,
  initializeProviderCheckout,
  testProviderConnection,
  verifyFlutterwaveSignature,
  verifyPaystackSignature,
  verifyProviderTransaction,
  verifyStripeSignature,
} from './src/server/paymentAdapters.ts';
import {
  decryptSecret,
  encryptSecret,
  hashPassword,
  maskSecret,
  readVault,
  ServerAdminRole,
  signSessionToken,
  verifyPassword,
  verifySessionToken,
  writeVault,
} from './src/server/vault.ts';

dotenv.config();

if (!getApps().length) {
  initializeApp({ projectId: firebaseConfig.projectId });
}
const adminAuth = getAuth();

const UPLOADS_DIR = path.resolve(process.cwd(), 'public', 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

interface AuthedRequest extends Request {
  authActor?: {
    uid: string;
    email: string;
    isAdmin: boolean;
    role?: ServerAdminRole;
  };
}

// Simple per-IP rate limiter for sensitive auth & payment routes
const rateBuckets = new Map<string, { count: number; resetAt: number }>();
function rateLimit(maxPerMinute: number) {
  return (req: Request, res: Response, next: NextFunction) => {
    const ip = req.ip || 'unknown';
    const key = `${ip}:${req.baseUrl}`;
    const now = Date.now();
    const bucket = rateBuckets.get(key);
    if (!bucket || bucket.resetAt < now) {
      rateBuckets.set(key, { count: 1, resetAt: now + 60_000 });
      return next();
    }
    if (bucket.count >= maxPerMinute) {
      return res.status(429).json({ error: 'Too many requests. Please try again in a minute.' });
    }
    bucket.count += 1;
    next();
  };
}

async function resolveActor(req: AuthedRequest): Promise<AuthedRequest['authActor'] | null> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7).trim();

  // 1. Try Server HMAC Session Token
  const serverSession = verifySessionToken(token);
  if (serverSession) {
    return {
      uid: serverSession.sub,
      email: serverSession.email,
      isAdmin: serverSession.kind === 'admin',
      role: serverSession.role,
    };
  }

  // 2. Try Firebase ID Token (requires no IAM)
  try {
    const decoded = await adminAuth.verifyIdToken(token);
    const email = (decoded.email || '').toLowerCase();
    const vault = readVault();
    const staffMatch = vault.admins.find((a) => a.email.toLowerCase() === email && a.active);
    const isBootstrapAdmin = email === 'graysolution4@gmail.com' && decoded.email_verified === true;
    return {
      uid: decoded.uid,
      email,
      isAdmin: Boolean(isBootstrapAdmin || staffMatch),
      role: isBootstrapAdmin ? 'super_admin' : staffMatch?.role,
    };
  } catch {
    return null;
  }
}

async function requireAdmin(req: AuthedRequest, res: Response, next: NextFunction) {
  const actor = await resolveActor(req);
  if (!actor || !actor.isAdmin) {
    return res.status(403).json({ error: 'Administrator privileges required.' });
  }
  req.authActor = actor;
  next();
}

async function requireSuperAdmin(req: AuthedRequest, res: Response, next: NextFunction) {
  const actor = await resolveActor(req);
  if (!actor || !actor.isAdmin || actor.role !== 'super_admin') {
    return res.status(403).json({ error: 'Super Administrator privileges required.' });
  }
  req.authActor = actor;
  next();
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  // Preserve raw body for webhook signature verification
  app.use(
    express.json({
      limit: '8mb',
      verify: (req: any, _res, buf) => {
        req.rawBody = buf.toString('utf8');
      },
    })
  );

  // Security headers
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  });

  // Serve uploaded assets permanently from /uploads
  app.use('/uploads', express.static(UPLOADS_DIR));

  // Health & SEO routes
  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, service: 'diamond-store-api', timestamp: new Date().toISOString() });
  });

  app.get('/robots.txt', (req, res) => {
    const base = process.env.APP_URL || `${req.protocol}://${req.get('host')}`;
    res.type('text/plain').send(`User-agent: *\nAllow: /\nDisallow: /admin\nSitemap: ${base}/sitemap.xml\n`);
  });

  app.get('/sitemap.xml', (req, res) => {
    const base = process.env.APP_URL || `${req.protocol}://${req.get('host')}`;
    const paths = [
      '/',
      '/shop',
      '/mens-clothing',
      '/shoes',
      '/accessories',
      '/new-arrivals',
      '/best-sellers',
      '/track-order',
      '/about',
      '/contact',
      '/faq',
      '/privacy-policy',
      '/terms',
      '/shipping-returns',
    ];
    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${paths
      .map((p) => `  <url><loc>${base}${p}</loc></url>`)
      .join('\n')}\n</urlset>`;
    res.type('application/xml').send(xml);
  });

  // Shared Mobile App (Expo / React Native) API Contract Descriptor
  app.get('/api/v1/mobile/manifest', (_req, res) => {
    res.json({
      brand: 'DIAMOND STORE',
      currency: 'NGN',
      firebaseProjectId: firebaseConfig.projectId,
      firestoreDatabaseId: firebaseConfig.firestoreDatabaseId,
      endpoints: {
        auth: ['/api/customer-auth/login', '/api/customer-auth/register'],
        payments: ['/api/payments/integrations', '/api/payments/initialize', '/api/payments/verify'],
        upload: '/api/upload',
      },
    });
  });

  // ==========================================================
  // 1. ADMIN AUTHENTICATION & FIRST-TIME SUPER ADMIN SETUP
  // ==========================================================
  app.get('/api/admin-auth/status', (_req, res) => {
    const vault = readVault();
    res.json({ initialized: vault.admins.length > 0 });
  });

  app.post('/api/admin-auth/init', rateLimit(15), (req, res) => {
    const vault = readVault();
    if (vault.admins.length > 0) {
      return res.status(403).json({ error: 'Public admin registration is disabled. Super Admin already exists.' });
    }
    const { fullName, email, password, confirmPassword } = req.body || {};
    if (!fullName || !email || !password || password !== confirmPassword) {
      return res.status(400).json({ error: 'Valid name, email, and matching passwords are required.' });
    }
    if (String(password).length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters.' });
    }
    const normalizedEmail = String(email).trim().toLowerCase();
    const record = {
      id: `adm_${crypto.randomBytes(8).toString('hex')}`,
      fullName: String(fullName).trim(),
      email: normalizedEmail,
      passwordHash: hashPassword(String(password)),
      role: 'super_admin' as ServerAdminRole,
      active: true,
      createdAt: new Date().toISOString(),
    };
    vault.admins.push(record);
    writeVault(vault);
    const token = signSessionToken({
      sub: record.id,
      email: record.email,
      fullName: record.fullName,
      kind: 'admin',
      role: record.role,
    });
    res.json({
      token,
      admin: { id: record.id, fullName: record.fullName, email: record.email, role: record.role },
    });
  });

  app.post('/api/admin-auth/login', rateLimit(20), (req, res) => {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }
    const vault = readVault();
    const normalized = String(email).trim().toLowerCase();
    const found = vault.admins.find((a) => a.email.toLowerCase() === normalized);
    if (!found || !verifyPassword(String(password), found.passwordHash)) {
      return res.status(401).json({ error: 'Invalid administrator credentials.' });
    }
    if (!found.active) {
      return res.status(403).json({ error: 'This administrator account has been suspended.' });
    }
    const token = signSessionToken({
      sub: found.id,
      email: found.email,
      fullName: found.fullName,
      kind: 'admin',
      role: found.role,
    });
    res.json({
      token,
      admin: { id: found.id, fullName: found.fullName, email: found.email, role: found.role },
    });
  });

  app.get('/api/admin-auth/me', async (req: AuthedRequest, res) => {
    const actor = await resolveActor(req);
    if (!actor || !actor.isAdmin) {
      return res.status(401).json({ error: 'Not authenticated as administrator.' });
    }
    res.json({ admin: actor });
  });

  app.get('/api/admin-auth/staff', requireSuperAdmin, (_req, res) => {
    const vault = readVault();
    res.json({
      staff: vault.admins.map((a) => ({
        id: a.id,
        fullName: a.fullName,
        email: a.email,
        role: a.role,
        active: a.active,
        createdAt: a.createdAt,
      })),
    });
  });

  app.post('/api/admin-auth/staff', requireSuperAdmin, (req, res) => {
    const { fullName, email, password, role } = req.body || {};
    if (!fullName || !email || !password || !['super_admin', 'store_manager', 'content_manager'].includes(role)) {
      return res.status(400).json({ error: 'Full name, email, password, and valid role are required.' });
    }
    const vault = readVault();
    const normalized = String(email).trim().toLowerCase();
    if (vault.admins.some((a) => a.email.toLowerCase() === normalized)) {
      return res.status(409).json({ error: 'An administrator with this email already exists.' });
    }
    const staff = {
      id: `adm_${crypto.randomBytes(8).toString('hex')}`,
      fullName: String(fullName).trim(),
      email: normalized,
      passwordHash: hashPassword(String(password)),
      role: role as ServerAdminRole,
      active: true,
      createdAt: new Date().toISOString(),
    };
    vault.admins.push(staff);
    writeVault(vault);
    res.json({
      staff: {
        id: staff.id,
        fullName: staff.fullName,
        email: staff.email,
        role: staff.role,
        active: staff.active,
        createdAt: staff.createdAt,
      },
    });
  });

  app.patch('/api/admin-auth/staff/:id', requireSuperAdmin, (req, res) => {
    const { id } = req.params;
    const { active, role } = req.body || {};
    const vault = readVault();
    const idx = vault.admins.findIndex((a) => a.id === id);
    if (idx === -1) return res.status(404).json({ error: 'Staff member not found.' });
    if (typeof active === 'boolean') vault.admins[idx].active = active;
    if (role && ['super_admin', 'store_manager', 'content_manager'].includes(role)) {
      vault.admins[idx].role = role;
    }
    writeVault(vault);
    res.json({ ok: true });
  });

  // ==========================================================
  // 2. CUSTOMER EMAIL/PASSWORD AUTH & PASSWORD RECOVERY
  // ==========================================================
  app.post('/api/customer-auth/register', rateLimit(20), (req, res) => {
    const { fullName, email, phone, password } = req.body || {};
    if (!fullName || !email || !password || String(password).length < 6) {
      return res.status(400).json({ error: 'Full name, email, and password (min 6 chars) are required.' });
    }
    const vault = readVault();
    const normalized = String(email).trim().toLowerCase();
    if (vault.customers.some((c) => c.email.toLowerCase() === normalized)) {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }
    const cust = {
      id: `cus_${crypto.randomBytes(8).toString('hex')}`,
      fullName: String(fullName).trim(),
      email: normalized,
      phone: phone ? String(phone).trim() : '',
      passwordHash: hashPassword(String(password)),
      status: 'active' as const,
      createdAt: new Date().toISOString(),
    };
    vault.customers.push(cust);
    writeVault(vault);
    const token = signSessionToken({
      sub: cust.id,
      email: cust.email,
      fullName: cust.fullName,
      kind: 'customer',
    });
    res.json({
      token,
      user: { uid: cust.id, fullName: cust.fullName, email: cust.email, phone: cust.phone },
    });
  });

  app.post('/api/customer-auth/login', rateLimit(30), (req, res) => {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }
    const vault = readVault();
    const normalized = String(email).trim().toLowerCase();
    const cust = vault.customers.find((c) => c.email.toLowerCase() === normalized);
    if (!cust || !verifyPassword(String(password), cust.passwordHash)) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }
    if (cust.status === 'suspended') {
      return res.status(403).json({ error: 'This account has been suspended. Please contact support.' });
    }
    const token = signSessionToken({
      sub: cust.id,
      email: cust.email,
      fullName: cust.fullName,
      kind: 'customer',
    });
    res.json({
      token,
      user: { uid: cust.id, fullName: cust.fullName, email: cust.email, phone: cust.phone },
    });
  });

  app.post('/api/customer-auth/forgot-password', rateLimit(10), async (req, res) => {
    const { email } = req.body || {};
    if (!email) return res.status(400).json({ error: 'Email is required.' });
    const vault = readVault();
    const normalized = String(email).trim().toLowerCase();
    const cust = vault.customers.find((c) => c.email.toLowerCase() === normalized);
    if (!cust) {
      return res.json({ ok: true, message: 'If an account matches this email, recovery instructions have been issued.' });
    }
    const resetCode = crypto.randomBytes(3).toString('hex').toUpperCase();
    cust.resetToken = resetCode;
    cust.resetTokenExpiresAt = Date.now() + 30 * 60 * 1000;
    writeVault(vault);

    const resendKey = decryptSecret(vault.notificationConfig.encryptedResendApiKey, vault);
    const html = buildBrandedEmailHtml({
      title: 'Password Reset Verification',
      greeting: `Hello ${cust.fullName},`,
      bodyLines: [
        `Use the verification code below to reset your Diamond Store password. This code expires in 30 minutes.`,
        `<strong style="font-size:20px;letter-spacing:0.2em;color:#111111;">${resetCode}</strong>`,
      ],
    });
    const emailRes = await dispatchBrandedEmail({
      resendApiKey: resendKey,
      fromEmail: vault.notificationConfig.fromEmail,
      to: cust.email,
      subject: 'Diamond Store – Password Reset Code',
      html,
    });

    res.json({
      ok: true,
      emailDelivered: emailRes.delivered,
      message: emailRes.delivered
        ? 'A password reset code has been emailed to you.'
        : 'Password reset initialized. Configure an email provider in Store Settings for automatic email delivery.',
    });
  });

  app.post('/api/customer-auth/reset-password', rateLimit(10), (req, res) => {
    const { email, code, newPassword } = req.body || {};
    if (!email || !code || !newPassword || String(newPassword).length < 6) {
      return res.status(400).json({ error: 'Email, reset code, and new password (min 6 chars) are required.' });
    }
    const vault = readVault();
    const normalized = String(email).trim().toLowerCase();
    const cust = vault.customers.find((c) => c.email.toLowerCase() === normalized);
    if (
      !cust ||
      !cust.resetToken ||
      cust.resetToken !== String(code).trim().toUpperCase() ||
      (cust.resetTokenExpiresAt || 0) < Date.now()
    ) {
      return res.status(400).json({ error: 'Invalid or expired reset code.' });
    }
    cust.passwordHash = hashPassword(String(newPassword));
    delete cust.resetToken;
    delete cust.resetTokenExpiresAt;
    writeVault(vault);
    res.json({ ok: true, message: 'Password updated successfully.' });
  });

  app.post('/api/customer-auth/change-password', rateLimit(15), async (req: AuthedRequest, res) => {
    const actor = await resolveActor(req);
    if (!actor) return res.status(401).json({ error: 'Authentication required.' });
    const { currentPassword, newPassword } = req.body || {};
    if (!currentPassword || !newPassword || String(newPassword).length < 6) {
      return res.status(400).json({ error: 'Current password and new password (min 6 chars) are required.' });
    }
    const vault = readVault();
    const cust = vault.customers.find((c) => c.email.toLowerCase() === actor.email.toLowerCase());
    if (!cust) {
      return res.status(400).json({ error: 'Google-linked accounts manage passwords via Google Account security.' });
    }
    if (!verifyPassword(String(currentPassword), cust.passwordHash)) {
      return res.status(401).json({ error: 'Current password is incorrect.' });
    }
    cust.passwordHash = hashPassword(String(newPassword));
    writeVault(vault);
    res.json({ ok: true });
  });

  // ==========================================================
  // 3. DYNAMIC PAYMENT GATEWAY VAULT, INITIALIZATION & VERIFICATION
  // ==========================================================
  app.get('/api/payments/integrations', (_req, res) => {
    res.json({ integrations: AVAILABLE_INTEGRATIONS });
  });

  app.get('/api/payments/admin/secrets', requireAdmin, (_req, res) => {
    const vault = readVault();
    const providers = ['paystack', 'flutterwave', 'stripe'] as const;
    const summary = providers.map((provider) => {
      const rec = vault.providerSecrets[provider];
      const decSecret = decryptSecret(rec?.encryptedSecretKey, vault);
      const decWebhook = decryptSecret(rec?.encryptedWebhookSecret, vault);
      return {
        provider,
        hasSecretKey: Boolean(decSecret),
        secretKeyPreview: maskSecret(decSecret),
        hasWebhookSecret: Boolean(decWebhook),
        updatedAt: rec?.updatedAt || null,
      };
    });
    res.json({ secrets: summary });
  });

  app.post('/api/payments/admin/secrets', requireSuperAdmin, (req, res) => {
    const { provider, secretKey, webhookSecret } = req.body || {};
    if (!['paystack', 'flutterwave', 'stripe'].includes(provider)) {
      return res.status(400).json({ error: 'Unsupported gateway provider.' });
    }
    const vault = readVault();
    const existing = vault.providerSecrets[provider] || { provider, updatedAt: new Date().toISOString() };
    if (typeof secretKey === 'string' && secretKey.trim()) {
      existing.encryptedSecretKey = encryptSecret(secretKey.trim(), vault);
    }
    if (typeof webhookSecret === 'string' && webhookSecret.trim()) {
      existing.encryptedWebhookSecret = encryptSecret(webhookSecret.trim(), vault);
    }
    existing.updatedAt = new Date().toISOString();
    vault.providerSecrets[provider] = existing;
    writeVault(vault);

    const decSecret = decryptSecret(existing.encryptedSecretKey, vault);
    res.json({
      ok: true,
      hasSecretKey: Boolean(decSecret),
      secretKeyPreview: maskSecret(decSecret),
      hasWebhookSecret: Boolean(decryptSecret(existing.encryptedWebhookSecret, vault)),
    });
  });

  app.delete('/api/payments/admin/secrets/:provider', requireSuperAdmin, (req, res) => {
    const { provider } = req.params;
    const vault = readVault();
    delete vault.providerSecrets[provider];
    writeVault(vault);
    res.json({ ok: true });
  });

  app.post('/api/payments/admin/test-connection', requireAdmin, async (req, res) => {
    const { provider } = req.body || {};
    if (!['paystack', 'flutterwave', 'stripe'].includes(provider)) {
      return res.status(400).json({ error: 'Unsupported gateway provider for live API connection test.' });
    }
    const vault = readVault();
    const secretKey =
      decryptSecret(vault.providerSecrets[provider]?.encryptedSecretKey, vault) ||
      process.env[`${provider.toUpperCase()}_SECRET_KEY`] ||
      '';
    const result = await testProviderConnection(provider, secretKey);
    res.json(result);
  });

  app.post('/api/payments/initialize', rateLimit(25), async (req, res) => {
    const { provider, email, name, amountNgn, orderNumber, callbackUrl } = req.body || {};
    if (!['paystack', 'flutterwave', 'stripe'].includes(provider)) {
      return res.status(400).json({ error: 'Invalid payment gateway provider.' });
    }
    if (!email || !amountNgn || Number(amountNgn) <= 0 || !orderNumber) {
      return res.status(400).json({ error: 'Missing required payment initialization fields.' });
    }

    const vault = readVault();
    const secretKey =
      decryptSecret(vault.providerSecrets[provider]?.encryptedSecretKey, vault) ||
      process.env[`${provider.toUpperCase()}_SECRET_KEY`] ||
      '';
    const reference = `DMD-${Date.now()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
    const result = await initializeProviderCheckout({
      provider,
      secretKey,
      email: String(email),
      name: String(name || 'Customer'),
      amountNgn: Number(amountNgn),
      reference,
      orderNumber: String(orderNumber),
      callbackUrl: String(callbackUrl || `${process.env.APP_URL || ''}/checkout?verify=1`),
    });
    if (!result.ok) {
      return res.status(400).json({ error: result.message || 'Unable to initialize payment.', reference });
    }
    res.json(result);
  });

  app.post('/api/payments/verify', rateLimit(30), async (req, res) => {
    const { provider, reference, expectedAmountNgn, orderNumber } = req.body || {};
    if (!['paystack', 'flutterwave', 'stripe'].includes(provider) || !reference) {
      return res.status(400).json({ error: 'Provider and payment reference are required.' });
    }
    const vault = readVault();
    // Idempotency check: return existing verified record if already processed
    const existing = vault.verifiedReferences[reference];
    if (existing && existing.status === 'success') {
      return res.json({
        verified: true,
        idempotent: true,
        paidAmountNgn: existing.amount,
        providerStatus: 'success',
        message: 'Payment reference already verified.',
      });
    }

    const secretKey =
      decryptSecret(vault.providerSecrets[provider]?.encryptedSecretKey, vault) ||
      process.env[`${provider.toUpperCase()}_SECRET_KEY`] ||
      '';
    const result = await verifyProviderTransaction({
      provider,
      secretKey,
      reference: String(reference),
      expectedAmountNgn: Number(expectedAmountNgn || 0),
    });

    if (result.verified) {
      vault.verifiedReferences[reference] = {
        provider,
        amount: result.paidAmountNgn,
        status: 'success',
        orderNumber,
        verifiedAt: new Date().toISOString(),
      };
      writeVault(vault);
    }

    res.json(result);
  });

  // Payment Webhook Listeners with Cryptographic Signature Verification
  app.post('/api/webhooks/paystack', (req: any, res) => {
    const vault = readVault();
    const secret =
      decryptSecret(vault.providerSecrets.paystack?.encryptedSecretKey, vault) ||
      process.env.PAYSTACK_SECRET_KEY ||
      '';
    const sig = req.headers['x-paystack-signature'] as string | undefined;
    if (!verifyPaystackSignature(req.rawBody || '', sig, secret)) {
      return res.status(401).json({ error: 'Invalid Paystack webhook signature.' });
    }
    const event = req.body;
    if (event?.event === 'charge.success' && event?.data?.reference) {
      vault.verifiedReferences[event.data.reference] = {
        provider: 'paystack',
        amount: Number(event.data.amount || 0) / 100,
        status: 'success',
        verifiedAt: new Date().toISOString(),
      };
      writeVault(vault);
    }
    res.sendStatus(200);
  });

  app.post('/api/webhooks/flutterwave', (req, res) => {
    const vault = readVault();
    const webhookSecret =
      decryptSecret(vault.providerSecrets.flutterwave?.encryptedWebhookSecret, vault) ||
      process.env.FLUTTERWAVE_WEBHOOK_SECRET ||
      '';
    const sig = req.headers['verif-hash'] as string | undefined;
    if (!verifyFlutterwaveSignature(sig, webhookSecret)) {
      return res.status(401).json({ error: 'Invalid Flutterwave webhook signature.' });
    }
    const event = req.body;
    if (event?.status === 'successful' && event?.txRef) {
      vault.verifiedReferences[event.txRef] = {
        provider: 'flutterwave',
        amount: Number(event.amount || 0),
        status: 'success',
        verifiedAt: new Date().toISOString(),
      };
      writeVault(vault);
    }
    res.sendStatus(200);
  });

  app.post('/api/webhooks/stripe', (req: any, res) => {
    const vault = readVault();
    const webhookSecret =
      decryptSecret(vault.providerSecrets.stripe?.encryptedWebhookSecret, vault) ||
      process.env.STRIPE_WEBHOOK_SECRET ||
      '';
    const sig = req.headers['stripe-signature'] as string | undefined;
    if (!verifyStripeSignature(req.rawBody || '', sig, webhookSecret)) {
      return res.status(401).json({ error: 'Invalid Stripe webhook signature.' });
    }
    const event = req.body;
    if (event?.type === 'checkout.session.completed' && event?.data?.object?.id) {
      vault.verifiedReferences[event.data.object.id] = {
        provider: 'stripe',
        amount: Number(event.data.object.amount_total || 0) / 100,
        status: 'success',
        verifiedAt: new Date().toISOString(),
      };
      writeVault(vault);
    }
    res.sendStatus(200);
  });

  // ==========================================================
  // 4. SECURE IMAGE UPLOAD (/api/upload)
  // ==========================================================
  app.post('/api/upload', rateLimit(40), async (req: AuthedRequest, res) => {
    const { dataUrl, filename, purpose } = req.body || {};
    if (!dataUrl || typeof dataUrl !== 'string') {
      return res.status(400).json({ error: 'Image data is required.' });
    }
    // Admins can upload catalog/banner images; customers/guests can upload payment proofs
    if (purpose !== 'payment_proof') {
      const actor = await resolveActor(req);
      if (!actor || !actor.isAdmin) {
        return res.status(403).json({ error: 'Admin authorization required for catalog image uploads.' });
      }
    }
    const match = dataUrl.match(/^data:(image\/(jpeg|jpg|png|webp));base64,(.+)$/i);
    if (!match) {
      return res.status(400).json({ error: 'Only JPEG, PNG, and WebP images are allowed.' });
    }
    const ext = match[2].toLowerCase() === 'jpeg' ? 'jpg' : match[2].toLowerCase();
    const buffer = Buffer.from(match[3], 'base64');
    if (buffer.length > 4 * 1024 * 1024) {
      return res.status(413).json({ error: 'Image exceeds 4MB maximum size.' });
    }
    const safeStem = String(filename || 'asset')
      .replace(/\.[^.]+$/, '')
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .slice(0, 32);
    const outName = `${safeStem}_${Date.now()}_${crypto.randomBytes(3).toString('hex')}.${ext}`;
    fs.writeFileSync(path.join(UPLOADS_DIR, outName), buffer);
    res.json({ url: `/uploads/${outName}` });
  });

  // ==========================================================
  // 5. EMAIL & WHATSAPP PROVIDER CONFIG & DISPATCH
  // ==========================================================
  app.get('/api/notifications/config', requireAdmin, (_req, res) => {
    const vault = readVault();
    const nc = vault.notificationConfig || {};
    res.json({
      hasResendApiKey: Boolean(decryptSecret(nc.encryptedResendApiKey, vault)),
      fromEmail: nc.fromEmail || 'Diamond Store <orders@diamondstore.ng>',
      hasWhatsappToken: Boolean(decryptSecret(nc.encryptedWhatsappToken, vault)),
      whatsappPhoneId: nc.whatsappPhoneId || '',
    });
  });

  app.post('/api/notifications/config', requireSuperAdmin, (req, res) => {
    const { resendApiKey, fromEmail, whatsappToken, whatsappPhoneId } = req.body || {};
    const vault = readVault();
    const nc = vault.notificationConfig || {};
    if (typeof resendApiKey === 'string' && resendApiKey.trim()) {
      nc.encryptedResendApiKey = encryptSecret(resendApiKey.trim(), vault);
    }
    if (typeof fromEmail === 'string') nc.fromEmail = fromEmail.trim();
    if (typeof whatsappToken === 'string' && whatsappToken.trim()) {
      nc.encryptedWhatsappToken = encryptSecret(whatsappToken.trim(), vault);
    }
    if (typeof whatsappPhoneId === 'string') nc.whatsappPhoneId = whatsappPhoneId.trim();
    nc.updatedAt = new Date().toISOString();
    vault.notificationConfig = nc;
    writeVault(vault);
    res.json({ ok: true });
  });

  app.post('/api/notifications/send', rateLimit(30), async (req, res) => {
    const { to, subject, title, greeting, bodyLines, ctaLabel, ctaUrl } = req.body || {};
    if (!to || !subject || !title) {
      return res.status(400).json({ error: 'Recipient, subject, and title are required.' });
    }
    const vault = readVault();
    const resendKey = decryptSecret(vault.notificationConfig?.encryptedResendApiKey, vault);
    const html = buildBrandedEmailHtml({
      title,
      greeting: greeting || 'Hello,',
      bodyLines: Array.isArray(bodyLines) ? bodyLines : [],
      ctaLabel,
      ctaUrl,
    });
    const result = await dispatchBrandedEmail({
      resendApiKey: resendKey,
      fromEmail: vault.notificationConfig?.fromEmail,
      to: String(to),
      subject: String(subject),
      html,
    });
    res.json(result);
  });

  // Vite middleware (Dev) vs Static Bundle (Production)
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Diamond Store server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
