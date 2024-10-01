export const LDES_FRAGMENTER = process.env.LDES_FRAGMENTER as
  | string
  | undefined;
export let LDES_ENDPOINT = process.env.LDES_ENDPOINT as string;

export let LDES_BASE = process.env.LDES_BASE || "";
export const AUTO_HEALING = process.env.AUTO_HEALING ?? false;
export const LDES_STREAM = process.env.LDES_STREAM ?? ""; // TODO: This will come from the files initialization config
export const CRON_HEALING = process.env.CRON_HEALING ?? "0 * * * *"; // Every hour
export const HEALING_LIMIT = process.env.HEALING_LIMIT || 1000;
export const DIRECT_DB_ENDPOINT =
  process.env.DIRECT_DB_ENDPOINT || "http://virtuoso:8890/sparql";

if (LDES_BASE === "") {
  throw new Error('Please set the "LDES_BASE" environment variable');
}

if (!LDES_BASE.endsWith("/")) {
  LDES_BASE = LDES_BASE + "/";
}
if (!LDES_ENDPOINT.endsWith("/")) {
  LDES_ENDPOINT = LDES_ENDPOINT + "/";
}

console.log("\n Configuration:");
console.log(`\t AUTO_HEALING: ${AUTO_HEALING}`);
console.log(`\t CRON_HEALING: ${CRON_HEALING}`);
console.log(`\t LDES_BASE: ${LDES_BASE}`);
console.log(`\t LDES_ENDPOINT: ${LDES_ENDPOINT}`);
console.log(`\t DIRECT_DB_ENDPOINT: ${DIRECT_DB_ENDPOINT}`);
console.log(`\t HEALING_LIMIT: ${HEALING_LIMIT}`);
