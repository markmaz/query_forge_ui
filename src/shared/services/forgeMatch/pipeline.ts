import * as XLSX from "xlsx";
import { suggestSemanticColumns } from "../semantic";
import {
  searchDictionaryColumns,
  type WorkspaceDictionaryColumn,
} from "../queryStudioAdminApi";
import type {
  ForgeMatchAnalyzeResponse,
  ForgeMatchCandidate,
  ForgeMatchConfidenceBand,
  ForgeMatchConfidenceBreakdown,
  ForgeMatchMapping,
  ForgeMatchReviewStatus,
  ForgeMatchSession,
  ForgeMatchSourceRecord,
  ForgeMatchSummary,
} from "./contracts";

const SUPPORTED_EXTENSIONS = new Set(["csv", "xlsx"]);
const MAX_EXAMPLE_VALUES = 5;
const MAX_ANALYZE_RECORDS = 500;
const MAX_CANDIDATES_FOR_RERANK = 5;
const MAX_ALTERNATES = 2;

const FIELD_HEADER_HINTS: Record<string, string[]> = {
  source_field: [
    "field",
    "source field",
    "column",
    "source column",
    "field name",
    "column name",
    "attribute",
    "name",
  ],
  description: [
    "description",
    "desc",
    "definition",
    "business definition",
    "meaning",
  ],
  data_type: ["type", "data type", "datatype", "format", "field type"],
  source_object: [
    "table",
    "source table",
    "object",
    "entity",
    "file",
    "source object",
  ],
  example_values: ["example", "sample", "values", "examples", "sample values"],
};

type SourceHeaderKey = keyof typeof FIELD_HEADER_HINTS;

type ParsedSheet = {
  name: string;
  source_records: ForgeMatchSourceRecord[];
};

export type ParseWorkbookResult = {
  sheet_names: string[];
  source_records: ForgeMatchSourceRecord[];
  parse_stats: {
    sheets_processed: number;
    rows_scanned: number;
    rows_extracted: number;
  };
};

export type CandidateRetrievalRecord = {
  candidates: ForgeMatchCandidate[];
  retrievalLatencyMs: number;
  llmLatencyMs: number;
  llmUsed: boolean;
  llmError: string | null;
};

export type AnalyzePipelineOptions = {
  workspaceId?: string;
  nowIso?: string;
  rerankCandidates?: (input: {
    sourceRecord: ForgeMatchSourceRecord;
    candidates: ForgeMatchCandidate[];
    workspaceId?: string;
  }) => Promise<{ orderedColumnIds: number[]; explanation?: string }>;
  retrieveCandidates?: (input: {
    sourceRecord: ForgeMatchSourceRecord;
    workspaceId?: string;
  }) => Promise<CandidateRetrievalRecord>;
};

function normalizeCell(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean")
    return String(value).trim();
  return "";
}

