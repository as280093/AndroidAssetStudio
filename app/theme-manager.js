/*
 * Android Asset Studio - Theme Manager
 * Supports System Scheme Detection (prefers-color-scheme) & Manual Persistence
 */
(function() {
  'use strict';

  function getSavedTheme() {
    try {
      return localStorage.getItem('assetStudioTheme');
    } catch (e) {
      return null;
    }
  }

  function getSystemPreference() {
    try {
      return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light';
    } catch (e) {
      return 'light';
    }
  }

  function getEffectiveTheme() {
    var saved = getSavedTheme();
    if (saved === 'dark' || saved === 'light') {
      return saved;
    }
    return getSystemPreference();
  }

  function applyTheme(theme) {
    if (theme === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
      if (document.body) document.body.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
      if (document.body) document.body.removeAttribute('data-theme');
    }
    updateToggleButtons(theme);
  }

  function updateToggleButtons(theme) {
    var isDark = (theme === 'dark');
    var buttons = document.querySelectorAll('.page-header-theme-toggle');
    for (var i = 0; i < buttons.length; i++) {
      var btn = buttons[i];
      var titleText = isDark ? 'Switch to light theme' : 'Switch to dark theme';
      btn.setAttribute('title', titleText);
      btn.setAttribute('aria-label', titleText);
      var icon = btn.querySelector('.material-icons');
      if (icon) {
        icon.textContent = isDark ? 'brightness_7' : 'brightness_4';
      }
      var textSpan = btn.querySelector('.theme-text');
      if (textSpan) {
        textSpan.textContent = isDark ? 'Light mode' : 'Dark mode';
      }
    }
  }

  function toggleTheme() {
    var current = getEffectiveTheme();
    var next = (current === 'dark') ? 'light' : 'dark';
    try {
      localStorage.setItem('assetStudioTheme', next);
    } catch (e) {}
    applyTheme(next);
  }

  // React to OS system dark/light changes if user hasn't explicitly set preference
  try {
    var mql = window.matchMedia('(prefers-color-scheme: dark)');
    var onSystemChange = function(e) {
      if (!getSavedTheme()) {
        applyTheme(e.matches ? 'dark' : 'light');
      }
    };
    if (mql.addEventListener) {
      mql.addEventListener('change', onSystemChange);
    } else if (mql.addListener) {
      mql.addListener(onSystemChange);
    }
  } catch (e) {}

  // Expose public API
  window.assetStudioTheme = {
    get: getEffectiveTheme,
    toggle: toggleTheme,
    set: function(theme) {
      try {
        localStorage.setItem('assetStudioTheme', theme);
      } catch (e) {}
      applyTheme(theme);
    },
    resetToSystem: function() {
      try {
        localStorage.removeItem('assetStudioTheme');
      } catch (e) {}
      applyTheme(getSystemPreference());
    }
  };

  // Ensure buttons in DOM are connected
  function bindButtons() {
    // Inject button in .page-header-links if missing
    var headerLinks = document.querySelector('.page-header-links');
    if (headerLinks && !headerLinks.querySelector('.page-header-theme-toggle')) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'icon-button theme-dark page-header-theme-toggle';
      btn.innerHTML = '<i class="material-icons">brightness_4</i>';
      headerLinks.insertBefore(btn, headerLinks.firstChild);
    }

    // Inject button in home page header if missing
    var homeHeaderInner = document.querySelector('.home-header .inner');
    if (homeHeaderInner && !document.querySelector('.home-header-theme-toggle-wrap')) {
      var wrap = document.createElement('div');
      wrap.className = 'home-header-theme-toggle-wrap';
      var homeBtn = document.createElement('button');
      homeBtn.type = 'button';
      homeBtn.className = 'icon-button theme-dark page-header-theme-toggle';
      homeBtn.innerHTML = '<i class="material-icons">brightness_4</i>';
      wrap.appendChild(homeBtn);
      homeHeaderInner.parentElement.style.position = 'relative';
      homeHeaderInner.parentElement.appendChild(wrap);
    }

    var allBtns = document.querySelectorAll('.page-header-theme-toggle');
    for (var j = 0; j < allBtns.length; j++) {
      (function(b) {
        if (!b._themeBound) {
          b._themeBound = true;
          b.addEventListener('click', function(ev) {
            ev.preventDefault();
            toggleTheme();
          });
        }
      })(allBtns[j]);
    }

    applyTheme(getEffectiveTheme());
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindButtons);
  } else {
    bindButtons();
  }
})();
