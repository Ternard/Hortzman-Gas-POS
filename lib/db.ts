import { neon, neonConfig, type NeonQueryFunction } from "@neondatabase/serverless";

// Only for local testing against a plain Postgres via an HTTP proxy. Not used on Vercel.
if (process.env.NEON_FETCH_ENDPOINT) neonConfig.fetchEndpoint = process.env.NEON_FETCH_ENDPOINT;

export function db(): NeonQueryFunction<false, false> {
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Add Neon Postgres to your Vercel project (Storage tab) and redeploy."
    );
  }
  return neon(url);
}

export const num = (v: unknown) => Number(v ?? 0);
