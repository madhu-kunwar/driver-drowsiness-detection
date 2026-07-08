import { create } from "zustand";
import type { FleetDriver, Claim, FleetSummary, RiskBand, DriverTrend, EvidenceFrame } from "@/types/insurer";

/* ── Seeded pseudo-random helpers ───────────────────────────── */
function seededRng(seed: string): () => number {
  let v = 0;
  for (const c of seed) v = ((v * 31) + c.charCodeAt(0)) & 0x7fffffff;
  return () => {
    v = ((v * 1664525) + 1013904223) & 0x7fffffff;
    return v / 0x7fffffff;
  };
}

function seededHex(seed: string): string {
  const rng = seededRng(seed + "-hash");
  let result = "";
  while (result.length < 64) {
    result += Math.floor(rng() * 0xffffffff).toString(16).padStart(8, "0");
  }
  return result.slice(0, 64);
}

function generateFrames(
  claimId: string,
  count: number,
  level: 0 | 1 | 2 | 3,
  incidentDate: string
): EvidenceFrame[] {
  const incident = new Date(incidentDate).getTime();
  const windowS  = 300;

  return Array.from({ length: count }, (_, i) => {
    const progress      = count > 1 ? i / (count - 1) : 1;
    const secondsBefore = Math.round((1 - progress) * windowS);
    const capturedAt    = new Date(incident - secondsBefore * 1000).toISOString();

    const frameLevel: 0 | 1 | 2 | 3 =
      secondsBefore > 180 ? 0
      : secondsBefore > 90  ? 1
      : secondsBefore > 30  ? (Math.min(level, 2) as 0 | 1 | 2 | 3)
      : level;

    const rng = seededRng(`${claimId}-f${i}`);

    const compositeScore = Math.max(0.03, Math.min(0.97,
      0.05 + progress * (level === 3 ? 0.82 : level === 2 ? 0.58 : level === 1 ? 0.36 : 0.15)
      + (rng() - 0.5) * 0.06
    ));
    const ear = Math.max(0.08, Math.min(0.44,
      0.38 - progress * (level >= 2 ? 0.26 : level >= 1 ? 0.14 : 0.04)
      + (rng() - 0.5) * 0.02
    ));
    const perclos = Math.max(0, Math.min(0.82,
      progress * (level === 3 ? 0.68 : level === 2 ? 0.44 : level === 1 ? 0.22 : 0.06)
      + rng() * 0.04
    ));

    return {
      frameId: `${claimId}-F${String(i + 1).padStart(3, "0")}`,
      capturedAt,
      secondsBeforeIncident: secondsBefore,
      alertLevel: frameLevel,
      compositeScore,
      ear,
      perclos,
      hash: seededHex(`${claimId}-f${i}`),
    };
  });
}

/* ── Mock data ──────────────────────────────────────────────── */
type DriverSeed = {
  name: string; vehicle: string; band: RiskBand;
  avg: number; trend: DriverTrend;
};

