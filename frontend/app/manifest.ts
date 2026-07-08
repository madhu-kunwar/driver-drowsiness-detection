import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "DrowsyShield — Driver Risk Intelligence",
    short_name: "DrowsyShield",
    description:
      "Real-time multimodal driver drowsiness detection for motor insurance agencies.",
    start_url: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#1C1C1E",
    theme_color: "#10B981",
    categories: ["health", "productivity", "utilities"],
    icons: [
      {
        src: "/icons/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      {
        name: "Live Monitor",
        short_name: "Monitor",
        description: "Start a drowsiness detection session",
        url: "/monitor",
        icons: [{ src: "/icons/icon.svg", sizes: "any" }],
      },
      {
        name: "Fleet Dashboard",
        short_name: "Fleet",
        description: "View fleet risk overview",
        url: "/insurer",
        icons: [{ src: "/icons/icon.svg", sizes: "any" }],
      },
    ],
  };
}
