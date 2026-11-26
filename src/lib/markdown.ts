import { Marked, type Tokens } from 'marked';
import { placeCharts, validateCharts } from './charts';

export interface RenderedEdition {
  headerLines: string[];
  datelineText: string;
  claves: string[];
  subtitle: string;
  html: string;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function decodeEntities(value: string): string {
  return value
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&');
}

function stripTags(html: string): string {
  return decodeEntities(html.replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim();
}

const marked = new Marked({ gfm: true, breaks: true });

marked.use({
  renderer: {
    html({ text }: Tokens.HTML | Tokens.Tag) {
      if (/^\s*<!--[\s\S]*-->\s*$/.test(text)) return '';
      return escapeHtml(text);
    },
    link(this: { parser: { parseInline: (tokens: Tokens.Link['tokens']) => string } }, token: Tokens.Link) {
      const inner =
        token.tokens?.length && this.parser ? this.parser.parseInline(token.tokens) : escapeHtml(token.text);
      const title = token.title ? ` title="${escapeHtml(token.title)}"` : '';
      return `<a href="${escapeHtml(token.href)}"${title} target="_blank" rel="noopener noreferrer">${inner}<span class="sr-only"> (se abre en una pestaña nueva)</span></a>`;
    },
  },
});

function parseMarkdown(source: string): string {
  const html = marked.parse(source, { async: false });
  if (typeof html !== 'string') throw new Error('No se pudo convertir el Markdown.');
  return html;
}

function renderLine(line: string): string {
  return parseMarkdown(line.trim()).replace(/^<p>/, '').replace(/<\/p>\s*$/, '').trim();
}

export function splitEdition(markdown: string): { header: string; body: string } {
  const text = markdown.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = text.split('\n');
  let index = 0;
  const blank = (line: string | undefined) => !line || line.trim() === '';
  while (blank(lines[index])) index += 1;

  if (/^#\s+the ecuador brief\s*$/i.test(lines[index] ?? '')) {
    index += 1;
    while (blank(lines[index])) index += 1;
  }

  if (lines[index] && !lines[index]!.startsWith('##')) {
    let end = index;
    const buffer: string[] = [];
    while (lines[end] && !blank(lines[end]) && !lines[end]!.startsWith('##')) {
      buffer.push(lines[end]!);
      end += 1;
    }
    const joined = buffer.join('\n');
    const tagline =
      /Información\s·\sContexto\s·\sConocimiento/.test(joined) ||
      /Entender Ecuador,\s+más allá de los titulares/.test(joined);
    const meta = /^(?:Cierre|Última|Ventana|Lectura)\b/m.test(joined);
    if (tagline && !meta && buffer.length <= 6) {
      index = end;
      while (blank(lines[index])) index += 1;
    }
  }

  const headerLines: string[] = [];
  while (lines[index] && !lines[index]!.startsWith('##')) {
    headerLines.push(lines[index]!);
    index += 1;
  }
  return {
    header: headerLines.join('\n').trim(),
    body: lines.slice(index).join('\n').trim(),
  };
}

export function extractClaves(markdown: string): string[] {
  const start = markdown.match(/^##[^\n]*claves del día[^\n]*\n/im);
  if (!start || start.index == null) return [];
  const rest = markdown.slice(start.index + start[0].length);
  const next = rest.search(/\n##\s/);
  const section = next === -1 ? rest : rest.slice(0, next);
  const claves: string[] = [];
  for (const item of section.matchAll(/^\s*\d{1,2}[.)]\s+\*\*([^*]+)\*\*/gm)) {
    claves.push(item[1]!.trim().replace(/\.$/, ''));
  }
  return claves;
}

function markClaves(html: string): string {
  return html.replace(
    /(<h2\b[^>]*>[^<]*claves del día[^<]*<\/h2>\s*)<ol\b([^>]*)>/i,
    (_match, prefix: string, attrs: string) => {
      if (/\bclass="/.test(attrs)) return `${prefix}<ol${attrs.replace(/class="/, 'class="claves ')}>`;
      return `${prefix}<ol class="claves"${attrs}>`;
    },
  );
}

function wrapTables(html: string): string {
  return html.replace(/<table\b[\s\S]*?<\/table>/g, (table) => `<div class="table-scroll">${table}</div>`);
}

export function renderEdition(markdown: string, chartsInput: unknown = [], sourceName = 'charts.json'): RenderedEdition {
  const charts = validateCharts(chartsInput, sourceName);
  const { header, body } = splitEdition(markdown);
  const withMarkers = body.replace(/<!--\s*chart:\s*(\d+)\s*-->/gi, (_match, number: string) => {
    return `\n\nEBCHARTTOKEN${Number(number)}END\n\n`;
  });
  const headerLines = header
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => renderLine(line));
  const html = placeCharts(wrapTables(markClaves(parseMarkdown(withMarkers))), charts, sourceName);
  const claves = extractClaves(body);
  return {
    headerLines,
    datelineText: stripTags(headerLines[0] ?? ''),
    claves,
    subtitle: claves[0] ?? '',
    html,
  };
}
