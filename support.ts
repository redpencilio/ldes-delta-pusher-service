// @ts-ignore
import { sparqlEscapeUri, sparqlEscapeString } from "mu";
import fetch from "node-fetch";
import { LDES_ENDPOINT, LDES_FRAGMENTER } from "./config";
import { Changeset, Quad, Term } from "./types";


export function toSparqlTerm(thing: Term): string {
	if (thing.type == "uri") return sparqlEscapeUri(thing.value);
	else return sparqlEscapeString(thing.value);
}

export function toSparqlTriple(quad: Quad): string {
	return `${toSparqlTerm(quad.subject)} ${toSparqlTerm(
		quad.predicate
	)} ${toSparqlTerm(quad.object)}.`;
}

async function sendLDESRequest(uri: string, body: string) {
	const queryParams = new URLSearchParams({
		resource: uri,
		...(LDES_FRAGMENTER && { fragmenter: LDES_FRAGMENTER })
	});

	return fetch(`${LDES_ENDPOINT}?` + queryParams, {
		method: "POST",
		headers: {
			"Content-Type": "text/turtle",
		},
		body: body,
	});
}

export async function moveTriples(changesets: Changeset[]) {
	for (const { inserts } of changesets) {
		if (inserts.length) {
			let subject = inserts[0].subject.value;
			let turtleBody = "";
			inserts.forEach((triple) => {
				turtleBody += toSparqlTriple(triple) + "\n";
			});
			let response = await sendLDESRequest(subject, turtleBody);
		}
	}
}
