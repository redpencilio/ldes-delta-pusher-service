// @ts-ignore
import { sparqlEscapeUri, sparqlEscape, sparqlEscapeBool } from "mu";
import ENV from "./environment";
import { DeltaChangeset, Quad, Term } from "./types";
import { addData, getConfigFromEnv } from "@lblod/ldes-producer";

const ldesProducerConfig = getConfigFromEnv();
console.log("ldesProducerConfig", ldesProducerConfig);

const datatypeNames: Record<string, string> = {
  "http://www.w3.org/2001/XMLSchema#dateTime": "dateTime",
  "http://www.w3.org/2001/XMLSchema#date": "date",
  "http://www.w3.org/2001/XMLSchema#decimal": "decimal",
  "http://www.w3.org/2001/XMLSchema#integer": "int",
  "http://www.w3.org/2001/XMLSchema#float": "float",
  "http://www.w3.org/2001/XMLSchema#boolean": "bool",
};
const sparqlEscapeObject = (bindingObject: Term): string => {
  // Might not be ideal: two ways of anotating language
  //   xml:lang  conforms to https://www.w3.org/TR/sparql11-results-json/
  //   lang      conforms to https://www.w3.org/TR/rdf-json/
  // We look for both to capture all intentions.
  // One is coming sparql results set, the other from delta-notifier...
  const lang = bindingObject["xml:lang"] || bindingObject.lang;
  if (lang) {
    const safeValue = sparqlEscape(bindingObject.value, "string");
    return `${safeValue}@${lang}`;
  }

  const escapeType = datatypeNames[bindingObject?.datatype || ""] || "string";
  if (bindingObject.datatype === "http://www.w3.org/2001/XMLSchema#dateTime") {
    // sparqlEscape formats it slightly differently and then the comparison breaks in healing
    const safeValue = `${bindingObject.value}`;
    return `"${safeValue.split('"').join("")}"^^xsd:dateTime`;
  }
  if (bindingObject.datatype === "http://www.w3.org/2001/XMLSchema#boolean") {
    const value =
      bindingObject.value === true ||
      bindingObject.value === 1 ||
      (typeof bindingObject.value === 'string' && bindingObject.value?.toLowerCase() === "true");
    return sparqlEscapeBool(value);
  }
  return bindingObject.type === "uri"
    ? sparqlEscapeUri(bindingObject.value)
    : sparqlEscape(bindingObject.value, escapeType);
};

export function toSparqlTriple(quad: Quad): string {
  return `${sparqlEscapeObject(quad.subject)} ${sparqlEscapeObject(
    quad.predicate
  )} ${sparqlEscapeObject(quad.object)}.`;
}

export async function moveTriples(
  changesets: DeltaChangeset[],
  stream = ENV.LDES_FOLDER
) {
  let turtleBody = "";
  for (const { inserts } of changesets) {
    if (inserts.length) {
      inserts.forEach((triple) => {
        turtleBody += toSparqlTriple(triple);
      });
    }
  }
  if (!turtleBody.length) {
    console.log("nothing to do.");
    return;
  }

  turtleBody =
    "@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .\n" + turtleBody;

  await addData(ldesProducerConfig, {
    contentType: "text/turtle",
    folder: stream,
    body: turtleBody,
    fragmenter: ENV.LDES_FRAGMENTER,
  });
}
