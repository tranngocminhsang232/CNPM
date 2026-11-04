import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';

async function run(server, timeout) {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    return await new Promise((resolve, reject) => {
      const child = spawn(process.execPath, ['tools/wait-dev-ready.mjs'], {
        env: {
          ...process.env,
          DEV_READY_BASE_URL: `http://127.0.0.1:${server.address().port}`,
          DEV_READY_TIMEOUT_MS: String(timeout),
        },
        stdio: 'ignore',
      });
      child.on('error', reject);
      child.on('exit', resolve);
    });
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

test('waits for backend startup and checks vehicles and session through the web', async () => {
  let attempts = 0;
  const visited = [];
  const server = createServer((request, response) => {
    visited.push(request.url);
    response.setHeader('Content-Type', 'application/json');
    if (request.url === '/api/v1/health' && ++attempts < 3) {
      response.writeHead(503);
      response.end('{}');
      return;
    }
    response.end(
      JSON.stringify({
        data: request.url.includes('/vehicles')
          ? []
          : request.url.includes('/csrf')
            ? { csrfToken: 'test-token' }
            : { status: 'ok', database: 'connected' },
      }),
    );
  });
  assert.equal(await run(server, 5000), 0);
  assert.equal(attempts, 3);
  assert.deepEqual(visited.slice(-2), ['/api/v1/vehicles?page=1&pageSize=1', '/api/v1/auth/csrf']);
});

test('fails instead of claiming success when services never become ready', async () => {
  const server = createServer((request, response) => {
    response.writeHead(503);
    response.end('{}');
  });
  assert.equal(await run(server, 600), 1);
});
