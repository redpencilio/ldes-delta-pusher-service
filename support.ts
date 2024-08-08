// @ts-ignore
import { sparqlEscapeUri, sparqlEscapeString } from "mu";
import { LDES_FOLDER, LDES_FRAGMENTER } from "./config";
import { Changeset, Quad, Term } from "./types";

import { addData, getConfigFromEnv } from "@lblod/ldes-producer";
const ldesProducerConfig = getConfigFromEnv();

export function toSparqlTerm(thing: Term): string {
	if (thing.type == "uri") return sparqlEscapeUri(thing.value);
	else return sparqlEscapeString(thing.value);
}

export function toSparqlTriple(quad: Quad): string {
	return `${toSparqlTerm(quad.subject)} ${toSparqlTerm(
		quad.predicate,
	)} ${toSparqlTerm(quad.object)}.`;
}

export async function moveTriples(changesets: Changeset[]) {
	for (const { inserts } of changesets) {
		if (inserts.length) {
			let turtleBody = "";
			inserts.forEach((triple) => {
				turtleBody += toSparqlTriple(triple) + "\n";
			});
			await addData(ldesProducerConfig, {
				contentType: "text/turtle",
				folder: LDES_FOLDER,
				body: turtleBody,
				fragmenter: LDES_FRAGMENTER,
			});
		}
	}
}
