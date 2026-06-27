# Local preview + autonomous browser control (free Replit alternative)

This gives you a Replit-style loop — **view, click, edit, preview, share** — for
free, running on your own machine. Three pieces:

1. **Edit** — Claude edits files in this repo directly (no MCP needed).
2. **Run/preview** — the Expo web export served locally on port 3000.
3. **Drive as a user** — the **Playwright MCP** lets Claude open a browser,
   click, type, and screenshot the running app.
4. **Share (optional)** — a free **cloudflared** quick tunnel gives a public URL.

## One-time setup (already done)

- `.mcp.json` registers the Playwright MCP (`npx @playwright/mcp`).
- Playwright chromium browser installed.
- `cloudflared` installed (winget: `Cloudflare.cloudflared`).
- Node 20 on PATH.

> **Activate the MCP:** restart Claude Code (or run `/mcp`) so it loads the
> `playwright` server from `.mcp.json`. Approve it when prompted.

## Run the preview

```bash
# from the repo root
npm run build:web      # expo export -> dist/
npm run serve:web      # serve -s dist on 0.0.0.0:3000  (or: npm run replit for both)
```

App is now at **http://localhost:3000**.

## Optional: free public URL (share / view from phone)

In a second terminal, with the app already serving on 3000:

```bash
cloudflared tunnel --url http://localhost:3000
```

It prints a `https://<random>.trycloudflare.com` URL — public, no login, free.
(The URL changes each run; that's fine for previews.)

## The Claude-driven loop

Once the Playwright MCP is loaded and the app is serving, Claude can:

- open `http://localhost:3000` in a browser,
- screenshot the current screen,
- click buttons / fill the login form / navigate,
- read what's on screen and report issues,
- edit the code, you re-run `build:web`, and Claude re-screenshots.

So the iteration is: **Claude edits → you (or a script) rebuild → Claude views
via the browser → repeat.** Hot reload alternative: `npm run web`
(`expo start --web`) rebuilds on save, but the static export is more reliable.

## Notes

- This is **local-first**: the app runs on your machine, not a cloud host. The
  cloudflared URL is a tunnel to it, so it only works while your machine + the
  serve + the tunnel are running.
- For real backend data, set `EXPO_PUBLIC_*` env vars before `build:web`
  (they're baked at build time). See `.env.example`.
- The Replit firewall that blocked the cloud build does **not** affect this
  local setup.
