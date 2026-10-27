# Daylight — One-Shot Master Build Prompt

> **How to use:** Open your coding AI in the project workspace, paste the entire prompt below, and attach `Daylight_Product_and_Engineering_Specification.md` if you have it. Give the AI permission to create/edit project files and run local tests. This prompt is intentionally self-contained, so the specification attachment is helpful but not mandatory.

---

# START OF MASTER PROMPT

## Role and mission

You are the senior product designer, frontend engineer, software architect, accessibility reviewer, QA engineer, and release engineer responsible for delivering **Daylight**.

Your job is to **build the working application and its release files in the current workspace**, not merely describe a plan, produce mockups, or give me code snippets. Work autonomously. Do not ask me clarifying questions. Where a detail is not specified, use the simplest safe, coherent default described below, document the decision, and keep going.

If a project already exists, inspect it before changing anything. Preserve useful existing work and do not overwrite unrelated files. If `Daylight_Product_and_Engineering_Specification.md` is present, read it and use it as additional product context. This prompt is the controlling specification for the required deliverable and non-negotiable engineering constraints. Resolve ambiguity conservatively and document the choice.

### Required outcome

Deliver a finished, attractive, functional, responsive, offline-capable personal life dashboard called **Daylight**, with two views:

- **Zen** — calm, focused, minimalist view for daily use.
- **Dō** — expanded view for planning and managing all modules.

The app must be distributed so a person can download a ZIP from GitHub, extract it, and **double-click `index.html`** to use it. No installation, command line, local server, hosting, account, or internet connection may be required for core use.

Do not stop at the first working-looking screen. Implement the feature requirements, data integrity protections, backup/restore, documentation, and validation/testing described below. Never claim that a requirement or test passed if you did not actually verify it.

---

## 1. Non-negotiable product and technical constraints

1. The release `index.html` must be self-contained: all runtime HTML, CSS, JavaScript, and icons are in that file.
2. Use plain HTML, CSS, and vanilla JavaScript. No required runtime frameworks or third-party libraries.
3. Do not use external scripts, stylesheets, fonts, images, icon sets, APIs, analytics, ads, telemetry, remote services, runtime downloads, or network-dependent features.
4. Do not use `fetch()` to load local files, runtime ES module imports, service workers, or a PWA install flow. The app must work when opened as a `file://` URL.
5. Keep the code readable and reasonably structured. Use clear sections and small functions/classes rather than giant opaque handlers. Do not minify the only copy of the code.
6. Use system fonts and inline SVG or CSS icons.
7. Zen and Dō must be two views of one application state and one data model. They must never maintain separate copies of tasks or other records.
8. All persistence must go through a centralized storage/data service. Feature and UI code must not independently write to browser storage.
9. Browser storage under `file://` differs across browsers and versions. Do not pretend persistence is guaranteed. Detect failure, handle it safely, and document tested behavior.
10. Do not say “saved” unless the write operation succeeded. If persistence is unavailable, display a clear and persistent warning that edits may be lost when the page closes.
11. Never silently wipe, reset, replace, or overwrite malformed, unsupported, or potentially recoverable user data.
12. Provide versioned JSON backup export and validated restore/import.
13. Core features must operate offline.
14. Support light, dark, and system theme choices.
15. Implement responsive desktop and mobile layouts without horizontal overflow.
16. No fake functionality. Every visible interactive control must work or be clearly disabled and labeled as not available.
17. No placeholder links, “coming soon” controls presented as working, dead buttons, or sample data that looks like the user's real data.
18. Do not ask the user questions. Make sensible defaults and list any material unresolved limitations in the final report.
19. Do not claim that browser compatibility, persistence, accessibility, or offline behavior has been verified unless the appropriate test was actually performed.
20. Prefer data safety, clear user feedback, and functional completeness over decorative complexity.

### Important reality about local-file storage

The no-server/double-click requirement is mandatory for this deliverable, but browser storage behavior for `file://` is not standardized consistently. Implement a central adapter that probes actual storage access and catches read/write errors. Use local browser storage as the primary persistent mechanism if it works; do not add complex storage backends without a demonstrated need. At startup, attempt a safe read/write/remove probe using a dedicated temporary probe key, catch all exceptions, and remove the probe key after a successful check. Do not use a probe that overwrites app data.

