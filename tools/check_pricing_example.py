"""Run the exact TypeScript calculator shown in the revised Clean Code report."""
from pathlib import Path
import subprocess
from update_documents import PRICE_CODE, ROOT, QA

sample=QA/'pricing-example.ts'
tests=r'''
import assert from 'node:assert/strict';
const start = new Date('2026-11-01T00:00:00Z');
const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const end = (duration: number): Date => new Date(start.getTime() + duration);
let cases = 0;
for (const [duration, days] of [
  [HOUR, 1], [DAY - 1, 1], [DAY, 1], [DAY + 1, 2], [30 * DAY, 30],
]) {
  const actual = calculateBreakdown(600_000, start, end(duration));
  assert.equal(actual.rentalDays, days);
  assert.equal(actual.totalVnd, days * 600_000);
  assert.equal(actual.serviceFeeVnd, 0);
  assert.equal(actual.depositVnd, 0);
  cases++;
}
for (const duration of [HOUR - 1, 0, -1, 30 * DAY + 1]) {
  assert.throws(() => calculateBreakdown(600_000, start, end(duration)), /INVALID_RENTAL_PERIOD/);
  cases++;
}
for (const rate of [0, -1, 0.5, Number.NaN, Number.POSITIVE_INFINITY, 100_000_001]) {
  assert.throws(() => calculateBreakdown(rate, start, end(DAY)), /INVALID_DAILY_PRICE/);
  cases++;
}
assert.throws(() => calculateBreakdown(600_000, new Date('invalid'), end(DAY)), /INVALID_RENTAL_PERIOD/); cases++;
assert.throws(() => calculateBreakdown(600_000, start, new Date('invalid')), /INVALID_RENTAL_PERIOD/); cases++;
assert.equal(calculateBreakdown(100_000_000, start, end(30 * DAY)).totalVnd, 3_000_000_000); cases++;
assert.equal(start.toISOString(), '2026-11-01T00:00:00.000Z'); cases++;
console.log(`${cases} calculator example checks passed. This is not an application test.`);
'''
sample.write_text(PRICE_CODE+'\n'+tests,encoding='utf-8')
node=Path(r'C:\Users\ADMIN\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe')
result=subprocess.run([str(node),str(sample)],capture_output=True,text=True,encoding='utf-8')
(QA/'pricing-example-check.log').write_text(result.stdout+result.stderr,encoding='utf-8')
print(result.stdout,end='')
if result.returncode:print(result.stderr)
raise SystemExit(result.returncode)
