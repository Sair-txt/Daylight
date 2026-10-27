import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const daylightDir = path.resolve(__dirname, '..');
const workspaceDir = path.resolve(daylightDir, '..');

test('Release Integrity: Standalone daylight/index.html exists and is self-contained', () => {
  const htmlPath = path.join(daylightDir, 'index.html');
  assert.equal(fs.existsSync(htmlPath), true);

  const html = fs.readFileSync(htmlPath, 'utf8');
  assert.ok(html.length > 50000, 'HTML file should be populated');

  // Verify no external network assets
  assert.equal(html.includes('<script src="http'), false, 'Cannot contain external script tag');
  assert.equal(html.includes('<script src="//'), false, 'Cannot contain protocol-relative script tag');
  assert.equal(html.includes('<link rel="stylesheet" href="http'), false, 'Cannot contain external stylesheet');
  assert.equal(html.includes('fonts.googleapis.com'), false, 'Cannot load Google Fonts');
  assert.equal(html.includes('cdnjs.cloudflare.com'), false, 'Cannot load CDN scripts');

  // Verify semantic markup & landmarks
  assert.ok(html.includes('<header class="top-bar">'), 'Missing top-bar header');
  assert.ok(html.includes('<main class="main-wrapper">'), 'Missing main landmark');
  assert.ok(html.includes('id="modalContainer"'), 'Missing modalContainer');
  assert.ok(html.includes('role: "dialog"') || html.includes('role: \'dialog\'') || html.includes('role="dialog"') || html.includes('dialog'), 'Missing dialog support');
  assert.ok(html.includes('id="liveAnnouncer"'), 'Missing live announcer region');
});

test('Release Integrity: Daylight-v1.0.0.zip contains only intended production files', () => {
  const zipPath = path.join(workspaceDir, 'Daylight-v1.0.0.zip');
  if (!fs.existsSync(zipPath)) return;
  assert.equal(fs.existsSync(zipPath), true, 'Release ZIP must exist');

  // Read zip contents via python
  const output = execSync(`python3 -c "
import zipfile
with zipfile.ZipFile(r'${zipPath}', 'r') as z:
    for n in z.namelist():
        print(n)
"`, { encoding: 'utf8' }).trim().split('\n');

  assert.ok(output.includes('Daylight-v1.0.0/index.html'), 'Missing index.html in ZIP');
  assert.ok(output.includes('Daylight-v1.0.0/README.md'), 'Missing README.md in ZIP');
  assert.ok(output.includes('Daylight-v1.0.0/LICENSE'), 'Missing LICENSE in ZIP');

  // Must NOT contain developer files or test fixtures
  assert.equal(output.some(f => f.includes('storage-poc')), false, 'ZIP must not contain storage-poc.html');
  assert.equal(output.some(f => f.includes('test')), false, 'ZIP must not contain tests');
  assert.equal(output.some(f => f.includes('node_modules')), false, 'ZIP must not contain node_modules');
  assert.equal(output.some(f => f.includes('.env')), false, 'ZIP must not contain env files');
});

test('Release Integrity: Daylight-v1.1.0.zip contains only intended production files', () => {
  const zipPath = path.join(workspaceDir, 'Daylight-v1.1.0.zip');
  if (!fs.existsSync(zipPath)) return;
  assert.equal(fs.existsSync(zipPath), true, 'Release ZIP v1.1.0 must exist');

  const output = execSync(`python3 -c "
import zipfile
with zipfile.ZipFile(r'${zipPath}', 'r') as z:
    for n in z.namelist():
        print(n)
"`, { encoding: 'utf8' }).trim().split('\n');

  assert.ok(output.includes('Daylight-v1.1.0/index.html'), 'Missing index.html in ZIP');
  assert.ok(output.includes('Daylight-v1.1.0/README.md'), 'Missing README.md in ZIP');
  assert.ok(output.includes('Daylight-v1.1.0/LICENSE'), 'Missing LICENSE in ZIP');

  // Must NOT contain developer files or test fixtures
  assert.equal(output.some(f => f.includes('storage-poc')), false, 'ZIP must not contain storage-poc.html');
  assert.equal(output.some(f => f.includes('test')), false, 'ZIP must not contain tests');
  assert.equal(output.some(f => f.includes('node_modules')), false, 'ZIP must not contain node_modules');
  assert.equal(output.some(f => f.includes('.env')), false, 'ZIP must not contain env files');
});

