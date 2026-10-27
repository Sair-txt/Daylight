# Daylight --- Product & Engineering Specification

**Status:** Planning specification\
**Working name:** Daylight\
**Release target:** A self-contained, local-first personal dashboard
distributed through GitHub\
**Document purpose:** Single source of truth for product decisions,
technical constraints, implementation, testing, and release.

------------------------------------------------------------------------

## 1. Product vision

Daylight is a calm, minimal, Apple-inspired personal Life Dashboard that
helps a person organize everyday life without needing an account, a
hosted service, or a complicated setup.

The app should feel clear and welcoming rather than busy. It brings
daily priorities and longer-term personal organization into one place
while keeping the user's data under their control.

### Product principles

1.  **Calm by default:** Show the most useful information first; avoid
    visual noise.
2.  **One source of truth:** Zen and Dō are two views of the same app
    and the same records.
3.  **Private by design:** No accounts, cloud database, analytics, ads,
    or routine network activity.
4.  **Data ownership:** Users can export and restore their data in a
    documented format.
5.  **Honest status:** Never claim data was saved if the save operation
    failed or persistence is unavailable.
6.  **Progressive detail:** The simple view is quick to scan; the
    expanded view offers more control.
7.  **Readable and maintainable:** Prefer straightforward,
    well-documented code over unnecessary abstractions.
8.  **Accessible:** Support keyboard navigation, clear focus indicators,
    meaningful labels, sufficient contrast, and reduced-motion
    preferences.
9.  **Incremental delivery:** Build and verify the foundation before
    adding more modules.
10. **No false compatibility claims:** Support is based on testing the
    actual release file, not assumptions.

## 2. Intended user experience

### 2.1 Zen view

Zen is the calm, focused daily view. It should help the user decide what
matters now without presenting every available feature at once.

Include:

-   A friendly greeting and current local date.
-   Up to three top priorities.
-   A compact task list.
-   The next upcoming event, if one exists.
-   A small habit summary for today.
-   Quick capture for a task or note.
-   A clear way to switch to Dō.
-   A quiet route to settings and backup.

Keep this view compact and useful on mobile screens as well as desktop.

### 2.2 Dō (Do) view

Dō is the expanded dashboard for planning and reviewing the user's life.
The name is inspired by the Japanese word 道, often translated as "way"
or "path"; it is a product name, not a claim of cultural authority.

Include navigation or sections for:

-   Today
-   Tasks
-   Projects
-   Calendar / agenda
-   Habits
-   Goals and milestones
-   Notes
-   Journal
-   Optional finance tracking
-   Settings and data management

The expanded view can show more detail and management controls, but it
must not introduce a separate copy of the user's data.

### 2.3 Switching modes

-   Zen and Dō use the same underlying records, state, and storage
    service.
-   Switching views must never duplicate, delete, or transform user
    records.
-   Preferences may remember the last-selected mode.
-   The mode switch should be obvious, reversible, and accessible.
-   Both views must reflect edits made in the other view.

## 3. Visual and interaction design

### 3.1 Visual direction

Aim for a restrained, system-native feel:

-   Warm off-white page background: approximately `#F5F4F0`.
-   White or near-white surfaces.
-   Muted sage accent: approximately `#718675`.
-   Charcoal primary text: approximately `#292A28`.
-   Secondary gray text: approximately `#777771`.
-   Stone borders and dividers: approximately `#E8E6DF`.
-   A separately tuned dark theme with appropriate contrast.
-   System font stack; do not download external fonts.
-   Local inline SVG for icons; no icon CDN.
-   Generous whitespace, restrained corner radii, subtle borders, and
    clear typography.
-   Animation should be minimal and must respect
    `prefers-reduced-motion`.

These are initial design tokens, not immutable values. Verify contrast
and usability before release.

### 3.2 Layout behavior

-   Desktop: a clear sidebar or compact persistent navigation, with a
    readable main content area.
-   Mobile: compact navigation and layouts that avoid horizontal
    overflow.
-   Use responsive CSS rather than separate apps.
-   Keep primary actions easy to find.
-   Use consistent patterns for dialogs, confirmations, form fields,
    empty states, loading/saving states, and error messages.
-   Avoid excessive cards, shadows, gradients, and decorative elements.
-   Ensure visible keyboard focus and logical tab order.

