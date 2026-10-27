/**
 * Daylight — Standalone Build & Release Packaging Engine
 *
 * Responsibilities:
 *  1. Standalone Build: Bundles daylight/src/ via esbuild into a self-contained,
 *     classic-script daylight/index.html with strict syntax validation.
 *     (Does NOT create or modify any versioned release archives).
 *  2. Release Packaging: Triggered ONLY with --release. Requires an explicit,
 *     valid semantic version (--version=X.Y.Z). Enforces immutable release
 *     archives, verifies package contents, generates SHA-256 manifests,
 *     and protects historical releases from being overwritten.
 */

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import * as esbuild from 'esbuild';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const workspaceRoot = path.resolve(rootDir, '..');

// Historical released versions that must never be regenerated or overwritten
const HISTORICAL_VERSIONS = ['1.0.0', '1.1.0', '1.1.1', '1.1.2', '1.2.0'];
const SEMVER_REGEX = /^\d+\.\d+\.\d+(?:-[a-zA-Z0-9.]+)?$/;

// Command line argument flags
const isRelease = process.argv.includes('--release');
const isValidateOnly = process.argv.includes('--validate-only');
const allowOverwrite = process.argv.includes('--allow-overwrite-release');

// Parse --version=X.Y.Z (picking the LAST occurrence to support npm argument forwarding: npm run release -- --version=...)
const versionArgs = process.argv.filter(arg => arg.startsWith('--version='));
const targetVersion = versionArgs.length > 0 ? versionArgs[versionArgs.length - 1].split('=')[1].trim() : null;

// Record baseline hashes of historical archives if present
function getHistoricalHashes() {
  const hashes = new Map();
  for (const v of HISTORICAL_VERSIONS) {
    const zipName = `Daylight-v${v}.zip`;
    const zipPath = path.join(workspaceRoot, zipName);
    if (fs.existsSync(zipPath)) {
      const h = crypto.createHash('sha256').update(fs.readFileSync(zipPath)).digest('hex');
      hashes.set(zipName, h);
    }
  }
  return hashes;
}

const baselineHistoricalHashes = getHistoricalHashes();

// Helper to compute sha256
function sha256(data) {
  return crypto.createHash('sha256').update(data).digest('hex');
}

