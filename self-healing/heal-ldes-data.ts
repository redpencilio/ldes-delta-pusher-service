import { querySudo } from "@lblod/mu-auth-sudo";
import { sparqlEscapeUri } from "mu";

import {
  CONFIG,
  EXTRA_HEADERS,
  LDES_DUMP_GRAPH,
  TRANSFORMED_LDES_GRAPH,
} from "./environment";
import { DIRECT_DB_ENDPOINT } from "../config";
import dispatch from "../config/dispatch";

export async function healEntities(stream: string): Promise<void> {
  const rdfTypes = Object.keys(CONFIG[stream].entities);
  for (const type of rdfTypes) {
    const differences = await getDifferences(type, stream);
    await triggerRecreate(differences);
  }
}

async function triggerRecreate(differences) {
  const uniqueSubjects = [
    ...new Set<string>(
      differences.map((difference) => difference.subject.value)
    ),
  ];
  const subjectTypes = await getSubjectTypes(uniqueSubjects);
  const inserts = subjectTypes.map((s) => {
    return {
      subject: { value: s.subject, type: "uri" },
      predicate: { value: "a", type: "uri" },
      object: { value: s.type, type: "uri" },
    };
  });

  console.log(
    `Inserting ${inserts.length} triples: ${JSON.stringify(inserts)}`
  );

  // await dispatch([
  //   {
  //     inserts,
  //     deletes: [],
  //   },
  // ]);
}

async function getSubjectTypes(subjects: string[]) {
  const result = await querySudo(
    `
    SELECT DISTINCT ?subject ?type
    WHERE {
      VALUES ?subject { ${subjects.map(sparqlEscapeUri).join(" ")} }
      ?subject a ?type.
    }
  `
  );

  return result.results.bindings.map((binding) => {
    return {
      subject: binding.subject.value,
      type: binding.type.value,
    };
  });
}

async function getDifferences(type: string, stream: string) {
  const properties = CONFIG[stream].entities[type];
  const valuesProperties = properties
    .map((p: string) => sparqlEscapeUri(p))
    .join("\n");

  const excludedGraphs = CONFIG[stream].graphsToExclude;
  excludedGraphs.push(LDES_DUMP_GRAPH);
  excludedGraphs.push(TRANSFORMED_LDES_GRAPH);
  const excludeGraphs = excludedGraphs
    .map((graph: string) => sparqlEscapeUri(graph))
    .join(", ");

  const graphTypesToExclude = CONFIG[stream].graphTypesToExclude
    .map((graph: string) => sparqlEscapeUri(graph))
    .join("\n");

  const missingLdesValues = await getMissingValuesLdes({
    type,
    valuesProperties,
    graphTypesToExclude,
    excludeGraphs,
  });
  const excessLdesValues = await getExcessValuesLdes({
    type,
    valuesProperties,
    graphTypesToExclude,
    excludeGraphs,
  });
  console.log(
    `Found ${missingLdesValues.length} missing values: ${JSON.stringify(
      missingLdesValues
    )}`
  );
  console.log(
    `Found ${excessLdesValues.length} excess values: ${JSON.stringify(
      excessLdesValues
    )}`
  );
  return [...missingLdesValues, excessLdesValues];
}

async function getExcessValuesLdes(options: {
  type: string;
  valuesProperties: string;
  graphTypesToExclude: string;
  excludeGraphs: string;
}) {
  const { graphTypesToExclude, valuesProperties, type, excludeGraphs } =
    options;

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
    { sparqlEndpoint: DIRECT_DB_ENDPOINT }
  );
}
async function getMissingValuesLdes(options: {
  type: string;
  valuesProperties: string;
  graphTypesToExclude: string;
  excludeGraphs: string;
}) {
  const { graphTypesToExclude, valuesProperties, type, excludeGraphs } =
    options;

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
    { sparqlEndpoint: DIRECT_DB_ENDPOINT }
  );
}
