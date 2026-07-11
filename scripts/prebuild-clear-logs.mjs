/** Runs clear-logs on Vercel build when CLEAR_LOGS_ON_DEPLOY=1 (Turso env is available there). */
import { execSync } from "node:child_process";

if (process.env.CLEAR_LOGS_ON_DEPLOY === "1") {
  console.log("[prebuild] CLEAR_LOGS_ON_DEPLOY=1 — clearing log tables on Turso...");
  execSync("npx tsx scripts/clear-logs.ts --turso", {
    stdio: "inherit",
    env: process.env,
  });
}