The app must have at least these explicit persistence states:

- **Persistent:** storage is available and a save succeeded.
- **Temporary / memory-only:** persistent storage is unavailable or fails. The app may continue in memory, but must prominently explain that the data may be lost when the page closes.
- **Recovery/error:** saved data cannot be safely parsed, validated, or loaded. Preserve the original stored bytes/string and do not overwrite it. Show safe recovery instructions and allow a raw recovery export when possible.

A successful storage probe only proves that storage worked at that moment; it does not guarantee that data survives app relocation, a browser update, profile change, or browser-specific `file://` behavior. Document these boundaries plainly. Encourage regular JSON backups. If browser testing is unavailable in your environment, state that clearly rather than inventing results.

---

## 2. Product personality and visual system

Daylight should feel calm, modern, thoughtful, and Apple-inspired without copying Apple's proprietary assets or any exact product screen. Design for clarity, not decoration.

### Visual direction

Use:
- Warm off-white background in light mode, approximately `#F5F4F0`.
- Clean white/near-white surfaces.
- Restrained sage accent, approximately `#718675`.
- Charcoal primary text, approximately `#292A28`.
- Muted secondary text, approximately `#777771`.
- Quiet stone borders, approximately `#E8E6DF`.
- An independently tuned dark theme with legible contrast.
- System font stack, generous whitespace, consistent spacing, and restrained rounded corners.
- Simple inline SVG/CSS icons with consistent line weight.
- Subtle transitions only, with `prefers-reduced-motion` respected.

These colors are starting tokens, not a reason to sacrifice contrast. Create CSS custom properties for colors, spacing, radii, and typography. Avoid excessive gradients, giant shadows, dense grids, and bright saturated colors. Do not use external font/image/icon resources.

### Interaction quality

- Make the main action of each screen obvious.
- Keep navigation predictable.
- Provide helpful empty states and example-free initial states.
- Show inline form validation and useful error messages.
- Use confirmation for destructive actions.
- Use toast/status messaging sparingly and accessibly; errors must not disappear too quickly.
- All controls need labels and visible keyboard focus.
- Use semantic HTML, sensible tab order, usable touch targets, and sufficient contrast.
- Respect reduced motion.
- Avoid hover-only interaction.
- Keep mobile layouts readable and free from horizontal scrolling.

### Themes and preferences

Provide:
- System / Light / Dark.
- Remembered preferred startup view (Zen or Dō).
- Configurable display of dashboard sections where feasible.
- A settings screen with clear data-management actions.
- Persist preferences through the same data service as the app's other preferences.

---

## 3. Information architecture and required views

### 3.1 Zen view

Zen is a calm daily overview, not a second app. Include:
- Greeting and current local date.
- Up to three user-selected top priorities, or a simple action to select them.
- A compact list of today's tasks.
- The next event or a helpful empty state.
- Today's habit checklist/summary.
- Quick capture for a task and a note.
- A clear Zen/Dō switch.
- Easy access to settings and backup.

Keep Zen visually quiet. Do not cram every module into it.

### 3.2 Dō view

Dō is the expanded management dashboard. Provide clear navigation and views for:
1. Today
2. Tasks
3. Projects
4. Calendar / Agenda
5. Habits
6. Goals / Milestones
7. Notes
8. Journal
9. Finance
10. Settings / Data

If screen size requires a responsive navigation pattern, use a sidebar on wider screens and a compact, accessible menu/navigation on narrow screens. Every module must remain reachable.

### 3.3 Shared-state rules

- Editing a record in any view updates the shared state.
- Switching between Zen and Dō never duplicates or resets records.
- Current view is a preference only; the records remain canonical.
- After a successful save, all rendered views reflect the same current state.
- A mode switch must not cause data loss or change unrelated user records.

---

## 4. Required feature behavior

Implement every module below with functioning create, view, edit, and delete behavior wherever applicable. Use dialogs or forms consistently. Use understandable labels and safe defaults.

### 4.1 Today dashboard

Display:
- Local date.
- Top priorities.
- Tasks due today or explicitly scheduled for today.
- The next upcoming event.
- Today's scheduled habits and their completion state.
- Quick task and note capture.
- Useful empty states with clear next actions.

Define the logic for what counts as “today” and use it consistently based on the user's local calendar date. Do not convert date-only values through UTC in a way that shifts the day.

