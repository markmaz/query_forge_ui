export type FilterKind =
  | 'condition'
  | 'procedure'
  | 'drug'
  | 'measurement'
  | 'demographics';

export interface RangeNumber {
  lower_bound: number | null;
  upper_bound: number | null;
}

export interface FilterT {
  id: string;
  kind: FilterKind;
  title: string;

  // Shared-ish clinical bits
  code?: string | number;
  name?: string;
  logic?: 'AND' | 'OR';
  negation?: 'None' | 'Exclude';

  // Measurement-specific
  unit?: Record<string, number>;
  value?: RangeNumber;

  // Demographics-specific
  age?: RangeNumber;
  dx_year?: RangeNumber;
  gender?: string[];
  location?: string[];
}
