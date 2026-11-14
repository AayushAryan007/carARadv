import { escapeHtml, paragraphs } from './util.js';

/** Component information card (bottom sheet on phones, side card on desktop). */
export class InfoPanel {
  constructor(el, { onClose }) {
    this.el = el;
    this.onClose = onClose;
    el.addEventListener('click', (e) => {
      if (e.target.closest('[data-close]')) this.onClose?.();
    });
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.onClose?.();
    });
  }

  get isOpen() {
    return this.el.classList.contains('is-open');
  }

  show(h, index) {
    const badge = h.linked
      ? '<span class="badge badge-linked" title="Tapping the real geometry selects this part">Linked to 3D mesh</span>'
      : '<span class="badge badge-visual" title="The model has no geometry for this part; the marker shows an approximate location">Visual hotspot · approx. location</span>';

    const specs = h.specs?.length
      ? `<dl class="spec-list">${h.specs
          .map(
            (s) => `<div class="spec-row"><dt>${escapeHtml(s.label)}</dt><dd>${escapeHtml(s.value)}${
              s.placeholder ? ' <span class="tbd">placeholder</span>' : ''
            }</dd></div>`
          )
          .join('')}</dl>`
      : '';

    const image = h.image
      ? `<figure class="panel-figure"><img src="${h.image}" alt="${escapeHtml(h.name)}" loading="lazy" onerror="this.parentElement.remove()"></figure>`
      : '';

    this.el.innerHTML = `
      <div class="panel-handle" data-close aria-hidden="true"></div>
      <header class="panel-head">
        <span class="panel-index">${String(index + 1).padStart(2, '0')}</span>
        <div class="panel-titles">
          <h2 id="panel-title">${escapeHtml(h.name)}</h2>
          <p class="panel-short">${escapeHtml(h.short)}</p>
        </div>
        <button class="icon-btn" data-close aria-label="Close and return to full car">
          <svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>
        </button>
      </header>
      <div class="panel-body">
        ${badge}
        ${image}
        <div class="panel-text">${paragraphs(h.details)}</div>
        ${specs ? `<h3 class="panel-sub">Specifications</h3>${specs}` : ''}
      </div>`;
    this.el.classList.add('is-open');
    this.el.setAttribute('aria-hidden', 'false');
    this.el.querySelector('.panel-body').scrollTop = 0;
  }

  hide() {
    this.el.classList.remove('is-open');
    this.el.setAttribute('aria-hidden', 'true');
  }
}
