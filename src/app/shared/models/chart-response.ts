export type ChartType = 'pie' | 'bar' | 'line';

export interface ChartData {
  type: ChartType;
  labels: string[];
  data: number[];
}

export interface MessageResponse {
  message: string;
}

export type ChartResponse = ChartData | MessageResponse;

export function isMessage(r: ChartResponse): r is MessageResponse {
  return (r as MessageResponse).message !== undefined;
}
