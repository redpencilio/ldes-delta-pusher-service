export const LDES_FRAGMENTER = process.env.LDES_FRAGMENTER as
  | string
  | undefined;
export const LDES_FOLDER = process.env.LDES_FOLDER as string;
export const DATA_FOLDER = process.env.DATA_FOLDER || "/data" as string;
export const AUTO_HEALING = process.env.AUTO_HEALING ?? false;
export const CRON_HEALING = process.env.CRON_HEALING ?? "0 * * * *"; // Every hour
export const CRON_CHECKPOINT = process.env.CRON_CHECKPOINT;
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

let ldesBase = process.env.LDES_BASE || "";

if (ldesBase === "") {
  throw new Error('Please set the "LDES_BASE" environment variable');
}

if (!ldesBase.endsWith("/")) {
  ldesBase += "/";
}

export const LDES_BASE = ldesBase;

process.env.BASE_URL = LDES_BASE; // required by the ldes-producer

if (!LDES_FOLDER?.length) {
  throw new Error('Please set the "LDES_FOLDER" environment variable. e.g: ldes-mow-registry');
}


console.log("\n Configuration:");
console.log(`\t AUTO_HEALING: ${AUTO_HEALING}`);
console.log(`\t CRON_HEALING: ${CRON_HEALING}`);
console.log(`\t LDES_BASE: ${LDES_BASE}`);
console.log(`\t LDES_FOLDER: ${LDES_FOLDER}`);
console.log(`\t DATA_FOLDER: ${DATA_FOLDER}`);
console.log(`\t DIRECT_DB_ENDPOINT: ${DIRECT_DB_ENDPOINT}`);
console.log(`\t HEALING_LIMIT: ${HEALING_LIMIT}`);
console.log(`\t HEALING_DUMP_GRAPH: ${HEALING_DUMP_GRAPH}`);
console.log(`\t HEALING_TRANSFORMED_GRAPH: ${HEALING_TRANSFORMED_GRAPH}`);
console.log(`\t HEALING_BATCH_SIZE: ${HEALING_BATCH_SIZE}`);
