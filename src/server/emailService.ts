export function buildBrandedEmailHtml(params: {
  title: string;
  greeting: string;
  bodyLines: string[];
  ctaLabel?: string;
  ctaUrl?: string;
  footerNote?: string;
}): string {
  const { title, greeting, bodyLines, ctaLabel, ctaUrl, footerNote } = params;
  return `
    <div style="font-family:'Plus Jakarta Sans',Arial,sans-serif;background:#F5F5F5;padding:32px 16px;color:#222222;">
      <div style="max-width:600px;margin:0 auto;background:#FFFFFF;border:1px solid #E5E5E5;">
        <div style="background:#111111;padding:28px 32px;text-align:center;border-bottom:2px solid #D4AF37;">
          <div style="color:#FFFFFF;font-family:Georgia,serif;font-size:22px;letter-spacing:0.18em;font-weight:600;">DIAMOND STORE</div>
          <div style="color:#D4AF37;font-size:11px;letter-spacing:0.16em;margin-top:6px;">YOUR STYLE, YOUR STATEMENT.</div>
        </div>
        <div style="padding:32px;">
          <h1 style="font-family:Georgia,serif;font-size:24px;color:#111111;margin:0 0 16px;">${title}</h1>
          <p style="font-size:15px;line-height:1.6;margin:0 0 16px;">${greeting}</p>
          ${bodyLines
            .map((line) => `<p style="font-size:14px;line-height:1.65;color:#444444;margin:0 0 12px;">${line}</p>`)
            .join('')}
          ${
            ctaLabel && ctaUrl
              ? `<div style="margin:28px 0 8px;">
                  <a href="${ctaUrl}" style="display:inline-block;background:#111111;color:#FFFFFF;text-decoration:none;padding:12px 28px;font-size:12px;letter-spacing:0.12em;text-transform:uppercase;border:1px solid #111111;">${ctaLabel}</a>
                 </div>`
              : ''
          }
        </div>
        <div style="background:#FAFAFA;padding:20px 32px;border-top:1px solid #EEEEEE;font-size:12px;color:#777777;">
          ${footerNote || 'Diamond Store · 14 Admiralty Way, Lekki Phase 1, Lagos, Nigeria'}
        </div>
      </div>
    </div>
  `.trim();
}

export async function dispatchBrandedEmail(params: {
  resendApiKey?: string;
  fromEmail?: string;
  to: string;
  subject: string;
  html: string;
}): Promise<{ delivered: boolean; provider: string; error?: string }> {
  const apiKey = params.resendApiKey || process.env.RESEND_API_KEY || '';
  if (!apiKey) {
    return { delivered: false, provider: 'none', error: 'Email provider credentials not configured yet.' };
  }

  try {
    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: params.fromEmail || 'Diamond Store <orders@diamondstore.ng>',
        to: [params.to],
        subject: params.subject,
        html: params.html,
      }),
    });
    if (!resp.ok) {
      const errBody = await resp.text();
      return { delivered: false, provider: 'resend', error: errBody };
    }
    return { delivered: true, provider: 'resend' };
  } catch (err: any) {
    return { delivered: false, provider: 'resend', error: err?.message || 'Network failure' };
  }
}
