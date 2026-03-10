// @ts-ignore
import { sparqlEscapeUri, sparqlEscape, sparqlEscapeBool } from "mu";
import { LDES_FOLDER, LDES_FRAGMENTER } from "./environment";
import { Changeset, Quad, Term } from "./types";
import { addData, getConfigFromEnv } from "@lblod/ldes-producer";

const ldesProducerConfig = getConfigFromEnv();
console.log("ldesProducerConfig", ldesProducerConfig);

const datatypeNames = {
  "http://www.w3.org/2001/XMLSchema#dateTime": "dateTime",
  "http://www.w3.org/2001/XMLSchema#date": "date",
  "http://www.w3.org/2001/XMLSchema#decimal": "decimal",
  "http://www.w3.org/2001/XMLSchema#integer": "int",
  "http://www.w3.org/2001/XMLSchema#float": "float",
  "http://www.w3.org/2001/XMLSchema#boolean": "bool",
};
const sparqlEscapeObject = (bindingObject: Term): string => {
  if (bindingObject["xml:lang"]) {
    const safeValue = sparqlEscape(bindingObject.value, "string");
    return `"${safeValue}"@${bindingObject["xml:lang"]}`;
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
      bindingObject.value?.toLowerCase() === "true";
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
  changesets: Changeset[],
  stream = LDES_FOLDER
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
    fragmenter: LDES_FRAGMENTER,
  });
}
