/* Foundly theme controller: defaults to light/white and remembers the user's choice. */
(() => {
  const root = document.documentElement;
  const saved = localStorage.getItem('foundly-theme');
  const initial = saved === 'dark' || saved === 'light' ? saved : 'light';
  root.dataset.theme = initial;

  function updateButton(button) {
    const dark = root.dataset.theme === 'dark';
    button.setAttribute('aria-label', dark ? 'Switch to light mode' : 'Switch to dark mode');
    button.title = dark ? 'Switch to light mode' : 'Switch to dark mode';
    button.innerHTML = `<span class="theme-toggle-icon">${dark ? '☀️' : '🌙'}</span><span>${dark ? 'Light' : 'Dark'} mode</span>`;
  }

  function toggle() {
    const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
    root.dataset.theme = next;
    localStorage.setItem('foundly-theme', next);
    updateButton(document.getElementById('theme-toggle'));
  }

  function mount() {
    if (document.getElementById('theme-toggle')) return;
    const button = document.createElement('button');
    button.id = 'theme-toggle';
    button.className = 'theme-toggle';
    button.type = 'button';
    button.addEventListener('click', toggle);
    document.body.appendChild(button);
    updateButton(button);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
  else mount();
})();
