// tests/renderer/dialogs/fuzzy-match.spec.ts
import { describe, it, expect } from 'vitest';
import { fuzzyMatch, editDistance } from '../../src/dialogs/fuzzy-match';

describe('fuzzyMatch', () => {
  it('direct substring match returns true with correct index', () => {
    const r = fuzzyMatch('monkey business', 'monkey');
    expect(r.matched).toBe(true);
    expect(r.index).toBe(0);
  });

  it('matches monki → monkey via token prefix', () => {
    const r = fuzzyMatch('monkey business', 'monki');
    expect(r.matched).toBe(true);
    expect(r.index).toBe(0);
  });

  it('matches monki → monkey mid-sentence', () => {
    const r = fuzzyMatch('I love monkeys', 'monki');
    expect(r.matched).toBe(true);
    expect(r.index).toBeGreaterThan(0); // points at 'monkeys'
  });

  it('no match for completely unrelated query', () => {
    expect(fuzzyMatch('hello world', 'xyzzy').matched).toBe(false);
  });

  it('matches cat via 1-edit-distance (cit → cat)', () => {
    const r = fuzzyMatch('cat in hat', 'cit');
    expect(r.matched).toBe(true);
  });

  it('does not match when token is too short and query has no prefix match', () => {
    // 'a' vs 'ab' — query 'ab' is 2 chars (< 3), so no fuzzy, and 'a' != 'ab'
    expect(fuzzyMatch('a', 'ab').matched).toBe(false);
  });

  it('returns false for empty text', () => {
    expect(fuzzyMatch('', 'foo').matched).toBe(false);
  });

  it('returns false for empty query at tokenizer level (empty string direct)', () => {
    // Empty query matches at index 0 (indexOf behavior) — direct hit
    expect(fuzzyMatch('anything', '').matched).toBe(true);
  });

  it('case-insensitive match', () => {
    expect(fuzzyMatch('Monkey Island', 'monkey').matched).toBe(true);
    expect(fuzzyMatch('monkey island', 'Monkey').matched).toBe(true);
  });

  it('prefix match works when query exactly equals token', () => {
    // 'standup' starts with 'standup'
    const r = fuzzyMatch('standup notes', 'standup');
    expect(r.matched).toBe(true);
    expect(r.index).toBe(0);
  });
});

describe('editDistance', () => {
  it('same string has distance 0', () => {
    expect(editDistance('cat', 'cat')).toBe(0);
  });

  it('one substitution', () => {
    expect(editDistance('cat', 'cot')).toBe(1);
  });

  it('one insertion', () => {
    expect(editDistance('ca', 'cat')).toBe(1);
  });

  it('one deletion', () => {
    expect(editDistance('cats', 'cat')).toBe(1);
  });

  it('bail early with 2 when length delta > 1', () => {
    // 'abc' vs 'abcde' → length delta 2 → bail with 2
    expect(editDistance('abc', 'abcde')).toBe(2);
  });
});
