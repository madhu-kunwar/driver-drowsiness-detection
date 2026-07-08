export type RiskBand = "A" | "B" | "C" | "D" | "F";
export type ClaimStatus = "open" | "investigating" | "resolved" | "denied";
export type ClaimType = "fatigue-related" | "collision" | "other";
export type DriverTrend = "improving" | "stable" | "declining";

export interface FleetDriver {
  id: string;
  name: string;
  email: string;
  licenseNo: string;
  vehicle: string;
  riskBand: RiskBand;
  avgScore: number;          // 0-1
  peakScore: number;
  totalSessions: number;
  totalHoursMonitored: number;
  l3AlertsThisWeek: number;
  l3AlertsThisMonth: number;
  premiumAdjustment: number; // 0.85 = −15%, 1.12 = +12%
  lastSessionDate: string;   // ISO
  trend: DriverTrend;
  scoreHistory: number[];    // last 7 sessions avg scores
}

export interface EvidenceFrame {
  frameId: string;
  capturedAt: string;
  secondsBeforeIncident: number;
  alertLevel: 0 | 1 | 2 | 3;
  compositeScore: number;
  ear: number;
  perclos: number;
  hash: string;
}

export interface Claim {
  id: string;
  driverId: string;
  driverName: string;
  vehicle: string;
  incidentDate: string;
  reportedDate: string;
  type: ClaimType;
  status: ClaimStatus;
  amountNPR: number;
  alertLevelAtIncident: 0 | 1 | 2 | 3;
  compositeScoreAtIncident: number;
  evidenceFrames: number;
  notes: string;
  frames: EvidenceFrame[];
}

export interface FleetSummary {
  companyName: string;
  totalDrivers: number;
  activeThisWeek: number;
  fleetRiskBand: RiskBand;
  avgPremiumAdjustment: number;
  l3AlertsThisWeek: number;
  l3AlertsChangePercent: number;
  bandDistribution: Record<RiskBand, number>;
}
