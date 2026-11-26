import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { renderEdition } from '../src/lib/markdown';

const edition = readFileSync('editions/2026-11-26.md', 'utf8');
const charts = JSON.parse(readFileSync('editions/2026-11-26.charts.json', 'utf8'));

describe('edición del 26 de noviembre de 2026', () => {
  const rendered = renderEdition(edition, charts, 'editions/2026-11-26.charts.json');

  it('usa el párrafo de cierre como cabecera y no repite el masthead', () => {
    expect(rendered.headerLines).toHaveLength(6);
    expect(rendered.datelineText).toBe('Jueves 26 de noviembre de 2026');
    expect(rendered.headerLines[1]).toContain('Cierre:');
    expect(rendered.headerLines[2]).toContain('Última actualización:');
    expect(rendered.headerLines[3]).toContain('Ventana principal:');
    expect(rendered.headerLines[4]).toContain('Última edición publicada:');
    expect(rendered.headerLines[5]).toContain('Lectura estimada:');
    expect(rendered.headerLines.join('')).not.toContain('<p>');
    expect(rendered.html).not.toContain('THE ECUADOR BRIEF');
    expect(rendered.html).not.toContain('más allá de los titulares');
    expect(rendered.html).not.toContain('Información · Contexto · Conocimiento');
  });

  it('conserva las tres claves y los saltos de la ficha', () => {
    expect(rendered.claves).toHaveLength(3);
    expect(rendered.subtitle).toBe('El Niño desborda 25 ríos y quebradas en la Costa; Babahoyo queda aislado');
    expect(rendered.html).toMatch(/<ol class="claves"/);
    expect(rendered.html.match(/<ol class="claves"[\s\S]*?<\/ol>/)?.[0].match(/<li>/g)).toHaveLength(3);
    const autores = rendered.html.indexOf('Sebastian Sterl');
    const anio = rendered.html.indexOf('Año y versión');
    expect(autores).toBeGreaterThan(-1);
    expect(rendered.html.slice(autores, anio)).toMatch(/<br\s*\/?>/);
    const doi = rendered.html.indexOf('10.1038/s44221-026-00617-w');
    const publicacion = rendered.html.indexOf('Publicación original');
    expect(rendered.html.slice(doi, publicacion)).toMatch(/<br\s*\/?>/);
    expect(rendered.html).toContain('<em>Nature Water</em>');
    expect(rendered.html).toContain('Traducción orientativa');
  });

  it('abre los enlaces en una pestaña nueva y conserva las secciones', () => {
    const links = [...rendered.html.matchAll(/<a\b[^>]*>/g)].map((match) => match[0]);
    expect(links.length).toBeGreaterThan(10);
    for (const link of links) {
      expect(link).toContain('target="_blank"');
      expect(link).toContain('rel="noopener noreferrer"');
    }
    expect(rendered.html).toContain('se abre en una pestaña nueva');
    expect(rendered.html).toContain(
      'https://www.primicias.ec/sociedad/fenomeno-nino-ecuador-inundaciones-babahoyo-mochache-losrios-bucay-guayas-lluvias-138004/',
    );
    for (const phrase of [
      'CNEL amplía',
      'John Reimberg',
      '383',
      'Variable renewables',
      'Voto anticipado',
      'Conteo rápido',
      'primera edición elaborada con este protocolo',
      'Mazar',
    ]) {
      expect(rendered.html).toContain(phrase);
    }
  });

  it('inserta el gráfico de desbordamientos después de la nota de inundaciones', () => {
    const chart = rendered.html.indexOf('Desbordamientos reportados por provincia');
    const heading = rendered.html.indexOf('Desbordamientos en cuatro provincias');
    const lastSource = rendered.html.indexOf('babahoyo-se-declara-en-emergencia');
    const energia = rendered.html.indexOf('>Energía<');
    expect(heading).toBeGreaterThan(-1);
    expect(heading).toBeLessThan(chart);
    expect(lastSource).toBeLessThan(chart);
    expect(chart).toBeLessThan(energia);
    expect(rendered.html).toContain('width:100%');
    expect(rendered.html).toContain('width:37.5%');
    expect(rendered.html).toContain('width:12.5%');
    expect(rendered.html).toContain('width:6.25%');
    const figure = rendered.html.slice(rendered.html.indexOf('<figure'), rendered.html.indexOf('</figure>') + 8);
    expect(figure.indexOf('Los Ríos')).toBeLessThan(figure.indexOf('Guayas'));
    expect(figure.indexOf('Guayas')).toBeLessThan(figure.indexOf('Esmeraldas'));
    expect(figure.indexOf('Esmeraldas')).toBeLessThan(figure.indexOf('Manabí'));
    expect(rendered.html).toContain('Secretaría de Gestión de Riesgos vía Primicias, corte 19:00 del 25 nov 2026 (UTC−5)');
    expect(rendered.html).not.toContain('EBCHARTTOKEN');
  });
});

