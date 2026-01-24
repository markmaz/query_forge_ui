// src/features/cohort-builder/model/cohortBuilderSlice.ts
import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type {
  CohortBuilderState,
  DraftChip,
  LogicMode,
} from './types';
import { buildFiltersFromPrompt } from './thunks';
import type { FilterT, FilterKind } from './filters';

const initialState: CohortBuilderState = {
  prompt: '',
  draftChips: [],
  filters: [],
  logic: 'all',
  loadingDraft: false,   // used as "AI/NER building filters"
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
    clear(state) {
      state.draftChips = [];
      state.filters = [];
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
  clear,
  setKindLoading,
} = slice.actions;

export default slice.reducer;
