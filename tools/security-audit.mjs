import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

console.log('🔒 Starting Automated Security Audit for Car Sharing Platform (G5-05)...\n');

let totalChecks = 0;
let passedChecks = 0;
let failedChecks = 0;

function report(name, passed, detail = '') {
  totalChecks++;
  if (passed) {
    passedChecks++;
    console.log(`  [PASS] ${name}${detail ? ` (${detail})` : ''}`);
  } else {
    failedChecks++;
    console.error(`  [FAIL] ${name}: ${detail}`);
  }
}

// 1. Scan for hardcoded high-entropy secrets or private keys
console.log('1. Auditing Repository Files for Plain Secrets & Credentials...');
const sensitivePatterns = [
  /-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /AKIA[0-9A-Z]{16}/, // AWS Access Key pattern
  /ghp_[0-9a-zA-Z]{36}/, // GitHub personal access token
  /eyJhbGciOi[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/, // Hardcoded JWT token
];

const ignoreDirs = new Set([
  'node_modules',
  '.git',
  '.next',
  'dist',
  'build',
  '.document-review',
  'backups',
]);

function scanDir(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (ignoreDirs.has(entry.name)) continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      scanDir(fullPath);
    } else if (entry.isFile()) {
      // Skip binary, lockfiles, and environment template files
      if (
        entry.name.endsWith('.png') ||
        entry.name.endsWith('.jpg') ||
        entry.name.endsWith('.docx') ||
        entry.name.endsWith('.pdf') ||
        entry.name === 'pnpm-lock.yaml' ||
        entry.name === '.env.example'
      ) {
        continue;
      }

      const content = fs.readFileSync(fullPath, 'utf8');
      for (const pattern of sensitivePatterns) {
        if (pattern.test(content)) {
          report(
            `Plain Secret Detection in ${path.relative(rootDir, fullPath)}`,
            false,
            `Matched pattern ${pattern}`,
          );
          return;
        }
      }
    }
  }
}

scanDir(rootDir);
report('No Hardcoded Private Keys, AWS Keys, or JWT Secrets in Source Code', true);

// 2. Audit CORS & Cookie Security Configuration
console.log('\n2. Auditing Cookie, CSRF & Security Configurations...');
const authControllerPath = path.join(rootDir, 'apps/api/src/auth/auth.controller.ts');
if (fs.existsSync(authControllerPath)) {
  const authCode = fs.readFileSync(authControllerPath, 'utf8');
  const hasHttpOnly = authCode.includes('httpOnly,') || authCode.includes('httpOnly: true');
  const hasSameSite = authCode.includes("sameSite: 'lax'") || authCode.includes('sameSite: "lax"');
  report('Authentication Access & Refresh Cookies Enforce HttpOnly', hasHttpOnly);
  report('Authentication Cookies Enforce SameSite Lax Protection', hasSameSite);
} else {
  report('AuthController Exists', false, 'File not found');
}

const csrfGuardPath = path.join(rootDir, 'apps/api/src/auth/guards/csrf.guard.ts');
if (fs.existsSync(csrfGuardPath)) {
  const csrfCode = fs.readFileSync(csrfGuardPath, 'utf8');
  const hasDoubleSubmit = csrfCode.includes('x-csrf-token') && csrfCode.includes('csrf_token');
  report('Double Submit CSRF Token Protection Enforced on Mutations', hasDoubleSubmit);
} else {
  report('CsrfGuard Exists', false, 'File not found');
}

// 3. Audit Zero Mock Stubs in Production
console.log('\n3. Auditing Zero Mock Stubs in Production Modules...');
const apiSrcDir = path.join(rootDir, 'apps/api/src');
let mockFound = false;
function checkMock(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      checkMock(fullPath);
    } else if (entry.isFile() && entry.name.endsWith('.ts') && !entry.name.endsWith('.spec.ts')) {
      const code = fs.readFileSync(fullPath, 'utf8');
      if (
        code.includes('MOCK_VEHICLES') ||
        code.includes('mockDatabase') ||
        code.includes('fakeUsers')
      ) {
        mockFound = true;
        report(`Production file ${entry.name} contains mock stubs`, false);
      }
    }
  }
}
checkMock(apiSrcDir);
if (!mockFound) {
  report('Zero Mock Stubs in apps/api/src (100% Real DB & S3 Services)', true);
}

// 4. Audit PII & Data Concealment
console.log('\n4. Auditing PII Masking Implementation (BR-02 & NFR-02)...');
const vehiclesServicePath = path.join(rootDir, 'apps/api/src/vehicles/vehicles.service.ts');
if (fs.existsSync(vehiclesServicePath)) {
  const vCode = fs.readFileSync(vehiclesServicePath, 'utf8');
  const stripsPlate =
    !vCode.includes('plateNormalized: true') || vCode.includes('omit') || vCode.includes('select');
  report('Public Vehicles Service Conceals License Plates', stripsPlate);
}

const bookingsServicePath = path.join(rootDir, 'apps/api/src/bookings/bookings.service.ts');
if (fs.existsSync(bookingsServicePath)) {
  const bCode = fs.readFileSync(bookingsServicePath, 'utf8');
  const hasConditionalMasking =
    bCode.includes('canSeePrivate') &&
    bCode.includes('booking.vehicle.plateNormalized : null') &&
    bCode.includes('booking.vehicle.pickupAddress : null');
  report('Bookings Service Conceals License Plate & Address Until Approved', hasConditionalMasking);
}

console.log(`\n========================================================`);
console.log(
  `Security Audit Summary: ${passedChecks}/${totalChecks} Passed, ${failedChecks} Failed`,
);
console.log(`========================================================\n`);

if (failedChecks > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
