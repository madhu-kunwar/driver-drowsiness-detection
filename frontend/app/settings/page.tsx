import type { Metadata } from "next";
import { AuthGuard } from "@/components/shared/AuthGuard";
import { SettingsContent } from "./SettingsContent";

export const metadata: Metadata = {
  title: "Settings",
  description: "Manage your account, alert preferences, and app settings.",
};

export default function SettingsPage() {
  return (
    <AuthGuard>
      <SettingsContent />
    </AuthGuard>
  );
}
