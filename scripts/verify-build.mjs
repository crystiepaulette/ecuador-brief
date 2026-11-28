import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const root = 'dist';
const editionDir = 'editions';
const origin = 'https://crystiepaulette.github.io/ecuador-brief';

async function walk(dir) {
  const files = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(full)));
    else files.push(full);
  }
  return files;
}

function fail(message) {
  throw new Error(message);
}

function isValidISODate(iso) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function escapeHtml(value) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function decodeEntities(value) {
  return value
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&');
}

function fold(value) {
  return decodeEntities(value.replace(/<[^>]+>/g, ' '))
    .normalize('NFD')
    .replace(/\p{M}+/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

const numberFormat = new Intl.NumberFormat('es-EC', { maximumFractionDigits: 2 });

function valueText(point) {
  if (typeof point.display === 'string' && point.display.trim()) return point.display.trim();
  return numberFormat.format(point.value);
}

function articleOf(html, date) {
  const match = html.match(/<article class="edition">[\s\S]*<\/article>/);
  if (!match) fail(`La página de ${date} no tiene el artículo de la edición.`);
  return match[0];
}

function headings(html) {
  const expression = /<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi;
  const hits = [];
  for (const match of html.matchAll(expression)) {
    hits.push({ level: Number(match[1]), text: fold(match[2] ?? ''), start: match.index ?? 0 });
  }
  return hits;
}

function figures(html) {
  const found = [];
  const expression = /<figure class="chart chart-(bars|columns|line)">([\s\S]*?)<\/figure>/g;
  for (const match of html.matchAll(expression)) {
    const caption = /<figcaption class="chart-title"[^>]*>([\s\S]*?)<\/figcaption>/.exec(match[0]);
    found.push({
      type: match[1],
      html: match[0],
      start: match.index ?? 0,
      title: caption ? decodeEntities(caption[1]) : '',
    });
  }
  return found;
}

function expectShell(html, date) {
  const canonical = `${origin}/${date}/`;
  if (!html.includes(`rel="canonical" href="${canonical}"`)) {
    fail(`La página de ${date} no apunta a su URL canónica.`);
  }
  if ((html.match(/THE ECUADOR BRIEF/g) ?? []).length !== 1) {
    fail(`El masthead debe aparecer una sola vez en ${date}.`);
  }
  if ((html.match(/Entender Ecuador, más allá de los titulares\./g) ?? []).length !== 1) {
    fail(`El lema debe aparecer una sola vez en ${date}.`);
  }
  if ((html.match(/Información · Contexto · Conocimiento/g) ?? []).length !== 1) {
    fail(`La línea de secciones debe aparecer una sola vez en ${date}.`);
  }
  if (!html.includes('apple-mobile-web-app-title" content="Ecuador Brief"')) {
    fail(`Falta el nombre de la app en ${date}.`);
  }
  if (!html.includes('apple-touch-icon') || !html.includes('/ecuador-brief/manifest.webmanifest')) {
    fail(`Faltan el icono o el manifiesto en ${date}.`);
  }
  if (!html.includes('serviceWorker.register')) fail(`Falta el service worker en ${date}.`);
  if (!html.includes(`href="/ecuador-brief/${date}/" aria-current="page"`)) {
    fail(`La edición ${date} no queda marcada como la página actual.`);
  }
  if (html.includes('EBCHARTTOKEN')) fail(`Quedó un marcador de gráfico sin reemplazar en ${date}.`);
}

function assertChart(article, chart, index, date, placedByMarker) {
  const where = `${date}, gráfico ${index + 1}`;
  const title = typeof chart.title === 'string' ? chart.title.trim() : '';
  if (!title) fail(`${where} no tiene título.`);
  const rendered = figures(article).filter((figure) => figure.title === title);
  if (rendered.length === 0) fail(`${where} («${title}») no aparece en la página.`);
  const figure = rendered[0];
  if (figure.type !== chart.type) fail(`${where} no se dibujó como «${chart.type}».`);
  const visual = chart.type === 'columns' ? 'chart-col-bar' : chart.type === 'line' ? 'chart-line' : 'chart-bar';
  if (!figure.html.includes(visual)) fail(`${where} no tiene la marca visual del gráfico.`);
  if (!Array.isArray(chart.data) || chart.data.length === 0) fail(`${where} no tiene datos.`);
  for (const point of chart.data) {
    const label = typeof point.label === 'string' ? point.label.trim() : '';
    const row = `<th scope="row">${escapeHtml(label)}</th><td>${escapeHtml(valueText(point))}</td>`;
    if (!figure.html.includes(row)) fail(`${where} no muestra «${label}».`);
  }
  if (placedByMarker || typeof chart.after !== 'string' || !chart.after.trim()) return figure;

  const needle = fold(chart.after);
  const hits = headings(article);
  const headingIndex = hits.findIndex((hit) => hit.text.startsWith(needle));
  if (headingIndex === -1) fail(`${where} no encontró el encabezado «${chart.after}».`);
  const heading = hits[headingIndex];
  const next = hits.slice(headingIndex + 1).find((hit) => hit.level <= heading.level);
  const afterHeading = figure.start > heading.start;
  const beforeNext = next ? figure.start < next.start : true;
  if (!afterHeading || !beforeNext) {
    fail(`${where} no quedó después del encabezado «${chart.after}».`);
  }
  return figure;
}

const files = await walk(root);
const textFiles = files.filter((file) => /\.(html|css|js|webmanifest|svg)$/.test(file));
const urlPattern = /(?:url\(\s*|href\s*=\s*|src\s*=\s*)(['"]?)(\/[^)'"\s]+)\1/g;

for (const file of textFiles) {
  const text = await readFile(file, 'utf8');
  for (const match of text.matchAll(urlPattern)) {
    const url = match[2];
    if (url.startsWith('/ecuador-brief/') || url.startsWith('/ecuador-brief"') || url === '/ecuador-brief/') continue;
    if (url.startsWith('/ecuador-brief')) continue;
    fail(`${file} apunta fuera de /ecuador-brief/: ${url}`);
  }
}

const sourceNames = await readdir(editionDir);
const dates = [];
for (const name of sourceNames) {
  const markdown = /^(\d{4}-\d{2}-\d{2})\.md$/.exec(name);
  const charts = /^(\d{4}-\d{2}-\d{2})\.charts\.json$/.exec(name);
  const iso = markdown?.[1] ?? charts?.[1];
  if (!iso) continue;
  if (!isValidISODate(iso)) fail(`${name}: la fecha no existe.`);
  if (markdown) dates.push(iso);
}

if (dates.length === 0) fail('No hay ediciones en editions/.');
const uniqueDates = [...new Set(dates)].sort((a, b) => (a < b ? 1 : a > b ? -1 : 0));
const newest = uniqueDates[0];

for (const name of sourceNames) {
  const charts = /^(\d{4}-\d{2}-\d{2})\.charts\.json$/.exec(name);
  if (charts && !uniqueDates.includes(charts[1])) {
    fail(`${name} no tiene editions/${charts[1]}.md.`);
  }
}

const builtDates = (await readdir(root))
  .filter((name) => /^\d{4}-\d{2}-\d{2}$/.test(name))
  .sort();
const expectedDates = [...uniqueDates].sort();
if (builtDates.join() !== expectedDates.join()) {
  fail(`Las páginas (${builtDates.join(', ')}) no coinciden con editions/ (${expectedDates.join(', ')}).`);
}

const pages = new Map();
for (const date of uniqueDates) {
  const html = await readFile(path.join(root, date, 'index.html'), 'utf8');
  expectShell(html, date);
  pages.set(date, html);
}

const home = await readFile(path.join(root, 'index.html'), 'utf8');
expectShell(home, newest);
if (articleOf(home, newest) !== articleOf(pages.get(newest), newest)) {
  fail('La portada no muestra la edición más reciente.');
}

for (const date of uniqueDates) {
  const chartFile = `${date}.charts.json`;
  if (!sourceNames.includes(chartFile)) continue;
  const charts = JSON.parse(await readFile(path.join(editionDir, chartFile), 'utf8'));
  if (!Array.isArray(charts)) fail(`${chartFile}: el contenido debe ser una lista de gráficos.`);
  const markdown = await readFile(path.join(editionDir, `${date}.md`), 'utf8');
  const markers = new Set(
    [...markdown.matchAll(/<!--\s*chart:\s*(\d+)\s*-->/gi)].map((match) => Number(match[1])),
  );
  const article = articleOf(pages.get(date), date);
  charts.forEach((chart, index) => {
    assertChart(article, chart, index, date, markers.has(index + 1));
  });
  const renderedCount = figures(article).length;
  if (renderedCount !== charts.length) {
    fail(`${date} muestra ${renderedCount} gráficos y ${chartFile} define ${charts.length}.`);
  }
}

const manifest = JSON.parse(await readFile(path.join(root, 'manifest.webmanifest'), 'utf8'));
if (manifest.name !== 'The Ecuador Brief' || manifest.short_name !== 'Ecuador Brief' || manifest.display !== 'standalone') {
  fail('El manifiesto no tiene el nombre o el modo standalone.');
}
if (manifest.start_url !== '/ecuador-brief/' || manifest.scope !== '/ecuador-brief/') {
  fail('El manifiesto no está bajo /ecuador-brief/.');
}

const worker = await readFile(path.join(root, 'sw.js'), 'utf8');
if (!worker.includes('networkFirstResponse') || !worker.includes('/ecuador-brief')) {
  fail('El service worker no usa network-first bajo el base path.');
}

console.log(`Build verificado: ${uniqueDates.length} ediciones, la portada es ${newest}, gráficos, manifiesto y base path.`);
