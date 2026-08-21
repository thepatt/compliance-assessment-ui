# compliance-assessment-ui

React/TypeScript frontend for the HIPAA Security Rule compliance-assessment tool.
Split out from the original `healthcare-compliance-platform` monorepo into its own
repo; talks only to the backend's `/api/v1` HTTP endpoints (no shared code).

The backend + ai-agent now live at `doc-cat-api/compliance-assessment`.

## Development

```bash
npm install
npm run dev   # proxies /api -> http://localhost:8100 (see vite.config.ts)
```

## Production build

```bash
docker build -t compliance-assessment-ui .
```

`nginx.conf` proxies `/api/` to the backend — update the target for your actual
deployment topology (currently defaults to `host.docker.internal:8100` for local
Docker Desktop testing).