### 4.2 Tasks

A task includes at minimum:
- Stable ID.
- Title (required).
- Optional description.
- Creation and update timestamps.
- Completion state and optional completion timestamp.
- Optional due date as `YYYY-MM-DD`.
- Priority (`low`, `normal`, `high`).
- Optional project ID.
- Optional parent task ID for a subtask.
- Optional flag for one of the user's top priorities.

Features:
- Add, view, edit, complete/reopen, and delete tasks.
- Provide Today, Upcoming, All, and Completed filters, or an equally clear set.
- Sort predictably, with overdue/today tasks easy to see.
- Support search/filter if it can be implemented reliably.
- Permit tasks without a due date.
- Completing a task must not remove it permanently.
- Support basic subtasks with clear parent/child presentation.
- Validate that a task cannot be its own parent and prevent subtask cycles.
- If deleting a parent task, ask whether to delete its subtasks too or preserve them as independent tasks; make the choice explicit.
- If a task is linked to a project/goal, handle deletion by removing stale references without crashing or silently deleting unrelated data.

### 4.3 Projects

A project includes:
- Stable ID.
- Name (required).
- Optional description.
- Creation/update timestamps.
- Active/archived status.

Features:
- Create, edit, archive/unarchive, and delete projects.
- Show related tasks.
- Show a simple derived count of completed versus total related tasks.
- Do not store a stale percentage that can become inconsistent.
- When deleting a project, confirm and make its tasks unassigned rather than deleting the tasks. Explain that behavior in the confirmation.

### 4.4 Calendar and agenda

Provide a usable agenda plus a basic month view if practical without compromising the core flow. Events are entered manually; do not implement calendar-provider synchronization.

An event includes:
- Stable ID.
- Title (required).
- Start date/time.
- Optional end date/time.
- All-day flag or an explicit no-time representation.
- Optional notes.
- Creation/update timestamps.

Requirements:
- Create, edit, delete, and view events.
- Distinguish all-day/date-only events from timed events.
- Validate end is not before start when both are present.
- Display upcoming events in chronological order.
- Show a clear empty state.
- Handle month/year boundaries.
- Store absolute event instants as ISO timestamps and date-only values as `YYYY-MM-DD`; use one consistent rule for all-day events.
- Use native date/time form controls where appropriate, with readable labels.
- Avoid suggesting that external calendars are synced.

### 4.5 Habits

A habit includes:
- Stable ID.
- Name (required).
- Optional description.
- Recurrence: daily or selected weekdays.
- Start date.
- Active/paused/archived state.
- Creation/update timestamps.

Habit entries are separate records keyed by habit ID and local date. They record whether the habit was completed on a scheduled date.

Features:
- Create, edit, pause/resume, and delete habits.
- Complete/uncomplete today's habit.
- Review recent history.
- Edit historical entries.
- Display a simple streak or completion summary derived from entries and recurrence rules.
- Only count scheduled days when evaluating streaks.
- An unscheduled day is not a failure.
- Do not use shaming language, punitive red warnings, or manipulative streak pressure.
- Define recurrence evaluation consistently. For weekly habits, only the selected weekdays count as scheduled.
- Deleting a habit should ask for confirmation and remove its associated entries only after confirmation.

### 4.6 Goals and milestones

A goal includes:
- Stable ID.
- Title (required).
- Optional description.
- Optional target date (`YYYY-MM-DD`).
- Status (`active`, `completed`, `paused`).
- Optional associated task IDs.
- Creation/update timestamps.

A milestone includes:
- Stable ID.
- Parent goal ID.
- Title (required).
- Completion state.
- Optional target date.
- Sort position.

Features:
- Create/edit/delete goals and milestones.
- Complete/reopen milestones.
- Show progress derived from completed milestones divided by total milestones.
- If a goal has no milestones, display its status rather than an invented percentage.
- Task links are optional, validated, and cleaned up when a linked task is deleted.
- Deleting a goal should explain whether its milestones will also be removed; default to removing the goal's milestones but preserving all tasks.

### 4.7 Notes

A note includes:
- Stable ID.
- Title (may be optional if the note body is not empty).
- Body text.
- Pinned flag.
- Creation/update timestamps.

