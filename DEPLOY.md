# Deploying StockSense (all free)

| Part | Where | Why |
|---|---|---|
| Database | **Neon** (Postgres) | free, no expiry |
| Backend API | **Render** (free web service) | runs the Express server |
| Frontend | **Vercel** | free static hosting + the `/api` rewrite |
| Email (OTP) | **Brevo** | free 300/day; works on port 2525, which Render allows |

You do not need the repo owner. The repo is public: Render deploys it by URL, and the frontend is deployed from your laptop with the Vercel CLI.

Do the steps **in this order**: the frontend needs the backend's URL.

## 1. Database (Neon) — 3 min
1. https://neon.tech -> sign up -> **Create project** (any name, nearest region).
2. On the project dashboard click **Connect**. Turn **Connection pooling OFF**.
3. Copy the connection string (`postgresql://...neon.tech/neondb?sslmode=require`). Keep it: this is `DATABASE_URL`.

## 2. Email (Brevo) — 5 min
1. https://www.brevo.com -> sign up (free).
2. Top-right menu -> **SMTP & API** -> **SMTP** tab -> **Generate a new SMTP key**. Copy the key (this is `SMTP_PASS`) and note the **Login** shown there (this is `SMTP_USER`).
3. **Senders, domains & dedicated IPs -> Senders -> Add a sender**: use your Gmail, then open the verification email Brevo sends and confirm it.
4. `MAIL_FROM` will be `"StockSense <your-gmail@gmail.com>"`. (OTP emails from a Gmail sender may land in **Spam** — check there.)

## 3. Backend (Render) — 10 min
1. https://render.com -> sign up -> **New +** -> **Blueprint**.
2. Choose **Public Git Repository**, paste `https://github.com/Sahil-06-22/Odoo_gcet`, Connect.
3. Render reads `render.yaml`. Fill the prompted values:
   - `DATABASE_URL` -> the Neon string from step 1
   - `SMTP_USER`, `SMTP_PASS` -> from Brevo
   - `MAIL_FROM` -> `"StockSense <your-gmail@gmail.com>"`
   - `CORS_ORIGIN` -> `https://placeholder.vercel.app` for now (fixed in step 6)
4. **Apply**. The first build takes a few minutes and runs the database migrations.
5. When it says **Live**, copy the service URL (e.g. `https://stocksense-api-xxxx.onrender.com`) and open `<that URL>/api/health` — it should show `{"status":"ok"}`.

## 4. Point the frontend at the backend
Edit `frontend/vercel.json`: replace `REPLACE-WITH-YOUR-RENDER-URL.onrender.com` with your Render host (no `https://`, keep the rest). Commit and push.

## 5. Frontend (Vercel CLI) — 5 min
In a terminal:
```
cd frontend
npx vercel login          # opens the browser
npx vercel                # accept defaults; it detects Vite. Say "yes" to link/create the project
npx vercel --prod         # production deploy; prints your public URL
```

## 6. Finish
1. Render -> your service -> **Environment** -> set `CORS_ORIGIN` to your Vercel URL -> save (it redeploys).
2. Seed demo data once (from your laptop, PowerShell). **This wipes the database, so only do it the first time:**
   ```
   cd backend
   $env:DATABASE_URL="<the Neon string>"
   npm run db:seed
   ```
3. Open your Vercel URL and log in as `priya@stocksense.io` / `password123`.

## Before the demo
- Render's free service **sleeps after ~15 min idle**; the next request takes ~30-60 s. Open `<render URL>/api/health` a minute before presenting. To keep it awake, add a free monitor at https://uptimerobot.com that pings that URL every 5 minutes.
- Change the seeded passwords if the link will be public.
