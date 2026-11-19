import crypto from 'crypto';

export interface IntegrationDescriptor {
  provider: 'paystack' | 'flutterwave' | 'stripe' | 'bank_transfer' | 'cod';
  name: string;
  category: 'card_gateway' | 'manual' | 'cash';
  supportsConnectionTest: boolean;
  supportsWebhooks: boolean;
  requiresSecretKey: boolean;
  description: string;
  supportedCurrencies: string[];
}

export const AVAILABLE_INTEGRATIONS: IntegrationDescriptor[] = [
  {
    provider: 'paystack',
    name: 'Paystack',
    category: 'card_gateway',
    supportsConnectionTest: true,
    supportsWebhooks: true,
    requiresSecretKey: true,
    description: 'Nigerian cards, bank transfers, USSD, and Apple Pay via Paystack REST API.',
    supportedCurrencies: ['NGN', 'USD', 'GHS', 'ZAR'],
  },
  {
    provider: 'flutterwave',
    name: 'Flutterwave',
    category: 'card_gateway',
    supportsConnectionTest: true,
    supportsWebhooks: true,
    requiresSecretKey: true,
    description: 'Pan-African & international cards, mobile money, and bank transfers via Flutterwave v3 API.',
    supportedCurrencies: ['NGN', 'USD', 'GBP', 'EUR'],
  },
  {
    provider: 'stripe',
    name: 'Stripe',
    category: 'card_gateway',
    supportsConnectionTest: true,
    supportsWebhooks: true,
    requiresSecretKey: true,
    description: 'Global card payments via Stripe Checkout for eligible international merchants.',
    supportedCurrencies: ['USD', 'GBP', 'EUR', 'NGN'],
  },
  {
    provider: 'bank_transfer',
    name: 'Bank Transfer',
    category: 'manual',
    supportsConnectionTest: false,
    supportsWebhooks: false,
    requiresSecretKey: false,
    description: 'Direct Nigerian bank deposit with receipt upload and manual admin confirmation.',
    supportedCurrencies: ['NGN'],
  },
  {
    provider: 'cod',
    name: 'Cash on Delivery',
    category: 'cash',
    supportsConnectionTest: false,
    supportsWebhooks: false,
    requiresSecretKey: false,
    description: 'Pay via POS or cash on delivery for administrator-approved Nigerian states.',
    supportedCurrencies: ['NGN'],
  },
];

export async function testProviderConnection(
  provider: 'paystack' | 'flutterwave' | 'stripe',
  secretKey: string
): Promise<{ ok: boolean; statusCode: number; message: string; latencyMs: number }> {
  if (!secretKey) {
    return {
      ok: false,
      statusCode: 400,
      message: `No ${provider} secret key saved on server. Enter and save your secret API key first.`,
      latencyMs: 0,
    };
  }

  const started = Date.now();
  try {
    if (provider === 'paystack') {
      const resp = await fetch('https://api.paystack.co/bank?perPage=1', {
        headers: { Authorization: `Bearer ${secretKey}` },
      });
      const json = (await resp.json().catch(() => ({}))) as any;
      return {
        ok: resp.ok && json?.status !== false,
        statusCode: resp.status,
        message: resp.ok ? 'Paystack API connection verified.' : json?.message || 'Paystack authentication failed.',
        latencyMs: Date.now() - started,
      };
    }

    if (provider === 'flutterwave') {
      const resp = await fetch('https://api.flutterwave.com/v3/balances', {
        headers: { Authorization: `Bearer ${secretKey}` },
      });
      const json = (await resp.json().catch(() => ({}))) as any;
      return {
        ok: resp.ok && json?.status === 'success',
        statusCode: resp.status,
        message: resp.ok ? 'Flutterwave API connection verified.' : json?.message || 'Flutterwave authentication failed.',
        latencyMs: Date.now() - started,
      };
    }

    if (provider === 'stripe') {
      const resp = await fetch('https://api.stripe.com/v1/balance', {
        headers: { Authorization: `Bearer ${secretKey}` },
      });
      const json = (await resp.json().catch(() => ({}))) as any;
      return {
        ok: resp.ok,
        statusCode: resp.status,
        message: resp.ok ? 'Stripe API connection verified.' : json?.error?.message || 'Stripe authentication failed.',
        latencyMs: Date.now() - started,
      };
    }

    return { ok: false, statusCode: 400, message: 'Unsupported provider.', latencyMs: 0 };
  } catch (err: any) {
    return {
      ok: false,
      statusCode: 502,
      message: `Network error contacting ${provider}: ${err?.message || 'Connection failed'}`,
      latencyMs: Date.now() - started,
    };
  }
}

