import { Injectable, Inject, NotFoundException } from "@nestjs/common";
import { eq, and, desc, gte } from "drizzle-orm";
import { DB_TOKEN } from "../db/db.module";
import type { Db } from "../db";
import { users, sessions, claims, evidenceFrames } from "../db/schema";
import type { UpdateClaimDto } from "./dto/update-claim.dto";

type RiskBand = "A" | "B" | "C" | "D" | "F";
type DriverTrend = "improving" | "stable" | "declining";

function scoreToRiskBand(avg: number): RiskBand {
  if (avg < 0.2) return "A";
  if (avg < 0.35) return "B";
  if (avg < 0.5) return "C";
  if (avg < 0.7) return "D";
  return "F";
}

function bandToPremium(band: RiskBand): number {
  const map: Record<RiskBand, number> = { A: 0.85, B: 0.92, C: 1.0, D: 1.12, F: 1.25 };
  return map[band];
}

@Injectable()
export class InsurerService {
  constructor(@Inject(DB_TOKEN) private db: Db) {}

  // ---------- Fleet Drivers ----------

  async getDrivers(companyId: string) {
    // Get all drivers belonging to this company's fleet
    // For now: all drivers (in production filter by company assignment)
    const drivers = await this.db
      .select()
      .from(users)
      .where(eq(users.role, "driver"));

    const now = Date.now();
    const weekAgo = new Date(now - 7 * 86_400_000);
    const monthAgo = new Date(now - 30 * 86_400_000);

    const enriched = await Promise.all(
      drivers.map(async (d) => {
        const allSessions = await this.db
          .select()
          .from(sessions)
          .where(eq(sessions.driverId, d.id))
          .orderBy(desc(sessions.startedAt));

        const recentSessions = allSessions.slice(0, 7);
        const avgScore =
          allSessions.length > 0
            ? allSessions.reduce((a, s) => a + (s.avgScore ?? 0), 0) / allSessions.length
            : 0;
        const peakScore = allSessions.reduce((a, s) => Math.max(a, s.peakScore ?? 0), 0);
        const totalHours = allSessions.reduce((a, s) => a + (s.durationS ?? 0) / 3600, 0);

        const weekSessions = allSessions.filter((s) => s.startedAt >= weekAgo);
        const monthSessions = allSessions.filter((s) => s.startedAt >= monthAgo);

        const l3Week  = weekSessions.reduce((a, s) => a + (s.alertCount3 ?? 0), 0);
        const l3Month = monthSessions.reduce((a, s) => a + (s.alertCount3 ?? 0), 0);

        const scoreHistory = recentSessions.map((s) => s.avgScore ?? 0);

        // Trend: compare first half vs second half of last 6 sessions
        let trend: DriverTrend = "stable";
        if (scoreHistory.length >= 4) {
          const half = Math.floor(scoreHistory.length / 2);
          const older = scoreHistory.slice(half).reduce((a, v) => a + v, 0) / (scoreHistory.length - half);
          const newer = scoreHistory.slice(0, half).reduce((a, v) => a + v, 0) / half;
          if (newer - older < -0.05) trend = "improving";
          else if (newer - older > 0.05) trend = "declining";
        }

        const riskBand = scoreToRiskBand(avgScore);

        return {
          id:                  d.id,
          name:                d.name,
          email:               d.email,
          licenseNo:           d.licenseNo ?? "",
          vehicle:             d.vehicle ?? "",
          riskBand,
          avgScore:            Math.round(avgScore * 1000) / 1000,
          peakScore:           Math.round(peakScore * 1000) / 1000,
          totalSessions:       allSessions.length,
          totalHoursMonitored: Math.round(totalHours * 10) / 10,
          l3AlertsThisWeek:    l3Week,
          l3AlertsThisMonth:   l3Month,
          premiumAdjustment:   bandToPremium(riskBand),
          lastSessionDate:     allSessions[0]?.startedAt.toISOString() ?? new Date().toISOString(),
          trend,
          scoreHistory,
        };
      }),
    );

    return enriched;
  }

  async getDriver(driverId: string) {
    const [driver] = await this.db
      .select()
      .from(users)
      .where(and(eq(users.id, driverId), eq(users.role, "driver")))
      .limit(1);

    if (!driver) throw new NotFoundException("Driver not found");

    // Re-use fleet builder but for single driver
    const all = await this.getDrivers(""); // companyId not filtered yet
    return all.find((d) => d.id === driverId) ?? null;
  }

  // ---------- Fleet Summary ----------

