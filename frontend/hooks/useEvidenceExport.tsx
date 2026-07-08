"use client";

import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import type { Claim, FleetDriver } from "@/types/insurer";

const ALERT_LABELS = ["Alert/Safe", "Mild", "Warning", "CRITICAL"] as const;
const ALERT_HEX    = ["#10B981",   "#F59E0B", "#F97316", "#EF4444"] as const;

const STATUS_HEX: Record<string, string> = {
  open:          "#F59E0B",
  investigating: "#F97316",
  resolved:      "#10B981",
  denied:        "#6B7280",
};

const s = StyleSheet.create({
  page:           { padding: 40, fontFamily: "Helvetica", backgroundColor: "#ffffff", color: "#1C1C1E", fontSize: 9 },
  header:         { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20, paddingBottom: 12, borderBottom: "2px solid #10B981" },
  brand:          { fontSize: 14, fontFamily: "Helvetica-Bold", color: "#10B981" },
  brandSub:       { fontSize: 8, color: "#6B7280", marginTop: 2 },
  claimBadge:     { padding: "4 8", borderRadius: 4, border: "1px solid #10B981", backgroundColor: "#10B98112" },
  claimBadgeText: { fontFamily: "Helvetica-Bold", fontSize: 10, color: "#10B981" },
  section:        { marginBottom: 14 },
  sectionTitle:   { fontFamily: "Helvetica-Bold", fontSize: 9, color: "#1C1C1E", marginBottom: 6, paddingBottom: 3, borderBottom: "1px solid #E5E7EB", textTransform: "uppercase", letterSpacing: 0.8 },
  row:            { flexDirection: "row", marginBottom: 3 },
  label:          { color: "#6B7280", width: 140 },
  value:          { fontFamily: "Helvetica-Bold", flex: 1 },
  valueNormal:    { flex: 1 },
  tHead:          { flexDirection: "row", backgroundColor: "#F3F4F6", padding: "4 6", marginBottom: 1 },
  tRow:           { flexDirection: "row", padding: "3 6", borderBottom: "1px solid #F3F4F6" },
  tCell:          { fontSize: 7, color: "#374151" },
  tHCell:         { fontSize: 7, fontFamily: "Helvetica-Bold", color: "#1C1C1E", textTransform: "uppercase", letterSpacing: 0.4 },
  colFrame:       { width: "18%" },
  colTime:        { width: "9%" },
  colLevel:       { width: "14%" },
  colScore:       { width: "10%" },
  colEar:         { width: "9%" },
  colPerclos:     { width: "11%" },
  colHash:        { width: "29%" },
  integrityBox:   { backgroundColor: "#10B98108", border: "1px solid #10B98140", padding: 10, borderRadius: 4, marginTop: 10 },
  integrityTitle: { fontFamily: "Helvetica-Bold", fontSize: 8, color: "#10B981", marginBottom: 4 },
  integrityText:  { fontSize: 8, color: "#10B981" },
  footer:         { position: "absolute", bottom: 28, left: 40, right: 40, flexDirection: "row", justifyContent: "space-between", paddingTop: 6, borderTop: "1px solid #E5E7EB" },
  footerText:     { fontSize: 7, color: "#6B7280" },
});

interface ClaimDocProps {
  claim:       Claim;
  driver:      FleetDriver;
  generatedAt: string;
}

