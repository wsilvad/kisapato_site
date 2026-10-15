import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Na Discloud só alguns diretórios de saída chegam ao container depois do build (".next" e "next-build" sumiam:
  // "Could not find a production build"; "dist" é preservado, como na API). No desenvolvimento continua ".next".
  distDir: process.env.NODE_ENV === "production" ? "dist" : ".next",
  // Adicione aqui os domínios de imagens (onde as fotos dos produtos forem hospedadas) em images.remotePatterns
};

export default nextConfig;
