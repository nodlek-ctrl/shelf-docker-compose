import { create } from "https://deno.land/x/djwt@v3.0.1/mod.ts";
import { load } from "https://deno.land/std/dotenv/mod.ts";
import { dirname, fromFileUrl, join } from "https://deno.land/std/path/mod.ts";

const __dirname = dirname(fromFileUrl(import.meta.url));
const envPath = join(__dirname, "../.env");

// Load current .env file
const env = await load({ envPath, allowEmptyValues: true });
const key = env["JWT_SECRET"];

console.log("Loading JWT_SECRET:", key);

if (!key) {
  console.error("JWT_SECRET environment variable is required");
  Deno.exit(1);
}

// Generate signing key from secret
const signingKey = await crypto.subtle.importKey(
  "raw",
  new TextEncoder().encode(key),
  { name: "HMAC", hash: "SHA-256" },
  false,
  ["sign"],
);

// Create anon token
const anonPayload = {
  role: "anon",
  iss: "supabase-demo",
  iat: 1641769200,
  exp: 1799535600,
};
const anonJWT = await create(
  { alg: "HS256", typ: "JWT" },
  anonPayload,
  signingKey,
);

// Create service role token
const servicePayload = {
  role: "service_role",
  iss: "supabase-demo",
  iat: 1641769200,
  exp: 1799535600,
};
const serviceJWT = await create(
  { alg: "HS256", typ: "JWT" },
  servicePayload,
  signingKey,
);

// Read the current .env file
const currentEnv = await Deno.readTextFile(envPath);

// Replace or add the JWT tokens
const updatedEnv = currentEnv
  .replace(/^ANON_KEY=.*$/m, `ANON_KEY=${anonJWT}`)
  .replace(/^SERVICE_ROLE_KEY=.*$/m, `SERVICE_ROLE_KEY=${serviceJWT}`);

// Write the updated content back to .env
await Deno.writeTextFile(envPath, updatedEnv);

console.log("Updated .env file with new JWT tokens:");
console.log("ANON_KEY=" + anonJWT);
console.log("SERVICE_ROLE_KEY=" + serviceJWT);
