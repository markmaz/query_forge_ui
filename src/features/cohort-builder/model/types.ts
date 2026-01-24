import type { FilterT, FilterKind } from './filters';

export type LogicMode = 'all' | 'any';
export type ViewMode = 'single' | 'byKind';

export type Id = string;

export interface TimeWindow {
  from?: string; // ISO date
  to?: string;
}

// Reuse the same numeric-range structure we use inside filters
export interface NumericRange {
  lower_bound: number | null;
  upper_bound: number | null;
}

export interface DraftChipMeta {
  code?: string;

  // Drugs
  ndc_list?: string[];

  // Measurements
  unit_map?: Record<string, number>;
  lower_bound?: number | null;
  upper_bound?: number | null;

  // Demographics
  age?: NumericRange;
  dx_year?: NumericRange;
  gender?: string[];
  location?: string[];
}

export interface DraftChip {
  id: Id;
  label: string;
  kind?: FilterKind | string;   // allow raw string kinds from LLM
  code?: string;                // optional direct code from LLM
  meta?: DraftChipMeta;         // structured extras
}

export interface SummaryStats {
  population: number;
  estPatients: number;
  filtersCount: number;
  timeSpanLabel?: string;
}

export interface CohortBuilderState {
  prompt: string;
  draftChips: DraftChip[];
  filters: FilterT[];
  logic: LogicMode;
  loadingDraft: boolean;
  error?: string | null;
  loadingByKind: Partial<Record<FilterKind, boolean>>;
}
