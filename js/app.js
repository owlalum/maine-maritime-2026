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

  // ---- Firestore sync (expenses + completed days) ----------------------

  const COMPLETED_DAYS_LEGACY_KEY = 'mm2026:completed-days'; // pre-Firestore key, migrated once
  const FIRESTORE_SEEDED_KEY = 'mm2026:firestore-seeded';

  let expenseCache = null;       // null = first snapshot pending
  let completedCache = null;     // null = first snapshot pending
  let initialExpensesReceived = false;
  let initialCompletedReceived = false;
  let expensesSubscribed = false;
  let completedSubscribed = false;

  function fb() { return window.MM2026_DB || null; }
  function fbTimestamp() {
    return window.MM2026_FB_TIMESTAMP ? window.MM2026_FB_TIMESTAMP() : null;
  }

  function isExpensesLoading() { return expenseCache === null; }
  function isCompletedLoading() { return completedCache === null; }

  // ---- Completed days (shared by Today + Timeline) ---------------------

  const ICON_CHECK =
    '<svg class="icon-check" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
    '<path d="M5 12l4.5 4.5L19 7" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" fill="none"/>' +
    '</svg>';

  const ICON_FORK =
    '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
    '<path d="M7 3v6a3 3 0 003 3v9M5 3v6M9 3v6M14 3a4 4 0 014 4v8h-3v6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" fill="none"/>' +
    '</svg>';

  const ICON_ARROW_RIGHT =
    '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
    '<path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>' +
    '</svg>';

  function getCompletedDays() {
    return Array.isArray(completedCache) ? completedCache.slice() : [];
  }

  function isDayCompleted(dayNum) {
    return Array.isArray(completedCache) && completedCache.indexOf(dayNum) !== -1;
  }

  function markDayComplete(dayNum) {
    // Optimistic UI update so taps feel instant.
    if (Array.isArray(completedCache) && completedCache.indexOf(dayNum) === -1) {
      completedCache.push(dayNum);
      completedCache.sort(function (a, b) { return a - b; });
    }
    applyCompletionUiUpdates(dayNum);

    const D = fb();
    if (!D) return;
    D.collection('trips/maine-2026/completedDays').doc(String(dayNum)).set({
      dayNum: dayNum,
      completedAt: fbTimestamp()
    }).catch(function (err) {
      console.error('Mark complete failed:', err);
    });
  }

  function applyCompletionUiUpdates(dayNum) {
    // Timeline: day card
    const card = document.getElementById('day-card-' + dayNum);
    if (card) {
      card.classList.add('is-completed');
      const cardBtn = card.querySelector('.mark-complete-btn');
      if (cardBtn && !cardBtn.classList.contains('is-completed')) {
        cardBtn.classList.add('is-completed');
        cardBtn.removeAttribute('disabled');
        cardBtn.innerHTML = ICON_CHECK + '<span>Completed — tap to undo</span>';
      }
    }
    // Timeline: jump bar
    const jumpBtn = document.querySelector('#jump-bar .jump-day[data-day="' + dayNum + '"]');
    if (jumpBtn && !jumpBtn.classList.contains('is-completed')) {
      jumpBtn.classList.add('is-completed');
      if (!jumpBtn.querySelector('.jump-day-check')) {
        jumpBtn.insertAdjacentHTML('beforeend', '<span class="jump-day-check" aria-label="completed">✓</span>');
      }
    }
    // Today tab: completion mark in eyebrow
    const todayCardDay = document.querySelector('#today-content .day-hero[data-day="' + dayNum + '"]');
    if (todayCardDay) {
      const eyebrow = todayCardDay.querySelector('.card-eyebrow');
      if (eyebrow && !eyebrow.querySelector('.completion-mark')) {
        eyebrow.insertAdjacentHTML('beforeend', ' <span class="completion-mark">✓ Completed</span>');
      }
    }
  }

  function unmarkDayComplete(dayNum) {
    // Optimistic UI update.
    if (Array.isArray(completedCache)) {
      const idx = completedCache.indexOf(dayNum);
      if (idx !== -1) completedCache.splice(idx, 1);
    }
    applyUncompletedUiUpdates(dayNum);

    const D = fb();
    if (!D) return;
    D.collection('trips/maine-2026/completedDays').doc(String(dayNum)).delete()
      .catch(function (err) {
        console.error('Unmark complete failed:', err);
      });
  }

  function applyCompletionStateToAllUi() {
    if (!Array.isArray(completedCache)) return;
    if (!window.TRIP || !Array.isArray(window.TRIP.days)) return;
    window.TRIP.days.forEach(function (day) {
      const isCompleted = completedCache.indexOf(day.dayNum) !== -1;
      if (isCompleted) {
        applyCompletionUiUpdates(day.dayNum);
      } else {
        applyUncompletedUiUpdates(day.dayNum);
      }
    });
  }

  function applyUncompletedUiUpdates(dayNum) {
    // Timeline: day card
    const card = document.getElementById('day-card-' + dayNum);
    if (card) {
      card.classList.remove('is-completed');
      const cardBtn = card.querySelector('.mark-complete-btn');
      if (cardBtn) {
        cardBtn.classList.remove('is-completed');
        cardBtn.removeAttribute('disabled');
        cardBtn.innerHTML = ICON_CHECK + '<span>Mark Complete</span>';
      }
    }
    // Timeline: jump bar
    const jumpBtn = document.querySelector('#jump-bar .jump-day[data-day="' + dayNum + '"]');
    if (jumpBtn) {
      jumpBtn.classList.remove('is-completed');
      const check = jumpBtn.querySelector('.jump-day-check');
      if (check) check.remove();
    }
    // Today tab: remove completion mark from eyebrow
    const todayCardDay = document.querySelector('#today-content .day-hero[data-day="' + dayNum + '"]');
    if (todayCardDay) {
      const mark = todayCardDay.querySelector('.completion-mark');
      if (mark) mark.remove();
    }
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

    const completed = isDayCompleted(day.dayNum);
    const completionMark = completed
      ? ' <span class="completion-mark">✓ Completed</span>'
      : '';

    return '<article class="day-hero" data-day="' + day.dayNum + '">' +
      '<p class="card-eyebrow">Day ' + day.dayNum + ' of ' + totalDays + completionMark + '</p>' +
      '<p class="day-hero-date">' + escapeHtml(day.dateDisplay) + '</p>' +
      '<h2 class="day-hero-title">' + escapeHtml(day.title) + '</h2>' +
      (meta.length ? '<ul class="day-meta">' + meta.join('') + '</ul>' : '') +
      '</article>';
  }

  function todayActionsHtml(day) {
    return '<div class="today-actions">' +
      '<button type="button" class="view-in-timeline-btn" data-day="' + day.dayNum + '">' +
      'View in Timeline ' + ICON_ARROW_RIGHT + '</button>' +
      '</div>';
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
    html += todayActionsHtml(ctx.day);
    root.innerHTML = html;

    const viewBtn = root.querySelector('.view-in-timeline-btn');
    if (viewBtn) {
      viewBtn.addEventListener('click', function () {
        const dayNum = parseInt(viewBtn.dataset.day, 10);
        setActiveTab('timeline');
        requestAnimationFrame(function () {
          scrollTimelineToDay(dayNum, true);
        });
      });
    }
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

  // ---- Expenses tab ----------------------------------------------------

  // Per-device preferences only — actual expense data lives in Firestore.
  const EXPENSES_VIEW_KEY = 'mm2026:expenses-view';
  const EXPENSES_LAST_SPLIT_KEY = 'mm2026:expenses-last-split';
  const EXPENSES_LAST_PAID_BY_KEY = 'mm2026:expenses-last-paid-by';
  const EXPENSES_LAST_CURRENCY_KEY = 'mm2026:expenses-last-currency';
  const EXPENSES_BREAKDOWN_SORT_KEY = 'mm2026:expenses-breakdown-sort';
  const EXPENSES_SHOW_VOIDED_KEY = 'mm2026:show-voided';

  // Per-card UI state (cleared on Save / Cancel / page reload)
  let editingId = null;
  let voidConfirmId = null;

  const ICON_PENCIL =
    '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
    '<path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 000-1.41l-2.34-2.34a1 1 0 00-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>' +
    '</svg>';

  const ICON_X =
    '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
    '<line x1="6" y1="6" x2="18" y2="18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>' +
    '<line x1="6" y1="18" x2="18" y2="6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>' +
    '</svg>';

  function readShowVoided() {
    try { return localStorage.getItem(EXPENSES_SHOW_VOIDED_KEY) === '1'; } catch (e) { return false; }
  }
  function writeShowVoided(v) {
    try { localStorage.setItem(EXPENSES_SHOW_VOIDED_KEY, v ? '1' : '0'); } catch (e) {}
  }

  function isAnyCardEditing() {
    return editingId !== null;
  }

  const SPLIT_META = {
    SC_ONLY:   { label: 'S&C Only',    short: 'sc',     color: 'navy'  },
    SPLIT_3:   { label: '3-way',       short: 'split',  color: 'slate' },
    SPLIT_2:   { label: '2-way',       short: 'split2', color: 'gold'  },
    BRAD_ONLY: { label: 'Brad Only',   short: 'brad',   color: 'rust'  }
  };

  const PAYER_META = {
    SC:   { label: 'S&C Paid',  short: 'sc',   color: 'navy' },
    BRAD: { label: 'Brad Paid', short: 'brad', color: 'rust' }
  };

  function getCadRate() {
    const info = window.TRIP && window.TRIP.info && window.TRIP.info.currency;
    return (info && typeof info.cadToUsd === 'number') ? info.cadToUsd : 1.38;
  }

  function getRealTodayISO() {
    const d = new Date();
    return d.getFullYear() + '-' +
      String(d.getMonth() + 1).padStart(2, '0') + '-' +
      String(d.getDate()).padStart(2, '0');
  }

  function migrateExpense(e) {
    // Defensive shape coercion in case any pre-Firestore-shape entries surface.
    if (!e || typeof e !== 'object') return e;
    const out = {};
    for (const k in e) if (Object.prototype.hasOwnProperty.call(e, k)) out[k] = e[k];
    if (!out.paidBy) out.paidBy = 'SC';
    if (!out.splitType) out.splitType = out.category || 'SC_ONLY';
    delete out.category;
    return out;
  }

  function loadExpenses() {
    return Array.isArray(expenseCache) ? expenseCache.slice() : [];
  }

  function readExpensesView() {
    try {
      const v = localStorage.getItem(EXPENSES_VIEW_KEY);
      if (v === 'log' || v === 'summary') return v;
    } catch (e) {}
    return 'log';
  }

  function writeExpensesView(v) {
    try { localStorage.setItem(EXPENSES_VIEW_KEY, v); } catch (e) {}
  }

  function readLastSplit() {
    try {
      const v = localStorage.getItem(EXPENSES_LAST_SPLIT_KEY);
      if (v && SPLIT_META[v]) return v;
    } catch (e) {}
    return 'SPLIT_3';
  }

  function writeLastSplit(s) {
    try { localStorage.setItem(EXPENSES_LAST_SPLIT_KEY, s); } catch (e) {}
  }

  function readLastPaidBy() {
    try {
      const v = localStorage.getItem(EXPENSES_LAST_PAID_BY_KEY);
      if (v === 'SC' || v === 'BRAD') return v;
    } catch (e) {}
    return 'SC';
  }

  function writeLastPaidBy(p) {
    try { localStorage.setItem(EXPENSES_LAST_PAID_BY_KEY, p); } catch (e) {}
  }

  function readLastCurrency() {
    try {
      const v = localStorage.getItem(EXPENSES_LAST_CURRENCY_KEY);
      if (v === 'USD' || v === 'CAD') return v;
    } catch (e) {}
    return 'USD';
  }

  function writeLastCurrency(c) {
    try { localStorage.setItem(EXPENSES_LAST_CURRENCY_KEY, c); } catch (e) {}
  }

  function readBreakdownSort() {
    try {
      const raw = localStorage.getItem(EXPENSES_BREAKDOWN_SORT_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && (parsed.col === 'date' || parsed.col === 'amount') && (parsed.dir === 'asc' || parsed.dir === 'desc')) {
          return parsed;
        }
      }
    } catch (e) {}
    return { col: 'date', dir: 'desc' };
  }

  function writeBreakdownSort(sort) {
    try { localStorage.setItem(EXPENSES_BREAKDOWN_SORT_KEY, JSON.stringify(sort)); } catch (e) {}
  }

  function formatMoney(n) {
    return Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function formatDateLong(iso) {
    if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso || '';
    const parts = iso.split('-').map(Number);
    const date = new Date(parts[0], parts[1] - 1, parts[2]);
    if (isNaN(date.getTime())) return iso;
    return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  }

  function bradShare(splitType, amount) {
    const a = Number(amount) || 0;
    if (splitType === 'SC_ONLY')   return 0;
    if (splitType === 'SPLIT_3')   return a / 3;
    if (splitType === 'SPLIT_2')   return a / 2;
    if (splitType === 'BRAD_ONLY') return a;
    return 0;
  }

  function scShare(splitType, amount) {
    const a = Number(amount) || 0;
    if (splitType === 'SC_ONLY')   return a;
    if (splitType === 'SPLIT_3')   return a * 2 / 3;
    if (splitType === 'SPLIT_2')   return a / 2;
    if (splitType === 'BRAD_ONLY') return 0;
    return 0;
  }

  function computeTotals(expenses) {
    let total = 0;
    let bradOwesSC = 0;  // Brad reimburses S&C this much
    let scOwesBrad = 0;  // S&C reimburses Brad this much
    let scNet = 0;       // S&C cost responsibility (after settlement)
    let bradNet = 0;     // Brad cost responsibility (after settlement)
    let voidedTotal = 0; // sum of voided amounts (excluded from everything else)
    let voidedCount = 0;

    for (let i = 0; i < expenses.length; i++) {
      const e = expenses[i];
      const amt = Number(e.amount) || 0;

      if (e.voided) {
        voidedTotal += amt;
        voidedCount += 1;
        continue;
      }

      const bs = bradShare(e.splitType, amt);
      const ss = scShare(e.splitType, amt);

      total += amt;
      bradNet += bs;
      scNet += ss;

      if (e.paidBy === 'SC')        bradOwesSC += bs;
      else if (e.paidBy === 'BRAD') scOwesBrad += ss;
    }

    return {
      total: total,
      bradOwesSC: bradOwesSC,
      scOwesBrad: scOwesBrad,
      netSettlement: bradOwesSC - scOwesBrad,
      scNet: scNet,
      bradNet: bradNet,
      voidedTotal: voidedTotal,
      voidedCount: voidedCount
    };
  }

  function updateExpensesHeaderTotal() {
    const span = document.getElementById('expenses-header-total');
    if (!span) return;
    const totals = computeTotals(loadExpenses());
    let html = '$' + formatMoney(totals.total);
    if (totals.voidedCount > 0) {
      html += ' <span class="voided-count-badge">' + totals.voidedCount + ' voided</span>';
    }
    span.innerHTML = html;
  }

  // --- view layout ---

  function renderExpenses() {
    const root = document.getElementById('expenses-content');
    if (!root) return;
    if (!window.TRIP) {
      root.innerHTML = '<div class="expenses-body"><article class="card placeholder">' +
        '<p class="card-eyebrow">No data</p>' +
        '<h2 class="card-title">Expenses unavailable</h2></article></div>';
      return;
    }
    const view = readExpensesView();
    root.innerHTML =
      '<div class="expense-view-toggle">' +
        '<button type="button" class="view-toggle-btn ' + (view === 'log' ? 'is-active' : '') + '" data-view="log">Log</button>' +
        '<button type="button" class="view-toggle-btn ' + (view === 'summary' ? 'is-active' : '') + '" data-view="summary">Summary</button>' +
      '</div>' +
      '<div class="expenses-body" id="expenses-body"></div>';

    root.querySelectorAll('.view-toggle-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        writeExpensesView(btn.dataset.view);
        renderExpenses();
      });
    });

    if (view === 'log') renderExpenseLogView();
    else renderExpenseSummaryView();

    updateExpensesHeaderTotal();
  }

  // --- log view ---

  function renderExpenseLogView() {
    const body = document.getElementById('expenses-body');
    if (!body) return;
    body.innerHTML = expenseFormHtml() +
      '<div class="show-voided-row" id="show-voided-row" hidden>' +
        '<button type="button" class="show-voided-toggle" id="show-voided-toggle"></button>' +
      '</div>' +
      '<div class="expense-log-list" id="expense-log-list" role="list"></div>';
    attachExpenseFormHandlers(body);
    const toggle = document.getElementById('show-voided-toggle');
    if (toggle) {
      toggle.addEventListener('click', function () {
        writeShowVoided(!readShowVoided());
        renderExpenseLogList();
      });
    }
    renderExpenseLogList();
  }

  function expenseFormHtml() {
    const today = getRealTodayISO();
    const lastSplit = readLastSplit();
    const lastPaidBy = readLastPaidBy();
    const lastCurrency = readLastCurrency();
    function splitActive(c) { return lastSplit === c ? ' is-active' : ''; }
    function payerActive(p) { return lastPaidBy === p ? ' is-active' : ''; }
    function curActive(c)   { return lastCurrency === c ? ' is-active' : ''; }
    return '<form id="expense-form" class="expense-form" novalidate>' +
      '<label class="form-field"><span class="form-field-label">Description</span>' +
      '<input class="form-input" name="description" required placeholder="What was it?" autocomplete="off"></label>' +
      '<div class="form-row">' +
        '<label class="form-field form-field--amount"><span class="form-field-label">Amount</span>' +
        '<input class="form-input" name="amount" inputmode="decimal" required placeholder="0.00" autocomplete="off"></label>' +
        '<div class="currency-toggle" role="radiogroup" aria-label="Currency">' +
          '<button type="button" class="currency-btn' + curActive('USD') + '" data-currency="USD" aria-checked="' + (lastCurrency === 'USD') + '" role="radio">USD</button>' +
          '<button type="button" class="currency-btn' + curActive('CAD') + '" data-currency="CAD" aria-checked="' + (lastCurrency === 'CAD') + '" role="radio">CAD</button>' +
        '</div>' +
      '</div>' +
      '<div class="form-field"><span class="form-field-label">Who paid?</span>' +
        '<div class="payer-picker" role="radiogroup" aria-label="Who paid">' +
          '<button type="button" class="payer-btn payer-btn--sc' + payerActive('SC') + '" data-paid-by="SC" aria-checked="' + (lastPaidBy === 'SC') + '" role="radio">S&amp;C Paid</button>' +
          '<button type="button" class="payer-btn payer-btn--brad' + payerActive('BRAD') + '" data-paid-by="BRAD" aria-checked="' + (lastPaidBy === 'BRAD') + '" role="radio">Brad Paid</button>' +
        '</div>' +
      '</div>' +
      '<div class="form-field"><span class="form-field-label">Split how?</span>' +
        '<div class="split-picker" role="radiogroup" aria-label="Split type">' +
          '<button type="button" class="split-btn split-btn--sc' + splitActive('SC_ONLY') + '" data-split="SC_ONLY" aria-checked="' + (lastSplit === 'SC_ONLY') + '" role="radio">S&amp;C Only</button>' +
          '<button type="button" class="split-btn split-btn--split' + splitActive('SPLIT_3') + '" data-split="SPLIT_3" aria-checked="' + (lastSplit === 'SPLIT_3') + '" role="radio">Split 3-way</button>' +
          '<button type="button" class="split-btn split-btn--split2' + splitActive('SPLIT_2') + '" data-split="SPLIT_2" aria-checked="' + (lastSplit === 'SPLIT_2') + '" role="radio">Split 2-way</button>' +
          '<button type="button" class="split-btn split-btn--brad' + splitActive('BRAD_ONLY') + '" data-split="BRAD_ONLY" aria-checked="' + (lastSplit === 'BRAD_ONLY') + '" role="radio">Brad Only</button>' +
        '</div>' +
      '</div>' +
      '<label class="form-field"><span class="form-field-label">Date</span>' +
      '<input class="form-input" name="date" type="date" value="' + today + '" required></label>' +
      '<button type="submit" class="form-submit">Add Expense</button>' +
      '<p class="form-error" id="expense-form-error" hidden></p>' +
      '</form>';
  }

  function attachExpenseFormHandlers(body) {
    const form = body.querySelector('#expense-form');
    if (!form) return;

    function wireRadioGroup(selector, writer) {
      body.querySelectorAll(selector).forEach(function (btn) {
        btn.addEventListener('click', function () {
          body.querySelectorAll(selector).forEach(function (b) {
            b.classList.remove('is-active');
            b.setAttribute('aria-checked', 'false');
          });
          btn.classList.add('is-active');
          btn.setAttribute('aria-checked', 'true');
          if (writer) writer(btn);
        });
      });
    }

    wireRadioGroup('.currency-btn', function (btn) { writeLastCurrency(btn.dataset.currency); });
    wireRadioGroup('.payer-btn',    function (btn) { writeLastPaidBy(btn.dataset.paidBy); });
    wireRadioGroup('.split-btn',    function (btn) { writeLastSplit(btn.dataset.split); });

    form.addEventListener('submit', handleExpenseSubmit);
  }

  function handleExpenseSubmit(evt) {
    evt.preventDefault();
    const form = evt.target;
    const errEl = form.querySelector('#expense-form-error');
    const description = form.description.value.trim();
    const amountRaw = form.amount.value.trim();
    const date = form.date.value;
    const currencyBtn = form.querySelector('.currency-btn.is-active');
    const payerBtn = form.querySelector('.payer-btn.is-active');
    const splitBtn = form.querySelector('.split-btn.is-active');
    const currency = currencyBtn ? currencyBtn.dataset.currency : 'USD';
    const paidBy = payerBtn ? payerBtn.dataset.paidBy : null;
    const splitType = splitBtn ? splitBtn.dataset.split : null;

    function showError(msg, fieldName) {
      if (errEl) {
        errEl.textContent = msg;
        errEl.hidden = false;
      }
      if (fieldName && form[fieldName]) form[fieldName].focus();
    }

    if (!description) return showError('Description is required.', 'description');
    const parsed = parseFloat(amountRaw);
    if (!isFinite(parsed) || parsed <= 0) return showError('Enter an amount greater than zero.', 'amount');
    if (!date) return showError('Date is required.', 'date');
    if (!paidBy) return showError('Choose who paid.');
    if (!splitType) return showError('Choose how to split.');

    if (errEl) errEl.hidden = true;

    const rate = getCadRate();
    const usdAmount = currency === 'CAD' ? parsed / rate : parsed;

    const entry = {
      date: date,
      description: description,
      amount: Math.round(usdAmount * 100) / 100,
      currency: currency,
      originalAmount: Math.round(parsed * 100) / 100,
      paidBy: paidBy,
      splitType: splitType,
      preloaded: false,
      createdAt: fbTimestamp()
    };

    const D = fb();
    if (!D) {
      showError('Cloud sync unavailable — try again when reconnected.');
      return;
    }

    const submitBtn = form.querySelector('.form-submit');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Saving…';
    }

    D.collection('trips/maine-2026/expenses').add(entry).then(function () {
      // Snapshot listener will re-render the log; just clear the inputs.
      form.description.value = '';
      form.amount.value = '';
      form.date.value = getRealTodayISO();
      form.description.focus();
      if (errEl) errEl.hidden = true;
    }).catch(function (err) {
      console.error('Add expense failed:', err);
      showError('Could not save. Check connection and try again.');
    }).finally(function () {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Add Expense';
      }
    });
  }

  function loadingIndicatorHtml() {
    return '<div class="loading-indicator" role="status" aria-label="Loading">' +
      '<span class="dot"></span><span class="dot"></span><span class="dot"></span>' +
      '</div>';
  }

  function renderExpenseLogList() {
    const list = document.getElementById('expense-log-list');
    if (!list) return;
    if (isExpensesLoading()) {
      list.innerHTML = loadingIndicatorHtml();
      return;
    }
    const expenses = loadExpenses();

    // Capture in-progress edit form values so a snapshot mid-edit doesn't blow them away
    const editFormSnapshot = captureEditFormState(list);

    // Show-voided toggle row
    const voided = expenses.filter(function (e) { return !!e.voided; });
    const active = expenses.filter(function (e) { return !e.voided; });
    const showVoided = readShowVoided();
    const toggleRow = document.getElementById('show-voided-row');
    const toggleBtn = document.getElementById('show-voided-toggle');
    if (toggleRow && toggleBtn) {
      if (voided.length === 0) {
        toggleRow.hidden = true;
      } else {
        toggleRow.hidden = false;
        toggleBtn.textContent = showVoided
          ? 'Hide voided (' + voided.length + ')'
          : 'Show voided (' + voided.length + ')';
        toggleBtn.classList.toggle('is-active', showVoided);
      }
    }

    if (expenses.length === 0) {
      list.innerHTML = '<p class="expenses-empty">No expenses yet.</p>';
      return;
    }

    function sortByDate(arr) {
      return arr.slice().sort(function (a, b) {
        if (a.date < b.date) return 1;
        if (a.date > b.date) return -1;
        return 0;
      });
    }

    function groupedHtml(rows) {
      const dateOrder = [];
      const groups = {};
      sortByDate(rows).forEach(function (e) {
        if (!groups[e.date]) {
          groups[e.date] = [];
          dateOrder.push(e.date);
        }
        groups[e.date].push(e);
      });
      let h = '';
      dateOrder.forEach(function (date) {
        h += '<h4 class="expense-day-header">' + escapeHtml(formatDateLong(date)) + '</h4>';
        groups[date].forEach(function (e) {
          h += expenseCardHtml(e);
        });
      });
      return h;
    }

    let html = '';
    if (active.length > 0) {
      html += groupedHtml(active);
    } else {
      html += '<p class="expenses-empty">No active expenses.</p>';
    }

    if (showVoided && voided.length > 0) {
      html += '<h4 class="expense-day-header expense-voided-header">Voided</h4>';
      sortByDate(voided).forEach(function (e) {
        html += expenseCardHtml(e);
      });
    }

    list.innerHTML = html;

    if (editFormSnapshot) restoreEditFormState(list, editFormSnapshot);

    attachLogListHandlers(list);
  }

  function expenseCardHtml(e) {
    if (e.voided) return voidedCardHtml(e);
    if (editingId === e.id) return editCardHtml(e);
    return activeCardHtml(e);
  }

  function activeCardHtml(e) {
    const splitMeta = SPLIT_META[e.splitType] || SPLIT_META.SC_ONLY;
    const payerMeta = PAYER_META[e.paidBy] || PAYER_META.SC;
    const splitShort = splitMeta.short;
    const payerShort = payerMeta.short;

    const amountText = e.currency === 'CAD'
      ? 'CAD $' + formatMoney(e.originalAmount) +
        '<span class="exp-card-usd"> (~$' + formatMoney(e.amount) + ' USD)</span>'
      : '$' + formatMoney(e.amount) + ' <span class="exp-card-usd-suffix">USD</span>';

    const bradShareAmt = bradShare(e.splitType, e.amount);
    const bradShareText = '<span class="exp-card-share">Brad: $' + formatMoney(bradShareAmt) + '</span>';

    const isLocked = isAnyCardEditing();

    let actionsHtml;
    if (voidConfirmId === e.id) {
      actionsHtml =
        '<div class="exp-card-confirm">' +
          '<span class="exp-card-confirm-label">Void this expense?</span>' +
          '<div class="exp-card-confirm-actions">' +
            '<button type="button" class="exp-card-confirm-yes" data-id="' + escapeHtml(e.id) + '">Confirm</button>' +
            '<button type="button" class="exp-card-confirm-no" data-id="' + escapeHtml(e.id) + '">Cancel</button>' +
          '</div>' +
        '</div>';
    } else {
      const dis = isLocked ? ' disabled' : '';
      actionsHtml =
        '<div class="exp-card-actions">' +
          '<button type="button" class="exp-card-edit-btn" data-id="' + escapeHtml(e.id) + '" aria-label="Edit"' + dis + '>' +
            ICON_PENCIL + '<span>Edit</span>' +
          '</button>' +
          '<button type="button" class="exp-card-void-btn" data-id="' + escapeHtml(e.id) + '" aria-label="Void"' + dis + '>' +
            ICON_X + '<span>Void</span>' +
          '</button>' +
        '</div>';
    }

    const preloadedLabel = e.preloaded
      ? '<span class="exp-card-preloaded">pre-loaded</span>'
      : '';

    const editedLabel = e.updatedAt
      ? '<span class="exp-card-edited">edited</span>'
      : '';

    return '<article class="exp-card exp-card--' + splitShort + '" data-id="' + escapeHtml(e.id) + '" role="listitem">' +
      '<div class="exp-card-top">' +
        '<p class="exp-card-desc">' + escapeHtml(e.description) + '</p>' +
        actionsHtml +
      '</div>' +
      '<div class="exp-card-amount-row">' +
        '<p class="exp-card-amount">' + amountText + '</p>' +
        bradShareText +
      '</div>' +
      '<div class="exp-card-bottom">' +
        '<span class="exp-card-badge exp-card-badge--payer-' + payerShort + '">' + escapeHtml(payerMeta.label) + '</span>' +
        '<span class="exp-card-badge exp-card-badge--' + splitShort + '">' + escapeHtml(splitMeta.label) + '</span>' +
        preloadedLabel +
        editedLabel +
      '</div>' +
      '</article>';
  }

  function voidedCardHtml(e) {
    const amountText = e.currency === 'CAD'
      ? 'CAD $' + formatMoney(e.originalAmount) + ' (~$' + formatMoney(e.amount) + ' USD)'
      : '$' + formatMoney(e.amount) + ' USD';
    const preloadedLabel = e.preloaded
      ? '<span class="exp-card-preloaded">pre-loaded</span>'
      : '';
    return '<article class="exp-card exp-card--voided" data-id="' + escapeHtml(e.id) + '" role="listitem">' +
      '<div class="exp-card-top">' +
        '<p class="exp-card-desc"><s>' + escapeHtml(e.description) + '</s></p>' +
      '</div>' +
      '<p class="exp-card-amount"><s>' + amountText + '</s></p>' +
      '<div class="exp-card-bottom">' +
        '<span class="exp-card-badge exp-card-badge--void">VOID</span>' +
        preloadedLabel +
      '</div>' +
      '</article>';
  }

  function editCardHtml(e) {
    const lastDesc = e.description == null ? '' : String(e.description);
    const lastAmount = e.originalAmount != null ? e.originalAmount : (e.amount != null ? e.amount : '');
    const lastCurrency = e.currency || 'USD';
    const lastPaidBy = e.paidBy || 'SC';
    const lastSplit = e.splitType || 'SC_ONLY';
    const lastDate = e.date || getRealTodayISO();

    function curActive(c)   { return lastCurrency === c ? ' is-active' : ''; }
    function payerActive(p) { return lastPaidBy === p ? ' is-active' : ''; }
    function splitActive(s) { return lastSplit === s ? ' is-active' : ''; }

    return '<article class="exp-card exp-card--editing" data-id="' + escapeHtml(e.id) + '" data-editing="true" role="listitem">' +
      '<form class="exp-card-edit-form" data-id="' + escapeHtml(e.id) + '" novalidate>' +
        '<label class="form-field"><span class="form-field-label">Description</span>' +
          '<input class="form-input" name="description" value="' + escapeHtml(lastDesc) + '" required></label>' +
        '<div class="form-row">' +
          '<label class="form-field form-field--amount"><span class="form-field-label">Amount</span>' +
            '<input class="form-input" name="amount" inputmode="decimal" value="' + escapeHtml(String(lastAmount)) + '" required></label>' +
          '<div class="currency-toggle" role="radiogroup" aria-label="Currency">' +
            '<button type="button" class="currency-btn' + curActive('USD') + '" data-currency="USD" role="radio">USD</button>' +
            '<button type="button" class="currency-btn' + curActive('CAD') + '" data-currency="CAD" role="radio">CAD</button>' +
          '</div>' +
        '</div>' +
        '<div class="form-field"><span class="form-field-label">Who paid?</span>' +
          '<div class="payer-picker" role="radiogroup" aria-label="Who paid">' +
            '<button type="button" class="payer-btn payer-btn--sc' + payerActive('SC') + '" data-paid-by="SC" role="radio">S&amp;C Paid</button>' +
            '<button type="button" class="payer-btn payer-btn--brad' + payerActive('BRAD') + '" data-paid-by="BRAD" role="radio">Brad Paid</button>' +
          '</div>' +
        '</div>' +
        '<div class="form-field"><span class="form-field-label">Split how?</span>' +
          '<div class="split-picker" role="radiogroup" aria-label="Split type">' +
            '<button type="button" class="split-btn split-btn--sc' + splitActive('SC_ONLY') + '" data-split="SC_ONLY" role="radio">S&amp;C Only</button>' +
            '<button type="button" class="split-btn split-btn--split' + splitActive('SPLIT_3') + '" data-split="SPLIT_3" role="radio">Split 3-way</button>' +
            '<button type="button" class="split-btn split-btn--split2' + splitActive('SPLIT_2') + '" data-split="SPLIT_2" role="radio">Split 2-way</button>' +
            '<button type="button" class="split-btn split-btn--brad' + splitActive('BRAD_ONLY') + '" data-split="BRAD_ONLY" role="radio">Brad Only</button>' +
          '</div>' +
        '</div>' +
        '<label class="form-field"><span class="form-field-label">Date</span>' +
          '<input class="form-input" name="date" type="date" value="' + escapeHtml(lastDate) + '" required></label>' +
        '<p class="form-error" data-edit-error hidden></p>' +
        '<div class="exp-card-edit-actions">' +
          '<button type="button" class="form-cancel" data-id="' + escapeHtml(e.id) + '">Cancel</button>' +
          '<button type="submit" class="form-submit form-submit--small">Save</button>' +
        '</div>' +
      '</form>' +
      '</article>';
  }

  function captureEditFormState(list) {
    if (!editingId) return null;
    const form = list.querySelector('.exp-card-edit-form[data-id="' + cssEscape(editingId) + '"]');
    if (!form) return null;
    return {
      id: editingId,
      description: form.description.value,
      amount: form.amount.value,
      date: form.date.value,
      currency: (form.querySelector('.currency-btn.is-active') || {}).dataset
        ? form.querySelector('.currency-btn.is-active').dataset.currency : 'USD',
      paidBy: (form.querySelector('.payer-btn.is-active') || {}).dataset
        ? form.querySelector('.payer-btn.is-active').dataset.paidBy : 'SC',
      splitType: (form.querySelector('.split-btn.is-active') || {}).dataset
        ? form.querySelector('.split-btn.is-active').dataset.split : 'SC_ONLY'
    };
  }

  function restoreEditFormState(list, snap) {
    const form = list.querySelector('.exp-card-edit-form[data-id="' + cssEscape(snap.id) + '"]');
    if (!form) return;
    form.description.value = snap.description;
    form.amount.value = snap.amount;
    form.date.value = snap.date;
    form.querySelectorAll('.currency-btn').forEach(function (b) {
      b.classList.toggle('is-active', b.dataset.currency === snap.currency);
    });
    form.querySelectorAll('.payer-btn').forEach(function (b) {
      b.classList.toggle('is-active', b.dataset.paidBy === snap.paidBy);
    });
    form.querySelectorAll('.split-btn').forEach(function (b) {
      b.classList.toggle('is-active', b.dataset.split === snap.splitType);
    });
  }

  function cssEscape(s) {
    if (window.CSS && typeof window.CSS.escape === 'function') return window.CSS.escape(s);
    return String(s).replace(/(["\\])/g, '\\$1');
  }

  function attachLogListHandlers(list) {
    list.querySelectorAll('.exp-card-edit-btn:not([disabled])').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (isAnyCardEditing()) return;
        editingId = btn.dataset.id;
        voidConfirmId = null;
        renderExpenseLogList();
      });
    });

    list.querySelectorAll('.exp-card-void-btn:not([disabled])').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (isAnyCardEditing()) return;
        voidConfirmId = btn.dataset.id;
        renderExpenseLogList();
      });
    });

    list.querySelectorAll('.exp-card-confirm-yes').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const id = btn.dataset.id;
        voidConfirmId = null;
        voidExpense(id);
        renderExpenseLogList();
      });
    });

    list.querySelectorAll('.exp-card-confirm-no').forEach(function (btn) {
      btn.addEventListener('click', function () {
        voidConfirmId = null;
        renderExpenseLogList();
      });
    });

    list.querySelectorAll('.form-cancel').forEach(function (btn) {
      btn.addEventListener('click', function () {
        editingId = null;
        renderExpenseLogList();
      });
    });

    list.querySelectorAll('.exp-card-edit-form').forEach(function (form) {
      form.addEventListener('submit', handleEditSubmit);
      form.querySelectorAll('.currency-btn, .payer-btn, .split-btn').forEach(function (btn) {
        btn.addEventListener('click', function () {
          const parent = btn.parentElement;
          parent.querySelectorAll('button').forEach(function (b) {
            b.classList.remove('is-active');
            b.setAttribute('aria-checked', 'false');
          });
          btn.classList.add('is-active');
          btn.setAttribute('aria-checked', 'true');
        });
      });
    });
  }

  function voidExpense(id) {
    if (!id) return;
    const D = fb();
    if (!D) return;
    D.collection('trips/maine-2026/expenses').doc(id).update({
      voided: true,
      voidedAt: fbTimestamp()
    }).catch(function (err) {
      console.error('Void expense failed:', err);
    });
  }

  function handleEditSubmit(evt) {
    evt.preventDefault();
    const form = evt.target;
    const id = form.dataset.id;
    if (!id) return;

    const errEl = form.querySelector('[data-edit-error]');
    function showError(msg) {
      if (errEl) { errEl.textContent = msg; errEl.hidden = false; }
    }

    const description = form.description.value.trim();
    const amountRaw = form.amount.value.trim();
    const date = form.date.value;
    const currencyBtn = form.querySelector('.currency-btn.is-active');
    const payerBtn = form.querySelector('.payer-btn.is-active');
    const splitBtn = form.querySelector('.split-btn.is-active');
    const currency = currencyBtn ? currencyBtn.dataset.currency : 'USD';
    const paidBy = payerBtn ? payerBtn.dataset.paidBy : null;
    const splitType = splitBtn ? splitBtn.dataset.split : null;

    if (!description) return showError('Description is required.');
    const parsed = parseFloat(amountRaw);
    if (!isFinite(parsed) || parsed <= 0) return showError('Enter an amount greater than zero.');
    if (!date) return showError('Date is required.');
    if (!paidBy) return showError('Choose who paid.');
    if (!splitType) return showError('Choose how to split.');

    if (errEl) errEl.hidden = true;

    const rate = getCadRate();
    const usdAmount = currency === 'CAD' ? parsed / rate : parsed;

    const D = fb();
    if (!D) return showError('Cloud sync unavailable — try again when reconnected.');

    const submitBtn = form.querySelector('.form-submit');
    const cancelBtn = form.querySelector('.form-cancel');
    if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Saving…'; }
    if (cancelBtn) cancelBtn.disabled = true;

    const update = {
      description: description,
      originalAmount: Math.round(parsed * 100) / 100,
      amount: Math.round(usdAmount * 100) / 100,
      currency: currency,
      paidBy: paidBy,
      splitType: splitType,
      date: date,
      updatedAt: fbTimestamp()
    };

    D.collection('trips/maine-2026/expenses').doc(id).update(update).then(function () {
      editingId = null;
      // onSnapshot will re-render
      renderExpenseLogList();
    }).catch(function (err) {
      console.error('Edit save failed:', err);
      showError('Could not save. Check connection and try again.');
      if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Save'; }
      if (cancelBtn) cancelBtn.disabled = false;
    });
  }

  // --- summary view ---

  function renderExpenseSummaryView() {
    const body = document.getElementById('expenses-body');
    if (!body) return;
    if (isExpensesLoading()) {
      body.innerHTML = loadingIndicatorHtml();
      return;
    }
    const expenses = loadExpenses();
    const totals = computeTotals(expenses);

    let netLabel, netModifier;
    if (totals.netSettlement > 0.005) {
      netLabel = 'Brad owes S&C';
      netModifier = 'net-brad';
    } else if (totals.netSettlement < -0.005) {
      netLabel = 'S&C owes Brad';
      netModifier = 'net-sc';
    } else {
      netLabel = 'All square';
      netModifier = 'net-zero';
    }

    body.innerHTML =
      '<div class="summary-cards">' +
        summaryCardHtml('Brad owes S&C', totals.bradOwesSC, 'Brad’s share where S&C paid', 'gold') +
        summaryCardHtml('S&C owes Brad', totals.scOwesBrad, 'S&C’s share where Brad paid', 'split') +
        summaryCardHtml(netLabel, Math.abs(totals.netSettlement), 'net settlement after offsetting both directions', netModifier) +
        summaryCardHtml('Total trip spend', totals.total, 'every expense combined') +
        summaryCardHtml('S&C net cost', totals.scNet, 'what S&C ultimately bears', 'navy') +
        summaryCardHtml('Brad net cost', totals.bradNet, 'what Brad ultimately bears', 'rust') +
      '</div>' +
      breakdownTableHtml(expenses);

    body.querySelectorAll('.breakdown-table .sortable').forEach(function (th) {
      th.addEventListener('click', function () {
        const col = th.dataset.col;
        const current = readBreakdownSort();
        let next;
        if (current.col === col) {
          next = { col: col, dir: current.dir === 'asc' ? 'desc' : 'asc' };
        } else {
          next = { col: col, dir: 'desc' };
        }
        writeBreakdownSort(next);
        renderExpenseSummaryView();
      });
    });
  }

  function summaryCardHtml(label, value, sublabel, modifier) {
    const cls = 'summary-card' + (modifier ? ' summary-card--' + modifier : '');
    const valueDisplay = (modifier === 'net-zero')
      ? '<p class="summary-card-value">All square</p>'
      : '<p class="summary-card-value">$' + formatMoney(value) + '</p>';
    return '<article class="' + cls + '">' +
      '<p class="summary-card-label">' + escapeHtml(label) + '</p>' +
      valueDisplay +
      (sublabel ? '<p class="summary-card-sublabel">' + escapeHtml(sublabel) + '</p>' : '') +
      '</article>';
  }

  function breakdownTableHtml(expenses) {
    const sort = readBreakdownSort();
    const active = expenses.filter(function (e) { return !e.voided; });
    const voided = expenses.filter(function (e) { return !!e.voided; });
    const voidedSum = voided.reduce(function (s, e) { return s + (Number(e.amount) || 0); }, 0);
    const sorted = active.slice().sort(function (a, b) {
      let cmp = 0;
      if (sort.col === 'amount') {
        cmp = (Number(a.amount) || 0) - (Number(b.amount) || 0);
        if (cmp === 0) cmp = (a.date < b.date) ? -1 : (a.date > b.date) ? 1 : 0;
      } else {
        cmp = (a.date < b.date) ? -1 : (a.date > b.date) ? 1 : 0;
        if (cmp === 0) cmp = (a.addedAt || 0) - (b.addedAt || 0);
      }
      return sort.dir === 'asc' ? cmp : -cmp;
    });

    function arrowFor(col) {
      if (sort.col !== col) return '';
      return sort.dir === 'asc' ? ' ▲' : ' ▼';
    }

    const rows = sorted.map(function (e) {
      const splitMeta = SPLIT_META[e.splitType] || SPLIT_META.SC_ONLY;
      const payerMeta = PAYER_META[e.paidBy] || PAYER_META.SC;
      const bs = bradShare(e.splitType, e.amount);
      const ss = scShare(e.splitType, e.amount);
      return '<tr>' +
        '<td class="bd-date">' + escapeHtml(formatDateShort(e.date)) + '</td>' +
        '<td class="bd-item">' +
          '<div class="bd-desc">' + escapeHtml(e.description) + '</div>' +
          '<div class="bd-tags">' +
            '<span class="exp-card-badge exp-card-badge--payer-' + payerMeta.short + '">' + escapeHtml(payerMeta.label) + '</span>' +
            '<span class="exp-card-badge exp-card-badge--' + splitMeta.short + '">' + escapeHtml(splitMeta.label) + '</span>' +
          '</div>' +
        '</td>' +
        '<td class="bd-num">$' + formatMoney(bs) + '</td>' +
        '<td class="bd-num">$' + formatMoney(ss) + '</td>' +
        '</tr>';
    }).join('');

    const voidedFooter = voided.length > 0
      ? '<tfoot><tr class="bd-voided-row">' +
          '<td colspan="3"><s>Voided (' + voided.length + ' entr' + (voided.length === 1 ? 'y' : 'ies') + ')</s></td>' +
          '<td class="bd-num"><s>$' + formatMoney(voidedSum) + '</s></td>' +
        '</tr></tfoot>'
      : '';

    return '<table class="breakdown-table" aria-label="Per-expense breakdown">' +
      '<thead><tr>' +
        '<th scope="col" class="sortable" data-col="date">Date' + arrowFor('date') + '</th>' +
        '<th scope="col">Item</th>' +
        '<th scope="col" class="sortable" data-col="amount">Brad' + arrowFor('amount') + '</th>' +
        '<th scope="col">S&amp;C</th>' +
      '</tr></thead>' +
      '<tbody>' + rows + '</tbody>' +
      voidedFooter +
      '</table>';
  }

  // ---- Timeline tab ----------------------------------------------------

  let timelineAutoScrolled = false;
  let timelineObserverInitialized = false;

  function jumpDayBtnHtml(dayNum, isToday, isCompleted) {
    const classes = ['jump-day'];
    if (isToday) classes.push('is-today');
    if (isCompleted) classes.push('is-completed');
    const checkmark = isCompleted ? '<span class="jump-day-check" aria-label="completed">✓</span>' : '';
    return '<button type="button" class="' + classes.join(' ') + '" data-day="' + dayNum + '" aria-label="Jump to day ' + dayNum + '">' +
      '<span class="jump-day-num">' + dayNum + '</span>' + checkmark +
      '</button>';
  }

  function dayCardHtml(day, isToday, isCompleted) {
    const isExpanded = isToday;
    const classes = ['day-card'];
    if (isToday) classes.push('is-today');
    if (isCompleted) classes.push('is-completed');

    const drivingRow = day.driving
      ? '<p class="day-card-summary-row">' + ICON_CAR + '<span>' + escapeHtml(day.driving) + '</span></p>'
      : '';
    const hotelRow = day.hotel
      ? '<p class="day-card-summary-row">' + ICON_BED + '<span>' + escapeHtml(day.hotel) + '</span></p>'
      : '';
    const summaryHtml = (drivingRow || hotelRow)
      ? '<div class="day-card-summary">' + drivingRow + hotelRow + '</div>'
      : '';

    let detailHtml = '';
    if (day.highlights && day.highlights.length) {
      detailHtml += '<div class="day-card-detail-section">' +
        '<h4 class="day-card-detail-title">Highlights</h4>' +
        '<ul class="day-card-detail-list">' +
        day.highlights.map(function (h) { return '<li>' + escapeHtml(h) + '</li>'; }).join('') +
        '</ul></div>';
    }
    if (day.meals && day.meals.length) {
      detailHtml += '<div class="day-card-detail-section day-card-detail-section--meals">' +
        '<h4 class="day-card-detail-title">' + ICON_FORK + '<span>Meals</span></h4>' +
        '<ul class="day-card-detail-list">' +
        day.meals.map(function (m) { return '<li>' + escapeHtml(m) + '</li>'; }).join('') +
        '</ul></div>';
    }
    if (day.logistics && day.logistics.length) {
      detailHtml += '<div class="day-card-detail-section day-card-detail-section--logistics">' +
        '<h4 class="day-card-detail-title"><span class="logistics-warning" aria-hidden="true">⚠</span><span>Logistics</span></h4>' +
        '<ul class="day-card-detail-list">' +
        day.logistics.map(function (l) { return '<li>' + escapeHtml(l) + '</li>'; }).join('') +
        '</ul></div>';
    }

    const markBtnHtml = isCompleted
      ? '<button type="button" class="mark-complete-btn is-completed" data-day="' + day.dayNum + '">' + ICON_CHECK + '<span>Completed — tap to undo</span></button>'
      : '<button type="button" class="mark-complete-btn" data-day="' + day.dayNum + '">' + ICON_CHECK + '<span>Mark Complete</span></button>';

    return '<article class="' + classes.join(' ') + '" id="day-card-' + day.dayNum + '" data-day="' + day.dayNum + '" data-expanded="' + isExpanded + '">' +
      '<button type="button" class="day-card-header" data-day="' + day.dayNum + '" aria-expanded="' + isExpanded + '" aria-controls="day-card-detail-' + day.dayNum + '">' +
        '<span class="day-card-num">' + day.dayNum + '</span>' +
        '<div class="day-card-meta">' +
          '<p class="day-card-date">' + escapeHtml(day.dateDisplay) + '</p>' +
          '<p class="day-card-title">' + escapeHtml(day.title) + '</p>' +
        '</div>' +
        (day.location ? '<span class="day-card-loc">' + escapeHtml(day.location) + '</span>' : '') +
      '</button>' +
      summaryHtml +
      '<div class="day-card-detail" id="day-card-detail-' + day.dayNum + '">' +
        detailHtml +
        markBtnHtml +
      '</div>' +
      '</article>';
  }

  function renderTimeline() {
    const root = document.getElementById('timeline-content');
    if (!root) return;
    if (!window.TRIP || !Array.isArray(window.TRIP.days)) {
      root.innerHTML = '<div class="timeline-body"><article class="card placeholder">' +
        '<p class="card-eyebrow">No data</p>' +
        '<h2 class="card-title">Timeline unavailable</h2></article></div>';
      return;
    }

    const ctx = findTodayContext();
    const todayDayNum = ctx ? ctx.day.dayNum : 1;

    let jumpBarHtml = '<nav class="jump-bar" id="jump-bar" aria-label="Jump to day">';
    window.TRIP.days.forEach(function (day) {
      jumpBarHtml += jumpDayBtnHtml(day.dayNum, day.dayNum === todayDayNum, isDayCompleted(day.dayNum));
    });
    jumpBarHtml += '</nav>';

    let cardsHtml = '<div class="timeline-body">';
    window.TRIP.days.forEach(function (day) {
      cardsHtml += dayCardHtml(day, day.dayNum === todayDayNum, isDayCompleted(day.dayNum));
    });
    cardsHtml += '</div>';

    const shortcutHtml = '<button type="button" class="today-shortcut" id="today-shortcut" aria-label="Scroll to today">Today ' + ICON_ARROW_RIGHT + '</button>';

    root.innerHTML = jumpBarHtml + cardsHtml + shortcutHtml;
    attachTimelineHandlers(root);
    timelineObserverInitialized = false;
  }

  function attachTimelineHandlers(root) {
    // Jump bar
    root.querySelectorAll('#jump-bar .jump-day').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const dayNum = parseInt(btn.dataset.day, 10);
        if (isFinite(dayNum)) scrollTimelineToDay(dayNum, true);
      });
    });

    // Card header expand/collapse
    root.querySelectorAll('.day-card-header').forEach(function (header) {
      header.addEventListener('click', function () {
        const card = header.closest('.day-card');
        if (!card) return;
        const expanded = card.dataset.expanded === 'true';
        card.dataset.expanded = expanded ? 'false' : 'true';
        header.setAttribute('aria-expanded', expanded ? 'false' : 'true');
      });
    });

    // Mark complete / unmark toggle
    root.querySelectorAll('.mark-complete-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const dayNum = parseInt(btn.dataset.day, 10);
        if (!isFinite(dayNum)) return;
        if (btn.classList.contains('is-completed')) {
          unmarkDayComplete(dayNum);
        } else {
          markDayComplete(dayNum);
        }
      });
    });

    // Floating Today shortcut
    const shortcut = root.querySelector('#today-shortcut');
    if (shortcut) {
      shortcut.addEventListener('click', function () {
        const ctx = findTodayContext();
        const dayNum = ctx ? ctx.day.dayNum : 1;
        const card = document.getElementById('day-card-' + dayNum);
        if (card) {
          card.dataset.expanded = 'true';
          const header = card.querySelector('.day-card-header');
          if (header) header.setAttribute('aria-expanded', 'true');
          card.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });
    }
  }

  function scrollTimelineToDay(dayNum, smooth) {
    const card = document.getElementById('day-card-' + dayNum);
    if (!card) return;
    card.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'start' });

    // Brief visual highlight on the corresponding jump bar day
    const jumpBtn = document.querySelector('#jump-bar .jump-day[data-day="' + dayNum + '"]');
    if (jumpBtn) {
      jumpBtn.classList.add('is-highlighted');
      setTimeout(function () {
        jumpBtn.classList.remove('is-highlighted');
      }, 900);
    }
  }

  function maybeScrollTimelineToToday() {
    if (timelineAutoScrolled) return;
    timelineAutoScrolled = true;
    const ctx = findTodayContext();
    const dayNum = ctx ? ctx.day.dayNum : 1;
    scrollTimelineToDay(dayNum, false);
  }

  function setupTimelineObserver() {
    if (timelineObserverInitialized) return;
    if (typeof IntersectionObserver === 'undefined') return;
    const todayCard = document.querySelector('#timeline-content .day-card.is-today');
    const shortcut = document.getElementById('today-shortcut');
    const root = document.getElementById('timeline-content');
    if (!todayCard || !shortcut || !root) return;

    const observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        shortcut.classList.toggle('is-visible', !entry.isIntersecting);
      });
    }, { root: root, threshold: 0.05 });
    observer.observe(todayCard);
    timelineObserverInitialized = true;
  }

  // ---- Info tab --------------------------------------------------------

  const ICON_PASSPORT =
    '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
    '<rect x="5" y="3" width="14" height="18" rx="2" stroke="currentColor" stroke-width="1.8" fill="none"/>' +
    '<circle cx="12" cy="11" r="3.2" stroke="currentColor" stroke-width="1.8" fill="none"/>' +
    '<path d="M9 17h6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>' +
    '</svg>';

  const ICON_TICKET =
    '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
    '<path d="M3 8a2 2 0 012-2h14a2 2 0 012 2v2a2 2 0 100 4v2a2 2 0 01-2 2H5a2 2 0 01-2-2v-2a2 2 0 100-4V8z" stroke="currentColor" stroke-width="1.6" fill="none"/>' +
    '<path d="M14 6v12" stroke="currentColor" stroke-width="1.6" stroke-dasharray="2 2"/>' +
    '</svg>';

  const ICON_LAUNDRY =
    '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
    '<rect x="4" y="3" width="16" height="18" rx="2" stroke="currentColor" stroke-width="1.6" fill="none"/>' +
    '<circle cx="12" cy="13" r="4.5" stroke="currentColor" stroke-width="1.6" fill="none"/>' +
    '<circle cx="8" cy="6.5" r="0.8" fill="currentColor"/>' +
    '<circle cx="11" cy="6.5" r="0.8" fill="currentColor"/>' +
    '</svg>';

  function infoSectionHtml(title, innerHtml) {
    return '<section class="info-section">' +
      '<h2 class="info-section-header">' + escapeHtml(title) + '</h2>' +
      '<div class="info-section-body">' + innerHtml + '</div>' +
      '</section>';
  }

  function deadlineCardsHtml(deadlines) {
    if (!Array.isArray(deadlines) || deadlines.length === 0) return '';
    const today = getTodayISO();
    return deadlines.map(function (d) {
      const isPast = d.date < today;
      const cls = 'deadline-card' + (isPast ? ' deadline-card--past' : '');
      return '<article class="' + cls + '">' +
        '<p class="deadline-date">' + escapeHtml(formatDateShort(d.date)) + (isPast ? ' · past' : '') + '</p>' +
        '<h4 class="deadline-title">' + escapeHtml(d.title || '') + '</h4>' +
        '<p class="deadline-action">' + escapeHtml(d.action || '') + '</p>' +
        '</article>';
    }).join('');
  }

  function timeZonesHtml(tz) {
    if (!tz) return '';
    return '<div class="tz-timeline" role="img" aria-label="Trip time zones from May 22 to June 6">' +
        '<div class="tz-segment tz-segment--et" style="flex: 7">' +
          '<span class="tz-segment-label">ET</span>' +
          '<span class="tz-segment-dates">May 22 – 29</span>' +
        '</div>' +
        '<div class="tz-segment tz-segment--at" style="flex: 7">' +
          '<span class="tz-segment-label">AT</span>' +
          '<span class="tz-segment-dates">May 29 – Jun 5</span>' +
        '</div>' +
        '<div class="tz-segment tz-segment--et" style="flex: 2">' +
          '<span class="tz-segment-label">ET</span>' +
          '<span class="tz-segment-dates">Jun 5 – 6</span>' +
        '</div>' +
      '</div>' +
      '<div class="tz-zones">' +
        '<p class="tz-zone tz-zone--et"><span class="tz-zone-dot"></span><strong>Eastern Time</strong> · Maine + New Brunswick</p>' +
        '<p class="tz-zone tz-zone--at"><span class="tz-zone-dot"></span><strong>Atlantic Time</strong> · Prince Edward Island + Nova Scotia (one hour ahead)</p>' +
      '</div>' +
      '<div class="tz-transitions">' +
        '<p class="tz-transition tz-transition--forward"><span class="tz-arrow">⇨</span><span>Cross into PEI via Confederation Bridge — <strong>spring forward +1hr</strong> on May 29 (Day 8)</span></p>' +
        '<p class="tz-transition tz-transition--back"><span class="tz-arrow">⇦</span><span>Dock in Bar Harbor on CAT Ferry — <strong>fall back −1hr</strong> on Jun 5 (Day 15)</span></p>' +
      '</div>' +
      '<p class="tz-tip">Set phones to auto time zone — it handles everything.</p>';
  }

  function parkPassesHtml(parks) {
    if (!parks) return '';
    function passCard(label, amount, when, coverage, modifier) {
      const cls = 'pass-card' + (modifier ? ' pass-card--' + modifier : '');
      return '<article class="' + cls + '">' +
        '<p class="pass-card-label">' + escapeHtml(label) + '</p>' +
        '<p class="pass-card-amount">' + escapeHtml(amount) + '</p>' +
        '<p class="pass-card-when">' + escapeHtml(when) + '</p>' +
        (coverage ? '<p class="pass-card-coverage">' + escapeHtml(coverage) + '</p>' : '') +
        '</article>';
    }
    let html = '';
    if (parks.acadiaVehicleFee) {
      html += passCard(
        'Acadia National Park',
        parks.acadiaVehicleFee.amount + ' · vehicle fee at gate',
        parks.acadiaVehicleFee.when,
        parks.acadiaVehicleFee.coverage,
        'usa'
      );
    }
    if (parks.parksCanadaDiscovery) {
      html += passCard(
        'Parks Canada Family/Group Discovery Pass',
        parks.parksCanadaDiscovery.amount,
        parks.parksCanadaDiscovery.when,
        'Covers all 3 in vehicle for PEI National Park, Cape Breton Highlands, Bell NHS, Fortress of Louisbourg.',
        'canada'
      );
    }
    if (parks.hopewellRocks) {
      html += passCard(
        'Hopewell Rocks',
        'Separate NB provincial gate admission',
        'Pay at park gate Day 8 (May 29)',
        parks.hopewellRocks.coverage,
        'warning'
      );
    }
    return html;
  }

  function contactsHtml(emergency) {
    if (!emergency) return '';
    const rows = [];
    function addRow(label, value, isEmergency) {
      if (!value) return;
      const digits = cleanPhone(value);
      const cls = 'contact-row' + (isEmergency ? ' contact-row--emergency' : '');
      const href = digits ? 'tel:' + digits : '#';
      rows.push('<a class="' + cls + '" href="' + escapeHtml(href) + '">' +
        ICON_PHONE +
        '<span class="contact-row-label">' + escapeHtml(label) + '</span>' +
        '<span class="contact-row-value">' + escapeHtml(value) + '</span>' +
        '</a>');
    }
    if (emergency.universal) {
      rows.push('<a class="contact-row contact-row--emergency" href="tel:911">' +
        ICON_PHONE +
        '<span class="contact-row-label">Emergency (US &amp; Canada)</span>' +
        '<span class="contact-row-value">' + escapeHtml(emergency.universal) + '</span>' +
        '</a>');
    }
    addRow('Avis PWM counter', emergency.avisPwm);
    addRow('Northumberland Ferries', emergency.northumberlandFerries);
    addRow('Parks Canada', emergency.parksCanada);
    addRow('Hardy Boat (puffin cruise)', emergency.hardyBoat);
    addRow('Rum Runner Inn', emergency.rumRunnerInn);
    addRow('Fore Street (Portland)', emergency.foreStreet);
    addRow('Rossmount Inn (St. Andrews)', emergency.rossmountInn);
    addRow('Beach Pea (Lunenburg)', emergency.beachPea);
    return '<div class="contacts-list">' + rows.join('') + '</div>';
  }

  function paymentWarningHtml(payment) {
    if (!payment || !Array.isArray(payment.noAmex) || payment.noAmex.length === 0) return '';
    const items = payment.noAmex.map(function (n) { return '<li>' + escapeHtml(n) + '</li>'; }).join('');
    return '<article class="warning-card">' +
      '<div class="warning-card-icon">' + ICON_WARNING + '</div>' +
      '<div class="warning-card-body">' +
        '<p class="warning-card-title">Visa or Mastercard only — no American Express</p>' +
        '<ul class="warning-card-list">' + items + '</ul>' +
        (payment.note ? '<p class="warning-card-note">' + escapeHtml(payment.note) + '</p>' : '') +
      '</div>' +
      '</article>';
  }

  function passportHtml(border) {
    if (!border) return '';
    return '<article class="passport-card">' +
      '<div class="passport-card-icon">' + ICON_PASSPORT + '</div>' +
      '<div class="passport-card-body">' +
        '<p class="passport-card-title">Passports required for Canada entry</p>' +
        '<ul class="passport-card-list">' +
          '<li><strong>Day 6 (May 27):</strong> Cross into New Brunswick at St. Stephen / Calais.</li>' +
          '<li><strong>Day 15 (Jun 5):</strong> Return to US on CAT Ferry — US Customs processed on board.</li>' +
        '</ul>' +
        (border.note ? '<p class="passport-card-note">' + escapeHtml(border.note) + '</p>' : '') +
        '<p class="passport-card-tip">Tip: Keep passports accessible in the car, not in checked luggage.</p>' +
      '</div>' +
      '</article>';
  }

  function laundryHtml(laundry) {
    if (!laundry) return '';
    return '<article class="laundry-card">' +
      '<div class="laundry-card-icon">' + ICON_LAUNDRY + '</div>' +
      '<div class="laundry-card-body">' +
        '<p class="laundry-card-title">' + escapeHtml(laundry.bestStop) + '</p>' +
        (laundry.nights ? '<p class="laundry-card-nights">' + escapeHtml(laundry.nights) + '</p>' : '') +
        '<p class="laundry-card-detail">' + escapeHtml(laundry.detail) + '</p>' +
      '</div>' +
      '</article>';
  }

  function formatDateShort(iso) {
    if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso || '';
    const parts = iso.split('-').map(Number);
    const date = new Date(parts[0], parts[1] - 1, parts[2]);
    if (isNaN(date.getTime())) return iso;
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  }

  function renderInfo() {
    const root = document.getElementById('info-content');
    if (!root) return;
    if (!window.TRIP || !window.TRIP.info) {
      root.innerHTML = '<div class="info-body"><article class="card placeholder">' +
        '<p class="card-eyebrow">No data</p>' +
        '<h2 class="card-title">Info unavailable</h2></article></div>';
      return;
    }
    const info = window.TRIP.info;
    let html = '<div class="info-body">';
    html += infoSectionHtml('Key Deadlines', deadlineCardsHtml(info.keyDeadlines));
    html += infoSectionHtml('Time Zones', timeZonesHtml(info.timeZones));
    html += infoSectionHtml('Park Passes & Fees', parkPassesHtml(info.parkPasses));
    html += infoSectionHtml('Emergency & Key Contacts', contactsHtml(info.emergency));
    html += infoSectionHtml('Payment Warnings', paymentWarningHtml(info.payment));
    html += infoSectionHtml('Passport & Border', passportHtml(info.border));
    html += infoSectionHtml('Laundry', laundryHtml(info.laundry));
    html += '</div>';
    root.innerHTML = html;
  }

  // ---- Header scroll-shrink behavior -----------------------------------

  const HEADER_COMPACT_THRESHOLD = 20;
  const HEADER_HEIGHT_EXPANDED = '64px';
  const HEADER_HEIGHT_COMPACT = '44px';
  let headerCompact = false;
  let headerScrollRaf = 0;

  function setHeaderCompact(compact) {
    if (compact === headerCompact) return;
    headerCompact = compact;
    document.querySelectorAll('.tab-header').forEach(function (h) {
      h.classList.toggle('header--compact', compact);
    });
    document.documentElement.style.setProperty(
      '--header-height',
      compact ? HEADER_HEIGHT_COMPACT : HEADER_HEIGHT_EXPANDED
    );
  }

  function resetHeader() {
    setHeaderCompact(false);
  }

  function getActiveScrollTop() {
    // The active scroll container could be either tab-content (if it's overflowing
    // internally) or the window (when the page itself is taller than the viewport).
    // Take the larger of the two so the header reacts to whichever is actually moving.
    const activeSection = document.querySelector('.tab-section.is-active');
    let internal = 0;
    if (activeSection) {
      const tc = activeSection.querySelector('.tab-content');
      if (tc) internal = tc.scrollTop;
    }
    const win = window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0;
    return Math.max(internal, win);
  }

  function evaluateHeaderState() {
    if (headerScrollRaf) return;
    headerScrollRaf = requestAnimationFrame(function () {
      headerScrollRaf = 0;
      setHeaderCompact(getActiveScrollTop() > HEADER_COMPACT_THRESHOLD);
    });
  }

  function attachHeaderScrollListeners() {
    window.addEventListener('scroll', evaluateHeaderState, { passive: true });
    document.querySelectorAll('.tab-content').forEach(function (tc) {
      tc.addEventListener('scroll', evaluateHeaderState, { passive: true });
    });
  }

  function updateTodayHeaderTitle() {
    const titleEl = document.getElementById('header-today');
    if (!titleEl) return;
    const ctx = findTodayContext();
    if (!ctx) {
      titleEl.textContent = 'Today';
      return;
    }
    if (ctx.mode === 'live' && window.TRIP && window.TRIP.meta) {
      titleEl.textContent = 'Day ' + ctx.day.dayNum + ' of ' + window.TRIP.meta.days;
    } else {
      titleEl.textContent = 'Today';
    }
  }

  // ---- Firestore subscriptions / seeding / migration -------------------

  function migrateLegacyCompletedDays() {
    let raw;
    try { raw = localStorage.getItem(COMPLETED_DAYS_LEGACY_KEY); } catch (e) { return Promise.resolve(); }
    if (!raw) return Promise.resolve();

    let days;
    try { days = JSON.parse(raw); } catch (e) { days = null; }
    if (!Array.isArray(days) || days.length === 0) {
      try { localStorage.removeItem(COMPLETED_DAYS_LEGACY_KEY); } catch (e) {}
      return Promise.resolve();
    }

    const D = fb();
    if (!D) return Promise.resolve();

    const batch = D.batch();
    days.forEach(function (d) {
      if (typeof d !== 'number' || !isFinite(d)) return;
      const ref = D.collection('trips/maine-2026/completedDays').doc(String(d));
      batch.set(ref, { dayNum: d, completedAt: fbTimestamp() }, { merge: true });
    });
    return batch.commit().then(function () {
      try { localStorage.removeItem(COMPLETED_DAYS_LEGACY_KEY); } catch (e) {}
    }).catch(function (err) {
      console.error('Migrate legacy completed-days failed:', err);
    });
  }

  function maybeSeedFirestore() {
    let already;
    try { already = localStorage.getItem(FIRESTORE_SEEDED_KEY); } catch (e) {}
    if (already === '1') return Promise.resolve();

    const D = fb();
    if (!D || !window.TRIP || !Array.isArray(window.TRIP.expenses)) return Promise.resolve();

    return D.collection('trips/maine-2026/expenses').limit(1).get().then(function (snap) {
      if (!snap.empty) {
        try { localStorage.setItem(FIRESTORE_SEEDED_KEY, '1'); } catch (e) {}
        return;
      }
      const batch = D.batch();
      window.TRIP.expenses.forEach(function (e) {
        const ref = D.collection('trips/maine-2026/expenses').doc(e.id);
        const data = {};
        for (const k in e) {
          if (Object.prototype.hasOwnProperty.call(e, k) && k !== 'id') data[k] = e[k];
        }
        data.createdAt = fbTimestamp();
        batch.set(ref, data);
      });
      return batch.commit().then(function () {
        try { localStorage.setItem(FIRESTORE_SEEDED_KEY, '1'); } catch (e) {}
      });
    }).catch(function (err) {
      console.error('Seed Firestore failed:', err);
    });
  }

  function subscribeToExpenses() {
    if (expensesSubscribed) return;
    const D = fb();
    if (!D) {
      expenseCache = [];
      renderExpenses();
      updateExpensesHeaderTotal();
      return;
    }
    expensesSubscribed = true;
    D.collection('trips/maine-2026/expenses').onSnapshot(
      function (snap) {
        const docs = snap.docs.map(function (d) {
          const data = d.data() || {};
          return migrateExpense(Object.assign({ id: d.id }, data));
        });
        expenseCache = docs;
        initialExpensesReceived = true;
        if (document.getElementById('expenses-content')) renderExpenses();
        updateExpensesHeaderTotal();
      },
      function (err) {
        console.error('Expenses snapshot error:', err);
        if (!initialExpensesReceived) {
          expenseCache = [];
          renderExpenses();
        }
      }
    );
  }

  function subscribeToCompletedDays() {
    if (completedSubscribed) return;
    const D = fb();
    if (!D) {
      completedCache = [];
      applyCompletionStateToAllUi();
      return;
    }
    completedSubscribed = true;
    D.collection('trips/maine-2026/completedDays').onSnapshot(
      function (snap) {
        const days = snap.docs.map(function (d) {
          const docData = d.data() || {};
          const fromData = Number(docData.dayNum);
          if (Number.isFinite(fromData)) return fromData;
          return Number(d.id);
        }).filter(Number.isFinite);
        completedCache = days;
        initialCompletedReceived = true;
        applyCompletionStateToAllUi();
      },
      function (err) {
        console.error('Completed days snapshot error:', err);
        if (!initialCompletedReceived) {
          completedCache = [];
          applyCompletionStateToAllUi();
        }
      }
    );
  }

  function initFirestore() {
    if (!fb()) {
      console.warn('Firestore unavailable — falling back to empty caches.');
      expenseCache = [];
      completedCache = [];
      renderExpenses();
      updateExpensesHeaderTotal();
      applyCompletionStateToAllUi();
      showOfflineBannerIfOffline();
      return;
    }
    // Best-effort migration + seed; subscriptions don't wait for these
    // (onSnapshot will pick up writes when they land).
    migrateLegacyCompletedDays();
    maybeSeedFirestore();
    subscribeToExpenses();
    subscribeToCompletedDays();

    // 5-second safety net — if no snapshot has arrived and we're offline,
    // surface a banner so the user knows what's going on.
    setTimeout(function () {
      if (!initialExpensesReceived && !navigator.onLine) showOfflineBanner();
    }, 5000);
  }

  // ---- Offline banner --------------------------------------------------

  function showOfflineBanner() {
    if (document.getElementById('offline-banner')) return;
    const banner = document.createElement('div');
    banner.id = 'offline-banner';
    banner.className = 'offline-banner';
    banner.setAttribute('role', 'status');
    banner.innerHTML =
      '<span class="offline-banner-text">You’re offline. Changes will sync when you reconnect.</span>' +
      '<button type="button" class="offline-banner-close" aria-label="Dismiss">×</button>';
    banner.querySelector('.offline-banner-close').addEventListener('click', function () {
      banner.remove();
    });
    document.body.appendChild(banner);
  }

  function showOfflineBannerIfOffline() {
    if (!navigator.onLine) showOfflineBanner();
  }

  function attachConnectivityListeners() {
    window.addEventListener('online', function () {
      const banner = document.getElementById('offline-banner');
      if (banner) banner.remove();
    });
    window.addEventListener('offline', showOfflineBanner);
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

    // Reset header to expanded state and scroll new tab to top
    resetHeader();
    const activeContent = document.querySelector('#tab-' + tab + ' .tab-content');
    if (activeContent) activeContent.scrollTop = 0;
    window.scrollTo(0, 0);

    if (tab === 'timeline') {
      requestAnimationFrame(function () {
        maybeScrollTimelineToToday();
        setupTimelineObserver();
      });
    }
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
    renderExpenses();
    renderTimeline();
    renderInfo();
    updateTodayHeaderTitle();
    attachHeaderScrollListeners();
    attachConnectivityListeners();
    initFirestore();
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
