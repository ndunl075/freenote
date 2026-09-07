import type { NextConfig } from "next";

// freenote ships as a fully static bundle: no server, no API routes, no runtime
// network access. That makes it deployable to Vercel, GitHub Pages, or a folder
// on a USB stick without changing a line.
//
// GitHub Pages serves from /<repo>, so the workflow sets NEXT_PUBLIC_BASE_PATH.
// Vercel and local dev leave it empty.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

const nextConfig: NextConfig = {
  output: "export",
  basePath,
  images: { unoptimized: true },
  trailingSlash: true,
  typedRoutes: false,
};

export default nextConfig;
