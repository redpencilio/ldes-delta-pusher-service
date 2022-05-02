import { app, query, update, sparql, errorHandler } from "mu";
import bodyParser from "body-parser";
import fetch from "node-fetch";

console.log(process.env);

const APPLICATION_GRAPH = "http://mu.semte.ch/graphs/public";
app.use(
	bodyParser.json({
		limit: "500mb",
		type: function (req) {
			return /^application\/json/.test(req.get("content-type"));
		},
	})
);

function formatValue(tripleElement) {
	if (tripleElement.type == "uri") {
		return `<${tripleElement.value}>`;
	} else {
		return `"${tripleElement.value}"`;
	}
}

function toString(triple) {
	return `${formatValue(triple.subject)} ${formatValue(
		triple.predicate
	)} ${formatValue(triple.object)}.`;
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

app.post("/publish", async function (req, res) {
	for (const operation of req.body) {
		let resource = operation.inserts;
		if (resource) {
			let subject = resource[0].subject.value;
			let turtleBody = "";
			resource.forEach((triple) => {
				turtleBody += toString(triple) + "\n";
			});
			let response = await sendLDESRequest(subject, turtleBody);
			console.log(response);
		}
	}
});

app.use(errorHandler);
