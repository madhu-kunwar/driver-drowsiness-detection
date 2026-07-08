import type { Metadata } from "next";
import { MonitorClient } from "./MonitorClient";
import { AuthGuard } from "@/components/shared/AuthGuard";

export const metadata: Metadata = {
  title: "Live Monitor",
  description: "Real-time driver drowsiness detection",
};

export default function MonitorPage() {
  return (
    <AuthGuard roles={["driver", "admin"]}>
      <MonitorClient />
    </AuthGuard>
  );
}
