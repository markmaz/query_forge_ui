// lib/ai.ts
import type { DraftChip } from '../model/types';
import { nanoid } from '@reduxjs/toolkit';

export async function generateDraftChips(prompt: string): Promise<DraftChip[]> {
  // mock AI: split by commas/and
  const parts = prompt.split(/,| and /i).map(s => s.trim()).filter(Boolean);
  return parts.map(p => ({ id: nanoid(), label: p }));
}
