import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const root = 'dist';

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

const editionDates = (await readdir(root))
  .filter((name) => /^\d{4}-\d{2}-\d{2}$/.test(name))
  .sort()
  .reverse();
if (editionDates.length === 0) fail('No hay ediciones en el sitio construido.');
const newest = editionDates[0];
const home = await readFile(path.join(root, 'index.html'), 'utf8');
const newestCanonical = `https://crystiepaulette.github.io/ecuador-brief/${newest}/`;
if (!home.includes(`rel="canonical" href="${newestCanonical}"`)) {
  fail('La portada no apunta a la edición más reciente.');
}

const shared = [
  'Cierre:',
  'Ventana principal:',
  'Lectura estimada:',
  'ol class="claves"',
  'target="_blank"',
  'apple-mobile-web-app-title" content="Ecuador Brief"',
  'apple-touch-icon',
  '/ecuador-brief/manifest.webmanifest',
  'serviceWorker.register',
];

function expectEdition(html, date, phrases) {
  const canonical = `https://crystiepaulette.github.io/ecuador-brief/${date}/`;
  if (!html.includes(`rel="canonical" href="${canonical}"`)) fail(`Falta la URL canónica de ${date}.`);
  if ((html.match(/THE ECUADOR BRIEF/g) ?? []).length !== 1) fail('El masthead debe aparecer una sola vez.');
  if ((html.match(/Entender Ecuador, más allá de los titulares\./g) ?? []).length !== 1) fail('El lema debe aparecer una sola vez.');
  if ((html.match(/Información · Contexto · Conocimiento/g) ?? []).length !== 1) fail('La línea de secciones debe aparecer una sola vez.');
  for (const phrase of [...shared, ...phrases]) {
    if (!html.includes(phrase)) fail(`Falta «${phrase}» en la edición ${date}.`);
  }
  if (html.includes('EBCHARTTOKEN')) fail('Quedó un marcador de gráfico sin reemplazar.');
}

const nov26 = await readFile(path.join(root, '2026-11-26', 'index.html'), 'utf8');
expectEdition(nov26, '2026-11-26', [
  'jue 26 nov 2026',
  'Jueves 26 de noviembre de 2026',
  'Desbordamientos reportados por provincia',
  'width:6.25%',
]);
const floodChart = nov26.indexOf('Desbordamientos reportados por provincia');
const floodSource = nov26.indexOf('babahoyo-se-declara-en-emergencia');
const floodEnergy = nov26.indexOf('>Energía<');
if (!(floodSource < floodChart && floodChart < floodEnergy)) {
  fail('El gráfico del 26 nov no quedó después de la nota de inundaciones.');
}

if (!editionDates.includes('2026-11-27')) fail('Falta la edición del 27 de noviembre.');
const nov27 = await readFile(path.join(root, '2026-11-27', 'index.html'), 'utf8');
expectEdition(nov27, '2026-11-27', [
  'vie 27 nov 2026',
  'Viernes 27 de noviembre de 2026',
  'Personas impactadas por El Niño, por provincia',
  '31.844',
]);
const impactChart = nov27.indexOf('Personas impactadas por El Niño, por provincia');
const impactHeading = nov27.indexOf('El balance nacional de El Niño');
const elections = nov27.indexOf('>Elecciones<');
if (!(impactHeading < impactChart && impactChart < elections)) {
  fail('El gráfico del 27 nov no quedó después del balance de El Niño.');
}

if (!editionDates.includes('2026-11-28')) fail('Falta la edición del 28 de noviembre.');
const nov28 = await readFile(path.join(root, '2026-11-28', 'index.html'), 'utf8');
expectEdition(nov28, '2026-11-28', [
  'sáb 28 nov 2026',
  'Sábado 28 de noviembre de 2026',
  'Recintos electorales reubicados por provincia',
  'width:100%',
  'width:75%',
]);
const recintosChart = nov28.indexOf('Recintos electorales reubicados por provincia');
const recintosHeading = nov28.indexOf('Once recintos reubicados');
const justicia = nov28.indexOf('>Justicia<');
if (!(recintosHeading < recintosChart && recintosChart < justicia)) {
  fail('El gráfico del 28 nov no quedó después de los recintos reubicados.');
}

const newestHtml =
  newest === '2026-11-28'
    ? nov28
    : newest === '2026-11-27'
      ? nov27
      : newest === '2026-11-26'
        ? nov26
        : await readFile(path.join(root, newest, 'index.html'), 'utf8');
const chartTitles = [...newestHtml.matchAll(/class="chart-title"[^>]*>([^<]+)</g)].map((match) => match[1]);
expectEdition(home, newest, chartTitles);

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

console.log('Build verificado: edición, gráfico, manifiesto, iconos y base path.');
