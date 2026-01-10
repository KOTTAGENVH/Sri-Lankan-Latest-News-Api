export const cleanText = (text = '') =>
  text
    .replace(/\u00a0/g, ' ')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, ' ')
    .replace(/^\|\s*/, '')
    .trim();
