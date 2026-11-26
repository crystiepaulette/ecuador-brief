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

const home = await readFile(path.join(root, 'index.html'), 'utf8');
const edition = await readFile(path.join(root, '2026-11-26', 'index.html'), 'utf8');
const canonical = 'https://crystiepaulette.github.io/ecuador-brief/2026-11-26/';

for (const html of [home, edition]) {
  if (!html.includes(`rel="canonical" href="${canonical}"`)) fail('Falta la URL canónica de la edición.');
  if ((html.match(/THE ECUADOR BRIEF/g) ?? []).length !== 1) fail('El masthead debe aparecer una sola vez.');
  if ((html.match(/Entender Ecuador, más allá de los titulares\./g) ?? []).length !== 1) fail('El lema debe aparecer una sola vez.');
  if ((html.match(/Información · Contexto · Conocimiento/g) ?? []).length !== 1) fail('La línea de secciones debe aparecer una sola vez.');
  for (const phrase of [
    'jue 26 nov 2026',
    'noviembre 2026',
    'Jueves 26 de noviembre de 2026',
    'Cierre:',
    'Ventana principal:',
    'Lectura estimada:',
    'El Niño desborda 25 ríos',
    'Desbordamientos reportados por provincia',
    'width:100%',
    'width:6.25%',
    'Los Ríos',
    'Manabí',
    'Secretaría de Gestión de Riesgos vía Primicias',
    'CNEL amplía',
    'Variable renewables',
    'Conteo rápido',
    'ol class="claves"',
    'target="_blank"',
    'apple-mobile-web-app-title" content="Ecuador Brief"',
    'apple-touch-icon',
    '/ecuador-brief/manifest.webmanifest',
    'serviceWorker.register',
  ]) {
    if (!html.includes(phrase)) fail(`Falta «${phrase}» en el HTML construido.`);
  }
  const chart = html.indexOf('Desbordamientos reportados por provincia');
  const source = html.indexOf('babahoyo-se-declara-en-emergencia');
  const energy = html.indexOf('>Energía<');
  if (!(source < chart && chart < energy)) fail('El gráfico no quedó después de la nota de inundaciones.');
  if (html.includes('EBCHARTTOKEN')) fail('Quedó un marcador de gráfico sin reemplazar.');
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

console.log('Build verificado: edición, gráfico, manifiesto, iconos y base path.');