### 3.3 Themes and preferences

At minimum, support:

-   System theme
-   Light theme
-   Dark theme
-   Accent preference, if it can be implemented without compromising
    contrast
-   Preferred startup mode (Zen or Dō)
-   Section visibility and order, where practical

Preferences must be stored through the same centralized data layer as
other app data.

## 4. MVP feature scope

### 4.1 Today dashboard

-   Show today's date and relevant items.
-   Show top priorities.
-   Show today's tasks and next event.
-   Show a compact habit summary.
-   Provide quick task and note capture.
-   Handle empty states gracefully.

### 4.2 Tasks and projects

Tasks should support:

-   Create, view, edit, complete/reopen, and delete.
-   Title and optional description.
-   Due date.
-   Priority.
-   Optional project association.
-   Optional subtasks.
-   Useful views such as Today, Upcoming, and All.
-   Clear completed-state presentation.
-   Search or filtering where useful.

Projects should support:

-   Create, edit, and delete or archive.
-   Name and optional description.
-   Association with tasks.
-   A simple progress summary derived from associated tasks, if
    practical.

Do not make priority, due date, or project association mandatory unless
there is a strong usability reason.

### 4.3 Calendar and agenda

-   Allow users to create and edit events manually.
-   Show a useful agenda/list view.
-   Support event title, date, start/end time where relevant, and
    optional notes.
-   Handle events without a specific time if supported by the data
    model.
-   Clearly distinguish date-only values from actual timestamps.
-   Recurring habits are separate from calendar events unless a later
    design decision explicitly unifies them.
-   Do not promise calendar-provider synchronization in v1.

### 4.4 Habits

-   Users can create, edit, pause/archive, and delete habits.
-   Users can record a habit entry for a date.
-   Show today's habit status and a modest history or streak summary.
-   Avoid shaming language or punitive visual feedback.
-   Define recurrence rules explicitly before implementation; do not
    implement ambiguous recurrence behavior.
-   Handle skipped days and edits to historical entries predictably.

### 4.5 Goals and milestones

Goals should support:

-   Title and optional description.
-   Optional target date.
-   Status.
-   Milestones.
-   Optional links to related tasks.
-   A simple progress indicator based on defined completion rules.

Progress should be explainable and derived consistently. Avoid
presenting arbitrary progress percentages without a clear rule.

### 4.6 Notes and journal

Notes should support:

-   Create, edit, and delete.
-   Pin/unpin.
-   Search.
-   Basic title and body content.
-   Useful timestamps.

Journal entries should support:

-   Date association.
-   Text content.
-   Editing and deleting.
-   A chronological browsing experience.

Do not add AI writing, remote search, or online sync in v1.

### 4.7 Optional finance tracking

This is a manual, optional module. It must not connect to banks or
financial accounts.

Potential MVP capabilities:

-   Record an expense with amount, date, category, and optional note.
-   Edit and delete transactions.
-   Set a simple monthly budget.
-   Show monthly totals and category totals.

Use explicit currency preferences and avoid guessing currency from the
user's location. Define decimal handling and currency formatting
carefully. If finance adds excessive scope or delays the core app, defer
it to a later release.

### 4.8 Settings and data management

Include:

-   Theme and appearance preferences.
-   Zen/Dō startup preference.
-   Section visibility/order where supported.
-   Export all user data to a versioned JSON file.
-   Import/restore from a JSON backup.
-   A clear confirmation before replacing current data.
-   A reset option only if it is guarded by explicit confirmation and
    never triggered automatically.
-   A visible indication of storage status when persistence is
    unavailable or degraded.
-   Documentation about where data is stored and its limitations.

## 5. Explicitly out of scope for v1

Do not add these unless the product scope is deliberately revised:

-   AI features.
-   Accounts or authentication.
-   Cloud sync or remote database.
-   Social features.
-   Email integrations.
-   Bank integrations or automatic financial imports.
-   Third-party API integrations.
-   Plugin marketplace.
-   Ads, telemetry, analytics, or tracking.
-   Service-worker/PWA installation requirements.
-   Remote assets or runtime downloads.
-   Complex automation and advanced analytics.

The goal is a dependable, self-contained personal tool, not a large
platform.

## 6. Distribution and launch requirements

### 6.1 Required user workflow

The intended user workflow is:

