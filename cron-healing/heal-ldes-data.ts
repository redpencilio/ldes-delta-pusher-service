import { querySudo } from '@lblod/mu-auth-sudo';
import { sparqlEscapeUri } from 'mu';

import {
  CONFIG,
  DIRECT_DATABASE_ENDPOINT,
  EXTRA_HEADERS,
  LDES_DUMP_GRAPH,
  TRANSFORMED_LDES_GRAPH,
} from './environment';

export async function healEntities(stream: string): Promise<void> {
  const rdfTypes = Object.keys(CONFIG[stream].entities);
  for (const type of rdfTypes) {
    await getDifferences(type, stream);
    // TODO: create fake changeSet and call dispatch method
  }
}


async function getDifferences(type: string, stream: string) {
  const properties = CONFIG[stream].entities[type];
  const valuesProperties = properties
    .map((p: string) => sparqlEscapeUri(p))
    .join('\n');

  const excludedGraphs = CONFIG[stream].graphsToExclude;
  excludedGraphs.push(LDES_DUMP_GRAPH);
  excludedGraphs.push(TRANSFORMED_LDES_GRAPH);
  const excludeGraphs = excludedGraphs
    .map((graph: string) => sparqlEscapeUri(graph))
    .join(', ');

  const graphTypesToExclude = CONFIG[stream].graphTypesToExclude
    .map((graph: string) => sparqlEscapeUri(graph))
    .join('\n');


  const ldesValues = await getMissingValuesLdes({ type, valuesProperties, graphTypesToExclude, excludeGraphs });
  const excessLdesValues = await getExcessValuesLdes({ type, valuesProperties, graphTypesToExclude, excludeGraphs });
  console.log({ ldesValues: JSON.stringify(ldesValues) });
  console.log({ excessLdesValues: JSON.stringify(excessLdesValues) });
}

async function getExcessValuesLdes(options: {
  type: string,
  valuesProperties: string,
  graphTypesToExclude: string,
  excludeGraphs: string
}) {
  const { graphTypesToExclude, valuesProperties, type, excludeGraphs } = options;

  return await querySudo(
    `
    SELECT DISTINCT ?subject ?predicate ?object
    WHERE {
      VALUES ?excludeGraphType { ${graphTypesToExclude} }
      VALUES ?predicate { ${valuesProperties} }

      GRAPH ${sparqlEscapeUri(TRANSFORMED_LDES_GRAPH)} {
        ?subject a ${sparqlEscapeUri(type)}.
        ?subject ?predicate ?object.
      }

      FILTER NOT EXISTS {
        GRAPH ?graph {
          ?subject ?predicate ?object.
        }

        FILTER(?graph NOT IN (${excludeGraphs}))
        FILTER NOT EXISTS {
          ?graph a ?excludeGraphType.
        }
      }
      
    }   LIMIT 10
  `,
    EXTRA_HEADERS,
    { sparqlEndpoint: DIRECT_DATABASE_ENDPOINT },
  );
}
async function getMissingValuesLdes(options: {
  type: string,
  valuesProperties: string,
  graphTypesToExclude: string,
  excludeGraphs: string
}) {
  const { graphTypesToExclude, valuesProperties, type, excludeGraphs } = options;

  return await querySudo(
    `
    SELECT DISTINCT ?subject ?predicate ?object
    WHERE {
      VALUES ?excludeGraphType { ${graphTypesToExclude} }
      VALUES ?predicate { ${valuesProperties} }

      GRAPH ?graph {
        ?subject a ${sparqlEscapeUri(type)}.
        ?subject ?predicate ?object.
      }
      FILTER(?graph NOT IN (${excludeGraphs}))

      FILTER NOT EXISTS {
        ?graph a ?excludeGraphType.
      }

      FILTER NOT EXISTS {
        GRAPH ${sparqlEscapeUri(TRANSFORMED_LDES_GRAPH)} {
          ?subject ?predicate ?object.
        }
      }
      
    }   LIMIT 10
  `,
    EXTRA_HEADERS,
    { sparqlEndpoint: DIRECT_DATABASE_ENDPOINT },
  );
}
