import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  CheckCircle2,
  CreditCard,
  Download,
  Edit2,
  Plus,
  Printer,
  ShieldCheck,
  Trash2,
  X,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useStore } from '../../context/StoreContext';
import { exportCsv, formatNaira, formatTimestamp, toMillis } from '../../lib/format';
import {
  Order,
  PaymentGatewayConfig,
  PaymentProviderId,
  PaymentTransaction,
} from '../../types/store';

interface IntegrationCatalogItem {
  provider: PaymentProviderId;
  name: string;
  description: string;
  requiresSecretKey: boolean;
  supportedCurrencies: string[];
}

interface SecretSummary {
  provider: PaymentProviderId;
  hasSecretKey: boolean;
  secretKeyPreview: string;
  hasWebhookSecret: boolean;
  updatedAt: string | null;
}

export function AdminPaymentGatewaysPanel() {
  const { paymentGateways, savePaymentGateway, deletePaymentGateway, notify } = useStore();
  const { getBearerToken, adminRole } = useAuth();

  const [integrations, setIntegrations] = useState<IntegrationCatalogItem[]>([]);
  const [secretSummaries, setSecretSummaries] = useState<Record<string, SecretSummary>>({});
  const [editing, setEditing] = useState<Partial<PaymentGatewayConfig> | null>(null);
  const [secretKeyInput, setSecretKeyInput] = useState('');
  const [webhookSecretInput, setWebhookSecretInput] = useState('');
  const [testingProvider, setTestingProvider] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<
    Record<string, { ok: boolean; status: string; message: string; latencyMs?: number }>
  >({});
  const [saving, setSaving] = useState(false);

  const isSuperAdmin = adminRole === 'super_admin';

  const loadServerData = async () => {
    try {
      const intResp = await fetch('/api/payments/integrations');
      if (intResp.ok) {
        const j = await intResp.json();
        setIntegrations(j.integrations || []);
      }
      const token = await getBearerToken();
      if (token) {
        const secResp = await fetch('/api/payments/admin/secrets', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (secResp.ok) {
          const sj = await secResp.json();
          const map: Record<string, SecretSummary> = {};
          for (const item of sj.secrets || []) {
            map[item.provider] = item;
          }
          setSecretSummaries(map);
        }
      }
    } catch {
      // handled gracefully
    }
  };

  useEffect(() => {
    void loadServerData();
  }, []);

  const openEditor = (gw?: PaymentGatewayConfig, presetProvider?: IntegrationCatalogItem) => {
    setSecretKeyInput('');
    setWebhookSecretInput('');
    if (gw) {
      setEditing({ ...gw });
    } else if (presetProvider) {
      setEditing({
        id: `gw_${presetProvider.provider}`,
        provider: presetProvider.provider,
        displayName: presetProvider.name,
        publicKey: '',
        mode: 'test',
        active: false,
        isDefault: false,
        hasSecretConfigured: false,
        bankName: '',
        accountName: '',
        accountNumber: '',
        paymentInstructions: '',
        codEligibleStates: ['Lagos', 'Abuja (FCT)'],
        codExtraFee: 0,
      });
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing || !editing.provider) return;
    if (!isSuperAdmin) {
      notify('Only Super Administrators can modify payment gateway configurations.', 'error');
      return;
    }
    setSaving(true);
    try {
      let hasSecretConfigured = Boolean(
        editing.hasSecretConfigured || secretSummaries[editing.provider]?.hasSecretKey
      );

      // Save sensitive secret keys ONLY to server vault
      if (
        ['paystack', 'flutterwave', 'stripe'].includes(editing.provider) &&
        (secretKeyInput.trim() || webhookSecretInput.trim())
      ) {
        const token = await getBearerToken();
        const resp = await fetch('/api/payments/admin/secrets', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            provider: editing.provider,
            secretKey: secretKeyInput.trim() || undefined,
            webhookSecret: webhookSecretInput.trim() || undefined,
          }),
        });
        const j = await resp.json().catch(() => ({}));
        if (!resp.ok) {
          throw new Error(j?.error || 'Failed to save encrypted secret key on server.');
        }
        hasSecretConfigured = Boolean(j?.hasSecretKey);
      }

      await savePaymentGateway({
        ...editing,
        hasSecretConfigured,
      });

      await loadServerData();
      setEditing(null);
      notify(`${editing.displayName} saved.`, 'success');
    } catch (err: any) {
      notify(err?.message || 'Unable to save gateway configuration.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (gw: PaymentGatewayConfig) => {
    if (!isSuperAdmin) {
      notify('Only Super Administrators can toggle payment gateways.', 'error');
      return;
    }
    try {
      await savePaymentGateway({ ...gw, active: !gw.active });
      notify(`${gw.displayName} ${!gw.active ? 'activated' : 'deactivated'}.`, 'success');
    } catch (err: any) {
      notify(err?.message || 'Unable to toggle gateway.', 'error');
    }
  };

  const handleSetDefault = async (gw: PaymentGatewayConfig) => {
    if (!isSuperAdmin) {
      notify('Only Super Administrators can set default gateway.', 'error');
      return;
    }
    try {
      await savePaymentGateway({ ...gw, active: true, isDefault: true });
      notify(`${gw.displayName} set as default checkout gateway.`, 'success');
    } catch (err: any) {
      notify(err?.message || 'Unable to set default gateway.', 'error');
    }
  };

  const handleTestConnection = async (provider: PaymentProviderId) => {
    setTestingProvider(provider);
    try {
      const token = await getBearerToken();
      const resp = await fetch('/api/payments/admin/test-connection', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ provider }),
      });
      const res = await resp.json();
      setTestResults((prev) => ({ ...prev, [provider]: res }));
      notify(res.message || 'Connection test completed.', res.ok ? 'success' : 'error');
    } catch {
      notify('Network error while testing gateway connection.', 'error');
    } finally {
      setTestingProvider(null);
    }
  };

  const handleDeleteGateway = async (gw: PaymentGatewayConfig) => {
    if (!isSuperAdmin) {
      notify('Only Super Administrators can remove payment gateways.', 'error');
      return;
    }
    try {
      await deletePaymentGateway(gw.id);
      if (['paystack', 'flutterwave', 'stripe'].includes(gw.provider)) {
        const token = await getBearerToken();
        await fetch(`/api/payments/admin/secrets/${gw.provider}`, {
          method: 'DELETE',
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        }).catch(() => {});
      }
      await loadServerData();
      notify(`${gw.displayName} removed.`, 'info');
    } catch (err: any) {
      notify(err?.message || 'Unable to delete gateway.', 'error');
    }
  };

  const configuredProviders = new Set(paymentGateways.map((g) => g.provider));
  const availableToAdd = integrations.filter((i) => !configuredProviders.has(i.provider));
  const originUrl = typeof window !== 'undefined' ? window.location.origin : '';

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl font-semibold text-[#111111]">
            Dynamic Payment Gateways
          </h2>
          <p className="text-xs text-neutral-500 mt-1">
            Checkout dynamically displays only active methods configured here. Secret keys are encrypted on the server and never exposed to browsers.
          </p>
        </div>
      </div>

      {/* Configured Gateways */}
      <section className="space-y-4">
        <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-[#9E7C16]">
          Configured Gateways ({paymentGateways.length})
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {paymentGateways.map((gw) => {
            const sec = secretSummaries[gw.provider];
            const testRes = testResults[gw.provider];
            const isOnlineGateway = ['paystack', 'flutterwave', 'stripe'].includes(gw.provider);
            return (
              <div
                key={gw.id}
                className={`border bg-white p-5 flex flex-col justify-between gap-4 ${
                  gw.active ? 'border-[#111111]' : 'border-neutral-200'
                }`}
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <CreditCard className="w-4 h-4 text-[#9E7C16]" />
                        <h4 className="font-semibold text-base text-[#111111]">
                          {gw.displayName}
                        </h4>
                      </div>
                      <p className="font-mono text-[11px] uppercase tracking-wider text-neutral-500 mt-1">
                        {gw.provider} · {gw.mode} mode · {gw.active ? 'ACTIVE' : 'INACTIVE'}
                        {gw.isDefault ? ' · DEFAULT' : ''}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleToggleActive(gw)}
                      disabled={!isSuperAdmin}
                      className={`px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider border ${
                        gw.active
                          ? 'bg-[#111111] text-white border-[#111111]'
                          : 'bg-white text-neutral-700 border-neutral-300 hover:border-[#111111]'
                      }`}
                    >
                      {gw.active ? 'Active' : 'Activate'}
                    </button>
                  </div>

                  {isOnlineGateway ? (
                    <div className="text-xs text-neutral-600 space-y-1 bg-[#F5F5F5] p-3 border border-neutral-200">
                      <p className="font-mono truncate">
                        Public Key: {gw.publicKey ? `${gw.publicKey.slice(0, 14)}...` : 'Not set'}
                      </p>
                      <p className="font-mono">
                        Secret Key (Server Vault):{' '}
                        {sec?.hasSecretKey ? sec.secretKeyPreview : 'Not configured'}
                      </p>
                      <p className="font-mono">
                        Webhook Secret: {sec?.hasWebhookSecret ? 'Configured' : 'Not set'}
                      </p>
                      <p className="font-mono text-[11px] text-neutral-500 break-all pt-1">
                        Webhook URL: {originUrl}/api/webhooks/{gw.provider}
                      </p>
                    </div>
                  ) : gw.provider === 'bank_transfer' ? (
                    <div className="text-xs text-neutral-600 space-y-1 bg-[#F5F5F5] p-3 border border-neutral-200">
                      <p>
                        <strong>Bank:</strong> {gw.bankName || 'Not set'}
                      </p>
                      <p>
                        <strong>Account:</strong> {gw.accountNumber || '—'} · {gw.accountName || '—'}
                      </p>
                    </div>
                  ) : (
                    <div className="text-xs text-neutral-600 space-y-1 bg-[#F5F5F5] p-3 border border-neutral-200">
                      <p>
                        <strong>Eligible States:</strong>{' '}
                        {gw.codEligibleStates?.join(', ') || 'All active zones'}
                      </p>
                      <p>
                        <strong>COD Surcharge:</strong> {formatNaira(gw.codExtraFee || 0)}
                      </p>
                    </div>
                  )}

                  {testRes && (
                    <div
                      className={`p-2.5 text-xs border ${
                        testRes.ok
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                          : 'bg-red-50 border-red-200 text-red-900'
                      }`}
                    >
                      <span className="font-semibold">{testRes.status}:</span> {testRes.message}{' '}
                      {testRes.latencyMs ? `(${testRes.latencyMs}ms)` : ''}
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-neutral-200 text-xs">
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => openEditor(gw)}
                      className="px-3 py-1.5 border border-neutral-300 hover:border-[#111111] flex items-center gap-1.5"
                    >
                      <Edit2 className="w-3.5 h-3.5" /> Configure
                    </button>
                    {isOnlineGateway && (
                      <button
                        type="button"
                        onClick={() => handleTestConnection(gw.provider)}
                        disabled={testingProvider === gw.provider}
                        className="px-3 py-1.5 border border-[#D4AF37] text-[#111111] hover:bg-[#D4AF37]/10 flex items-center gap-1.5"
                      >
                        <Activity className="w-3.5 h-3.5" />
                        {testingProvider === gw.provider ? 'Testing...' : 'Test Connection'}
                      </button>
                    )}
                    {!gw.isDefault && isSuperAdmin && (
                      <button
                        type="button"
                        onClick={() => handleSetDefault(gw)}
                        className="px-3 py-1.5 border border-neutral-300 hover:border-[#111111]"
                      >
                        Set Default
                      </button>
                    )}
                  </div>
                  {isSuperAdmin && (
                    <button
                      type="button"
                      onClick={() => handleDeleteGateway(gw)}
                      aria-label={`Remove ${gw.displayName}`}
                      className="p-1.5 text-neutral-400 hover:text-red-700"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Available Integrations Catalog */}
      <section className="space-y-4 pt-4 border-t border-neutral-200">
        <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">
          Available Payment Integrations
        </h3>
        {availableToAdd.length === 0 ? (
          <p className="text-xs text-neutral-500 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-700" /> All supported payment integrations are configured above.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {availableToAdd.map((item) => (
              <div key={item.provider} className="border border-neutral-200 bg-[#F5F5F5] p-5 flex flex-col justify-between gap-4">
                <div>
                  <h4 className="font-semibold text-sm text-[#111111]">{item.name}</h4>
                  <p className="text-xs text-neutral-600 mt-1">{item.description}</p>
                  <p className="font-mono text-[11px] text-neutral-500 mt-2">
                    Currencies: {(item.supportedCurrencies || ['NGN']).join(', ')}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => openEditor(undefined, item)}
                  className="w-full py-2 bg-[#111111] text-white text-xs font-semibold uppercase tracking-wider flex items-center justify-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Gateway
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Gateway Config Modal */}
      {editing && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-xl p-6 sm:p-8 my-8 border border-neutral-200">
            <div className="flex items-center justify-between border-b border-neutral-200 pb-4 mb-5">
              <div>
                <h3 className="font-display text-2xl font-semibold text-[#111111]">
                  Configure {editing.displayName || editing.provider}
                </h3>
                <p className="text-xs text-neutral-500 mt-0.5 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-[#9E7C16]" /> Secret keys are encrypted at rest on the server.
                </p>
              </div>
              <button type="button" onClick={() => setEditing(null)}>
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase text-neutral-600 mb-1">
                    Checkout Display Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={editing.displayName || ''}
                    onChange={(e) => setEditing({ ...editing, displayName: e.target.value })}
                    className="w-full border border-neutral-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase text-neutral-600 mb-1">
                    Environment Mode
                  </label>
                  <select
                    value={editing.mode || 'test'}
                    onChange={(e) => setEditing({ ...editing, mode: e.target.value as 'test' | 'live' })}
                    className="w-full border border-neutral-300 px-3 py-2 text-sm bg-white"
                  >
                    <option value="test">Test / Sandbox</option>
                    <option value="live">Live / Production</option>
                  </select>
                </div>
              </div>

              {['paystack', 'flutterwave', 'stripe'].includes(editing.provider || '') && (
                <>
                  <div>
                    <label className="block text-xs font-semibold uppercase text-neutral-600 mb-1">
                      Public Key
                    </label>
                    <input
                      type="text"
                      value={editing.publicKey || ''}
                      onChange={(e) => setEditing({ ...editing, publicKey: e.target.value })}
                      placeholder={
                        editing.provider === 'paystack'
                          ? 'pk_test_... or pk_live_...'
                          : editing.provider === 'flutterwave'
                          ? 'FLWPUBK_TEST-...'
                          : 'pk_test_... or pk_live_...'
                      }
                      className="w-full border border-neutral-300 px-3 py-2 text-sm font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase text-neutral-600 mb-1">
                      Secret Key (Leave blank to keep existing)
                    </label>
                    <input
                      type="password"
                      value={secretKeyInput}
                      onChange={(e) => setSecretKeyInput(e.target.value)}
                      placeholder={
                        secretSummaries[editing.provider || '']?.secretKeyPreview ||
                        'Enter provider secret key'
                      }
                      className="w-full border border-neutral-300 px-3 py-2 text-sm font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase text-neutral-600 mb-1">
                      Webhook Signing Secret (Optional)
                    </label>
                    <input
                      type="password"
                      value={webhookSecretInput}
                      onChange={(e) => setWebhookSecretInput(e.target.value)}
                      placeholder="Enter webhook secret hash"
                      className="w-full border border-neutral-300 px-3 py-2 text-sm font-mono"
                    />
                  </div>
                </>
              )}

              {editing.provider === 'bank_transfer' && (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold uppercase text-neutral-600 mb-1">
                        Bank Name *
                      </label>
                      <input
                        type="text"
                        required
                        value={editing.bankName || ''}
                        onChange={(e) => setEditing({ ...editing, bankName: e.target.value })}
                        className="w-full border border-neutral-300 px-3 py-2 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold uppercase text-neutral-600 mb-1">
                        Account Number *
                      </label>
                      <input
                        type="text"
                        required
                        value={editing.accountNumber || ''}
                        onChange={(e) => setEditing({ ...editing, accountNumber: e.target.value })}
                        className="w-full border border-neutral-300 px-3 py-2 text-sm font-mono"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase text-neutral-600 mb-1">
                      Account Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={editing.accountName || ''}
                      onChange={(e) => setEditing({ ...editing, accountName: e.target.value })}
                      className="w-full border border-neutral-300 px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase text-neutral-600 mb-1">
                      Payment Instructions
                    </label>
                    <textarea
                      rows={3}
                      value={editing.paymentInstructions || ''}
                      onChange={(e) =>
                        setEditing({ ...editing, paymentInstructions: e.target.value })
                      }
                      className="w-full border border-neutral-300 px-3 py-2 text-sm"
                    />
                  </div>
                </>
              )}

              {editing.provider === 'cod' && (
                <>
                  <div>
                    <label className="block text-xs font-semibold uppercase text-neutral-600 mb-1">
                      Eligible States (comma-separated, leave blank for all)
                    </label>
                    <input
                      type="text"
                      value={(editing.codEligibleStates || []).join(', ')}
                      onChange={(e) =>
                        setEditing({
                          ...editing,
                          codEligibleStates: e.target.value
                            .split(',')
                            .map((s) => s.trim())
                            .filter(Boolean),
                        })
                      }
                      className="w-full border border-neutral-300 px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase text-neutral-600 mb-1">
                      COD Handling Extra Fee (₦)
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={editing.codExtraFee || 0}
                      onChange={(e) => setEditing({ ...editing, codExtraFee: Number(e.target.value) })}
                      className="w-full border border-neutral-300 px-3 py-2 text-sm tabular-nums"
                    />
                  </div>
                </>
              )}

              <div className="flex gap-6 text-xs pt-2">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={Boolean(editing.active)}
                    onChange={(e) => setEditing({ ...editing, active: e.target.checked })}
                  />
                  Active at Checkout
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={Boolean(editing.isDefault)}
                    onChange={(e) => setEditing({ ...editing, isDefault: e.target.checked })}
                  />
                  Default Checkout Method
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-neutral-200">
                <button
                  type="button"
                  onClick={() => setEditing(null)}
                  className="px-5 py-2.5 border border-neutral-300 text-xs uppercase tracking-wider"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-6 py-2.5 bg-[#111111] text-white text-xs font-semibold uppercase tracking-wider disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Save Configuration'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export function AdminTransactionsPanel({
  transactions,
  orders,
}: {
  transactions: PaymentTransaction[];
  orders: Order[];
}) {
  const [providerFilter, setProviderFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  const combined = useMemo(() => {
    if (transactions.length > 0) return transactions;
    return orders
      .filter((o) => o.paymentStatus === 'paid' || o.paymentReference)
      .map((o) => ({
        id: o.id,
        orderId: o.id,
        orderNumber: o.orderNumber,
        reference: o.paymentReference || o.orderNumber,
        provider: o.paymentProvider,
        amount: o.totalAmount,
        currency: 'NGN',
        status: (o.paymentStatus === 'paid'
          ? 'success'
          : o.paymentStatus === 'refunded'
          ? 'refunded'
          : 'pending') as PaymentTransaction['status'],
        createdAt: o.createdAt,
      }));
  }, [transactions, orders]);

  const filtered = combined.filter((tx) => {
    if (providerFilter !== 'all' && tx.provider !== providerFilter) return false;
    if (statusFilter !== 'all' && tx.status !== statusFilter) return false;
    return true;
  });

  const handleExport = () => {
    exportCsv(
      `diamond-transactions-${new Date().toISOString().slice(0, 10)}.csv`,
      ['Reference', 'Order Number', 'Provider', 'Amount (NGN)', 'Status', 'Date'],
      filtered.map((t) => [
        t.reference,
        t.orderNumber,
        t.provider.toUpperCase(),
        t.amount,
        t.status,
        formatTimestamp(t.createdAt),
      ])
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl font-semibold text-[#111111]">
            Verified Payment Transactions
          </h2>
          <p className="text-xs text-neutral-500">
            Real-time gateway references and verified payment logs.
          </p>
        </div>
        <button
          type="button"
          onClick={handleExport}
          className="px-4 py-2 border border-[#111111] text-xs font-semibold uppercase tracking-wider flex items-center gap-2 hover:bg-[#111111] hover:text-white transition-colors"
        >
          <Download className="w-3.5 h-3.5" /> Export CSV
        </button>
      </div>

      <div className="flex flex-wrap gap-3">
        <select
          value={providerFilter}
          onChange={(e) => setProviderFilter(e.target.value)}
          className="border border-neutral-300 px-3 py-2 text-sm bg-white"
        >
          <option value="all">All Providers</option>
          <option value="paystack">Paystack</option>
          <option value="flutterwave">Flutterwave</option>
          <option value="stripe">Stripe</option>
          <option value="bank_transfer">Bank Transfer</option>
          <option value="cod">Cash on Delivery</option>
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="border border-neutral-300 px-3 py-2 text-sm bg-white"
        >
          <option value="all">All Statuses</option>
          <option value="success">Success</option>
          <option value="pending">Pending</option>
          <option value="failed">Failed</option>
          <option value="refunded">Refunded</option>
        </select>
      </div>

      <div className="border border-neutral-200 bg-white overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="bg-[#F5F5F5] text-xs uppercase text-neutral-600 border-b border-neutral-200">
            <tr>
              <th className="p-3">Reference</th>
              <th className="p-3">Order #</th>
              <th className="p-3">Gateway</th>
              <th className="p-3 text-right">Amount</th>
              <th className="p-3">Status</th>
              <th className="p-3">Timestamp</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {filtered.map((tx) => (
              <tr key={tx.id}>
                <td className="p-3 font-mono text-xs font-semibold">{tx.reference}</td>
                <td className="p-3 font-mono text-xs">{tx.orderNumber}</td>
                <td className="p-3 text-xs uppercase">{tx.provider}</td>
                <td className="p-3 text-right tabular-nums font-medium">{formatNaira(tx.amount)}</td>
                <td className="p-3 text-xs uppercase">{tx.status}</td>
                <td className="p-3 text-xs text-neutral-500">{formatTimestamp(tx.createdAt)}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="p-8 text-center text-neutral-500">
                  No payment transactions match the selected filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function AdminReportsPanel({ orders }: { orders: Order[] }) {
  const { products } = useStore();
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      const ms = toMillis(o.createdAt);
      if (fromDate && ms < new Date(fromDate).getTime()) return false;
      if (toDate && ms > new Date(toDate).getTime() + 86_400_000) return false;
      return true;
    });
  }, [orders, fromDate, toDate]);

  // Verified revenue strictly from orders where paymentStatus === 'paid'
  const paidOrders = filteredOrders.filter((o) => o.paymentStatus === 'paid');
  const verifiedRevenue = paidOrders.reduce((s, o) => s + o.totalAmount, 0);
  const averageOrderValue = paidOrders.length > 0 ? Math.round(verifiedRevenue / paidOrders.length) : 0;

  const byGateway = useMemo(() => {
    const map: Record<string, { count: number; total: number }> = {};
    for (const o of paidOrders) {
      const key = o.paymentProvider || 'unknown';
      if (!map[key]) map[key] = { count: 0, total: 0 };
      map[key].count += 1;
      map[key].total += o.totalAmount;
    }
    return Object.entries(map);
  }, [paidOrders]);

  const byCategoryGroup = useMemo(() => {
    const prodMap = new Map(products.map((p) => [p.id, p]));
    const totals: Record<string, number> = {
      'mens-clothing': 0,
      shoes: 0,
      'mens-accessories': 0,
    };
    for (const o of paidOrders) {
      for (const item of o.items) {
        const grp = prodMap.get(item.productId)?.categoryGroup || 'mens-clothing';
        totals[grp] = (totals[grp] || 0) + item.price * item.quantity;
      }
    }
    return totals;
  }, [paidOrders, products]);

  const topProducts = useMemo(() => {
    const map = new Map<string, { name: string; qty: number; revenue: number }>();
    for (const o of paidOrders) {
      for (const item of o.items) {
        const cur = map.get(item.productId) || { name: item.name, qty: 0, revenue: 0 };
        cur.qty += item.quantity;
        cur.revenue += item.price * item.quantity;
        map.set(item.productId, cur);
      }
    }
    return Array.from(map.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 8);
  }, [paidOrders]);

  const handleExportReport = () => {
    exportCsv(
      `diamond-sales-report-${new Date().toISOString().slice(0, 10)}.csv`,
      ['Order #', 'Customer', 'State', 'Payment Method', 'Payment Status', 'Order Status', 'Total (NGN)'],
      filteredOrders.map((o) => [
        o.orderNumber,
        o.customerName,
        o.state,
        o.paymentMethod,
        o.paymentStatus,
        o.orderStatus,
        o.totalAmount,
      ])
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 no-print">
        <div>
          <h2 className="font-display text-2xl font-semibold text-[#111111]">
            Sales Reports &amp; Financial Analytics
          </h2>
          <p className="text-xs text-neutral-500">
            Revenue metrics strictly sum verified paid orders only.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleExportReport}
            className="px-4 py-2 border border-[#111111] text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" /> CSV
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="px-4 py-2 bg-[#111111] text-white text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5"
          >
            <Printer className="w-3.5 h-3.5" /> Print / PDF
          </button>
        </div>
      </div>

      {/* Date Range Filters */}
      <div className="flex flex-wrap items-center gap-3 bg-[#F5F5F5] p-4 border border-neutral-200 no-print">
        <label className="text-xs font-semibold uppercase text-neutral-600">From:</label>
        <input
          type="date"
          value={fromDate}
          onChange={(e) => setFromDate(e.target.value)}
          className="border border-neutral-300 px-3 py-1.5 text-sm bg-white"
        />
        <label className="text-xs font-semibold uppercase text-neutral-600">To:</label>
        <input
          type="date"
          value={toDate}
          onChange={(e) => setToDate(e.target.value)}
          className="border border-neutral-300 px-3 py-1.5 text-sm bg-white"
        />
        {(fromDate || toDate) && (
          <button
            type="button"
            onClick={() => {
              setFromDate('');
              setToDate('');
            }}
            className="text-xs underline text-neutral-600 ml-2"
          >
            Reset Dates
          </button>
        )}
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="border border-neutral-200 bg-white p-5">
          <p className="text-xs uppercase tracking-wider text-neutral-500">Verified Revenue</p>
          <p className="text-2xl font-semibold text-[#111111] tabular-nums mt-1">
            {formatNaira(verifiedRevenue)}
          </p>
        </div>
        <div className="border border-neutral-200 bg-white p-5">
          <p className="text-xs uppercase tracking-wider text-neutral-500">Paid Orders</p>
          <p className="text-2xl font-semibold text-[#111111] tabular-nums mt-1">
            {paidOrders.length}
          </p>
        </div>
        <div className="border border-neutral-200 bg-white p-5">
          <p className="text-xs uppercase tracking-wider text-neutral-500">Total Orders</p>
          <p className="text-2xl font-semibold text-[#111111] tabular-nums mt-1">
            {filteredOrders.length}
          </p>
        </div>
        <div className="border border-neutral-200 bg-white p-5">
          <p className="text-xs uppercase tracking-wider text-neutral-500">Average Paid Order</p>
          <p className="text-2xl font-semibold text-[#111111] tabular-nums mt-1">
            {formatNaira(averageOrderValue)}
          </p>
        </div>
      </div>

      {/* Breakdown Grids */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="border border-neutral-200 bg-white p-5">
          <h3 className="font-display text-lg font-semibold text-[#111111] mb-4">
            Revenue by Payment Gateway
          </h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase text-neutral-500 border-b border-neutral-200">
                <th className="py-2">Provider</th>
                <th className="py-2 text-right">Paid Orders</th>
                <th className="py-2 text-right">Revenue</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {byGateway.map(([provider, info]) => (
                <tr key={provider}>
                  <td className="py-2.5 uppercase text-xs font-semibold">{provider}</td>
                  <td className="py-2.5 text-right tabular-nums">{info.count}</td>
                  <td className="py-2.5 text-right tabular-nums font-medium">
                    {formatNaira(info.total)}
                  </td>
                </tr>
              ))}
              {byGateway.length === 0 && (
                <tr>
                  <td colSpan={3} className="py-6 text-center text-xs text-neutral-500">
                    No verified paid orders in selected period.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="border border-neutral-200 bg-white p-5">
          <h3 className="font-display text-lg font-semibold text-[#111111] mb-4">
            Category Group Sales Breakdown
          </h3>
          <div className="space-y-4">
            {[
              { label: "Men's Clothing", key: 'mens-clothing' },
              { label: 'Luxury Shoes', key: 'shoes' },
              { label: "Men's Accessories", key: 'mens-accessories' },
            ].map((row) => {
              const val = byCategoryGroup[row.key] || 0;
              const pct = verifiedRevenue > 0 ? Math.round((val / verifiedRevenue) * 100) : 0;
              return (
                <div key={row.key} className="space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="font-medium text-[#111111]">{row.label}</span>
                    <span className="tabular-nums text-neutral-600">
                      {formatNaira(val)} ({pct}%)
                    </span>
                  </div>
                  <div className="h-2 bg-[#F5F5F5] w-full">
                    <div className="h-full bg-[#D4AF37]" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Top Selling Products */}
      <div className="border border-neutral-200 bg-white p-5">
        <h3 className="font-display text-lg font-semibold text-[#111111] mb-4">
          Top-Performing Products (Verified Paid Sales)
        </h3>
        <table className="w-full text-sm text-left">
          <thead className="text-xs uppercase text-neutral-500 border-b border-neutral-200">
            <tr>
              <th className="py-2">Product</th>
              <th className="py-2 text-right">Units Sold</th>
              <th className="py-2 text-right">Gross Revenue</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {topProducts.map((item, idx) => (
              <tr key={idx}>
                <td className="py-2.5 font-medium text-[#111111]">{item.name}</td>
                <td className="py-2.5 text-right tabular-nums">{item.qty}</td>
                <td className="py-2.5 text-right tabular-nums font-semibold">
                  {formatNaira(item.revenue)}
                </td>
              </tr>
            ))}
            {topProducts.length === 0 && (
              <tr>
                <td colSpan={3} className="py-6 text-center text-xs text-neutral-500">
                  No verified product sales yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
