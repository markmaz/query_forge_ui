// src/features/cohort-builder/model/cohortBuilderSlice.ts
import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type {
  CohortBuilderState,
  DraftChip,
  LogicMode,
  SummaryStats,
  PreviewColumn,
} from './types';
import { buildFiltersFromPrompt, runPreview } from './thunks';
import type { FilterT, FilterKind } from './filters';

const initialState: CohortBuilderState = {
  prompt: '',
  draftChips: [],
  filters: [],
  logic: 'all',
  stats: null,
  results: [],
  previewColumns: [],
  previewSql: null,
  previewParams: {},
  previewTotal: null,
  previewTotalRowCount: null,
  previewExport: null,
  loadingDraft: false,   // used as "AI/NER building filters"
  loadingPreview: false,
  error: null,
  loadingByKind: {},
};

const slice = createSlice({
  name: 'cohortBuilder',
  initialState,
  reducers: {
    setPrompt(state, action: PayloadAction<string>) {
      state.prompt = action.payload;
    },
    setDraftChips(state, action: PayloadAction<DraftChip[]>) {
      state.draftChips = action.payload;
    },
    addFilter(state, action: PayloadAction<FilterT>) {
      state.filters.push(action.payload);
    },
    addFilters(state, action: PayloadAction<FilterT[]>) {
      state.filters.push(...action.payload);
    },
    setFilters(state, action: PayloadAction<FilterT[]>) {
      state.filters = action.payload;
    },
    updateFilter(state, action: PayloadAction<FilterT>) {
      const idx = state.filters.findIndex(f => f.id === action.payload.id);
      if (idx !== -1) state.filters[idx] = action.payload;
    },
    removeFilter(state, action: PayloadAction<string>) {
      state.filters = state.filters.filter(f => f.id !== action.payload);
    },
    setLogic(state, action: PayloadAction<LogicMode>) {
      state.logic = action.payload;
    },
    setStats(state, action: PayloadAction<SummaryStats | null>) {
      state.stats = action.payload;
    },
    setResults(state, action: PayloadAction<any[]>) {
      state.results = action.payload;
    },
    setPreviewColumns(state, action: PayloadAction<PreviewColumn[]>) {
      state.previewColumns = action.payload;
    },
    setPreviewSql(state, action: PayloadAction<string | null>) {
      state.previewSql = action.payload;
    },
    setPreviewParams(state, action: PayloadAction<Record<string, any> | any[]>) {
      state.previewParams = action.payload;
    },
    setPreviewTotal(state, action: PayloadAction<number | null>) {
      state.previewTotal = action.payload;
    },
    clear(state) {
      state.draftChips = [];
      state.filters = [];
      state.results = [];
      state.previewColumns = [];
      state.previewSql = null;
      state.previewParams = {};
      state.previewTotal = null;
      state.previewTotalRowCount = null;
      state.previewExport = null;
      state.stats = null;
      state.error = null;
    },
    setKindLoading(state, action: PayloadAction<{ kind: FilterKind; loading: boolean }>) {
      const { kind, loading } = action.payload;
      state.loadingByKind[kind] = loading;
    }

  },
  extraReducers: builder => {
    // ---------- NER + filters build pipeline ----------
    builder
      .addCase(buildFiltersFromPrompt.pending, state => {
        state.loadingDraft = true;
        state.error = null;
        // optional: wipe out existing filters before rebuilding
        state.filters = [];
      })
      .addCase(buildFiltersFromPrompt.fulfilled, state => {
        state.loadingDraft = false;
        // Filters already added incrementally by thunk
      })
      .addCase(buildFiltersFromPrompt.rejected, (state, { payload, error }) => {
        state.loadingDraft = false;
        state.error =
          (typeof payload === 'string' && payload) ||
          error.message ||
          'Failed to build filters from prompt';
      });

    // ---------- Preview ----------
    builder
      .addCase(runPreview.pending, state => {
        state.loadingPreview = true;
        state.error = null;
      })
      .addCase(runPreview.fulfilled, (state, { payload }) => {
        state.loadingPreview = false;
        state.results = payload.rows;
        state.previewColumns = payload.columns;
        state.previewSql = payload.sql ?? null;
        state.previewParams = payload.params ?? {};
        state.previewTotal = payload.total ?? null;
        state.previewTotalRowCount = payload.totalRowCount ?? payload.total ?? null;
        state.previewExport = payload.export ?? null;
        state.stats = null;
      })
      .addCase(runPreview.rejected, (state, { error }) => {
        state.loadingPreview = false;
        state.error = error.message || 'Failed to run preview';
      });
  },
});

export const {
  setPrompt,
  setDraftChips,
  addFilter,
  addFilters,
  setFilters,
  updateFilter,
  removeFilter,
  setLogic,
  setStats,
  setResults,
  setPreviewColumns,
  setPreviewSql,
  setPreviewParams,
  setPreviewTotal,
  clear,
  setKindLoading,
} = slice.actions;

export default slice.reducer;
