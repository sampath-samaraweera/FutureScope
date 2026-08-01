import type { Category } from '../api/types';

/**
 * Client-side preview of the backend's category auto-detection
 * (classify_category_v2 in backend/app/category.py), so the form can show
 * a live "detected category" without a network round trip. The backend
 * remains authoritative: this is UI preview only, and requests omit
 * `category` unless the user explicitly overrides it.
 */
const RE_CAPITAL =
  /\b(ipos?|rights issues?|buybacks?|buy-backs?|debentures?|acquisitions?|acquires?|mergers?|takeovers?|stakes?|share issues?|capital raise|bond issues?|divests?|divestiture)\b/i;
const RE_EARNINGS =
  /\b(profits?|profitability|pat|pbt|net income|revenues?|eps|dividends?|earnings?|financial results?|interim results?|quarterly results?|annual results?|q[1-4]|1h|2h|9m|first quarter|second quarter|third quarter|fourth quarter|posts? rs|records? rs|reports? rs)\b/i;
const RE_MACRO =
  /\b(interest rate|policy rate|inflation|deflation|gdp|imf|world bank|central bank|cbsl|monetary|rupee|forex|reserves|tax|budget|treasury|bond yield|exchange rate|debt restructur\w*|recession|economy|economic)\b/i;

function stripSource(headline: string): string {
  const idx = headline.lastIndexOf(' - ');
  return idx >= 0 ? headline.slice(0, idx).trim() : headline.trim();
}

export function classifyCategoryPreview(headline: string, isCompanySpecific: boolean): Category {
  const body = stripSource(headline);
  if (isCompanySpecific && (RE_CAPITAL.test(body) || RE_EARNINGS.test(body))) {
    return 'company_event';
  }
  if (RE_MACRO.test(body)) {
    return 'macro';
  }
  return 'general';
}

export const CATEGORY_LABELS: Record<Category, string> = {
  company_event: 'Company event',
  macro: 'Macro / economy',
  general: 'General news',
};
