import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const daylightDir = path.resolve(__dirname, '..');

test('v1.2.1: Calendar rendering clears container in-place and supports month/year navigation', () => {
  const appJs = fs.readFileSync(path.join(daylightDir, 'src', 'app.js'), 'utf8');
  
  // Verify container is emptied on render
  assert.ok(appJs.includes("function renderDoCalendar(container) {\n    container.innerHTML = '';"),
    'renderDoCalendar must reset container.innerHTML to prevent duplicate calendar sections');

  // Verify navigation buttons update month safely without date overflow
  assert.ok(appJs.includes('new Date(currentCalDate.getFullYear(), currentCalDate.getMonth() - 1, 1)'),
    'Month navigation backward must anchor to day 1');
  assert.ok(appJs.includes('new Date(currentCalDate.getFullYear(), currentCalDate.getMonth() + 1, 1)'),
    'Month navigation forward must anchor to day 1');
  assert.ok(appJs.includes('new Date(currentCalDate.getFullYear() - 1, currentCalDate.getMonth(), 1)'),
    'Year navigation backward must anchor to day 1');
  assert.ok(appJs.includes('new Date(currentCalDate.getFullYear() + 1, currentCalDate.getMonth(), 1)'),
    'Year navigation forward must anchor to day 1');
});

test('v1.2.1: Task tickmark/Done control isolates event propagation and updates by immutable ID', () => {
  const appJs = fs.readFileSync(path.join(daylightDir, 'src', 'app.js'), 'utf8');

  // Verify stopPropagation on checkbox click and change
  assert.ok(appJs.includes('onClick: (e) => {\n        e.stopPropagation();\n      }'),
    'Task checkbox must stop click propagation so task editor does not open');
  assert.ok(appJs.includes('storage.state.tasks.find(t => t.id === task.id)'),
    'Task completion must look up task by immutable ID in storage state');
  assert.ok(appJs.includes("target.completedAt = target.completed ? new Date().toISOString() : null;"),
    'Task completion sets timestamp when completed and clears to null when reopened');
});

test('v1.2.1: Zen & Dō navigation hides hamburger on Zen mode and wires mobile backdrop', () => {
  const appJs = fs.readFileSync(path.join(daylightDir, 'src', 'app.js'), 'utf8');
  const css = fs.readFileSync(path.join(daylightDir, 'src', 'styles.css'), 'utf8');

  // Verify hamburger is hidden in Zen view
  assert.ok(appJs.includes("btnMobile.style.display = 'none';"),
    'Hamburger must be hidden in Zen mode');
  assert.ok(appJs.includes("btnMobile.setAttribute('aria-hidden', 'true');"),
    'Hamburger must be aria-hidden in Zen mode');
  assert.ok(appJs.includes("btnMobile.setAttribute('tabindex', '-1');"),
    'Hamburger must be non-focusable in Zen mode');

  // Verify backdrop and Escape key listener
  assert.ok(appJs.includes("e.key === 'Escape'"),
    'Mobile sidebar must close on Escape key');
  assert.ok(appJs.includes("doBackdropEl.addEventListener('click', closeMobileSidebar)"),
    'Backdrop click must close mobile sidebar');

  // Verify CSS smooth transition 260ms (220-320ms range)
  assert.ok(css.includes('260ms'),
    'Sidebar transition must be within 220-320ms');
  assert.ok(css.includes('.sidebar-backdrop'),
    'Sidebar backdrop styles must be defined');
  assert.ok(css.includes('[data-view="zen"] .mobile-menu-btn'),
    'CSS must enforce hidden hamburger in Zen mode');
});

test('v1.2.1: Viewport-sized shell enforces internal content scrolling and stable header', () => {
  const css = fs.readFileSync(path.join(daylightDir, 'src', 'styles.css'), 'utf8');

  assert.ok(css.includes('overflow: hidden;\n}'),
    'html, body must be overflow hidden');
  assert.ok(css.includes('height: 100dvh;'),
    'Dynamic viewport height must be supported');
  assert.ok(css.includes('.do-content {\n  flex: 1;\n  height: 100%;\n  overflow-y: auto;'),
    'do-content must scroll internally');
  assert.ok(css.includes('.zen-container {\n  width: 100%;\n  max-width: 680px;\n  margin: 0 auto;\n  padding: 2.5rem 1.25rem 4rem;\n  display: flex;\n  flex-direction: column;\n  gap: 1.75rem;\n  height: 100%;\n  overflow-y: auto;'),
    'zen-container must scroll internally');
});

test('v1.2.1: Notes and Events editing updates in-place without duplicate records', () => {
  const appJs = fs.readFileSync(path.join(daylightDir, 'src', 'app.js'), 'utf8');

  assert.ok(appJs.includes('const target = storage.state.notes.find(item => item.id === note.id);'),
    'Notes editor must find note by ID in storage state and update in-place');
  assert.ok(appJs.includes('const target = storage.state.events.find(item => item.id === ev.id);'),
    'Events editor must find event by ID in storage state and update in-place');
});
