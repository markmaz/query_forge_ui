// lib/query.ts
import type { SummaryStats } from '../model/types';
import { mockRows, mockStats } from './mock';
import { FilterT } from '../model/filters';
export type PreviewRows = typeof mockRows;
export type PreviewStats = SummaryStats;

export async function preview(
  _filters: FilterT[],
  _logic: 'all' | 'any'
): Promise<{ rows: PreviewRows; stats: PreviewStats }> {
  // replace with real API call
  await new Promise(r => setTimeout(r, 300));
  return { rows: mockRows, stats: mockStats };
}
