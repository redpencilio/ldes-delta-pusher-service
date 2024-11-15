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

    ?ldesStream tree:member ?ldesEntityTwo.
    ?ldesEntityTwo dct:isVersionOf ?entity.
    ?ldesEntityTwo prov:generatedAtTime ?otherTime.
    FILTER(?ldesEntityTwo != ?toDelete)

    FILTER( ?otherTime > ?time )
  } LIMIT 1`);
  return result.results.bindings.length > 0;
}

async function deleteBatch() {
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

        ?ldesStream tree:member ?ldesEntityTwo.
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
      GRAPH ${sparqlEscapeUri(HEALING_DUMP_GRAPH)} {
        ?ldesStream tree:member ?ldesEntity.
        ?ldesEntity ?p ?o.
        ?ldesEntity dct:isVersionOf ?entity.
        ?ldesEntity prov:generatedAtTime ?time.
      }
    }
  `,
    {},
    { sparqlEndpoint: DIRECT_DB_ENDPOINT }
  );
}