export async function initializeProviderCheckout(params: {
  provider: 'paystack' | 'flutterwave' | 'stripe';
  secretKey: string;
  email: string;
  name: string;
  amountNgn: number;
  reference: string;
  orderNumber: string;
  callbackUrl: string;
}): Promise<{ ok: boolean; authorizationUrl?: string; reference: string; message?: string }> {
  const { provider, secretKey, email, name, amountNgn, reference, orderNumber, callbackUrl } = params;
  if (!secretKey) {
    return {
      ok: false,
      reference,
      message: `${provider.toUpperCase()} secret key is not configured on the server. Please configure it in Admin → Payment Gateways.`,
    };
  }

  try {
    if (provider === 'paystack') {
      const resp = await fetch('https://api.paystack.co/transaction/initialize', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${secretKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          amount: Math.round(amountNgn * 100),
          reference,
          callback_url: callbackUrl,
          metadata: { orderNumber, customerName: name },
        }),
      });
      const json = (await resp.json()) as any;
      if (!resp.ok || !json?.status || !json?.data?.authorization_url) {
        return { ok: false, reference, message: json?.message || 'Paystack initialization failed.' };
      }
      return { ok: true, authorizationUrl: json.data.authorization_url, reference };
    }

    if (provider === 'flutterwave') {
      const resp = await fetch('https://api.flutterwave.com/v3/payments', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${secretKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tx_ref: reference,
          amount: Math.round(amountNgn),
          currency: 'NGN',
          redirect_url: callbackUrl,
          customer: { email, name },
          customizations: {
            title: 'DIAMOND STORE',
            description: `Order ${orderNumber}`,
          },
        }),
      });
      const json = (await resp.json()) as any;
      if (!resp.ok || json?.status !== 'success' || !json?.data?.link) {
        return { ok: false, reference, message: json?.message || 'Flutterwave initialization failed.' };
      }
      return { ok: true, authorizationUrl: json.data.link, reference };
    }

    if (provider === 'stripe') {
      const form = new URLSearchParams();
      form.append('mode', 'payment');
      form.append('success_url', `${callbackUrl}&session_id={CHECKOUT_SESSION_ID}`);
      form.append('cancel_url', callbackUrl.replace('verify=1', 'cancelled=1'));
      form.append('customer_email', email);
      form.append('client_reference_id', reference);
      form.append('line_items[0][price_data][currency]', 'ngn');
      form.append('line_items[0][price_data][product_data][name]', `Diamond Store Order ${orderNumber}`);
      form.append('line_items[0][price_data][unit_amount]', String(Math.round(amountNgn * 100)));
      form.append('line_items[0][quantity]', '1');

      const resp = await fetch('https://api.stripe.com/v1/checkout/sessions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${secretKey}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: form.toString(),
      });
      const json = (await resp.json()) as any;
      if (!resp.ok || !json?.url) {
        return { ok: false, reference, message: json?.error?.message || 'Stripe initialization failed.' };
      }
      return { ok: true, authorizationUrl: json.url, reference: json.id || reference };
    }

    return { ok: false, reference, message: 'Unsupported gateway.' };
  } catch (err: any) {
    return { ok: false, reference, message: err?.message || 'Gateway request failed.' };
  }
}

