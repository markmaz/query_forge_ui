export interface CohortExtractionEntity {
  age?: RangeField;
  dx_year?: RangeField;
  gender?: string[];
  lab_vital_measurement?: LabVitalMeasurement[];
  location?: string[];
  medical_condition?: MedicalCondition[];
  medical_procedure?: MedicalProcedure[];
  medication?: Medication[];
}

/** Generic lower/upper bound structure */
export interface RangeField {
  lower_bound: number | null;
  upper_bound: number | null;
}

/** Lab / vital measurement item */
export interface LabVitalMeasurement {
  logic: LogicOperator;
  measurement_name: string;
  measurement_unit: string;
  measurement_value: RangeField;
  type: "description";  // literal type because your examples always use this
}

/** Medical condition item */
export interface MedicalCondition {
  condition: string;
  logic: LogicOperator;
  negation: NegationOption;
  type: "code" | "description";
}

/** Procedure filter item */
export interface MedicalProcedure {
  procedure: string;
  logic: LogicOperator;
  negation: NegationOption;
  type: "code" | "description";
}

/** Medication filter item */
export interface Medication {
  drug: string;
  logic: LogicOperator;
  negation: NegationOption;
  type: "code" | "description";
}

/** Common enums */
export type LogicOperator = "AND" | "OR";
export type NegationOption = "None" | "Not" | string;  // flexible if new types appear

export interface ConditionMap {
  [label: string]: ConditionEntry;
}

export interface ConditionEntry {
  code: string;
  logic: LogicOperator;
  name: string;
  negation: NegationOption;
}

export interface DemographicsData {
  age?: RangeValue;
  dx_year?: RangeValue;
  gender?: string[];
  location?: string[];
}

/** Shared numeric range used for age & dx_year */
export interface RangeValue {
  lower_bound: number | null;
  upper_bound: number | null;
}

export interface MeasurementMap {
  [label: string]: MeasurementEntry;
}

export interface MeasurementEntry {
  code: number;                // e.g. 4144235
  logic: LogicOperator;        // 'OR' in your examples
  name: string;                // human label
  unit: MeasurementUnitMap;    // e.g. { "mg/dL": 8840, ... }
  value: RangeValue;           // { lower_bound, upper_bound }
}

export interface MeasurementUnitMap {
  [unitLabel: string]: number; // unit string → concept ID (or similar)
}

export interface DrugMap {
  [label: string]: DrugEntry;
}

export interface DrugEntry {
  code: string;            // CSV of NDCs
  logic: LogicOperator;    // usually 'OR'
  name: string;            // display name, e.g. "ozempic (semaglutide)"
  negation: NegationOption;
}

export interface ProcedureMap {
  [label: string]: ProcedureEntry;
}

export interface ProcedureEntry {
  code: string;
  logic: LogicOperator;
  name: string;
  negation: NegationOption;
}
export interface CohortExtractionResult {
  base_url: string;
  workspace_id: string;
  entity: CohortExtractionEntity;
}