function ClaimReportDocument({ claim, driver, generatedAt }: ClaimDocProps) {
  const alertHex  = ALERT_HEX[claim.alertLevelAtIncident];
  const statusHex = STATUS_HEX[claim.status] ?? "#6B7280";
  const domain    = driver.email.split("@")[1]?.toUpperCase() ?? "HBI-NEPAL";

  return (
    <Document>
      <Page size="A4" style={s.page}>
        {/* Header */}
        <View style={s.header}>
          <View>
            <Text style={s.brand}>DrowsyShield</Text>
            <Text style={s.brandSub}>Claims Evidence Package — {domain}</Text>
          </View>
          <View style={s.claimBadge}>
            <Text style={s.claimBadgeText}>{claim.id}</Text>
          </View>
        </View>

        {/* Claim Details */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Claim Details</Text>
          {([
            ["Driver",        claim.driverName],
            ["License No.",   driver.licenseNo],
            ["Vehicle",       claim.vehicle],
            ["Incident Date", new Date(claim.incidentDate).toLocaleString("en-US", { dateStyle: "long", timeStyle: "short" })],
            ["Reported Date", new Date(claim.reportedDate).toLocaleDateString("en-US", { dateStyle: "long" })],
            ["Claim Type",    claim.type.replace("-", " ").replace(/\b\w/g, (c) => c.toUpperCase())],
          ] as [string, string][]).map(([label, value]) => (
            <View style={s.row} key={label}>
              <Text style={s.label}>{label}</Text>
              <Text style={s.value}>{value}</Text>
            </View>
          ))}
          <View style={s.row}>
            <Text style={s.label}>Notes</Text>
            <Text style={s.valueNormal}>{claim.notes}</Text>
          </View>
          <View style={s.row}>
            <Text style={s.label}>Status</Text>
            <Text style={[s.value, { color: statusHex }]}>{claim.status.toUpperCase()}</Text>
          </View>
          <View style={s.row}>
            <Text style={s.label}>Amount Claimed</Text>
            <Text style={s.value}>NPR {claim.amountNPR.toLocaleString()}</Text>
          </View>
        </View>

        {/* DMS Data at Incident */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Driver Monitoring Data at Incident</Text>
          <View style={s.row}>
            <Text style={s.label}>Alert Level</Text>
            <Text style={[s.value, { color: alertHex }]}>
              Level {claim.alertLevelAtIncident} — {ALERT_LABELS[claim.alertLevelAtIncident]}
            </Text>
          </View>
          <View style={s.row}>
            <Text style={s.label}>Composite Score</Text>
            <Text style={[s.value, { color: alertHex }]}>
              {(claim.compositeScoreAtIncident * 100).toFixed(1)}%
            </Text>
          </View>
          <View style={s.row}>
            <Text style={s.label}>Evidence Frames</Text>
            <Text style={s.value}>{claim.frames.length} captured frames</Text>
          </View>
          <View style={s.row}>
            <Text style={s.label}>Risk Band at Incident</Text>
            <Text style={s.value}>{driver.riskBand}</Text>
          </View>
        </View>

        {/* Evidence Frame Log */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>
            Evidence Frame Log ({claim.frames.length} frames)
          </Text>
          <View style={s.tHead}>
            <Text style={[s.tHCell, s.colFrame]}>Frame ID</Text>
            <Text style={[s.tHCell, s.colTime]}>Offset</Text>
            <Text style={[s.tHCell, s.colLevel]}>Alert Level</Text>
            <Text style={[s.tHCell, s.colScore]}>Score</Text>
            <Text style={[s.tHCell, s.colEar]}>EAR</Text>
            <Text style={[s.tHCell, s.colPerclos]}>PERCLOS</Text>
            <Text style={[s.tHCell, s.colHash]}>SHA-256 (partial)</Text>
          </View>
          {claim.frames.map((frame) => (
            <View style={s.tRow} key={frame.frameId} wrap={false}>
              <Text style={[s.tCell, s.colFrame, { fontFamily: "Courier", fontSize: 6 }]}>
                {frame.frameId}
              </Text>
              <Text style={[s.tCell, s.colTime]}>
                {frame.secondsBeforeIncident > 0 ? `-${frame.secondsBeforeIncident}s` : "T0"}
              </Text>
              <Text style={[s.tCell, s.colLevel, { color: ALERT_HEX[frame.alertLevel], fontFamily: "Helvetica-Bold" }]}>
                L{frame.alertLevel} {ALERT_LABELS[frame.alertLevel]}
              </Text>
              <Text style={[s.tCell, s.colScore]}>{(frame.compositeScore * 100).toFixed(1)}%</Text>
              <Text style={[s.tCell, s.colEar]}>{frame.ear.toFixed(3)}</Text>
              <Text style={[s.tCell, s.colPerclos]}>{(frame.perclos * 100).toFixed(1)}%</Text>
              <Text style={[s.tCell, s.colHash, { fontFamily: "Courier", fontSize: 6 }]}>
                {frame.hash.slice(0, 22)}…
              </Text>
            </View>
          ))}
        </View>

        {/* Hash chain integrity */}
        <View style={s.integrityBox}>
          <Text style={s.integrityTitle}>Evidence Integrity Statement</Text>
          <Text style={s.integrityText}>
            {`All ${claim.frames.length} frames are SHA-256 hashed at source capture time. ` +
             "The hash chain provides tamper-evident proof of the frame sequence and is legally " +
             "admissible under ISO 27001 digital evidence standards. Each frame's hash covers " +
             "the raw JPEG payload, timestamp, GPS coordinates (if available), and the composite " +
             "drowsiness score at time of capture."}
          </Text>
        </View>

        {/* Footer */}
        <View style={s.footer} fixed>
          <Text style={s.footerText}>DrowsyShield — HBI-Nepal Fleet Insurance | Confidential</Text>
          <Text style={s.footerText}>Generated: {generatedAt}</Text>
        </View>
      </Page>
    </Document>
  );
}

/* ── Hook ─────────────────────────────────────────────────────── */
export interface EvidenceExportPayload {
  document: React.ReactElement;
  filename: string;
}

export function useEvidenceExport(claim: Claim, driver: FleetDriver): EvidenceExportPayload {
  const generatedAt = new Date().toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  return {
    document: <ClaimReportDocument claim={claim} driver={driver} generatedAt={generatedAt} />,
    filename: `DrowsyShield-${claim.id}-Evidence.pdf`,
  };
}
