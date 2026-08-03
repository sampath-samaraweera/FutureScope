import { ApiError } from './client';
import type {
  BacktestResponse,
  LiveTodayResponse,
  ModelInfoResponse,
  PortfolioApiErrorBody,
} from './portfolioTypes';

const BASE_URL = import.meta.env.VITE_PORTFOLIO_API_BASE_URL ?? 'http://localhost:8002';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = (await res.json()) as PortfolioApiErrorBody;
      if (body.detail) detail = body.detail;
    } catch {
      // response had no JSON body
    }
    throw new ApiError(res.status, detail);
  }
  return res.json() as Promise<T>;
}

export function getPortfolioModelInfo(): Promise<ModelInfoResponse> {
  return request<ModelInfoResponse>('/model-info');
}

export function getPortfolioBacktest(): Promise<BacktestResponse> {
  return request<BacktestResponse>('/backtest');
}

export function getPortfolioLiveToday(): Promise<LiveTodayResponse> {
  return request<LiveTodayResponse>('/live/today');
}
