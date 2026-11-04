import { setTimeout as delay } from 'node:timers/promises';

const base = process.env.DEV_READY_BASE_URL || 'http://localhost:3000';
const timeout = Number(process.env.DEV_READY_TIMEOUT_MS || 180000);
const deadline = Date.now() + timeout;
const checks = [
  ['/api/v1/health', (body) => body.data?.status === 'ok' && body.data?.database === 'connected'],
  ['/api/v1/vehicles?page=1&pageSize=1', (body) => Array.isArray(body.data)],
  [
    '/api/v1/auth/csrf',
    (body) => typeof body.data?.csrfToken === 'string' && body.data.csrfToken.length > 0,
  ],
];

for (const [path, valid] of checks) {
  let ready = false;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(new URL(path, base), {
        signal: AbortSignal.timeout(Math.max(1, Math.min(5000, deadline - Date.now()))),
      });
      if (response.ok && valid(await response.json())) {
        ready = true;
        break;
      }
    } catch {
      /* The API or Next dev compiler is still starting. */
    }
    await delay(500);
  }
  if (!ready) {
    console.error(`Startup timed out waiting for ${path}. Check the backend/frontend logs.`);
    process.exit(1);
  }
  console.log(`Ready: ${path}`);
}
console.log('CarShare is ready.');
