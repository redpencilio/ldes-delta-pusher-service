import { sparqlEscapeUri, sparqlEscapeString } from "mu";

export function toSparqlTerm(thing): string {
	if (thing.type == "uri") return sparqlEscapeUri(thing.value);
	else return sparqlEscapeString(thing.value);
}

export function toSparqlTriple(quad): string {
	return `${toSparqlTerm(quad.subject)} ${toSparqlTerm(
		quad.predicate
	)} ${toSparqlTerm(quad.object)}.`;
}

async function sendLDESRequest(uri, body) {
	const queryParams = new URLSearchParams({
		resource: uri,
		stream: process.env.LDES_STREAM,
		"relation-path": process.env.LDES_RELATION_PATH,
		fragmenter: process.env.LDES_FRAGMENTER,
	});

	return fetch(`${process.env.LDES_ENDPOINT}?` + queryParams, {
		method: "POST",
		headers: {
			"Content-Type": "text/turtle",
		},
		body: body,
	});
}

export async function moveTriples(changesets) {
	for (const { inserts, _ } of changesets) {
		if (inserts.length) {
			let subject = inserts[0].subject.value;
			let turtleBody = "";
			inserts.forEach((triple) => {
				turtleBody += toSparqlTriple(triple) + "\n";
			});
			let response = await sendLDESRequest(subject, turtleBody);
			console.log(response);
		}
	}
}
