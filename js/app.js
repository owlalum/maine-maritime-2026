(function () {
  'use strict';

  const TABS = ['today', 'timeline', 'bookings', 'expenses', 'info'];
  const STORAGE_KEY = 'mm2026:active-tab';
  const TODAY_OVERRIDE_KEY = 'mm2026:today-override';
  const DEFAULT_TAB = 'today';

  // ---- Date helpers ----------------------------------------------------

  function getTodayISO() {
    try {
      const ov = localStorage.getItem(TODAY_OVERRIDE_KEY);
      if (ov && /^\d{4}-\d{2}-\d{2}$/.test(ov)) return ov;
    } catch (e) { /* ignore */ }
    const d = new Date();
    return d.getFullYear() + '-' +
      String(d.getMonth() + 1).padStart(2, '0') + '-' +
      String(d.getDate()).padStart(2, '0');
  }

  function daysBetween(fromISO, toISO) {
    const a = new Date(fromISO + 'T00:00:00');
    const b = new Date(toISO + 'T00:00:00');
    return Math.round((b - a) / 86400000);
  }

  function escapeHtml(value) {
    const div = document.createElement('div');
    div.textContent = value == null ? '' : String(value);
    return div.innerHTML;
  }

  // ---- Today tab -------------------------------------------------------

  function findTodayContext() {
    const trip = window.TRIP;
    if (!trip || !Array.isArray(trip.days) || trip.days.length === 0) return null;

    const today = getTodayISO();
    const days = trip.days;
    const tripStart = days[0].date;
    const tripEnd = days[days.length - 1].date;

    if (today < tripStart) {
      return { mode: 'pre', day: days[0], daysUntil: daysBetween(today, tripStart), todayISO: today };
    }
    if (today > tripEnd) {
      return { mode: 'post', day: days[days.length - 1], daysSince: daysBetween(tripEnd, today), todayISO: today };
    }
    const match = days.find(function (d) { return d.date === today; });
    return { mode: 'live', day: match || days[0], todayISO: today };
  }

  function statusBannerHtml(ctx) {
    if (ctx.mode === 'pre') {
      const t = ctx.daysUntil;
      const label = t === 0 ? 'Today' : t === 1 ? 'Tomorrow' : 'T-' + t + ' days';
      return '<div class="trip-status trip-status--pre" role="status">' +
        '<span class="trip-status-label">' + escapeHtml(label) + '</span>' +
        '<span class="trip-status-text">Trip starts ' + escapeHtml(ctx.day.dateDisplay) + '</span>' +
        '</div>';
    }
    if (ctx.mode === 'post') {
      return '<div class="trip-status trip-status--post" role="status">' +
        '<span class="trip-status-label">Trip complete</span>' +
        '<span class="trip-status-text">Returned home ' + escapeHtml(ctx.day.dateDisplay) + '</span>' +
        '</div>';
    }
    return '';
  }

  const ICON_PIN =
    '<svg class="day-meta-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
    '<path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" stroke="currentColor" stroke-width="1.8" fill="none"/>' +
    '<circle cx="12" cy="9" r="2.5" stroke="currentColor" stroke-width="1.8" fill="none"/>' +
    '</svg>';

  const ICON_BED =
    '<svg class="day-meta-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
    '<path d="M3 18V8a2 2 0 012-2h14a2 2 0 012 2v10M3 18h18M3 18v3M21 18v3M7 14h10M7 11h10" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" fill="none"/>' +
    '</svg>';

  const ICON_CAR =
    '<svg class="day-meta-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
    '<path d="M3 13l2-6h14l2 6M3 13v5h2v-2h14v2h2v-5M3 13h18" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" fill="none"/>' +
    '<circle cx="7.5" cy="15" r="1.2" fill="currentColor"/>' +
    '<circle cx="16.5" cy="15" r="1.2" fill="currentColor"/>' +
    '</svg>';

  function dayHeroHtml(day, totalDays) {
    const meta = [];
    if (day.location) {
      meta.push('<li class="day-meta-item">' + ICON_PIN +
        '<span>' + escapeHtml(day.location) + '</span></li>');
    }
    if (day.hotel) {
      meta.push('<li class="day-meta-item">' + ICON_BED +
        '<span>' + escapeHtml(day.hotel) + '</span></li>');
    }
    if (day.driving) {
      meta.push('<li class="day-meta-item">' + ICON_CAR +
        '<span>' + escapeHtml(day.driving) + '</span></li>');
    }

    return '<article class="day-hero">' +
      '<p class="card-eyebrow">Day ' + day.dayNum + ' of ' + totalDays + '</p>' +
      '<p class="day-hero-date">' + escapeHtml(day.dateDisplay) + '</p>' +
      '<h2 class="day-hero-title">' + escapeHtml(day.title) + '</h2>' +
      (meta.length ? '<ul class="day-meta">' + meta.join('') + '</ul>' : '') +
      '</article>';
  }

  function listSectionHtml(title, items, modifier) {
    if (!Array.isArray(items) || items.length === 0) return '';
    const cls = 'day-section' + (modifier ? ' day-section--' + modifier : '');
    const lis = items.map(function (item) {
      return '<li>' + escapeHtml(item) + '</li>';
    }).join('');
    return '<section class="' + cls + '">' +
      '<h3 class="day-section-title">' + escapeHtml(title) + '</h3>' +
      '<ul class="day-list">' + lis + '</ul>' +
      '</section>';
  }

  function renderToday() {
    const root = document.getElementById('today-content');
    if (!root) return;
    const ctx = findTodayContext();
    if (!ctx) {
      root.innerHTML = '<article class="card placeholder">' +
        '<p class="card-eyebrow">No data</p>' +
        '<h2 class="card-title">Trip data not loaded</h2>' +
        '<p class="card-body">window.TRIP is unavailable.</p></article>';
      return;
    }

    const totalDays = (window.TRIP.meta && window.TRIP.meta.days) || window.TRIP.days.length;
    let html = statusBannerHtml(ctx);
    html += dayHeroHtml(ctx.day, totalDays);
    html += listSectionHtml('Highlights', ctx.day.highlights);
    html += listSectionHtml('Meals', ctx.day.meals);
    html += listSectionHtml('Logistics', ctx.day.logistics, 'logistics');
    root.innerHTML = html;
  }

  // ---- Bookings tab ----------------------------------------------------

  const BOOKING_GROUPS = [
    { id: 'flights',    label: 'Flights',             match: function (b) { return b.category === 'flight'; } },
    { id: 'hotels',     label: 'Hotels',              match: function (b) { return b.category === 'hotel'; } },
    { id: 'transport',  label: 'Ferries & Transport', match: function (b) { return b.category === 'ferry' || b.category === 'transport'; } },
    { id: 'activities', label: 'Activities',          match: function (b) { return b.category === 'activity'; } }
  ];

  const ICON_PHONE =
    '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
    '<path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.13.96.37 1.9.72 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.91.35 1.85.59 2.81.72A2 2 0 0122 16.92z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" fill="none"/>' +
    '</svg>';

  const ICON_WARNING =
    '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
    '<path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" fill="none"/>' +
    '<line x1="12" y1="9" x2="12" y2="13" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>' +
    '<line x1="12" y1="17" x2="12.01" y2="17" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>' +
    '</svg>';

  function cleanPhone(phone) {
    return String(phone).replace(/[^\d+]/g, '');
  }

  function bookingHaystack(b) {
    return [b.name, b.conf, b.date, b.details, b.phone, b.payment].filter(Boolean).join(' ');
  }

  function diningHaystack(d) {
    return [d.name, d.conf, d.date, d.time, d.city, d.address, d.notes, d.phone].filter(Boolean).join(' ');
  }

  function confChipHtml(conf) {
    if (!conf) return '<p class="conf-chip-empty">No confirmation #</p>';
    const safe = escapeHtml(conf);
    return '<button type="button" class="conf-chip" data-conf="' + safe + '" aria-label="Copy confirmation number ' + safe + '">' +
      '<span class="conf-chip-label">Conf</span>' +
      '<span class="conf-chip-value">' + safe + '</span>' +
      '</button>';
  }

  function phoneLinkHtml(phone) {
    if (!phone) return '';
    return '<a class="booking-card-phone" href="tel:' + escapeHtml(cleanPhone(phone)) + '">' +
      ICON_PHONE + '<span>' + escapeHtml(phone) + '</span></a>';
  }

  function warningHtml(payment) {
    if (!payment) return '';
    return '<p class="booking-card-warning">' + ICON_WARNING +
      '<span>' + escapeHtml(payment) + '</span></p>';
  }

  function bookingCardHtml(b) {
    const haystack = escapeHtml(bookingHaystack(b));
    const meta = [b.date, b.amount].filter(Boolean).map(escapeHtml).join(' · ');
    return '<article class="booking-card" data-id="' + escapeHtml(b.id) + '" data-search="' + haystack + '">' +
      '<h4 class="booking-card-name">' + escapeHtml(b.name) + '</h4>' +
      '<p class="booking-card-meta">' + meta + '</p>' +
      confChipHtml(b.conf) +
      (b.details ? '<p class="booking-card-details">' + escapeHtml(b.details) + '</p>' : '') +
      phoneLinkHtml(b.phone) +
      warningHtml(b.payment) +
      '</article>';
  }

  function diningCardHtml(d) {
    const haystack = escapeHtml(diningHaystack(d));
    const meta = [d.city, d.date, d.time].filter(Boolean).map(escapeHtml).join(' · ');
    const detailsParts = [];
    if (d.address) detailsParts.push(escapeHtml(d.address));
    if (d.notes) detailsParts.push(escapeHtml(d.notes));
    const detailsHtml = detailsParts.length
      ? '<p class="booking-card-details">' + detailsParts.join(' · ') + '</p>'
      : '';
    return '<article class="booking-card" data-id="' + escapeHtml(d.id) + '" data-search="' + haystack + '">' +
      '<h4 class="booking-card-name">' + escapeHtml(d.name) + '</h4>' +
      '<p class="booking-card-meta">' + meta + '</p>' +
      confChipHtml(d.conf) +
      detailsHtml +
      phoneLinkHtml(d.phone) +
      '</article>';
  }

  function sectionHtml(id, label, cardsHtmlArr) {
    return '<section class="booking-section" id="section-' + id + '">' +
      '<button class="booking-section-header" type="button" data-target="section-' + id + '">' +
      '<span class="booking-section-title">' + escapeHtml(label) + '</span>' +
      '<span class="booking-section-count">' + cardsHtmlArr.length + '</span>' +
      '</button>' +
      '<div class="booking-section-cards">' + cardsHtmlArr.join('') + '</div>' +
      '</section>';
  }

  function renderBookings() {
    const root = document.getElementById('bookings-content');
    if (!root) return;
    if (!window.TRIP || !Array.isArray(window.TRIP.bookings)) {
      root.innerHTML = '<div class="bookings-body"><article class="card placeholder">' +
        '<p class="card-eyebrow">No data</p>' +
        '<h2 class="card-title">Bookings unavailable</h2></article></div>';
      return;
    }

    let html = '<div class="search-bar">' +
      '<input type="search" id="bookings-search" class="search-input" ' +
      'placeholder="Search bookings — name, conf #, date" ' +
      'aria-label="Search bookings" autocomplete="off" autocapitalize="off" spellcheck="false">' +
      '</div>' +
      '<div class="bookings-body">';

    BOOKING_GROUPS.forEach(function (group) {
      const items = window.TRIP.bookings.filter(group.match);
      if (items.length === 0) return;
      html += sectionHtml(group.id, group.label, items.map(bookingCardHtml));
    });

    if (Array.isArray(window.TRIP.dining) && window.TRIP.dining.length > 0) {
      html += sectionHtml('dining', 'Dining', window.TRIP.dining.map(diningCardHtml));
    }

    html += '<p class="bookings-empty" id="bookings-empty" hidden>No bookings match.</p>';
    html += '</div>';

    root.innerHTML = html;
    attachBookingsHandlers(root);
  }

  function attachBookingsHandlers(root) {
    const searchInput = root.querySelector('#bookings-search');
    if (searchInput) {
      searchInput.addEventListener('input', function (e) {
        applyBookingsFilter(e.target.value);
      });
    }
    root.querySelectorAll('.conf-chip').forEach(function (chip) {
      chip.addEventListener('click', function () { copyConf(chip); });
    });
    root.querySelectorAll('.booking-section-header').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const targetId = btn.dataset.target;
        const target = document.getElementById(targetId);
        if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });
  }

  function applyBookingsFilter(query) {
    const q = String(query || '').trim().toLowerCase();
    const cards = document.querySelectorAll('#bookings-content .booking-card');
    let visibleCount = 0;
    cards.forEach(function (card) {
      const haystack = (card.dataset.search || '').toLowerCase();
      const match = !q || haystack.indexOf(q) !== -1;
      card.hidden = !match;
      if (match) visibleCount++;
    });
    document.querySelectorAll('#bookings-content .booking-section').forEach(function (section) {
      const visible = section.querySelectorAll('.booking-card:not([hidden])').length;
      section.hidden = visible === 0;
      const countEl = section.querySelector('.booking-section-count');
      if (countEl) countEl.textContent = visible;
    });
    const empty = document.getElementById('bookings-empty');
    if (empty) empty.hidden = visibleCount > 0;
  }

  function copyConf(chip) {
    const conf = chip.dataset.conf;
    if (!conf) return;
    const valueEl = chip.querySelector('.conf-chip-value');
    if (!valueEl) return;

    function showFeedback(success) {
      if (chip._copyTimer) {
        clearTimeout(chip._copyTimer);
        chip._copyTimer = null;
      }
      const original = chip.dataset.conf;
      valueEl.textContent = success ? 'Copied!' : 'Copy failed';
      chip.classList.add(success ? 'is-copied' : 'is-copy-failed');
      chip._copyTimer = setTimeout(function () {
        valueEl.textContent = original;
        chip.classList.remove('is-copied');
        chip.classList.remove('is-copy-failed');
        chip._copyTimer = null;
      }, 1500);
    }

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(conf).then(
        function () { showFeedback(true); },
        function () { showFeedback(legacyCopy(conf)); }
      );
    } else {
      showFeedback(legacyCopy(conf));
    }
  }

  function legacyCopy(text) {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.top = '-9999px';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    } catch (e) {
      return false;
    }
  }

  // ---- Tab navigation --------------------------------------------------

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

  function initApp() {
    initTabs();
    renderToday();
    renderBookings();
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
    document.addEventListener('DOMContentLoaded', initApp);
  } else {
    initApp();
  }
  registerServiceWorker();
})();
