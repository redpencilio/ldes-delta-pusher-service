export const LDES_FRAGMENTER = process.env.LDES_FRAGMENTER as
  | string
  | undefined;
export let LDES_ENDPOINT = process.env.LDES_ENDPOINT as string;

export let LDES_BASE = process.env.LDES_BASE || "";
export const AUTO_HEALING = process.env.AUTO_HEALING ?? false;
export const CRON_HEALING = process.env.CRON_HEALING ?? "0 * * * *"; // Every hour
export const HEALING_LIMIT = process.env.HEALING_LIMIT || 1000;
export const HEALING_BATCH_SIZE = parseInt(
  process.env.HEALING_BATCH_SIZE ?? "100"
);
export const HEALING_DUMP_GRAPH =
  process.env.HEALING_DUMP_GRAPH ?? "http://mu.semte.ch/graphs/ldes-dump";
export const HEALING_TRANSFORMED_GRAPH =
  process.env.HEALING_TRANSFORMED_GRAPH ??
  "http://mu.semte.ch/graphs/transformed-ldes-data";
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
console.log(`\t HEALING_DUMP_GRAPH: ${HEALING_DUMP_GRAPH}`);
console.log(`\t HEALING_TRANSFORMED_GRAPH: ${HEALING_TRANSFORMED_GRAPH}`);
console.log(`\t HEALING_BATCH_SIZE: ${HEALING_BATCH_SIZE}`);
