import { describe, expect, it } from 'vitest';
import { editionPath, formatDayLabel, formatLongDate, formatMonthLabel, groupByMonth, neighbors } from '../src/lib/dates';

describe('fechas', () => {
  it('etiqueta el 26 de noviembre de 2026 como jueves', () => {
    expect(formatDayLabel('2026-11-26')).toBe('jue 26 nov 2026');
    expect(formatMonthLabel('2026-11-26')).toBe('noviembre 2026');
    expect(formatLongDate('2026-11-26')).toBe('Jueves 26 de noviembre de 2026');
  });

  it('agrupa por mes sin reordenar', () => {
    const groups = groupByMonth([{ date: '2026-11-26' }, { date: '2026-11-02' }, { date: '2026-10-31' }]);
    expect(groups.map((group) => group.label)).toEqual(['noviembre 2026', 'octubre 2026']);
    expect(groups[0]?.items).toHaveLength(2);
  });

  it('calcula el día anterior y el siguiente con la lista de más nueva a más antigua', () => {
    expect(neighbors(['2026-11-27', '2026-11-26', '2026-11-25'], '2026-11-26')).toEqual({
      next: '2026-11-27',
      prev: '2026-11-25',
    });
    expect(neighbors(['2026-11-26'], '2026-11-26')).toEqual({ next: null, prev: null });
    expect(neighbors(['2026-11-27', '2026-11-26'], '2026-11-27')).toEqual({
      next: null,
      prev: '2026-11-26',
    });
  });

  it('arma la ruta bajo el base path', () => {
    expect(editionPath('2026-11-26', '/ecuador-brief/')).toBe('/ecuador-brief/2026-11-26/');
    expect(editionPath('2026-11-26', '/ecuador-brief')).toBe('/ecuador-brief/2026-11-26/');
  });
});