Features:
- Create, view, edit, pin/unpin, delete, and search notes.
- Search title and body using case-insensitive matching.
- Sort pinned notes first, then most recently updated.
- Treat user content as text; do not inject it as HTML.
- Autosave is optional; if used, debounce carefully and show honest save state. An explicit save action is acceptable and safer.
- Do not silently discard edits when closing a form; warn before losing unsaved changes.

### 4.8 Journal

A journal entry includes:
- Stable ID.
- Local date (`YYYY-MM-DD`).
- Body text.
- Creation/update timestamps.

Features:
- Create, view, edit, and delete entries.
- Show chronological browsing, newest first by default.
- Decide and document whether multiple entries may exist for the same date. Default: allow multiple entries.
- A journal entry is not the same entity as a note.
- Treat text safely; never render user-written content as HTML.

### 4.9 Manual finance tracker

Implement this as an optional, manual-only module. Do not connect to bank accounts or financial services.

A transaction includes:
- Stable ID.
- Type: expense or income.
- Amount stored as an integer in the chosen currency's minor unit where a two-decimal currency is selected.
- Date (`YYYY-MM-DD`).
- Category.
- Optional note.
- Creation/update timestamps.

Features:
- Add, edit, and delete transactions.
- Filter by month and category.
- Show income, expenses, and net total for the selected month.
- Show totals by category for expenses.
- A simple optional monthly expense budget.
- Validate amount is positive and dates/categories are valid.
- Keep arithmetic in integer minor units to avoid normal floating-point rounding errors.
- Currency is explicitly user-configurable in Settings; default to USD only as an editable, clearly labeled initial setting. Never infer currency from location.
- State clearly that all transactions are manually entered and are not bank-synced.
- Do not present investment advice, forecasts, or unsupported financial recommendations.

### 4.10 Settings and data management

Include:
- System/light/dark theme.
- Preferred startup view.
- Currency selection for finance.
- Storage/persistence status.
- Export all app data to JSON.
- Import/restore a JSON backup with preview and explicit confirmation.
- Reset all data only behind an explicit, clearly worded confirmation, with an opportunity to export first.
- Show the app version/schema version.
- Explain storage limitations and backup responsibility.
- Do not create a hidden support/telemetry channel.

---

## 5. Data model and integrity

Create one canonical versioned JSON state. A starting shape is:

```json
{
  "schemaVersion": 1,
  "preferences": {
    "theme": "system",
    "startupView": "zen",
    "currency": "USD"
  },
  "tasks": [],
  "projects": [],
  "events": [],
  "habits": [],
  "habitEntries": [],
  "goals": [],
  "milestones": [],
  "notes": [],
  "journalEntries": [],
  "transactions": [],
  "budgets": []
}
```

You may add necessary fields, but document them. Use stable, unique IDs generated locally. Do not use array indexes as record IDs.

### Data conventions

- Date-only values: `YYYY-MM-DD` strings.
- Actual instants: ISO 8601 timestamps.
- Store date-only data as date-only strings; do not parse it as UTC midnight and then display it in local time.
- Validate all required fields, enum values, dates, references, and entity arrays.
- Preserve unknown optional fields where safely possible, or explicitly document stripping behavior.
- Reject malformed imported structures before they can mutate current state.
- Enforce unique IDs inside each collection.
- Check relationships: task/project, subtask/parent, goal/milestone, task/goal, habit/habit entry.
- Delete/modify references predictably so there are no dangling links.
- Do not store derived task counts or goal completion percentages as independent facts.
- Add `createdAt` and `updatedAt` to entities where appropriate.
- Use a clear schema migration function and increment schema versions for breaking changes.
- Do not silently accept a newer unsupported schema.

### Storage adapter requirements

Implement all storage access through a module/object/service with operations conceptually like:

- `load()`
- `save(validState)`
- `getStatus()`
- `exportSnapshot()`
- `validateImport(parsedData)`
- `restore(validatedData)`
- `migrate(oldData)`

Names may differ, but responsibilities must remain centralized.

At boot:
1. Detect whether browser storage is available.
2. Load existing data.
3. Parse and validate.
4. Migrate only known, supported older versions.
5. If no saved data exists, initialize a valid empty default state.
6. If existing data is malformed or unsupported, enter recovery mode. Preserve the raw value and never replace it automatically with defaults.

