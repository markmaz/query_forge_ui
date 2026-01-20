export interface TableMeta {
  id: string;
  label: string;
  schema: string;
}

export interface ColumnMeta {
  name: string;
  description: string;
}

export interface DomainMeta {
  id: string;
  name: string;
  description: string;
  tables: string[]; // drives the columns list (union of tables)
}

export interface CrosswalkListMeta {
  id: string;
  name: string;
}

export const MOCK_TABLES: TableMeta[] = [
  { id: "claims_header", label: "Claims Header", schema: "CLAIMS" },
  { id: "claims_line", label: "Claims Line", schema: "CLAIMS" },
  { id: "member", label: "Member Dimension", schema: "MEMBER" },
];

export const MOCK_COLUMNS_BY_TABLE: Record<string, ColumnMeta[]> = {
  claims_header: [
    { name: "claim_id", description: "Unique identifier for the claim header" },
    { name: "member_id", description: "Member associated with the claim" },
    { name: "service_from_date", description: "Start date of service" },
    { name: "service_to_date", description: "End date of service" },
    { name: "paid_amount", description: "Amount paid on the claim" },
    { name: "allowed_amount", description: "Allowed amount for the claim" },
    { name: "line_of_business", description: "Line of business for the claim" },
    { name: "diagnosis_code", description: "Primary diagnosis code" },
    { name: "provider_npi", description: "Rendering provider NPI" },
    { name: "service_quarter", description: "Service quarter (YYYYQ)" },
  ],
  claims_line: [
    { name: "claim_line_id", description: "Unique identifier for the claim line" },
    { name: "claim_id", description: "Foreign key to claim header" },
    { name: "hcpcs_code", description: "HCPCS / CPT procedure code" },
  ],
  member: [
    { name: "member_id", description: "Unique identifier for member" },
    { name: "dob", description: "Date of birth" },
    { name: "gender", description: "Self-reported gender" },
  ],
};

export const MOCK_DOMAINS: DomainMeta[] = [
  {
    id: "claims",
    name: "Claims",
    description:
      "Core medical claims data for payments, allowed amounts, diagnoses, and servicing dates.",
    tables: ["claims_header", "claims_line"],
  },
  {
    id: "member",
    name: "Member",
    description:
      "Member dimension data for demographic fields used to slice and filter claim outcomes.",
    tables: ["member"],
  },
  {
    id: "pt",
    name: "Physical Therapy",
    description:
      "Physical therapy-focused domain curated for provider, facility, and PT utilization analytics.",
    tables: ["claims_header"],
  },
];

export const MOCK_CROSSWALK_LISTS: CrosswalkListMeta[] = [
  { id: "cw_1", name: "My Provider Taxonomy Crosswalk" },
  { id: "cw_2", name: "State Normalization List" },
  { id: "cw_3", name: "LOB Grouping List" },
];

export const PAGE_SIZE = 2000;