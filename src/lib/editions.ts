import { formatLongDate, isValidISODate } from './dates';
import { renderEdition, type RenderedEdition } from './markdown';

export interface Edition extends RenderedEdition {
  date: string;
  file: string;
}

const markdownFiles = import.meta.glob('../../editions/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, unknown>;

const chartFiles = import.meta.glob('../../editions/*.charts.json', {
  import: 'default',
  eager: true,
}) as Record<string, unknown>;

function unwrap(mod: unknown): unknown {
  if (mod && typeof mod === 'object' && 'default' in mod) {
    const keys = Object.keys(mod);
    if (keys.length === 1 && keys[0] === 'default') return (mod as { default: unknown }).default;
  }
  return mod;
}

function pretty(filePath: string): string {
  const index = filePath.lastIndexOf('editions/');
  return index >= 0 ? filePath.slice(index) : filePath;
}

function dateIn(filePath: string, suffix: 'md' | 'charts.json'): string | null {
  const match = filePath.match(/(\d{4}-\d{2}-\d{2})\.(md|charts\.json)$/);
  if (!match || match[2] !== suffix) return null;
  return isValidISODate(match[1]!) ? match[1]! : null;
}

export function getEditions(): Edition[] {
  const charts = new Map<string, { file: string; data: unknown }>();
  for (const [filePath, mod] of Object.entries(chartFiles)) {
    const file = pretty(filePath);
    if (!/(\d{4}-\d{2}-\d{2})\.charts\.json$/.test(filePath)) {
      throw new Error(`${file}: el nombre debe ser editions/AAAA-MM-DD.charts.json.`);
    }
    const date = dateIn(filePath, 'charts.json');
    if (!date) throw new Error(`${file}: la fecha no existe.`);
    charts.set(date, { file, data: unwrap(mod) });
  }

  const editions: Edition[] = [];
  for (const [filePath, mod] of Object.entries(markdownFiles)) {
    const file = pretty(filePath);
    if (!/(\d{4}-\d{2}-\d{2})\.md$/.test(filePath)) {
      throw new Error(`${file}: el nombre debe ser editions/AAAA-MM-DD.md.`);
    }
    const date = dateIn(filePath, 'md');
    if (!date) throw new Error(`${file}: la fecha no existe.`);
    const markdown = unwrap(mod);
    if (typeof markdown !== 'string') throw new Error(`${file}: no se pudo leer el Markdown.`);
    const sidecar = charts.get(date);
    const rendered = renderEdition(markdown, sidecar?.data ?? [], sidecar?.file ?? file);
    if (!rendered.datelineText) {
      const fallback = formatLongDate(date);
      rendered.headerLines.unshift(fallback);
      rendered.datelineText = fallback;
    }
    editions.push({ date, file, ...rendered });
  }

  const known = new Set(editions.map((edition) => edition.date));
  for (const [date, sidecar] of charts) {
    if (!known.has(date)) throw new Error(`${sidecar.file}: no existe editions/${date}.md.`);
  }

  editions.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  return editions;
}
