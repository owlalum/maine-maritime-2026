/**
 * Firebase / Firestore initialization.
 *
 * Loaded after firebase-app-compat.js + firebase-firestore-compat.js
 * (both come from the gstatic CDN — see index.html).
 *
 * Source of truth for shared trip data:
 *   trips/maine-2026/expenses/{docId}
 *   trips/maine-2026/completedDays/{dayNum}
 *
 * Per-device preferences (view toggle, last category, etc.) stay in localStorage.
 */
(function () {
  'use strict';

  const firebaseConfig = {
    apiKey: "AIzaSyDc9f1ph6JhYf76zNpKfUJG9mkgmGPzA_o",
    authDomain: "marine-maritime-2026.firebaseapp.com",
    projectId: "marine-maritime-2026",
    storageBucket: "marine-maritime-2026.firebasestorage.app",
    messagingSenderId: "904547829468",
    appId: "1:904547829468:web:e38952d58e5e76e37b1619"
  };

  if (typeof firebase === 'undefined') {
    console.error('Firebase SDK not loaded — Firestore sync disabled.');
    return;
  }

  try {
    firebase.initializeApp(firebaseConfig);
  } catch (e) {
    // Already initialized (e.g. hot reload) — safe to ignore
    if (!/already exists/i.test(String(e))) {
      console.error('Firebase init failed:', e);
      return;
    }
  }

  const db = firebase.firestore();

  // Offline persistence — critical for rural Nova Scotia / Cape Breton coverage gaps.
  // Must be called before any other Firestore operation.
  db.enablePersistence({ synchronizeTabs: true }).catch(function (err) {
    console.warn(
      'Firestore offline persistence unavailable:',
      err && err.code ? err.code : '',
      err && err.message ? err.message : err
    );
  });

  window.MM2026_DB = db;
  window.MM2026_FB_TIMESTAMP = function () {
    return firebase.firestore.FieldValue.serverTimestamp();
  };
})();
