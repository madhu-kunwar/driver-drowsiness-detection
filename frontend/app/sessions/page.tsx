import type { Metadata } from "next";
import { AuthGuard } from "@/components/shared/AuthGuard";
import { SessionsContent } from "./SessionsContent";

export const metadata: Metadata = {
  title: "Session History",
  description: "Browse and filter all your drowsiness monitoring sessions.",
};

export default function SessionsPage() {
  return (
    <AuthGuard roles={["driver", "admin"]}>
      <SessionsContent />
    </AuthGuard>
  );
}