1.  Open the project's GitHub Releases page.
2.  Download the release ZIP.
3.  Extract it.
4.  Double-click `index.html`.
5.  Use the app without installing software, running commands, hosting a
    server, creating an account, or connecting to the internet.

This workflow is a core requirement and must be tested against the
actual release artifact.

### 6.2 Self-contained release

The production `index.html` must include all runtime HTML, CSS,
JavaScript, and required icons/assets.

Runtime restrictions:

-   No external JavaScript or CSS.
-   No external fonts or images.
-   No external API calls.
-   No runtime downloads.
-   No ES module imports that depend on local-file module behavior.
-   No `fetch()` of adjacent local files.
-   No service worker requirement.
-   No third-party runtime dependencies.
-   No network requirement for core functionality.

Inline SVG and a system font stack are preferred.

### 6.3 Source and build workflow

Readable source files and developer-only build tooling may be used
during development, provided the release is bundled into one
self-contained HTML file.

A suggested repository structure:

``` text
daylight/
├── src/
│   ├── app.js
│   ├── state.js
│   ├── storage.js
│   ├── schema.js
│   ├── tasks.js
│   ├── calendar.js
│   ├── habits.js
│   ├── goals.js
│   ├── notes.js
│   └── backup.js
├── styles/
│   ├── tokens.css
│   ├── layout.css
│   ├── components.css
│   └── themes.css
├── tests/
├── index.html              # generated self-contained release file
├── README.md
├── LICENSE
└── .gitignore
```

This layout is a starting point. Keep the build simple and documented.
If a build tool is used, the user should not need it to run the
downloaded release.

### 6.4 Release packaging

A release ZIP should contain at least:

``` text
Daylight-v1.0.0/
├── index.html
└── README.md
```

The GitHub repository may include the full source and tests. GitHub
Pages can be offered as an optional alternative, but the app must not
depend on it.

## 7. Technical architecture

### 7.1 Runtime stack

-   Plain HTML.
-   Plain CSS.
-   Vanilla JavaScript.
-   No required framework.
-   No third-party runtime packages.
-   One self-contained production HTML file.

Prefer clear modules and separation of concerns in source code, then
bundle them for release. Avoid overengineering a small offline app.

### 7.2 Shared application state

Zen and Dō must consume the same canonical application state.

A central state layer should provide predictable operations for
creating, reading, updating, and deleting records. UI components must
not independently maintain competing copies of the same data.

### 7.3 Centralized storage adapter

All persistence must go through a single storage adapter/service. UI and
feature modules must not write directly to `localStorage` or IndexedDB.

The adapter should provide operations conceptually similar to:

-   Load saved data.
-   Validate and normalize data.
-   Migrate supported older schemas.
-   Save a complete valid state or a defined change set.
-   Export a consistent snapshot.
-   Validate and restore a backup.
-   Report persistence capability and errors.

The implementation must not assume that `localStorage` or IndexedDB
behaves identically when the app is opened using `file://`. Browser
storage behavior for local files can vary by browser, profile, path, and
version.

### 7.4 Storage proof of concept --- required before full feature work

Before building the full dashboard, create a tiny standalone HTML file
that:

1.  Displays a small test record.
2.  Allows the user to edit and save it.
3.  Clearly reports success or failure.
4.  Can be closed and reopened to test persistence.
5.  Can export and re-import the test data.
6.  Handles malformed stored data without silently overwriting it.
7.  Can be tested in the target browsers using the actual `file://`
    workflow.

Test in current desktop versions of Chrome, Edge, Firefox, and Safari
where available. Record the actual results rather than assuming success.

If reliable persistence cannot be achieved under the no-server
requirement, revisit the launch constraint and explain the trade-off. Do
not hide the limitation or claim guaranteed portability.

### 7.5 Storage states

The app must distinguish at least these states:

**Persistent mode** - Storage is available and a save operation
succeeded. - The app may tell the user that changes were saved.

**Limited/memory mode** - Persistent storage is unavailable or has
failed. - The app may continue operating temporarily if safe, but must
display a clear warning that changes may be lost. - Do not imply that
changes will survive closing the app.

**Recovery/error mode** - Saved data is malformed, inaccessible,
unsupported, or fails validation. - Do not silently reset the app,
replace the stored data, or discard recoverable data. - Preserve the
original data wherever possible and provide a clear recovery path, such
as exporting the raw backup or restoring a known-good JSON file.

