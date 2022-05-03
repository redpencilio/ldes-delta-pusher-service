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

export async function moveTriples(changesets) {
	for (const { inserts, deletes } of changesets) {
		if (inserts.length) {
			let subject = inserts[0].subject.value;
			let turtleBody = "";
			inserts.forEach((triple) => {
				turtleBody += toString(triple) + "\n";
			});
			let response = await sendLDESRequest(subject, turtleBody);
			console.log(response);
		}
	}
}
