// @ts-ignore
import { sparqlEscapeUri, sparqlEscapeString } from "mu";
import { DATA_FOLDER, LDES_BASE, LDES_FOLDER, LDES_FRAGMENTER } from "./config";
import { Changeset, Quad, Term } from "./types";
import { addData, getConfigFromEnv } from "@lblod/ldes-producer";

const ldesProducerConfig = getConfigFromEnv();
console.log("ldesProducerConfig", ldesProducerConfig);
export function toSparqlTerm(thing: Term): string {
	if (thing.type == "uri") return sparqlEscapeUri(thing.value);
	// FIXME: without this you probably lose every triples of type boolean & number
	// a better solution would be to use n3 or something similar
	else if (thing.datatype?.length) return "\"" + thing.value?.toString() || "" + "\"" + "^^" + this.datatype;
	else return "\"" + thing.value + "\"";
}

export function toSparqlTriple(quad: Quad): string {
	return `${toSparqlTerm(quad.subject)} ${toSparqlTerm(quad.predicate)} ${toSparqlTerm(quad.object)}.`;
}



export async function moveTriples(changesets: Changeset[], stream = LDES_FOLDER) {
	let turtleBody = "";
	console.log("stream", stream);
	for (const { inserts } of changesets) {
		if (inserts.length) {
			inserts.forEach((triple) => {
				turtleBody += toSparqlTriple(triple) + "\n";
			});

		}
	}
	if (!turtleBody.length) {
		console.log('nothing to do.');
		return;
	}
	console.log(turtleBody);
	const fs = require("fs");
	fs.writeFileSync(DATA_FOLDER + '/debug.ttl', turtleBody, { encoding: 'utf-8' });
	await addData(ldesProducerConfig, {
		contentType: "text/turtle",
		folder: stream,
		body: turtleBody,
		fragmenter: 'time-fragmenter',
	});
}
