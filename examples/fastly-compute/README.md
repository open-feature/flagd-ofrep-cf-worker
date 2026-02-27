# Fastly Compute example

This example runs `@openfeature/flagd-ofrep-cf-worker` on Fastly Compute.

## Prerequisites

- Fastly CLI authenticated for your account

## Run locally

```bash
npm install
npm run dev --workspace=examples/fastly-compute
```

The local server runs on `http://127.0.0.1:7676`.

## Endpoints

- `GET /health`
- `POST /ofrep/v1/evaluate/flags/{key}`
- `POST /ofrep/v1/evaluate/flags`

## Verify with curl

```bash
curl http://127.0.0.1:7676/health

curl -X POST http://127.0.0.1:7676/ofrep/v1/evaluate/flags/simple-boolean \
  -H "Content-Type: application/json" \
  -d '{"context":{"targetingKey":"user-123"}}'

curl -X POST http://127.0.0.1:7676/ofrep/v1/evaluate/flags \
  -H "Content-Type: application/json" \
  -d '{"context":{"targetingKey":"user-123"}}'
```
