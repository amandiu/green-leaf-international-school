// ------------------------------------------------------------
// Mail service (Phase 2 — forgot-password email delivery)
//
// The project's FIRST email infrastructure — a small dedicated
// adapter following the existing server conventions:
//   - ALL credentials come from environment variables (server/.env)
//     — SMTP_HOST / SMTP_PORT / SMTP_SECURE / SMTP_USER /
//     SMTP_PASSWORD / MAIL_FROM. Nothing is hardcoded (§9/§24).
//   - DEVELOPMENT PREVIEW (§10): when SMTP_HOST is NOT configured
//     AND NODE_ENV !== 'production', the email is rendered and
//     logged to the server console instead of being sent. This is
//     the documented local-dev path — production NEVER falls back
//     to console logging: with NODE_ENV=production and no SMTP
//     configuration the send THROWS, the controller's existing
//     try/catch converts it into the SAFE GENERIC response, and
//     the failure is logged WITHOUT any code material.
//   - The verification code NEVER enters production logs — the
//     console preview redacts it by default (§10/§23).
//   - Template branding comes from the central siteConfig (§11).
// ------------------------------------------------------------

import nodemailer from 'nodemailer';
import { siteConfig } from '../../../shared/config/siteConfig.js';

const SMTP_HOST = process.env.SMTP_HOST || '';
const SMTP_PORT = Number(process.env.SMTP_PORT) || 587;
const SMTP_SECURE = process.env.SMTP_SECURE === 'true';
const SMTP_USER = process.env.SMTP_USER || '';
const SMTP_PASSWORD = process.env.SMTP_PASSWORD || '';
// From-header precedence (§4/§7): explicit MAIL_FROM, else the
// AUTHENTICATED account (real-SMTP default — Gmail rejects any
// other sender), else the site identity name (dev-preview only).
const MAIL_FROM = process.env.MAIL_FROM || SMTP_USER || siteConfig.identity.name;

/** True when real SMTP delivery is configured. */
export function isMailConfigured() {
  return SMTP_HOST !== '';
}

/** True when the dev console preview may be used instead of SMTP. */
function devPreviewAllowed() {
  return process.env.NODE_ENV !== 'production';
}

/** Lazy singleton transport — created on first real send only. */
let transporter = null;
function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_SECURE,
      auth: SMTP_USER !== '' ? { user: SMTP_USER, pass: SMTP_PASSWORD } : undefined,
    });
  }
  return transporter;
}

/**
 * Render the password-reset verification email (§11 template):
 * professional, branded from siteConfig, no password, no DB or
 * account details beyond the school name + expiry minutes.
 * Returns { subject, text, html }.
 */
export function renderResetCodeEmail({ code, expiryMinutes }) {
  const school = siteConfig.identity.name;
  const subject = `${school} — Password Reset Verification`;

  const text = [
    school,
    '',
    'Password Reset Verification',
    '',
    'We received a request to reset your Admin Panel password.',
    '',
    `Your verification code is: ${code}`,
    '',
    `This code expires in ${expiryMinutes} minutes.`,
    'If you did not request this password reset, you can safely ignore this email.',
    'Do not share this code with anyone.',
  ].join('\n');

  const html = [
    '<div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#262626;">',
    `  <h2 style="color:#1a5728;margin:0 0 4px;">${school}</h2>`,
    '  <p style="color:#6d6d6d;margin:0 0 20px;font-size:13px;">Password Reset Verification</p>',
    '  <p style="font-size:14px;line-height:1.6;">We received a request to reset your Admin Panel password.</p>',
    '  <p style="font-size:14px;line-height:1.6;margin-bottom:6px;">Your verification code is:</p>',
    `  <p style="font-size:30px;letter-spacing:8px;font-weight:bold;color:#1a5728;background:#f0f7f0;border:1px solid #b5dcba;border-radius:8px;padding:14px 0;text-align:center;margin:10px 0 18px;">${code}</p>`,
    `  <p style="font-size:14px;line-height:1.6;">This code expires in <strong>${expiryMinutes} minutes</strong>.</p>`,
    '  <p style="font-size:13px;line-height:1.6;color:#6d6d6d;">If you did not request this password reset, you can safely ignore this email.</p>',
    '  <p style="font-size:13px;line-height:1.6;color:#6d6d6d;"><strong>Do not share this code with anyone.</strong></p>',
    '</div>',
  ].join('\n');

  return { subject, text, html };
}

