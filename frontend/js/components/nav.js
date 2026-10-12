'use strict';

// Keeps a crisis-resource link present in shared navigation. SRS FR-6.1. TODO: localize all navigation labels.
export function ensureCrisisLink(navElement) {
  if (!navElement || navElement.querySelector('a[href$="crisis.html"]')) return;
  const link = document.createElement('a');
  link.href = new URL('../../pages/crisis.html', import.meta.url).pathname;
  link.dataset.i18n = 'nav.crisis';
  link.textContent = 'Crisis resources';
  navElement.append(link);
}