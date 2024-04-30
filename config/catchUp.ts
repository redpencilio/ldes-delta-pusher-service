import { moveTriples } from "../support";
import { CatchupPageItem } from "../types";
import { sparqlEscapeUri } from "mu";
import { querySudo as query } from "@lblod/mu-auth-sudo";

// this is a pretty naive example implementation. Your own implementation will depend on the data you want to post to LDES.
export const handlePage = async (items: CatchupPageItem[]) => {
  const result = await query(`
    CONSTRUCT {
      ?s ?p ?o .
    } WHERE {
      ?s ?p ?o .
      VALUES ?s {
        ${items.map((item) => sparqlEscapeUri(item.uri)).join(" ")}
      }
    }
  `);

  const inserts = result.results.bindings.map((binding) => {
    return {
      subject: binding.s,
      predicate: binding.p,
      object: binding.o,
    };
  });

  return moveTriples([{ inserts, deletes: [] }]);
};
