import { querySudo } from "@lblod/mu-auth-sudo";
import { sparqlEscapeUri } from "mu";

import {
  EXTRA_HEADERS,
  LDES_DUMP_GRAPH,
  TRANSFORMED_LDES_GRAPH,
} from "./environment";
import { DIRECT_DB_ENDPOINT } from "../config";

export async function transformLdesDataToEntities() {
  await querySudo(
    `
    PREFIX tree: <https://w3id.org/tree#>
    PREFIX dct: <http://purl.org/dc/terms/>
    PREFIX prov: <http://www.w3.org/ns/prov#>

    INSERT {
      GRAPH ${sparqlEscapeUri(TRANSFORMED_LDES_GRAPH)} {
        ?entity ?p ?o.
      }
    }
    WHERE {
      GRAPH ${sparqlEscapeUri(LDES_DUMP_GRAPH)} {
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
    EXTRA_HEADERS,
    { sparqlEndpoint: DIRECT_DB_ENDPOINT }
  );
}
