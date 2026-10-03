// File editions are selected from signed Stripe metadata; legacy purchases default to Spanish.
export function productLanguage(value = 'es') {
  if (!['es', 'en'].includes(value)) throw new Error('invalid_product_language');
  return value;
}
const ENGLISH = Object.freeze({
  '5-habitos-dia-29': { name: 'The Day 29', fileId: '1rt38Os4YTE11Hn4GZmxqWv_tc4nrtqnI' },
  'romantizar-la-prep': { name: 'Romanticizing Prep', fileId: '1Bt8N0wOgF72DUey7qB32g5WQqCtwKWbj' },
  '5-claves': { name: '5 Keys Before Competing', fileId: '1R0csgbDOx88np_C2ieDWAy7ktFViUF-i' },
});
export function englishEdition(slug) {
  const edition = ENGLISH[slug === '5-claves-antes-de-competir' ? '5-claves' : slug];
  return edition ? { ...edition, slug, url: `https://drive.google.com/file/d/${edition.fileId}/view` } : null;
}
