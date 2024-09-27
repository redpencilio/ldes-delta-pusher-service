export const AUTO_HEALING = process.env.AUTO_HEALING ?? false;
export let LDES_STREAM_BASE = process.env.LDES_STREAM_BASE ?? '';
export const LDES_STREAM = process.env.LDES_STREAM ?? '';
export const CRON_HEALING = process.env.CRON_HEALING ?? '* * * * *';
export const DIRECT_DATABASE_ENDPOINT =
  process.env.DIRECT_DATABASE_ENDPOINT ?? 'http://virtuoso:8890/sparql';
export const LDES_DUMP_GRAPH =
  process.env.LDES_LOAD_GRAPH ?? 'http://mu.semte.ch/graphs/ldes-dump';
export const TRANSFORMED_LDES_GRAPH =
  process.env.TRANSFORMED_LDES_GRAPH ??
  'http://mu.semte.ch/graphs/transformed-ldes-data';
export const BATCH_SIZE = parseInt(process.env.BATCH_SIZE ?? '100');
export const EXTRA_HEADERS = JSON.parse(process.env.EXTRA_HEADERS ?? '{}');

if (LDES_STREAM_BASE === '') {
  throw new Error('Please set the "LDES_STREAM" environment variable');
}

if (!LDES_STREAM_BASE.endsWith('/')) {
  LDES_STREAM_BASE = LDES_STREAM_BASE + '/';
}

export const CONFIG = {
  public: {
    entities: {
      'http://data.vlaanderen.be/ns/mandaat#Mandataris': [
        // "http://data.vlaanderen.be/ns/mandaat#rangorde",
        // "http://data.vlaanderen.be/ns/mandaat#start",
        'http://data.vlaanderen.be/ns/mandaat#einde',
        // "http://mu.semte.ch/vocabularies/ext/datumEedaflegging",
        // "http://mu.semte.ch/vocabularies/ext/datumMinistrieelBesluit",
        // "http://mu.semte.ch/vocabularies/ext/generatedFrom",
        // "http://www.w3.org/2004/02/skos/core#changeNote",
        // "http://data.vlaanderen.be/ns/mandaat#isTijdelijkVervangenDoor",
        // "http://schema.org/contactPoint",
        // "http://data.vlaanderen.be/ns/mandaat#beleidsdomein",
        // "http://www.w3.org/ns/org#holds",
        // "http://www.w3.org/ns/org#hasMembership",
        // "http://data.vlaanderen.be/ns/mandaat#isBestuurlijkeAliasVan",
        // "http://data.vlaanderen.be/ns/mandaat#status",
        // "http://mu.semte.ch/vocabularies/ext/lmb/hasPublicationStatus",
      ],
    },
    graphsToExclude: ['http://mu.semte.ch/graphs/besluiten-consumed'],
    graphTypesToExclude: ['http://mu.semte.ch/vocabularies/ext/FormHistory'],
  },
};

console.log('\n Environment variables:');
console.log(`\t AUTO_HEALING: ${AUTO_HEALING}`);
console.log(`\t CRON_HEALING: ${CRON_HEALING}`);
console.log(`\t LDES_STREAM_BASE: ${LDES_STREAM_BASE}`);
console.log(`\t LDES_STREAM: ${LDES_STREAM}`);
console.log(`\t DIRECT_DATABASE_ENDPOINT: ${DIRECT_DATABASE_ENDPOINT}`);
console.log(`\t LDES_DUMP_GRAPH: ${LDES_DUMP_GRAPH}`);
console.log(`\t TRANSFORMED_LDES_GRAPH: ${TRANSFORMED_LDES_GRAPH}`);
console.log(`\t BATCH_SIZE: ${BATCH_SIZE}`);
console.log(`\t EXTRA_HEADERS: ${JSON.stringify(EXTRA_HEADERS)}`);
console.log(`\t CONFIG: ${JSON.stringify(CONFIG)}`);
