import "reflect-metadata";
import * as dotenv from "dotenv";
dotenv.config();

import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as bcrypt from "bcryptjs";
import * as schema from "./schema";

// Drizzle 0.38 omits nullable cols from $inferInsert under strictNullChecks:false
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const v = (d: any) => d as any;

// ── Helpers ───────────────────────────────────────────────────────

function seededRng(seed: string): () => number {
  let h = 0;
  for (const c of seed) h = ((h * 31) + c.charCodeAt(0)) & 0x7fffffff;
  return () => {
    h = ((h * 1664525) + 1013904223) & 0x7fffffff;
    return h / 0x7fffffff;
  };
}

function seededHex(seed: string): string {
  const rng = seededRng(seed + "-hash");
  let r = "";
  while (r.length < 64) r += Math.floor(rng() * 0xffffffff).toString(16).padStart(8, "0");
  return r.slice(0, 64);
}

function scoreToRiskBand(avg: number): "A"|"B"|"C"|"D"|"F" {
  if (avg < 0.2)  return "A";
  if (avg < 0.35) return "B";
  if (avg < 0.5)  return "C";
  if (avg < 0.7)  return "D";
  return "F";
}

const PREMIUM: Record<string, number> = { A: 0.85, B: 0.92, C: 1.0, D: 1.12, F: 1.25 };

// ── Fleet driver seeds ────────────────────────────────────────────

const DRIVER_SEEDS = [
  { name: "Ram Bahadur Thapa",  vehicle: "Toyota Hiace · BA 1 KHA 234",   band: "A" as const, avg: 0.11, licenseNo: "NP-D-4800" },
  { name: "Sita Sharma",        vehicle: "Tata Prima · BA 2 CHA 891",     band: "A" as const, avg: 0.08, licenseNo: "NP-D-4801" },
  { name: "Bikash Rai",         vehicle: "Ashok Leyland · BA 3 JHA 512",  band: "A" as const, avg: 0.13, licenseNo: "NP-D-4802" },
  { name: "Kamala Gurung",      vehicle: "Mahindra Bolero · BA 1 TA 334", band: "A" as const, avg: 0.09, licenseNo: "NP-D-4803" },
  { name: "Dipendra Magar",     vehicle: "Toyota Hiace · BA 4 TA 201",    band: "A" as const, avg: 0.12, licenseNo: "NP-D-4804" },
  { name: "Suresh Adhikari",    vehicle: "Swaraj Mazda · BA 2 NA 775",    band: "B" as const, avg: 0.22, licenseNo: "NP-D-4805" },
  { name: "Binita Karki",       vehicle: "Toyota Hiace · BA 1 PA 488",    band: "B" as const, avg: 0.19, licenseNo: "NP-D-4806" },
  { name: "Rajan Tamang",       vehicle: "Tata Prima · BA 3 BA 901",      band: "B" as const, avg: 0.25, licenseNo: "NP-D-4807" },
  { name: "Puja Shrestha",      vehicle: "Ashok Leyland · BA 2 MA 623",   band: "B" as const, avg: 0.21, licenseNo: "NP-D-4808" },
  { name: "Gopal Dhakal",       vehicle: "Toyota Hiace · BA 4 YA 334",    band: "B" as const, avg: 0.27, licenseNo: "NP-D-4809" },
  { name: "Anita Bhandari",     vehicle: "Mahindra Bolero · BA 1 LA 119", band: "B" as const, avg: 0.18, licenseNo: "NP-D-4810" },
  { name: "Nabin Poudel",       vehicle: "Swaraj Mazda · BA 3 WA 556",    band: "B" as const, avg: 0.24, licenseNo: "NP-D-4811" },
  { name: "Priya Maharjan",     vehicle: "Toyota Hiace · BA 2 KHA 002",   band: "B" as const, avg: 0.23, licenseNo: "NP-D-4812" },
  { name: "Tek Bahadur Limbu",  vehicle: "Tata Prima · BA 1 GA 788",      band: "C" as const, avg: 0.38, licenseNo: "NP-D-4813" },
  { name: "Mina Thapa",         vehicle: "Toyota Hiace · BA 4 SHA 344",   band: "C" as const, avg: 0.41, licenseNo: "NP-D-4814" },
  { name: "Santosh Khadka",     vehicle: "Ashok Leyland · BA 2 DA 901",   band: "C" as const, avg: 0.36, licenseNo: "NP-D-4815" },
  { name: "Sabina Yadav",       vehicle: "Swaraj Mazda · BA 3 RA 112",    band: "C" as const, avg: 0.43, licenseNo: "NP-D-4816" },
  { name: "Bijay Basnet",       vehicle: "Mahindra Bolero · BA 1 SA 665", band: "C" as const, avg: 0.39, licenseNo: "NP-D-4817" },
  { name: "Laxmi Tamang",       vehicle: "Toyota Hiace · BA 2 HA 230",    band: "C" as const, avg: 0.44, licenseNo: "NP-D-4818" },
  { name: "Arjun Chaudhary",    vehicle: "Tata Prima · BA 4 KSA 778",     band: "D" as const, avg: 0.58, licenseNo: "NP-D-4819" },
  { name: "Sharmila Ghimire",   vehicle: "Toyota Hiace · BA 1 TSA 334",   band: "D" as const, avg: 0.62, licenseNo: "NP-D-4820" },
  { name: "Roshan Acharya",     vehicle: "Ashok Leyland · BA 3 NA 556",   band: "D" as const, avg: 0.61, licenseNo: "NP-D-4822" },
  { name: "Meena Joshi",        vehicle: "Swaraj Mazda · BA 2 THA 001",   band: "D" as const, avg: 0.64, licenseNo: "NP-D-4823" },
  { name: "Kamal KC",           vehicle: "Toyota Hiace · BA 4 DA 899",    band: "F" as const, avg: 0.81, licenseNo: "NP-D-4824" },
];

