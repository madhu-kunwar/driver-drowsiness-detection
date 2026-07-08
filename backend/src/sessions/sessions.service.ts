import { Injectable, Inject, NotFoundException, ForbiddenException } from "@nestjs/common";
import { eq, and, desc, sql, gte } from "drizzle-orm";
import { DB_TOKEN } from "../db/db.module";
import type { Db } from "../db";
import { sessions, alertEvents } from "../db/schema";
import type { CompleteSessionDto } from "./dto/complete-session.dto";

@Injectable()
export class SessionsService {
  constructor(@Inject(DB_TOKEN) private db: Db) {}

  async startSession(driverId: string): Promise<{ id: string; startedAt: string }> {
    const [session] = await this.db
      .insert(sessions)
      .values({ driverId, startedAt: new Date() })
      .returning({ id: sessions.id, startedAt: sessions.startedAt });

    return { id: session.id, startedAt: session.startedAt.toISOString() };
  }

  async completeSession(id: string, driverId: string, dto: CompleteSessionDto) {
    const [existing] = await this.db.select().from(sessions).where(eq(sessions.id, id)).limit(1);
    if (!existing) throw new NotFoundException("Session not found");
    if (existing.driverId !== driverId) throw new ForbiddenException();

    await this.db.update(sessions).set({
      endedAt:           new Date(dto.endedAt),
      durationS:         dto.durationS,
      avgScore:          dto.avgScore,
      peakScore:         dto.peakScore,
      riskBand:          dto.riskBand,
      premiumAdjustment: dto.premiumAdjustment,
      alertCount0:       dto.alertCount0,
      alertCount1:       dto.alertCount1,
      alertCount2:       dto.alertCount2,
      alertCount3:       dto.alertCount3,
    } as Partial<typeof sessions.$inferInsert>).where(eq(sessions.id, id));

    if (dto.events && dto.events.length > 0) {
      await this.db.insert(alertEvents).values(
        dto.events.map((e) => ({
          sessionId: id,
          timestamp: new Date(e.timestamp),
          level:     e.level,
          score:     e.score,
          ear:       e.ear,
          perclos:   e.perclos,
          mar:       e.mar,
        })),
      );
    }

    return this.findOne(id, driverId);
  }

  async findAll(driverId: string) {
    const rows = await this.db
      .select()
      .from(sessions)
      .where(eq(sessions.driverId, driverId))
      .orderBy(desc(sessions.startedAt));

    return rows.map(this.toSessionShape);
  }

  async findOne(id: string, driverId: string) {
    const [session] = await this.db
      .select()
      .from(sessions)
      .where(eq(sessions.id, id))
      .limit(1);

    if (!session) throw new NotFoundException("Session not found");
    if (session.driverId !== driverId) throw new ForbiddenException();

    const events = await this.db
      .select()
      .from(alertEvents)
      .where(eq(alertEvents.sessionId, id))
      .orderBy(alertEvents.timestamp);

    return {
      ...this.toSessionShape(session),
      events: events.map((e) => ({
        timestamp: e.timestamp.toISOString(),
        level:     e.level,
        score:     e.score,
        ear:       e.ear,
        perclos:   e.perclos,
        mar:       e.mar,
      })),
    };
  }

  async getHeatmap(driverId: string): Promise<number[][]> {
    // 7 days × 24 hours grid of avg composite score
    const since = new Date(Date.now() - 30 * 24 * 3600 * 1000);
    const rows = await this.db
      .select()
      .from(sessions)
      .where(and(eq(sessions.driverId, driverId), gte(sessions.startedAt, since)));

    // Build 7×24 grid initialized to 0
    const grid: number[][] = Array.from({ length: 7 }, () => new Array(24).fill(0));
    const counts: number[][] = Array.from({ length: 7 }, () => new Array(24).fill(0));

    for (const s of rows) {
      const dow  = s.startedAt.getDay();
      const hour = s.startedAt.getHours();
      grid[dow][hour]   += s.avgScore ?? 0;
      counts[dow][hour] += 1;
    }

    return grid.map((row, d) =>
      row.map((sum, h) => (counts[d][h] > 0 ? sum / counts[d][h] : 0)),
    );
  }

  async getAlertFrequency(driverId: string) {
    const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    const since = new Date(Date.now() - 7 * 24 * 3600 * 1000);

    const rows = await this.db
      .select()
      .from(sessions)
      .where(and(eq(sessions.driverId, driverId), gte(sessions.startedAt, since)));

    const buckets: Record<string, { l1: number; l2: number; l3: number }> = {};
    for (const d of days) buckets[d] = { l1: 0, l2: 0, l3: 0 };

    for (const s of rows) {
      const idx = (s.startedAt.getDay() + 6) % 7; // Mon=0
      const day = days[idx];
      buckets[day].l1 += s.alertCount1 ?? 0;
      buckets[day].l2 += s.alertCount2 ?? 0;
      buckets[day].l3 += s.alertCount3 ?? 0;
    }

    return days.map((day) => ({ day, ...buckets[day] }));
  }

  private toSessionShape(s: typeof sessions.$inferSelect) {
    return {
      id:                s.id,
      startedAt:         s.startedAt.toISOString(),
      endedAt:           s.endedAt?.toISOString() ?? null,
      durationS:         s.durationS ?? 0,
      avgScore:          s.avgScore ?? 0,
      peakScore:         s.peakScore ?? 0,
      riskBand:          s.riskBand ?? "B",
      premiumAdjustment: s.premiumAdjustment ?? 1,
      alertCount: {
        0: s.alertCount0 ?? 0,
        1: s.alertCount1 ?? 0,
        2: s.alertCount2 ?? 0,
        3: s.alertCount3 ?? 0,
      },
    };
  }
}
