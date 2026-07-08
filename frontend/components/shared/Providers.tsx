"use client";

import { ThemeProvider } from "next-themes";
import { QueryProvider } from "./QueryProvider";
import { LenisProvider } from "./LenisProvider";
import { GSAPInit } from "./GSAPInit";
import { TheatreProvider } from "./TheatreProvider";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem={false}
      disableTransitionOnChange={false}
    >
      {/* Global GSAP plugin registration — must be before any scroll animations */}
      <GSAPInit />

      <QueryProvider>
        <TheatreProvider>
          <LenisProvider>{children}</LenisProvider>
        </TheatreProvider>
      </QueryProvider>
    </ThemeProvider>
  );
}