const SEEDS: DriverSeed[] = [
  { name: "Ram Bahadur Thapa",    vehicle: "Toyota Hiace · BA 1 KHA 234",   band: "A", avg: 0.11, trend: "stable" },
  { name: "Sita Sharma",          vehicle: "Tata Prima · BA 2 CHA 891",     band: "A", avg: 0.08, trend: "improving" },
  { name: "Bikash Rai",           vehicle: "Ashok Leyland · BA 3 JHA 512",  band: "A", avg: 0.13, trend: "stable" },
  { name: "Kamala Gurung",        vehicle: "Mahindra Bolero · BA 1 TA 334", band: "A", avg: 0.09, trend: "improving" },
  { name: "Dipendra Magar",       vehicle: "Toyota Hiace · BA 4 TA 201",    band: "A", avg: 0.12, trend: "stable" },
  { name: "Suresh Adhikari",      vehicle: "Swaraj Mazda · BA 2 NA 775",    band: "B", avg: 0.22, trend: "stable" },
  { name: "Binita Karki",         vehicle: "Toyota Hiace · BA 1 PA 488",    band: "B", avg: 0.19, trend: "improving" },
  { name: "Rajan Tamang",         vehicle: "Tata Prima · BA 3 BA 901",      band: "B", avg: 0.25, trend: "stable" },
  { name: "Puja Shrestha",        vehicle: "Ashok Leyland · BA 2 MA 623",   band: "B", avg: 0.21, trend: "improving" },
  { name: "Gopal Dhakal",         vehicle: "Toyota Hiace · BA 4 YA 334",    band: "B", avg: 0.27, trend: "stable" },
  { name: "Anita Bhandari",       vehicle: "Mahindra Bolero · BA 1 LA 119", band: "B", avg: 0.18, trend: "improving" },
  { name: "Nabin Poudel",         vehicle: "Swaraj Mazda · BA 3 WA 556",    band: "B", avg: 0.24, trend: "stable" },
  { name: "Priya Maharjan",       vehicle: "Toyota Hiace · BA 2 KHA 002",   band: "B", avg: 0.23, trend: "declining" },
  { name: "Tek Bahadur Limbu",    vehicle: "Tata Prima · BA 1 GA 788",      band: "C", avg: 0.38, trend: "stable" },
  { name: "Mina Thapa",           vehicle: "Toyota Hiace · BA 4 SHA 344",   band: "C", avg: 0.41, trend: "declining" },
  { name: "Santosh Khadka",       vehicle: "Ashok Leyland · BA 2 DA 901",   band: "C", avg: 0.36, trend: "stable" },
  { name: "Sabina Yadav",         vehicle: "Swaraj Mazda · BA 3 RA 112",    band: "C", avg: 0.43, trend: "improving" },
  { name: "Bijay Basnet",         vehicle: "Mahindra Bolero · BA 1 SA 665", band: "C", avg: 0.39, trend: "stable" },
  { name: "Laxmi Tamang",         vehicle: "Toyota Hiace · BA 2 HA 230",    band: "C", avg: 0.44, trend: "declining" },
  { name: "Arjun Chaudhary",      vehicle: "Tata Prima · BA 4 KSA 778",     band: "D", avg: 0.58, trend: "declining" },
  { name: "Sharmila Ghimire",     vehicle: "Toyota Hiace · BA 1 TSA 334",   band: "D", avg: 0.62, trend: "stable" },
  { name: "Roshan Acharya",       vehicle: "Ashok Leyland · BA 3 NA 556",   band: "D", avg: 0.61, trend: "declining" },
  { name: "Meena Joshi",          vehicle: "Swaraj Mazda · BA 2 THA 001",   band: "D", avg: 0.64, trend: "declining" },
  { name: "Kamal KC",             vehicle: "Toyota Hiace · BA 4 DA 899",    band: "F", avg: 0.81, trend: "declining" },
];

function generateFleet(): FleetDriver[] {
  const PREMIUM: Record<RiskBand, number> = { A: 0.85, B: 0.92, C: 1.00, D: 1.12, F: 1.25 };
  const L3_WEEK: Record<RiskBand, number> = { A: 0, B: 0, C: 1, D: 3, F: 8 };

  return SEEDS.map((s, i) => {
    const sessions = 8 + Math.floor(Math.random() * 20);
    const hours    = sessions * (0.5 + Math.random() * 1.5);
    const lastDays = Math.floor(Math.random() * 7);
    const histLen  = 7;
    const base     = s.avg;
    const history  = Array.from({ length: histLen }, (_, j) => {
      const jitter = (Math.random() - 0.5) * 0.06;
      const trend  = s.trend === "improving" ? -0.01 * j : s.trend === "declining" ? 0.01 * j : 0;
      return Math.max(0.05, Math.min(0.95, base + jitter + trend));
    });

    return {
      id: `driver-${String(i + 1).padStart(3, "0")}`,
      name: s.name,
      email: s.name.toLowerCase().replace(/\s+/g, ".") + "@fleet.hbi",
      licenseNo: `NP-D-${4800 + i}`,
      vehicle: s.vehicle,
      riskBand: s.band,
      avgScore: Math.round((base + (Math.random() - 0.5) * 0.03) * 1000) / 1000,
      peakScore: Math.min(0.98, base + 0.18 + Math.random() * 0.08),
      totalSessions: sessions,
      totalHoursMonitored: Math.round(hours * 10) / 10,
      l3AlertsThisWeek: L3_WEEK[s.band] + (s.band === "D" || s.band === "F" ? Math.floor(Math.random() * 3) : 0),
      l3AlertsThisMonth: L3_WEEK[s.band] * 4 + Math.floor(Math.random() * 5),
      premiumAdjustment: PREMIUM[s.band],
      lastSessionDate: new Date(Date.now() - lastDays * 86_400_000).toISOString(),
      trend: s.trend,
      scoreHistory: history,
    };
  });
}

