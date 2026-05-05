/**
 * Typo-tolerant substring match.
 *
 * Order of preference:
 *   1. Direct substring (exact, fast path).
 *   2. Token-prefix match: any whitespace-separated token in `text` that
 *      *starts with* `query` (catches "monki" → "monkey").
 *   3. One-character edit-distance match on a token (catches "cit" → "cat").
 *
 * Fuzzy matching only kicks in for queries of ≥ 3 characters to avoid false
 * positives on very short inputs.
 */
export function fuzzyMatch(text: string, q: string): { matched: boolean; index: number } {
  const tLower = text.toLowerCase();
  const qLower = q.toLowerCase();

  // 1. Direct substring (current behaviour).
  const directIdx = tLower.indexOf(qLower);
  if (directIdx >= 0) return { matched: true, index: directIdx };

  // 2 & 3. Token-based fuzzy matching (only for ≥ 3-char queries).
  if (qLower.length >= 3) {
    const tokens = tLower.split(/[\s.,;:!?()[\]{}'"]+/);
    let cursor = 0;
    for (const tok of tokens) {
      if (tok.length === 0) {
        cursor += 1;
        continue;
      }
      const start = tLower.indexOf(tok, cursor);
      cursor = start + tok.length;

      // 2. Prefix match.
      if (tok.startsWith(qLower)) return { matched: true, index: start };

      // 3. One-edit-distance match: compare the token's leading len(query)
      //    characters against the query. This catches "monki" → "monkey"
      //    because tok.slice(0,5) = "monke" has edit-distance 1 from "monki".
      if (
        tok.length >= qLower.length &&
        editDistance(tok.slice(0, qLower.length), qLower) <= 1
      ) {
        return { matched: true, index: start };
      }
    }
  }

  return { matched: false, index: -1 };
}

/**
 * Wagner-Fischer edit distance for two short strings.
 * Bails early with 2 if the length delta alone exceeds the threshold.
 */
export function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > 1) return 2; // bail early for our threshold
  const m = a.length;
  const n = b.length;
  const dp: number[] = new Array(n + 1).fill(0);
  for (let j = 0; j <= n; j++) dp[j] = j;
  for (let i = 1; i <= m; i++) {
    let prev = dp[0]!;
    dp[0] = i;
    for (let j = 1; j <= n; j++) {
      const tmp = dp[j]!;
      if (a[i - 1] === b[j - 1]) {
        dp[j] = prev;
      } else {
        dp[j] = 1 + Math.min(prev, dp[j - 1]!, dp[j]!);
      }
      prev = tmp;
    }
  }
  return dp[n]!;
}
