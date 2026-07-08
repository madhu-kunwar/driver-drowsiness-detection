import type { Metadata } from "next";
import { AuthGuard } from "@/components/shared/AuthGuard";
import { RiskCardContent } from "./RiskCardContent";

export const metadata: Metadata = {
  title: "Driver Risk Card",
  description: "Your shareable A–F driver risk grade, premium adjustment, and session summary.",
};

export default function RiskCardPage() {
  return (
    <AuthGuard roles={["driver", "admin"]}>
      <RiskCardContent />
    </AuthGuard>
  );
}
