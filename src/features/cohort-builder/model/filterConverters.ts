import { nanoid } from '@reduxjs/toolkit';
import type {
  ConditionMap,
  DemographicsData,
  MeasurementMap,
  DrugMap,
  ProcedureMap,
} from '../../../entities/Cohort';

import type { FilterT } from './filters';

type NegationFlag = 'None' | 'Exclude';

// Helper to turn arbitrary strings into our strict negation union
const normalizeNegation = (val: string | undefined | null): NegationFlag | undefined => {
  if (!val) return undefined;
  if (val === 'None') return 'None';
  if (val === 'Exclude') return 'Exclude';
  // Fallback: if backend sends something unexpected, treat as no negation
  return undefined;
};

export function convertConditionsToFilters(map: ConditionMap): FilterT[] {
  return Object.values(map).map(entry => ({
    id: nanoid(),
    kind: 'condition',
    title: entry.name,
    code: entry.code,
    name: entry.name,
    logic: entry.logic,
    negation: normalizeNegation(entry.negation),
  }));
}

export function convertDemographicsToFilters(map: DemographicsData): FilterT[] {
  const filters: FilterT[] = [];

  if (map.age) {
    filters.push({
      id: nanoid(),
      kind: 'demographics',
      title: 'Age',
      age: map.age,
    });
  }

  if (map.dx_year) {
    filters.push({
      id: nanoid(),
      kind: 'demographics',
      title: 'Diagnosis Year',
      dx_year: map.dx_year,
    });
  }

  if (map.gender?.length) {
    filters.push({
      id: nanoid(),
      kind: 'demographics',
      title: 'Gender',
      gender: map.gender,
    });
  }

  if (map.location?.length) {
    filters.push({
      id: nanoid(),
      kind: 'demographics',
      title: 'Location',
      location: map.location,
    });
  }

  return filters;
}

export function convertMeasurementsToFilters(map: MeasurementMap): FilterT[] {
  return Object.values(map).map(entry => ({
    id: nanoid(),
    kind: 'measurement',
    title: entry.name,
    code: entry.code,
    name: entry.name,
    unit: entry.unit,
    value: entry.value,
    logic: entry.logic,
  }));
}

export function convertDrugsToFilters(map: DrugMap): FilterT[] {
  return Object.values(map).map(entry => ({
    id: nanoid(),
    kind: 'drug',
    title: entry.name,
    code: entry.code,
    name: entry.name,
    logic: entry.logic,
    negation: normalizeNegation(entry.negation),
  }));
}

export function convertProceduresToFilters(map: ProcedureMap): FilterT[] {
  return Object.values(map).map(entry => ({
    id: nanoid(),
    kind: 'procedure',
    title: entry.name,
    code: entry.code,
    name: entry.name,
    logic: entry.logic,
    negation: normalizeNegation(entry.negation),
  }));
}
