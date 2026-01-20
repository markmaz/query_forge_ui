// lib/mock.ts
import type { SummaryStats } from '../model/types';

export const mockRows: any[] = [
  { id: '1', name: 'Jane Doe', mrn: 'A1001', age: 62, sex: 'F', lastSeen: '2025-06-09', whyIncluded: ['E11.* diabetes', '>=2 outpatient visits'] },
  { id: '2', name: 'John Smith', mrn: 'A1002', age: 58, sex: 'M', lastSeen: '2025-05-20', whyIncluded: ['E11.9', 'Metformin Rx'] },
];

export const mockStats: SummaryStats = {
  population: 124_532,
  estPatients: 2_318,
  filtersCount: 3,
  timeSpanLabel: 'Jan 2023 – Jun 2025',
};
