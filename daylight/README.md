# Daylight — Personal Life Dashboard

**Daylight** is a calm, minimal, Apple-inspired personal Life Dashboard designed to help you organize everyday life without an account, a cloud server, or an internet connection.

It brings daily priorities, execution, personal reflection, and manual finances into one quiet place while keeping all data entirely on your machine.

---

## 1. Zen and Dō: One App, One Source of Truth

Daylight features two views sharing the exact same underlying canonical state and records:

- **Zen View**: A calm, focused daily overview. Displays your local date, time-based greeting with a thoughtful, quietly encouraging daily line, up to three user-selected top priorities, next upcoming agenda item, today's habit checklist, and quick capture for thoughts and tasks.
- **Dō View (道)**: The expanded planning and management dashboard with ten comprehensive modules:
  1. **Today**: Daily focus, top priorities manager, and today's schedule.
  2. **Tasks**: Recursive subtask hierarchy of arbitrary depth, due dates, priority tags, search filters (All, Today, Upcoming, High Priority, Completed), and subtask cycle prevention.
  3. **Projects**: Group tasks into outcomes, review derived completed-versus-total task progress, and archive completed projects without losing tasks (tasks remain unassigned, not deleted).
  4. **Calendar & Agenda**: Month grid with day dots, timed events, all-day items, chronological upcoming agenda, and comprehensive event editing with start/end time validation.
  5. **Habits**: Consistency tracking without guilt or punitive streak resets; streaks only count scheduled days. Supports daily, weekdays, or fully custom day selection (Sun–Sat) with 7-day completion toggling.
  6. **Goals & Milestones**: High-level vision broken into milestones with dedicated modal dialog creation/editing and derived completion progress.
  7. **Notes**: Instant case-insensitive search across titles and bodies, pinned notes, in-place edit workflow with prefilled modal, unsaved edit safeguards, and safe text rendering.
  8. **Journal**: Chronological reflection feed with multiple entries per date support.
  9. **Finance Tracker**: Completely manual, private cash flow and expense tracker with monthly budgeting in integer minor units. Supports 8 currencies including BDT (৳) and zero-decimal JPY (¥) with currency-aware arithmetic.
  10. **Settings & Data**: Theme control (System, Light, Dark), customizable accent colors with native color picker and live preview, startup view preference, currency selection, storage health diagnostics, JSON export, transactional restore, and safe reset.

Switching between Zen and Dō never duplicates, resets, or alters your records.

---

## 2. Personal Accent Customization & WCAG AA Contrast

In **Settings & Data Management**, Daylight provides a dedicated **Accent Color** customization suite:

- **Built-in HTML `<input type="color">`**: Uses the platform/browser native color picker without third-party libraries or external assets.
- **Precise Hexadecimal Text Input**: Allows pasting or entering standard `#RRGGBB` hex values with immediate validation feedback and uppercase normalization.
- **Preset Swatches**: Quick selection of balanced, accessible presets (Daylight Sage `#48634E`, Ocean Blue `#2B6CB0`, Nordic Teal `#237874`, Warm Terracotta `#B85D3B`, Velvet Plum `#7B4B74`, and Graphite Slate `#4A5568`). Swatches are semantic buttons with visible checkmarks and accessible names.
- **Live Preview Card**: Immediately previews the chosen accent across representative UI elements (button fill, badge, checkbox control, text accent).
- **Reset to Daylight Sage**: Restores the built-in Daylight sage defaults (`#48634E` in light mode, `#8FA893` in dark mode).
- **Theme-Adaptive Contrast Engine**: Implements WCAG 2.1 relative luminance and contrast calculations. Text foreground automatically flips between white and dark charcoal based on contrast ratios (aiming for $\ge 4.5:1$). Surface text and borders adapt to maintain readability across both light and dark themes.

---

## 3. Considered Zen Greeting System

The Zen header provides a quiet, restrained start to each day:
- **Primary Greeting**: Time-based local greeting ("Good morning", "Good afternoon", "Good evening").
- **Supporting Message**: A short, thoughtful line directly beneath the greeting (3–9 words, e.g., *"Make room for what matters."*, *"One thing at a time."*, *"Start where you are."*).
- **Deterministic Daily Rotation**: Messages rotate based on the local calendar date (`YYYY-MM-DD`). The greeting remains stable throughout the entire local day, across re-renders, view switches, and window reloads.
- **Local Date Safety**: Never parses date strings as UTC, preventing date-shift bugs across time zones.

---

## 4. Download, Extract & Double-Click Launch

1. Download the release package (`Daylight-v1.2.1.zip`).
2. Extract the ZIP archive anywhere on your computer (e.g. your `Desktop` or `Documents` folder).
3. **Double-click `index.html`** to launch Daylight immediately in your default web browser.

No installation, terminal commands, Node.js runtime, local web server, account registration, or internet connection is required.

---

## 5. Offline & Privacy Architecture

- **100% Offline**: All HTML, CSS, JavaScript, and icons are self-contained in `index.html`. No external scripts, stylesheets, CDNs, or web fonts are loaded.
- **Zero Telemetry**: No analytics, cookies, tracking pixels, ads, or network requests are ever made.
- **Local-First**: Your data is stored directly in your browser's local sandbox (`localStorage`).
- **SecurityError Resilience**: In sandboxed iframes or browsers with restricted storage permissions, Daylight catches property access exceptions cleanly and defaults immediately to Memory-Only mode without crashing.
- **Safe Rendering**: All user-entered titles, descriptions, notes, and journal entries are rendered exclusively via safe DOM APIs (`textContent` and text nodes), eliminating script injection risks.

---

## 6. How to Export and Restore Backups

