import { updateSudo } from '@lblod/mu-auth-sudo';
import { sparqlEscapeUri, sparqlEscapeString } from 'mu';
import ForkingStore from 'forking-store';
import { NamedNode } from 'rdflib';

import {
  BATCH_SIZE,
  EXTRA_HEADERS,
  LDES_DUMP_GRAPH,
} from './environment';
import { DIRECT_DB_ENDPOINT } from '../config';

export async function clearLdesDumpGraph(): Promise<void> {
  await updateSudo(`DROP SILENT GRAPH <${LDES_DUMP_GRAPH}>`, EXTRA_HEADERS, {
    sparqlEndpoint: DIRECT_DB_ENDPOINT,
  });
}

export async function insertLdesPageToDumpGraph(
  turtleText: string,
): Promise<void> {
  const tripleStore = new ForkingStore();
  const graph = new NamedNode('http://data.lblod.info/triples');
  tripleStore.parse(turtleText, graph, 'text/turtle');
  const statements = [...tripleStore.graph.statements];
  const tripleCount = statements.length;
  for (let index = 0; index < tripleCount; index += BATCH_SIZE) {
    const batch = statements.splice(0, BATCH_SIZE);
    if (batch.length === 0) {
      continue;
    }
    await addTriplesToLDesDumpGraph(mapStatementsToTriple(batch).join('\n'));
  }
}

function mapStatementsToTriple(statements: any[]) {
  return statements.map((st) => {
    const subject = formatValueForTermType(
      st.subject.value,
      st.subject.termType,
    );
    const predicate = formatValueForTermType(
      st.predicate.value,
      st.predicate.termType,
    );
    const object = formatValueForTermType(st.object.value, st.object.termType);

    return `${subject} ${predicate} ${object} .`;
  });
}

function formatValueForTermType(value: string, termType: string) {
  const map = {
    NamedNode: sparqlEscapeUri(value),
    Literal: sparqlEscapeString(value),
  };

  return map[termType];
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
    { sparqlEndpoint: DIRECT_DB_ENDPOINT },
  );
}
