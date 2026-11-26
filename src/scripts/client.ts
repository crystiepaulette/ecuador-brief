const root = document.documentElement;

function systemTheme(): 'light' | 'dark' {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function activeTheme(): 'light' | 'dark' {
  const stored = root.getAttribute('data-theme');
  if (stored === 'light' || stored === 'dark') return stored;
  return systemTheme();
}

function paintTheme(theme: 'light' | 'dark') {
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', theme === 'dark' ? '#141414' : '#ffffff');
  document.querySelectorAll('[data-theme-toggle]').forEach((button) => {
    button.setAttribute('aria-pressed', theme === 'dark' ? 'true' : 'false');
  });
}

paintTheme(activeTheme());

document.querySelectorAll('[data-theme-toggle]').forEach((button) => {
  button.addEventListener('click', () => {
    const next = activeTheme() === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    try {
      localStorage.setItem('ecuador-brief-theme', next);
    } catch {
      // Private mode can block storage; the choice still applies to this view.
    }
    paintTheme(next);
  });
});

window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  if (!root.hasAttribute('data-theme')) paintTheme(activeTheme());
});

document.querySelectorAll<HTMLButtonElement>('[data-share]').forEach((button) => {
  const label = button.textContent ?? 'Compartir';
  button.addEventListener('click', async () => {
    const url = button.dataset.url || document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href || location.href;
    const title = document.title;
    const text = document.querySelector<HTMLMetaElement>('meta[name="description"]')?.content ?? '';
    if (navigator.share) {
      try {
        await navigator.share({ title, text, url });
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      button.textContent = 'Enlace copiado';
      window.setTimeout(() => {
        button.textContent = label;
      }, 2000);
    } catch {
      window.prompt('Copia el enlace de esta edición:', url);
    }
  });
});

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
document.querySelectorAll<HTMLAnchorElement>('a[aria-current="page"]').forEach((link) => {
  link.addEventListener('click', (event) => {
    const href = link.getAttribute('href');
    if (!href) return;
    if (new URL(href, location.href).pathname !== location.pathname) return;
    event.preventDefault();
    window.scrollTo({ top: 0, behavior: reduceMotion.matches ? 'auto' : 'smooth' });
    const details = link.closest('details');
    if (details) details.open = false;
  });
});

document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') return;
  document.querySelectorAll('details[open]').forEach((details) => {
    details.open = false;
  });
});

const scroller = document.querySelector<HTMLElement>('.side-scroll');
const currentInSidebar = scroller?.querySelector<HTMLElement>('a[aria-current="page"]');
if (scroller && currentInSidebar) {
  const top = currentInSidebar.offsetTop - scroller.clientHeight / 3;
  if (top > 0) scroller.scrollTop = top;
}

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  const base = import.meta.env.BASE_URL;
  navigator.serviceWorker.register(`${base}sw.js`, { scope: base, updateViaCache: 'none' }).catch(() => {});
}
