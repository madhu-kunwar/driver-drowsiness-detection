import { HeroSection } from "@/components/landing/HeroSection";
import { ProblemSection } from "@/components/landing/ProblemSection";
import { HowItWorksSection } from "@/components/landing/HowItWorksSection";
import { DemoPreviewSection } from "@/components/landing/DemoPreviewSection";
import { InsuranceValueSection } from "@/components/landing/InsuranceValueSection";
import { TechnicalSection } from "@/components/landing/TechnicalSection";
import { RegulatorySection } from "@/components/landing/RegulatorySection";
import { CTASection } from "@/components/landing/CTASection";

export default function Home() {
  return (
    <>
      {/* 1. Hero — cinematic entrance, aurora bg, score mockup */}
      <HeroSection />

      {/* 2. Problem — GSAP batch stat reveals, $109B, 4 problems */}
      <ProblemSection />

      {/* 3. How It Works — GSAP horizontal scroll pin, 5 signal cards */}
      <HowItWorksSection />

      {/* 4. Live Demo Preview — Shery.js image distortion, monitor mockup */}
      <DemoPreviewSection />

      {/* 5. Insurance Value — A–F risk bands, use cases, ROI */}
      <InsuranceValueSection />

      {/* 6. Technical — ablation study, NTHU-DDD benchmarks */}
      <TechnicalSection />

      {/* 7. Regulatory — Euro NCAP 2026, EU GSR, FMCSA, GDPR */}
      <RegulatorySection />

      {/* 8. Final CTA — 3 paths + main buttons */}
      <CTASection />
    </>
  );
}
