import { ApiError } from './client';
import type { DatasetPredictionResponse, ForecastApiErrorBody, LivePredictionResponse } from './forecastTypes';

const BASE_URL = import.meta.env.VITE_FORECAST_API_BASE_URL ?? 'http://localhost:8001';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = (await res.json()) as ForecastApiErrorBody;
      if (body.detail) detail = body.detail;
    } catch {
      // response had no JSON body
    }
    throw new ApiError(res.status, detail);
  }
  return res.json() as Promise<T>;
}

export function getForecastCompanies(): Promise<string[]> {
  return request<{ companies: string[] }>('/companies').then((r) => r.companies);
}

export function getForecastCompanyDates(companyId: string): Promise<string[]> {
  return request<{ dates: string[] }>(`/companies/${encodeURIComponent(companyId)}/dates`).then(
    (r) => r.dates,
  );
}

export function predictFromDataset(
  companyId: string,
  endDate?: string,
): Promise<DatasetPredictionResponse> {
  return request<DatasetPredictionResponse>('/predict-from-dataset', {
    method: 'POST',
    body: JSON.stringify({ company_id: companyId, end_date: endDate || undefined }),
  });
}

export function predictLive(symbol: string): Promise<LivePredictionResponse> {
  return request<LivePredictionResponse>(`/predict-live/${encodeURIComponent(symbol)}`);
}