// ── Main ─────────────────────────────────────────────────────────

async function seed() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db   = drizzle(pool, { schema });

  // Clear in FK-safe order
  console.log("Clearing existing data...");
  await db.delete(schema.alertEvents);
  await db.delete(schema.evidenceFrames);
  await db.delete(schema.claims);
  await db.delete(schema.sessions);
  await db.delete(schema.users);
  await db.delete(schema.companies);

  // Company
  console.log("Seeding company...");
  const [company] = await db
    .insert(schema.companies)
    .values(v({ name: "Himalayan Bus & Insurance — Nepal" }))
    .returning();
  const companyId = company.id;
  const hash = await bcrypt.hash("demo123", 10);

  // ── Demo accounts ─────────────────────────────────────────────
  console.log("Seeding demo accounts...");

  const [alexUser] = await db.insert(schema.users).values(v({
    name: "Alex Driver", email: "driver@demo.com", passwordHash: hash, role: "driver",
    licenseNo: "NP-D-4821", vehicle: "Toyota Hiace · BA 1 KHA 234", avatarInitials: "AD",
  })).returning();

  await db.insert(schema.users).values(v({
    name: "Sarah Fleet", email: "insurer@fleet.com", passwordHash: hash,
    role: "insurer", companyId, avatarInitials: "SF",
  }));

  await db.insert(schema.users).values(v({
    name: "DS Admin", email: "admin@drowsyshield.com",
    passwordHash: hash, role: "admin", avatarInitials: "DA",
  }));

  // ── 24 fleet drivers ──────────────────────────────────────────
  console.log("Seeding 24 fleet drivers...");
  const driverIds: string[] = [];

  for (const s of DRIVER_SEEDS) {
    const initials = s.name.split(" ").map((w) => w[0]).join("").slice(0, 3).toUpperCase();
    const email    = s.name.toLowerCase().replace(/\s+/g, ".") + "@fleet.hbi";

    const [u] = await db.insert(schema.users).values(v({
      name: s.name, email, passwordHash: hash, role: "driver",
      licenseNo: s.licenseNo, vehicle: s.vehicle, avatarInitials: initials,
    })).returning();

    driverIds.push(u.id);
  }

  // ── 12 sessions for Alex Driver ───────────────────────────────
  console.log("Seeding 12 sessions for Alex Driver...");
  const BANDS: Array<"A"|"B"|"C"|"D"|"F"> = ["A","A","B","B","B","C","C","D","A","B","C","D"];
  const BAND_AVG: Record<string, number>   = { A: 0.1, B: 0.22, C: 0.41, D: 0.62, F: 0.82 };

  for (let i = 0; i < 12; i++) {
    const band      = BANDS[i];
    const avgScore  = Math.min(1, BAND_AVG[band] + (Math.random() - 0.5) * 0.05);
    const peakScore = Math.min(1, avgScore + 0.15 + Math.random() * 0.1);
    const durationS = 1800 + Math.floor(Math.random() * 3600);
    const startedAt = new Date(Date.now() - (i + 1) * 24 * 3600 * 1000 - Math.random() * 3600 * 1000);
    const endedAt   = new Date(startedAt.getTime() + durationS * 1000);

    const [sess] = await db.insert(schema.sessions).values(v({
      driverId: alexUser.id, startedAt, endedAt, durationS, avgScore, peakScore,
      riskBand: band, premiumAdjustment: PREMIUM[band],
      alertCount0: Math.floor(durationS * 0.7),
      alertCount1: Math.floor(durationS * 0.05),
      alertCount2: Math.floor(durationS * 0.02),
      alertCount3: (band === "D" || band === "F") ? Math.floor(Math.random() * 5) : 0,
    })).returning();

    if (band === "C" || band === "D" || band === "F") {
      const eventCount = band === "D" ? 4 : band === "F" ? 8 : 2;
      for (let e = 0; e < eventCount; e++) {
        const level = band === "F" ? 3 : 2;
        await db.insert(schema.alertEvents).values(v({
          sessionId: sess.id,
          timestamp: new Date(startedAt.getTime() + Math.random() * durationS * 1000),
          level, score: avgScore + Math.random() * 0.15,
          ear: 0.18 + Math.random() * 0.1,
          perclos: 0.25 + Math.random() * 0.2,
          mar: 0.3 + Math.random() * 0.3,
        }));
      }
    }
  }

  // ── Sessions for each fleet driver ────────────────────────────
  console.log("Seeding sessions for 24 fleet drivers...");

  for (let di = 0; di < DRIVER_SEEDS.length; di++) {
    const s        = DRIVER_SEEDS[di];
    const driverId = driverIds[di];
    const count    = 4 + Math.floor(Math.random() * 5);

    for (let i = 0; i < count; i++) {
      const avgScore  = Math.min(0.97, s.avg + (Math.random() - 0.5) * 0.06);
      const peakScore = Math.min(0.98, avgScore + 0.12 + Math.random() * 0.08);
      const durationS = 1200 + Math.floor(Math.random() * 5400);
      const startedAt = new Date(Date.now() - (i * 2 + 1) * 24 * 3600 * 1000 - Math.random() * 3600 * 1000);
      const endedAt   = new Date(startedAt.getTime() + durationS * 1000);
      const band      = scoreToRiskBand(avgScore);

      await db.insert(schema.sessions).values(v({
        driverId, startedAt, endedAt, durationS, avgScore, peakScore,
        riskBand: band, premiumAdjustment: PREMIUM[band],
        alertCount0: Math.floor(durationS * 0.65),
        alertCount1: Math.floor(durationS * 0.04),
        alertCount2: (band === "C" || band === "D" || band === "F") ? Math.floor(Math.random() * 10) : 0,
        alertCount3: (band === "D" || band === "F") ? Math.floor(Math.random() * 4) : 0,
      }));
    }
  }

  // ── 8 claims with evidence frames (mirrors generateClaims) ────
  console.log("Seeding 8 claims with evidence frames...");

  const riskDrivers = DRIVER_SEEDS
    .map((s, i) => ({ s, i }))
    .filter(({ s }) => s.band === "C" || s.band === "D" || s.band === "F")
    .slice(0, 8);

  const types    = ["fatigue-related", "collision", "other"] as const;
  const statuses = ["open", "investigating", "resolved", "denied"] as const;

  for (let ci = 0; ci < riskDrivers.length; ci++) {
    const { s, i }  = riskDrivers[ci];
    const driverId  = driverIds[i];
    const daysAgo   = 3 + ci * 7;
    const incidentDate = new Date(Date.now() - daysAgo * 86_400_000);
    const reportedDate = new Date(Date.now() - (daysAgo - 2) * 86_400_000);
    const type      = types[ci % 3];
    const status    = statuses[ci % 4];
    const level     = s.band === "F" ? 3 : s.band === "D" ? 2 : 1;
    const claimId   = `CLM-2026-${1001 + ci}`;
    const frameCount = level === 3 ? 48 + ci * 6 : level === 2 ? 18 + ci * 3 : 5;
    const rng       = seededRng(`notes-${claimId}`);
    const minsBefore = Math.ceil(rng() * 8) || 1;

    const notes =
      type === "fatigue-related"
        ? `Level ${level} drowsiness alert recorded ${minsBefore} min before incident.`
        : type === "collision"
        ? "Minor collision reported. DMS data shows elevated composite score."
        : "Non-fatigue incident. Evidence package generated for records.";

    await db.insert(schema.claims).values(v({
      id: claimId, driverId, vehicle: s.vehicle,
      incidentDate, reportedDate, type, status,
      amountNpr: 50_000 + ci * 35_000,
      alertLevelAtIncident: level,
      compositeScoreAtIncident: Math.min(0.97, s.avg + 0.2 * rng()),
      notes, companyId,
    }));

    // Evidence frames — 5-min window before incident
    const windowS = 300;
    for (let fi = 0; fi < frameCount; fi++) {
      const progress         = frameCount > 1 ? fi / (frameCount - 1) : 1;
      const secondsBefore    = Math.round((1 - progress) * windowS);
      const capturedAt       = new Date(incidentDate.getTime() - secondsBefore * 1000);
      const frameLevel       = secondsBefore > 180 ? 0 : secondsBefore > 90 ? 1 : secondsBefore > 30 ? Math.min(level, 2) : level;
      const frng             = seededRng(`${claimId}-f${fi}`);
      const compositeScore   = Math.max(0.03, Math.min(0.97, 0.05 + progress * (level === 3 ? 0.82 : level === 2 ? 0.58 : 0.36) + (frng() - 0.5) * 0.06));
      const ear              = Math.max(0.08, Math.min(0.44, 0.38 - progress * (level >= 2 ? 0.26 : 0.14) + (frng() - 0.5) * 0.02));
      const perclos          = Math.max(0, Math.min(0.82, progress * (level === 3 ? 0.68 : level === 2 ? 0.44 : 0.22) + frng() * 0.04));

      await db.insert(schema.evidenceFrames).values(v({
        claimId,
        frameId:               `${claimId}-F${String(fi + 1).padStart(3, "0")}`,
        capturedAt, secondsBeforeIncident: secondsBefore,
        alertLevel: frameLevel, compositeScore, ear, perclos,
        hash: seededHex(`${claimId}-f${fi}`),
      }));
    }

    console.log(`  ${claimId} (${s.name}) — Level ${level} — ${frameCount} frames`);
  }

  console.log("\n✓ Seed complete!");
  console.log("  Users:    driver@demo.com / insurer@fleet.com / admin@drowsyshield.com  (pw: demo123)");
  console.log("  Fleet:    24 drivers · 8 claims with evidence frames");
  console.log("  Sessions: 12 for Alex Driver + sessions for all fleet drivers");
  await pool.end();
}

seed().catch((e) => { console.error(e); process.exit(1); });
