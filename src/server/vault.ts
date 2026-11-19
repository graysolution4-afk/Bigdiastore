import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

export type ServerAdminRole = 'super_admin' | 'store_manager' | 'content_manager';

export interface ServerAdminRecord {
  id: string;
  fullName: string;
  email: string;
  passwordHash: string;
  role: ServerAdminRole;
  active: boolean;
  createdAt: string;
}

export interface ServerCustomerRecord {
  id: string;
  fullName: string;
  email: string;
  phone?: string;
  passwordHash: string;
  resetToken?: string;
  resetTokenExpiresAt?: number;
  status: 'active' | 'suspended';
  createdAt: string;
}

export interface ProviderSecretRecord {
  provider: 'paystack' | 'flutterwave' | 'stripe';
  encryptedSecretKey?: string;
  encryptedWebhookSecret?: string;
  updatedAt: string;
}

export interface NotificationProviderConfig {
  encryptedResendApiKey?: string;
  fromEmail?: string;
  encryptedWhatsappToken?: string;
  whatsappPhoneId?: string;
  updatedAt?: string;
}

export interface VaultData {
  sessionSecret: string;
  encryptionSecret: string;
  admins: ServerAdminRecord[];
  customers: ServerCustomerRecord[];
  providerSecrets: Record<string, ProviderSecretRecord>;
  notificationConfig: NotificationProviderConfig;
  verifiedReferences: Record<
    string,
    { provider: string; amount: number; status: string; orderNumber?: string; verifiedAt: string }
  >;
}

const DATA_DIR = path.resolve(process.cwd(), '.data');
const VAULT_FILE = path.join(DATA_DIR, 'vault.json');

function ensureVault(): VaultData {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(VAULT_FILE)) {
    const initial: VaultData = {
      sessionSecret: process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex'),
      encryptionSecret: process.env.VAULT_ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex'),
      admins: [],
      customers: [],
      providerSecrets: {},
      notificationConfig: {},
      verifiedReferences: {},
    };
    fs.writeFileSync(VAULT_FILE, JSON.stringify(initial, null, 2), { mode: 0o600 });
    return initial;
  }
  const raw = fs.readFileSync(VAULT_FILE, 'utf-8');
  return JSON.parse(raw) as VaultData;
}

export function readVault(): VaultData {
  return ensureVault();
}

export function writeVault(data: VaultData): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  fs.writeFileSync(VAULT_FILE, JSON.stringify(data, null, 2), { mode: 0o600 });
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, key] = stored.split(':');
  if (!salt || !key) return false;
  const derived = crypto.scryptSync(password, salt, 64);
  const keyBuf = Buffer.from(key, 'hex');
  if (derived.length !== keyBuf.length) return false;
  return crypto.timingSafeEqual(derived, keyBuf);
}

function getCipherKey(vault: VaultData): Buffer {
  return crypto.createHash('sha256').update(vault.encryptionSecret).digest();
}

export function encryptSecret(plain: string, vault: VaultData): string {
  const iv = crypto.randomBytes(12);
  const key = getCipherKey(vault);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
}

export function decryptSecret(cipherText: string | undefined, vault: VaultData): string {
  if (!cipherText) return '';
  const parts = cipherText.split(':');
  if (parts.length !== 3) return '';
  const [ivHex, tagHex, encHex] = parts;
  const iv = Buffer.from(ivHex, 'hex');
  const tag = Buffer.from(tagHex, 'hex');
  const enc = Buffer.from(encHex, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-gcm', getCipherKey(vault), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
}

export function maskSecret(secret: string): string {
  if (!secret) return '';
  if (secret.length <= 8) return '••••••••';
  return `${secret.slice(0, 6)}••••${secret.slice(-4)}`;
}

export interface SessionPayload {
  sub: string;
  email: string;
  fullName: string;
  kind: 'admin' | 'customer';
  role?: ServerAdminRole;
  exp: number;
}

export function signSessionToken(payload: Omit<SessionPayload, 'exp'>, ttlHours = 24): string {
  const vault = readVault();
  const fullPayload: SessionPayload = {
    ...payload,
    exp: Date.now() + ttlHours * 3600 * 1000,
  };
  const encoded = Buffer.from(JSON.stringify(fullPayload)).toString('base64url');
  const sig = crypto.createHmac('sha256', vault.sessionSecret).update(encoded).digest('base64url');
  return `${encoded}.${sig}`;
}

export function verifySessionToken(token: string): SessionPayload | null {
  try {
    const vault = readVault();
    const [encoded, sig] = token.split('.');
    if (!encoded || !sig) return null;
    const expected = crypto.createHmac('sha256', vault.sessionSecret).update(encoded).digest('base64url');
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    const decoded = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as SessionPayload;
    if (!decoded.exp || decoded.exp < Date.now()) return null;
    return decoded;
  } catch {
    return null;
  }
}