function normalizeToken(value: string): string {
  return value
    .toLowerCase()
    .replace(/[_\-.]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function toReasonableId(input: string): string {
  const normalized = input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return normalized || "field";
}

function chooseHeaderRow(rows: string[][]): number {
  const inspectCount = Math.min(rows.length, 25);
  let bestIndex = 0;
  let bestScore = Number.NEGATIVE_INFINITY;

  for (let index = 0; index < inspectCount; index += 1) {
    const row = rows[index] ?? [];
    const nonEmpty = row.map(normalizeCell).filter(Boolean);
    if (nonEmpty.length < 2) continue;

    const normalized = nonEmpty.map((value) => normalizeToken(value));
    const hintScore = normalized.reduce((acc, cell) => {
      let points = 0;
      Object.values(FIELD_HEADER_HINTS).forEach((hints) => {
        if (hints.some((hint) => cell.includes(hint))) {
          points += 2;
        }
      });
      return acc + points;
    }, 0);

    const uniquenessBonus = new Set(normalized).size / normalized.length;
    const score = hintScore + uniquenessBonus;

    if (score > bestScore) {
      bestScore = score;
      bestIndex = index;
    }
  }

  return bestIndex;
}

function detectHeaderMapping(
  headerRow: string[],
): Record<SourceHeaderKey, number | null> {
  const mapping: Record<SourceHeaderKey, number | null> = {
    source_field: null,
    description: null,
    data_type: null,
    source_object: null,
    example_values: null,
  };

  headerRow.forEach((headerValue, index) => {
    const normalizedHeader = normalizeToken(headerValue);
    (Object.keys(FIELD_HEADER_HINTS) as SourceHeaderKey[]).forEach((key) => {
      if (mapping[key] != null) return;
      const matches = FIELD_HEADER_HINTS[key].some((hint) =>
        normalizedHeader.includes(hint),
      );
      if (matches) {
        mapping[key] = index;
      }
    });
  });

  if (mapping.source_field == null) {
    const fallbackIndex = headerRow.findIndex(
      (entry) => normalizeCell(entry).length > 0,
    );
    mapping.source_field = fallbackIndex >= 0 ? fallbackIndex : 0;
  }

  return mapping;
}

function parseExampleValues(rawValue: string): string[] {
  if (!rawValue) return [];
  return rawValue
    .split(/[|,;\n]/g)
    .map((entry) => entry.trim())
    .filter(Boolean)
    .slice(0, MAX_EXAMPLE_VALUES);
}

function toRawValuesMap(
  headers: string[],
  row: string[],
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  headers.forEach((header, index) => {
    const key = normalizeCell(header) || `column_${index + 1}`;
    result[key] = row[index] ?? "";
  });
  return result;
}

function extractSourceRowsFromSheet(
  sheetName: string,
  matrix: string[][],
): ParsedSheet {
  if (matrix.length === 0) {
    return { name: sheetName, source_records: [] };
  }

  const headerRowIndex = chooseHeaderRow(matrix);
  const headerRow = (matrix[headerRowIndex] ?? []).map(normalizeCell);
  const headerMap = detectHeaderMapping(headerRow);

  const rows: ForgeMatchSourceRecord[] = [];
  for (
    let rowIndex = headerRowIndex + 1;
    rowIndex < matrix.length;
    rowIndex += 1
  ) {
    const current = (matrix[rowIndex] ?? []).map(normalizeCell);
    const sourceField = normalizeCell(current[headerMap.source_field ?? 0]);
    const description = normalizeCell(
      headerMap.description == null
        ? ""
        : (current[headerMap.description] ?? ""),
    );
    const dataType = normalizeCell(
      headerMap.data_type == null ? "" : (current[headerMap.data_type] ?? ""),
    );
    const sourceObject = normalizeCell(
      headerMap.source_object == null
        ? ""
        : (current[headerMap.source_object] ?? ""),
    );
    const examplesRaw = normalizeCell(
      headerMap.example_values == null
        ? ""
        : (current[headerMap.example_values] ?? ""),
    );

    const isMeaningfulRow = Boolean(
      sourceField || description || dataType || sourceObject || examplesRaw,
    );
    if (!isMeaningfulRow) continue;
    if (!sourceField) continue;

    const id = `${toReasonableId(sheetName)}-${rowIndex + 1}-${toReasonableId(sourceField).slice(0, 48)}`;

    rows.push({
      id,
      source_field: sourceField,
      description: description || null,
      data_type: dataType || null,
      source_object: sourceObject || null,
      example_values: parseExampleValues(examplesRaw),
      raw_values: toRawValuesMap(headerRow, current),
      provenance: {
        sheet_name: sheetName,
        row_number: rowIndex + 1,
      },
    });
  }

  return { name: sheetName, source_records: rows };
}

function validateFileExtension(filename: string): void {
  const suffix = filename.split(".").pop()?.toLowerCase() ?? "";
  if (!SUPPORTED_EXTENSIONS.has(suffix)) {
    throw new Error(
      "Unsupported file type. Please upload .xlsx or .csv files.",
    );
  }
}

async function readFileAsArrayBuffer(file: File): Promise<ArrayBuffer> {
  const maybeArrayBuffer = file as File & {
    arrayBuffer?: () => Promise<ArrayBuffer>;
  };
  if (typeof maybeArrayBuffer.arrayBuffer === "function") {
    return maybeArrayBuffer.arrayBuffer();
  }

  if (typeof Response !== "undefined") {
    return new Response(file).arrayBuffer();
  }

  return new Promise<ArrayBuffer>((resolve, reject) => {
    if (typeof FileReader === "undefined") {
      reject(new Error("File reading is not supported in this environment."));
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Unable to read uploaded file."));
    reader.onload = () => {
      const result = reader.result;
      if (result instanceof ArrayBuffer) {
        resolve(result);
        return;
      }
      reject(new Error("Unable to read uploaded file."));
    };
    reader.readAsArrayBuffer(file);
  });
}

async function readFileAsText(file: File): Promise<string> {
  const maybeText = file as File & { text?: () => Promise<string> };
  if (typeof maybeText.text === "function") {
    return maybeText.text();
  }

  if (typeof Response !== "undefined") {
    return new Response(file).text();
  }

  return new Promise<string>((resolve, reject) => {
    if (typeof FileReader === "undefined") {
      reject(new Error("File reading is not supported in this environment."));
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Unable to read uploaded file."));
    reader.onload = () =>
      resolve(typeof reader.result === "string" ? reader.result : "");
    reader.readAsText(file);
  });
}

function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];
    if (char === '"' && inQuotes && next === '"') {
      current += '"';
      i += 1;
      continue;
    }
    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (char === "," && !inQuotes) {
      values.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }

  values.push(current.trim());
  return values;
}

function parseCsvText(text: string): string[][] {
  const lines = text
    .split(/\r?\n/g)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  return lines.map((line) => parseCsvLine(line));
}

function fileToWorkbook(
  arrayBuffer: ArrayBuffer,
  filename: string,
): XLSX.WorkBook {
  try {
    return XLSX.read(arrayBuffer, {
      type: "array",
      cellText: true,
      cellDates: false,
      raw: false,
      WTF: false,
    });
  } catch (error) {
    throw new Error(
      `Unable to parse ${filename}. Please verify the file is not malformed.`,
    );
  }
}

export async function parseForgeMatchWorkbook(
  file: File,
): Promise<ParseWorkbookResult> {
  validateFileExtension(file.name);
  const suffix = file.name.split(".").pop()?.toLowerCase() ?? "";

  if (suffix === "csv") {
    const csvText = await readFileAsText(file);
    const matrix = parseCsvText(csvText);
    const parsedSheet = extractSourceRowsFromSheet("Sheet1", matrix);

    if (parsedSheet.source_records.length === 0) {
      throw new Error("No source fields were detected in the uploaded file.");
    }

    return {
      sheet_names: [parsedSheet.name],
      source_records: parsedSheet.source_records,
      parse_stats: {
        sheets_processed: 1,
        rows_scanned: matrix.length,
        rows_extracted: parsedSheet.source_records.length,
      },
    };
  }

  const rawBuffer = await readFileAsArrayBuffer(file);
  const workbook = fileToWorkbook(rawBuffer, file.name);
  const sheetNames = workbook.SheetNames ?? [];

  if (sheetNames.length === 0) {
    throw new Error("Uploaded workbook has no sheets.");
  }

  let rowsScanned = 0;
  const parsedSheets = sheetNames.map((sheetName) => {
    const sheet = workbook.Sheets[sheetName];
    const matrix = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      blankrows: false,
      defval: "",
      raw: false,
    }) as unknown[];
    const normalizedMatrix = matrix.map((row) =>
      Array.isArray(row) ? row.map(normalizeCell) : [],
    );
    rowsScanned += normalizedMatrix.length;
    return extractSourceRowsFromSheet(sheetName, normalizedMatrix);
  });

  const sourceRecords = parsedSheets.flatMap((sheet) => sheet.source_records);
  if (sourceRecords.length === 0) {
    throw new Error("No source fields were detected in the uploaded file.");
  }

  return {
    sheet_names: parsedSheets.map((sheet) => sheet.name),
    source_records: sourceRecords,
    parse_stats: {
      sheets_processed: parsedSheets.length,
      rows_scanned: rowsScanned,
      rows_extracted: sourceRecords.length,
    },
  };
}

