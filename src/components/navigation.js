import { escapeHtml } from './util.js';

/** Slide-up component list so users don't have to hunt for every marker. */
export class ComponentNav {
  constructor(el, hotspots, { onSelect }) {
    this.el = el;
    el.innerHTML = `
      <div class="sheet-head">
        <h2>Components</h2>
        <button class="icon-btn" data-close aria-label="Close components list">
          <svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>
        </button>
      </div>
      <ol class="component-list">
        ${hotspots
          .map(
            (h, i) => `
          <li><button class="component-item" data-id="${h.id}">
            <span class="ci-num">${String(i + 1).padStart(2, '0')}</span>
            <span class="ci-text"><strong>${escapeHtml(h.name)}</strong><small>${escapeHtml(h.short)}</small></span>
            <span class="ci-kind ${h.linked ? 'is-linked' : 'is-visual'}" title="${h.linked ? 'Linked to 3D mesh' : 'Visual hotspot'}">${h.linked ? 'Mesh' : 'Visual'}</span>
          </button></li>`
          )
          .join('')}
      </ol>
      <p class="sheet-foot"><span class="ci-kind is-linked">Mesh</span> real part of the 3D model &nbsp; <span class="ci-kind is-visual">Visual</span> approximate location only</p>`;

    el.addEventListener('click', (e) => {
      const item = e.target.closest('.component-item');
      if (item) {
        this.hide();
        onSelect(item.dataset.id);
      } else if (e.target.closest('[data-close]')) this.hide();
    });
  }

  setActive(id) {
    this.el.querySelectorAll('.component-item').forEach((b) => b.classList.toggle('is-active', b.dataset.id === id));
  }

  toggle() {
    this.el.classList.contains('is-open') ? this.hide() : this.show();
  }

  show() {
    this.el.classList.add('is-open');
    this.el.setAttribute('aria-hidden', 'false');
  }

  hide() {
    this.el.classList.remove('is-open');
    this.el.setAttribute('aria-hidden', 'true');
  }
}
