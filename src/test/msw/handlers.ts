import { http, HttpResponse } from "msw";

const API_BASE = "http://localhost";

let lastQueryPayload: any = null;
const joinsByDomain = new Map<string, any[]>();
let joinSeq = 1;

export const getLastQueryPayload = () => lastQueryPayload;
export const resetLastQueryPayload = () => {
  lastQueryPayload = null;
};
export const resetJoinStore = () => {
  joinsByDomain.clear();
  joinSeq = 1;
};

const getJoins = (domainId: string) => joinsByDomain.get(domainId) ?? [];
const setJoins = (domainId: string, rows: any[]) => {
  joinsByDomain.set(domainId, rows);
};

export const handlers = [
  http.get(`${API_BASE}/domains`, () => {
    return HttpResponse.json({
      rows: [
        {
          id: 1,
          name: "Patient Domain",
          kind: "Clinical",
          description: "Patient-related tables",
          model_table_id: 10,
          can_edit: true,
        },
      ],
    });
  }),

  http.get(`${API_BASE}/domains/summary`, () => {
    return HttpResponse.json({
      rows: [
        {
          id: 1,
          table_count: 2,
          table_sample: ["patient_origins", "source_codes"],
        },
      ],
    });
  }),

  http.get(`${API_BASE}/models/tables`, () => {
    return HttpResponse.json({
      rows: [{ id: 10, name: "Patients", sourceTableName: null, description: null }],
      limit: 5000,
      offset: 0,
    });
  }),

  http.get(`${API_BASE}/domains/:domainId/tables`, () => {
    return HttpResponse.json({
      rows: [
        {
          workspace_table_id: 100,
          model_table_id: 10,
          model_table_name: "Patients",
          full_name: "analytics.directory.patient_origins",
          table_name: "patient_origins",
          schema_name: "directory",
          catalog_name: "analytics",
          variant_code: null,
          is_qe: false,
          relation_kind: "JOIN",
          is_primary: true,
          sort_order: 0,
          table_alias: "t0",
        },
        {
          workspace_table_id: 101,
          model_table_id: 11,
          model_table_name: "Source Codes",
          full_name: "analytics.workboard.cohort_builder_source_codes",
          table_name: "cohort_builder_source_codes",
          schema_name: "workboard",
          catalog_name: "analytics",
          variant_code: null,
          is_qe: false,
          relation_kind: "JOIN",
          is_primary: false,
          sort_order: 1,
          table_alias: "t1",
        },
      ],
    });
  }),

  http.post(`${API_BASE}/domains/:domainId/tables`, async ({ request }) => {
    const body = (await request.json()) as any;
    if (body?.add?.length || body?.remove?.length) {
      return HttpResponse.json({ ok: true });
    }
    return HttpResponse.json({
      rows: [
        {
          workspace_table_id: body.workspaceTableId ?? 100,
          model_table_id: 10,
          model_table_name: "Patients",
          full_name: "analytics.directory.patient_origins",
          table_name: "patient_origins",
          schema_name: "directory",
          catalog_name: "analytics",
          variant_code: null,
          is_qe: false,
          relation_kind: body.relationKind ?? "JOIN",
          is_primary: false,
          sort_order: body.sortOrder ?? 0,
          table_alias: body.tableAlias ?? null,
        },
      ],
    });
  }),

  http.patch(`${API_BASE}/domains/:domainId/tables/:workspaceTableId/primary`, ({ params }) => {
    const wtid = Number(params.workspaceTableId);
    return HttpResponse.json({
      rows: [
        {
          workspace_table_id: wtid,
          model_table_id: 10,
          model_table_name: "Patients",
          full_name: "analytics.directory.patient_origins",
          table_name: "patient_origins",
          schema_name: "directory",
          catalog_name: "analytics",
          variant_code: null,
          is_qe: false,
          relation_kind: "JOIN",
          is_primary: true,
          sort_order: 0,
          table_alias: "t0",
        },
        {
          workspace_table_id: wtid === 100 ? 101 : 100,
          model_table_id: 11,
          model_table_name: "Source Codes",
          full_name: "analytics.workboard.cohort_builder_source_codes",
          table_name: "cohort_builder_source_codes",
          schema_name: "workboard",
          catalog_name: "analytics",
          variant_code: null,
          is_qe: false,
          relation_kind: "JOIN",
          is_primary: false,
          sort_order: 1,
          table_alias: "t1",
        },
      ],
    });
  }),

  http.get(`${API_BASE}/domains/:domainId/joins`, ({ params }) => {
    const domainId = String(params.domainId);
    return HttpResponse.json({ rows: getJoins(domainId) });
  }),

  http.post(`${API_BASE}/domains/:domainId/joins`, async ({ request, params }) => {
    const domainId = String(params.domainId);
    const body = (await request.json()) as any;
    const existing = getJoins(domainId);
    const existingIdx = existing.findIndex((j) => j.to_workspace_table_id === body?.toWorkspaceTableId);
    const joinId = existingIdx >= 0 ? existing[existingIdx].id : `join-${joinSeq++}`;
    const nextRow = {
      id: joinId,
      domain_id: Number(domainId),
      from_workspace_table_id: body?.fromWorkspaceTableId,
      to_workspace_table_id: body?.toWorkspaceTableId,
      join_type: body?.joinType ?? "LEFT",
      join_spec_json: body?.joinSpec ?? { on: [] },
      sort_order: body?.sortOrder ?? 0,
      is_active: true,
    };
    const nextRows =
      existingIdx >= 0
        ? existing.map((j, idx) => (idx === existingIdx ? nextRow : j))
        : [...existing, nextRow];
    setJoins(domainId, nextRows);
    return HttpResponse.json({ ok: true, id: joinId });
  }),

  http.patch(`${API_BASE}/domains/:domainId/joins/:joinId`, async ({ request, params }) => {
    const domainId = String(params.domainId);
    const joinId = String(params.joinId);
    const body = (await request.json()) as any;
    const existing = getJoins(domainId);
    const nextRows = existing.map((j) =>
      j.id === joinId
        ? {
            ...j,
            from_workspace_table_id: body?.fromWorkspaceTableId ?? j.from_workspace_table_id,
            to_workspace_table_id: body?.toWorkspaceTableId ?? j.to_workspace_table_id,
            join_type: body?.joinType ?? j.join_type,
            join_spec_json: body?.joinSpec ?? j.join_spec_json,
            sort_order: body?.sortOrder ?? j.sort_order,
          }
        : j
    );
    setJoins(domainId, nextRows);
    return HttpResponse.json({ ok: true });
  }),

  http.delete(`${API_BASE}/domains/:domainId/joins/:joinId`, ({ params }) => {
    const domainId = String(params.domainId);
    const joinId = String(params.joinId);
    const existing = getJoins(domainId);
    const nextRows = existing.filter((j) => j.id !== joinId);
    setJoins(domainId, nextRows);
    return HttpResponse.json({ ok: true });
  }),

  http.get(`${API_BASE}/domains/workspace-tables`, () => {
    return HttpResponse.json({
      rows: [
        {
          workspace_table_id: 100,
          model_table_id: 10,
          model_table_name: "Patients",
          full_name: "analytics.directory.patient_origins",
          table_name: "patient_origins",
          schema_name: "directory",
          catalog_name: "analytics",
          variant_code: null,
          is_qe: false,
          relation_kind: null,
          is_primary: false,
          sort_order: 0,
        },
        {
          workspace_table_id: 101,
          model_table_id: 11,
          model_table_name: "Source Codes",
          full_name: "analytics.workboard.cohort_builder_source_codes",
          table_name: "cohort_builder_source_codes",
          schema_name: "workboard",
          catalog_name: "analytics",
          variant_code: null,
          is_qe: false,
          relation_kind: null,
          is_primary: false,
          sort_order: 1,
        },
      ],
    });
  }),

  http.get(`${API_BASE}/workspaces/:workspaceId/namespaces`, () => {
    return HttpResponse.json({
      schemas: ["asset", "workboard", "directory"],
      catalogs: ["analytics"],
    });
  }),

  http.get(`${API_BASE}/workspace-tables/:workspaceTableId/columns`, () => {
    return HttpResponse.json({
      rows: [
        {
          id: 1,
          workspace_table_id: 100,
          column_name: "patient_id",
          data_type: "string",
          ordinal_position: 1,
        },
        {
          id: 2,
          workspace_table_id: 101,
          column_name: "patient_id",
          data_type: "string",
          ordinal_position: 1,
        },
      ],
    });
  }),

  http.get(`${API_BASE}/domains/columns`, () => {
    return HttpResponse.json({
      rows: [
        {
          workspaceTableId: 100,
          fullName: "analytics.directory.patient_origins",
          baseTableName: "patient_origins",
          schemaName: "directory",
          catalogName: "analytics",
          variantCode: null,
          isQe: false,
          existsInDbx: true,
          lastSeenAt: null,
          domainId: 1,
          domainName: "Patient Domain",
          modelTableId: 10,
          modelTableName: "Patients",
          modelColumnId: 1000,
          columnName: "patient_id",
          columnLabel: "Patient ID",
          dataType: "string",
          nullable: false,
          ordinalPosition: 1,
          description: "Patient identifier",
          sampleValuesJson: null,
          sampleStatsJson: null,
          sampleRanAt: null,
          sampleError: null,
          tableColumnCount: 10,
        },
        {
          workspaceTableId: 100,
          fullName: "analytics.directory.patient_origins",
          baseTableName: "patient_origins",
          schemaName: "directory",
          catalogName: "analytics",
          variantCode: null,
          isQe: false,
          existsInDbx: true,
          lastSeenAt: null,
          domainId: 1,
          domainName: "Patient Domain",
          modelTableId: 10,
          modelTableName: "Patients",
          modelColumnId: 1001,
          columnName: "patient_gender",
          columnLabel: "Patient Gender",
          dataType: "string",
          nullable: true,
          ordinalPosition: 2,
          description: "Gender",
          sampleValuesJson: null,
          sampleStatsJson: null,
          sampleRanAt: null,
          sampleError: null,
          tableColumnCount: 10,
        },
      ],
      total: 2,
      limit: 50,
      offset: 0,
      columnNamePolicy: "DEDUP_PRIMARY_FIRST",
    });
  }),

  http.post(`${API_BASE}/query`, async ({ request }) => {
    const body = await request.json();
    lastQueryPayload = body;
    return HttpResponse.json({
      sql: "select * from patients limit 1",
      sqlRendered: "select * from patients limit 1",
      params: {},
      columns: [{ key: "patient_id", label: "patient_id" }],
      rows: [{ patient_id: "P-100" }],
      total: 1,
      limit: 50,
      offset: 0,
    });
  }),

  http.get(`${API_BASE}/query-tree`, () => {
    return HttpResponse.json({ rootNodes: [] });
  }),

  http.get(`${API_BASE}/query-tree/recent`, () => {
    return HttpResponse.json({ rows: [] });
  }),

  http.get(`${API_BASE}/domains/tables`, () => {
    return HttpResponse.json({ rows: [] });
  }),
];
