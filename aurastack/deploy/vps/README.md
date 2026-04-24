# Hostinger VPS Deployment (Docker + Nginx)

This deployment runs the full stack on your VPS:
- `nginx` as public reverse proxy
- `web` as built production frontend container
- `api` + `worker` for backend and queues
- `agents` for Python agents
- `postgres` + `redis` as stateful services

## 1) DNS and host setup

In Hostinger DNS, point your app domain to the VPS public IP:
- `pace.claritymvp.com` -> `A` record -> your VPS IP
- `api.claritymvp.com` -> `A` record -> your VPS IP

Use those values for `APP_HOST` and `API_HOST` in `.env.vps`.

## 2) VPS prerequisites

Install Docker + Compose plugin on the VPS.

```bash
sudo apt update
sudo apt install -y ca-certificates curl gnupg
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
```

## 3) Configure environment

Create your VPS env file:

```bash
cp deploy/vps/.env.vps.example deploy/vps/.env.vps
```

Then edit:
- `APP_HOST`
- `API_HOST`
- `WEB_ORIGIN`
- `LETSENCRYPT_EMAIL`
- `POSTGRES_PASSWORD`
- `DATABASE_URL` (must match password and DB name)
- `JWT_SECRET`
- `INTERNAL_WORKER_TOKEN`
- `OPENAI_API_KEY` (optional; leave empty for deterministic fallback)

## 4) Deploy

From repo root on VPS:

```bash
npm run vps:deploy
```

Check:

```bash
npm run docker:vps:logs -- nginx api worker agents
```

## 5) Enable HTTPS (Let's Encrypt)

After DNS is live and the app is reachable on HTTP:

```bash
npm run vps:https
```

This will:
- request certificates for `APP_HOST` and `API_HOST`
- switch Nginx config to TLS
- restart Nginx with HTTPS enabled

Set a cron for auto-renew:

```bash
crontab -e
```

```cron
0 3 * * * cd /path/to/smart-case-buddy && ENV_FILE=/path/to/smart-case-buddy/deploy/vps/.env.vps bash deploy/vps/scripts/renew-https.sh >> /var/log/smart-case-buddy-renew.log 2>&1
```

## 6) Update release

```bash
git pull
npm run vps:deploy
```

If you want to repopulate India demo data for client demos:

```bash
npm run vps:seed
```

## 7) Notes

- The frontend is configured to call `https://api.claritymvp.com`.
- No `localhost:8000` is required in browser-facing URLs.
- API is exposed on `https://api.claritymvp.com` (and still available via `/api` on web host).
- If `OPENAI_API_KEY` is empty, decisioning still works via deterministic fallback logic.
- Sign in is currently passwordless (email + role); if sign in fails, API is usually down or unreachable.

