export interface DatasetPredictionRequest {
  company_id: string;
  end_date?: string;
}

export interface DatasetPredictionResponse {
  company_id: string;
  window_start_date: string;
  window_end_date: string;
  forecast: number[];
}

export interface ForecastApiErrorBody {
  detail?: string;
}

export interface LivePricePoint {
  date: string;
  open?: number | null;
  high?: number | null;
  low?: number | null;
  close?: number | null;
  trade_volume?: number | null;
  share_volume?: number | null;
  turnover?: number | null;
  exchange_rate?: number | null;
}

export interface LivePredictionResponse {
  company_id: string;
  window_start_date: string;
  window_end_date: string;
  rows_used_for_scaling: number;
  real_rows_provided: number;
  synthetic_rows_in_window: number;
  last_close_price: number;
  forecast: number[];
  predicted_price: number[];
  price_history: LivePricePoint[];
}