**Quota or write failure** - Catch storage write failures. - Do not show
a success message. - Preserve in-memory edits where possible and tell
the user that persistence failed. - Offer recovery/export guidance when
appropriate.

### 7.6 Data schema and conventions

Use a versioned data structure. Initial conceptual shape:

``` json
{
  "schemaVersion": 1,
  "preferences": {},
  "tasks": [],
  "projects": [],
  "events": [],
  "habits": [],
  "habitEntries": [],
  "goals": [],
  "milestones": [],
  "notes": [],
  "journalEntries": [],
  "transactions": []
}
```

This is a starting outline, not the final field-by-field schema. Define
and document every entity before feature implementation.

Conventions:

-   Stable IDs for records.
-   Creation and update timestamps where useful.
-   Date-only values use `YYYY-MM-DD`.
-   Actual instants use ISO 8601 timestamps.
-   Keep date-only values distinct from timestamps so time-zone
    conversion does not shift a due date.
-   Validate imported and stored data.
-   Handle missing optional fields and schema upgrades deliberately.
-   Use one migration path per supported schema version.
-   Avoid duplicate IDs and invalid cross-references.
-   Define deletion behavior for related records.

Use one documented storage key initially, such as `daylight.data.v1`, or
document a deliberate alternative. Key naming and schema versioning
should not be confused: changing the data schema requires an explicit
migration plan.

### 7.7 Backup and restore

Backup and restore are core features, not optional polish.

Export requirements:

-   Export the complete data snapshot as JSON.
-   Include a schema version.
-   Include only user data and required app preferences.
-   Use a predictable, readable file name.
-   Do not include secrets or machine-specific developer information.

Import requirements:

1.  Read the chosen file.
2.  Parse JSON.
3.  Validate structure, types, IDs, dates, and supported schema version.
4.  Show a useful summary/preview before replacing current data.
5.  Require explicit confirmation for replacement.
6.  Preserve the current valid data until the import has passed
    validation and the replacement can be committed safely.
7.  If import fails, leave current valid data unchanged.
8.  Explain unsupported versions and invalid files clearly.

Do not implement a simplistic "merge" unless conflicts, duplicate IDs,
and relationships are handled by documented rules. A reliable
replace/restore flow is preferable to a misleading merge.

### 7.8 Privacy and security boundaries

-   No account or remote database.
-   No uploads.
-   No telemetry, ads, or analytics.
-   No routine network requests.
-   Do not claim that local storage is encrypted by default.
-   Clearing browser data or changing browser profiles may remove access
    to locally stored data.
-   File relocation or renaming may affect browser storage behavior.
-   Backups are the user's responsibility and should be encouraged.
-   A local-first design reduces remote exposure but does not protect
    data from anyone who can access the same device/browser profile or
    backup files.

Explain these limitations plainly in the README and within the app where
appropriate.

## 8. Suggested internal boundaries

Keep the code organized around clear responsibilities:

-   **App shell:** boot, route/view selection, global events.
-   **State layer:** canonical in-memory state and state updates.
-   **Schema/validation:** data shape, normalization, migration.
-   **Storage adapter:** persistence and storage capability reporting.
-   **Backup service:** export, import, validation, restore.
-   **Feature logic:** tasks, calendar, habits, goals, notes, journal,
    finance.
-   **Rendering/UI:** semantic DOM, forms, lists, dialogs, feedback.
-   **Preferences/theme:** theme selection and user preferences.

These are logical boundaries; they do not require a framework. Avoid
direct DOM manipulation scattered throughout unrelated feature modules.

## 9. Accessibility and quality requirements

-   Use semantic HTML elements.
-   Ensure all controls have accessible names.
-   Support keyboard navigation for core workflows.
-   Use visible focus styles.
-   Do not rely on color alone to convey status.
-   Check text/background contrast.
-   Respect reduced-motion preferences.
-   Avoid tiny tap targets on mobile.
-   Ensure dialogs have sensible focus behavior and can be dismissed
    safely.
-   Show clear validation errors near the relevant fields.
-   Prevent accidental destructive actions with confirmations.
-   Avoid unexpected focus changes and disruptive animations.

## 10. Testing and acceptance plan

Do not declare the app ready solely because it looks correct in one
browser.

