import { querySudo, updateSudo } from "@lblod/mu-auth-sudo";
import { sparqlEscapeUri } from "mu";

import ENV from "../environment";

export async function transformLdesDataToEntities() {
  await transformRemainingEntities();
}

export async function transformRemainingEntities() {
  while (await hasRemainingEntities()) {
    await transformBatchOfRemainingEntities();
  }
}

async function transformBatchOfRemainingEntities() {
  await querySudo(
    `
    PREFIX tree: <https://w3id.org/tree#>
    PREFIX dct: <http://purl.org/dc/terms/>
    PREFIX prov: <http://www.w3.org/ns/prov#>

    INSERT {
      GRAPH ${sparqlEscapeUri(ENV.HEALING_TRANSFORMED_GRAPH)} {
        ?entity ?p ?o.
      }
    }
    WHERE {
      { SELECT ?ldesEntity WHERE {
          GRAPH ${sparqlEscapeUri(ENV.HEALING_DUMP_GRAPH)} {
            ?ldesStream tree:member ?ldesEntity.
            ?ldesEntity prov:generatedAtTime ?time.
          }
      } LIMIT 10000 }
      GRAPH ${sparqlEscapeUri(ENV.HEALING_DUMP_GRAPH)} {
        ?ldesEntity dct:isVersionOf ?entity.
        ?ldesEntity ?p ?o.
      }
    }
  `,
    {},
    { sparqlEndpoint: ENV.DIRECT_DB_ENDPOINT },
  );

  // delete and insert split because of Virtuoso 22003 Error SR017: aref: Bad array subscript (zero-based) 4 for an arg of type ARRAY_OF_POINTER (193) and length 2.
  await updateSudo(
    `
    PREFIX tree: <https://w3id.org/tree#>
    PREFIX dct: <http://purl.org/dc/terms/>
    PREFIX prov: <http://www.w3.org/ns/prov#>

    DELETE {
      GRAPH ${sparqlEscapeUri(ENV.HEALING_DUMP_GRAPH)} {
        ?ldesStream tree:member ?ldesEntity.
      }
    }
    WHERE {
      GRAPH ${sparqlEscapeUri(ENV.HEALING_TRANSFORMED_GRAPH)} {
        ?entity dct:isVersionOf ?entity.
      }
      GRAPH ${sparqlEscapeUri(ENV.HEALING_DUMP_GRAPH)} {
        ?ldesStream tree:member ?ldesEntity.
        ?ldesEntity dct:isVersionOf ?entity.
      }
    }`,
    {},
    { sparqlEndpoint: ENV.DIRECT_DB_ENDPOINT },
  );
}

async function hasRemainingEntities() {
  const result = await querySudo(
    `
    PREFIX tree: <https://w3id.org/tree#>
    PREFIX dct: <http://purl.org/dc/terms/>
    PREFIX prov: <http://www.w3.org/ns/prov#>

    SELECT (COUNT(DISTINCT(?ldesEntity)) as ?count) WHERE {
      GRAPH ${sparqlEscapeUri(ENV.HEALING_DUMP_GRAPH)} {
        ?ldesStream tree:member ?ldesEntity.
        ?ldesEntity dct:isVersionOf ?entity.
        ?ldesEntity prov:generatedAtTime ?time.
      }
    }`,
    {},
    { sparqlEndpoint: ENV.DIRECT_DB_ENDPOINT },
  );
  if (!result) {
    return false;
  }
  const count = parseInt(result.results.bindings[0].count.value);
  console.log(`Remaining entities: ${count}`);
  return count > 0;
}
