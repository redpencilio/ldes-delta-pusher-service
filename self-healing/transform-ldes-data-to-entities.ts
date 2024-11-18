import { querySudo, updateSudo } from "@lblod/mu-auth-sudo";
import { sparqlEscapeUri } from "mu";

import { HEALING_DUMP_GRAPH, HEALING_TRANSFORMED_GRAPH } from "../config";
import { DIRECT_DB_ENDPOINT } from "../config";

export async function transformLdesDataToEntities() {
  while (await hasMoreDuplicates()) {
    await deleteBatch();
  }
  await transformRemainingEntities();
}

async function hasMoreDuplicates() {
  const result = await querySudo(`
  PREFIX tree: <https://w3id.org/tree#>
  PREFIX dct: <http://purl.org/dc/terms/>
  PREFIX prov: <http://www.w3.org/ns/prov#>

  SELECT * WHERE {
    ?ldesStream tree:member ?toDelete.
    ?toDelete dct:isVersionOf ?entity.
    ?toDelete prov:generatedAtTime ?time.

    ?ldesStream2 tree:member ?ldesEntityTwo.
    ?ldesEntityTwo dct:isVersionOf ?entity.
    ?ldesEntityTwo prov:generatedAtTime ?otherTime.
    FILTER(?ldesEntityTwo != ?toDelete)

    FILTER( ?otherTime > ?time )
  } LIMIT 1`);
  return result.results.bindings.length > 0;
}

async function deleteBatch() {
  // using ldesstream2 in case the stream name changed
  // we're sure to still be following the same stream because
  // the dump graph is cleared at the start
  await updateSudo(
    `
    PREFIX tree: <https://w3id.org/tree#>
    PREFIX dct: <http://purl.org/dc/terms/>
    PREFIX prov: <http://www.w3.org/ns/prov#>
    PREFIX ext: <http://mu.semte.ch/vocabularies/ext/>

    INSERT {
      GRAPH ${sparqlEscapeUri(HEALING_DUMP_GRAPH)} {
        ?toDelete ext:willDelete true.
      }
    }
    WHERE {
      GRAPH ${sparqlEscapeUri(HEALING_DUMP_GRAPH)} {
        ?ldesStream tree:member ?toDelete.
        ?toDelete dct:isVersionOf ?entity.
        ?toDelete prov:generatedAtTime ?time.

        ?ldesStream2 tree:member ?ldesEntityTwo.
        ?ldesEntityTwo dct:isVersionOf ?entity.
        ?ldesEntityTwo prov:generatedAtTime ?otherTime.

        FILTER(?ldesEntityTwo != ?toDelete)

        FILTER( ?otherTime > ?time )
      }
    } LIMIT 10000
  `,
    {},
    { sparqlEndpoint: DIRECT_DB_ENDPOINT }
  );

  await updateSudo(
    `
    PREFIX tree: <https://w3id.org/tree#>
    PREFIX dct: <http://purl.org/dc/terms/>
    PREFIX prov: <http://www.w3.org/ns/prov#>
    PREFIX ext: <http://mu.semte.ch/vocabularies/ext/>
    DELETE {
      GRAPH ${sparqlEscapeUri(HEALING_DUMP_GRAPH)} {
        ?ldesStream tree:member ?toDelete.
        ?toDelete ?p ?o.
      }
    }
    WHERE {
      GRAPH ${sparqlEscapeUri(HEALING_DUMP_GRAPH)} {
        ?toDelete ext:willDelete true.
        ?toDelete ?p ?o.
      }
    }`,
    {},
    { sparqlEndpoint: DIRECT_DB_ENDPOINT }
  );
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
      GRAPH ${sparqlEscapeUri(HEALING_TRANSFORMED_GRAPH)} {
        ?entity ?p ?o.
      }
    }
    WHERE {
      { SELECT ?ldesEntity WHERE {
          GRAPH ${sparqlEscapeUri(HEALING_DUMP_GRAPH)} {
            ?ldesStream tree:member ?ldesEntity.
            ?ldesEntity prov:generatedAtTime ?time.
          }
      } LIMIT 10000 }
      GRAPH ${sparqlEscapeUri(HEALING_DUMP_GRAPH)} {
        ?ldesEntity dct:isVersionOf ?entity.
        ?ldesEntity ?p ?o.
      }
    }
  `,
    {},
    { sparqlEndpoint: DIRECT_DB_ENDPOINT }
  );

  // delete and insert split because of Virtuoso 22003 Error SR017: aref: Bad array subscript (zero-based) 4 for an arg of type ARRAY_OF_POINTER (193) and length 2.
  await updateSudo(
    `
    PREFIX tree: <https://w3id.org/tree#>
    PREFIX dct: <http://purl.org/dc/terms/>
    PREFIX prov: <http://www.w3.org/ns/prov#>

    DELETE {
      GRAPH ${sparqlEscapeUri(HEALING_DUMP_GRAPH)} {
        ?ldesStream tree:member ?ldesEntity.
      }
    }
    WHERE {
      GRAPH ${sparqlEscapeUri(HEALING_TRANSFORMED_GRAPH)} {
        ?entity dct:isVersionOf ?entity.
      }
      GRAPH ${sparqlEscapeUri(HEALING_DUMP_GRAPH)} {
        ?ldesStream tree:member ?ldesEntity.
        ?ldesEntity dct:isVersionOf ?entity.
      }
    }`,
    {},
    { sparqlEndpoint: DIRECT_DB_ENDPOINT }
  );
}

async function hasRemainingEntities() {
  const result = await querySudo(
    `
    PREFIX tree: <https://w3id.org/tree#>
    PREFIX dct: <http://purl.org/dc/terms/>
    PREFIX prov: <http://www.w3.org/ns/prov#>

    SELECT (COUNT(DISTINCT(?ldesEntity)) as ?count) WHERE {
      GRAPH ${sparqlEscapeUri(HEALING_DUMP_GRAPH)} {
        ?ldesStream tree:member ?ldesEntity.
        ?ldesEntity dct:isVersionOf ?entity.
        ?ldesEntity prov:generatedAtTime ?time.
      }
    }`,
    {},
    { sparqlEndpoint: DIRECT_DB_ENDPOINT }
  );
  const count = parseInt(result.results.bindings[0].count.value);
  console.log(`Remaining entities: ${count}`);
  return count > 0;
}