export async function verifyProviderTransaction(params: {
  provider: 'paystack' | 'flutterwave' | 'stripe';
  secretKey: string;
  reference: string;
  expectedAmountNgn: number;
}): Promise<{ verified: boolean; paidAmountNgn: number; providerStatus: string; message: string }> {
  const { provider, secretKey, reference, expectedAmountNgn } = params;
  if (!secretKey) {
    return { verified: false, paidAmountNgn: 0, providerStatus: 'unconfigured', message: 'Gateway secret key missing.' };
  }

  try {
    if (provider === 'paystack') {
      const resp = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
        headers: { Authorization: `Bearer ${secretKey}` },
      });
      const json = (await resp.json()) as any;
      const status = json?.data?.status;
      const paidNgn = Number(json?.data?.amount || 0) / 100;
      const valid = resp.ok && json?.status && status === 'success' && paidNgn >= expectedAmountNgn;
      return {
        verified: valid,
        paidAmountNgn: paidNgn,
        providerStatus: status || 'unknown',
        message: valid ? 'Paystack transaction verified.' : json?.message || 'Transaction not successful.',
      };
    }

    if (provider === 'flutterwave') {
      const resp = await fetch(
        `https://api.flutterwave.com/v3/transactions/verify_by_reference?tx_ref=${encodeURIComponent(reference)}`,
        { headers: { Authorization: `Bearer ${secretKey}` } }
      );
      const json = (await resp.json()) as any;
      const status = json?.data?.status;
      const paidNgn = Number(json?.data?.amount || 0);
      const valid = resp.ok && json?.status === 'success' && status === 'successful' && paidNgn >= expectedAmountNgn;
      return {
        verified: valid,
        paidAmountNgn: paidNgn,
        providerStatus: status || 'unknown',
        message: valid ? 'Flutterwave transaction verified.' : json?.message || 'Transaction not successful.',
      };
    }

    if (provider === 'stripe') {
      const resp = await fetch(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(reference)}`, {
        headers: { Authorization: `Bearer ${secretKey}` },
      });
      const json = (await resp.json()) as any;
      const paidNgn = Number(json?.amount_total || 0) / 100;
      const valid = resp.ok && json?.payment_status === 'paid' && paidNgn >= expectedAmountNgn;
      return {
        verified: valid,
        paidAmountNgn: paidNgn,
        providerStatus: json?.payment_status || 'unknown',
        message: valid ? 'Stripe payment verified.' : json?.error?.message || 'Payment not verified.',
      };
    }

    return { verified: false, paidAmountNgn: 0, providerStatus: 'unsupported', message: 'Unsupported provider.' };
  } catch (err: any) {
    return {
      verified: false,
      paidAmountNgn: 0,
      providerStatus: 'error',
      message: err?.message || 'Verification failed.',
    };
  }
}

export function verifyPaystackSignature(rawBody: string, signature: string | undefined, secret: string): boolean {
  if (!signature || !secret) return false;
  const hash = crypto.createHmac('sha512', secret).update(rawBody).digest('hex');
  const a = Buffer.from(hash);
  const b = Buffer.from(signature);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function verifyFlutterwaveSignature(headerHash: string | undefined, secretHash: string): boolean {
  if (!headerHash || !secretHash) return false;
  const a = Buffer.from(headerHash);
  const b = Buffer.from(secretHash);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function verifyStripeSignature(rawBody: string, sigHeader: string | undefined, webhookSecret: string): boolean {
  if (!sigHeader || !webhookSecret) return false;
  const parts = Object.fromEntries(sigHeader.split(',').map((p) => p.split('=')));
  const t = parts['t'];
  const v1 = parts['v1'];
  if (!t || !v1) return false;
  const expected = crypto.createHmac('sha256', webhookSecret).update(`${t}.${rawBody}`).digest('hex');
  const a = Buffer.from(expected);
  const b = Buffer.from(v1);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
