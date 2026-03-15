export type StepStatus = "idle" | "active" | "done" | "error";

export interface PipelineStep {
  id: number;
  label: string;
  status: StepStatus;
}

export interface ChartConfig {
  x_axis?:  string;
  y_axis?:  string;
  title?:   string;
  group_by?: string | null;
}

export interface WoW {
  status?:          string;
  current_week?:    string;
  current_value?:   number;
  previous_week?:   string;
  previous_value?:  number;
  wow_pct?:         number | null;
  trend?:           "up" | "down" | "flat";
  absolute_change?: number;
}

export interface Outliers {
  count:   number;
  values?: number[];
  method?: string;
}

export interface TopBottom {
  top:    { label: string; value: number }[];
  bottom: { label: string; value: number }[];
}

export interface Stats {
  n?: number; sum?: number; mean?: number; median?: number;
  stdev?: number; min?: number; max?: number;
}

export interface HealthScore {
  score:   number;
  grade:   string;
  color:   string;
  signals: string[];
}

export interface Insights {
  wow?:        WoW;
  outliers?:   Outliers;
  top_bottom?: TopBottom;
  stats?:      Stats;
  health?:     HealthScore;
}

export interface QueryResult {
  question?:      string;
  sql?:           string;
  thought?:       string;
  confidence?:    number;
  viz_type?:      string;
  chart_config?:  ChartConfig;
  rows?:          Record<string, any>[];
  columns?:       string[];
  total_rows?:    number;
  insights?:      Insights;
  narrative?:     string;
  total_ms?:      number;
  healed?:        boolean;
  attempts?:      number;
}

export interface HistoryItem {
  id:        string;
  question:  string;
  ts:        number;
  result:    QueryResult;
}
