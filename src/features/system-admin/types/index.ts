export * from "./health";
export * from "./pipelineProfile";
export * from "./vectorIndex";
export * from "./domainProfile";
export * from "./promptFeedback";

export interface ApiError {
  error: string;
  status_code: number;
  details: Record<string, unknown>;
}
