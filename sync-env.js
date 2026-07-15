import fs from "fs";
import path from "path";
import { execSync } from "child_process";

const envPath = path.resolve(".env");
const envContent = fs.readFileSync(envPath, "utf-8");

const lines = envContent.split(/\r?\n/);
for (const line of lines) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;

  const match = trimmed.match(/^([^=]+)=(.*)$/);
  if (!match) continue;

  const key = match[1].trim();
  let value = match[2].trim();

  // Strip wrapping quotes
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    value = value.substring(1, value.length - 1);
  }

  console.log(`Syncing ${key}...`);

  // Remove existing env var if present to avoid conflicts
  try {
    execSync(`npx vercel env rm ${key} --yes`, { stdio: "inherit" });
  } catch (err) {
    // Ignore error if it doesn't exist
  }

  // Add to all environments
  try {
    execSync(`npx vercel env add ${key} production preview development --value "${value}" --yes`, { stdio: "inherit" });
    console.log(`✅ Synced ${key} successfully`);
  } catch (err) {
    console.error(`❌ Failed to sync ${key}:`, err.message);
  }
}
