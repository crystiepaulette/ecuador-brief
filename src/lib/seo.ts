export function clipText(value: string, max = 180): string {
  const clean = value.replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max - 1).replace(/\s+\S*$/, '').trim();
  return `${cut || clean.slice(0, max - 1).trim()}…`;
}

export function articleJsonLd(
  edition: { datelineText: string; date: string; subtitle: string },
  canonical: string,
): string {
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    headline: `The Ecuador Brief — ${edition.datelineText}`,
    datePublished: edition.date,
    inLanguage: 'es',
    description: edition.subtitle,
    mainEntityOfPage: canonical,
    publisher: {
      '@type': 'Organization',
      name: 'The Ecuador Brief',
    },
  }).replace(/</g, '\\u003c');
}
