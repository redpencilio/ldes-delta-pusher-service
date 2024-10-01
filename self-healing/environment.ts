export const AUTO_HEALING = process.env.AUTO_HEALING ?? false;
export const LDES_STREAM = process.env.LDES_STREAM ?? "";
export const CRON_HEALING = process.env.CRON_HEALING ?? "* * * * *";
export const LDES_DUMP_GRAPH =
  process.env.LDES_LOAD_GRAPH ?? "http://mu.semte.ch/graphs/ldes-dump";
export const TRANSFORMED_LDES_GRAPH =
  process.env.TRANSFORMED_LDES_GRAPH ??
  "http://mu.semte.ch/graphs/transformed-ldes-data";
export const BATCH_SIZE = parseInt(process.env.BATCH_SIZE ?? "100");
export const EXTRA_HEADERS = JSON.parse(process.env.EXTRA_HEADERS ?? "{}");

console.log("\n Environment variables:");
console.log(`\t LDES_STREAM: ${LDES_STREAM}`);
console.log(`\t LDES_DUMP_GRAPH: ${LDES_DUMP_GRAPH}`);
console.log(`\t TRANSFORMED_LDES_GRAPH: ${TRANSFORMED_LDES_GRAPH}`);
console.log(`\t BATCH_SIZE: ${BATCH_SIZE}`);
console.log(`\t EXTRA_HEADERS: ${JSON.stringify(EXTRA_HEADERS)}`);
