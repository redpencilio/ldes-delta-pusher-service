import { updateSudo } from "@lblod/mu-auth-sudo";
import { sparqlEscapeUri, sparqlEscapeString, sparqlEscape } from "mu";
import ForkingStore from "forking-store";
import { NamedNode } from "rdflib";

import {
  BATCH_SIZE,
  EXTRA_HEADERS,
  LDES_DUMP_GRAPH,
  TRANSFORMED_LDES_GRAPH,
} from "./environment";
import { DIRECT_DB_ENDPOINT } from "../config";

export async function clearHealingTempGraphs(): Promise<void> {
  await updateSudo(`DROP SILENT GRAPH <${LDES_DUMP_GRAPH}>`, EXTRA_HEADERS, {
    sparqlEndpoint: DIRECT_DB_ENDPOINT,
  });
  await updateSudo(
    `DROP SILENT GRAPH <${TRANSFORMED_LDES_GRAPH}>`,
    EXTRA_HEADERS,
    {
      sparqlEndpoint: DIRECT_DB_ENDPOINT,
    }
  );
}

export async function insertLdesPageToDumpGraph(
  turtleText: string
): Promise<void> {
  const tripleStore = new ForkingStore();
  const graph = new NamedNode("http://data.lblod.info/triples");
  tripleStore.parse(turtleText, graph, "text/turtle");
  const statements = [...tripleStore.graph.statements];
  const tripleCount = statements.length;
  for (let index = 0; index < tripleCount; index += BATCH_SIZE) {
    const batch = statements.splice(0, BATCH_SIZE);
    if (batch.length === 0) {
      continue;
    }
    await addTriplesToLDesDumpGraph(mapStatementsToTriple(batch).join("\n"));
  }
}

function mapStatementsToTriple(statements: any[]) {
  return statements.map((st) => {
    const object = formatValueForTermType(st.object);

    return `${sparqlEscapeUri(st.subject.value)} ${sparqlEscapeUri(
      st.predicate.value
    )} ${object} .`;
  });
}

const datatypeNames = {
  "http://www.w3.org/2001/XMLSchema#dateTime": "dateTime",
  "http://www.w3.org/2001/XMLSchema#datetime": "dateTime",
  "http://www.w3.org/2001/XMLSchema#date": "date",
  "http://www.w3.org/2001/XMLSchema#decimal": "decimal",
  "http://www.w3.org/2001/XMLSchema#integer": "int",
  "http://www.w3.org/2001/XMLSchema#float": "float",
  "http://www.w3.org/2001/XMLSchema#boolean": "bool",
};

function formatValueForTermType(object) {
  if (object.termType === "NamedNode") {
    return sparqlEscapeUri(object.value);
  } else if (object.termType === "Literal") {
    // we can't use the sparqlEscape function because it can for instance add timezones to our
    // datetimes and then they are not considered equal to sparql
    if (
      object.datatype?.value === "http://www.w3.org/2001/XMLSchema#dateTime"
    ) {
      return `"${object.value}"^^<http://www.w3.org/2001/XMLSchema#dateTime>`;
    }

    if (object.datatype) {
      return `${sparqlEscape(
        object.value,
        datatypeNames[object.datatype.value] || "string"
      )}`;
    } else if (object.language) {
      return `${sparqlEscapeString(object.value)}@${object.language}`;
    } else {
      return sparqlEscapeString(object.value);
    }
  } else {
    throw new Error(`Unsupported term type ${object.termType}`);
  }
}

async function addTriplesToLDesDumpGraph(triples: string) {
  await updateSudo(
    `
      INSERT DATA {
        GRAPH ${sparqlEscapeUri(LDES_DUMP_GRAPH)} {
          ${triples}
        }
      }
    `,
    EXTRA_HEADERS,
    { sparqlEndpoint: DIRECT_DB_ENDPOINT, mayRetry: true }
  );
}