function tokenize(value: string | null | undefined): string[] {
  if (!value) return [];
  const normalized = normalizeToken(value);
  if (!normalized) return [];
  return normalized.split(" ").filter(Boolean);
}

function jaccardScore(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const aSet = new Set(a);
  const bSet = new Set(b);
  const intersection = [...aSet].filter((item) => bSet.has(item)).length;
  const union = new Set([...aSet, ...bSet]).size;
  if (union === 0) return 0;
  return intersection / union;
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function lexicalScoreForColumn(
  sourceRecord: ForgeMatchSourceRecord,
  candidate: WorkspaceDictionaryColumn,
): number {
  const sourceTokens = [
    ...tokenize(sourceRecord.source_field),
    ...tokenize(sourceRecord.description),
    ...tokenize(sourceRecord.source_object),
  ];
  const candidateTokens = [
    ...tokenize(candidate.column_name),
    ...tokenize(candidate.table_name),
    ...tokenize(candidate.description),
  ];
  return clamp01(jaccardScore(sourceTokens, candidateTokens));
}

function bestString(value: unknown, fallback = ""): string {
  if (typeof value === "string") return value;
  if (value == null) return fallback;
  return String(value);
}

function buildCandidateFromDictionaryRow(
  row: WorkspaceDictionaryColumn,
  lexicalScore: number,
  retrievalScore = 0,
  reasonCodes: string[] = [],
): ForgeMatchCandidate {
  const merged = clamp01(retrievalScore * 0.62 + lexicalScore * 0.38);
  return {
    column_id: Number(row.id),
    table_name: bestString(row.table_name),
    column_name: bestString(row.column_name),
    domain_name: null,
    concept_key: null,
    retrieval_score: clamp01(retrievalScore),
    lexical_score: clamp01(lexicalScore),
    merged_score: merged,
    reason_codes: reasonCodes,
    selected_by_llm: false,
  };
}

export function mergeForgeMatchCandidates(input: {
  vectorCandidates: ForgeMatchCandidate[];
  lexicalCandidates: ForgeMatchCandidate[];
}): ForgeMatchCandidate[] {
  const merged = new Map<number, ForgeMatchCandidate>();

  const upsert = (candidate: ForgeMatchCandidate) => {
    const existing = merged.get(candidate.column_id);
    if (!existing) {
      merged.set(candidate.column_id, candidate);
      return;
    }

    const next: ForgeMatchCandidate = {
      ...existing,
      table_name: existing.table_name || candidate.table_name,
      column_name: existing.column_name || candidate.column_name,
      concept_key: existing.concept_key ?? candidate.concept_key,
      retrieval_score: Math.max(
        existing.retrieval_score,
        candidate.retrieval_score,
      ),
      lexical_score: Math.max(existing.lexical_score, candidate.lexical_score),
      reason_codes: Array.from(
        new Set([...existing.reason_codes, ...candidate.reason_codes]),
      ),
      merged_score: 0,
      selected_by_llm: false,
    };

    next.merged_score = clamp01(
      next.retrieval_score * 0.62 + next.lexical_score * 0.38,
    );
    merged.set(candidate.column_id, next);
  };

  input.vectorCandidates.forEach(upsert);
  input.lexicalCandidates.forEach(upsert);

  return [...merged.values()]
    .map((candidate) => ({
      ...candidate,
      merged_score: clamp01(
        candidate.retrieval_score * 0.62 + candidate.lexical_score * 0.38,
      ),
    }))
    .sort((a, b) => b.merged_score - a.merged_score)
    .slice(0, MAX_CANDIDATES_FOR_RERANK);
}

function buildFallbackExplanation(
  candidate: ForgeMatchCandidate | null,
  sourceRecord: ForgeMatchSourceRecord,
): string {
  if (!candidate) {
    return "No confident candidate was found from retrieval results. Manual review is required.";
  }

  const lexicalPct = Math.round(candidate.lexical_score * 100);
  const retrievalPct = Math.round(candidate.retrieval_score * 100);
  return `Matched ${sourceRecord.source_field} to ${candidate.table_name}.${candidate.column_name} using retrieval (${retrievalPct}%) and lexical overlap (${lexicalPct}%).`;
}

function deriveConfidenceBand(score: number): ForgeMatchConfidenceBand {
  if (score >= 0.78) return "high";
  if (score >= 0.55) return "medium";
  return "low";
}

export function buildForgeMatchConfidenceBreakdown(params: {
  best: ForgeMatchCandidate | null;
  alternates: ForgeMatchCandidate[];
  llmUsed: boolean;
  sourceRecord: ForgeMatchSourceRecord;
}): ForgeMatchConfidenceBreakdown {
  const { best, alternates, llmUsed, sourceRecord } = params;
  const retrieval = best?.retrieval_score ?? 0;
  const lexical = best?.lexical_score ?? 0;
  const llm = llmUsed ? 0.9 : 0.45;

  let completeness = 0.2;
  if (sourceRecord.description) completeness += 0.3;
  if (sourceRecord.data_type) completeness += 0.25;
  if (sourceRecord.source_object) completeness += 0.25;
  if (sourceRecord.example_values.length > 0) completeness += 0.2;
  completeness = clamp01(completeness);

  const nextBest = alternates[0] ?? null;
  const topGap =
    best && nextBest
      ? Math.max(0, best.merged_score - nextBest.merged_score)
      : best
        ? best.merged_score
        : 0;
  let penalties = 0;
  if (!best) penalties = 1;
  else {
    if (topGap < 0.08) penalties += 0.35;
    if (best.merged_score < 0.45) penalties += 0.4;
    if (!sourceRecord.description && !sourceRecord.source_object)
      penalties += 0.15;
  }
  penalties = clamp01(penalties);

  const base =
    retrieval * 0.42 + lexical * 0.24 + llm * 0.16 + completeness * 0.18;
  const total = clamp01(base * (1 - penalties * 0.6));

  return {
    retrieval: clamp01(retrieval),
    lexical: clamp01(lexical),
    llm: clamp01(llm),
    completeness: clamp01(completeness),
    penalties,
    total,
  };
}

function deriveInitialStatus(
  best: ForgeMatchCandidate | null,
  confidenceBand: ForgeMatchConfidenceBand,
): ForgeMatchReviewStatus {
  if (!best) return "needs_review";
  return confidenceBand === "high" ? "pending" : "needs_review";
}

function currentIso(nowIso?: string): string {
  return nowIso ?? new Date().toISOString();
}

function createMappingId(
  sessionId: string,
  sourceRecord: ForgeMatchSourceRecord,
): string {
  return `${sessionId}:${sourceRecord.id}`;
}

function toBaseSession(
  filename: string,
  parsed: ParseWorkbookResult,
  nowIso?: string,
): ForgeMatchSession {
  const now = currentIso(nowIso);
  return {
    id:
      typeof globalThis.crypto?.randomUUID === "function"
        ? globalThis.crypto.randomUUID()
        : `fm-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    filename,
    sheet_names: parsed.sheet_names,
    source_record_count: parsed.source_records.length,
    status: "uploaded",
    created_at: now,
    updated_at: now,
  };
}

export function createLocalForgeMatchSession(
  fileName: string,
  parsed: ParseWorkbookResult,
  nowIso?: string,
): ForgeMatchSession {
  return toBaseSession(fileName, parsed, nowIso);
}

export function summarizeForgeMatchResults(
  results: ForgeMatchMapping[],
): ForgeMatchSummary {
  const total = results.length;
  const matched = results.filter((entry) =>
    Boolean(entry.best_match && entry.confidence_band !== "low"),
  ).length;
  const ambiguous = results.filter(
    (entry) => entry.confidence_band === "medium",
  ).length;
  const noConfidentMatch = results.filter(
    (entry) => entry.best_match == null || entry.confidence_band === "low",
  ).length;
  const accepted = results.filter(
    (entry) =>
      entry.status === "accepted" || entry.status === "manually_mapped",
  ).length;
  const rejected = results.filter(
    (entry) => entry.status === "rejected",
  ).length;
  const needsReview = results.filter(
    (entry) => entry.status === "needs_review" || entry.status === "pending",
  ).length;

  return {
    total,
    matched,
    ambiguous,
    no_confident_match: noConfidentMatch,
    accepted,
    rejected,
    needs_review: needsReview,
  };
}

async function retrieveCandidatesDefault(input: {
  sourceRecord: ForgeMatchSourceRecord;
  workspaceId?: string;
}): Promise<CandidateRetrievalRecord> {
  const retrievalStart = performance.now();
  const vectorCandidates: ForgeMatchCandidate[] = [];
  const lexicalCandidates: ForgeMatchCandidate[] = [];
  let llmLatencyMs = 0;
  let llmError: string | null = null;

  const workspaceId = String(input.workspaceId ?? "").trim();

  if (workspaceId) {
    try {
      const promptParts = [
        input.sourceRecord.source_field,
        input.sourceRecord.description,
        input.sourceRecord.source_object,
        input.sourceRecord.data_type,
      ].filter(Boolean);

      const plannerResponse = await suggestSemanticColumns({
        workspace_id: workspaceId,
        prompt: promptParts.join(" | "),
        max_columns: 15,
        max_concepts: 10,
        debug: true,
      });

      const byColumnId = new Map<number, ForgeMatchCandidate>();
      plannerResponse.column_vector.hits.forEach((hit) => {
        const candidate: ForgeMatchCandidate = {
          column_id: hit.model_column_id,
          table_name: hit.table_name,
          column_name: hit.column_name,
          domain_name: null,
          concept_key: hit.concept_key,
          retrieval_score: clamp01(hit.score),
          lexical_score: 0,
          merged_score: clamp01(hit.score),
          reason_codes: ["vector_hit"],
          selected_by_llm: false,
        };
        byColumnId.set(candidate.column_id, candidate);
      });

      plannerResponse.concept_mapping.mapped_columns.forEach((mapped) => {
        const existing = byColumnId.get(mapped.model_column_id);
        const retrievalScore = clamp01(mapped.weight);
        if (!existing) {
          byColumnId.set(mapped.model_column_id, {
            column_id: mapped.model_column_id,
            table_name: mapped.table_name,
            column_name: mapped.column_name,
            domain_name: null,
            concept_key: mapped.concept_key,
            retrieval_score: retrievalScore,
            lexical_score: 0,
            merged_score: retrievalScore,
            reason_codes: ["concept_mapping"],
            selected_by_llm: false,
          });
          return;
        }
        existing.retrieval_score = Math.max(
          existing.retrieval_score,
          retrievalScore,
        );
        existing.reason_codes = Array.from(
          new Set([...existing.reason_codes, "concept_mapping"]),
        );
      });

      vectorCandidates.push(...byColumnId.values());
    } catch (error) {
      llmError =
        error instanceof Error ? error.message : "Vector retrieval failed.";
    }
  }

  if (input.sourceRecord.source_field) {
    try {
      const query = input.sourceRecord.source_field.trim().slice(0, 120);
      const searchResponse = await searchDictionaryColumns({
        q: query,
        limit: 20,
        active_only: true,
      });
      searchResponse.rows.forEach((row) => {
        const lexical = lexicalScoreForColumn(input.sourceRecord, row);
        lexicalCandidates.push(
          buildCandidateFromDictionaryRow(
            row,
            lexical,
            0,
            lexical > 0.5 ? ["strong_lexical_overlap"] : ["lexical_match"],
          ),
        );
      });
    } catch (error) {
      llmError =
        llmError ??
        (error instanceof Error ? error.message : "Lexical retrieval failed.");
    }
  }

  const merged = mergeForgeMatchCandidates({
    vectorCandidates,
    lexicalCandidates,
  });

  const retrievalLatencyMs = Math.max(
    0,
    Math.round(performance.now() - retrievalStart),
  );
  llmLatencyMs = Math.max(0, Math.round(llmLatencyMs));

  return {
    candidates: merged,
    retrievalLatencyMs,
    llmLatencyMs,
    llmUsed: false,
    llmError,
  };
}

function enforceConstrainedRerank(
  candidates: ForgeMatchCandidate[],
  orderedIds: number[],
): ForgeMatchCandidate[] {
  if (orderedIds.length === 0) return candidates;
  const byId = new Map(
    candidates.map((candidate) => [candidate.column_id, candidate] as const),
  );
  const ordered = orderedIds
    .map((id) => byId.get(id))
    .filter((candidate): candidate is ForgeMatchCandidate => Boolean(candidate))
    .map((candidate, index) => ({
      ...candidate,
      selected_by_llm: index < 3,
      reason_codes: Array.from(
        new Set([...candidate.reason_codes, "llm_reranked"]),
      ),
    }));

  const orderedIdSet = new Set(ordered.map((entry) => entry.column_id));
  const remainder = candidates.filter(
    (entry) => !orderedIdSet.has(entry.column_id),
  );
  return [...ordered, ...remainder];
}

export async function analyzeForgeMatchRecords(
  session: ForgeMatchSession,
  sourceRecords: ForgeMatchSourceRecord[],
  options: AnalyzePipelineOptions = {},
): Promise<ForgeMatchAnalyzeResponse> {
  const now = currentIso(options.nowIso);
  const records = sourceRecords.slice(0, MAX_ANALYZE_RECORDS);
  const retrieveCandidates =
    options.retrieveCandidates ?? retrieveCandidatesDefault;

  const results: ForgeMatchMapping[] = [];
  for (const sourceRecord of records) {
    const retrieval = await retrieveCandidates({
      sourceRecord,
      workspaceId: options.workspaceId,
    });

    let rankedCandidates = retrieval.candidates;
    let llmUsed = retrieval.llmUsed;
    let llmLatencyMs = retrieval.llmLatencyMs;
    let llmError = retrieval.llmError;
    let llmExplanation: string | undefined;

    if (options.rerankCandidates && rankedCandidates.length > 0) {
      const rerankStart = performance.now();
      try {
        const rerankResult = await options.rerankCandidates({
          sourceRecord,
          candidates: rankedCandidates,
          workspaceId: options.workspaceId,
        });
        rankedCandidates = enforceConstrainedRerank(
          rankedCandidates,
          rerankResult.orderedColumnIds,
        );
        llmUsed = true;
        llmExplanation = rerankResult.explanation;
      } catch (error) {
        llmError =
          error instanceof Error ? error.message : "LLM rerank failed.";
      } finally {
        llmLatencyMs = Math.max(0, Math.round(performance.now() - rerankStart));
      }
    }

    const bestMatch = rankedCandidates[0] ?? null;
    const alternates = rankedCandidates.slice(1, 1 + MAX_ALTERNATES);

    const confidenceBreakdown = buildForgeMatchConfidenceBreakdown({
      best: bestMatch,
      alternates,
      llmUsed,
      sourceRecord,
    });
    const confidenceBand = deriveConfidenceBand(confidenceBreakdown.total);
    const status = deriveInitialStatus(bestMatch, confidenceBand);

    const reasonCodes = Array.from(
      new Set([
        ...(bestMatch?.reason_codes ?? []),
        ...(confidenceBand === "low" ? ["low_confidence"] : []),
        ...(status === "needs_review" ? ["human_review_required"] : []),
      ]),
    );

    results.push({
      mapping_id: createMappingId(session.id, sourceRecord),
      source_record_id: sourceRecord.id,
      source_field: sourceRecord.source_field,
      description: sourceRecord.description,
      data_type: sourceRecord.data_type,
      source_object: sourceRecord.source_object,
      best_match: bestMatch,
      alternates,
      explanation:
        llmExplanation ?? buildFallbackExplanation(bestMatch, sourceRecord),
      reason_codes: reasonCodes,
      confidence_score: confidenceBreakdown.total,
      confidence_band: confidenceBand,
      confidence_breakdown: confidenceBreakdown,
      status,
      review_notes: null,
      manually_selected_column_id: null,
      provenance: sourceRecord.provenance,
      audit: {
        retrieval_latency_ms: retrieval.retrievalLatencyMs,
        llm_latency_ms: llmLatencyMs,
        retrieval_candidate_count: rankedCandidates.length,
        llm_used: llmUsed,
        llm_error: llmError,
      },
    });
  }

  const summary = summarizeForgeMatchResults(results);

  return {
    session_id: session.id,
    status: "analyzed",
    summary,
    results,
  };
}

export function patchMappings(
  results: ForgeMatchMapping[],
  updates: Array<{
    mapping_id: string;
    status: ForgeMatchReviewStatus;
    manually_selected_column_id?: number | null;
    review_notes?: string | null;
  }>,
): ForgeMatchMapping[] {
  const byMapping = new Map(
    updates.map((update) => [update.mapping_id, update] as const),
  );

  return results.map((result) => {
    const update = byMapping.get(result.mapping_id);
    if (!update) return result;

    const next: ForgeMatchMapping = {
      ...result,
      status: update.status,
      review_notes: update.review_notes ?? result.review_notes ?? null,
      manually_selected_column_id:
        update.manually_selected_column_id === undefined
          ? result.manually_selected_column_id
          : update.manually_selected_column_id,
    };

    if (
      update.status === "manually_mapped" &&
      update.manually_selected_column_id
    ) {
      const pool = [result.best_match, ...result.alternates].filter(
        (candidate): candidate is ForgeMatchCandidate => Boolean(candidate),
      );
      const selected =
        pool.find(
          (candidate) =>
            candidate.column_id === update.manually_selected_column_id,
        ) ?? null;
      if (selected) {
        next.best_match = {
          ...selected,
          selected_by_llm: false,
          reason_codes: Array.from(
            new Set([...selected.reason_codes, "manual_override"]),
          ),
        };
        next.alternates = pool
          .filter((candidate) => candidate.column_id !== selected.column_id)
          .slice(0, MAX_ALTERNATES);
        next.reason_codes = Array.from(
          new Set([...next.reason_codes, "manual_override"]),
        );
      }
    }

    return next;
  });
}

export function buildExportRows(
  results: ForgeMatchMapping[],
): Array<Record<string, string>> {
  return results.map((result) => {
    const best = result.best_match;
    return {
      source_field: result.source_field,
      description: result.description ?? "",
      data_type: result.data_type ?? "",
      source_object: result.source_object ?? "",
      best_match: best ? `${best.table_name}.${best.column_name}` : "",
      best_match_column_id: best ? String(best.column_id) : "",
      confidence_score: result.confidence_score.toFixed(3),
      confidence_band: result.confidence_band,
      status: result.status,
      explanation: result.explanation,
      alternates: result.alternates
        .map((candidate) => `${candidate.table_name}.${candidate.column_name}`)
        .join(" | "),
      review_notes: result.review_notes ?? "",
      provenance_sheet: result.provenance.sheet_name,
      provenance_row_number: String(result.provenance.row_number),
    };
  });
}

function escapeCsvCell(input: string): string {
  if (input.includes(",") || input.includes("\n") || input.includes('"')) {
    return `"${input.replace(/"/g, '""')}"`;
  }
  return input;
}

