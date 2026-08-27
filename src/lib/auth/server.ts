import { createNeonAuth } from "@neondatabase/auth/next/server";

const baseUrl = process.env.NEON_AUTH_BASE_URL || "https://placeholder-auth.neon.tech/neondb/auth";
const cookieSecret = process.env.NEON_AUTH_COOKIE_SECRET || "default_development_secret_32_characters_long_min";

export const isNeonAuthConfigured = Boolean(
  process.env.NEON_AUTH_BASE_URL && process.env.NEON_AUTH_COOKIE_SECRET
);

export const auth = createNeonAuth({
  baseUrl,
  cookies: {
    secret: cookieSecret,
    sessionDataTtl: 300,
  },
});
