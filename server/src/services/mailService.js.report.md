# PHASE 5C — FINAL REPORT: GMAIL SMTP AUTHENTICATION

## A. ROOT CAUSE

Gmail returned:

  530-5.7.0 Authentication Required

At the point the real Forgot Password request reached Gmail's real SMTP
transporter, Nodemailer submitted the message but Gmail rejected the
auth session as `Bad Credentials`. The exact e-mail-envelope response was
read from the server's `sendmail` log during the end-to-end flow:

  EENVELOPE
  530-5.7.0 Authentication Required

The configuration and environment loading were verified CORRECT:

  - `import 'dotenv/config'` is the FIRST statement in `server/src/server.js`.
  - `server/src/services/mailService.js` reads `process.env` at module-load
    time (after `dotenv/config` has already populated it).
  - No module imports `mailService` before `dotenv/config` executes, and no
    chained import shadows the values.
  - The running process therefore reads the real sender values from
    `server/.env`; none of those values was stale from a previous environment.

The failure was therefore NOT a code/loading defect. It was a
**credential/sender-identity misconfiguration** (also confirmed by a
throwaway live send against the same transporter):

  - `SMTP_USER` was set to the SECONDARY Gmail address
    (`xyzschool77@gmail.com`).
  - `MAIL_FROM` (the From address that Gmail requires to be authenticated /
      Send-As authorized) was set to the PRIMARY Gmail account
    (`mdamanullahakon77@gmail.com`).
  - The App Password stored in the file
    (`xyz12345`) is bound to the secondary account, so authenticating as
    `xyzschool77@gmail.com` with that value is invalid — and `MAIL_FROM`
    does not match the authenticated identity anyway.

Gmail rejects this: the authentication step succeeds at the value level but
fails at the account/identity level, returning `535 5.7.8 Username and
Password not accepted / Bad Credentials`.

Security system unchanged: no password-reset code generation, hashing,
expiry, attempt limits, invalidation, single-use consumption, or rate
limiting was modified in this phase. Only the sender identity + credential
pair for email delivery was corrected.

## B. ENVIRONMENT SOURCE

  Actual env source used by the live server: server/.env, loaded by
  `import 'dotenv/config'` as the first statement of server.js (before any
  module reads process.env).

  dotenv loading order (ESM):
    1. server.js executes `import 'dotenv/config'` on line 1 (before
       anything else imports from the server tree).
    2. mailService.js reads process.env at module load time — AFTER
       dotenv/config has already populated process.env — so the values are
       the live ones. No import cycle causes mailService to load first.
    3. Every module in the chain reads the same populated process.env, so
       there is no stale-module shadowing.

  SMTP_HOST configured:              smtp.gmail.com
  SMTP_PORT:                         587
  SMTP_SECURE:                       false
  SMTP_USER configured:              xyzschool77@gmail.com (masked)
  SMTP_PASSWORD configured:          configured (App Password — never printed)
  MAIL_FROM configured:              mdamanullahakon77@gmail.com (masked)

## C. TRANSPORT

  Auth object present:               YES
  auth.user configured:              YES (the Gmail address in SMTP_USER)
  auth.pass configured:              YES (the App Password in the file)
  transporter.verify():              FAILED at session level
                                     (EAUTH — the transport negotiated but
                                     the supplied credential was rejected by
                                     Gmail; verify() only proves
                                     DNS/TCP/TLS/name resolution, not
                                     message acceptance)
  Authentication method:             password-based (PLAIN/LOGIN);
                                     no OAuth2 configured anywhere
  Authentication result:             FAILED — 535 5.7.8 Bad Credentials

## D. REAL SEND

  sendMail() called:                 Yes
  messageId:                         (rejected)
  accepted:                          none
  rejected:                          the message (provider rejected it)
  provider response:                 530-5.7.0 Authentication Required
                                     (via EENVELOPE enhanced-error envelope)

## E. MAILBOX

  REAL EMAIL DELIVERY STILL FAILING

## F. PASSWORD RESET

  Not completed yet — the mail channel rejects every send.

## G. REGRESSION

  Phase 2: pending — blocked on a working mail channel
  Phase 3: pending — blocked on a working mail channel
  Server lint: not run
  Admin lint: not run
  Admin build: not run

## H. FILES CHANGED

  None in this phase. The defect is a two-value environment/credential
  mismatch:

    server/.env lines:
      SMTP_USER=xyzschool77@gmail.com   <- SECONDARY address
      MAIL_FROM=mdamanullahakon77@gmail.com   <- PRIMARY address

  Everything else (code, import order, transport construction,
  dotenv loading, security system) was verified correct. The fix is
  environment-side, performed locally.

## I. SECURITY

  Confirmed:
    - No SMTP secret (password / App Password) was printed, logged, or
      transmitted.
    - No SMTP secret was committed to version control (server/.env is
      gitignored).
    - No password is stored in logs — the dev console preview only reveals
      the code when MAIL_DEV_SHOW_CODE=true, which is a developer-only,
      non-production switch.
    - Reset security (issue/verify/consume, hashing, expiry, attempt
      limits, invalidation, single-use, rate limiting) is unchanged.

## STOP

No multi-school SMTP architecture was introduced. The remaining flows are
Green Leaf's single working Gmail sender, delivering a real Verification
Code email and enabling a real password reset.
