# Local Development with Secure Public Access (Cloudflare Tunnel)

This guide explains how to run the Green Leaf website **on your own PC** and expose it
temporarily over the Internet through a secure HTTPS tunnel — **without deploying anything**.

```
Public Browser (anywhere)
        ↓  HTTPS
https://<random-name>.trycloudflare.com   ← temporary Cloudflare URL
        ↓  encrypted tunnel
Cloudflare Edge
        ↓
cloudflared (your PC)
        ↓
Vite dev client  :5173   ← serves React app + proxies /api
        ↓  Vite proxy /api → localhost:5000
Express server   :5000   ← API (DB/uploads stay local, never exposed)
```

## 1. Requirements

- Windows with Node.js installed (project already uses Node 18+)
- Three terminal windows (CMD, PowerShell, or Windows Terminal)
- An active Internet connection; the PC must stay powered on while sharing

## 2. Install Cloudflare Tunnel (cloudflared)

Check whether it is already installed:

```
cloudflared --version
```

If not installed, install with winget (official Cloudflare package):

```
winget install --id Cloudflare.cloudflared --source winget --accept-source-agreements --accept-package-agreements
```

Close and reopen the terminal so `cloudflared` is on PATH, then verify:

```
cloudflared --version
```

> Alternative: download `cloudflared-windows-amd64.msi` from
> https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/
> This installs cloudflared **as a service** — do NOT start the service; we only use it as a CLI.
> No Cloudflare account is needed for the quick-tunnel workflow below.

## 3. Start the Client

```
cd client
npm run dev
```

Local URL: http://localhost:5173

## 4. Start the Server

```
cd server
npm run dev
```

Local URL: http://localhost:5000 (health check: http://localhost:5000/api/health)

## 5. Start the Tunnel

```
cloudflared tunnel --url http://localhost:5173
```

## 6. Find the Public URL

cloudflared prints a line like:

```
+--------------------------------------------------------------+
|  Your quick Tunnel has been created! Visit it at:            |
|  https://xxxx-yyyy-zzzz.trycloudflare.com                    |
+--------------------------------------------------------------+
```

That `https://xxxx-yyyy-zzzz.trycloudflare.com` is your **temporary public URL**.

## 7. Test from Another Device

Open the public URL on a phone using **mobile data** (not your Wi-Fi) or any computer
outside your network. The website should load, all routes work, and the 3-row navbar +
news ticker function normally.

## 8. Stop Everything

- Tunnel: `CTRL + C` in the tunnel terminal → public URL stops working immediately
- Client: `CTRL + C` in the client terminal
- Server: `CTRL + C` in the server terminal

## 9. Security Warnings (READ BEFORE SHARING)

- The public URL is **open to anyone** who has it. Share it only with people you trust.
- Currently the **only** public API endpoint is `GET /api/health` (rate-limited, harmless).
  When API routes are added in Phase 5+, anything the server exposes becomes publicly
  reachable while the tunnel runs — including any admin endpoints. Revisit this section
  before enabling the tunnel again.
- The **admin panel (server/admin)** is NOT part of this tunnel. Do not tunnel its port.
  When the admin panel gets real functionality, do not expose it without authentication.
- The database (when added) must **never** be exposed; the proxy architecture above keeps
  it local.
- Never tunnel ports other than 5173. Never run `cloudflared` against the server port 5000
  directly — API access must go through the Vite proxy only.
- `server/.env` is gitignored and never sent to browsers; Vite env vars are limited to
  `VITE_*` names, and none are defined (no secrets in the client bundle).

## 10. Troubleshooting

**Website works locally but not via the public URL**
- Client running? (`npm run dev` still active)
- Tunnel targeting the right port? (`--url http://localhost:5173`)
- `client/vite.config.js` must contain `allowedHosts: ['.trycloudflare.com']` (already set).
- Windows Firewall prompt: allow cloudflared when it first appears.

**Frontend loads but API calls fail**
- Server running? Check http://localhost:5000/api/health locally.
- API calls must use same-origin `/api/...` paths (Vite proxies them to :5000).
- If a future feature hardcodes `http://localhost:5000`, remote browsers cannot reach it —
  use relative `/api/...` instead.
- The server's CORS allowlist (localhost origins) is irrelevant for proxied requests since
  they are same-origin; do not add `origin: "*"`.

**Public URL changed after restart**
- Quick tunnels generate a **random URL every run**. This is expected, not a bug.

**Remote device cannot connect**
- PC powered on and online, tunnel terminal still running, client terminal still running,
  correct current URL, no security software blocking cloudflared.

**404 on refresh of /about, /news, etc.**
- Not applicable: Vite dev server (spa fallback) serves `index.html` for unknown paths, and
  `allowedHosts` covers the tunnel host, so React Router handles the route.

## 11. API / Proxy Architecture

- Client code fetches same-origin `/api/...` (convention in `shared/constants/api.js`).
- Vite dev proxy: `'/api' → http://localhost:5000` (`client/vite.config.js`).
- Result: remote browsers talk **only** to :5173 through the tunnel; :5000 and any local
  database remain unreachable from the Internet. No CORS exceptions are needed.
- Direct URL refresh works because the Vite dev server has SPA fallback enabled by default.
