/** Split long documents into overlapping chunks for retrieval. */
export function chunkDocumentText(
  text: string,
  options?: { size?: number; overlap?: number }
): string[] {
  const size = options?.size ?? 1200;
  const overlap = options?.overlap ?? 150;
  const cleaned = text.replace(/\r\n/g, "\n").trim();
  if (!cleaned) return [];
  if (cleaned.length <= size) return [cleaned];

  const chunks: string[] = [];
  let i = 0;
  while (i < cleaned.length) {
    const end = Math.min(cleaned.length, i + size);
    let slice = cleaned.slice(i, end);
    // Prefer breaking on paragraph/sentence
    if (end < cleaned.length) {
      const breakAt = Math.max(
        slice.lastIndexOf("\n\n"),
        slice.lastIndexOf(". "),
        slice.lastIndexOf("\n")
      );
      if (breakAt > size * 0.4) {
        slice = slice.slice(0, breakAt + 1);
      }
    }
    const trimmed = slice.trim();
    if (trimmed) chunks.push(trimmed);
    if (end >= cleaned.length) break;
    i += Math.max(1, trimmed.length - overlap);
  }
  return chunks;
}

const STOP = new Set([
  "a",
  "al",
  "de",
  "del",
  "la",
  "las",
  "el",
  "los",
  "un",
  "una",
  "y",
  "o",
  "en",
  "que",
  "por",
  "con",
  "para",
  "the",
  "and",
  "or",
  "to",
  "of",
  "in",
  "on",
  "for",
  "is",
  "are",
  "this",
  "that",
  "with",
  "como",
  "cuando",
  "sobre",
]);

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .split(/[^a-z0-9áéíóúñü]+/i)
    .map((t) => t.trim())
    .filter((t) => t.length >= 3 && !STOP.has(t));
}

/** Score how well chunk matches query tokens (simple overlap + density). */
export function scoreChunk(query: string, chunk: string): number {
  const qTokens = [...new Set(tokenize(query))];
  if (!qTokens.length) return 0;
  const lower = chunk.toLowerCase();
  let hits = 0;
  for (const t of qTokens) {
    if (lower.includes(t)) hits += 1;
  }
  return hits / qTokens.length + Math.min(0.2, hits * 0.02);
}