For every save:
- Validate the candidate state.
- Attempt the write.
- Only mark it saved after write success.
- Catch exceptions such as access denied or quota errors.
- On failure, retain the current in-memory state where possible and show persistent status indicating that the newest changes are not safely stored.
- Never overwrite a malformed stored payload as part of routine startup.
- Avoid multiple competing writes racing each other.
- Keep a last-known-good in-memory snapshot where practical.

If the environment does not support storage, allow temporary in-memory use only if the UI prominently says changes may be lost. Provide JSON export as a recovery route where possible.

### Recovery mode

If saved data cannot be loaded safely:
- Do not silently open a blank app and overwrite the previous value.
- Explain that the existing data could not be read.
- Offer raw recovery export of the original stored string if possible.
- Offer import of a valid backup.
- Offer an explicit “start fresh” destructive action only after explaining it will replace or discard inaccessible data and getting confirmation.
- Keep error text safe; do not dump sensitive user content into logs or alert dialogs.

---

## 6. JSON export, import, and restore

Export and import are core MVP functions.

### Export

- Export all supported user records, preferences, and schema version as one readable JSON file.
- Suggested filename: `daylight-backup-YYYY-MM-DD.json`.
- Use a Blob/object URL download and revoke the URL after the download is initiated.
- Include no telemetry, secrets, developer paths, browser-profile details, or unrelated data.
- Also provide a raw recovery export when only the saved raw payload can be recovered.

### Import

Use a native file input; do not assume the File System Access API is available under `file://`.

Required sequence:
1. Let the user choose a JSON file.
2. Read it safely.
3. Parse JSON.
4. Validate the full shape, schema version, entity arrays, IDs, dates, enum values, amounts, and relationships.
5. If it is an older supported version, migrate it in memory and validate the migrated result.
6. If it is malformed or unsupported, show a useful error and leave current data untouched.
7. If valid, show a preview with record counts and a clear statement that restore will replace the current dataset.
8. Require explicit confirmation.
9. Write the new snapshot successfully before switching the app's canonical in-memory state.
10. If the write fails, retain current valid state and report the failure.
11. On success, re-render the app and show confirmation.

Do not implement merge unless you also implement and test duplicate-ID handling, relationship reconciliation, and conflict rules. A reliable replace/restore flow is required; merge is not required.

---

## 7. Date, time, and localization rules

- Use the device's local calendar date for “today.”
- Keep date-only strings separate from timestamps.
- Avoid `new Date("YYYY-MM-DD")` for a date-only value if it can introduce UTC/time-zone shifts; parse and format date-only values with explicit local-safe helpers.
- Use ISO timestamps for moments in time.
- Events with exact start/end times should be rendered in local time.
- Validate event ordering and all calendar input.
- Test daylight-saving/time-zone boundaries where the environment allows.
- Format dates in a readable locale-aware way, but retain canonical stored formats.
- Do not assume the user's country, currency, or language from browser location.
- A full internationalization framework is out of scope; the initial UI can be English, but keep strings reasonably centralized if practical.

---

## 8. Accessibility and responsive behavior

At minimum:
- Semantic page headings and landmarks.
- Proper form labels and descriptions.
- Buttons use `<button>`; navigation uses meaningful links or buttons with correct semantics.
- Full keyboard access for core workflows.
- Visible focus indicators in both themes.
- Dialogs/overlays with sensible focus handling and keyboard dismissal.
- Status/error messages exposed to assistive technology appropriately.
- Do not communicate completed/overdue/error state by color alone.
- Verify text contrast as far as practical.
- Respect reduced motion.
- Responsive at narrow mobile widths, tablet, and desktop.
- No clipped dialogs or horizontal overflow.
- Touch targets are comfortably usable.
- Use accessible names for icon-only controls and include text alternatives/tooltips when helpful.

---

## 9. Error handling and empty states

Every primary module must have:
- An empty state.
- A form validation state.
- A save success/failure state.
- A destructive-action confirmation.
- A useful error message for invalid inputs.
- A loading/initialization failure state where relevant.

No visible button may be inert. If a feature genuinely cannot be implemented, do not pretend it works. Keep the user informed, document the limitation, and continue building the rest.

Use one consistent feedback pattern across the app. Do not rely only on browser `alert()` / `confirm()` for ordinary interactions; custom accessible dialogs are preferred. Native confirmation may be used as a pragmatic fallback for an explicitly destructive action if correctly worded.

