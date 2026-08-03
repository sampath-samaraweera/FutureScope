// Real headlines from the model's own held-out test split (never seen during
// training), spanning a deliberate range of actual historical outcomes --
// near-zero, large positive, large negative, and two moderate ones. The
// model predicts magnitude only (direction is unlearnable, see the
// Validation page), so `actualCarPct` here is shown purely as "what really
// happened," a reference the model itself never sees or predicts.
export interface ExampleHeadline {
  headline: string;
  isCompanySpecific: boolean;
  companyTicker?: string;
  actualCarPct: number; // signed, real historical outcome (decimal, e.g. 0.07 = +7%)
}

export const EXAMPLE_HEADLINES: ExampleHeadline[] = [
  {
    headline:
      'NDB Bank partners Gavinro International to expand access to electric passenger and commercial vehicle financing - Daily FT',
    isCompanySpecific: true,
    companyTicker: 'NDB.N0000',
    actualCarPct: -0.0000623532,
  },
  {
    headline: 'Pan Asia Bank ups 9-month net profit by 78% to Rs. 2.22 b - Daily FT',
    isCompanySpecific: true,
    companyTicker: 'PABC.N0000',
    actualCarPct: 0.0702943617,
  },
  {
    headline: "NTB secures approval to acquire HSBC Sri Lanka's Retail Banking operations - Retail Banker International",
    isCompanySpecific: true,
    companyTicker: 'NTB.N0000',
    actualCarPct: -0.0883887671,
  },
  {
    headline: 'Sri Lanka keeps policy rate at 8.0-pct amid stable prices - EconomyNext',
    isCompanySpecific: false,
    actualCarPct: -0.0078,
  },
  {
    headline: "ComBank crowned ADB's Leading Partner Bank in Sri Lanka for fourth year - Daily FT",
    isCompanySpecific: true,
    companyTicker: 'COMB.N0000',
    actualCarPct: -0.0135124240,
  },
];
