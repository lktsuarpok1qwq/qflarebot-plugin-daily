export type Holiday = {
  id: string;
  name: string;
  start: string;
  end: string;
  kind: "holiday" | "makeup" | "reference";
  source: "uapi" | "manual";
  batchId?: string;
};
export type HolidayCopy = Record<
  | "summary"
  | "reference"
  | "today"
  | "makeupToday"
  | "ordinary"
  | "unknown"
  | "none"
  | "ongoing"
  | "stale",
  string
>;
export type Source = {
  year: number;
  hash: string;
  data: string;
  error: string | null;
  updated_at: number;
  checked_at?: number | null;
};