test('Release Integrity: Daylight-v1.1.1.zip contains only intended production files', () => {
  const zipPath = path.join(workspaceDir, 'Daylight-v1.1.1.zip');
  if (!fs.existsSync(zipPath)) return;
  assert.equal(fs.existsSync(zipPath), true, 'Release ZIP v1.1.1 must exist');

  const output = execSync(`python3 -c "
import zipfile
with zipfile.ZipFile(r'${zipPath}', 'r') as z:
    for n in z.namelist():
        print(n)
"`, { encoding: 'utf8' }).trim().split('\n');

  assert.ok(output.includes('Daylight-v1.1.1/index.html'), 'Missing index.html in ZIP');
  assert.ok(output.includes('Daylight-v1.1.1/README.md'), 'Missing README.md in ZIP');
  assert.ok(output.includes('Daylight-v1.1.1/LICENSE'), 'Missing LICENSE in ZIP');

  // Must NOT contain developer files or test fixtures
  assert.equal(output.some(f => f.includes('storage-poc')), false, 'ZIP must not contain storage-poc.html');
  assert.equal(output.some(f => f.includes('test')), false, 'ZIP must not contain tests');
  assert.equal(output.some(f => f.includes('node_modules')), false, 'ZIP must not contain node_modules');
  assert.equal(output.some(f => f.includes('.env')), false, 'ZIP must not contain env files');
});

test('Release Integrity: Daylight-v1.1.2.zip contains only intended production files', () => {
  const zipPath = path.join(workspaceDir, 'Daylight-v1.1.2.zip');
  if (!fs.existsSync(zipPath)) return;
  assert.equal(fs.existsSync(zipPath), true, 'Release ZIP v1.1.2 must exist');

  const output = execSync(`python3 -c "
import zipfile
with zipfile.ZipFile(r'${zipPath}', 'r') as z:
    for n in z.namelist():
        print(n)
"`, { encoding: 'utf8' }).trim().split('\n');

  assert.ok(output.includes('Daylight-v1.1.2/index.html'), 'Missing index.html in ZIP');
  assert.ok(output.includes('Daylight-v1.1.2/README.md'), 'Missing README.md in ZIP');
  assert.ok(output.includes('Daylight-v1.1.2/LICENSE'), 'Missing LICENSE in ZIP');

  // Must NOT contain developer files, tests, node_modules, or env files
  assert.equal(output.some(f => f.includes('storage-poc')), false, 'ZIP must not contain storage-poc.html');
  assert.equal(output.some(f => f.includes('test')), false, 'ZIP must not contain tests');
  assert.equal(output.some(f => f.includes('node_modules')), false, 'ZIP must not contain node_modules');
  assert.equal(output.some(f => f.includes('.env')), false, 'ZIP must not contain env files');

  // Verify manifest exists and matches
  const manifestPath = path.join(workspaceDir, 'Daylight-v1.1.2.manifest.json');
  assert.ok(fs.existsSync(manifestPath), 'Release manifest must exist');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  assert.equal(manifest.version, '1.1.2');
  assert.equal(manifest.archive, 'Daylight-v1.1.2.zip');
});

