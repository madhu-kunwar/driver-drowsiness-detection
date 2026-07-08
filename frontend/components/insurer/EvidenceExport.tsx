"use client";

import { useState } from "react";
import { PDFDownloadLink } from "@react-pdf/renderer";
import { Download, Loader2, FileCheck } from "lucide-react";
import { useEvidenceExport } from "@/hooks/useEvidenceExport";
import type { Claim, FleetDriver } from "@/types/insurer";

interface Props {
  claim:  Claim;
  driver: FleetDriver;
}

export function EvidenceExport({ claim, driver }: Props) {
  const [clicked, setClicked] = useState(false);
  const { document: pdfDoc, filename } = useEvidenceExport(claim, driver);

  return (
    <PDFDownloadLink
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      document={pdfDoc as any}
      fileName={filename}
      onClick={() => setClicked(true)}
    >
      {({ loading }) => (
        <button
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-caption font-semibold transition-all"
          style={{
            background: loading ? "var(--ds-base-raised)" : "var(--ds-emerald-glow)",
            border: `1px solid ${loading ? "var(--ds-base-border)" : "var(--ds-emerald)"}`,
            color: loading ? "var(--muted-foreground)" : "var(--ds-emerald)",
            cursor: loading ? "wait" : "pointer",
          }}
        >
          {loading ? (
            <Loader2 size={13} className="animate-spin" />
          ) : clicked ? (
            <FileCheck size={13} />
          ) : (
            <Download size={13} />
          )}
          {loading ? "Generating PDF…" : clicked ? "Downloaded" : "Export Evidence PDF"}
        </button>
      )}
    </PDFDownloadLink>
  );
}
