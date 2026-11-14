import { escapeHtml } from './util.js';

/** Full vehicle specification sheet (data from src/data/vehicleData.js). */
export class SpecsSheet {
  constructor(el, vehicle) {
    this.el = el;
    el.innerHTML = `
      <div class="sheet-head">
        <div>
          <p class="eyebrow">Specifications</p>
          <h2>${escapeHtml(vehicle.name)}</h2>
        </div>
        <button class="icon-btn" data-close aria-label="Close specifications">
          <svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>
        </button>
      </div>
      <p class="sheet-note">${escapeHtml(vehicle.note)}</p>
      ${vehicle.sections
        .map(
          (s) => `
        <section class="spec-section">
          <h3 class="panel-sub">${escapeHtml(s.title)}</h3>
          <dl class="spec-list">${s.items
            .map(
              (i) => `<div class="spec-row"><dt>${escapeHtml(i.label)}</dt><dd>${escapeHtml(i.value)}${
                i.placeholder ? ' <span class="tbd">placeholder</span>' : ''
              }</dd></div>`
            )
            .join('')}</dl>
        </section>`
        )
        .join('')}`;
    el.addEventListener('click', (e) => {
      if (e.target.closest('[data-close]')) this.hide();
    });
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
