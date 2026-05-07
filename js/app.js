(function () {
  'use strict';

  const TABS = ['today', 'timeline', 'bookings', 'expenses', 'info'];
  const STORAGE_KEY = 'mm2026:active-tab';
  const DEFAULT_TAB = 'today';

  function readStoredTab() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return TABS.includes(stored) ? stored : DEFAULT_TAB;
    } catch (e) {
      return DEFAULT_TAB;
    }
  }

  function writeStoredTab(tab) {
    try {
      localStorage.setItem(STORAGE_KEY, tab);
    } catch (e) { /* private mode / storage disabled — ignore */ }
  }

  function setActiveTab(tab) {
    if (!TABS.includes(tab)) tab = DEFAULT_TAB;

    const sections = document.querySelectorAll('.tab-section');
    sections.forEach((section) => {
      const isActive = section.id === 'tab-' + tab;
      section.classList.toggle('is-active', isActive);
      if (isActive) {
        section.removeAttribute('hidden');
      } else {
        section.setAttribute('hidden', '');
      }
    });

    const buttons = document.querySelectorAll('.tab-button');
    buttons.forEach((button) => {
      const isActive = button.dataset.tab === tab;
      button.classList.toggle('is-active', isActive);
      button.setAttribute('aria-selected', isActive ? 'true' : 'false');
      button.setAttribute('tabindex', isActive ? '0' : '-1');
    });

    writeStoredTab(tab);
  }

  function initTabs() {
    const buttons = document.querySelectorAll('.tab-button');
    buttons.forEach((button) => {
      button.addEventListener('click', () => {
        setActiveTab(button.dataset.tab);
      });
    });
    setActiveTab(readStoredTab());
  }

  function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return;
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').catch((err) => {
        console.warn('Service worker registration failed:', err);
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initTabs);
  } else {
    initTabs();
  }
  registerServiceWorker();
})();
