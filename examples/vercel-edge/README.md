# Vercel Edge example

This example runs `@openfeature/flagd-ofrep-cf-worker` on Vercel Edge Functions.

## Run locally

```bash
npm install
npm run dev --workspace=examples/vercel-edge
```

The local server runs on `http://localhost:8788`.

## Endpoints

- `GET /health`
- `POST /ofrep/v1/evaluate/flags/{key}`
- `POST /ofrep/v1/evaluate/flags`

## Verify with curl

```bash
curl http://localhost:8788/health

curl -X POST http://localhost:8788/ofrep/v1/evaluate/flags/simple-boolean \
  -H "Content-Type: application/json" \
  -d '{"context":{"targetingKey":"user-123"}}'

curl -X POST http://localhost:8788/ofrep/v1/evaluate/flags \
  -H "Content-Type: application/json" \
  -d '{"context":{"targetingKey":"user-123"}}'
```
