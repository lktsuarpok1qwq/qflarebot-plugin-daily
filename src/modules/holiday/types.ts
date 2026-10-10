export type Holiday = {
  id: string;
  name: string;
  start: string;
  end: string;
  kind: "holiday" | "makeup";
  source: "uapi" | "manual";
  manual?: boolean;
  batchId?: string;
};
export type HolidayCopy = Record<
  | "summary"
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
};