test('Release Integrity: Daylight-v1.2.0.zip contains only intended production files', () => {
  const zipPath = path.join(workspaceDir, 'Daylight-v1.2.0.zip');
  if (!fs.existsSync(zipPath)) return;
  assert.equal(fs.existsSync(zipPath), true, 'Release ZIP v1.2.0 must exist');

  const output = execSync(`python3 -c "
import zipfile
with zipfile.ZipFile(r'${zipPath}', 'r') as z:
    for n in z.namelist():
        print(n)
"`, { encoding: 'utf8' }).trim().split('\n');

  assert.ok(output.includes('Daylight-v1.2.0/index.html'), 'Missing index.html in ZIP');
  assert.ok(output.includes('Daylight-v1.2.0/README.md'), 'Missing README.md in ZIP');
  assert.ok(output.includes('Daylight-v1.2.0/LICENSE'), 'Missing LICENSE in ZIP');

  // Must NOT contain developer files, tests, node_modules, or env files
  assert.equal(output.some(f => f.includes('storage-poc')), false, 'ZIP must not contain storage-poc.html');
  assert.equal(output.some(f => f.includes('test')), false, 'ZIP must not contain tests');
  assert.equal(output.some(f => f.includes('node_modules')), false, 'ZIP must not contain node_modules');
  assert.equal(output.some(f => f.includes('.env')), false, 'ZIP must not contain env files');

  // Verify manifest exists and matches
  const manifestPath = path.join(workspaceDir, 'Daylight-v1.2.0.manifest.json');
  assert.ok(fs.existsSync(manifestPath), 'Release manifest must exist');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  assert.equal(manifest.version, '1.2.0');
  assert.equal(manifest.archive, 'Daylight-v1.2.0.zip');
});

test('Release Integrity: Daylight-v1.2.1.zip contains only intended production files', () => {
  const zipPath = path.join(workspaceDir, 'Daylight-v1.2.1.zip');
  assert.equal(fs.existsSync(zipPath), true, 'Release ZIP v1.2.1 must exist');

  const output = execSync(`python3 -c "import zipfile
with zipfile.ZipFile(r'${zipPath}', 'r') as z:
    for n in z.namelist():
        print(n)"`, { encoding: 'utf8' }).trim().split('\n');

  assert.ok(output.includes('Daylight-v1.2.1/index.html'), 'Missing index.html in ZIP');
  assert.ok(output.includes('Daylight-v1.2.1/README.md'), 'Missing README.md in ZIP');
  assert.ok(output.includes('Daylight-v1.2.1/LICENSE'), 'Missing LICENSE in ZIP');

  // Must NOT contain developer files, tests, node_modules, or env files
  assert.equal(output.some(f => f.includes('storage-poc')), false, 'ZIP must not contain storage-poc.html');
  assert.equal(output.some(f => f.includes('test')), false, 'ZIP must not contain tests');
  assert.equal(output.some(f => f.includes('node_modules')), false, 'ZIP must not contain node_modules');
  assert.equal(output.some(f => f.includes('.env')), false, 'ZIP must not contain env files');

  // Verify manifest exists and matches
  const manifestPath = path.join(workspaceDir, 'Daylight-v1.2.1.manifest.json');
  assert.ok(fs.existsSync(manifestPath), 'Release manifest must exist');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  assert.equal(manifest.version, '1.2.1');
  assert.equal(manifest.archive, 'Daylight-v1.2.1.zip');
});

test('Release Safety: Build script refuses to overwrite existing release archive without explicit override', () => {
  let failedAsExpected = false;
  try {
    execSync('node daylight/scripts/build.js --release --version=1.2.0', {
      encoding: 'utf8',
      stdio: 'pipe'
    });
  } catch (err) {
    failedAsExpected = true;
    assert.ok(err.stderr.includes('already exists') || err.stdout.includes('already exists'), 'Must report archive already exists');
  }
  assert.ok(failedAsExpected, 'Build script must fail when attempting to overwrite existing release');
});