### 10.1 Storage and data integrity

-   Save a record, reload, and verify it remains.
-   Close and reopen the browser, then verify persistence.
-   Test the app from the intended local `file://` path.
-   Move or rename the app folder/file and record the outcome.
-   Test storage unavailable, denied, and quota/write-failure paths
    where feasible.
-   Test malformed saved JSON.
-   Test unsupported schema versions.
-   Test valid and invalid imports.
-   Verify failed imports do not overwrite existing valid data.
-   Export, reset a test profile, import, and compare restored data.
-   Test duplicate IDs, missing fields, and invalid cross-references.
-   Verify no success status is shown after a failed save.

### 10.2 Feature behavior

-   Create, edit, complete/reopen, and delete tasks.
-   Verify tasks appear consistently in Zen and Dō.
-   Verify project associations and subtasks.
-   Test due dates at month/year boundaries.
-   Test events with and without specific times, if both are supported.
-   Test habit recurrence and edits to historical entries.
-   Test goal and milestone progress rules.
-   Test note pinning and search.
-   Test journal chronology and date handling.
-   If finance ships, test decimal/currency formatting, monthly
    boundaries, and budget totals.

### 10.3 UI and accessibility

-   Test light, dark, and system themes.
-   Test narrow mobile widths and desktop layouts.
-   Check for horizontal overflow.
-   Test keyboard-only use.
-   Check visible focus and labels.
-   Test reduced motion.
-   Check contrast and empty/error states.
-   Confirm that switching Zen/Dō does not change the data.

### 10.4 Offline and network checks

-   Launch with the device offline.
-   Verify all core features work without a network connection.
-   Inspect the release for external scripts, styles, fonts, images,
    APIs, and runtime imports.
-   Confirm that ordinary app use does not transmit user data.

### 10.5 Browser support statement

Target desktop testing in current versions of:

-   Google Chrome
-   Microsoft Edge
-   Mozilla Firefox
-   Apple Safari

Mobile browsers are best-effort unless separately tested.

Do not claim universal compatibility. Publish the exact tested browsers
and any known limitations after running the tests against the actual
release HTML.

## 11. Build stages

### Stage 0 --- Verify the foundation

-   Create the storage proof-of-concept HTML.
-   Test save/reload/reopen and backup/restore.
-   Record results by browser.
-   Decide whether the required double-click workflow is viable.
-   Do not proceed as though storage is solved until this has been
    verified.

### Stage 1 --- App shell and design system

-   Create the standalone release path and developer source/build
    workflow.
-   Implement the navigation and responsive layout.
-   Implement theme tokens and light/dark/system modes.
-   Create Zen and Dō using mock data.
-   Verify mode switching does not create separate state.

### Stage 2 --- State, storage, and tasks

-   Finalize the schema.
-   Implement validation and migration boundaries.
-   Implement the centralized storage adapter.
-   Add task CRUD, projects, subtasks, and quick capture.
-   Add persistence status and error handling.
-   Add the first data-integrity tests.

### Stage 3 --- Calendar, habits, and goals

-   Add manual events and agenda.
-   Add habits and date-specific entries.
-   Add goals, milestones, and task relationships.
-   Test recurrence and date/time behavior.

### Stage 4 --- Backup and recovery

-   Add JSON export.
-   Add import validation, preview, and explicit restore confirmation.
-   Add malformed-data recovery paths.
-   Verify failed imports never overwrite valid data.

### Stage 5 --- Notes, journal, and optional finance

-   Add notes, pinning, and search.
-   Add journal entries.
-   Add manual finance tracking only if the core app is stable and the
    feature remains within scope.

### Stage 6 --- Polish and release

-   Refine empty, error, and confirmation states.
-   Audit accessibility and responsive behavior.
-   Run offline and network checks.
-   Test the actual generated `index.html` in supported browsers.
-   Write the README and limitations.
-   Package the release ZIP.
-   Publish only claims supported by test results.

## 12. Definition of done

The first release is ready only when all applicable items are true:

-   [ ] The released `index.html` launches by double-click without a
    server.
-   [ ] The runtime is self-contained and has no required network
    dependencies.
-   [ ] Zen and Dō show the same underlying data.
-   [ ] Core task flows work.
-   [ ] All shipped feature modules have documented, tested behavior.
-   [ ] Storage availability is detected and reported honestly.
-   [ ] Save failures do not produce false success messages.
-   [ ] Malformed or unsupported data is not silently discarded or
    overwritten.