async function run() {
  try {
    // -------------------------------------------------------------
    // Mode A: Validate Only
    // -------------------------------------------------------------
    if (isValidateOnly) {
      console.log('[Daylight Build] Running production artifact validation only...');
      const htmlPath = path.join(rootDir, 'index.html');
      if (!fs.existsSync(htmlPath)) {
        throw new Error(`Production HTML not found at ${htmlPath}`);
      }
      const htmlContent = fs.readFileSync(htmlPath, 'utf8');
      validateHtmlArtifact(htmlContent);
      console.log('[Daylight Build] Validation PASSED. Production artifact is safe and self-contained.');
      process.exit(0);
    }

    // -------------------------------------------------------------
    // Release Argument Pre-flight Validation
    // -------------------------------------------------------------
    if (isRelease) {
      if (!targetVersion) {
        console.error('\n[Daylight Build] FATAL: --release requires an explicit --version=X.Y.Z argument.');
        console.error('Usage: npm run release -- --version=1.1.2\n');
        process.exit(1);
      }

      if (!SEMVER_REGEX.test(targetVersion)) {
        console.error(`\n[Daylight Build] FATAL: Invalid version "${targetVersion}".`);
        console.error('Expected strict semantic version format (e.g. 1.1.2 or 1.1.2-beta.1).\n');
        process.exit(1);
      }

      const releaseZipName = `Daylight-v${targetVersion}.zip`;
      const releaseZipPath = path.join(workspaceRoot, releaseZipName);

      if (HISTORICAL_VERSIONS.includes(targetVersion) && !allowOverwrite) {
        console.error(`\n[Daylight Build] FATAL: Refusing to repackage historical release v${targetVersion}. Archive already exists and historical releases are immutable.`);
        console.error('Use a new version number (e.g. 1.2.0).\n');
        process.exit(1);
      }

      if (fs.existsSync(releaseZipPath) && !allowOverwrite) {
        console.error(`\n[Daylight Build] FATAL: Release archive "${releaseZipName}" already exists!`);
        console.error('Release archives are immutable by default to prevent accidental data loss.');
        console.error('Use a new version number, or pass --allow-overwrite-release for development testing.\n');
        process.exit(1);
      }

      // Check version alignment with daylight/README.md
      const readmePath = path.join(rootDir, 'README.md');
      if (fs.existsSync(readmePath)) {
        const readmeContent = fs.readFileSync(readmePath, 'utf8');
        if (!readmeContent.includes(`Daylight-v${targetVersion}.zip`)) {
          console.warn(`[Daylight Build] WARNING: daylight/README.md does not reference Daylight-v${targetVersion}.zip!`);
          console.warn(`Ensure documentation matches the packaged version.`);
        }
      }
    }

    // -------------------------------------------------------------
    // Step 1: Build Standalone HTML
    // -------------------------------------------------------------
    console.log('[Daylight Build] Building standalone production HTML from canonical source...');

    const cssPath = path.join(rootDir, 'src', 'styles.css');
    if (!fs.existsSync(cssPath)) {
      throw new Error(`CSS source file not found at ${cssPath}`);
    }
    const cssContent = fs.readFileSync(cssPath, 'utf8');

    const appEntryPath = path.join(rootDir, 'src', 'app.js');
    if (!fs.existsSync(appEntryPath)) {
      throw new Error(`JavaScript entry point not found at ${appEntryPath}`);
    }

    console.log('[Daylight Build] Bundling dependency graph with esbuild...');
    const bundleResult = await esbuild.build({
      entryPoints: [appEntryPath],
      bundle: true,
      format: 'iife',
      globalName: 'DaylightApp',
      write: false,
      target: ['es2020'],
      treeShaking: true,
      minify: false,
    });

    if (!bundleResult.outputFiles || bundleResult.outputFiles.length === 0) {
      throw new Error('esbuild produced no output files');
    }

    const bundledJs = bundleResult.outputFiles[0].text;

    const inlineScriptContent = `
${bundledJs}

// Auto-initialize Daylight on DOM ready or immediately if already loaded
(function() {
  'use strict';
  if (typeof DaylightApp !== 'undefined' && DaylightApp.initDaylightApp) {
    if (typeof document !== 'undefined') {
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
          DaylightApp.initDaylightApp();
        });
      } else {
        DaylightApp.initDaylightApp();
      }
    }
  }
})();
`;

    // Validate generated script before assembling HTML
    validateScriptContent(inlineScriptContent);

    // Assemble final standalone HTML
    const htmlTemplate = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Daylight — Personal Life Dashboard</title>
  <meta name="description" content="A calm, minimal, Apple-inspired personal life dashboard with Zen and Dō views, offline-capable and privacy-first.">
  <style>
${cssContent}
  </style>
</head>
<body>
  <div id="liveAnnouncer" aria-live="polite" class="sr-only"></div>

  <div id="app">
    <!-- Top Bar -->
    <header class="top-bar">
      <div class="brand-wrap">
        <button id="btnMobileNav" class="btn-icon mobile-menu-btn" aria-label="Toggle navigation menu">
          <svg class="icon" viewBox="0 0 24 24"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
        </button>
        <button id="btnBrandHome" class="brand-btn" aria-label="Daylight - Return to Today Overview">
          <svg class="brand-sun-icon" viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="12" r="4.5" fill="none" stroke="currentColor" stroke-width="1.75" />
            <line x1="12" y1="2" x2="12" y2="4.5" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" />
            <line x1="12" y1="19.5" x2="12" y2="22" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" />
            <line x1="2" y1="12" x2="4.5" y2="12" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" />
            <line x1="19.5" y1="12" x2="22" y2="12" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" />
            <line x1="4.93" y1="4.93" x2="6.7" y2="6.7" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" />
            <line x1="17.3" y1="17.3" x2="19.07" y2="19.07" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" />
            <line x1="4.93" y1="19.07" x2="6.7" y2="17.3" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" />
            <line x1="17.3" y1="6.7" x2="19.07" y2="4.93" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" />
          </svg>
          <span class="brand-name">Daylight</span>
        </button>
      </div>

      <!-- Mode switcher (Zen / Dō) -->
      <div class="mode-switcher" role="tablist" aria-label="View Mode">
        <button id="btnModeZen" class="mode-btn active" role="tab" aria-selected="true">
          <svg class="icon icon-sm" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><path d="M12 2a14.5 14.5 0 0 0 0 20 10 10 0 0 0 0-20"></path></svg>
          Zen
        </button>
        <button id="btnModeDo" class="mode-btn" role="tab" aria-selected="false">
          <svg class="icon icon-sm" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>
          Dō
        </button>
      </div>

      <!-- Actions & Storage Badge -->
      <div class="top-actions">
        <div id="storageBadge" class="storage-indicator storage-persistent" title="Storage Status">
          <svg class="icon icon-sm" viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
          <span id="storageBadgeText">Saved</span>
        </div>
        <button id="btnThemeToggle" class="btn-icon" title="Toggle theme (Light / Dark / System)" aria-label="Toggle theme">
          <svg class="icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>
        </button>
        <button id="btnOpenSettings" class="btn-icon" title="Settings & Data Management" aria-label="Open Settings">
          <svg class="icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
        </button>
      </div>
    </header>

    <!-- Persistence Warning Banner -->
    <div id="storageBanner" class="banner banner-warning" style="display: none;">
      <div style="display: flex; align-items: center; gap: 8px;">
        <svg class="icon" viewBox="0 0 24 24"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
        <span>Storage is running in temporary memory mode. Edits may be lost when this window is closed. Export JSON backups regularly!</span>
      </div>
      <button id="btnBannerExport" class="btn btn-sm">Export Backup Now</button>
    </div>

    <!-- Recovery Mode Container -->
    <div id="recoveryContainer" class="banner banner-danger" style="display: none;">
      <div>
        <strong>Recovery Mode:</strong> Saved data failed validation and was kept untouched.
        <button id="btnRawExport" class="btn btn-sm btn-subtle" style="margin-left: 10px; color: inherit; text-decoration: underline;">Download Raw Payload</button>
        <button id="btnRecoveryStartFresh" class="btn btn-sm btn-danger" style="margin-left: 10px;">Start Fresh (Discard Corrupt)</button>
      </div>
    </div>

    <!-- Main Content Area -->
    <main class="main-wrapper">
      <!-- 1. ZEN VIEW -->
      <section id="viewZen" class="zen-container" style="display: flex;">
        <!-- Rendered dynamically -->
      </section>

      <!-- 2. DŌ VIEW -->
      <section id="viewDo" class="do-container" style="display: none;">
        <div id="doBackdrop" class="sidebar-backdrop" aria-hidden="true"></div>
        <!-- Sidebar Navigation -->
        <aside id="doSidebar" class="do-sidebar">
          <div class="nav-group-title">Overview</div>
          <button class="nav-item active" data-section="today">
            <span class="nav-item-content">
              <svg class="icon" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
              Today
            </span>
            <span id="navBadgeToday" class="nav-badge">0</span>
          </button>

          <div class="nav-group-title">Execution</div>
          <button class="nav-item" data-section="tasks">
            <span class="nav-item-content">
              <svg class="icon" viewBox="0 0 24 24"><polyline points="9 11 12 14 22 4"></polyline><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path></svg>
              Tasks
            </span>
            <span id="navBadgeTasks" class="nav-badge">0</span>
          </button>
          <button class="nav-item" data-section="projects">
            <span class="nav-item-content">
              <svg class="icon" viewBox="0 0 24 24"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
              Projects
            </span>
            <span id="navBadgeProjects" class="nav-badge">0</span>
          </button>
          <button class="nav-item" data-section="calendar">
            <span class="nav-item-content">
              <svg class="icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
              Calendar & Agenda
            </span>
          </button>
          <button class="nav-item" data-section="habits">
            <span class="nav-item-content">
              <svg class="icon" viewBox="0 0 24 24"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
              Habits
            </span>
            <span id="navBadgeHabits" class="nav-badge">0</span>
          </button>
          <button class="nav-item" data-section="goals">
            <span class="nav-item-content">
              <svg class="icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="6"></circle><circle cx="12" cy="12" r="2"></circle></svg>
              Goals & Milestones
            </span>
          </button>

          <div class="nav-group-title">Knowledge & Reflection</div>
          <button class="nav-item" data-section="notes">
            <span class="nav-item-content">
              <svg class="icon" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
              Notes
            </span>
          </button>
          <button class="nav-item" data-section="journal">
            <span class="nav-item-content">
              <svg class="icon" viewBox="0 0 24 24"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>
              Journal
            </span>
          </button>
          <button class="nav-item" data-section="finance">
            <span class="nav-item-content">
              <svg class="icon" viewBox="0 0 24 24"><line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>
              Finance Tracker
            </span>
          </button>

          <div style="margin-top: auto; padding-top: 1rem; border-top: 1px solid var(--border);">
            <button class="nav-item" data-section="settings">
              <span class="nav-item-content">
                <svg class="icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
                Settings & Data
              </span>
            </button>
          </div>
        </aside>

        <!-- Dynamic Content Body -->
        <div id="doContent" class="do-content">
          <!-- Rendered dynamically -->
        </div>
      </section>
    </main>
  </div>

  <!-- Global Modal Container -->
  <div id="modalContainer" style="display: none;"></div>

  <script>
${inlineScriptContent.trim()}
  </script>
</body>
</html>
`;

    // Write output HTML
    const outputPath = path.join(rootDir, 'index.html');
    fs.writeFileSync(outputPath, htmlTemplate, 'utf8');
    const outSize = fs.statSync(outputPath).size;
    const htmlHash = sha256(htmlTemplate);
    console.log(`[Daylight Build] Wrote standalone production HTML to ${outputPath} (${outSize} bytes, SHA-256: ${htmlHash.slice(0, 16)}...)`);

    // Synchronize to public/daylight/index.html
    const publicDaylightDir = path.join(workspaceRoot, 'public', 'daylight');
    fs.mkdirSync(publicDaylightDir, { recursive: true });
    fs.copyFileSync(outputPath, path.join(publicDaylightDir, 'index.html'));

    // If release was not requested, STOP HERE cleanly without creating any ZIP!
    if (!isRelease) {
      console.log('[Daylight Build] Standalone build complete. Release packaging was not requested.');
      process.exit(0);
    }

    // -------------------------------------------------------------
    // Step 2: Package Release Archive (Only when --release is given)
    // -------------------------------------------------------------
    const releaseFolderName = `Daylight-v${targetVersion}`;
    const releaseZipName = `${releaseFolderName}.zip`;
    const releaseZipPath = path.join(workspaceRoot, releaseZipName);

    console.log(`[Daylight Build] Packaging clean release ZIP: ${releaseZipName}...`);

    const filesToPack = ['index.html', 'README.md', 'LICENSE'];
    for (const f of filesToPack) {
      const p = path.join(rootDir, f);
      if (!fs.existsSync(p)) {
        throw new Error(`Required release file missing from daylight directory: ${f}`);
      }
    }

    // Use Python 3 zipfile for deterministic zero-dependency archive creation
    const pythonScript = `
import zipfile, os, sys

root_dir = r'${rootDir.replace(/\\/g, '/')}'
files_to_pack = ['index.html', 'README.md', 'LICENSE']
zip_path = r'${releaseZipPath.replace(/\\/g, '/')}'

with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as z:
    for fname in files_to_pack:
        fpath = os.path.join(root_dir, fname)
        arcname = os.path.join('${releaseFolderName}', fname)
        z.write(fpath, arcname)
        print(f'  [${releaseFolderName}] Added: {arcname}')
`;

    execSync(`python3 -c "${pythonScript}"`, { stdio: 'inherit' });

    // -------------------------------------------------------------
    // Step 3: Post-Packaging Verification & Manifest Generation
    // -------------------------------------------------------------
    console.log('[Daylight Build] Verifying packaged archive structure and file integrity...');

    const pyVerifyScript = `
import zipfile, sys

zip_path = r'${releaseZipPath.replace(/\\/g, '/')}'
with zipfile.ZipFile(zip_path, 'r') as z:
    for name in z.namelist():
        print(name)
`;

    const rawNamelist = execSync(`python3 -c "${pyVerifyScript}"`, { encoding: 'utf8' }).trim();
    const namelist = rawNamelist.split('\n').map(s => s.trim()).filter(Boolean);

    const expectedFiles = [
      `${releaseFolderName}/index.html`,
      `${releaseFolderName}/README.md`,
      `${releaseFolderName}/LICENSE`
    ];

    if (namelist.length !== expectedFiles.length || !expectedFiles.every(f => namelist.includes(f))) {
      throw new Error(`Packaged archive contains unexpected entries. Found: ${JSON.stringify(namelist)}, expected: ${JSON.stringify(expectedFiles)}`);
    }

    // Extract archived index.html and verify hash matches standalone build exactly
    const pyExtractScript = `
import zipfile, sys

zip_path = r'${releaseZipPath.replace(/\\/g, '/')}'
with zipfile.ZipFile(zip_path, 'r') as z:
    sys.stdout.buffer.write(z.read('${releaseFolderName}/index.html'))
`;

    const extractedHtml = execSync(`python3 -c "${pyExtractScript}"`, { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
    const extractedHash = sha256(extractedHtml);

    if (extractedHash !== htmlHash) {
      throw new Error(`Checksum mismatch! Archived HTML hash (${extractedHash}) does not match standalone HTML hash (${htmlHash})`);
    }

    // Generate Release Manifest & Hashes
    const zipBytes = fs.readFileSync(releaseZipPath);
    const zipHash = sha256(zipBytes);
    const readmeBytes = fs.readFileSync(path.join(rootDir, 'README.md'));
    const licenseBytes = fs.readFileSync(path.join(rootDir, 'LICENSE'));

    const manifest = {
      name: 'Daylight',
      version: targetVersion,
      archive: releaseZipName,
      archiveSha256: zipHash,
      archiveBytes: fs.statSync(releaseZipPath).size,
      buildTime: new Date().toISOString(),
      files: [
        {
          path: `${releaseFolderName}/index.html`,
          bytes: outSize,
          sha256: htmlHash
        },
        {
          path: `${releaseFolderName}/README.md`,
          bytes: readmeBytes.length,
          sha256: sha256(readmeBytes)
        },
        {
          path: `${releaseFolderName}/LICENSE`,
          bytes: licenseBytes.length,
          sha256: sha256(licenseBytes)
        }
      ]
    };

    const manifestPath = path.join(workspaceRoot, `Daylight-v${targetVersion}.manifest.json`);
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');

    const sha256FilePath = path.join(workspaceRoot, `Daylight-v${targetVersion}.sha256`);
    fs.writeFileSync(sha256FilePath, `${zipHash}  ${releaseZipName}\n`, 'utf8');

    // Copy release ZIP and manifest to public/ for easy download
    const publicZipPath = path.join(workspaceRoot, 'public', releaseZipName);
    fs.copyFileSync(releaseZipPath, publicZipPath);
    const publicManifestPath = path.join(workspaceRoot, 'public', `Daylight-v${targetVersion}.manifest.json`);
    fs.copyFileSync(manifestPath, publicManifestPath);

    // Confirm historical release archives were untouched
    const finalHistoricalHashes = getHistoricalHashes();
    for (const [name, baselineHash] of baselineHistoricalHashes.entries()) {
      const currentHash = finalHistoricalHashes.get(name);
      if (currentHash !== baselineHash) {
        throw new Error(`Historical release protection violation! ${name} was mutated during the build.`);
      }
    }

    console.log(`[Daylight Build] Release v${targetVersion} packaged successfully.`);
    console.log(`[Daylight Build] Archive: ${releaseZipPath} (${manifest.archiveBytes} bytes)`);
    console.log(`[Daylight Build] SHA-256: ${zipHash}`);
    console.log(`[Daylight Build] Manifest: ${manifestPath}`);
  } catch (err) {
    console.error('[Daylight Build] FATAL Error:', err.message);
    process.exit(1);
  }
}

// -------------------------------------------------------------
// Validation Helpers
// -------------------------------------------------------------

function validateScriptContent(code) {
  // 1. Classic script syntax validation via Node vm.Script
  try {
    new vm.Script(code, { filename: 'daylight-production-bundle.js' });
  } catch (syntaxErr) {
    throw new Error(`Classic script syntax error in bundle: ${syntaxErr.message}`);
  }

  // 2. Static import check
  if (/(?:^|\n)\s*import\s+/.test(code)) {
    throw new Error(`Unresolved static 'import' statement detected in classic script!`);
  }

  // 3. Static export check
  if (/(?:^|\n)\s*export\s+/.test(code)) {
    throw new Error(`Unresolved static 'export' statement detected in classic script!`);
  }

  // 4. Initialization check
  if (!code.includes('DaylightApp.initDaylightApp')) {
    throw new Error(`Missing DaylightApp.initDaylightApp entry point invocation!`);
  }
}

function validateHtmlArtifact(html) {
  // 1. External network checks
  if (html.includes('<script src="http') || html.includes('<script src="//')) {
    throw new Error('Standalone HTML contains external script tags!');
  }
  if (html.includes('<link rel="stylesheet" href="http') || html.includes('<link rel="stylesheet" href="//')) {
    throw new Error('Standalone HTML contains external stylesheets!');
  }
  if (html.includes('fonts.googleapis.com') || html.includes('cdnjs.cloudflare.com')) {
    throw new Error('Standalone HTML loads external CDNs or web fonts!');
  }

  // 2. Inline script extraction & validation
  const scriptMatch = html.match(/<script>([\s\S]*?)<\/script>/);
  if (!scriptMatch) {
    throw new Error('Missing inline <script> in HTML artifact!');
  }
  validateScriptContent(scriptMatch[1]);

  // 3. Landmarks and essential UI check
  if (!html.includes('<header class="top-bar">') || !html.includes('<main class="main-wrapper">')) {
    throw new Error('Standalone HTML missing essential header or main landmarks!');
  }
}

run();