  async getFleetSummary(companyId: string) {
    const drivers = await this.getDrivers(companyId);
    const now = Date.now();
    const weekAgo = new Date(now - 7 * 86_400_000);

    const bandScore: Record<RiskBand, number> = { A: 0, B: 1, C: 2, D: 3, F: 4 };
    const dist: Record<RiskBand, number> = { A: 0, B: 0, C: 0, D: 0, F: 0 };
    let totalL3 = 0;
    let totalPremium = 0;

    for (const d of drivers) {
      dist[d.riskBand as RiskBand] = (dist[d.riskBand as RiskBand] ?? 0) + 1;
      totalL3      += d.l3AlertsThisWeek;
      totalPremium += d.premiumAdjustment;
    }

    const avgBandScore =
      drivers.length > 0
        ? drivers.reduce((a, d) => a + bandScore[d.riskBand as RiskBand], 0) / drivers.length
        : 1;

    const fleetRiskBand: RiskBand =
      avgBandScore < 0.8 ? "A"
      : avgBandScore < 1.5 ? "B"
      : avgBandScore < 2.5 ? "C"
      : avgBandScore < 3.5 ? "D"
      : "F";

    const activeDriverIds = new Set<string>();
    const recentSessions = await this.db
      .select({ driverId: sessions.driverId })
      .from(sessions)
      .where(gte(sessions.startedAt, weekAgo));
    recentSessions.forEach((s) => activeDriverIds.add(s.driverId));

    return {
      companyName:           "Himalayan Bus & Insurance — Nepal",
      totalDrivers:          drivers.length,
      activeThisWeek:        activeDriverIds.size,
      fleetRiskBand,
      avgPremiumAdjustment:  drivers.length > 0 ? Math.round((totalPremium / drivers.length) * 1000) / 1000 : 1,
      l3AlertsThisWeek:      totalL3,
      l3AlertsChangePercent: 0,
      bandDistribution:      dist,
    };
  }

  // ---------- Claims ----------

  async getClaims(companyId: string) {
    const rows = await this.db
      .select({
        claim:  claims,
        driver: { name: users.name, vehicle: users.vehicle },
      })
      .from(claims)
      .leftJoin(users, eq(claims.driverId, users.id))
      .orderBy(desc(claims.incidentDate));

    return rows.map(({ claim, driver }) => ({
      id:                       claim.id,
      driverId:                 claim.driverId,
      driverName:               driver?.name ?? "",
      vehicle:                  driver?.vehicle ?? claim.vehicle ?? "",
      incidentDate:             claim.incidentDate.toISOString(),
      reportedDate:             claim.reportedDate.toISOString(),
      type:                     claim.type,
      status:                   claim.status,
      amountNPR:                claim.amountNpr,
      alertLevelAtIncident:     claim.alertLevelAtIncident ?? 0,
      compositeScoreAtIncident: claim.compositeScoreAtIncident ?? 0,
      evidenceFrames:           0,
      notes:                    claim.notes ?? "",
    }));
  }

  async getClaim(claimId: string) {
    const [row] = await this.db
      .select({
        claim:  claims,
        driver: { name: users.name, vehicle: users.vehicle, licenseNo: users.licenseNo },
      })
      .from(claims)
      .leftJoin(users, eq(claims.driverId, users.id))
      .where(eq(claims.id, claimId))
      .limit(1);

    if (!row) throw new NotFoundException("Claim not found");

    const frames = await this.db
      .select()
      .from(evidenceFrames)
      .where(eq(evidenceFrames.claimId, claimId))
      .orderBy(evidenceFrames.capturedAt);

    return {
      id:                       row.claim.id,
      driverId:                 row.claim.driverId,
      driverName:               row.driver?.name ?? "",
      vehicle:                  row.driver?.vehicle ?? row.claim.vehicle ?? "",
      incidentDate:             row.claim.incidentDate.toISOString(),
      reportedDate:             row.claim.reportedDate.toISOString(),
      type:                     row.claim.type,
      status:                   row.claim.status,
      amountNPR:                row.claim.amountNpr,
      alertLevelAtIncident:     row.claim.alertLevelAtIncident ?? 0,
      compositeScoreAtIncident: row.claim.compositeScoreAtIncident ?? 0,
      evidenceFrames:           frames.length,
      notes:                    row.claim.notes ?? "",
      frames: frames.map((f) => ({
        frameId:               f.frameId,
        capturedAt:            f.capturedAt.toISOString(),
        secondsBeforeIncident: f.secondsBeforeIncident,
        alertLevel:            f.alertLevel,
        compositeScore:        f.compositeScore ?? 0,
        ear:                   f.ear ?? 0,
        perclos:               f.perclos ?? 0,
        hash:                  f.hash,
      })),
    };
  }

  async updateClaimStatus(claimId: string, dto: UpdateClaimDto) {
    const [existing] = await this.db.select().from(claims).where(eq(claims.id, claimId)).limit(1);
    if (!existing) throw new NotFoundException("Claim not found");
    await this.db.update(claims).set({ status: dto.status } as Partial<typeof claims.$inferInsert>).where(eq(claims.id, claimId));
    return this.getClaim(claimId);
  }
}
