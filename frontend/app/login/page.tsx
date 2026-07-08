import type { Metadata } from "next";
import { LoginContent } from "./LoginContent";

export const metadata: Metadata = {
  title: "Sign In",
  description: "Sign in to DrowsyShield — driver or insurer portal.",
};

export default function LoginPage() {
  return <LoginContent />;
}
