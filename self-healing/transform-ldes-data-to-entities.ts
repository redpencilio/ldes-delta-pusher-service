import { querySudo } from "@lblod/mu-auth-sudo";
import { sparqlEscapeUri } from "mu";

import { HEALING_DUMP_GRAPH, HEALING_TRANSFORMED_GRAPH } from "../config";
import { DIRECT_DB_ENDPOINT } from "../config";

export async function transformLdesDataToEntities() {
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

        FILTER NOT EXISTS {
          ?ldesStream tree:member ?ldesEntityTwo.
          ?ldesEntityTwo dct:isVersionOf ?entity.
          ?ldesEntityTwo prov:generatedAtTime ?otherTime.

          FILTER( ?otherTime > ?time )
        }
      }
    }
  `,
    {},
    { sparqlEndpoint: DIRECT_DB_ENDPOINT }
  );
}
