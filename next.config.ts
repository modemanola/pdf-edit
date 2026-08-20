import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Statički export (Sve se dešava u browseru — nema server-side logike).
  // Generiše `out/` direktorijum koji se može servirati sa bilo kog statičkog hosta.
  output: "export",
};

export default nextConfig;
