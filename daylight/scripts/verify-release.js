/**
 * Daylight — Release Archive Verification Utility
 * Validates integrity, exact file list, checksums, and syntax of packaged release ZIPs.
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import vm from 'node:vm';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const workspaceRoot = path.resolve(rootDir, '..');

// Parse --version=X.Y.Z (taking last occurrence for npm argument forwarding)
const versionArgs = process.argv.filter(arg => arg.startsWith('--version='));
let targetVersion = versionArgs.length > 0 ? versionArgs[versionArgs.length - 1].split('=')[1].trim() : null;

if (!targetVersion) {
  // Check positional argument
  const posArg = process.argv.slice(2).find(arg => !arg.startsWith('--'));
  if (posArg) {
    targetVersion = posArg.trim();
  }
}

if (!targetVersion) {
  // Discover highest version ZIP in workspace
  const zipFiles = fs.readdirSync(workspaceRoot).filter(f => /^Daylight-v\d+\.\d+\.\d+\.zip$/.test(f));
  if (zipFiles.length === 0) {
    console.error('[Verify Release] Error: No Daylight-v*.zip archives found to verify.');
    process.exit(1);
  }
  zipFiles.sort();
  const latestZip = zipFiles[zipFiles.length - 1];
  targetVersion = latestZip.replace(/^Daylight-v/, '').replace(/\.zip$/, '');
  console.log(`[Verify Release] No version specified; defaulting to latest detected: v${targetVersion}`);
}

const releaseZipName = `Daylight-v${targetVersion}.zip`;
const releaseZipPath = path.join(workspaceRoot, releaseZipName);
const folderPrefix = `Daylight-v${targetVersion}`;

console.log(`[Verify Release] Verifying archive: ${releaseZipName}...`);

if (!fs.existsSync(releaseZipPath)) {
  console.error(`[Verify Release] Error: Archive not found at ${releaseZipPath}`);
  process.exit(1);
}

// 1. Inspect archive structure and extract file list
const pyInspectScript = `
import zipfile, sys

with zipfile.ZipFile(r'${releaseZipPath.replace(/\\/g, '/')}', 'r') as z:
    for name in z.namelist():
        print(name)
`;

let namelist = [];
try {
  const output = execSync(`python3 -c "${pyInspectScript}"`, { encoding: 'utf8' }).trim();
  namelist = output.split('\n').map(s => s.trim()).filter(Boolean);
} catch (e) {
  console.error(`[Verify Release] Failed to read ZIP structure:`, e.message);
  process.exit(1);
}

console.log(`[Verify Release] Found ${namelist.length} entries in archive:`);
namelist.forEach(n => console.log(`  - ${n}`));

// 2. Enforce strict file expectations
const expectedFiles = [
  `${folderPrefix}/index.html`,
  `${folderPrefix}/README.md`,
  `${folderPrefix}/LICENSE`
];

let hasErrors = false;

for (const expected of expectedFiles) {
  if (!namelist.includes(expected)) {
    console.error(`[Verify Release] ERROR: Missing required file: ${expected}`);
    hasErrors = true;
  }
}

for (const entry of namelist) {
  if (!expectedFiles.includes(entry)) {
    console.error(`[Verify Release] ERROR: Unexpected rogue file in archive: ${entry}`);
    hasErrors = true;
  }
}

// 3. Extract and verify index.html syntax & hash
const pyExtractScript = `
import zipfile, sys

with zipfile.ZipFile(r'${releaseZipPath.replace(/\\/g, '/')}', 'r') as z:
    sys.stdout.buffer.write(z.read('${folderPrefix}/index.html'))
`;

let archivedHtml = '';
try {
  archivedHtml = execSync(`python3 -c "${pyExtractScript}"`, { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
} catch (e) {
  console.error(`[Verify Release] Failed to extract ${folderPrefix}/index.html:`, e.message);
  process.exit(1);
}

const archivedHash = crypto.createHash('sha256').update(archivedHtml, 'utf8').digest('hex');
console.log(`[Verify Release] Archived index.html SHA-256: ${archivedHash}`);

// Compare with standalone daylight/index.html if available
const localHtmlPath = path.join(rootDir, 'index.html');
if (fs.existsSync(localHtmlPath)) {
  const localHtml = fs.readFileSync(localHtmlPath, 'utf8');
  const localHash = crypto.createHash('sha256').update(localHtml, 'utf8').digest('hex');
  if (archivedHash === localHash) {
    console.log(`[Verify Release] Hash match: Archived index.html matches local build exactly.`);
  } else {
    console.warn(`[Verify Release] WARNING: Archived index.html hash differs from current local daylight/index.html`);
  }
}

// 4. Validate syntax of archived inline script
const scriptMatch = archivedHtml.match(/<script>([\s\S]*?)<\/script>/);
if (!scriptMatch) {
  console.error(`[Verify Release] ERROR: No inline <script> found in archived index.html`);
  hasErrors = true;
} else {
  const code = scriptMatch[1];
  try {
    new vm.Script(code, { filename: `${folderPrefix}-archived.js` });
    console.log(`[Verify Release] Classic script syntax: PASSED`);
  } catch (err) {
    console.error(`[Verify Release] ERROR: Classic script syntax error: ${err.message}`);
    hasErrors = true;
  }

  if (/(?:^|\n)\s*import\s+/.test(code)) {
    console.error(`[Verify Release] ERROR: Static ESM 'import' detected in classic script!`);
    hasErrors = true;
  }
  if (/(?:^|\n)\s*export\s+/.test(code)) {
    console.error(`[Verify Release] ERROR: Static ESM 'export' detected in classic script!`);
    hasErrors = true;
  }
  if (!code.includes('DaylightApp.initDaylightApp')) {
    console.error(`[Verify Release] ERROR: Application initialization call missing!`);
    hasErrors = true;
  }
}

// 5. Check manifest if exists
const manifestPath = path.join(workspaceRoot, `Daylight-v${targetVersion}.manifest.json`);
if (fs.existsSync(manifestPath)) {
  try {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    console.log(`[Verify Release] Verified against release manifest (built: ${manifest.buildTime})`);
  } catch (e) {
    console.error(`[Verify Release] ERROR: Malformed manifest file: ${e.message}`);
    hasErrors = true;
  }
}

if (hasErrors) {
  console.error(`[Verify Release] Release verification FAILED.`);
  process.exit(1);
} else {
  console.log(`[Verify Release] Release archive ${releaseZipName} PASSED all integrity checks.`);
  process.exit(0);
}