### Exporting Backups
1. Click the **Settings & Data** icon (gear) in the top bar.
2. Under **Local Storage & Backup**, click **Export JSON Backup**.
3. A file named `daylight-backup-YYYY-MM-DD.json` will download to your computer.

### Transactional Restore
1. Open Daylight and navigate to **Settings & Data**.
2. Click **Restore from JSON Backup** and choose your saved `.json` file.
3. Daylight validates the entire schema, record types, dates, and relationships. It presents an inspection preview with exact record counts.
4. When confirmed, **Daylight commits the data to persistent storage FIRST**.
5. Only after a successful storage write does the in-memory application state update. If the write fails (e.g., due to storage quota), your existing data remains untouched.

---

## 7. Storage Realities & Boundaries under `file://`

1. **Browser Profile & Data Clearing**: Browser storage is isolated per browser profile and file path. Clearing your browser cookies/storage or moving/renaming the `index.html` file on disk may cause your browser to allocate a fresh storage sandbox.
2. **Encryption Notice**: Browser local storage is not encrypted at rest by default. If your computer is shared, anyone with operating system access to your user profile directory could read local files or storage files. We recommend full-disk encryption (FileVault on macOS, BitLocker on Windows, LUKS on Linux).
3. **Honest Persistence Reporting**: Daylight probes storage at startup with a dedicated test probe key. If storage access is restricted by browser settings (or private browsing mode), Daylight displays a persistent warning badge and operates safely in **Memory-Only Mode**.
4. **Data Recovery Mode**: If saved data is ever corrupted by an external tool or malformed edit, Daylight does **not** silently overwrite it. It enters Recovery Mode, preserving the raw stored string and providing an immediate **Download Raw Payload** button so your data can be rescued.
5. **Transactional Reset**: Resetting data prompts you to export a backup first, then writes an empty state to storage before wiping the active workspace. If storage fails, your existing data is preserved.

---

## 8. Tested Browser Matrix

| Environment / Browser | Platform | Result | Notes |
| :--- | :--- | :--- | :--- |
| **Node.js Automated Test Suite** | Linux x64 (v22) | **PASS** | Release immutability enforcement, semantic version validation, bundler regression, SecurityError resilience, monotonic contrast adjustments, schema validation, Zen daily rotation, storage probe, transactional restore, cycle prevention, recursive subtasks, finance minor units, habit streaks, release integrity. |
| **Headless Chromium (Playwright)** | Linux x64 / file:// | **PASS** | Standalone HTML launched directly via file:// URL. Verified 0 syntax errors, 0 uncaught page exceptions, visible Zen view greeting ("Good morning"), tab navigation between Zen and Dō, accent color updates, theme toggling, and local storage state persistence. |
| **Mozilla Firefox (Gecko)** | Desktop file:// | **Not run** | Standard W3C DOM and CSS custom properties; not independently tested on Firefox in this container environment. |
| **Apple Safari (WebKit)** | macOS / iOS | **Not run** | WebKit storage probe fallback verified via automated mocks; physical Safari device test not run. |
| **Microsoft Edge** | Desktop file:// | **Not run** | Chromium engine; expected identical to Chromium, not independently run. |

---

## 9. Contributor Setup & Build Commands

### Prerequisites
- **Node.js**: v20 or later (Node.js v22 recommended).
- **Python 3**: Required as a packaging tool for deterministic, zero-dependency ZIP archive generation (`python3 -c "import zipfile"`).

### Clean Contributor Installation
```bash
# Clean reproducible installation using the checked-in package-lock.json
npm ci
```

### Run Automated Unit Tests
```bash
npm test
# or: node --test daylight/tests/*.test.js
```

### Build Standalone HTML (Without Creating a Release)
```bash
npm run build:standalone
# or: npm run build
```
This bundles `daylight/src/` into the standalone `daylight/index.html` file using `esbuild`, performs strict classic-script syntax validation, and updates `public/daylight/index.html`. It **never** touches or overwrites release ZIP archives.

### Package a Versioned Release
```bash
npm run release -- --version=1.2.0
```
Requires an explicit semantic version (`--version=X.Y.Z`). Refuses to overwrite existing releases by default. Generates `Daylight-vX.Y.Z.zip`, SHA-256 manifests, and verifies package contents.

### Validate Production Artifact
```bash
npm run validate
```

### Verify Existing Release Archive
```bash
npm run verify:release -- --version=1.2.0
```

---

## 10. Historical Release Integrity & Versioning

- **Daylight v1.2.1 (Current)**: Packaged as `Daylight-v1.2.1.zip` containing `Daylight-v1.2.1/index.html`, `README.md`, and `LICENSE`. Master product repair, customization, and polish: accessible modal dialogs replacing all browser confirms/prompts, note editing workflow, calendar event editing with time validation, dedicated milestone modal forms, selectable custom habit recurrence schedules, Bangladeshi Taka (BDT ৳) and zero-decimal JPY handling, minimal monochrome sun brand logo, top-left brand return navigation, clean line SVGs replacing emojis, and translucent frosted glass Dō sidebar.
- **Daylight v1.1.2**: Enforces release immutability by default, separates standalone build from release packaging, supports clean `npm ci` contributor setup with `package-lock.json`, generates SHA-256 manifests, and provides automated archive verification.
- **Daylight v1.1.1**: Resolved multiline ESM import bundler defect with esbuild IIFE output, hardened accent contrast using monotonic linear channel interpolation, and implemented `SecurityError` storage resilience.
- **Historical Note (v1.0.0 & v1.1.0)**: Inspection of the initial release archives shows identical internal HTML and README files despite differing archive folder names. In v1.1.1, v1.1.2, and v1.2.0, all historical release archives are frozen and protected against modification.

---

## 11. License

Daylight is open-source software released under the **MIT License**. See `LICENSE` for details.
