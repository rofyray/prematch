import type { NextConfig } from "next";
const config: NextConfig = {
  outputFileTracingRoot: process.cwd(),
  async rewrites() {
    return process.env.NODE_ENV === "development"
      ? [
          {
            source: "/api/py/:path*",
            destination: `${process.env.PYTHON_API_URL || "http://127.0.0.1:8000"}/api/py/:path*`,
          },
        ]
      : [];
  },
};
export default config;
