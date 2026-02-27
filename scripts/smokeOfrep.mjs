const baseUrl = (process.env.OFREP_BASE_URL || 'http://localhost:8787').replace(/\/$/, '');

const singlePayload = {
  context: {
    targetingKey: 'user-123',
  },
};

const bulkPayload = {
  context: {
    targetingKey: 'user-123',
  },
};

async function requestJson(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, options);
  const text = await response.text();
  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { response, body };
}

async function run() {
  const health = await requestJson('/health');
  if (!health.response.ok) {
    throw new Error(`Health check failed: ${health.response.status}`);
  }

  const single = await requestJson('/ofrep/v1/evaluate/flags/simple-boolean', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(singlePayload),
  });
  if (!single.response.ok || !single.body || single.body.key !== 'simple-boolean') {
    throw new Error(`Single evaluation failed: ${single.response.status}`);
  }

  const bulk = await requestJson('/ofrep/v1/evaluate/flags', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(bulkPayload),
  });
  if (!bulk.response.ok || !bulk.body || !Array.isArray(bulk.body.flags)) {
    throw new Error(`Bulk evaluation failed: ${bulk.response.status}`);
  }

  process.stdout.write(`Smoke checks passed for ${baseUrl}\n`);
}

run().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