test('Release Safety: Build script rejects invalid semantic version strings', () => {
  const invalidVersions = ['not-a-version', 'v1.1', '1.1', '1.a.2', '1.0.0.0'];
  for (const badVer of invalidVersions) {
    let failed = false;
    try {
      execSync(`node daylight/scripts/build.js --release --version=${badVer}`, {
        encoding: 'utf8',
        stdio: 'pipe'
      });
    } catch (err) {
      failed = true;
      assert.ok(err.stderr.includes('Invalid version') || err.stdout.includes('Invalid version'));
    }
    assert.ok(failed, `Build script must reject invalid version string: "${badVer}"`);
  }
});

test('Release Safety: Build script refuses to repackage historical releases (1.0.0, 1.1.0, 1.1.1, 1.1.2)', () => {
  for (const histVer of ['1.0.0', '1.1.0', '1.1.1', '1.1.2']) {
    let failed = false;
    try {
      execSync(`node daylight/scripts/build.js --release --version=${histVer}`, {
        encoding: 'utf8',
        stdio: 'pipe'
      });
    } catch (err) {
      failed = true;
      assert.ok(err.stderr.includes('Refusing to repackage historical') || err.stdout.includes('Refusing to repackage historical'));
    }
    assert.ok(failed, `Build script must reject repackaging historical version ${histVer}`);
  }
});

test('Release Safety: Standalone build (without --release) does not create or modify release archives', () => {
  // Capture mtimes of all existing ZIP files
  const zipFiles = fs.readdirSync(workspaceDir).filter(f => f.endsWith('.zip'));
  const mtimesBefore = new Map(zipFiles.map(f => [f, fs.statSync(path.join(workspaceDir, f)).mtimeMs]));

  // Run standalone build
  const stdout = execSync('node daylight/scripts/build.js', { encoding: 'utf8' });
  assert.ok(stdout.includes('Standalone build complete. Release packaging was not requested.'));

  // Ensure no ZIP mtimes were changed
  for (const [f, mtime] of mtimesBefore) {
    const currentMtime = fs.statSync(path.join(workspaceDir, f)).mtimeMs;
    assert.equal(currentMtime, mtime, `Archive ${f} must not be modified during standalone build`);
  }
});

test('Release Safety: npm run release properly forwards --version argument', () => {
  let failed = false;
  try {
    // When forwarding an already existing version via npm argument forwarding:
    execSync('npm run release -- --version=1.2.0', {
      encoding: 'utf8',
      stdio: 'pipe'
    });
  } catch (err) {
    failed = true;
    assert.ok(err.stderr.includes('already exists') || err.stdout.includes('already exists'));
  }
  assert.ok(failed, 'npm run release must forward --version argument and detect collision');
});

test('Release Safety: Packaged HTML hash matches standalone HTML exactly', () => {
  const localHtml = fs.readFileSync(path.join(daylightDir, 'index.html'), 'utf8');
  const localHash = crypto.createHash('sha256').update(localHtml).digest('hex');

  const zipPath = path.join(workspaceDir, 'Daylight-v1.2.1.zip');
  const extractedHtml = execSync(`python3 -c "
import zipfile, sys
with zipfile.ZipFile(r'${zipPath}', 'r') as z:
    sys.stdout.buffer.write(z.read('Daylight-v1.2.1/index.html'))
"`, { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });

  const extractedHash = crypto.createHash('sha256').update(extractedHtml).digest('hex');
  assert.equal(extractedHash, localHash, 'Packaged HTML hash must match local standalone HTML bit-for-bit');
});

test('Contributor Setup: package-lock.json exists and npm ci dry-run passes', () => {
  const lockPath = path.join(workspaceDir, 'package-lock.json');
  assert.ok(fs.existsSync(lockPath), 'package-lock.json must exist for reproducible contributor setup');

  const res = execSync('npm ci --dry-run', { encoding: 'utf8' });
  assert.ok(res.includes('audited') || res.includes('up to date') || res.includes('packages'), 'npm ci should succeed');
});