---

## 10. Architecture and code-quality requirements

Keep logic understandable and separated into clear sections or source files:

- App bootstrap and view/navigation.
- Canonical state and state update functions.
- Schema validation and migrations.
- Storage adapter.
- Backup/import/restore.
- Tasks/projects.
- Events/calendar.
- Habits/history.
- Goals/milestones.
- Notes/journal.
- Finance.
- Theme/preferences.
- Shared UI utilities and validation.

The final release `index.html` must bundle all runtime code and styles locally. Because the launch experience is file-based, do not make the release depend on local sibling source files.

If you use a build tool, it is allowed only as a developer-time convenience. It must not be required for end users to run the released file. Keep the build instructions documented. Do not install large dependencies just to solve simple UI needs.

Security basics:
- Render user-entered text with `textContent` or safe DOM APIs; do not inject it as HTML.
- Avoid `eval` and dynamic code execution.
- Validate import file size/type reasonably and handle read/parse errors.
- Do not log whole user records in the console.
- Do not make network requests.
- Avoid unsafe URL injection and arbitrary HTML in notes.
- Do not treat imported JSON as trusted merely because it is JSON.

---

## 11. Testing requirements

Create and run as many automated tests as the workspace supports. If a browser automation stack is already available, use it; do not add a heavyweight dependency without need. Test pure data/validation logic independently where possible. At minimum, perform code-level checks and provide a clear manual test checklist.

### Data/storage tests

- Empty first launch initializes valid state.
- Create/edit/delete persists when storage works.
- Reload reflects saved changes.
- Zen/Dō both reflect the same changes.
- Storage blocked/throws produces a clear non-persistent warning.
- Write/quota error does not report success.
- Malformed saved JSON enters recovery without overwriting the raw value.
- Unsupported newer schema is preserved and rejected safely.
- Supported older schema migrates and validates.
- Valid export parses as JSON and includes all collections/preferences.
- Invalid import leaves current state unchanged.
- Valid import previews counts and requires confirmation.
- Failed restore write leaves current canonical state intact.
- Record relationships stay valid after deletion.
- Duplicate IDs and invalid cross-references are rejected.
- Date-only due dates remain on the correct day.
- Finance calculations use integer minor units consistently.

### Feature tests

- Tasks: CRUD, complete/reopen, due dates, priorities, subtasks, project links.
- Projects: CRUD/archive, derived task progress, delete behavior.
- Calendar: CRUD, all-day and timed events, validation, chronological order, month/year boundary.
- Habits: schedule rules, complete/uncomplete, history edits, streak logic.
- Goals: CRUD, milestone completion, derived progress, linked task cleanup.
- Notes: CRUD, pinning, search, safe text rendering.
- Journal: multiple entries/date if allowed, chronology, CRUD.
- Finance: amount validation, categories, month filters, totals, budget behavior.
- Settings: theme selection, startup view, currency, persistence warning, backup actions.
- Reset: confirmation and correct behavior.

### UI/offline tests

- Light/dark/system themes.
- Responsive layout at mobile/tablet/desktop sizes.
- Keyboard-only core workflow.
- Visible focus and accessible labels.
- Reduced motion.
- Empty states and validation errors.
- No horizontal page overflow.
- Open the release HTML while offline.
- Inspect runtime code for external dependencies/network calls.
- Verify user data is not sent anywhere.

### Real-browser persistence test

The required test matrix is current desktop versions of Chrome, Edge, Firefox, and Safari where available, using the actual generated release `index.html` via double-click / `file://`, not a development server. Test save, reload, close/reopen, backup/restore, and file relocation/renaming. Record pass/fail and version details only for browsers actually tested. If you cannot access a browser, clearly label that test “not run”; do not infer a pass from code inspection.

---

## 12. Required repository and deliverables

Create these files in the current project workspace:

```text
daylight/
├── index.html
├── README.md
├── LICENSE
├── tests/                  # automated tests or focused test files where feasible
└── .gitignore
```

You may add a `src/`, build script, or developer documentation only if useful. Keep the release flow simple. The exact production artifact must be `index.html` and must be self-contained.

### `index.html`

- Fully functional app.
- No external runtime assets or network dependencies.
- Inline style/script assets.
- Readable source.
- App version shown in Settings/About or similar.

