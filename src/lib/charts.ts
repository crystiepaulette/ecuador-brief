export type ChartType = 'bars' | 'columns' | 'line';

export interface ChartPoint {
  label: string;
  value: number;
  display?: string;
}

export interface Chart {
  type: ChartType;
  title: string;
  source: string;
  unit?: string;
  after?: string;
  data: ChartPoint[];
}

const TYPES = new Set<ChartType>(['bars', 'columns', 'line']);
const numberFormat = new Intl.NumberFormat('es-EC', { maximumFractionDigits: 2 });

export function validateCharts(input: unknown, file = 'charts.json'): Chart[] {
  if (input == null) return [];
  if (!Array.isArray(input)) {
    throw new Error(`${file}: el contenido debe ser una lista de gráficos.`);
  }
  return input.map((item, index) => {
    const where = `${file}: el gráfico ${index + 1}`;
    if (!item || typeof item !== 'object') throw new Error(`${where} no es un objeto.`);
    const record = item as Record<string, unknown>;
    if (typeof record.type !== 'string' || !TYPES.has(record.type as ChartType)) {
      throw new Error(`${where} tiene un tipo inválido. Usa "bars", "columns" o "line".`);
    }
    if (typeof record.title !== 'string' || !record.title.trim()) {
      throw new Error(`${where} necesita un título.`);
    }
    if (typeof record.source !== 'string' || !record.source.trim()) {
      throw new Error(`${where} necesita una fuente (source).`);
    }
    if (record.unit != null && typeof record.unit !== 'string') {
      throw new Error(`${where}: "unit" debe ser texto.`);
    }
    if (record.after != null && typeof record.after !== 'string') {
      throw new Error(`${where}: "after" debe ser texto.`);
    }
    if (!Array.isArray(record.data) || record.data.length === 0) {
      throw new Error(`${where} necesita una lista "data" con al menos un valor.`);
    }
    const data = record.data.map((row, rowIndex) => {
      if (!row || typeof row !== 'object') {
        throw new Error(`${where}: el dato ${rowIndex + 1} no es un objeto.`);
      }
      const point = row as Record<string, unknown>;
      const label = typeof point.label === 'string' ? point.label.trim() : '';
      if (!label) throw new Error(`${where}: el dato ${rowIndex + 1} necesita una etiqueta.`);
      if (typeof point.value !== 'number' || !Number.isFinite(point.value)) {
        throw new Error(`${where}: el valor de «${label}» debe ser un número.`);
      }
      if (point.value < 0) {
        throw new Error(`${where}: el valor de «${label}» es negativo. Las escalas parten de cero.`);
      }
      if (point.display != null && typeof point.display !== 'string') {
        throw new Error(`${where}: "display" de «${label}» debe ser texto.`);
      }
      const parsed: ChartPoint = { label, value: point.value };
      if (typeof point.display === 'string' && point.display.trim()) parsed.display = point.display.trim();
      return parsed;
    });
    const chart: Chart = {
      type: record.type as ChartType,
      title: record.title.trim(),
      source: record.source.trim(),
      data,
    };
    if (typeof record.unit === 'string' && record.unit.trim()) chart.unit = record.unit.trim();
    if (typeof record.after === 'string' && record.after.trim()) chart.after = record.after.trim();
    return chart;
  });
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatNumber(value: number): string {
  return numberFormat.format(value);
}

function valueText(point: ChartPoint): string {
  return point.display ?? formatNumber(point.value);
}

function percent(value: number, max: number): string {
  if (!(max > 0) || value <= 0) return '0%';
  const rounded = Math.round((value / max) * 10000) / 100;
  return `${rounded}%`;
}

function barWidth(value: number, max: number): string {
  const width = percent(value, max);
  return value > 0 ? `width:${width};min-width:2px` : `width:${width}`;
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

function fold(value: string): string {
  return decodeEntities(value.replace(/<[^>]+>/g, ' '))
    .normalize('NFD')
    .replace(/\p{M}+/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function sectionEnd(html: string, prefix: string): number | null {
  const needle = fold(prefix);
  if (!needle) return null;
  const expression = /<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi;
  const hits: { level: number; text: string; start: number }[] = [];
  for (const match of html.matchAll(expression)) {
    hits.push({ level: Number(match[1]), text: fold(match[2] ?? ''), start: match.index ?? 0 });
  }
  const index = hits.findIndex((hit) => hit.text.startsWith(needle));
  if (index === -1) return null;
  const level = hits[index]!.level;
  const next = hits.slice(index + 1).find((hit) => hit.level <= level);
  return next ? next.start : html.length;
}

function renderTable(chart: Chart): string {
  const rows = chart.data
    .map(
      (point) =>
        `<tr><th scope="row">${escapeHtml(point.label)}</th><td>${escapeHtml(valueText(point))}</td></tr>`,
    )
    .join('');
  const valueHeader = chart.unit ? `Valor (${escapeHtml(chart.unit)})` : 'Valor';
  return `<table class="sr-only"><thead><tr><th scope="col">Etiqueta</th><th scope="col">${valueHeader}</th></tr></thead><tbody>${rows}</tbody></table>`;
}

function renderBars(chart: Chart): string {
  const max = Math.max(...chart.data.map((point) => point.value), 0);
  return chart.data
    .map((point) => {
      const text = valueText(point);
      return `<div class="chart-row"><span class="chart-label">${escapeHtml(point.label)}</span><span class="chart-track"><span class="chart-bar" style="${barWidth(point.value, max)}"></span></span><span class="chart-value">${escapeHtml(text)}</span></div>`;
    })
    .join('');
}

function renderColumns(chart: Chart): string {
  const max = Math.max(...chart.data.map((point) => point.value), 0);
  const columns = chart.data
    .map((point) => {
      const text = valueText(point);
      const height = percent(point.value, max);
      const min = point.value > 0 ? ';min-height:2px' : '';
      return `<div class="chart-col"><span class="chart-col-value">${escapeHtml(text)}</span><span class="chart-col-track"><span class="chart-col-bar" style="height:${height}${min}"></span></span><span class="chart-col-label">${escapeHtml(point.label)}</span></div>`;
    })
    .join('');
  return `<div class="chart-columns">${columns}</div>`;
}

function round(value: number): string {
  return (Math.round(value * 10) / 10).toString();
}

function renderLine(chart: Chart): string {
  const width = 640;
  const height = 300;
  const padLeft = 52;
  const padRight = 16;
  const padTop = 18;
  const padBottom = 44;
  const innerWidth = width - padLeft - padRight;
  const innerHeight = height - padTop - padBottom;
  const max = Math.max(...chart.data.map((point) => point.value), 0);
  const count = chart.data.length;
  const xAt = (index: number) =>
    count === 1 ? padLeft + innerWidth / 2 : padLeft + (innerWidth * index) / (count - 1);
  const yAt = (value: number) => padTop + innerHeight - (max === 0 ? 0 : (value / max) * innerHeight);
  const points = chart.data.map((point, index) => ({ x: xAt(index), y: yAt(point.value), point }));
  const ticks = max === 0 ? [0] : [max, max / 2, 0];
  const grid = ticks
    .map((tick) => {
      const y = yAt(tick);
      return `<line x1="${padLeft}" y1="${round(y)}" x2="${width - padRight}" y2="${round(y)}" /><text x="${padLeft - 8}" y="${round(y + 4)}" text-anchor="end">${escapeHtml(formatNumber(tick))}</text>`;
    })
    .join('');
  const step = count > 8 ? Math.ceil(count / 8) : 1;
  const labels = points
    .map((point, index) => {
      if (index % step !== 0 && index !== count - 1) return '';
      return `<text x="${round(point.x)}" y="${height - 14}" text-anchor="middle">${escapeHtml(point.point.label)}</text>`;
    })
    .join('');
  const polyline = points.map((point) => `${round(point.x)},${round(point.y)}`).join(' ');
  const dots = points
    .map((point) => `<circle cx="${round(point.x)}" cy="${round(point.y)}" r="4.5" />`)
    .join('');
  return `<svg class="chart-line" viewBox="0 0 ${width} ${height}" aria-hidden="true"><g class="chart-axis">${grid}${labels}</g><g class="chart-series"><polyline fill="none" points="${polyline}" />${dots}</g></svg>`;
}

function renderVisual(chart: Chart): string {
  if (chart.type === 'columns') return renderColumns(chart);
  if (chart.type === 'line') return renderLine(chart);
  return renderBars(chart);
}

export function renderChart(chart: Chart, index: number): string {
  const titleId = `grafico-${index + 1}-titulo`;
  const source = chart.source.replace(/^fuente:\s*/i, '');
  const unit = chart.unit ? `<p class="chart-unit">Unidad: ${escapeHtml(chart.unit)}</p>` : '';
  return `<figure class="chart chart-${chart.type}"><figcaption class="chart-title" id="${titleId}">${escapeHtml(chart.title)}</figcaption>${unit}<div class="chart-visual" aria-hidden="true">${renderVisual(chart)}</div>${renderTable(chart)}<p class="chart-source">Fuente: ${escapeHtml(source)}</p></figure>`;
}

function takeChart(charts: Chart[], number: number, used: Set<number>, file: string): string {
  if (!Number.isInteger(number) || number < 1 || number > charts.length) {
    throw new Error(`${file}: el marcador <!--chart:${number}--> no corresponde a ningún gráfico. El primero es <!--chart:1-->.`);
  }
  const index = number - 1;
  if (used.has(index)) throw new Error(`${file}: el gráfico ${number} está colocado dos veces.`);
  used.add(index);
  return renderChart(charts[index]!, index);
}

/** Marker `<!--chart:N-->` wins over `after`. Anything left goes after a matching heading, or at the end. */
export function placeCharts(html: string, charts: Chart[], file = 'charts.json'): string {
  const used = new Set<number>();
  const replace = (_match: string, number: string) => takeChart(charts, Number(number), used, file);
  let output = html.replace(/<p>\s*EBCHARTTOKEN(\d+)END\s*<\/p>/g, replace);
  output = output.replace(/EBCHARTTOKEN(\d+)END/g, replace);

  const inserts: { at: number; order: number; html: string }[] = [];
  const tail: string[] = [];
  charts.forEach((chart, index) => {
    if (used.has(index)) return;
    if (chart.after) {
      const at = sectionEnd(output, chart.after);
      if (at != null) {
        inserts.push({ at, order: index, html: renderChart(chart, index) });
        return;
      }
    }
    tail.push(renderChart(chart, index));
  });

  inserts.sort((a, b) => a.at - b.at || a.order - b.order);
  let cursor = 0;
  let merged = '';
  for (const insert of inserts) {
    merged += output.slice(cursor, insert.at) + insert.html;
    cursor = insert.at;
  }
  merged += output.slice(cursor);
  if (tail.length) merged += `\n${tail.join('\n')}`;
  return merged;
}
