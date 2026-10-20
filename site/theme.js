// Apply the saved UI palette before styles load to avoid a bright flash.
(function () {
  const key = 'bathymetry-ui-theme';
  const valid = theme => theme === 'midnight' || theme === 'charcoal';
  function apply(theme, save = true) {
    if (!valid(theme)) theme = 'midnight';
    document.documentElement.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]').content = theme === 'charcoal' ? '#000000' : '#101922';
    const select = document.getElementById('theme-select');
    if (select) select.value = theme;
    if (save) {try {localStorage.setItem(key, theme);} catch { /* Session-only choice when storage is unavailable. */ }}
  }
  let stored;
  try {stored = localStorage.getItem(key);} catch {}
  apply(stored, false);
  window.WorkbenchTheme = {apply, current: () => document.documentElement.dataset.theme};
  window.addEventListener('storage', e => {if (e.key === key) apply(e.newValue, false);});
})();
