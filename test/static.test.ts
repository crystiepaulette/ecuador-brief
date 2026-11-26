import { existsSync, readFileSync } from 'node:fs';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';

function pngSize(buffer: Buffer): { width: number; height: number } {
  expect(buffer.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

function channel(hex: string): number[] {
  const value = Number.parseInt(hex.slice(1), 16);
  const red = value >> 16;
  const green = (value >> 8) & 255;
  const blue = value & 255;
  const linear = (channelValue: number) => {
    const c = channelValue / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const luminance = 0.2126 * linear(red) + 0.7152 * linear(green) + 0.0722 * linear(blue);
  return [red, green, blue, luminance];
}

function contrast(a: string, b: string): number {
  const [, , , left] = channel(a);
  const [, , , right] = channel(b);
  const [hi, lo] = left > right ? [left, right] : [right, left];
  return (hi + 0.05) / (lo + 0.05);
}

describe('archivos estáticos', () => {
  it('no publica el protocolo editorial', () => {
    expect(existsSync('protocolo.md')).toBe(false);
  });

  it('describe la PWA y el despliegue', () => {
    const manifest = JSON.parse(readFileSync('public/manifest.webmanifest', 'utf8'));
    expect(manifest.name).toBe('The Ecuador Brief');
    expect(manifest.short_name).toBe('Ecuador Brief');
    expect(manifest.display).toBe('standalone');
    expect(manifest.start_url).toBe('/ecuador-brief/');
    expect(manifest.scope).toBe('/ecuador-brief/');
    expect(manifest.background_color).toBe('#ffffff');
    expect(manifest.theme_color).toBe('#141414');
    for (const icon of manifest.icons) {
      expect(icon.src.startsWith('/ecuador-brief/')).toBe(true);
      expect(existsSync(icon.src.replace('/ecuador-brief/', 'public/'))).toBe(true);
    }
    const worker = readFileSync('public/sw.js', 'utf8');
    expect(worker).toContain('/ecuador-brief');
    expect(worker).toContain('networkFirstResponse');
    expect(worker).toMatch(/Network-first/);
    const workflow = readFileSync('.github/workflows/pages.yml', 'utf8');
    expect(workflow).toContain('actions/configure-pages@v5');
    expect(workflow).toContain('actions/upload-pages-artifact@v3');
    expect(workflow).toContain('actions/deploy-pages@v4');
  });

  it('genera iconos en los tamaños pedidos, con acento rojo y fondo opaco', async () => {
    const expected = {
      'public/icons/apple-touch-icon.png': 180,
      'public/icons/icon-192.png': 192,
      'public/icons/icon-512.png': 512,
      'public/icons/icon-maskable-512.png': 512,
      'public/favicon-32.png': 32,
    };
    for (const [file, size] of Object.entries(expected)) {
      const actual = pngSize(readFileSync(file));
      expect(actual).toEqual({ width: size, height: size });
    }
    expect(readFileSync('public/favicon.svg', 'utf8')).toContain('#C8102E');
    expect(readFileSync('design/icon.svg', 'utf8')).toContain('#C8102E');
    for (const file of ['public/icons/icon-512.png', 'public/icons/icon-maskable-512.png']) {
      const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      const pixel = (x: number, y: number) => {
        const index = (y * info.width + x) * info.channels;
        return [data[index], data[index + 1], data[index + 2], data[index + 3]];
      };
      const near = (got: number[] | undefined, rgb: number[], tolerance = 12) =>
        Boolean(got && got.slice(0, 3).every((value, index) => Math.abs(value - rgb[index]!) <= tolerance) && (got[3] ?? 0) > 250);
      for (const corner of [pixel(0, 0), pixel(info.width - 1, 0), pixel(0, info.height - 1), pixel(info.width - 1, info.height - 1)]) {
        expect(near(corner, [17, 17, 17])).toBe(true);
      }
      expect(near(pixel(Math.floor(info.width / 2), Math.floor(info.height / 2)), [200, 16, 46])).toBe(true);
    }
  });

  it('mantiene el acento rojo con contraste suficiente', () => {
    const css = readFileSync('src/styles/global.css', 'utf8');
    expect(css).toContain('#C8102E');
    expect(css).toContain('#FF7A88');
    expect(contrast('#C8102E', '#ffffff')).toBeGreaterThan(4.5);
    expect(contrast('#FF7A88', '#141414')).toBeGreaterThan(7);
    expect(contrast('#141414', '#ffffff')).toBeGreaterThan(7);
    expect(contrast('#f3f1ec', '#141414')).toBeGreaterThan(7);
    expect(contrast('#3a3a3a', '#ffffff')).toBeGreaterThan(7);
    expect(contrast('#d2d0cb', '#141414')).toBeGreaterThan(7);
  });
});
