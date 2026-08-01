import type {
  ApiErrorBody,
  CompanySnapshot,
  CompanySummary,
  ModelMetrics,
  PredictRequest,
  PredictResponse,
} from './types';

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000';

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = 'ApiError';
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = (await res.json()) as ApiErrorBody;
      if (body.detail) detail = body.detail;
    } catch {
      // response had no JSON body
    }
    throw new ApiError(res.status, detail);
  }
  return res.json() as Promise<T>;
}

export function predict(payload: PredictRequest): Promise<PredictResponse> {
  return request<PredictResponse>('/predict', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function getCompanies(): Promise<CompanySummary[]> {
  return request<CompanySummary[]>('/companies');
}

export function getCompanySnapshot(ticker: string): Promise<CompanySnapshot> {
  return request<CompanySnapshot>(`/companies/${encodeURIComponent(ticker)}`);
}

export function getModelMetrics(): Promise<ModelMetrics> {
  return request<ModelMetrics>('/model-metrics');
}

export function plotUrl(path?: string): string | undefined {
  if (!path) return undefined;
  return `${BASE_URL}${path}`;
}
