/**
 * Daylight — Main Application Controller (Vanilla JS)
 * Zero external dependencies. Safe DOM APIs. Full Zen and Dō views.
 */

import { getLocalDateString, parseLocalDate, formatLocalDateReadable, addDays } from './dates.js';
import {
  SUPPORTED_CURRENCIES,
  getCurrencyConfig,
  decimalToMinorUnits,
  formatCurrency,
  minorUnitsToDecimalString,
  calculateFinanceSummary
} from './finance.js';
import {
  canSetParentTask,
  deleteTask,
  buildHierarchicalTaskList
} from './tasks.js';
import { calculateHabitStreak, getHabitRecentDays } from './habits.js';
import { calculateGoalProgress } from './goals.js';
import { StorageAdapter, STORAGE_KEY, getSafeLocalStorage } from './storage.js';
import { el, iconSvg, showModalDialog, ICONS } from './dom.js';
import {
  LIGHT_THEME_DEFAULT_ACCENT,
  DARK_THEME_DEFAULT_ACCENT,
  ACCENT_PRESETS,
  isValidHexColor,
  normalizeHexColor,
  generateAccentCssTokens,
  getReadableForeground
} from './color.js';
import { getTimeOfDayGreeting, getDailyZenMessage } from './greetings.js';

export function initDaylightApp(rootElement = (typeof document !== 'undefined' ? document.getElementById('app') : null), customStorage = undefined) {
  const backend = customStorage !== undefined ? customStorage : getSafeLocalStorage();
  const storage = new StorageAdapter(backend);
  const loadResult = storage.load();

  let currentView = storage.state.preferences.startupView || 'zen'; // 'zen' | 'do'
  let activeSection = storage.state.preferences.activeSection || 'today';
  let taskFilter = 'all'; // 'all' | 'today' | 'upcoming' | 'high' | 'completed'
  let noteSearchQuery = '';
  let activeFinanceMonth = getLocalDateString().slice(0, 7);

  function generateId(prefix = 'item') {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  }

  function announce(message) {
    const announcer = document.getElementById('liveAnnouncer');
    if (announcer) announcer.textContent = message;
  }

  function resolveActiveTheme(themeChoice = storage.state.preferences.theme) {
    if (themeChoice === 'dark') return 'dark';
    if (themeChoice === 'light') return 'light';
    const prefersDark = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    return prefersDark ? 'dark' : 'light';
  }

  function applyAccentTokens(customAccent, resolvedTheme) {
    if (typeof document === 'undefined') return;
    const tokens = generateAccentCssTokens(customAccent, resolvedTheme);
    for (const [prop, val] of Object.entries(tokens)) {
      document.documentElement.style.setProperty(prop, val);
    }
  }

  function applyTheme(themeChoice) {
    if (themeChoice) {
      storage.state.preferences.theme = themeChoice;
    }
    const currentChoice = storage.state.preferences.theme || 'system';
    const resolved = resolveActiveTheme(currentChoice);

    if (typeof document !== 'undefined') {
      if (resolved === 'dark') {
        document.documentElement.setAttribute('data-theme', 'dark');
      } else {
        document.documentElement.removeAttribute('data-theme');
      }
      applyAccentTokens(storage.state.preferences.accentColor, resolved);
    }
  }

  // Setup system color scheme change listener
  if (typeof window !== 'undefined' && window.matchMedia) {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleSystemThemeChange = () => {
      if (storage.state.preferences.theme === 'system') {
        applyTheme('system');
        // If settings view is rendered, refresh preview and inputs if accent is default
        if (currentView === 'do' && activeSection === 'settings') {
          renderDoView();
        }
      }
    };
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleSystemThemeChange);
    } else if (mediaQuery.addListener) {
      mediaQuery.addListener(handleSystemThemeChange);
    }
  }

  function persist(candidateState) {
    const res = storage.save(candidateState || storage.state);
    updateStorageStatusUI();
    if (!res.success) {
      announce('Warning: Unable to save changes to persistent storage.');
    }
    return res;
  }

  function updateStorageStatusUI() {
    const badge = document.getElementById('storageBadge');
    const badgeText = document.getElementById('storageBadgeText');
    const banner = document.getElementById('storageBanner');
    const recoveryBox = document.getElementById('recoveryContainer');

    if (!badge || !badgeText || !banner || !recoveryBox) return;

    if (storage.status === 'persistent') {
      badge.className = 'storage-indicator storage-persistent';
      badgeText.textContent = 'Saved';
      banner.style.display = 'none';
      recoveryBox.style.display = 'none';
    } else if (storage.status === 'memory') {
      badge.className = 'storage-indicator storage-memory';
      badgeText.textContent = 'Memory Only';
      banner.style.display = 'flex';
      recoveryBox.style.display = 'none';
    } else if (storage.status === 'write_error') {
      badge.className = 'storage-indicator storage-error';
      badgeText.textContent = 'Save Failed';
      banner.style.display = 'flex';
      recoveryBox.style.display = 'none';
    } else if (storage.status === 'recovery') {
      badge.className = 'storage-indicator storage-error';
      badgeText.textContent = 'Corrupt Data';
      banner.style.display = 'none';
      recoveryBox.style.display = 'flex';
    }
  }

  function exportBackup() {
    const jsonStr = storage.exportSnapshot();
    const filename = `daylight-backup-${getLocalDateString()}.json`;
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = el('a', { href: url, download: filename });
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    announce('Backup exported successfully.');
  }

  function exportRawRecovery() {
    const raw = storage.exportRawRecoveryData();
    if (!raw) {
      alert('No raw corrupted data found.');
      return;
    }
    const blob = new Blob([raw], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = el('a', { href: url, download: `daylight-recovery-payload-${getLocalDateString()}.txt` });
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // Transactional restore flow
  function handleFileRestore(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target.result;
        // Parse candidate for preview
        const parsed = JSON.parse(content);
        if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.tasks)) {
          alert('Invalid Daylight backup format.');
          return;
        }

        // Preview modal
        showModalDialog({
          title: 'Confirm Backup Restore',
          renderBody: (body) => {
            body.appendChild(el('p', { style: 'font-size: 0.9rem; margin-bottom: 0.75rem;' },
              `A valid Daylight backup (Schema v${parsed.schemaVersion || 1}) was verified:`
            ));
            const list = el('ul', { style: 'font-size: 0.85rem; color: var(--text-muted); line-height: 1.6; padding-left: 1.25rem;' },
              el('li', {}, `Tasks: ${parsed.tasks ? parsed.tasks.length : 0}`),
              el('li', {}, `Projects: ${parsed.projects ? parsed.projects.length : 0}`),
              el('li', {}, `Events: ${parsed.events ? parsed.events.length : 0}`),
              el('li', {}, `Habits: ${parsed.habits ? parsed.habits.length : 0}`),
              el('li', {}, `Goals: ${parsed.goals ? parsed.goals.length : 0}`),
              el('li', {}, `Notes: ${parsed.notes ? parsed.notes.length : 0}`),
              el('li', {}, `Journal Entries: ${parsed.journalEntries ? parsed.journalEntries.length : 0}`),
              el('li', {}, `Transactions: ${parsed.transactions ? parsed.transactions.length : 0}`)
            );
            body.appendChild(list);
            body.appendChild(el('p', { style: 'font-size: 0.85rem; color: var(--warning); margin-top: 0.75rem; font-weight: 500;' },
              'Restoring will completely replace your current dataset. Changes will be committed to storage first.'
            ));
          },
          confirmText: 'Restore & Replace Data',
          onConfirm: () => {
            const res = storage.restore(content);
            if (!res.success) {
              alert(`Restore failed: ${res.error}`);
              return false;
            }
            renderApp();
            announce('Backup restored successfully.');
            alert('Backup restored successfully!');
            return true;
          }
        });
      } catch (err) {
        alert(`Failed to parse backup JSON: ${err.message}`);
      }
    };
    reader.readAsText(file);
  }

  // Transactional reset flow
  function handleResetAll() {
    showModalDialog({
      title: 'Reset All Daylight Data',
      isDanger: true,
      renderBody: (body) => {
        body.appendChild(el('p', { style: 'font-size: 0.9rem; color: var(--danger); font-weight: 600;' },
          'Warning: This permanently wipes all tasks, projects, events, habits, goals, notes, journal entries, and financial records!'
        ));
        body.appendChild(el('p', { style: 'font-size: 0.85rem; color: var(--text-muted); margin-top: 0.5rem;' },
          'A backup will be downloaded first before any records are cleared.'
        ));
      },
      confirmText: 'Export Backup & Wipe All Data',
      onConfirm: () => {
        exportBackup();
        const res = storage.reset();
        if (!res.success) {
          alert(`Reset failed: ${res.error}`);
          return false;
        }
        renderApp();
        announce('All data has been reset.');
        return true;
      }
    });
  }

  // -------------------------------------------------------------
  // RENDERING ENGINE
  // -------------------------------------------------------------

  function renderZenView() {
    const todayStr = getLocalDateString();
    const container = document.getElementById('viewZen');
    if (!container) return;
    container.innerHTML = '';

    // Header
    const now = new Date();
    const greeting = getTimeOfDayGreeting(now.getHours());
    const subGreeting = getDailyZenMessage(todayStr);

    const header = el('div', { className: 'zen-header' },
      el('div', { className: 'zen-date' }, formatLocalDateReadable(todayStr, { weekday: 'long' })),
      el('h1', { className: 'zen-greeting' }, greeting),
      el('p', { className: 'zen-subgreeting' }, subGreeting)
    );

    // Quick capture
    const quickInput = el('input', {
      type: 'text',
      className: 'quick-capture-input',
      placeholder: 'Quick capture a task or note... (Press Enter to add task)'
    });

    const addQuickTask = () => {
      const val = quickInput.value.trim();
      if (!val) return;
      storage.state.tasks.push({
        id: generateId('task'),
        title: val,
        description: '',
        completed: false,
        completedAt: null,
        dueDate: todayStr,
        priority: 'normal',
        projectId: null,
        parentId: null,
        isTopPriority: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      quickInput.value = '';
      persist();
      renderApp();
    };

    const addQuickNote = () => {
      const val = quickInput.value.trim();
      if (!val) return;
      storage.state.notes.push({
        id: generateId('note'),
        title: '',
        body: val,
        pinned: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      quickInput.value = '';
      persist();
      renderApp();
    };

    quickInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') addQuickTask();
    });

    const quickCaptureBox = el('div', { className: 'quick-capture-box' },
      quickInput,
      el('button', { className: 'btn btn-primary btn-sm', onClick: addQuickTask }, 'Add Task'),
      el('button', { className: 'btn btn-sm', onClick: addQuickNote }, 'Add Note')
    );

    // Top Priorities Card
    const topPriorities = storage.state.tasks.filter(t => t.isTopPriority).slice(0, 3);
    const priListEl = el('div', { className: 'priority-list' });

    if (topPriorities.length === 0) {
      priListEl.appendChild(el('div', { style: 'font-size: 0.85rem; color: var(--text-muted); padding: 0.5rem 0;' },
        'No top priorities selected for today. Tap Manage to pick up to three.'
      ));
    } else {
      topPriorities.forEach(t => {
        const chk = el('input', {
          type: 'checkbox',
          className: 'task-checkbox',
          checked: t.completed,
          'aria-label': `Complete priority task ${t.title}`,
          onClick: (e) => e.stopPropagation(),
          onChange: (e) => {
            e.stopPropagation();
            const target = storage.state.tasks.find(x => x.id === t.id);
            if (!target) return;
            target.completed = Boolean(e.target.checked);
            target.completedAt = target.completed ? new Date().toISOString() : null;
            target.updatedAt = new Date().toISOString();
            const res = persist();
            if (res && res.success) {
              announce(`Task ${target.title} marked as ${target.completed ? 'completed' : 'incomplete'}`);
            }
            renderApp();
          }
        });
        const tag = el('span', { className: `tag tag-priority-${t.priority || 'normal'}` }, t.priority || 'normal');
        const row = el('div', { className: `task-item ${t.completed ? 'completed' : ''}` },
          chk,
          el('div', { className: 'task-body' }, el('div', { className: 'task-title' }, t.title)),
          tag
        );
        priListEl.appendChild(row);
      });
    }

    const prioritiesCard = el('div', { className: 'zen-card' },
      el('div', { className: 'zen-card-header' },
        el('h2', { className: 'zen-card-title' },
          iconSvg('<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>', 'icon icon-sm'),
          "Today's Top Priorities (Max 3)"
        ),
        el('button', { className: 'btn btn-sm btn-subtle', onClick: () => openPriorityManagerModal() }, 'Manage')
      ),
      priListEl
    );

    // Upcoming Event Card
    const upcomingEvents = storage.state.events
      .filter(e => e.date >= todayStr)
      .sort((a, b) => a.date.localeCompare(b.date) || (a.startTime || '').localeCompare(b.startTime || ''));

    const nextEventBody = el('div', {});
    if (upcomingEvents.length === 0) {
      nextEventBody.appendChild(el('div', { style: 'font-size: 0.85rem; color: var(--text-muted); padding: 0.4rem 0;' },
        'Your calendar is quiet for today.'
      ));
    } else {
      const ev = upcomingEvents[0];
      const timeStr = ev.isAllDay ? 'All day' : `${ev.startTime || ''}${ev.endTime ? ' - ' + ev.endTime : ''}`;
      nextEventBody.appendChild(el('div', { style: 'display: flex; align-items: center; justify-content: space-between;' },
        el('div', {},
          el('div', { style: 'font-size: 0.95rem; font-weight: 600;' }, ev.title),
          el('div', { style: 'font-size: 0.8rem; color: var(--text-muted);' }, `${formatLocalDateReadable(ev.date)} · ${timeStr}`)
        ),
        el('span', { className: 'tag' }, ev.date === todayStr ? 'Today' : 'Upcoming')
      ));
    }

    const eventCard = el('div', { className: 'zen-card' },
      el('div', { className: 'zen-card-header' },
        el('h2', { className: 'zen-card-title' },
          iconSvg('<rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line>', 'icon icon-sm'),
          'Upcoming Agenda'
        ),
        el('button', { className: 'btn btn-sm btn-subtle', onClick: () => openEventModal() }, '+ Event')
      ),
      nextEventBody
    );

    // Today's Habits Card
    const todayDow = now.getDay();
    const scheduledHabits = storage.state.habits.filter(h => {
      if (h.status !== 'active') return false;
      const days = h.scheduledDays || [0, 1, 2, 3, 4, 5, 6];
      return days.includes(todayDow);
    });

    const habitListEl = el('div', { className: 'priority-list' });
    if (scheduledHabits.length === 0) {
      habitListEl.appendChild(el('div', { style: 'font-size: 0.85rem; color: var(--text-muted); padding: 0.4rem 0;' },
        'No habits scheduled for today.'
      ));
    } else {
      scheduledHabits.forEach(h => {
        const entry = storage.state.habitEntries.find(e => e.habitId === h.id && e.date === todayStr);
        const isDone = !!(entry && entry.completed);
        const streak = calculateHabitStreak(h, storage.state.habitEntries, todayStr);

        const chk = el('input', {
          type: 'checkbox',
          className: 'task-checkbox',
          checked: isDone,
          'aria-label': `Toggle habit ${h.name}`,
          onChange: (e) => {
            if (entry) {
              entry.completed = e.target.checked;
              entry.completedAt = entry.completed ? new Date().toISOString() : null;
            } else {
              storage.state.habitEntries.push({
                id: generateId('he'),
                habitId: h.id,
                date: todayStr,
                completed: e.target.checked,
                completedAt: new Date().toISOString()
              });
            }
            persist();
            renderApp();
          }
        });

        const row = el('div', { className: `task-item ${isDone ? 'completed' : ''}` },
          chk,
          el('div', { className: 'task-body' }, el('div', { className: 'task-title' }, h.name)),
          el('span', { className: 'tag', style: 'color: var(--accent); font-weight: 600; display: inline-flex; align-items: center; gap: 4px;' },
            iconSvg(ICONS.flame, 'icon icon-sm'),
            `${streak} ${streak === 1 ? 'day' : 'days'}`
          )
        );
        habitListEl.appendChild(row);
      });
    }

    const habitsCard = el('div', { className: 'zen-card' },
      el('div', { className: 'zen-card-header' },
        el('h2', { className: 'zen-card-title' },
          iconSvg('<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline>', 'icon icon-sm'),
          "Today's Habits"
        ),
        el('button', { className: 'btn btn-sm btn-subtle', onClick: () => { switchView('do'); switchDoSection('habits'); } }, 'View All')
      ),
      habitListEl
    );

    // Today's Tasks Card
    const todayTasks = storage.state.tasks.filter(t => t.dueDate === todayStr || (!t.dueDate && !t.completed));
    const tasksListEl = el('div', {});
    if (todayTasks.length === 0) {
      tasksListEl.appendChild(el('div', { style: 'font-size: 0.85rem; color: var(--text-muted); padding: 0.5rem 0;' },
        'All clear! No tasks due today.'
      ));
    } else {
      todayTasks.slice(0, 5).forEach(t => {
        tasksListEl.appendChild(renderTaskItem(t, 0));
      });
    }

    const tasksCard = el('div', { className: 'zen-card' },
      el('div', { className: 'zen-card-header' },
        el('h2', { className: 'zen-card-title' },
          iconSvg('<line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line>', 'icon icon-sm'),
          "Today's Tasks"
        ),
        el('button', { className: 'btn btn-sm btn-subtle', onClick: () => openTaskModal() }, '+ New Task')
      ),
      tasksListEl
    );

    container.appendChild(header);
    container.appendChild(quickCaptureBox);
    container.appendChild(prioritiesCard);
    container.appendChild(eventCard);
    container.appendChild(habitsCard);
    container.appendChild(tasksCard);
  }

  // -------------------------------------------------------------
  // TASK ITEM RENDERER (Safe DOM, Recursive Subtasks)
  // -------------------------------------------------------------
  function renderTaskItem(task, depth = 0) {
    const project = storage.state.projects.find(p => p.id === task.projectId);

    const chk = el('input', {
      type: 'checkbox',
      className: 'task-checkbox',
      checked: Boolean(task.completed),
      'aria-label': `Toggle task ${task.title}`,
      onClick: (e) => {
        e.stopPropagation();
      },
      onChange: (e) => {
        e.stopPropagation();
        const target = storage.state.tasks.find(t => t.id === task.id);
        if (!target) return;
        target.completed = Boolean(e.target.checked);
        target.completedAt = target.completed ? new Date().toISOString() : null;
        target.updatedAt = new Date().toISOString();
        const res = persist();
        if (res && res.success) {
          announce(`Task ${target.title} marked as ${target.completed ? 'completed' : 'incomplete'}`);
        }
        renderApp();
      }
    });

    const editBtn = el('button', {
      className: 'btn-icon btn-sm',
      title: 'Edit task',
      'aria-label': `Edit task ${task.title}`,
      onClick: (e) => {
        e.stopPropagation();
        openTaskModal(task, e.currentTarget);
      }
    }, iconSvg('<path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>', 'icon icon-sm'));

    const delBtn = el('button', {
      className: 'btn-icon btn-sm',
      title: 'Delete task',
      'aria-label': `Delete task ${task.title}`,
      onClick: (e) => {
        e.stopPropagation();
        confirmDeleteTask(task);
      }
    }, iconSvg('<polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>', 'icon icon-sm'));

    const tagsContainer = el('div', { className: 'task-tags' });
    if (task.dueDate) {
      tagsContainer.appendChild(el('span', { className: 'tag', style: 'display: inline-flex; align-items: center; gap: 4px;' },
        iconSvg(ICONS.calendar, 'icon icon-sm'),
        formatLocalDateReadable(task.dueDate)
      ));
    }
    if (task.priority) {
      tagsContainer.appendChild(el('span', { className: `tag tag-priority-${task.priority}` }, task.priority));
    }
    if (project) {
      tagsContainer.appendChild(el('span', { className: 'tag', style: 'display: inline-flex; align-items: center; gap: 4px;' },
        iconSvg(ICONS.folder, 'icon icon-sm'),
        project.name
      ));
    }
    if (task.isTopPriority) {
      tagsContainer.appendChild(el('span', { className: 'tag', style: 'background: var(--warning-soft); color: var(--warning);' }, '★ Priority'));
    }
    if (depth > 0) {
      tagsContainer.appendChild(el('span', { className: 'tag', style: 'color: var(--text-subtle);' }, `Subtask (L${depth})`));
    }

    const titleEl = el('span', {
      className: 'task-title',
      style: 'cursor: pointer;',
      onClick: (e) => {
        e.stopPropagation();
        openTaskModal(task, e.currentTarget);
      }
    }, task.title);

    const bodyEl = el('div', { className: 'task-body' },
      el('div', { style: 'display: flex; align-items: baseline; justify-content: space-between; gap: 0.5rem;' },
        titleEl,
        el('div', { style: 'display: flex; gap: 4px;' }, editBtn, delBtn)
      ),
      task.description ? el('div', { className: 'task-desc' }, task.description) : null,
      tagsContainer
    );

    const marginLeft = depth > 0 ? `${depth * 1.5}rem` : '0';

    return el('div', {
      className: `task-item ${task.completed ? 'completed' : ''} ${depth > 0 ? 'task-nested' : ''}`,
      style: `margin-left: ${marginLeft};`
    }, chk, bodyEl);
  }
  // -------------------------------------------------------------
  function renderDoView() {
    const todayStr = getLocalDateString();
    const pendingToday = storage.state.tasks.filter(t => !t.completed && (t.dueDate === todayStr || (!t.dueDate && t.isTopPriority)));
    const totalPending = storage.state.tasks.filter(t => !t.completed);
    const activeProjects = storage.state.projects.filter(p => !p.archived);
    const activeHabits = storage.state.habits.filter(h => h.status === 'active');

    // Update badges
    const badgeToday = document.getElementById('navBadgeToday');
    const badgeTasks = document.getElementById('navBadgeTasks');
    const badgeProjects = document.getElementById('navBadgeProjects');
    const badgeHabits = document.getElementById('navBadgeHabits');
    if (badgeToday) badgeToday.textContent = pendingToday.length;
    if (badgeTasks) badgeTasks.textContent = totalPending.length;
    if (badgeProjects) badgeProjects.textContent = activeProjects.length;
    if (badgeHabits) badgeHabits.textContent = activeHabits.length;

    // Highlight active nav item
    document.querySelectorAll('#doSidebar .nav-item').forEach(btn => {
      if (btn.getAttribute('data-section') === activeSection) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    const contentArea = document.getElementById('doContent');
    if (!contentArea) return;
    contentArea.innerHTML = '';

    if (activeSection === 'today') renderDoToday(contentArea);
    else if (activeSection === 'tasks') renderDoTasks(contentArea);
    else if (activeSection === 'projects') renderDoProjects(contentArea);
    else if (activeSection === 'calendar') renderDoCalendar(contentArea);
    else if (activeSection === 'habits') renderDoHabits(contentArea);
    else if (activeSection === 'goals') renderDoGoals(contentArea);
    else if (activeSection === 'notes') renderDoNotes(contentArea);
    else if (activeSection === 'journal') renderDoJournal(contentArea);
    else if (activeSection === 'finance') renderDoFinance(contentArea);
    else if (activeSection === 'settings') renderDoSettings(contentArea);
  }

  // 1. TODAY
  function renderDoToday(container) {
    const todayStr = getLocalDateString();
    const pendingToday = storage.state.tasks.filter(t => !t.completed && (t.dueDate === todayStr || (!t.dueDate && t.isTopPriority)));
    const completedToday = storage.state.tasks.filter(t => t.completed && (t.completedAt || '').startsWith(todayStr));

    const header = el('div', { className: 'section-header' },
      el('div', {},
        el('h2', { className: 'section-title' }, "Today's Focus"),
        el('p', { className: 'section-subtitle' }, `${formatLocalDateReadable(todayStr, { weekday: 'long' })} · Priorities and daily execution`)
      ),
      el('button', { className: 'btn btn-primary', onClick: () => openTaskModal() }, '+ New Task')
    );

    // Priorities card
    const priContainer = el('div', { className: 'priority-list' });
    const priorities = storage.state.tasks.filter(t => t.isTopPriority).slice(0, 3);
    if (priorities.length === 0) {
      priContainer.appendChild(el('div', { style: 'font-size: 0.85rem; color: var(--text-muted);' }, 'No top priorities designated. Tap Select Top 3 to choose.'));
    } else {
      priorities.forEach(t => {
        const chk = el('input', {
          type: 'checkbox',
          className: 'task-checkbox',
          checked: t.completed,
          onClick: (e) => e.stopPropagation(),
          onChange: (e) => {
            e.stopPropagation();
            const target = storage.state.tasks.find(x => x.id === t.id);
            if (!target) return;
            target.completed = Boolean(e.target.checked);
            target.completedAt = target.completed ? new Date().toISOString() : null;
            target.updatedAt = new Date().toISOString();
            const res = persist();
            if (res && res.success) {
              announce(`Task ${target.title} marked as ${target.completed ? 'completed' : 'incomplete'}`);
            }
            renderApp();
          }
        });
        priContainer.appendChild(el('div', { className: `task-item ${t.completed ? 'completed' : ''}` },
          chk,
          el('div', { className: 'task-body' }, el('div', { className: 'task-title' }, t.title)),
          el('span', { className: `tag tag-priority-${t.priority || 'normal'}` }, t.priority || 'normal')
        ));
      });
    }

    const priCard = el('div', { className: 'card' },
      el('div', { style: 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.85rem;' },
        el('h3', { style: 'font-size: 0.95rem; font-weight: 600;' }, 'Top Priorities'),
        el('button', { className: 'btn btn-sm btn-subtle', onClick: () => openPriorityManagerModal() }, 'Select Top 3')
      ),
      priContainer
    );

    // Next event card
    const upcoming = storage.state.events.filter(e => e.date >= todayStr).sort((a,b) => a.date.localeCompare(b.date));
    const evCardContent = el('div', {});
    if (upcoming.length === 0) {
      evCardContent.appendChild(el('div', { style: 'font-size: 0.85rem; color: var(--text-muted);' }, 'No upcoming events scheduled.'));
    } else {
      const ev = upcoming[0];
      evCardContent.appendChild(el('div', { style: 'display: flex; justify-content: space-between; align-items: center;' },
        el('div', {},
          el('div', { style: 'font-weight: 600;' }, ev.title),
          el('div', { style: 'font-size: 0.8rem; color: var(--text-muted);' }, `${formatLocalDateReadable(ev.date)} · ${ev.isAllDay ? 'All Day' : (ev.startTime || '')}`)
        ),
        el('span', { className: 'tag' }, ev.date === todayStr ? 'Today' : 'Upcoming')
      ));
    }

    const nextEvCard = el('div', { className: 'card' },
      el('div', { style: 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.85rem;' },
        el('h3', { style: 'font-size: 0.95rem; font-weight: 600;' }, 'Next Agenda Item'),
        el('button', { className: 'btn btn-sm btn-subtle', onClick: () => openEventModal() }, '+ Add Event')
      ),
      evCardContent
    );

    const grid = el('div', { className: 'grid-2', style: 'margin-bottom: 1.5rem;' }, priCard, nextEvCard);

    // Tasks list card
    const tasksContainer = el('div', {});
    if (pendingToday.length === 0 && completedToday.length === 0) {
      tasksContainer.appendChild(el('div', { className: 'empty-state' },
        el('div', { className: 'empty-state-title' }, 'No tasks due today'),
        el('p', { className: 'empty-state-text' }, 'Enjoy the calm or create a new task to get started.')
      ));
    } else {
      pendingToday.forEach(t => tasksContainer.appendChild(renderTaskItem(t, 0)));
      if (completedToday.length > 0) {
        tasksContainer.appendChild(el('h4', { style: 'font-size: 0.85rem; font-weight: 600; color: var(--text-muted); margin: 1rem 0 0.5rem;' },
          `Completed Today (${completedToday.length})`
        ));
        completedToday.forEach(t => tasksContainer.appendChild(renderTaskItem(t, 0)));
      }
    }

    const tasksCard = el('div', { className: 'card' },
      el('h3', { style: 'font-size: 1rem; font-weight: 600; margin-bottom: 1rem;' }, `Tasks Due Today (${pendingToday.length})`),
      tasksContainer
    );

    container.appendChild(header);
    container.appendChild(grid);
    container.appendChild(tasksCard);
  }

  // 2. TASKS (Recursive Tree & Filters)
  function renderDoTasks(container) {
    const todayStr = getLocalDateString();

    const header = el('div', { className: 'section-header' },
      el('div', {},
        el('h2', { className: 'section-title' }, 'Tasks'),
        el('p', { className: 'section-subtitle' }, 'Organize daily actions, recursive subtasks, and deadlines')
      ),
      el('button', { className: 'btn btn-primary', onClick: () => openTaskModal() }, '+ New Task')
    );

    // Filters
    const filterBtns = ['all', 'today', 'upcoming', 'high', 'completed'].map(f => {
      return el('button', {
        className: `btn btn-sm btn-subtle ${taskFilter === f ? 'btn-primary' : ''}`,
        onClick: () => {
          taskFilter = f;
          renderDoView();
        }
      }, f.charAt(0).toUpperCase() + f.slice(1));
    });

    const filterBar = el('div', { style: 'display: flex; gap: 4px; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-md); padding: 3px; margin-bottom: 1.25rem;' },
      ...filterBtns
    );

    const listContainer = el('div', {});
    const hierarchicalTasks = buildHierarchicalTaskList(storage.state.tasks, taskFilter, todayStr);

    if (hierarchicalTasks.length === 0) {
      listContainer.appendChild(el('div', { className: 'empty-state' },
        el('div', { className: 'empty-state-title' }, 'No tasks found'),
        el('p', { className: 'empty-state-text' }, 'No tasks match the selected filter.'),
        el('button', { className: 'btn btn-primary', onClick: () => openTaskModal() }, '+ Create Task')
      ));
    } else {
      hierarchicalTasks.forEach(t => {
        listContainer.appendChild(renderTaskItem(t, t.depth || 0));
      });
    }

    container.appendChild(header);
    container.appendChild(filterBar);
    container.appendChild(listContainer);
  }

  // Task Modal (Add/Edit)
  function openTaskModal(task = null, triggerEl = null) {
    const isEdit = !!task;
    showModalDialog({
      title: isEdit ? 'Edit Task' : 'New Task',
      confirmText: isEdit ? 'Save Changes' : 'Create Task',
      triggerElement: triggerEl,
      renderBody: (body) => {
        const titleInput = el('input', {
          type: 'text',
          className: 'form-input',
          value: isEdit ? task.title : '',
          placeholder: 'What needs to be done?',
          required: true
        });
        const descInput = el('textarea', {
          className: 'form-textarea',
          rows: 2,
          placeholder: 'Optional details...'
        }, isEdit ? (task.description || '') : '');

        const dueDateInput = el('input', {
          type: 'date',
          className: 'form-input',
          value: isEdit && task.dueDate ? task.dueDate : ''
        });

        const prioritySelect = el('select', { className: 'form-select' },
          el('option', { value: 'normal' }, 'Normal'),
          el('option', { value: 'low' }, 'Low'),
          el('option', { value: 'high' }, 'High')
        );
        if (isEdit && task.priority) prioritySelect.value = task.priority;

        const projectSelect = el('select', { className: 'form-select' },
          el('option', { value: '' }, '(None)'),
          ...storage.state.projects.filter(p => !p.archived).map(p =>
            el('option', { value: p.id }, p.name)
          )
        );
        if (isEdit && task.projectId) projectSelect.value = task.projectId;

        // Parent task options (filter out invalid ancestors to prevent cycle in UI)
        const parentCandidates = storage.state.tasks.filter(t => {
          if (!isEdit) return true;
          return t.id !== task.id && canSetParentTask(task.id, t.id, storage.state.tasks);
        });

        const parentSelect = el('select', { className: 'form-select' },
          el('option', { value: '' }, '(None - Top Level)'),
          ...parentCandidates.map(t => el('option', { value: t.id }, t.title))
        );
        if (isEdit && task.parentId) parentSelect.value = task.parentId;

        const topPriCheckbox = el('input', {
          type: 'checkbox',
          className: 'task-checkbox',
          checked: isEdit ? Boolean(task.isTopPriority) : false
        });

        body.appendChild(el('div', { className: 'form-group' },
          el('label', { className: 'form-label' }, 'Task Title *'),
          titleInput
        ));
        body.appendChild(el('div', { className: 'form-group' },
          el('label', { className: 'form-label' }, 'Description'),
          descInput
        ));
        body.appendChild(el('div', { className: 'form-row' },
          el('div', { className: 'form-group' }, el('label', { className: 'form-label' }, 'Due Date'), dueDateInput),
          el('div', { className: 'form-group' }, el('label', { className: 'form-label' }, 'Priority'), prioritySelect)
        ));
        body.appendChild(el('div', { className: 'form-row' },
          el('div', { className: 'form-group' }, el('label', { className: 'form-label' }, 'Project'), projectSelect),
          el('div', { className: 'form-group' }, el('label', { className: 'form-label' }, 'Parent Task (Subtask)'), parentSelect)
        ));
        body.appendChild(el('label', { style: 'display: flex; align-items: center; gap: 8px; margin-top: 0.5rem; font-size: 0.85rem; cursor: pointer;' },
          topPriCheckbox,
          'Flag as one of today\'s Top Priorities (Max 3)'
        ));

        body._data = { titleInput, descInput, dueDateInput, prioritySelect, projectSelect, parentSelect, topPriCheckbox };
      },
      onConfirm: (body) => {
        const { titleInput, descInput, dueDateInput, prioritySelect, projectSelect, parentSelect, topPriCheckbox } = body._data;
        const title = titleInput.value.trim();
        if (!title) {
          alert('Task title is required.');
          titleInput.focus();
          return false;
        }

        const parentId = parentSelect.value || null;
        if (isEdit && parentId) {
          if (!canSetParentTask(task.id, parentId, storage.state.tasks)) {
            alert('Cannot set parent: would create a circular subtask cycle.');
            return false;
          }
        }

        if (isEdit) {
          task.title = title;
          task.description = descInput.value.trim();
          task.dueDate = dueDateInput.value || null;
          task.priority = prioritySelect.value;
          task.projectId = projectSelect.value || null;
          task.parentId = parentId;
          task.isTopPriority = topPriCheckbox.checked;
          task.updatedAt = new Date().toISOString();
        } else {
          storage.state.tasks.push({
            id: generateId('task'),
            title,
            description: descInput.value.trim(),
            completed: false,
            completedAt: null,
            dueDate: dueDateInput.value || null,
            priority: prioritySelect.value,
            projectId: projectSelect.value || null,
            parentId,
            isTopPriority: topPriCheckbox.checked,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          });
        }

        persist();
        renderApp();
        return true;
      }
    });
  }

  function confirmDeleteTask(task) {
    const subtasks = storage.state.tasks.filter(t => t.parentId === task.id);
    if (subtasks.length > 0) {
      showModalDialog({
        title: 'Delete Task with Subtasks',
        isDanger: true,
        confirmText: 'Confirm Deletion',
        renderBody: (body) => {
          body.appendChild(el('p', { style: 'font-size: 0.9rem; margin-bottom: 0.75rem;' },
            `Task "${task.title}" has ${subtasks.length} subtask(s). How should they be handled?`
          ));
          const optKeep = el('input', { type: 'radio', name: 'delSubOpt', value: 'keep', checked: true });
          const optDel = el('input', { type: 'radio', name: 'delSubOpt', value: 'delete' });

          body.appendChild(el('div', { className: 'form-group' },
            el('label', { style: 'display: flex; align-items: center; gap: 8px; font-size: 0.85rem; cursor: pointer;' },
              optKeep, 'Keep subtasks as independent standalone tasks'
            ),
            el('label', { style: 'display: flex; align-items: center; gap: 8px; font-size: 0.85rem; cursor: pointer; margin-top: 6px;' },
              optDel, 'Delete all descendant subtasks too'
            )
          ));
          body._optDel = optDel;
        },
        onConfirm: (body) => {
          const deleteSubtasks = body._optDel.checked;
          storage.state.tasks = deleteTask(task.id, deleteSubtasks, storage.state.tasks);
          persist();
          renderApp();
        }
      });
    } else {
      showModalDialog({
        title: 'Delete Task',
        isDanger: true,
        confirmText: 'Delete',
        renderBody: (body) => {
          body.appendChild(el('p', { style: 'font-size: 0.9rem;' }, `Are you sure you want to delete "${task.title}"?`));
        },
        onConfirm: () => {
          storage.state.tasks = storage.state.tasks.filter(t => t.id !== task.id);
          persist();
          renderApp();
        }
      });
    }
  }

  // 3. PROJECTS
  function renderDoProjects(container) {
    const activeProjects = storage.state.projects.filter(p => !p.archived);
    const archivedProjects = storage.state.projects.filter(p => p.archived);

    const header = el('div', { className: 'section-header' },
      el('div', {},
        el('h2', { className: 'section-title' }, 'Projects'),
        el('p', { className: 'section-subtitle' }, 'Group tasks into outcomes with derived completed task progress')
      ),
      el('button', { className: 'btn btn-primary', onClick: () => openProjectModal() }, '+ New Project')
    );

    const activeList = el('div', { className: 'grid-2', style: 'margin-bottom: 2rem;' });
    if (activeProjects.length === 0) {
      activeList.appendChild(el('div', { className: 'empty-state', style: 'grid-column: 1 / -1;' },
        el('div', { className: 'empty-state-title' }, 'No active projects'),
        el('p', { className: 'empty-state-text' }, 'Create a project to organize related tasks and track progress.'),
        el('button', { className: 'btn btn-primary', onClick: () => openProjectModal() }, '+ Create Project')
      ));
    } else {
      activeProjects.forEach(p => activeList.appendChild(renderProjectCard(p, false)));
    }

    container.appendChild(header);
    container.appendChild(activeList);

    if (archivedProjects.length > 0) {
      const archList = el('div', { className: 'grid-2' });
      archivedProjects.forEach(p => archList.appendChild(renderProjectCard(p, true)));
      container.appendChild(el('h3', { style: 'font-size: 1rem; font-weight: 600; color: var(--text-muted); margin-bottom: 1rem;' },
        `Archived Projects (${archivedProjects.length})`
      ));
      container.appendChild(archList);
    }
  }

  function renderProjectCard(project, isArchived) {
    const tasks = storage.state.tasks.filter(t => t.projectId === project.id);
    const completed = tasks.filter(t => t.completed).length;
    const total = tasks.length;
    const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

    const editBtn = el('button', {
      className: 'btn-icon btn-sm',
      title: 'Edit project',
      'aria-label': `Edit project ${project.name}`,
      onClick: () => openProjectModal(project)
    }, iconSvg('<path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>', 'icon icon-sm'));

    const archBtn = el('button', {
      className: 'btn-icon btn-sm',
      title: isArchived ? 'Unarchive' : 'Archive',
      'aria-label': `${isArchived ? 'Unarchive' : 'Archive'} project ${project.name}`,
      onClick: () => {
        project.archived = !project.archived;
        project.updatedAt = new Date().toISOString();
        persist();
        renderApp();
      }
    }, iconSvg('<polyline points="21 8 21 21 3 21 3 8"></polyline><rect x="1" y="3" width="22" height="5"></rect><line x1="10" y1="12" x2="14" y2="12"></line>', 'icon icon-sm'));

    const delBtn = el('button', {
      className: 'btn-icon btn-sm',
      title: 'Delete project',
      'aria-label': `Delete project ${project.name}`,
      onClick: () => {
        showModalDialog({
          title: 'Delete Project',
          isDanger: true,
          confirmText: 'Delete Project',
          renderBody: (body) => {
            body.appendChild(el('p', { style: 'font-size: 0.9rem;' }, `Are you sure you want to delete "${project.name}"?`));
            body.appendChild(el('p', { style: 'font-size: 0.85rem; color: var(--text-muted); margin-top: 0.5rem;' },
              `Safe deletion rule: All associated tasks (${total}) will be preserved and become unassigned, not deleted.`
            ));
          },
          onConfirm: () => {
            storage.state.tasks = storage.state.tasks.map(t => t.projectId === project.id ? { ...t, projectId: null } : t);
            storage.state.projects = storage.state.projects.filter(p => p.id !== project.id);
            persist();
            renderApp();
          }
        });
      }
    }, iconSvg('<polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>', 'icon icon-sm'));

    const progressFill = el('div', { className: 'progress-bar-fill', style: `width: ${pct}%;` });
    const progressBar = el('div', { className: 'progress-bar-wrap' }, progressFill);

    return el('div', { className: 'card' },
      el('div', { style: 'display: flex; justify-content: space-between; align-items: flex-start; gap: 0.5rem;' },
        el('div', {},
          el('h3', { style: 'font-size: 1.05rem; font-weight: 600;' }, project.name),
          project.description ? el('p', { style: 'font-size: 0.85rem; color: var(--text-muted); margin-top: 0.2rem;' }, project.description) : null
        ),
        el('div', { style: 'display: flex; gap: 4px;' }, editBtn, archBtn, delBtn)
      ),
      el('div', { style: 'margin-top: 1rem;' },
        el('div', { style: 'display: flex; justify-content: space-between; font-size: 0.8rem; color: var(--text-muted); margin-bottom: 4px;' },
          el('span', {}, 'Derived Progress'),
          el('span', {}, `${completed} / ${total} tasks (${pct}%)`)
        ),
        progressBar
      )
    );
  }

  function openProjectModal(project = null) {
    const isEdit = !!project;
    showModalDialog({
      title: isEdit ? 'Edit Project' : 'New Project',
      confirmText: isEdit ? 'Save Changes' : 'Create Project',
      renderBody: (body) => {
        const nameInput = el('input', {
          type: 'text',
          className: 'form-input',
          value: isEdit ? project.name : '',
          placeholder: 'e.g. Website Redesign',
          required: true
        });
        const descInput = el('textarea', {
          className: 'form-textarea',
          rows: 3,
          placeholder: 'Objective or scope...'
        }, isEdit ? (project.description || '') : '');

        body.appendChild(el('div', { className: 'form-group' },
          el('label', { className: 'form-label' }, 'Project Name *'),
          nameInput
        ));
        body.appendChild(el('div', { className: 'form-group' },
          el('label', { className: 'form-label' }, 'Description'),
          descInput
        ));
        body._data = { nameInput, descInput };
      },
      onConfirm: (body) => {
        const { nameInput, descInput } = body._data;
        const name = nameInput.value.trim();
        if (!name) {
          alert('Project name is required.');
          nameInput.focus();
          return false;
        }

        if (isEdit) {
          project.name = name;
          project.description = descInput.value.trim();
          project.updatedAt = new Date().toISOString();
        } else {
          storage.state.projects.push({
            id: generateId('proj'),
            name,
            description: descInput.value.trim(),
            archived: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          });
        }
        persist();
        renderApp();
        return true;
      }
    });
  }

  // 4. CALENDAR & AGENDA
  let currentCalDate = new Date();

  function renderDoCalendar(container) {
    container.innerHTML = '';
    const year = currentCalDate.getFullYear();
    const month = currentCalDate.getMonth();
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const todayStr = getLocalDateString();

    const header = el('div', { className: 'section-header' },
      el('div', {},
        el('h2', { className: 'section-title' }, 'Calendar & Agenda'),
        el('p', { className: 'section-subtitle' }, 'Manual scheduling with month view and chronological agenda')
      ),
      el('button', { className: 'btn btn-primary', onClick: () => openEventModal() }, '+ New Event')
    );

    const prevYearBtn = el('button', {
      className: 'btn btn-sm btn-subtle',
      title: 'Previous year',
      'aria-label': 'Previous year',
      onClick: () => {
        currentCalDate = new Date(currentCalDate.getFullYear() - 1, currentCalDate.getMonth(), 1);
        renderDoCalendar(container);
      }
    }, '<<');

    const prevBtn = el('button', {
      className: 'btn btn-sm btn-subtle',
      title: 'Previous month',
      'aria-label': 'Previous month',
      onClick: () => {
        currentCalDate = new Date(currentCalDate.getFullYear(), currentCalDate.getMonth() - 1, 1);
        renderDoCalendar(container);
      }
    }, '< Prev');

    const todayBtn = el('button', {
      className: 'btn btn-sm',
      title: 'Jump to current month',
      'aria-label': 'Jump to current month',
      onClick: () => {
        currentCalDate = new Date();
        renderDoCalendar(container);
      }
    }, 'Today');

    const nextBtn = el('button', {
      className: 'btn btn-sm btn-subtle',
      title: 'Next month',
      'aria-label': 'Next month',
      onClick: () => {
        currentCalDate = new Date(currentCalDate.getFullYear(), currentCalDate.getMonth() + 1, 1);
        renderDoCalendar(container);
      }
    }, 'Next >');

    const nextYearBtn = el('button', {
      className: 'btn btn-sm btn-subtle',
      title: 'Next year',
      'aria-label': 'Next year',
      onClick: () => {
        currentCalDate = new Date(currentCalDate.getFullYear() + 1, currentCalDate.getMonth(), 1);
        renderDoCalendar(container);
      }
    }, '>>');

    const calHeader = el('div', { className: 'calendar-header', style: 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;' },
      el('h3', { style: 'font-size: 1.1rem; font-weight: 600;' }, `${monthNames[month]} ${year}`),
      el('div', { style: 'display: flex; gap: 4px; align-items: center;' }, prevYearBtn, prevBtn, todayBtn, nextBtn, nextYearBtn)
    );

    const daysHeader = el('div', { className: 'cal-days-header' },
      el('div', {}, 'Sun'), el('div', {}, 'Mon'), el('div', {}, 'Tue'), el('div', {}, 'Wed'),
      el('div', {}, 'Thu'), el('div', {}, 'Fri'), el('div', {}, 'Sat')
    );

    const grid = el('div', { className: 'cal-grid' });
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const prevMonthDays = new Date(year, month, 0).getDate();

    // Padding from prev month
    for (let i = firstDay - 1; i >= 0; i--) {
      grid.appendChild(el('div', { className: 'cal-cell other-month' },
        el('span', { className: 'cal-num' }, prevMonthDays - i)
      ));
    }

    // Days in current month
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const isToday = dateStr === todayStr;
      const dayEvents = storage.state.events.filter(e => e.date === dateStr);

      const cell = el('div', {
        className: `cal-cell ${isToday ? 'today' : ''}`,
        title: `Add event on ${dateStr}`,
        onClick: () => openEventModal({ date: dateStr })
      },
        el('span', { className: 'cal-num' }, d)
      );

      dayEvents.forEach(ev => {
        const text = ev.isAllDay ? ev.title : `${ev.startTime || ''} ${ev.title}`.trim();
        const pill = el('div', {
          className: 'cal-event-pill',
          title: ev.title,
          onClick: (e) => {
            e.stopPropagation();
            openEventModal(ev);
          }
        }, text);
        cell.appendChild(pill);
      });

      grid.appendChild(cell);
    }

    const calendarWrap = el('div', { className: 'calendar-wrap', style: 'margin-bottom: 2rem;' },
      calHeader,
      daysHeader,
      grid
    );

    // Agenda List
    const upcomingEvents = storage.state.events
      .filter(e => e.date >= todayStr)
      .sort((a, b) => a.date.localeCompare(b.date) || (a.startTime || '').localeCompare(b.startTime || ''));

    const agendaList = el('div', {});
    if (upcomingEvents.length === 0) {
      agendaList.appendChild(el('div', { className: 'empty-state' },
        el('div', { className: 'empty-state-title' }, 'No upcoming events'),
        el('p', { className: 'empty-state-text' }, 'Your calendar is free.')
      ));
    } else {
      upcomingEvents.forEach(ev => {
        const editBtn = el('button', {
          className: 'btn-icon btn-sm',
          title: 'Edit event',
          'aria-label': `Edit event ${ev.title}`,
          onClick: (e) => {
            e.stopPropagation();
            openEventModal(ev);
          }
        }, iconSvg('<path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>', 'icon icon-sm'));

        const delBtn = el('button', {
          className: 'btn-icon btn-sm',
          title: 'Delete event',
          'aria-label': `Delete event ${ev.title}`,
          onClick: (e) => {
            e.stopPropagation();
            showModalDialog({
              title: 'Delete Event',
              isDanger: true,
              confirmText: 'Delete Event',
              renderBody: (body) => {
                body.appendChild(el('p', { style: 'font-size: 0.9rem;' }, `Are you sure you want to delete event "${ev.title}"?`));
                body.appendChild(el('p', { style: 'font-size: 0.85rem; color: var(--text-muted); margin-top: 0.5rem;' },
                  `Scheduled for ${formatLocalDateReadable(ev.date)}. Other events and tasks remain untouched.`
                ));
              },
              onConfirm: () => {
                storage.state.events = storage.state.events.filter(e => e.id !== ev.id);
                persist();
                renderDoCalendar(container);
              }
            });
          }
        }, iconSvg('<polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>', 'icon icon-sm'));

        agendaList.appendChild(el('div', { className: 'task-item', style: 'align-items: center;' },
          el('div', { style: 'flex: 1; cursor: pointer;', onClick: () => openEventModal(ev) },
            el('div', { style: 'font-weight: 600;' }, ev.title),
            el('div', { style: 'font-size: 0.8rem; color: var(--text-muted); display: flex; align-items: center; gap: 4px; margin-top: 2px;' },
              iconSvg(ICONS.calendar, 'icon icon-sm'),
              `${formatLocalDateReadable(ev.date)} · ${ev.isAllDay ? 'All Day' : (ev.startTime ? `${ev.startTime}${ev.endTime ? ' - ' + ev.endTime : ''}` : 'Timed')}`
            ),
            ev.notes ? el('div', { style: 'font-size: 0.8rem; color: var(--text-muted); margin-top: 2px;' }, ev.notes) : null
          ),
          el('div', { style: 'display: flex; gap: 4px;' }, editBtn, delBtn)
        ));
      });
    }

    const agendaCard = el('div', { className: 'card' },
      el('h3', { style: 'font-size: 1.05rem; font-weight: 600; margin-bottom: 1rem;' }, 'Upcoming Chronological Agenda'),
      agendaList
    );

    container.appendChild(header);
    container.appendChild(calendarWrap);
    container.appendChild(agendaCard);
  }
  function openEventModal(ev = null) {
    const isEdit = !!ev;
    showModalDialog({
      title: isEdit ? 'Edit Event' : 'New Event',
      confirmText: isEdit ? 'Save Changes' : 'Schedule Event',
      renderBody: (body) => {
        const titleInput = el('input', {
          type: 'text',
          className: 'form-input',
          value: isEdit ? ev.title : '',
          placeholder: 'e.g. Design Sync',
          required: true
        });
        const dateInput = el('input', {
          type: 'date',
          className: 'form-input',
          value: isEdit ? ev.date : getLocalDateString(),
          required: true
        });
        const allDayCheckbox = el('input', {
          type: 'checkbox',
          className: 'task-checkbox',
          checked: !ev || ev.isAllDay
        });
        const startInput = el('input', {
          type: 'time',
          className: 'form-input',
          value: isEdit && ev.startTime ? ev.startTime : '09:00'
        });
        const endInput = el('input', {
          type: 'time',
          className: 'form-input',
          value: isEdit && ev.endTime ? ev.endTime : '10:00'
        });
        const notesInput = el('textarea', {
          className: 'form-textarea',
          rows: 2,
          placeholder: 'Notes, link, or location...'
        }, isEdit ? (ev.notes || '') : '');

        const timesRow = el('div', {
          className: 'form-row',
          style: `display: ${!ev || ev.isAllDay ? 'none' : 'flex'};`
        },
          el('div', { className: 'form-group' }, el('label', { className: 'form-label' }, 'Start Time'), startInput),
          el('div', { className: 'form-group' }, el('label', { className: 'form-label' }, 'End Time'), endInput)
        );

        allDayCheckbox.addEventListener('change', (e) => {
          timesRow.style.display = e.target.checked ? 'none' : 'flex';
        });

        body.appendChild(el('div', { className: 'form-group' }, el('label', { className: 'form-label' }, 'Event Title *'), titleInput));
        body.appendChild(el('div', { className: 'form-row' },
          el('div', { className: 'form-group' }, el('label', { className: 'form-label' }, 'Date *'), dateInput),
          el('div', { className: 'form-group', style: 'justify-content: flex-end; padding-bottom: 6px;' },
            el('label', { style: 'display: flex; align-items: center; gap: 6px; font-size: 0.85rem; cursor: pointer;' },
              allDayCheckbox, 'All-day event'
            )
          )
        ));
        const errorEl = el('div', { className: 'form-error', style: 'display: none; color: var(--danger); font-size: 0.825rem; margin-top: 8px;' });
        body.appendChild(timesRow);
        body.appendChild(el('div', { className: 'form-group' }, el('label', { className: 'form-label' }, 'Notes'), notesInput));
        body.appendChild(errorEl);

        body._data = { titleInput, dateInput, allDayCheckbox, startInput, endInput, notesInput, errorEl };
      },
      onConfirm: (body) => {
        const { titleInput, dateInput, allDayCheckbox, startInput, endInput, notesInput, errorEl } = body._data;
        const title = titleInput.value.trim();
        const date = dateInput.value;
        const isAllDay = allDayCheckbox.checked;
        const startTime = isAllDay ? null : startInput.value;
        const endTime = isAllDay ? null : endInput.value;

        if (!title) {
          errorEl.textContent = 'Event title is required.';
          errorEl.style.display = 'block';
          titleInput.focus();
          return false;
        }
        if (!date) {
          errorEl.textContent = 'Event date is required.';
          errorEl.style.display = 'block';
          dateInput.focus();
          return false;
        }
        if (!isAllDay && startTime && endTime && endTime < startTime) {
          errorEl.textContent = 'End time cannot be earlier than start time.';
          errorEl.style.display = 'block';
          endInput.focus();
          return false;
        }

        if (isEdit) {
          const target = storage.state.events.find(item => item.id === ev.id);
          if (target) {
            target.title = title;
            target.date = date;
            target.isAllDay = isAllDay;
            target.startTime = startTime;
            target.endTime = endTime;
            target.notes = notesInput.value.trim();
            target.updatedAt = new Date().toISOString();
          }
        } else {
          storage.state.events.push({
            id: generateId('ev'),
            title,
            date,
            isAllDay,
            startTime,
            endTime,
            notes: notesInput.value.trim(),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          });
        }

        persist();
        renderApp();
        return true;
      }
    });
  }

  // 5. HABITS
  function renderDoHabits(container) {
    const todayStr = getLocalDateString();
    const header = el('div', { className: 'section-header' },
      el('div', {},
        el('h2', { className: 'section-title' }, 'Habits & Consistency'),
        el('p', { className: 'section-subtitle' }, 'Cultivate daily routines without manipulative streak pressure')
      ),
      el('button', { className: 'btn btn-primary', onClick: () => openHabitModal() }, '+ New Habit')
    );

    const list = el('div', {});
    if (storage.state.habits.length === 0) {
      list.appendChild(el('div', { className: 'empty-state' },
        el('div', { className: 'empty-state-title' }, 'No habits defined yet'),
        el('p', { className: 'empty-state-text' }, 'Start small with a habit you can practice daily or on weekdays.'),
        el('button', { className: 'btn btn-primary', onClick: () => openHabitModal() }, '+ Create First Habit')
      ));
    } else {
      storage.state.habits.forEach(h => {
        const streak = calculateHabitStreak(h, storage.state.habitEntries, todayStr);
        const days = getHabitRecentDays(h, storage.state.habitEntries, 7, todayStr);

        const editBtn = el('button', {
          className: 'btn-icon btn-sm',
          title: 'Edit habit',
          'aria-label': `Edit habit ${h.name}`,
          onClick: () => openHabitModal(h)
        }, iconSvg('<path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>', 'icon icon-sm'));

        const delBtn = el('button', {
          className: 'btn-icon btn-sm',
          title: 'Delete habit',
          'aria-label': `Delete habit ${h.name}`,
          onClick: () => {
            showModalDialog({
              title: 'Delete Habit',
              isDanger: true,
              confirmText: 'Delete Habit',
              renderBody: (body) => {
                body.appendChild(el('p', { style: 'font-size: 0.9rem;' }, `Are you sure you want to delete habit "${h.name}"?`));
                body.appendChild(el('p', { style: 'font-size: 0.85rem; color: var(--text-muted); margin-top: 0.5rem;' },
                  'Safe deletion rule: Associated completion history will also be permanently removed. Unrelated habits remain untouched.'
                ));
              },
              onConfirm: () => {
                storage.state.habits = storage.state.habits.filter(item => item.id !== h.id);
                storage.state.habitEntries = storage.state.habitEntries.filter(item => item.habitId !== h.id);
                persist();
                renderApp();
              }
            });
          }
        }, iconSvg('<polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>', 'icon icon-sm'));

        const dayBoxes = days.map(dInfo => {
          const dayName = parseLocalDate(dInfo.date).toLocaleDateString(undefined, { weekday: 'narrow' });
          return el('div', {
            className: `habit-day-box ${dInfo.isCompleted ? 'done' : ''} ${!dInfo.isScheduled ? 'unscheduled' : ''}`,
            title: `${dInfo.date} (${dInfo.isCompleted ? 'Completed' : dInfo.isScheduled ? 'Scheduled' : 'Off'})`,
            onClick: () => {
              let entry = storage.state.habitEntries.find(e => e.habitId === h.id && e.date === dInfo.date);
              if (entry) {
                entry.completed = !entry.completed;
                entry.completedAt = entry.completed ? new Date().toISOString() : null;
              } else {
                storage.state.habitEntries.push({
                  id: generateId('he'),
                  habitId: h.id,
                  date: dInfo.date,
                  completed: true,
                  completedAt: new Date().toISOString()
                });
              }
              persist();
              renderApp();
            }
          }, dayName);
        });

        const card = el('div', { className: 'habit-item' },
          el('div', { className: 'habit-row' },
            el('div', {},
              el('h3', { style: 'font-size: 1rem; font-weight: 600;' }, h.name),
              h.description ? el('p', { style: 'font-size: 0.8rem; color: var(--text-muted);' }, h.description) : null
            ),
            el('div', { style: 'display: flex; align-items: center; gap: 8px;' },
              el('span', { className: 'tag', style: 'color: var(--accent); font-weight: 600; display: inline-flex; align-items: center; gap: 4px;' },
                iconSvg(ICONS.flame, 'icon icon-sm'),
                `${streak} ${streak === 1 ? 'day' : 'days'} streak`
              ),
              editBtn,
              delBtn
            )
          ),
          el('div', { style: 'font-size: 0.75rem; color: var(--text-muted); margin-top: 0.6rem;' }, 'Past 7 days (Tap any day to toggle completion):'),
          el('div', { className: 'habit-days' }, ...dayBoxes)
        );

        list.appendChild(card);
      });
    }

    container.appendChild(header);
    container.appendChild(list);
  }

  function openHabitModal(habit = null) {
    const isEdit = !!habit;
    showModalDialog({
      title: isEdit ? 'Edit Habit' : 'New Habit',
      confirmText: isEdit ? 'Save Changes' : 'Create Habit',
      renderBody: (body) => {
        const nameInput = el('input', {
          type: 'text',
          className: 'form-input',
          value: isEdit ? habit.name : '',
          placeholder: 'e.g. Read 20 minutes',
          required: true
        });
        const descInput = el('input', {
          type: 'text',
          className: 'form-input',
          value: isEdit ? (habit.description || '') : '',
          placeholder: 'Why or how...'
        });

        let selectedRecurrence = isEdit ? (habit.recurrence || 'daily') : 'daily';
        let initialSelectedDays = isEdit && Array.isArray(habit.scheduledDays)
          ? [...habit.scheduledDays]
          : (selectedRecurrence === 'weekdays' ? [1, 2, 3, 4, 5] : [0, 1, 2, 3, 4, 5, 6]);

        let selectedDaysSet = new Set(initialSelectedDays);

        const recSelect = el('select', { className: 'form-select' },
          el('option', { value: 'daily' }, 'Every day'),
          el('option', { value: 'weekdays' }, 'Weekdays only (Mon - Fri)'),
          el('option', { value: 'custom' }, 'Custom days of the week')
        );
        recSelect.value = selectedRecurrence;

        const daysOfWeek = [
          { label: 'Su', index: 0, full: 'Sunday' },
          { label: 'Mo', index: 1, full: 'Monday' },
          { label: 'Tu', index: 2, full: 'Tuesday' },
          { label: 'We', index: 3, full: 'Wednesday' },
          { label: 'Th', index: 4, full: 'Thursday' },
          { label: 'Fr', index: 5, full: 'Friday' },
          { label: 'Sa', index: 6, full: 'Saturday' }
        ];

        const customDaysWrap = el('div', {
          className: 'form-group',
          style: `display: ${selectedRecurrence === 'custom' ? 'block' : 'none'}; margin-top: 0.5rem;`
        },
          el('label', { className: 'form-label' }, 'Select Scheduled Days (at least 1 required)'),
          el('div', { className: 'weekday-selector' },
            ...daysOfWeek.map(d => {
              const btn = el('button', {
                type: 'button',
                className: `weekday-btn ${selectedDaysSet.has(d.index) ? 'selected' : ''}`,
                'aria-pressed': selectedDaysSet.has(d.index) ? 'true' : 'false',
                'aria-label': `${d.full} schedule toggle`,
                onClick: () => {
                  if (selectedDaysSet.has(d.index)) {
                    selectedDaysSet.delete(d.index);
                    btn.classList.remove('selected');
                    btn.setAttribute('aria-pressed', 'false');
                  } else {
                    selectedDaysSet.add(d.index);
                    btn.classList.add('selected');
                    btn.setAttribute('aria-pressed', 'true');
                  }
                  if (selectedDaysSet.size > 0 && errorEl.textContent.includes('day')) {
                    errorEl.style.display = 'none';
                  }
                }
              }, d.label);
              return btn;
            })
          )
        );

        recSelect.addEventListener('change', (e) => {
          const val = e.target.value;
          selectedRecurrence = val;
          if (val === 'custom') {
            customDaysWrap.style.display = 'block';
          } else {
            customDaysWrap.style.display = 'none';
            if (val === 'daily') {
              selectedDaysSet = new Set([0, 1, 2, 3, 4, 5, 6]);
            } else if (val === 'weekdays') {
              selectedDaysSet = new Set([1, 2, 3, 4, 5]);
            }
          }
        });

        const errorEl = el('div', { className: 'form-error', style: 'display: none; color: var(--danger); font-size: 0.825rem; margin-top: 8px;' });

        body.appendChild(el('div', { className: 'form-group' }, el('label', { className: 'form-label' }, 'Habit Name *'), nameInput));
        body.appendChild(el('div', { className: 'form-group' }, el('label', { className: 'form-label' }, 'Description'), descInput));
        body.appendChild(el('div', { className: 'form-group' }, el('label', { className: 'form-label' }, 'Schedule Recurrence'), recSelect));
        body.appendChild(customDaysWrap);
        body.appendChild(errorEl);

        body._data = { nameInput, descInput, recSelect, getSelectedDays: () => Array.from(selectedDaysSet).sort((a,b)=>a-b), errorEl };
      },
      onConfirm: (body) => {
        const { nameInput, descInput, recSelect, getSelectedDays, errorEl } = body._data;
        const name = nameInput.value.trim();
        if (!name) {
          errorEl.textContent = 'Habit name is required.';
          errorEl.style.display = 'block';
          nameInput.focus();
          return false;
        }

        const recurrence = recSelect.value;
        let scheduledDays = getSelectedDays();

        if (recurrence === 'daily') {
          scheduledDays = [0, 1, 2, 3, 4, 5, 6];
        } else if (recurrence === 'weekdays') {
          scheduledDays = [1, 2, 3, 4, 5];
        } else if (recurrence === 'custom') {
          if (scheduledDays.length === 0) {
            errorEl.textContent = 'Please select at least one day of the week for custom schedules.';
            errorEl.style.display = 'block';
            return false;
          }
        }

        if (isEdit) {
          const target = storage.state.habits.find(item => item.id === habit.id);
          if (target) {
            target.name = name;
            target.description = descInput.value.trim();
            target.recurrence = recurrence;
            target.scheduledDays = scheduledDays;
            target.updatedAt = new Date().toISOString();
          }
        } else {
          storage.state.habits.push({
            id: generateId('habit'),
            name,
            description: descInput.value.trim(),
            recurrence,
            scheduledDays,
            startDate: getLocalDateString(),
            status: 'active',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          });
        }

        persist();
        renderApp();
        return true;
      }
    });
  }

  // 6. GOALS & MILESTONES
  function renderDoGoals(container) {
    const header = el('div', { className: 'section-header' },
      el('div', {},
        el('h2', { className: 'section-title' }, 'Goals & Milestones'),
        el('p', { className: 'section-subtitle' }, 'Long-term vision broken down into actionable milestones')
      ),
      el('button', { className: 'btn btn-primary', onClick: () => openGoalModal() }, '+ New Goal')
    );

    const grid = el('div', { className: 'grid-2' });
    if (storage.state.goals.length === 0) {
      grid.appendChild(el('div', { className: 'empty-state', style: 'grid-column: 1 / -1;' },
        el('div', { className: 'empty-state-title' }, 'No goals created yet'),
        el('p', { className: 'empty-state-text' }, 'Set a goal and add key milestones to track progress.'),
        el('button', { className: 'btn btn-primary', onClick: () => openGoalModal() }, '+ Create First Goal')
      ));
    } else {
      storage.state.goals.forEach(goal => {
        const milestones = storage.state.milestones.filter(m => m.goalId === goal.id);
        const prog = calculateGoalProgress(goal, milestones);

        const editBtn = el('button', {
          className: 'btn-icon btn-sm',
          title: 'Edit goal',
          'aria-label': `Edit goal ${goal.title}`,
          onClick: () => openGoalModal(goal)
        }, iconSvg('<path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>', 'icon icon-sm'));

        const delBtn = el('button', {
          className: 'btn-icon btn-sm',
          title: 'Delete goal',
          'aria-label': `Delete goal ${goal.title}`,
          onClick: () => {
            showModalDialog({
              title: 'Delete Goal',
              isDanger: true,
              confirmText: 'Delete Goal',
              renderBody: (body) => {
                body.appendChild(el('p', { style: 'font-size: 0.9rem;' }, `Delete goal "${goal.title}"?`));
                body.appendChild(el('p', { style: 'font-size: 0.85rem; color: var(--text-muted); margin-top: 0.5rem;' },
                  'Associated milestones will be removed, while all linked tasks remain preserved.'
                ));
              },
              onConfirm: () => {
                storage.state.milestones = storage.state.milestones.filter(m => m.goalId !== goal.id);
                storage.state.goals = storage.state.goals.filter(g => g.id !== goal.id);
                persist();
                renderApp();
              }
            });
          }
        }, iconSvg('<polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>', 'icon icon-sm'));

        const milestonesList = el('div', { style: 'display: flex; flex-direction: column; gap: 4px;' });
        milestones.forEach(m => {
          const chk = el('input', {
            type: 'checkbox',
            className: 'task-checkbox',
            checked: Boolean(m.completed),
            'aria-label': `Toggle milestone ${m.title}`,
            onClick: (e) => e.stopPropagation(),
            onChange: (e) => {
              e.stopPropagation();
              const target = storage.state.milestones.find(item => item.id === m.id);
              if (target) {
                target.completed = Boolean(e.target.checked);
                target.updatedAt = new Date().toISOString();
                persist();
                renderApp();
              }
            }
          });

          const editMBtn = el('button', {
            className: 'btn-icon btn-sm',
            style: 'width: 24px; height: 24px;',
            title: 'Edit milestone',
            'aria-label': `Edit milestone ${m.title}`,
            onClick: () => openMilestoneModal({ goalId: goal.id, milestone: m })
          }, iconSvg(ICONS.edit, 'icon icon-sm'));

          const delMBtn = el('button', {
            className: 'btn-icon btn-sm',
            style: 'width: 24px; height: 24px;',
            title: 'Delete milestone',
            'aria-label': `Delete milestone ${m.title}`,
            onClick: () => {
              showModalDialog({
                title: 'Delete Milestone',
                isDanger: true,
                confirmText: 'Delete Milestone',
                renderBody: (body) => {
                  body.appendChild(el('p', { style: 'font-size: 0.9rem;' }, `Are you sure you want to delete milestone "${m.title}"?`));
                  body.appendChild(el('p', { style: 'font-size: 0.85rem; color: var(--text-muted); margin-top: 0.5rem;' },
                    'This milestone will be permanently removed. The goal\'s derived progress will update automatically.'
                  ));
                },
                onConfirm: () => {
                  storage.state.milestones = storage.state.milestones.filter(item => item.id !== m.id);
                  persist();
                  renderApp();
                }
              });
            }
          }, iconSvg(ICONS.trash, 'icon icon-sm'));

          const dateBadge = m.targetDate ? el('span', {
            className: 'tag',
            style: 'display: inline-flex; align-items: center; gap: 4px; font-size: 0.75rem; padding: 2px 6px;'
          },
            iconSvg(ICONS.calendar, 'icon icon-sm'),
            formatLocalDateReadable(m.targetDate)
          ) : null;

          milestonesList.appendChild(el('div', {
            className: 'milestone-item',
            style: 'display: flex; align-items: center; justify-content: space-between; gap: 8px;'
          },
            el('label', { style: 'display: flex; align-items: center; gap: 8px; font-size: 0.85rem; cursor: pointer; flex: 1;' },
              chk,
              el('span', { style: m.completed ? 'text-decoration: line-through; opacity: 0.6;' : '' }, m.title),
              dateBadge
            ),
            el('div', { style: 'display: flex; gap: 4px;' }, editMBtn, delMBtn)
          ));
        });

        const addMBtn = el('button', {
          className: 'btn btn-sm btn-subtle',
          onClick: () => openMilestoneModal({ goalId: goal.id, milestone: null })
        }, '+ Milestone');

        const card = el('div', { className: 'card' },
          el('div', { style: 'display: flex; justify-content: space-between; align-items: flex-start;' },
            el('div', {},
              el('h3', { style: 'font-size: 1.05rem; font-weight: 600;' }, goal.title),
              goal.description ? el('p', { style: 'font-size: 0.825rem; color: var(--text-muted); margin-top: 0.2rem;' }, goal.description) : null
            ),
            el('div', { style: 'display: flex; gap: 4px;' }, editBtn, delBtn)
          ),
          el('div', { style: 'margin: 0.85rem 0;' },
            el('div', { style: 'display: flex; justify-content: space-between; font-size: 0.8rem; color: var(--text-muted);' },
              el('span', {}, goal.targetDate ? `Target: ${formatLocalDateReadable(goal.targetDate)}` : 'Status'),
              el('span', {}, prog.text)
            ),
            prog.hasMilestones ? el('div', { className: 'progress-bar-wrap' },
              el('div', { className: 'progress-bar-fill', style: `width: ${prog.percent}%;` })
            ) : null
          ),
          el('div', { style: 'border-top: 1px solid var(--border); padding-top: 0.75rem; margin-top: 0.5rem;' },
            el('div', { style: 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;' },
              el('span', { style: 'font-size: 0.8rem; font-weight: 600; color: var(--text-muted);' }, 'Milestones'),
              addMBtn
            ),
            milestones.length > 0 ? milestonesList : el('div', { style: 'font-size: 0.8rem; color: var(--text-subtle);' }, 'No milestones yet.')
          )
        );

        grid.appendChild(card);
      });
    }

    container.appendChild(header);
    container.appendChild(grid);
  }

  function openMilestoneModal({ goalId, milestone = null }) {
    const isEdit = !!milestone;
    showModalDialog({
      title: isEdit ? 'Edit Milestone' : 'Add Milestone',
      confirmText: isEdit ? 'Save Changes' : 'Add Milestone',
      renderBody: (body) => {
        const titleInput = el('input', {
          type: 'text',
          className: 'form-input',
          value: isEdit ? milestone.title : '',
          placeholder: 'e.g. Complete chapter draft',
          required: true
        });
        const dateInput = el('input', {
          type: 'date',
          className: 'form-input',
          value: isEdit && milestone.targetDate ? milestone.targetDate : ''
        });
        const errorEl = el('div', { className: 'form-error', style: 'display: none; color: var(--danger); font-size: 0.825rem; margin-top: 6px;' });

        body.appendChild(el('div', { className: 'form-group' },
          el('label', { className: 'form-label' }, 'Milestone Title *'),
          titleInput,
          errorEl
        ));
        body.appendChild(el('div', { className: 'form-group' },
          el('label', { className: 'form-label' }, 'Target Date (Optional)'),
          dateInput
        ));

        body._data = { titleInput, dateInput, errorEl };
      },
      onConfirm: (body) => {
        const { titleInput, dateInput, errorEl } = body._data;
        const title = titleInput.value.trim();
        if (!title) {
          errorEl.textContent = 'Milestone title is required.';
          errorEl.style.display = 'block';
          titleInput.focus();
          return false;
        }

        const targetDate = dateInput.value.trim() || null;
        if (isEdit) {
          const target = storage.state.milestones.find(item => item.id === milestone.id);
          if (target) {
            target.title = title;
            target.targetDate = targetDate;
            target.updatedAt = new Date().toISOString();
          }
        } else {
          const currentGoalMilestones = storage.state.milestones.filter(m => m.goalId === goalId);
          storage.state.milestones.push({
            id: generateId('ms'),
            goalId,
            title,
            completed: false,
            targetDate,
            sortOrder: currentGoalMilestones.length,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          });
        }

        persist();
        renderApp();
        return true;
      }
    });
  }

  function openGoalModal(goal = null) {
    const isEdit = !!goal;
    showModalDialog({
      title: isEdit ? 'Edit Goal' : 'New Goal',
      confirmText: isEdit ? 'Save Changes' : 'Create Goal',
      renderBody: (body) => {
        const titleInput = el('input', {
          type: 'text',
          className: 'form-input',
          value: isEdit ? goal.title : '',
          placeholder: 'e.g. Master Conversational Spanish',
          required: true
        });
        const descInput = el('textarea', {
          className: 'form-textarea',
          rows: 2,
          placeholder: 'Why this matters...'
        }, isEdit ? (goal.description || '') : '');
        const targetDateInput = el('input', {
          type: 'date',
          className: 'form-input',
          value: isEdit && goal.targetDate ? goal.targetDate : ''
        });
        const statusSelect = el('select', { className: 'form-select' },
          el('option', { value: 'active' }, 'Active'),
          el('option', { value: 'paused' }, 'Paused'),
          el('option', { value: 'completed' }, 'Completed')
        );
        if (isEdit && goal.status) statusSelect.value = goal.status;

        const errorEl = el('div', { className: 'form-error', style: 'display: none; color: var(--danger); font-size: 0.825rem; margin-top: 6px;' });

        body.appendChild(el('div', { className: 'form-group' }, el('label', { className: 'form-label' }, 'Goal Title *'), titleInput, errorEl));
        body.appendChild(el('div', { className: 'form-group' }, el('label', { className: 'form-label' }, 'Description'), descInput));
        body.appendChild(el('div', { className: 'form-row' },
          el('div', { className: 'form-group' }, el('label', { className: 'form-label' }, 'Target Date'), targetDateInput),
          el('div', { className: 'form-group' }, el('label', { className: 'form-label' }, 'Status'), statusSelect)
        ));
        body._data = { titleInput, descInput, targetDateInput, statusSelect, errorEl };
      },
      onConfirm: (body) => {
        const { titleInput, descInput, targetDateInput, statusSelect, errorEl } = body._data;
        const title = titleInput.value.trim();
        if (!title) {
          errorEl.textContent = 'Goal title is required.';
          errorEl.style.display = 'block';
          titleInput.focus();
          return false;
        }

        if (isEdit) {
          goal.title = title;
          goal.description = descInput.value.trim();
          goal.targetDate = targetDateInput.value || null;
          goal.status = statusSelect.value;
          goal.updatedAt = new Date().toISOString();
        } else {
          storage.state.goals.push({
            id: generateId('goal'),
            title,
            description: descInput.value.trim(),
            targetDate: targetDateInput.value || null,
            status: statusSelect.value,
            linkedTaskIds: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          });
        }

        persist();
        renderApp();
        return true;
      }
    });
  }

  // 7. NOTES (Safe text rendering, pin/unpin, search, unsaved changes check)
  function renderDoNotes(container) {
    const header = el('div', { className: 'section-header' },
      el('div', {},
        el('h2', { className: 'section-title' }, 'Notes'),
        el('p', { className: 'section-subtitle' }, 'Plain text ideas, reference material, and pinned knowledge')
      ),
      el('button', { className: 'btn btn-primary', onClick: () => openNoteModal() }, '+ New Note')
    );

    const searchInput = el('input', {
      type: 'text',
      className: 'form-input',
      placeholder: 'Search notes by title or body...',
      value: noteSearchQuery
    });
    searchInput.addEventListener('input', (e) => {
      noteSearchQuery = e.target.value.toLowerCase();
      renderDoNotesGrid(grid);
    });

    const searchWrap = el('div', { style: 'margin-bottom: 1.25rem;' }, searchInput);
    const grid = el('div', { className: 'grid-3' });

    renderDoNotesGrid(grid);

    container.appendChild(header);
    container.appendChild(searchWrap);
    container.appendChild(grid);
  }

  function renderDoNotesGrid(grid) {
    grid.innerHTML = '';
    let filtered = storage.state.notes.slice();
    if (noteSearchQuery) {
      filtered = filtered.filter(n =>
        (n.title && n.title.toLowerCase().includes(noteSearchQuery)) ||
        (n.body && n.body.toLowerCase().includes(noteSearchQuery))
      );
    }

    filtered.sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return (b.updatedAt || '').localeCompare(a.updatedAt || '');
    });

    if (filtered.length === 0) {
      grid.appendChild(el('div', { className: 'empty-state', style: 'grid-column: 1 / -1;' },
        el('div', { className: 'empty-state-title' }, 'No notes found'),
        el('p', { className: 'empty-state-text' }, noteSearchQuery ? 'No notes match your search.' : 'Capture thoughts, lists, or references.'),
        el('button', { className: 'btn btn-primary', onClick: () => openNoteModal() }, '+ Create Note')
      ));
      return;
    }

    filtered.forEach(n => {
      const pinBtn = el('button', {
        className: 'btn-icon btn-sm',
        title: n.pinned ? 'Unpin note' : 'Pin note',
        'aria-label': `${n.pinned ? 'Unpin' : 'Pin'} note ${n.title || 'Untitled'}`,
        style: `color: ${n.pinned ? 'var(--accent)' : 'inherit'};`,
        onClick: () => {
          n.pinned = !n.pinned;
          n.updatedAt = new Date().toISOString();
          persist();
          renderDoNotesGrid(grid);
        }
      }, iconSvg(ICONS.pin, 'icon icon-sm'));

      const editBtn = el('button', {
        className: 'btn-icon btn-sm',
        title: 'Edit note',
        'aria-label': `Edit note ${n.title || 'Untitled'}`,
        onClick: () => openNoteModal(n)
      }, iconSvg(ICONS.edit, 'icon icon-sm'));

      const delBtn = el('button', {
        className: 'btn-icon btn-sm',
        title: 'Delete note',
        'aria-label': `Delete note ${n.title || 'Untitled'}`,
        onClick: () => {
          showModalDialog({
            title: 'Delete Note',
            isDanger: true,
            confirmText: 'Delete Note',
            renderBody: (body) => {
              body.appendChild(el('p', { style: 'font-size: 0.9rem;' }, `Are you sure you want to delete note "${n.title || 'Untitled Note'}"?`));
              body.appendChild(el('p', { style: 'font-size: 0.85rem; color: var(--text-muted); margin-top: 0.5rem;' },
                'This action cannot be undone. Unrelated notes remain untouched.'
              ));
            },
            onConfirm: () => {
              storage.state.notes = storage.state.notes.filter(item => item.id !== n.id);
              persist();
              renderDoNotesGrid(grid);
            }
          });
        }
      }, iconSvg(ICONS.trash, 'icon icon-sm'));

      const card = el('div', { className: `note-card ${n.pinned ? 'pinned' : ''}` },
        el('div', { style: 'display: flex; justify-content: space-between; align-items: flex-start; gap: 0.5rem;' },
          el('h3', { style: 'font-size: 0.95rem; font-weight: 600; word-break: break-word;' }, n.title || 'Untitled Note'),
          el('div', { style: 'display: flex; gap: 4px;' }, pinBtn, editBtn, delBtn)
        ),
        el('div', { className: 'note-body-preview', style: 'cursor: pointer;', onClick: () => openNoteModal(n) }, n.body),
        el('div', { style: 'font-size: 0.75rem; color: var(--text-subtle); margin-top: auto;' },
          `Updated ${n.updatedAt ? new Date(n.updatedAt).toLocaleDateString() : ''}`
        )
      );

      grid.appendChild(card);
    });
  }

  function openNoteModal(note = null) {
    const isEdit = !!note;
    let originalTitle = isEdit ? (note.title || '') : '';
    let originalBody = isEdit ? (note.body || '') : '';

    showModalDialog({
      title: isEdit ? 'Edit Note' : 'New Note',
      confirmText: isEdit ? 'Save Changes' : 'Create Note',
      renderBody: (body) => {
        const titleInput = el('input', {
          type: 'text',
          className: 'form-input',
          value: originalTitle,
          placeholder: 'Note title...'
        });
        const bodyInput = el('textarea', {
          className: 'form-textarea note-body-textarea',
          rows: 8,
          placeholder: 'Write your thoughts...',
          required: true
        }, originalBody);

        const pinCheckbox = el('input', {
          type: 'checkbox',
          className: 'task-checkbox',
          checked: isEdit ? Boolean(note.pinned) : false
        });

        const errorEl = el('div', { className: 'form-error', style: 'display: none; color: var(--danger); font-size: 0.825rem; margin-top: 8px;' });

        body.appendChild(el('div', { className: 'form-group' }, el('label', { className: 'form-label' }, 'Title'), titleInput));
        body.appendChild(el('div', { className: 'form-group' }, el('label', { className: 'form-label' }, 'Body Text *'), bodyInput));
        body.appendChild(el('label', { style: 'display: flex; align-items: center; gap: 8px; font-size: 0.85rem; cursor: pointer;' },
          pinCheckbox, 'Pin this note to the top'
        ));
        body.appendChild(errorEl);

        body._data = { titleInput, bodyInput, pinCheckbox, errorEl };
      },
      onConfirm: (body) => {
        const { titleInput, bodyInput, pinCheckbox, errorEl } = body._data;
        const title = titleInput.value.trim();
        const bodyText = bodyInput.value.trim();

        if (!title && !bodyText) {
          errorEl.textContent = 'A note must have at least a title or body text.';
          errorEl.style.display = 'block';
          bodyInput.focus();
          return false;
        }

        if (isEdit) {
          const target = storage.state.notes.find(item => item.id === note.id);
          if (target) {
            target.title = title;
            target.body = bodyText;
            target.pinned = pinCheckbox.checked;
            target.updatedAt = new Date().toISOString();
          }
        } else {
          storage.state.notes.push({
            id: generateId('note'),
            title,
            body: bodyText,
            pinned: pinCheckbox.checked,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          });
        }

        persist();
        renderApp();
        return true;
      }
    });
  }

  // 8. JOURNAL
  function renderDoJournal(container) {
    const header = el('div', { className: 'section-header' },
      el('div', {},
        el('h2', { className: 'section-title' }, 'Journal'),
        el('p', { className: 'section-subtitle' }, 'Chronological reflection and daily personal logs')
      ),
      el('button', { className: 'btn btn-primary', onClick: () => openJournalModal() }, '+ New Entry')
    );

    const list = el('div', { style: 'display: flex; flex-direction: column; gap: 1rem;' });
    const sorted = storage.state.journalEntries.slice().sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));

    if (sorted.length === 0) {
      list.appendChild(el('div', { className: 'empty-state' },
        el('div', { className: 'empty-state-title' }, 'No journal entries yet'),
        el('p', { className: 'empty-state-text' }, 'Take a quiet moment to record insights or reflections.'),
        el('button', { className: 'btn btn-primary', onClick: () => openJournalModal() }, '+ Write First Entry')
      ));
    } else {
      sorted.forEach(j => {
        const editBtn = el('button', {
          className: 'btn-icon btn-sm',
          title: 'Edit entry',
          'aria-label': 'Edit journal entry',
          onClick: () => openJournalModal(j)
        }, iconSvg('<path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>', 'icon icon-sm'));

        const delBtn = el('button', {
          className: 'btn-icon btn-sm',
          title: 'Delete entry',
          'aria-label': 'Delete journal entry',
          onClick: () => {
            showModalDialog({
              title: 'Delete Journal Entry',
              isDanger: true,
              confirmText: 'Delete Entry',
              renderBody: (body) => {
                body.appendChild(el('p', { style: 'font-size: 0.9rem;' },
                  `Are you sure you want to delete the journal entry for ${formatLocalDateReadable(j.date, { weekday: 'long' })}?`
                ));
                body.appendChild(el('p', { style: 'font-size: 0.85rem; color: var(--text-muted); margin-top: 0.5rem;' },
                  'This entry will be permanently removed. Other journal entries remain untouched.'
                ));
              },
              onConfirm: () => {
                storage.state.journalEntries = storage.state.journalEntries.filter(item => item.id !== j.id);
                persist();
                renderApp();
              }
            });
          }
        }, iconSvg('<polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>', 'icon icon-sm'));

        const card = el('div', { className: 'card' },
          el('div', { style: 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem; border-bottom: 1px solid var(--border-subtle); padding-bottom: 0.5rem;' },
            el('div', { style: 'font-weight: 600; font-size: 0.95rem; color: var(--accent);' }, formatLocalDateReadable(j.date, { weekday: 'long' })),
            el('div', { style: 'display: flex; gap: 4px;' }, editBtn, delBtn)
          ),
          el('div', { style: 'font-size: 0.9rem; line-height: 1.6; white-space: pre-wrap; word-break: break-word;' }, j.body)
        );

        list.appendChild(card);
      });
    }

    container.appendChild(header);
    container.appendChild(list);
  }

  function openJournalModal(entry = null) {
    const isEdit = !!entry;
    showModalDialog({
      title: isEdit ? 'Edit Journal Entry' : 'New Journal Entry',
      confirmText: isEdit ? 'Save Changes' : 'Save Entry',
      renderBody: (body) => {
        const dateInput = el('input', {
          type: 'date',
          className: 'form-input',
          value: isEdit ? entry.date : getLocalDateString(),
          required: true
        });
        const bodyInput = el('textarea', {
          className: 'form-textarea',
          rows: 8,
          placeholder: 'What happened today? What did you learn?',
          required: true
        }, isEdit ? (entry.body || '') : '');

        const errorEl = el('div', { className: 'form-error', style: 'display: none; color: var(--danger); font-size: 0.825rem; margin-top: 8px;' });

        body.appendChild(el('div', { className: 'form-group' }, el('label', { className: 'form-label' }, 'Date *'), dateInput));
        body.appendChild(el('div', { className: 'form-group' }, el('label', { className: 'form-label' }, 'Reflection / Thoughts *'), bodyInput));
        body.appendChild(errorEl);

        body._data = { dateInput, bodyInput, errorEl };
      },
      onConfirm: (body) => {
        const { dateInput, bodyInput, errorEl } = body._data;
        const date = dateInput.value;
        const bodyText = bodyInput.value.trim();

        if (!date) {
          errorEl.textContent = 'Date is required.';
          errorEl.style.display = 'block';
          dateInput.focus();
          return false;
        }
        if (!bodyText) {
          errorEl.textContent = 'Journal entry cannot be empty.';
          errorEl.style.display = 'block';
          bodyInput.focus();
          return false;
        }

        if (isEdit) {
          entry.date = date;
          entry.body = bodyText;
          entry.updatedAt = new Date().toISOString();
        } else {
          storage.state.journalEntries.push({
            id: generateId('je'),
            date,
            body: bodyText,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          });
        }

        persist();
        renderApp();
        return true;
      }
    });
  }

  // 9. FINANCE TRACKER (Minor Units, Currency-Aware, Transaction Edit Flow)
  function renderDoFinance(container) {
    const currency = storage.state.preferences.currency || 'USD';
    const summary = calculateFinanceSummary(storage.state.transactions, activeFinanceMonth, storage.state.budgets, currency);

    const header = el('div', { className: 'section-header' },
      el('div', {},
        el('h2', { className: 'section-title' }, 'Manual Finance Tracker'),
        el('p', { className: 'section-subtitle' }, 'Private offline budgeting & cash flow. Transactions are entered manually and are not bank-synced.')
      ),
      el('div', { style: 'display: flex; gap: 0.5rem;' },
        el('button', { className: 'btn', onClick: () => openBudgetModal() }, 'Set Budget'),
        el('button', { className: 'btn btn-primary', onClick: () => openTransactionModal() }, '+ Transaction')
      )
    );

    // Month Selector
    const monthSelect = el('input', {
      type: 'month',
      className: 'form-input',
      style: 'width: auto;',
      value: activeFinanceMonth
    });
    monthSelect.addEventListener('change', (e) => {
      activeFinanceMonth = e.target.value;
      renderDoView();
    });

    const monthBar = el('div', { style: 'display: flex; align-items: center; gap: 0.75rem; margin-bottom: 1.5rem;' },
      el('label', { className: 'form-label', style: 'margin: 0;' }, 'Selected Month:'),
      monthSelect
    );

    // Metrics Cards
    const incCard = el('div', { className: 'card' },
      el('div', { style: 'font-size: 0.8rem; color: var(--text-muted); font-weight: 500;' }, 'Income'),
      el('div', { style: 'font-size: 1.4rem; font-weight: 700; color: var(--success); margin-top: 4px;' }, formatCurrency(summary.income, currency))
    );
    const expCard = el('div', { className: 'card' },
      el('div', { style: 'font-size: 0.8rem; color: var(--text-muted); font-weight: 500;' }, 'Expenses'),
      el('div', { style: 'font-size: 1.4rem; font-weight: 700; color: var(--danger); margin-top: 4px;' }, formatCurrency(summary.expense, currency))
    );
    const netCard = el('div', { className: 'card' },
      el('div', { style: 'font-size: 0.8rem; color: var(--text-muted); font-weight: 500;' }, 'Net Cash Flow'),
      el('div', { style: `font-size: 1.4rem; font-weight: 700; color: ${summary.net >= 0 ? 'var(--text)' : 'var(--danger)'}; margin-top: 4px;` }, formatCurrency(summary.net, currency))
    );
    const metricsGrid = el('div', { className: 'grid-3', style: 'margin-bottom: 1.5rem;' }, incCard, expCard, netCard);

    // Budget bar if limit exists
    let budgetCard = null;
    if (summary.budgetLimit !== null) {
      const isOver = summary.expense > summary.budgetLimit;
      const budgetPct = Math.min(100, Math.round((summary.expense / summary.budgetLimit) * 100));
      budgetCard = el('div', { className: 'card', style: 'margin-bottom: 1.5rem;' },
        el('div', { style: 'display: flex; justify-content: space-between; font-size: 0.85rem; margin-bottom: 6px;' },
          el('span', {}, `Monthly Budget: ${formatCurrency(summary.budgetLimit, currency)}`),
          el('span', { style: `font-weight: 600; color: ${isOver ? 'var(--danger)' : 'var(--success)'};` },
            !isOver
              ? `${formatCurrency(summary.budgetRemaining, currency)} remaining`
              : `${formatCurrency(Math.abs(summary.budgetRemaining), currency)} over budget`
          )
        ),
        el('div', { className: 'progress-bar-wrap' },
          el('div', { className: 'progress-bar-fill', style: `width: ${budgetPct}%; background: ${isOver ? 'var(--danger)' : 'var(--accent)'};` })
        )
      );
    }

    // Transactions list
    const monthTx = storage.state.transactions
      .filter(t => t.date.startsWith(activeFinanceMonth))
      .sort((a, b) => b.date.localeCompare(a.date));

    const txList = el('div', {});
    if (monthTx.length === 0) {
      txList.appendChild(el('div', { className: 'empty-state' },
        el('div', { className: 'empty-state-title' }, 'No transactions recorded'),
        el('p', { className: 'empty-state-text' }, `Add manual expense or income entries for ${activeFinanceMonth}.`)
      ));
    } else {
      monthTx.forEach(tx => {
        const isInc = tx.type === 'income';

        const editBtn = el('button', {
          className: 'btn-icon btn-sm',
          title: 'Edit transaction',
          'aria-label': `Edit transaction ${tx.category}`,
          onClick: () => openTransactionModal(tx)
        }, iconSvg('<path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>', 'icon icon-sm'));

        const delBtn = el('button', {
          className: 'btn-icon btn-sm',
          title: 'Delete transaction',
          'aria-label': `Delete transaction ${tx.category}`,
          onClick: () => {
            showModalDialog({
              title: 'Delete Transaction',
              isDanger: true,
              confirmText: 'Delete Transaction',
              renderBody: (body) => {
                body.appendChild(el('p', { style: 'font-size: 0.9rem;' }, `Are you sure you want to delete this ${tx.type} transaction?`));
                body.appendChild(el('p', { style: 'font-size: 0.85rem; color: var(--text-muted); margin-top: 0.5rem;' },
                  `${tx.category} · ${formatCurrency(tx.amount, currency)} on ${formatLocalDateReadable(tx.date)}. Other transactions remain untouched.`
                ));
              },
              onConfirm: () => {
                storage.state.transactions = storage.state.transactions.filter(item => item.id !== tx.id);
                persist();
                renderApp();
              }
            });
          }
        }, iconSvg(ICONS.trash, 'icon icon-sm'));

        txList.appendChild(el('div', { className: 'task-item', style: 'align-items: center;' },
          el('div', { style: 'flex: 1;' },
            el('div', { style: 'display: flex; align-items: baseline; gap: 8px;' },
              el('span', { style: 'font-weight: 600;' }, tx.category),
              tx.note ? el('span', { style: 'font-size: 0.8rem; color: var(--text-muted);' }, `(${tx.note})`) : null
            ),
            el('div', { style: 'font-size: 0.75rem; color: var(--text-subtle);' }, formatLocalDateReadable(tx.date))
          ),
          el('div', { style: `font-weight: 700; font-size: 0.95rem; color: ${isInc ? 'var(--success)' : 'var(--danger)'};` },
            `${isInc ? '+' : '-'}${formatCurrency(tx.amount, currency)}`
          ),
          el('div', { style: 'display: flex; gap: 4px; margin-left: 8px;' }, editBtn, delBtn)
        ));
      });
    }

    const txCard = el('div', { className: 'card' },
      el('h3', { style: 'font-size: 1rem; font-weight: 600; margin-bottom: 1rem;' }, `Transactions for ${activeFinanceMonth}`),
      txList
    );

    container.appendChild(header);
    container.appendChild(monthBar);
    container.appendChild(metricsGrid);
    if (budgetCard) container.appendChild(budgetCard);
    container.appendChild(txCard);
  }

  function openTransactionModal(tx = null) {
    const isEdit = !!tx;
    const currency = storage.state.preferences.currency || 'USD';
    const config = getCurrencyConfig(currency);

    showModalDialog({
      title: isEdit ? 'Edit Transaction' : 'Record Transaction',
      confirmText: isEdit ? 'Save Changes' : 'Add Transaction',
      renderBody: (body) => {
        const typeSelect = el('select', { className: 'form-select' },
          el('option', { value: 'expense' }, 'Expense'),
          el('option', { value: 'income' }, 'Income')
        );
        if (isEdit) typeSelect.value = tx.type;

        const amountInput = el('input', {
          type: 'number',
          step: config.decimals === 0 ? '1' : '0.01',
          min: config.decimals === 0 ? '1' : '0.01',
          className: 'form-input',
          placeholder: config.decimals === 0 ? '1000' : '0.00',
          value: isEdit ? minorUnitsToDecimalString(tx.amount, currency) : '',
          required: true
        });

        const dateInput = el('input', {
          type: 'date',
          className: 'form-input',
          value: isEdit ? tx.date : getLocalDateString(),
          required: true
        });

        const categoryInput = el('input', {
          type: 'text',
          className: 'form-input',
          placeholder: 'e.g. Groceries, Rent, Salary',
          value: isEdit ? tx.category : '',
          required: true
        });

        const noteInput = el('input', {
          type: 'text',
          className: 'form-input',
          placeholder: 'Optional notes...',
          value: isEdit ? (tx.note || '') : ''
        });

        const errorEl = el('div', { className: 'form-error', style: 'display: none; color: var(--danger); font-size: 0.825rem; margin-top: 8px;' });

        body.appendChild(el('div', { className: 'form-row' },
          el('div', { className: 'form-group' }, el('label', { className: 'form-label' }, 'Type'), typeSelect),
          el('div', { className: 'form-group' }, el('label', { className: 'form-label' }, `Amount (${currency}) *`), amountInput)
        ));
        body.appendChild(el('div', { className: 'form-row' },
          el('div', { className: 'form-group' }, el('label', { className: 'form-label' }, 'Date *'), dateInput),
          el('div', { className: 'form-group' }, el('label', { className: 'form-label' }, 'Category *'), categoryInput)
        ));
        body.appendChild(el('div', { className: 'form-group' }, el('label', { className: 'form-label' }, 'Note'), noteInput));
        body.appendChild(errorEl);

        body._data = { typeSelect, amountInput, dateInput, categoryInput, noteInput, errorEl };
      },
      onConfirm: (body) => {
        const { typeSelect, amountInput, dateInput, categoryInput, noteInput, errorEl } = body._data;
        const type = typeSelect.value;
        const amountCents = decimalToMinorUnits(amountInput.value, currency);
        const date = dateInput.value;
        const category = categoryInput.value.trim();

        if (amountCents === null || amountCents <= 0) {
          errorEl.textContent = 'Please enter a valid positive transaction amount.';
          errorEl.style.display = 'block';
          amountInput.focus();
          return false;
        }
        if (!date) {
          errorEl.textContent = 'Date is required.';
          errorEl.style.display = 'block';
          dateInput.focus();
          return false;
        }
        if (!category) {
          errorEl.textContent = 'Category is required.';
          errorEl.style.display = 'block';
          categoryInput.focus();
          return false;
        }

        if (isEdit) {
          tx.type = type;
          tx.amount = amountCents;
          tx.date = date;
          tx.category = category;
          tx.note = noteInput.value.trim();
          tx.updatedAt = new Date().toISOString();
        } else {
          storage.state.transactions.push({
            id: generateId('tx'),
            type,
            amount: amountCents,
            date,
            category,
            note: noteInput.value.trim(),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          });
        }

        persist();
        renderApp();
        return true;
      }
    });
  }

  function openBudgetModal() {
    const currency = storage.state.preferences.currency || 'USD';
    const config = getCurrencyConfig(currency);
    const existing = storage.state.budgets.find(b => b.month === activeFinanceMonth);
    const currentVal = existing ? minorUnitsToDecimalString(existing.limit, currency) : '';

    showModalDialog({
      title: `Monthly Budget (${activeFinanceMonth})`,
      confirmText: 'Save Budget',
      renderBody: (body) => {
        const budgetInput = el('input', {
          type: 'number',
          className: 'form-input',
          step: config.decimals === 0 ? '1' : '1',
          min: '0',
          placeholder: config.decimals === 0 ? '200000' : '2000.00',
          value: currentVal
        });

        body.appendChild(el('div', { className: 'form-group' },
          el('label', { className: 'form-label' }, `Budget Limit (${currency})`),
          budgetInput,
          el('p', { style: 'font-size: 0.75rem; color: var(--text-muted); margin-top: 4px;' }, 'Enter a positive monthly spending limit, or clear it.')
        ));

        if (existing) {
          const deleteBudgetBtn = el('button', {
            type: 'button',
            className: 'btn btn-sm btn-danger',
            style: 'margin-top: 0.75rem;',
            onClick: () => {
              showModalDialog({
                title: 'Delete Monthly Budget',
                isDanger: true,
                confirmText: 'Delete Budget',
                renderBody: (delBody) => {
                  delBody.appendChild(el('p', { style: 'font-size: 0.9rem;' },
                    `Are you sure you want to delete the budget limit of ${formatCurrency(existing.limit, currency)} for ${activeFinanceMonth}?`
                  ));
                },
                onConfirm: () => {
                  storage.state.budgets = storage.state.budgets.filter(b => b.month !== activeFinanceMonth);
                  persist();
                  renderApp();
                }
              });
            }
          }, iconSvg(ICONS.trash, 'icon icon-sm'), 'Delete Budget for this Month');

          body.appendChild(deleteBudgetBtn);
        }

        body._budgetInput = budgetInput;
      },
      onConfirm: (body) => {
        const valStr = body._budgetInput.value.trim();
        storage.state.budgets = storage.state.budgets.filter(b => b.month !== activeFinanceMonth);

        if (valStr && parseFloat(valStr) > 0) {
          const limitUnits = decimalToMinorUnits(valStr, currency);
          if (limitUnits) {
            storage.state.budgets.push({ month: activeFinanceMonth, limit: limitUnits });
          }
        }
        persist();
        renderApp();
        return true;
      }
    });
  }

  // 10. SETTINGS & DATA MANAGEMENT
  function renderDoSettings(container) {
    const currency = storage.state.preferences.currency || 'USD';

    const header = el('div', { className: 'section-header' },
      el('div', {},
        el('h2', { className: 'section-title' }, 'Settings & Data Management'),
        el('p', { className: 'section-subtitle' }, 'Preferences, storage health diagnostics, backup, and restore')
      )
    );

    // Preferences card
    const themeSelect = el('select', { className: 'form-select' },
      el('option', { value: 'system' }, 'System (Match OS)'),
      el('option', { value: 'light' }, 'Light Theme'),
      el('option', { value: 'dark' }, 'Dark Theme')
    );
    themeSelect.value = storage.state.preferences.theme || 'system';
    themeSelect.addEventListener('change', (e) => {
      applyTheme(e.target.value);
      persist();
    });

    const viewSelect = el('select', { className: 'form-select' },
      el('option', { value: 'zen' }, 'Zen (Calm Daily Overview)'),
      el('option', { value: 'do' }, 'Dō (Expanded Management Dashboard)')
    );
    viewSelect.value = storage.state.preferences.startupView || 'zen';
    viewSelect.addEventListener('change', (e) => {
      storage.state.preferences.startupView = e.target.value;
      persist();
    });

    const currSelect = el('select', { className: 'form-select' },
      ...Object.values(SUPPORTED_CURRENCIES).map(c => el('option', { value: c.code }, `${c.code} (${c.symbol.trim()}) - ${c.name}`))
    );
    currSelect.value = currency;
    let previousCurrency = currency;

    currSelect.addEventListener('change', (e) => {
      const nextCurrency = e.target.value;
      const hasRecords = storage.state.transactions.length > 0 || storage.state.budgets.length > 0;
      if (hasRecords) {
        showModalDialog({
          title: 'Change Currency',
          confirmText: 'Change Currency',
          renderBody: (body) => {
            body.appendChild(el('p', { style: 'font-size: 0.9rem;' },
              `Change display currency from ${previousCurrency} to ${nextCurrency}?`
            ));
            body.appendChild(el('p', { style: 'font-size: 0.85rem; color: var(--text-muted); margin-top: 0.5rem; line-height: 1.45;' },
              'Note: Daylight does not convert stored financial amounts or perform live currency exchange. The selected currency controls the interpretation, symbols, and formatting for all manual transactions and budgets. Existing records are safely preserved.'
            ));
          },
          onConfirm: () => {
            previousCurrency = nextCurrency;
            storage.state.preferences.currency = nextCurrency;
            persist();
            renderApp();
          }
        });
      } else {
        previousCurrency = nextCurrency;
        storage.state.preferences.currency = nextCurrency;
        persist();
        renderApp();
      }
    });

    const prefCard = el('div', { className: 'card', style: 'margin-bottom: 1.5rem;' },
      el('h3', { style: 'font-size: 1.05rem; font-weight: 600; margin-bottom: 1rem;' }, 'Preferences'),
      el('div', { className: 'form-row', style: 'margin-bottom: 1rem;' },
        el('div', { className: 'form-group' }, el('label', { className: 'form-label' }, 'Appearance Theme'), themeSelect),
        el('div', { className: 'form-group' }, el('label', { className: 'form-label' }, 'Default Startup View'), viewSelect)
      ),
      el('div', { className: 'form-group', style: 'max-width: 320px;' },
        el('label', { className: 'form-label' }, 'Finance Currency'),
        currSelect
      )
    );

    // -------------------------------------------------------------
    // ACCENT COLOR CUSTOMIZATION SECTION
    // -------------------------------------------------------------
    const currentAccent = storage.state.preferences.accentColor;
    const resolvedTheme = resolveActiveTheme(storage.state.preferences.theme);
    const initialHex = currentAccent || (resolvedTheme === 'dark' ? DARK_THEME_DEFAULT_ACCENT : LIGHT_THEME_DEFAULT_ACCENT);

    const colorPickerInput = el('input', {
      type: 'color',
      className: 'color-input-native',
      id: 'accentColorPicker',
      value: initialHex,
      'aria-label': 'Select custom accent color via native picker'
    });

    const hexInput = el('input', {
      type: 'text',
      className: 'form-input hex-input',
      id: 'accentHexInput',
      maxLength: 7,
      value: currentAccent || initialHex,
      placeholder: '#48634E',
      'aria-label': 'Accent color in 6-digit hex format'
    });

    const hexFeedback = el('span', {
      className: 'sr-only',
      id: 'hexFeedback',
      'aria-live': 'polite'
    });

    const accentStatusText = el('span', {
      style: 'font-size: 0.8rem; color: var(--text-muted); font-weight: 500;'
    }, currentAccent ? 'Custom accent active' : 'Daylight Sage default active');

    // Preset Swatches
    const swatchesContainer = el('div', {
      className: 'accent-swatches',
      role: 'group',
      'aria-label': 'Preset accent color options'
    });

    // Representative Live Preview
    const previewBtn = el('button', {
      type: 'button',
      className: 'btn btn-primary btn-sm'
    }, 'Button Fill');

    const previewBadge = el('span', {
      className: 'nav-badge',
      style: 'background: var(--accent); color: var(--accent-text); font-weight: 600; padding: 2px 8px;'
    }, 'Badge');

    const previewCheckbox = el('input', {
      type: 'checkbox',
      checked: true,
      'aria-label': 'Preview checkbox',
      style: 'width: 17px; height: 17px; accent-color: var(--accent); cursor: default;'
    });

    const previewLink = el('span', {
      style: 'color: var(--accent-on-surface, var(--accent)); font-weight: 600; font-size: 0.85rem;'
    }, 'Text Accent');

    const previewCard = el('div', {
      id: 'accentLivePreview',
      className: 'accent-preview-card'
    },
      el('div', { className: 'accent-preview-title' }, 'Live Accent Preview'),
      el('div', { className: 'accent-preview-row' },
        previewBtn,
        previewBadge,
        el('label', { style: 'display: inline-flex; align-items: center; gap: 6px; font-size: 0.85rem; cursor: default;' },
          previewCheckbox,
          'Control'
        ),
        previewLink
      )
    );

    const updateSwatchSelection = (activeHex) => {
      const normActive = normalizeHexColor(activeHex);
      Array.from(swatchesContainer.children).forEach(btn => {
        const swatchHex = btn.getAttribute('data-hex');
        const isActive = normActive === swatchHex;
        if (isActive) {
          btn.classList.add('active');
          btn.setAttribute('aria-pressed', 'true');
          btn.innerHTML = '';
          btn.appendChild(iconSvg('<polyline points="20 6 9 17 4 12"></polyline>', 'swatch-check'));
        } else {
          btn.classList.remove('active');
          btn.setAttribute('aria-pressed', 'false');
          btn.innerHTML = '';
        }
      });
    };

    ACCENT_PRESETS.forEach(preset => {
      const isSelected = (currentAccent && normalizeHexColor(currentAccent) === preset.hex) ||
        (!currentAccent && preset.hex === LIGHT_THEME_DEFAULT_ACCENT);
      const sBtn = el('button', {
        type: 'button',
        className: `swatch-btn ${isSelected ? 'active' : ''}`,
        style: `background-color: ${preset.hex}; color: ${getReadableForeground(preset.hex)};`,
        'data-hex': preset.hex,
        'aria-label': `Select ${preset.name} accent (${preset.hex})`,
        'aria-pressed': isSelected ? 'true' : 'false',
        onClick: () => {
          applyCustomAccent(preset.hex, true);
        }
      });
      if (isSelected) {
        sBtn.appendChild(iconSvg('<polyline points="20 6 9 17 4 12"></polyline>', 'swatch-check'));
      }
      swatchesContainer.appendChild(sBtn);
    });

    const applyCustomAccent = (hexVal, shouldPersist = false) => {
      const norm = normalizeHexColor(hexVal);
      if (!norm) return false;
      const theme = resolveActiveTheme(storage.state.preferences.theme);
      applyAccentTokens(norm, theme);

      colorPickerInput.value = norm;
      hexInput.value = norm;
      hexInput.classList.remove('invalid');
      updateSwatchSelection(norm);
      accentStatusText.textContent = 'Custom accent active';

      if (shouldPersist) {
        storage.state.preferences.accentColor = norm;
        const res = persist();
        if (res.success) {
          announce(`Accent color set to ${norm}`);
        }
      }
      return true;
    };

    const resetToDefaultSage = () => {
      storage.state.preferences.accentColor = null;
      const theme = resolveActiveTheme(storage.state.preferences.theme);
      const defaultHex = theme === 'dark' ? DARK_THEME_DEFAULT_ACCENT : LIGHT_THEME_DEFAULT_ACCENT;
      applyAccentTokens(null, theme);

      colorPickerInput.value = defaultHex;
      hexInput.value = defaultHex;
      hexInput.classList.remove('invalid');
      updateSwatchSelection(LIGHT_THEME_DEFAULT_ACCENT);
      accentStatusText.textContent = 'Daylight Sage default active';

      const res = persist();
      if (res.success) {
        announce('Accent reset to Daylight Sage default.');
      }
    };

    colorPickerInput.addEventListener('input', (e) => {
      applyCustomAccent(e.target.value, false);
    });
    colorPickerInput.addEventListener('change', (e) => {
      applyCustomAccent(e.target.value, true);
    });

    hexInput.addEventListener('input', (e) => {
      const val = e.target.value.trim();
      if (isValidHexColor(val)) {
        applyCustomAccent(val, false);
      }
    });
    hexInput.addEventListener('change', (e) => {
      const val = e.target.value.trim();
      if (isValidHexColor(val)) {
        applyCustomAccent(val, true);
      } else {
        hexInput.classList.add('invalid');
        hexFeedback.textContent = 'Invalid hex color code. Enter 6-digit hex like #48634E.';
        const theme = resolveActiveTheme(storage.state.preferences.theme);
        const curr = storage.state.preferences.accentColor || (theme === 'dark' ? DARK_THEME_DEFAULT_ACCENT : LIGHT_THEME_DEFAULT_ACCENT);
        hexInput.value = curr;
        setTimeout(() => hexInput.classList.remove('invalid'), 1200);
      }
    });

    const resetAccentBtn = el('button', {
      type: 'button',
      className: 'btn btn-sm btn-subtle',
      id: 'btnResetAccent',
      onClick: resetToDefaultSage
    },
      iconSvg('<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path><polyline points="3 3 3 8 8 8"></polyline>', 'icon icon-sm'),
      'Reset to Daylight Sage'
    );

    const accentCard = el('div', { className: 'card accent-picker-section', style: 'margin-bottom: 1.5rem;' },
      el('div', { style: 'display: flex; align-items: flex-start; justify-content: space-between; flex-wrap: wrap; gap: 0.5rem;' },
        el('div', {},
          el('h3', { style: 'font-size: 1.05rem; font-weight: 600; margin-bottom: 0.25rem;' }, 'Accent Color'),
          el('p', { className: 'accent-help-note' },
            'Personalize your interface accent. Shades automatically adapt for WCAG AA readability in light and dark themes.'
          )
        ),
        accentStatusText
      ),
      el('div', { className: 'accent-controls-row' },
        el('div', { className: 'color-picker-native-wrap' },
          colorPickerInput,
          el('div', { className: 'hex-input-wrap' },
            el('label', { htmlFor: 'accentHexInput', className: 'form-label', style: 'margin: 0; font-size: 0.8rem;' }, 'Hex:'),
            hexInput,
            hexFeedback
          )
        ),
        resetAccentBtn
      ),
      el('div', { className: 'form-group' },
        el('label', { className: 'form-label', style: 'margin-bottom: 0.4rem;' }, 'Presets'),
        swatchesContainer
      ),
      previewCard
    );

    // Diagnostics & Backup card
    const fileInput = el('input', { type: 'file', accept: '.json', style: 'display: none;' });
    fileInput.addEventListener('change', (e) => {
      const file = e.target.files && e.target.files[0];
      handleFileRestore(file);
      e.target.value = '';
    });

    const exportBtn = el('button', { className: 'btn btn-primary', onClick: exportBackup },
      iconSvg('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line>', 'icon icon-sm'),
      'Export JSON Backup'
    );

    const importBtn = el('button', { className: 'btn', onClick: () => fileInput.click() },
      iconSvg('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line>', 'icon icon-sm'),
      'Restore from JSON Backup'
    );

    const downloadReleaseBtn = el('a', {
      className: 'btn btn-subtle',
      href: '/Daylight-v1.2.0.zip',
      download: 'Daylight-v1.2.0.zip',
      title: 'Download standalone offline release package (Daylight-v1.2.0.zip)'
    },
      iconSvg('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line>', 'icon icon-sm'),
      'Download Daylight v1.2.0 ZIP'
    );

    const storageCard = el('div', { className: 'card', style: 'margin-bottom: 1.5rem;' },
      fileInput,
      el('h3', { style: 'font-size: 1.05rem; font-weight: 600; margin-bottom: 0.5rem;' }, 'Local Storage & Backups'),
      el('p', { style: 'font-size: 0.85rem; color: var(--text-muted); margin-bottom: 1.25rem;' },
        'Daylight operates 100% locally on your machine. Your data is stored in your browser\'s local sandbox and is never transmitted over any network.'
      ),
      el('div', { style: 'background: var(--bg); border: 1px solid var(--border); border-radius: var(--radius-md); padding: 1rem; margin-bottom: 1.25rem;' },
        el('div', { style: 'font-size: 0.85rem; font-weight: 600; margin-bottom: 0.4rem;' }, 'Storage Diagnostics:'),
        el('ul', { style: 'font-size: 0.8rem; color: var(--text-muted); line-height: 1.6; padding-left: 1.25rem;' },
          el('li', {}, `Persistence Status: ${storage.status.toUpperCase()}`),
          el('li', {}, `Active Schema: Version ${storage.state.schemaVersion}`),
          el('li', {}, `Total Tasks: ${storage.state.tasks.length} | Projects: ${storage.state.projects.length} | Events: ${storage.state.events.length}`),
          el('li', {}, `Habits: ${storage.state.habits.length} | Goals: ${storage.state.goals.length} | Notes: ${storage.state.notes.length}`)
        )
      ),
      el('div', { style: 'display: flex; flex-wrap: wrap; gap: 0.75rem;' }, exportBtn, importBtn, downloadReleaseBtn)
    );

    // Danger Zone
    const resetBtn = el('button', { className: 'btn btn-danger', onClick: handleResetAll }, 'Reset All Data');
    const dangerCard = el('div', { className: 'card', style: 'border-color: rgba(163, 40, 40, 0.3);' },
      el('h3', { style: 'font-size: 1.05rem; font-weight: 600; color: var(--danger); margin-bottom: 0.5rem;' }, 'Danger Zone'),
      el('p', { style: 'font-size: 0.85rem; color: var(--text-muted); margin-bottom: 1rem;' },
        'Reset all application records to a clean slate. An automatic backup will be exported first for safety.'
      ),
      resetBtn
    );

    container.appendChild(header);
    container.appendChild(prefCard);
    container.appendChild(accentCard);
    container.appendChild(storageCard);
    container.appendChild(dangerCard);
  }

  // Priority Manager Modal (Zen & Dō)
  function openPriorityManagerModal() {
    const pendingTasks = storage.state.tasks.filter(t => !t.completed);
    showModalDialog({
      title: "Select Today's Top Priorities (Max 3)",
      confirmText: 'Update Priorities',
      renderBody: (body) => {
        body.appendChild(el('p', { style: 'font-size: 0.85rem; color: var(--text-muted); margin-bottom: 0.75rem;' },
          'Choose up to three key focus items for your daily Zen overview.'
        ));
        const list = el('div', { style: 'max-height: 240px; overflow-y: auto;' });
        if (pendingTasks.length === 0) {
          list.appendChild(el('p', { style: 'font-size: 0.85rem; color: var(--text-muted);' }, 'No active tasks available to select.'));
        } else {
          pendingTasks.forEach(t => {
            const chk = el('input', {
              type: 'checkbox',
              checked: Boolean(t.isTopPriority),
              'data-id': t.id,
              className: 'pri-checkbox'
            });
            list.appendChild(el('label', { style: 'display: flex; align-items: center; gap: 8px; padding: 6px 0; font-size: 0.875rem; cursor: pointer;' },
              chk,
              el('span', {}, t.title),
              t.dueDate ? el('span', { className: 'tag', style: 'margin-left: auto;' }, t.dueDate) : null
            ));
          });
        }
        const errorEl = el('div', { className: 'form-error', style: 'display: none; color: var(--danger); font-size: 0.825rem; margin-top: 8px;' });
        body.appendChild(list);
        body.appendChild(errorEl);
        body._list = list;
        body._errorEl = errorEl;
      },
      onConfirm: (body) => {
        const checked = Array.from(body._list.querySelectorAll('.pri-checkbox:checked'));
        if (checked.length > 3) {
          body._errorEl.textContent = 'Please select at most 3 top priorities.';
          body._errorEl.style.display = 'block';
          return false;
        }
        const selectedIds = new Set(checked.map(c => c.getAttribute('data-id')));
        storage.state.tasks.forEach(t => {
          t.isTopPriority = selectedIds.has(t.id);
        });
        persist();
        renderApp();
        return true;
      }
    });
  }

  // -------------------------------------------------------------
  // VIEW SWITCHING
  // -------------------------------------------------------------
  function closeMobileSidebar() {
    const sidebar = document.getElementById('doSidebar');
    const backdrop = document.getElementById('doBackdrop');
    if (sidebar) sidebar.classList.remove('mobile-open');
    if (backdrop) backdrop.classList.remove('active');
    if (btnMobile) btnMobile.setAttribute('aria-expanded', 'false');
  }

  function toggleMobileSidebar() {
    const sidebar = document.getElementById('doSidebar');
    const backdrop = document.getElementById('doBackdrop');
    if (!sidebar) return;
    const isOpen = sidebar.classList.toggle('mobile-open');
    if (backdrop) {
      if (isOpen) backdrop.classList.add('active');
      else backdrop.classList.remove('active');
    }
    if (btnMobile) btnMobile.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
  }

  function switchView(viewName) {
    currentView = viewName;
    storage.state.preferences.startupView = viewName;
    persist();
    closeMobileSidebar();
    if (typeof document !== 'undefined' && document.documentElement) {
      document.documentElement.setAttribute('data-view', viewName);
    }
    const btnZen = document.getElementById('btnModeZen');
    const btnDo = document.getElementById('btnModeDo');
    const zenEl = document.getElementById('viewZen');
    const doEl = document.getElementById('viewDo');

    if (viewName === 'zen') {
      if (btnZen) { btnZen.classList.add('active'); btnZen.setAttribute('aria-selected', 'true'); }
      if (btnDo) { btnDo.classList.remove('active'); btnDo.setAttribute('aria-selected', 'false'); }
      if (zenEl) zenEl.style.display = 'flex';
      if (doEl) doEl.style.display = 'none';
      if (btnMobile) {
        btnMobile.style.display = 'none';
        btnMobile.setAttribute('aria-hidden', 'true');
        btnMobile.setAttribute('tabindex', '-1');
      }
    } else {
      if (btnDo) { btnDo.classList.add('active'); btnDo.setAttribute('aria-selected', 'true'); }
      if (btnZen) { btnZen.classList.remove('active'); btnZen.setAttribute('aria-selected', 'false'); }
      if (zenEl) zenEl.style.display = 'none';
      if (doEl) doEl.style.display = 'flex';
      if (btnMobile) {
        btnMobile.style.removeProperty('display');
        btnMobile.removeAttribute('aria-hidden');
        btnMobile.removeAttribute('tabindex');
      }
    }
    renderApp();
  }

  function switchDoSection(secName) {
    activeSection = secName;
    storage.state.preferences.activeSection = secName;
    persist();
    closeMobileSidebar();
    renderDoView();
  }

  function renderApp() {
    updateStorageStatusUI();
    if (currentView === 'zen') {
      renderZenView();
    } else {
      renderDoView();
    }
  }

  // Bind top bar buttons
  const btnBrandHome = document.getElementById('btnBrandHome');
  const btnZen = document.getElementById('btnModeZen');
  const btnDo = document.getElementById('btnModeDo');
  const btnTheme = document.getElementById('btnThemeToggle');
  const btnSettings = document.getElementById('btnOpenSettings');
  const btnMobile = document.getElementById('btnMobileNav');

  if (btnBrandHome) {
    btnBrandHome.addEventListener('click', () => {
      closeMobileSidebar();
      if (currentView === 'do') {
        switchDoSection('today');
        const content = document.getElementById('doContent');
        if (content) {
          content.scrollTo({ top: 0, behavior: 'smooth' });
          try { content.focus(); } catch {}
        }
      }
    });
  }

  if (btnZen) btnZen.addEventListener('click', () => switchView('zen'));
  if (btnDo) btnDo.addEventListener('click', () => switchView('do'));
  if (btnTheme) btnTheme.addEventListener('click', () => {
    const curr = storage.state.preferences.theme || 'system';
    const next = curr === 'system' ? 'light' : curr === 'light' ? 'dark' : 'system';
    applyTheme(next);
    persist();
  });
  if (btnSettings) btnSettings.addEventListener('click', () => {
    switchView('do');
    switchDoSection('settings');
  });
  if (btnMobile) {
    btnMobile.setAttribute('aria-expanded', 'false');
    btnMobile.addEventListener('click', toggleMobileSidebar);
  }

  const doBackdropEl = document.getElementById('doBackdrop');
  if (doBackdropEl) {
    doBackdropEl.addEventListener('click', closeMobileSidebar);
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        const sidebar = document.getElementById('doSidebar');
        if (sidebar && sidebar.classList.contains('mobile-open')) {
          closeMobileSidebar();
          if (btnMobile) btnMobile.focus();
        }
      }
    });
  }

  const sidebar = document.getElementById('doSidebar');
  if (sidebar) {
    sidebar.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-section]');
      if (btn) {
        switchDoSection(btn.getAttribute('data-section'));
      }
    });
  }

  // Recovery banner listeners
  const btnBannerExport = document.getElementById('btnBannerExport');
  const btnRawExport = document.getElementById('btnRawExport');
  const btnRecoveryFresh = document.getElementById('btnRecoveryStartFresh');

  if (btnBannerExport) btnBannerExport.addEventListener('click', exportBackup);
  if (btnRawExport) btnRawExport.addEventListener('click', exportRawRecovery);
  if (btnRecoveryFresh) btnRecoveryFresh.addEventListener('click', () => {
    showModalDialog({
      title: 'Discard Corrupted Data',
      isDanger: true,
      confirmText: 'Export Raw Copy & Start Fresh',
      renderBody: (body) => {
        body.appendChild(el('p', { style: 'font-size: 0.9rem;' },
          'Discard corrupted data and start fresh? A copy of the raw corrupted payload will be exported to your downloads first.'
        ));
      },
      onConfirm: () => {
        exportRawRecovery();
        storage.reset();
        renderApp();
      }
    });
  });

  // Apply preferences
  applyTheme(storage.state.preferences.theme || 'system');
  updateStorageStatusUI();
  switchView(currentView);

  return { storage, renderApp, switchView, switchDoSection };
}
