import type { Metadata } from "next";
import { AuthGuard } from "@/components/shared/AuthGuard";
import { DashboardContent } from "./DashboardContent";

export const metadata: Metadata = {
  title: "Driver Analytics",
  description: "Your drowsiness history, risk profile, and session trend analysis.",
};

export default function DashboardPage() {
  return (
    <AuthGuard roles={["driver", "admin"]}>
      <DashboardContent />
    </AuthGuard>
  );
}
