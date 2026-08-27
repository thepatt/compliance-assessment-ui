# compliance-assessment-ui

React/TypeScript frontend for the HIPAA Security Rule compliance-assessment tool.
Split out from the original `healthcare-compliance-platform` monorepo into its own
repo; talks only to the backend's `/api/v1/compliance-assessments` HTTP endpoints
(no shared code).

The backend is integrated into `doc-cat-api`'s main app; only the `ai-agent`
(evidence evaluation service) still lives standalone at
`doc-cat-api/compliance-assessment/ai-agent`.

## Development

```bash
npm install
npm run dev   # proxies /api -> http://localhost:8000 (see vite.config.ts)
```

## Production build

```bash
docker build -t compliance-assessment-ui .
```

`nginx.conf` proxies `/api/` to doc-cat-api — update the target for your actual
deployment topology (currently defaults to `host.docker.internal:8000` for local
Docker Desktop testing).

## Sharing a local test link (ngrok)

Simplest way to let someone else test a local run: tunnel only the frontend
container's port. Its `nginx.conf` already proxies `/api/` to the backend, so a
single tunnel exposes the whole app.

1. Start doc-cat-api (backend, port 8000) and the compliance-assessment `ai-agent`:
   ```bash
   cd ../doc-cat-api && uv run main.py &
   cd compliance-assessment && docker compose up -d ai-agent
   ```
2. Build and run the frontend container:
   ```bash
   docker build -t compliance-ui .
   docker run -d --name compliance-ui -p 8090:80 --add-host=host.docker.internal:host-gateway compliance-ui
   ```
3. Install ngrok and add your authtoken (one-time, free account at
   https://dashboard.ngrok.com/signup):
   ```bash
   brew install ngrok
   ngrok config add-authtoken <your-authtoken>
   ```
4. Start the tunnel and share the printed `https://...ngrok-free.dev` URL:
   ```bash
   ngrok http 8090
   ```

Notes:
- Keep the `ngrok` terminal running — closing it kills the public link.
- The ngrok free tier shows a one-time "Visit Site" interstitial page.
- Stop `ngrok` (Ctrl+C) once testing is done to close the public link.
