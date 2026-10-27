/**
 * Daylight — Safe DOM Construction & Accessibility Helpers
 * 100% textContent and DOM APIs. Eliminates innerHTML injection vulnerabilities.
 */

export function el(tag, attrs = {}, ...children) {
  const element = document.createElement(tag);

  for (const [key, val] of Object.entries(attrs)) {
    if (val === undefined || val === null) continue;

    if (key.startsWith('on') && typeof val === 'function') {
      const eventName = key.slice(2).toLowerCase();
      element.addEventListener(eventName, val);
    } else if (key === 'className') {
      element.className = val;
    } else if (key === 'checked' && tag === 'input') {
      element.checked = Boolean(val);
    } else if (key === 'value' && (tag === 'input' || tag === 'textarea' || tag === 'select')) {
      element.value = val;
    } else if (key === 'disabled') {
      element.disabled = Boolean(val);
    } else {
      element.setAttribute(key, String(val));
    }
  }

  for (const child of children.flat(Infinity)) {
    if (child === undefined || child === null || child === false) continue;
    if (typeof child === 'string' || typeof child === 'number') {
      element.appendChild(document.createTextNode(String(child)));
    } else if (child instanceof Node) {
      element.appendChild(child);
    }
  }

  return element;
}

export function iconSvg(content, className = 'icon', viewBox = '0 0 24 24') {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', className);
  svg.setAttribute('viewBox', viewBox);
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke-width', '1.75');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');

  if (typeof content === 'string') {
    // Parser for basic SVG paths/lines
    const parser = new DOMParser();
    const doc = parser.parseFromString(`<svg xmlns="http://www.w3.org/2000/svg">${content}</svg>`, 'image/svg+xml');
    const childNodes = Array.from(doc.documentElement.childNodes);
    childNodes.forEach(node => {
      svg.appendChild(document.importNode(node, true));
    });
  } else if (Array.isArray(content)) {
    content.forEach(c => svg.appendChild(c));
  }
  return svg;
}

export const ICONS = {
  sun: '<circle cx="12" cy="12" r="4.5"></circle><line x1="12" y1="2" x2="12" y2="4.5"></line><line x1="12" y1="19.5" x2="12" y2="22"></line><line x1="2" y1="12" x2="4.5" y2="12"></line><line x1="19.5" y1="12" x2="22" y2="12"></line><line x1="4.93" y1="4.93" x2="6.7" y2="6.7"></line><line x1="17.3" y1="17.3" x2="19.07" y2="19.07"></line><line x1="4.93" y1="19.07" x2="6.7" y2="17.3"></line><line x1="17.3" y1="6.7" x2="19.07" y2="4.93"></line>',
  calendar: '<rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line>',
  folder: '<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>',
  flame: '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"></path>',
  pin: '<line x1="12" y1="17" x2="12" y2="22"></line><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a1 1 0 0 0 0-2H8a1 1 0 0 0 0 2h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z"></path>',
  check: '<polyline points="20 6 9 17 4 12"></polyline>',
  edit: '<path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>',
  trash: '<polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>',
  close: '<line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line>',
  plus: '<line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line>',
  chevronRight: '<polyline points="9 18 15 12 9 6"></polyline>',
  chevronDown: '<polyline points="6 9 12 15 18 9"></polyline>'
};

/**
 * Accessible Modal with Focus Trap & Focus Restoration
 */
export function showModalDialog({
  title,
  renderBody,
  onConfirm,
  confirmText = 'Save',
  cancelText = 'Cancel',
  isDanger = false,
  triggerElement = null
}) {
  const container = document.getElementById('modalContainer');
  if (!container) return;

  container.innerHTML = '';
  container.style.display = 'block';

  const backdrop = el('div', { className: 'modal-backdrop' });
  const modal = el('div', {
    className: 'modal',
    role: 'dialog',
    'aria-modal': 'true',
    'aria-labelledby': 'modalTitle'
  });

  const titleEl = el('h3', { id: 'modalTitle', className: 'modal-title' }, title);
  const closeBtn = el('button', {
    className: 'btn-icon',
    'aria-label': 'Close dialog',
    onClick: () => closeModal()
  }, iconSvg('<line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line>'));

  const header = el('div', { className: 'modal-header' }, titleEl, closeBtn);
  const body = el('div', { className: 'modal-body' });

  // Call user renderBody to populate content safely
  if (typeof renderBody === 'function') {
    renderBody(body);
  }

  const cancelBtn = el('button', {
    className: 'btn',
    onClick: () => closeModal()
  }, cancelText);

  const confirmBtn = el('button', {
    className: `btn ${isDanger ? 'btn-danger' : 'btn-primary'}`,
    onClick: async () => {
      if (onConfirm) {
        const result = await onConfirm(body);
        if (result !== false) {
          closeModal();
        }
      } else {
        closeModal();
      }
    }
  }, confirmText);

  const footer = el('div', { className: 'modal-footer' }, cancelBtn, confirmBtn);

  modal.appendChild(header);
  modal.appendChild(body);
  modal.appendChild(footer);
  backdrop.appendChild(modal);
  container.appendChild(backdrop);

  // Focus management: Trap focus
  const focusableSelector = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
  const getFocusable = () => Array.from(modal.querySelectorAll(focusableSelector)).filter(el => !el.disabled);

  // Set initial focus
  const focusables = getFocusable();
  const firstInput = modal.querySelector('input:not([type="checkbox"]):not([type="radio"]), select, textarea');
  if (firstInput) {
    firstInput.focus();
  } else if (focusables.length > 0) {
    focusables[0].focus();
  }

  const keyListener = (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      closeModal();
      return;
    }
    if (e.key === 'Tab') {
      const currentFocusables = getFocusable();
      if (currentFocusables.length === 0) return;
      const first = currentFocusables[0];
      const last = currentFocusables[currentFocusables.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
  };

  document.addEventListener('keydown', keyListener);

  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) closeModal();
  });

  function closeModal() {
    document.removeEventListener('keydown', keyListener);
    container.innerHTML = '';
    container.style.display = 'none';
    if (triggerElement && typeof triggerElement.focus === 'function') {
      try { triggerElement.focus(); } catch {}
    }
  }

  return { close: closeModal };
}
