// KODA — branded transactional email renderer.
// Renders exactly what a recipient receives: the merchant's logo mark, brand
// colour and details on every outbound email (white-label ready).
'use strict';

const SEVERITY_COLOR = { info: '#2A6FB0', success: '#128A5F', warning: '#B87A0D', critical: '#C0392B' };

function esc(s) { return String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

function renderEmail({ subject, event, merchant, user, data = {} }) {
  const brand = merchant?.brand_color || '#E8A11F';
  const logoText = merchant?.logo_text || merchant?.name || 'KODA';
  const sev = SEVERITY_COLOR[event?.severity] || SEVERITY_COLOR.info;
  const body = data.body || defaultBody(event, data);

  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#EFEAD9;font-family:Arial,Helvetica,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#EFEAD9;padding:32px 12px">
<tr><td align="center">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%">
  <tr><td style="padding:0 8px 18px">
    <table role="presentation" cellpadding="0" cellspacing="0"><tr>
      <td style="background:${brand};border-radius:8px;width:34px;height:34px;text-align:center;color:#081813;font-weight:bold;font-size:16px;font-family:'Courier New',monospace">✓</td>
      <td style="padding-left:10px;font-weight:bold;letter-spacing:2px;color:#241F14;font-size:17px">${esc(logoText).toUpperCase()}</td>
    </tr></table>
  </td></tr>
  <tr><td style="background:#FDFBF4;border:1px solid #E2D9C2;border-top:4px solid ${sev};border-radius:12px;padding:34px 36px">
    <p style="margin:0 0 6px;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:${sev};font-family:'Courier New',monospace"><b>${esc(event?.categoryLabel || 'Notification')}</b></p>
    <h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;color:#241F14">${esc(subject)}</h1>
    <p style="margin:0 0 22px;font-size:15px;line-height:1.65;color:#5A5340">${body}</p>
    ${data.cta ? `<a href="${esc(data.cta_url || '#')}" style="display:inline-block;background:${brand};color:#081813;font-weight:bold;font-size:14px;padding:12px 26px;border-radius:8px;text-decoration:none">${esc(data.cta)}</a>` : ''}
    ${data.details ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:24px;background:#F5EFDF;border-radius:8px"><tr><td style="padding:16px 18px;font-family:'Courier New',monospace;font-size:12.5px;color:#41392A;line-height:1.8">${data.details}</td></tr></table>` : ''}
  </td></tr>
  <tr><td style="padding:18px 8px 6px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F5EFDF;border-radius:8px"><tr>
      <td style="padding:14px 18px;font-size:12.5px;color:#5A5340;line-height:1.6">
        <b style="color:#241F14">Verify mobile-money payments in 3 seconds.</b><br>
        No fake screenshots, no telco contract — start free.
      </td>
      <td align="right" style="padding:14px 18px;white-space:nowrap">
        <a href="https://kodajnn.com" style="display:inline-block;background:${brand};color:#081813;font-weight:bold;font-size:12.5px;padding:9px 16px;border-radius:8px;text-decoration:none">Get KODA →</a>
      </td>
    </tr></table>
  </td></tr>
  <tr><td style="padding:12px 8px;font-size:11.5px;color:#8A8168;line-height:1.7">
    Sent by ${esc(logoText)} · powered by KODA — le code confirme le cash.<br>
    ${esc(merchant?.name || 'KODA')} · ${esc(merchant?.country || 'CD')} · <a href="https://kodajnn.com/app#comms" style="color:#8A8168">notification preferences</a>
    ${event?.mandatory ? ' · <b>mandatory service notice</b>' : ''}
  </td></tr>
</table>
</td></tr></table></body></html>`;
}

function defaultBody(event, data) {
  if (!event) return '';
  const map = {
    'payment.verified': `A payment of <b>${esc(data.amount || '')}</b> was verified against your operator ledger. Reference <b>${esc(data.reference || '')}</b>. The code is now locked and cannot be reused.`,
    'billing.topup.verified': `Your wallet top-up was verified by KODA's own engine — <b>${esc(data.acu || '')} ACU</b> credited instantly.`,
    'sentinel.offline': `Your Sentinel device stopped sending heartbeats. Payments arriving on that SIM are queued on-device and will back-fill when it reconnects — but live verification is degraded until then.`,
    'fraud.chain_break': `An SMS claiming to be from your operator broke the running balance arithmetic on your line. It was quarantined and will never verify a payment. No action is required, but stay alert for social-engineering follow-ups.`,
  };
  return map[event.key] || `This is a notification from your KODA account: <b>${esc(event.label)}</b>.`;
}

module.exports = { renderEmail };
