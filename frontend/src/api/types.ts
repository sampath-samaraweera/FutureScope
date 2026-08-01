export type Category = 'company_event' | 'macro' | 'general';

export interface PredictRequest {
  headline: string;
  category?: Category;
  is_company_specific: boolean;
  company_ticker?: string;
  days_since_publication?: number;
  n_articles?: number;
  is_local_source?: boolean;
  include_sentiment?: boolean;
}

export type VolatilitySource = 'live' | 'market_default';

export interface PredictResponse {
  predicted_car_magnitude_pct: number;
  is_likely_significant: boolean;
  significance_cutoff_pct: number;
  magnitude_note: string;
  sentiment_label_UNVALIDATED?: string | null;
  sentiment_score_UNVALIDATED?: number | null;
  sentiment_note?: string | null;
  resolved_category: Category;
  resolved_volatility_10d: number;
  volatility_source: VolatilitySource;
  ticker_used?: string | null;
  category_mismatch_warning?: string | null;
  ticker_mismatch_warning?: string | null;
}

export interface CompanySummary {
  ticker: string;
  name: string;
  price?: number | null;
  change_pct?: number | null;
}

export interface PriceHistoryPoint {
  date: string;
  close: number;
}

export interface CompanySnapshot {
  ticker: string;
  name: string;
  price?: number | null;
  previous_close?: number | null;
  change_pct?: number | null;
  volatility_10d?: number | null;
  volatility_available: boolean;
  volatility_error?: string | null;
  price_history: PriceHistoryPoint[];
  price_history_available: boolean;
  price_history_error?: string | null;
}

export interface ModelMetrics {
  _placeholder?: boolean;
  note?: string;
  n_test_samples?: number | null;
  rmse?: number | null;
  r2?: number | null;
  pearson?: number | null;
  spearman?: number | null;
  pr_auc?: number | null;
  pr_auc_baseline?: number | null;
  significance_cutoff_pct?: number | null;
  plots?: {
    predicted_vs_actual?: string;
    pr_curve?: string;
  };
  [key: string]: unknown;
}

export interface ApiErrorBody {
  detail?: string;
}