export function rowsToCsv(rows: Array<Record<string, string>>): string {
  if (rows.length === 0) {
    return "source_field,description,data_type,source_object,best_match,best_match_column_id,confidence_score,confidence_band,status,explanation,alternates,review_notes,provenance_sheet,provenance_row_number\n";
  }

  const headers = Object.keys(rows[0]);
  const lines = [headers.join(",")];

  rows.forEach((row) => {
    lines.push(
      headers
        .map((header) => escapeCsvCell(String(row[header] ?? "")))
        .join(","),
    );
  });

  return `${lines.join("\n")}\n`;
}

export type ForgeMatchDraftPayload = {
  session_id: string;
  accepted_mappings: Array<{
    mapping_id: string;
    source_field: string;
    source_object: string | null;
    target_column_id: number;
    target_table_name: string;
    target_column_name: string;
    confidence_score: number;
    confidence_band: ForgeMatchConfidenceBand;
    notes: string | null;
  }>;
};

export function buildAcceptedMappingsDraftPayload(
  sessionId: string,
  results: ForgeMatchMapping[],
): ForgeMatchDraftPayload {
  const accepted = results
    .filter(
      (result) =>
        (result.status === "accepted" || result.status === "manually_mapped") &&
        result.best_match,
    )
    .map((result) => ({
      mapping_id: result.mapping_id,
      source_field: result.source_field,
      source_object: result.source_object,
      target_column_id: Number(result.best_match!.column_id),
      target_table_name: result.best_match!.table_name,
      target_column_name: result.best_match!.column_name,
      confidence_score: result.confidence_score,
      confidence_band: result.confidence_band,
      notes: result.review_notes,
    }));

  return {
    session_id: sessionId,
    accepted_mappings: accepted,
  };
}
