import React, { useEffect } from 'react';
import '../daylight/src/styles.css';
// @ts-ignore
import { initDaylightApp } from '../daylight/src/app.js';

export default function App() {
  useEffect(() => {
    // Initialize the canonical Daylight application controller
    const app = initDaylightApp();
    return () => {
      // Clean up if needed
    };
  }, []);

  return (
    <>
      <div id="liveAnnouncer" aria-live="polite" className="sr-only"></div>

      <div id="app">
        {/* Top Bar */}
        <header className="top-bar">
          <div className="brand-wrap">
            <button id="btnMobileNav" className="btn-icon mobile-menu-btn" aria-label="Toggle navigation menu">
              <svg className="icon" viewBox="0 0 24 24"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
            </button>
            <button id="btnBrandHome" className="brand-btn" aria-label="Daylight - Return to Today Overview">
              <svg className="brand-sun-icon" viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="12" cy="12" r="4.5" fill="none" stroke="currentColor" strokeWidth="1.75" />
                <line x1="12" y1="2" x2="12" y2="4.5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
                <line x1="12" y1="19.5" x2="12" y2="22" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
                <line x1="2" y1="12" x2="4.5" y2="12" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
                <line x1="19.5" y1="12" x2="22" y2="12" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
                <line x1="4.93" y1="4.93" x2="6.7" y2="6.7" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
                <line x1="17.3" y1="17.3" x2="19.07" y2="19.07" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
                <line x1="4.93" y1="19.07" x2="6.7" y2="17.3" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
                <line x1="17.3" y1="6.7" x2="19.07" y2="4.93" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
              </svg>
              <span className="brand-name">Daylight</span>
            </button>

            {/* Quick links to standalone deliverable */}
            <div className="release-quick-links" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginLeft: '0.75rem', paddingLeft: '0.75rem', borderLeft: '1px solid var(--border)' }}>
              <a
                href="/Daylight-v1.2.1.zip"
                download="Daylight-v1.2.1.zip"
                className="btn btn-sm btn-subtle"
                style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem', textDecoration: 'none' }}
                title="Download standalone offline release package (Daylight-v1.2.1.zip)"
              >
                <svg className="icon icon-sm" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                Download ZIP File
              </a>
              <a
                href="/daylight/index.html"
                target="_blank"
                rel="noreferrer"
                className="btn btn-sm btn-subtle"
                style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem', textDecoration: 'none' }}
                title="Open single-file standalone index.html directly"
              >
                Standalone HTML ↗
              </a>
            </div>
          </div>

          {/* Mode switcher (Zen / Dō) */}
          <div className="mode-switcher" role="tablist" aria-label="View Mode">
            <button id="btnModeZen" className="mode-btn active" role="tab" aria-selected="true">
              <svg className="icon icon-sm" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><path d="M12 2a14.5 14.5 0 0 0 0 20 10 10 0 0 0 0-20"></path></svg>
              Zen
            </button>
            <button id="btnModeDo" className="mode-btn" role="tab" aria-selected="false">
              <svg className="icon icon-sm" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>
              Dō
            </button>
          </div>

          {/* Actions & Storage Badge */}
          <div className="top-actions">
            <div id="storageBadge" className="storage-indicator storage-persistent" title="Storage Status">
              <svg className="icon icon-sm" viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
              <span id="storageBadgeText">Saved</span>
            </div>
            <button id="btnThemeToggle" className="btn-icon" title="Toggle theme (Light / Dark / System)" aria-label="Toggle theme">
              <svg className="icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>
            </button>
            <button id="btnOpenSettings" className="btn-icon" title="Settings & Data Management" aria-label="Open Settings">
              <svg className="icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
            </button>
          </div>
        </header>

        {/* Persistence Warning Banner */}
        <div id="storageBanner" className="banner banner-warning" style={{ display: 'none' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <svg className="icon" viewBox="0 0 24 24"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
            <span>Storage is running in temporary memory mode. Edits may be lost when this window is closed. Export JSON backups regularly!</span>
          </div>
          <button id="btnBannerExport" className="btn btn-sm">Export Backup Now</button>
        </div>

        {/* Recovery Mode Container */}
        <div id="recoveryContainer" className="banner banner-danger" style={{ display: 'none' }}>
          <div>
            <strong>Recovery Mode:</strong> Saved data failed validation and was kept untouched.
            <button id="btnRawExport" className="btn btn-sm btn-subtle" style={{ marginLeft: '10px', color: 'inherit', textDecoration: 'underline' }}>Download Raw Payload</button>
            <button id="btnRecoveryStartFresh" className="btn btn-sm btn-danger" style={{ marginLeft: '10px' }}>Start Fresh (Discard Corrupt)</button>
          </div>
        </div>

        {/* Main Content Area */}
        <main className="main-wrapper">
          {/* 1. ZEN VIEW */}
          <section id="viewZen" className="zen-container" style={{ display: 'flex' }}>
            {/* Rendered dynamically by Daylight controller */}
          </section>

          {/* 2. DŌ VIEW */}
          <section id="viewDo" className="do-container" style={{ display: 'none' }}>
            {/* Sidebar Navigation */}
            <aside id="doSidebar" className="do-sidebar">
              <div className="nav-group-title">Overview</div>
              <button className="nav-item active" data-section="today">
                <span className="nav-item-content">
                  <svg className="icon" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                  Today
                </span>
                <span id="navBadgeToday" className="nav-badge">0</span>
              </button>

              <div className="nav-group-title">Execution</div>
              <button className="nav-item" data-section="tasks">
                <span className="nav-item-content">
                  <svg className="icon" viewBox="0 0 24 24"><polyline points="9 11 12 14 22 4"></polyline><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path></svg>
                  Tasks
                </span>
                <span id="navBadgeTasks" className="nav-badge">0</span>
              </button>
              <button className="nav-item" data-section="projects">
                <span className="nav-item-content">
                  <svg className="icon" viewBox="0 0 24 24"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
                  Projects
                </span>
                <span id="navBadgeProjects" className="nav-badge">0</span>
              </button>
              <button className="nav-item" data-section="calendar">
                <span className="nav-item-content">
                  <svg className="icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                  Calendar &amp; Agenda
                </span>
              </button>
              <button className="nav-item" data-section="habits">
                <span className="nav-item-content">
                  <svg className="icon" viewBox="0 0 24 24"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                  Habits
                </span>
                <span id="navBadgeHabits" className="nav-badge">0</span>
              </button>
              <button className="nav-item" data-section="goals">
                <span className="nav-item-content">
                  <svg className="icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="6"></circle><circle cx="12" cy="12" r="2"></circle></svg>
                  Goals &amp; Milestones
                </span>
              </button>

              <div className="nav-group-title">Knowledge &amp; Reflection</div>
              <button className="nav-item" data-section="notes">
                <span className="nav-item-content">
                  <svg className="icon" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                  Notes
                </span>
              </button>
              <button className="nav-item" data-section="journal">
                <span className="nav-item-content">
                  <svg className="icon" viewBox="0 0 24 24"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>
                  Journal
                </span>
              </button>
              <button className="nav-item" data-section="finance">
                <span className="nav-item-content">
                  <svg className="icon" viewBox="0 0 24 24"><line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>
                  Finance Tracker
                </span>
              </button>

              <div style={{ marginTop: 'auto', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
                <button className="nav-item" data-section="settings">
                  <span className="nav-item-content">
                    <svg className="icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
                    Settings &amp; Data
                  </span>
                </button>
              </div>
            </aside>

            {/* Dynamic Content Body */}
            <div id="doContent" className="do-content">
              {/* Rendered dynamically by Daylight controller */}
            </div>
          </section>
        </main>
      </div>

      {/* Global Modal Container */}
      <div id="modalContainer" style={{ display: 'none' }}></div>
    </>
  );
}