### `README.md`

Include:
- Product summary and Zen/Dō explanation.
- Screens/features.
- Download, extract, and double-click instructions.
- Statement that no server or account is required.
- Offline/privacy behavior.
- How to export and restore backups.
- Storage limitations for `file://`.
- Warning that browser data clearing, profile changes, or file relocation may affect stored data.
- Clear statement that browser storage is not encrypted by default.
- Actual browser/test matrix and unverified items.
- Known limitations and recovery guidance.
- Build/test instructions for contributors, if applicable.

### `LICENSE`

If no existing license is present, add the standard MIT License with copyright holder written as `Daylight contributors` and the current year. Mention this default license choice in your final report so it can be changed before publication if desired. Do not overwrite an existing license.

### `.gitignore`

Ignore local test data, personal backups, editor/OS artifacts, temporary builds, and other generated noise. Do not ignore the required production `index.html`.

### Release ZIP

Create a clean release ZIP if the environment supports file creation. It should contain a top-level release folder such as:

```text
Daylight-v1.0.0/
├── index.html
└── README.md
```

Add LICENSE if release inclusion is intended. Do not place developer-only test fixtures or real user data in the release ZIP. Verify ZIP contents after creating it.

---

## 13. Definition of done

Do not consider the task complete until each applicable item has been addressed:

- [ ] Actual working app files exist in the workspace.
- [ ] Opening `index.html` directly works in the available environment.
- [ ] The page is self-contained and core functionality is offline.
- [ ] Zen and Dō use the same records/state.
- [ ] Tasks/projects function correctly.
- [ ] Calendar/events function correctly.
- [ ] Habits and history function correctly.
- [ ] Goals/milestones function correctly.
- [ ] Notes and journal function correctly.
- [ ] Manual finance functions correctly.
- [ ] Theme/settings work.
- [ ] Export/import/restore work with validation and confirmation.
- [ ] Storage failures are visible and do not cause false success.
- [ ] Malformed/unsupported data is not silently destroyed.
- [ ] User-entered content is rendered safely.
- [ ] Responsive layout and essential accessibility have been reviewed.
- [ ] Tests have been run to the extent possible and results are reported honestly.
- [ ] README documents launch, backup, storage limitations, and unverified browser behavior.
- [ ] Required output files and release ZIP exist, if ZIP creation is supported.
- [ ] No real personal data, secrets, credentials, or machine-specific files were included.

---

## 14. How to execute this task

Follow this sequence without waiting for further user input:

1. **Inspect:** Review the current workspace and any attached project specification. Identify existing tools and constraints.
2. **Make a brief internal plan:** Prioritize the app's core data model and storage safety, then implement everything. Do not reply with a plan instead of doing the work.
3. **Build the vertical slice:** Implement the app shell, canonical state, storage adapter, storage status UI, and JSON backup/restore before relying on the storage layer in all modules.
4. **Implement every required module:** Build real working interactions, shared state, validation, empty states, and destructive-action handling.
5. **Polish:** Complete the Zen and Dō visual hierarchy, light/dark/system themes, responsiveness, keyboard focus, and error feedback.
6. **Test:** Run tests and inspect the code for external requests, unsafe HTML injection, dead controls, false saved messages, and date-only/UTC mistakes.
7. **Package:** Produce the self-contained `index.html`, README, license, ignore file, tests where feasible, and clean release ZIP.
8. **Verify outputs:** Re-open/read the final files, validate the HTML/JS as far as tools permit, check the ZIP listing, and ensure all required files really exist.
9. **Report honestly:** Provide a short final report stating files created, features completed, tests actually run, tests not run, known limitations, and exact release/ZIP location. Do not claim browser tests or `file://` persistence tests you could not perform.

Do not waste the response on a long explanation of what you intend to do. Use the available tools to create the app directly. If a particular test cannot be performed in the environment, continue with the implementation, clearly mark the test as not run, and provide the exact manual steps to verify it.

## Final quality rule

A good-looking mockup is not a finished app. A finished app means the core workflows work, data is handled safely, the app is self-contained, the user gets honest feedback when persistence fails, backups work, and the delivered files are real and usable.

**Start by inspecting the workspace, then build the application. Do not ask me to confirm these requirements.**

# END OF MASTER PROMPT
