export type ThemePreference = 'light' | 'dark' | 'system';

export const THEME_KEY = 'pokhair.theme';
const THEME_EVENT = 'pokhair-theme';

/** Inline <head> script: applies the theme before first paint and follows OS changes in "system" mode. */
export const THEME_SCRIPT = `(function(){try{var m=window.matchMedia('(prefers-color-scheme: dark)');function a(){var p=localStorage.getItem('${THEME_KEY}')||'dark';var d=p==='dark'||(p==='system'&&m.matches);var e=document.documentElement;e.classList.toggle('dark',d);e.style.colorScheme=d?'dark':'light';}a();m.addEventListener('change',a);window.addEventListener('${THEME_EVENT}',a);}catch(_){}})();`;

export function getThemePreference(): ThemePreference {
  const value = localStorage.getItem(THEME_KEY);
  return value === 'light' || value === 'system' ? value : 'dark';
}

export function setThemePreference(pref: ThemePreference) {
  localStorage.setItem(THEME_KEY, pref);
  window.dispatchEvent(new Event(THEME_EVENT));
}
