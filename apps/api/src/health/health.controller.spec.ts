import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { HealthController } from './health.controller';

describe('HealthController', () => {
  it('should be defined', () => {
    const controller = new HealthController();
    assert.ok(controller);
  });

  it('should return liveness status ok with timestamp and uptime', () => {
    const controller = new HealthController();
    const result = controller.check();
    assert.equal(result.data.status, 'ok');
    assert.equal(typeof result.data.timestamp, 'string');
    assert.equal(typeof result.data.uptime, 'number');
    assert.ok(result.data.uptime >= 0);
  });
});
