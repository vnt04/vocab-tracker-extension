// ============================================================================
// src/storage/types.ts  — copy VERBATIM into the file. Do NOT add fields.
// ============================================================================
export interface VocabularyItem {
  id: string;     // crypto.randomUUID(), generated only on the create path
  text: string;   // original trimmed text, internal whitespace collapsed, CASING PRESERVED
  count: number;  // starts at 1, +1 on each duplicate encounter
  notes: string;  // always '' on create; never mutated by saveOrIncrement
}

// Discriminated result so callers never receive a silent throw.
export type SaveResult =
  | { status: 'created'; item: VocabularyItem }
  | { status: 'incremented'; item: VocabularyItem }
  | { status: 'invalid'; reason: 'empty' | 'too_long' }
  | { status: 'error'; message: string };