function generateClaims(drivers: FleetDriver[]): Claim[] {
  const riskDrivers = drivers.filter((d) => d.riskBand === "C" || d.riskBand === "D" || d.riskBand === "F");
  const types  = ["fatigue-related", "collision", "other"] as const;
  const statuses = ["open", "investigating", "resolved", "denied"] as const;

  return riskDrivers.slice(0, 8).map((d, i) => {
    const daysAgo = 3 + i * 7;
    const incidentDate = new Date(Date.now() - daysAgo * 86_400_000).toISOString();
    const reportedDate = new Date(Date.now() - (daysAgo - 2) * 86_400_000).toISOString();
    const type = types[i % 3];
    const status = statuses[i % 4];
    const level = d.riskBand === "F" ? 3 : d.riskBand === "D" ? 2 : 1;

    const claimId      = `CLM-2026-${String(1001 + i)}`;
    const frameCount   = level === 3 ? 48 + i * 6 : level === 2 ? 18 + i * 3 : 5;
    const rngNotes     = seededRng(`notes-${claimId}`);
    const minsBefore   = Math.ceil(rngNotes() * 8) || 1;

    return {
      id: claimId,
      driverId: d.id,
      driverName: d.name,
      vehicle: d.vehicle,
      incidentDate,
      reportedDate,
      type,
      status,
      amountNPR: 50_000 + i * 35_000,
      alertLevelAtIncident: level as 0 | 1 | 2 | 3,
      compositeScoreAtIncident: Math.min(0.97, d.avgScore + 0.2 * rngNotes()),
      evidenceFrames: frameCount,
      notes: type === "fatigue-related"
        ? `Level ${level} drowsiness alert recorded ${minsBefore} min before incident.`
        : type === "collision"
        ? "Minor collision reported. DMS data shows elevated composite score."
        : "Non-fatigue incident. Evidence package generated for records.",
      frames: generateFrames(claimId, frameCount, level as 0 | 1 | 2 | 3, incidentDate),
    };
  });
}

function buildSummary(drivers: FleetDriver[]): FleetSummary {
  const dist = drivers.reduce((acc, d) => {
    acc[d.riskBand] = (acc[d.riskBand] ?? 0) + 1;
    return acc;
  }, {} as Record<RiskBand, number>);

  const totalL3 = drivers.reduce((a, d) => a + d.l3AlertsThisWeek, 0);
  const avgPremium =
    drivers.reduce((a, d) => a + d.premiumAdjustment, 0) / drivers.length;

  const bandScore = { A: 0, B: 1, C: 2, D: 3, F: 4 };
  const avgBandScore =
    drivers.reduce((a, d) => a + bandScore[d.riskBand], 0) / drivers.length;
  const fleetRiskBand =
    avgBandScore < 0.8 ? "A" : avgBandScore < 1.5 ? "B" : avgBandScore < 2.5 ? "C" : avgBandScore < 3.5 ? "D" : "F";

  return {
    companyName: "Himalayan Bus & Insurance — Nepal",
    totalDrivers: drivers.length,
    activeThisWeek: drivers.filter(
      (d) => new Date(d.lastSessionDate) > new Date(Date.now() - 7 * 86_400_000)
    ).length,
    fleetRiskBand: fleetRiskBand as RiskBand,
    avgPremiumAdjustment: Math.round(avgPremium * 1000) / 1000,
    l3AlertsThisWeek: totalL3,
    l3AlertsChangePercent: -12, // mock: 12% fewer than last week
    bandDistribution: Object.assign({ A: 0, B: 0, C: 0, D: 0, F: 0 }, dist) as Record<RiskBand, number>,
  };
}

/* ── Store ──────────────────────────────────────────────────── */
interface InsurerStore {
  drivers: FleetDriver[];
  claims: Claim[];
  summary: FleetSummary | null;
  loaded: boolean;
  load: () => void;
  getDriver: (id: string) => FleetDriver | undefined;
  getClaim: (id: string) => Claim | undefined;
}

export const useInsurerStore = create<InsurerStore>((set, get) => ({
  drivers: [],
  claims: [],
  summary: null,
  loaded: false,

  load: () => {
    if (get().loaded) return;
    const drivers = generateFleet();
    const claims  = generateClaims(drivers);
    const summary = buildSummary(drivers);
    set({ drivers, claims, summary, loaded: true });
  },

  getDriver: (id) => get().drivers.find((d) => d.id === id),
  getClaim:  (id) => get().claims.find((c) => c.id === id),
}));
