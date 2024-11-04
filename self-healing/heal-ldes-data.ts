import { querySudo, updateSudo } from "@lblod/mu-auth-sudo";
import { sparqlEscapeUri, sparqlEscapeDateTime } from "mu";
import dispatch from "../config/dispatch";
import {
  HEALING_DUMP_GRAPH,
  HEALING_TRANSFORMED_GRAPH,
  DIRECT_DB_ENDPOINT,
  HEALING_LIMIT,
} from "../config";
import { HealingConfig } from "../config/healing";

export async function healEntities(
  stream: string,
  config: HealingConfig
): Promise<void> {
  const rdfTypes = Object.keys(config[stream].entities);
  for (const type of rdfTypes) {
    await erectMissingTombstones(type, stream, config);
    const differences = await getDifferences(type, stream, config);
    await triggerRecreate(differences);
  }
}

async function triggerRecreate(differences) {
  const uniqueSubjects = [
    ...new Set<string>(differences.map((difference) => difference.s.value)),
  ];
  if (uniqueSubjects.length === 0) {
    console.log("No differences found.");
    return;
  }
  const subjectTypes = await getSubjectTypes(uniqueSubjects);
  const inserts = subjectTypes.map((s) => {
    // fake everything but the subject
    return {
      subject: { value: s.subject, type: "uri" },
      predicate: {
        value: "http://www.w3.org/1999/02/22-rdf-syntax-ns#type",
        type: "uri",
      },
      object: { value: s.type, type: "uri" },
      graph: { value: "http://mu.semte.ch/graphs/application", type: "uri" },
    };
  });

  console.log(
    `Inserting ${inserts.length} triples: ${JSON.stringify(inserts)}`
  );

  await dispatch([
    {
      inserts,
      deletes: [],
    },
  ]);
}

async function getSubjectTypes(subjects: string[]) {
  const result = await querySudo(
    `
    PREFIX ext: <http://mu.semte.ch/vocabularies/ext/>
    SELECT DISTINCT ?s ?type
    WHERE {
      VALUES ?s { ${subjects.map(sparqlEscapeUri).join(" ")} }
      GRAPH ?g {
        ?s a ?type.
      }
      ?g ext:ownedBy ?eenheid.
    }
  `
  );

  return result.results.bindings.map((binding) => {
    return {
      subject: binding.s.value,
      type: binding.type.value,
    };
  });
}

async function getDifferences(
  type: string,
  stream: string,
  config: HealingConfig
) {
  const predicates =
    config[stream].entities[type].healingPredicates ||
    config[stream].entities[type];
  const predicateValues = predicates
    .map((p: string) => sparqlEscapeUri(p))
    .join("\n");
  const filter = config[stream].entities[type].instanceFilter || "";

  const excludedGraphs = config[stream].graphsToExclude;
  excludedGraphs.push(HEALING_DUMP_GRAPH);
  excludedGraphs.push(HEALING_TRANSFORMED_GRAPH);
  const excludeGraphs = excludedGraphs
    .map((graph: string) => sparqlEscapeUri(graph))
    .join(", ");

  const graphTypesToExclude = config[stream].graphTypesToExclude
    .map((graph: string) => sparqlEscapeUri(graph))
    .join("\n");

  const missingLdesValues = await getMissingValuesLdes({
    type,
    predicateValues,
    filter,
    graphTypesToExclude,
    excludeGraphs,
  });
  // only looking for missing values on the ldes, excess values bring hard challenges like how did they even get here? should we purge them or is a tombstone enough? were they just not filtered out correctly?
  console.log(
    `Found ${missingLdesValues.length} missing values: ${JSON.stringify(
      missingLdesValues
    )}`
  );
  return missingLdesValues;
}

async function getMissingValuesLdes(options: {
  type: string;
  predicateValues: string;
  filter: string;
  graphTypesToExclude: string;
  excludeGraphs: string;
}) {
  const { graphTypesToExclude, predicateValues, filter, type, excludeGraphs } =
    options;

  const result = await querySudo(
    `
    SELECT DISTINCT ?s ?p ?o
    WHERE {
      VALUES ?excludeGraphType { ${graphTypesToExclude} }
      VALUES ?p { ${predicateValues} }

      GRAPH ?graph {
        ?s a ${sparqlEscapeUri(type)}.
        ?s ?p ?o.

        ${filter}
      }
      FILTER(?graph NOT IN (${excludeGraphs}))

      FILTER NOT EXISTS {
        ?graph a ?excludeGraphType.
      }

      FILTER NOT EXISTS {
        GRAPH ${sparqlEscapeUri(HEALING_TRANSFORMED_GRAPH)} {
          ?s ?p ?o.
        }
      }

    }   LIMIT ${HEALING_LIMIT}
  `,
    {},
    { sparqlEndpoint: DIRECT_DB_ENDPOINT }
  );
  return result.results.bindings.map((binding) => binding);
}

async function erectMissingTombstones(
  type: string,
  stream: string,
  config: HealingConfig
) {
  const graphTypesToExclude = config[stream].graphTypesToExclude;
  const excludedGraphs = config[stream].graphsToExclude;
  let excludeGraphsFilter = "";
  if (excludedGraphs?.length > 0) {
    excludeGraphsFilter = excludedGraphs
      .map((graph: string) => sparqlEscapeUri(graph))
      .join(", ");
    excludeGraphsFilter = `FILTER(?targetGraph NOT IN (${excludeGraphsFilter}))`;
  }
  let excludeGraphTypesFilter = "";
  let excludeGraphTypeValues = "";
  if (graphTypesToExclude?.length > 0) {
    excludeGraphTypeValues = graphTypesToExclude
      .map((type: string) => sparqlEscapeUri(type))
      .join("\n ");
    excludeGraphTypeValues = `VALUES ?excludeGraphType { ${excludeGraphTypeValues} }`;
    excludeGraphTypesFilter = `FILTER NOT EXISTS {
      ?targetGraph a ?excludedGraphType.
    }`;
  }

  const where = `
      GRAPH ${sparqlEscapeUri(HEALING_TRANSFORMED_GRAPH)} {
        ?s a ${sparqlEscapeUri(type)}.
      }
      FILTER NOT EXISTS {
        ${excludeGraphTypeValues}
        GRAPH ?targetGraph {
          ?s a ${sparqlEscapeUri(type)}.
        }

        ${excludeGraphsFilter}
        ${excludeGraphTypesFilter}
      }`;

  const count = await querySudo(`
    SELECT (COUNT(DISTINCT ?s) as ?count)
    WHERE {
      ${where}
    }
  `);
  if (parseInt(count.results.bindings[0]?.count?.value || "0") < 1) {
    console.log(`No missing tombstones to erect for ${type}`);
    return;
  }
  console.log(
    `Found ${count.results.bindings[0].count.value} missing tombstones for ${type}. Erecting...`
  );

  // we're putting the tombstones into the public graph. we don't know the graph they should have been put in
  // and this is the best we can to to heal
  await updateSudo(`
    PREFIX astreams: <http://www.w3.org/ns/activitystreams#>
    PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>
    PREFIX dct: <http://purl.org/dc/terms/>
    INSERT {
      GRAPH <http://mu.semte.ch/graphs/public> {
        ?s a astreams:Tombstone ;
           astreams:deleted ${sparqlEscapeDateTime(new Date())} ;
           dct:modified ${sparqlEscapeDateTime(new Date())} ;
           astreams:formerType ${sparqlEscapeUri(type)} .
      }
    }
    WHERE {
      ${where}
    }
  `);
}
