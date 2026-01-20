import type { FilterT } from './filters';

export function summarizeFilter(filter: FilterT): string {
  switch (filter.kind) {
    case 'condition': {
      const name = filter.name || filter.code;
      return `Condition: ${name}`;
    }

    case 'procedure': {
      const name = filter.name || filter.code;
      return `Procedure: ${name}`;
    }

    case 'drug': {
      const name = filter.name || 'Drug';

      const codes = String(filter.code ?? '')
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);

      const count = codes.length;

      if (!count) return `Drug: ${name}`;
      if (count === 1) return `Drug: ${name} (1 NDC)`;
      return `Drug: ${name} (${count} NDCs)`;
    }


    case 'measurement': {
      const name = filter.name || 'Measurement';
      const lb = filter.value?.lower_bound ?? null;
      const ub = filter.value?.upper_bound ?? null;
      const base = `Measurement: ${name}`;
      if (lb != null && ub != null) return `${base} [${lb} – ${ub}]`;
      if (lb != null) return `${base} ≥ ${lb}`;
      if (ub != null) return `${base} ≤ ${ub}`;
      return base;
    }

    case 'demographics': {
      const parts: string[] = [];

      if (filter.age?.lower_bound != null || filter.age?.upper_bound != null) {
        const aFrom = filter.age.lower_bound ?? '';
        const aTo = filter.age.upper_bound ?? '';
        parts.push(`Age ${aFrom || '…'}–${aTo || '…'}`);
      }

      if (filter.dx_year?.lower_bound != null || filter.dx_year?.upper_bound != null) {
        const yFrom = filter.dx_year.lower_bound ?? '';
        const yTo = filter.dx_year.upper_bound ?? '';
        parts.push(`Dx year ${yFrom || '…'}–${yTo || '…'}`);
      }

      if (filter.gender && filter.gender.length) {
        parts.push(`Gender: ${filter.gender.join('/')}`);
      }

      if (filter.location && filter.location.length) {
        const count = filter.location.length;
        parts.push(`${count} state${count > 1 ? 's' : ''}`);
      }

      const label = parts.join(' · ');
      return label ? `Demographics: ${label}` : 'Demographics';
    }

    default:
      return filter.title ?? 'Filter';
  }
}