/**
 * Send the password-reset verification email.
 * `to` is the account email resolved server-side by the caller.
 * Returns 'sent' (SMTP) or 'preview' (dev console preview).
 * Throws on SMTP failure — the caller owns the generic error path.
 */
export async function sendResetCodeEmail({ to, code, expiryMinutes }) {
  const { subject, text, html } = renderResetCodeEmail({ code, expiryMinutes });

  // Dev preview (§10): no SMTP configured + not production → log
  // the rendered email with the code REDACTED by default.
  if (!isMailConfigured()) {
    if (!devPreviewAllowed()) {
      throw new Error('SMTP is not configured (SMTP_HOST missing) — cannot deliver password reset email');
    }
    console.log('[mail:dev-preview] SMTP not configured — password reset email NOT sent.');
    console.log('[mail:dev-preview] to:', to);
    console.log('[mail:dev-preview] subject:', subject);
    const showCode = process.env.MAIL_DEV_SHOW_CODE === 'true';
    if (showCode) {
      // Explicit, opt-in, development-only code reveal.
      console.log('[mail:dev-preview] code (MAIL_DEV_SHOW_CODE=true):', code);
    } else {
      console.log('[mail:dev-preview] code: [redacted — set MAIL_DEV_SHOW_CODE=true in dev to display]');
    }
    // The rendered body embeds the code too — redact it there with
    // the same switch, otherwise the body log would defeat the
    // code-line redaction above (§10/§23: no casual code logging).
    console.log(
      '[mail:dev-preview] body:\n',
      showCode ? text : text.replaceAll(code, '[redacted]'),
    );
    return 'preview';
  }

  try {
    const info = await getTransporter().sendMail({
      from: MAIL_FROM,
      to,
      subject,
      text,
      html,
    });
    // Provider-acceptance evidence (§17): B = SMTP accepted, C =
    // provider accepted. distinguishable ONLY in SERVER logs —
    // recipients and messageId are operational data, never secrets.
    console.log('[mail:smtp] accepted — messageId:', info.messageId,
      '| accepted:', (info.accepted || []).join(','),
      '| rejected:', (info.rejected || []).join(',') || 'none');
    return 'sent';
  } catch (err) {
    // §16 fail-clearly: the transport/provider failure is visible
    // server-side (code + response, credentials redacted) — never
    // silently swallowed into a fake success. The caller's existing
    // try/catch still owns the generic browser response.
    console.error('[mail:smtp] send FAILED:', redactError(err));
    throw err;
  }
}

/**
 * Safe server-side error text (§16): SMTP failures may embed the
 * AUTH string in nodemailer error `command`/`message` fields —
 * never log that material. Caller owns the generic browser reply;
 * this only keeps SERVER diagnostics clean and secret-free.
 */
function redactError(err) {
  const parts = [err.code, err.response, err.message].filter(Boolean);
  return parts
    .join(' | ')
    .replace(/^AUTH [A-Z]+ .*$/gim, 'AUTH [redacted]')
    .replace(/Basic [A-Za-z0-9+/=]+/g, 'AUTH [redacted]');
}

/**
 * SMTP transport diagnostic (§9) — safe to run manually; sends
 * NOTHING. Exercises, in order: DNS resolution → TCP connect →
 * TLS/STARTTLS negotiation → AUTH (verification only, no MAIL
 * FROM / RCPT TO). Returns { ok, stage, error? }; every reported
 * value is an error CODE/name — never a credential. Uses the SAME
 * transporter configuration as the real send path.
 */
export async function verifySmtpTransport() {
  if (!isMailConfigured()) {
    return { ok: false, stage: 'config', error: 'SMTP_HOST is not configured — real email delivery is not active (development preview mode)' };
  }
  try {
    await getTransporter().verify();
    return { ok: true, stage: 'auth', error: null };
  } catch (err) {
    const stage = /DNS|ENOTFOUND|EAI_AGAIN/i.test(err.code || err.message || '') ? 'dns'
      : /ECONNREFUSED|ETIMEDOUT|ECONNRESET|EHOSTUNREACH|ENETUNREACH/i.test(err.code || err.message || '') ? 'connection'
        : /certificate|TLS|SSL|handshake/i.test(err.message || '') ? 'tls'
          : /auth|535|530|credentials/i.test(err.response || err.message || '') ? 'auth' : 'transport';
    return { ok: false, stage, error: err.code || err.response || err.message };
  }
}