describe('markdown', () => {
  it('dibuja negrita, cursiva, código, cita, regla, tabla, URL suelta y saltos de línea', () => {
    const { html, headerLines } = renderEdition(`Viernes 27 de noviembre de 2026

## Sección de prueba

Un párrafo con **negrita**, *cursiva* y \`code\`.
Visita https://example.com/ruta ahora.

> Una cita

---

| Col | Val |
| --- | --- |
| A | 1 |

01. Primero
02. Segundo

Línea uno
Línea dos
`);
    expect(headerLines[0]).toContain('Viernes 27 de noviembre de 2026');
    expect(html).toContain('<strong>negrita</strong>');
    expect(html).toContain('<em>cursiva</em>');
    expect(html).toContain('<code>code</code>');
    expect(html).toContain('href="https://example.com/ruta"');
    expect(html).toContain('<blockquote>');
    expect(html).toMatch(/<hr\s*\/?>/);
    expect(html).toContain('<table>');
    expect(html).toContain('<td>A</td>');
    expect(html).toMatch(/<ol[\s\S]*<li>Primero<\/li>[\s\S]*<li>Segundo<\/li>/);
    expect(html).toMatch(/Línea uno<br\s*\/?>\s*Línea dos/);
  });

  it('marca la lista de claves aunque el título no diga tres', () => {
    const { html } = renderEdition(`Fecha

## Las dos claves del día

01. **Una.** Texto.
02. **Dos.** Texto.
`);
    expect(html).toContain('<ol class="claves">');
  });

  it('prioriza el marcador, respeta after y manda el resto al final', () => {
    const marked = renderEdition(
      `Fecha

## Uno

Texto uno.

<!--chart:1-->

## Dos

Texto dos.
`,
      [
        {
          type: 'bars',
          title: 'Grafico unico',
          source: 'Fuente',
          after: 'Dos',
          data: [{ label: 'A', value: 1 }],
        },
      ],
    );
    const at = marked.html.indexOf('Grafico unico');
    expect(marked.html.indexOf('Grafico unico', at + 1)).toBe(-1);
    expect(marked.html.indexOf('Texto uno.')).toBeLessThan(at);
    expect(at).toBeLessThan(marked.html.indexOf('>Dos<'));

    const after = renderEdition(
      `Fecha

## Clima

### Desbordamientos en cuatro provincias costeras

Agua en la calle.

## Energia

Otra.
`,
      [{ type: 'columns', title: 'Lluvia', source: 'INAMHI', after: 'Desbordamientos en cuatro', data: [{ label: 'Costa', value: 4 }] }],
    );
    const rain = after.html.indexOf('Lluvia');
    expect(after.html.indexOf('Agua en la calle.')).toBeLessThan(rain);
    expect(rain).toBeLessThan(after.html.indexOf('>Energia<'));
    expect(after.html).toContain('chart-columns');

    const tail = renderEdition(
      `Fecha

## Alfa

Texto.
`,
      [{ type: 'line', title: 'Cota', source: 'CELEC', unit: 'msnm', data: [{ label: 'Lun', value: 2 }, { label: 'Mar', value: 3, display: 'tres' }] }],
    );
    expect(tail.html.indexOf('Texto.')).toBeLessThan(tail.html.indexOf('Cota'));
    expect(tail.html).toContain('<svg');
    expect(tail.html).toContain('tres');
    expect(tail.html).toContain('Unidad: msnm');
  });

  it('rechaza gráficos mal formados', () => {
    expect(() => renderEdition('Fecha\n\n## A\n\nTexto.\n', { type: 'bars' })).toThrow(/lista de gráficos/);
    expect(() =>
      renderEdition('Fecha\n\n## A\n\nTexto.\n', [{ type: 'pie', title: 'T', source: 'S', data: [{ label: 'A', value: 1 }] }]),
    ).toThrow(/tipo inválido/);
    expect(() =>
      renderEdition('Fecha\n\n## A\n\nTexto.\n', [{ type: 'bars', title: 'T', source: 'S', data: [{ label: 'A', value: -1 }] }]),
    ).toThrow(/negativ/);
    expect(() => renderEdition('Fecha\n\n## A\n\n<!--chart:2-->\n', [{ type: 'bars', title: 'T', source: 'S', data: [{ label: 'A', value: 1 }] }])).toThrow(
      /chart:2/,
    );
  });
});
