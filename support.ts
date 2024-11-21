// @ts-ignore
import { sparqlEscapeUri, sparqlEscapeString } from "mu";
import { LDES_FOLDER, } from "./config";
import { Changeset, Quad, Term } from "./types";
import { addData, getConfigFromEnv } from "@lblod/ldes-producer";

const ldesProducerConfig = getConfigFromEnv();
console.log("ldesProducerConfig", ldesProducerConfig);
export function toSparqlTerm(thing: Term): string {
	if (thing.type == "uri") return sparqlEscapeUri(thing.value);
	// FIXME: without this you probably lose every triples of type boolean & number
	// a better solution would be to use n3 or something similar
	else if (thing.datatype?.length) return "\"" + (thing.value?.toString() || "") + "\"" + "^^" + "<" + thing.datatype + ">";
	else return "\"" + thing.value?.toString() + "\"";
}

export function toSparqlTriple(quad: Quad): string {
	return `${toSparqlTerm(quad.subject)} ${toSparqlTerm(quad.predicate)} ${toSparqlTerm(quad.object)}.`;
}



export async function moveTriples(changesets: Changeset[], stream = LDES_FOLDER) {
	let turtleBody = "";
	for (const { inserts } of changesets) {
		if (inserts.length) {
			inserts.forEach((triple) => {
				turtleBody += toSparqlTriple(triple);
			});

		}
	}
	if (!turtleBody.length) {
		console.log('nothing to do.');
		return;
	}


	await addData(ldesProducerConfig, {
		contentType: "text/turtle",
		folder: stream,
		body: turtleBody,
	});


}


