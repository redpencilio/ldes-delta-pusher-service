import * as z from "zod";

const EnvSchema = z.object({
  LDES_FRAGMENTER: z.string().optional(),
  LDES_FOLDER: z.string(),
  DATA_FOLDER: z.string().default("/data"),

  AUTO_HEALING: z.stringbool().default(false),
  CRON_HEALING: z.string().default("0 * * * *" /* Every hour */),

  CRON_CHECKPOINT: z.string().optional(),
  HEALING_LIMIT: z.coerce.number().default(3000),
  HEALING_BATCH_SIZE: z.coerce.number().default(100),
  HEALING_DUMP_GRAPH: z.string().default("http://mu.semte.ch/graphs/ldes-dump"),
  HEALING_TRANSFORMED_GRAPH: z
    .string()
    .default("http://mu.semte.ch/graphs/transformed-ldes-data"),
  DIRECT_DB_ENDPOINT: z.string().default("http://virtuoso:8890/sparql"),
  LDES_BASE: z
    .string()
    .transform((base) => (!base.endsWith("/") ? base + "/" : base)),

  WRITE_INITIAL_STATE: z.stringbool().default(false),
  INITIAL_STATE_LIMIT: z.coerce.number().default(10000),
  MAX_PAGE_SIZE_BYTES: z.coerce.number().default(10000000),
  VIRTUOSO_DATE_WORKAROUND: z.stringbool().default(false),
});

const ENV = EnvSchema.parse(process.env);
process.env.BASE_URL = ENV.LDES_BASE; // required by the ldes-producer

console.log("\n Configuration: ");
console.log(`\n ${JSON.stringify(ENV)}`);

export default ENV;