-   [ ] Export and restore work with versioned JSON.
-   [ ] Failed imports preserve current valid data.
-   [ ] Theme and responsive behavior work in the tested environments.
-   [ ] Keyboard access, focus indicators, labels, contrast, and reduced
    motion have been checked.
-   [ ] Core workflows work offline.
-   [ ] Browser compatibility claims match actual test results.
-   [ ] README explains launch instructions, backup, storage
    limitations, and known issues.
-   [ ] Release ZIP contains the required files.
-   [ ] No user data, secrets, or machine-specific files are committed
    to the repository.

## 13. README requirements

The user-facing README should explain:

-   What Daylight is.
-   The difference between Zen and Dō.
-   How to download and extract a release.
-   How to open `index.html`.
-   How to export and restore data.
-   Where data is stored, to the extent that behavior has been verified.
-   The limitations of local-file browser storage.
-   That browser data clearing or profile changes may affect saved data.
-   That local data is not encrypted by default.
-   Tested browser versions and known limitations.
-   How to report bugs or contribute, if the repository accepts
    contributions.
-   License information.

Do not promise that data will always be portable across browsers,
browser profiles, or file locations.

## 14. Repository hygiene

-   Include a suitable open-source license only after choosing one
    intentionally.
-   Use `.gitignore` for generated temporary files, local test data, and
    editor artifacts.
-   Never commit real personal data, backup files, secrets, credentials,
    or machine-specific paths.
-   Keep generated release output reproducible.
-   Document how to build the standalone release for contributors.
-   Keep source code readable and avoid minifying the only available
    copy.

## 15. Decisions still to finalize

The following items require explicit decisions or verification:

1.  **Storage proof:** What persistence behavior is actually reliable in
    each target browser when opened from `file://`?
2.  **Final schema:** What exact fields and relationship rules does each
    record type use?
3.  **Recurrence rules:** Which habit recurrence patterns are supported
    in v1, and how are skipped or edited dates handled?
4.  **Calendar scope:** Is the first release agenda-only, or does it
    include a full month grid?
5.  **Finance scope:** Ship manual finance in v1 or defer it?
6.  **Deletion rules:** What happens to related subtasks, project links,
    milestones, and habit history when a parent record is deleted?
7.  **Import semantics:** Replacement is the default proposal; any merge
    behavior requires a separate conflict-resolution specification.
8.  **License:** Choose an appropriate license before public release.
9.  **Tested support matrix:** Publish only after testing the actual
    release artifact.

Do not block the initial storage proof-of-concept on decisions that are
not needed for that test. Do not start the full build before resolving
the fundamental storage feasibility question.

## 16. Non-negotiable engineering constraints

1.  The production app must launch by double-clicking `index.html`; no
    server, hosting, account, command line, or internet connection is
    required to use it.
2.  The release HTML must be self-contained.
3.  No external scripts, styles, fonts, images, APIs, runtime downloads,
    or file-dependent ES module imports.
4.  Zen and Dō use the same application logic and data.
5.  All persistence goes through a centralized storage adapter.
6.  Probe storage and handle unavailable storage, quota errors,
    malformed data, and migrations.
7.  Never claim a save succeeded when it did not.
8.  Never silently reset, replace, or discard data on load or import
    failure.
9.  Use a versioned schema, stable IDs, validation, JSON export, and
    restore.
10. No routine network activity, telemetry, analytics, or ads.
11. Do not claim universal compatibility; test the actual release HTML.
12. Test persistence, browser restart, file relocation, export, and
    restore.
13. Build incrementally and report test results honestly.
14. Keep source and documentation readable.
15. Do not commit user data, secrets, credentials, or machine-specific
    files.

------------------------------------------------------------------------

## Final implementation directive

Build Daylight as a dependable, calm, self-contained personal
dashboard---not as a cloud service. Preserve the double-click launch
requirement, but verify local-file persistence before committing to the
full implementation. If a browser limitation prevents the promised
experience, surface the limitation and revisit the requirement rather
than hiding it.

**Immediate next action:** create and test the tiny storage proof of
concept in the target desktop browsers. Then finalize the field-by-field
schema and screen-level interaction specification before implementing
the complete app.
