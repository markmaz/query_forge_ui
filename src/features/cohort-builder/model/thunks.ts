import { createAsyncThunk } from '@reduxjs/toolkit';
import {
  parsePrompt,
  getConditions,
  getDemographics,
  getMeasurements,
  getDrugs,
  getProcedures,
  buildCohortVectorSqlJson,
} from '../../../shared/api/ai';
import type { SqlQueryJson } from '../../no-code-sql/model/sqlJson';
import type {
  CohortExtractionEntity,
  CohortExtractionResult,
} from '../../../entities/Cohort';

import { addFilters, setKindLoading } from './cohortBuilderSlice';


import { fetchWorkspaceInfo } from '../../../shared/api/workspace';
import { fetchUserInfo } from '../../../shared/api/users';
import { jwtDecode } from 'jwt-decode';
import { getAccessToken } from '../../../shared/lib/accessTokenStore';
import { toExtractionResult } from './extractConverter';

import {
  convertConditionsToFilters,
  convertDemographicsToFilters,
  convertMeasurementsToFilters,
  convertDrugsToFilters,
  convertProceduresToFilters,
} from './filterConverters';

/**
 * Main pipeline (incremental + per-kind loading):
 * 1. Send prompt to NER service.
 * 2. Build CohortExtractionResult (add base_url).
 * 3. For each filter family (conditions, demographics, etc.):
 *    - mark loadingByKind[kind] = true
 *    - call its API
 *    - convert to FilterT[]
 *    - dispatch(addFilters(...)) immediately
 *    - finally mark loadingByKind[kind] = false
 * 4. Thunk resolves once all families have settled.
 */
export const buildFiltersFromPrompt = createAsyncThunk<
  SqlQueryJson | null,
  string,
  { rejectValue: string }
>(
  'cohortBuilder/buildFiltersFromPrompt',
  async (prompt: string, { dispatch, rejectWithValue }) => {
    try {
      // 1) NER / extraction
      const nerEntity: CohortExtractionEntity = await parsePrompt(prompt);

      const token = getAccessToken() || '';
      if (!token) {
        // You can plug in your real auth/redirect behavior here
        return rejectWithValue('Missing auth token');
      }

      const decoded: any = jwtDecode(token);
      const userInfo = await fetchUserInfo(decoded.sub);
      const workspace = await fetchWorkspaceInfo(userInfo.user_id);

      // 2) Build full payload with base_url
      const nerResults: CohortExtractionResult = toExtractionResult(
        nerEntity,
        workspace?.server || '',
        workspace?.workspace_id || ''
      );

      console.info("Prompt response:", JSON.stringify(nerEntity, null, 2));
      // 3) Per-family jobs with per-kind loading flags
      const jobs: Promise<void>[] = [];
      let conditionsPayload: any = null;
      let demographicsPayload: any = null;
      let proceduresPayload: any = null;
      let drugsPayload: any = null;

      // ---- Conditions ----
      jobs.push(
        (async () => {
          dispatch(setKindLoading({ kind: 'condition', loading: true }));
          try {
            const condMap = await getConditions(nerResults);
            console.info("Conditions response:", JSON.stringify(condMap, null, 2));
            conditionsPayload = condMap;
            const filters = convertConditionsToFilters(condMap);
            if (filters.length) dispatch(addFilters(filters));
          } catch (e) {
            console.error('getConditions failed', e);
          } finally {
            dispatch(setKindLoading({ kind: 'condition', loading: false }));
          }
        })()
      );

      // ---- Demographics ----
      jobs.push(
        (async () => {
          dispatch(setKindLoading({ kind: 'demographics', loading: true }));
          try {
            const demoMap = await getDemographics(nerResults);        
            console.info("Demographocs response:", JSON.stringify(demoMap, null, 2));
            demographicsPayload = demoMap;
            const filters = convertDemographicsToFilters(demoMap);
            if (filters.length) dispatch(addFilters(filters));
          } catch (e) {
            console.error('getDemographics failed', e);
          } finally {
            dispatch(setKindLoading({ kind: 'demographics', loading: false }));
          }
        })()
      );

      // ---- Measurements ----
      jobs.push(
        (async () => {
          dispatch(setKindLoading({ kind: 'measurement', loading: true }));
          try {
            const measMap = await getMeasurements(nerResults);
            console.info("Measurements response:", JSON.stringify(measMap, null, 2));
            const filters = convertMeasurementsToFilters(measMap);
            if (filters.length) dispatch(addFilters(filters));
          } catch (e) {
            console.error('getMeasurements failed', e);
          } finally {
            dispatch(setKindLoading({ kind: 'measurement', loading: false }));
          }
        })()
      );

      // ---- Drugs ----
      jobs.push(
        (async () => {
          dispatch(setKindLoading({ kind: 'drug', loading: true }));
          try {
            const drugMap = await getDrugs(nerResults);
            console.info("Drugs response:", JSON.stringify(drugMap, null, 2));
            drugsPayload = drugMap;
            const filters = convertDrugsToFilters(drugMap);
            if (filters.length) dispatch(addFilters(filters));
          } catch (e) {
            console.error('getDrugs failed', e);
          } finally {
            dispatch(setKindLoading({ kind: 'drug', loading: false }));
          }
        })()
      );

      // ---- Procedures ----
      jobs.push(
        (async () => {
          dispatch(setKindLoading({ kind: 'procedure', loading: true }));
          try {
            const procMap = await getProcedures(nerResults);
            console.info("Procedures response:", JSON.stringify(procMap, null, 2));
            proceduresPayload = procMap;
            const filters = convertProceduresToFilters(procMap);
            if (filters.length) dispatch(addFilters(filters));
          } catch (e) {
            console.error('getProcedures failed', e);
          } finally {
            dispatch(setKindLoading({ kind: 'procedure', loading: false }));
          }
        })()
      );

      // 4) Wait for all families to finish (even if some fail)
      await Promise.allSettled(jobs);

      try {
        const sqlJson = await buildCohortVectorSqlJson({
          demographics: demographicsPayload ?? {},
          conditions: conditionsPayload ?? {},
          procedures: proceduresPayload ?? {},
          drugs: drugsPayload ?? {},
        });
        return sqlJson;
      } catch (e) {
        console.error("vector-sqljson failed", e);
        return null;
      }
    } catch (err: any) {
      console.error('buildFiltersFromPrompt failed', err);
      return rejectWithValue('Failed to build filters from prompt');
    }
  }
);

