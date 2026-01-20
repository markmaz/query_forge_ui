import api from "./api";
import { CohortExtractionEntity, CohortExtractionResult, ConditionMap, DemographicsData, DrugMap, MeasurementMap, ProcedureMap } from "../../entities/Cohort";
import type { SqlQueryJson } from "../../features/no-code-sql/model/sqlJson";

export const parsePrompt = async(payload: string): Promise<CohortExtractionEntity> => {
    const text = {text: payload};
  const response = await api.post(`/cohort_ai/ner`, text);
  return response.data;
}


export const getConditions = async(payload: CohortExtractionResult): Promise<ConditionMap> => {
  const response = await api.post(`/cohort_ai/conditions`, payload);
  return response.data;
}

export const getDemographics = async(payload: CohortExtractionResult): Promise<DemographicsData> => {
    const response = await api.post(`/cohort_ai/demographics`, payload);
    return response.data;
}

export const getMeasurements = async(payload: CohortExtractionResult): Promise<MeasurementMap> => {
    const response = await api.post(`/cohort_ai/measurements`, payload);
    return response.data;
}

export const getDrugs = async(payload: CohortExtractionResult): Promise<DrugMap> => {
    const response = await api.post(`/cohort_ai/medications`, payload);
    return response.data;
}

export const getProcedures = async(payload: CohortExtractionResult): Promise<ProcedureMap> => {
    const response = await api.post(`/cohort_ai/procedures`, payload);
    return response.data;
}

export const fetchCohortDomain = async (): Promise<{ domainId: number | null }> => {
  const response = await api.get(`/cohort_ai/domain`);
  const data = response.data ?? {};
  const raw =
    data.domainId ??
    data.domain_id ??
    data.id ??
    data.domain?.id ??
    data.domain?.domain_id ??
    null;
  const domainId = raw == null ? null : Number(raw);
  return { domainId: Number.isFinite(domainId) ? domainId : null };
};

export const buildCohortVectorSqlJson = async (payload: {
  demographics?: DemographicsData | Record<string, any>;
  conditions?: ConditionMap | Record<string, any>;
  procedures?: ProcedureMap | Record<string, any>;
  drugs?: DrugMap | Record<string, any>;
}): Promise<SqlQueryJson> => {
  const response = await api.post(`/cohort_ai/vector-sqljson`, payload);
  return response.data as SqlQueryJson;
};
