import { app, errorHandler } from "mu";
import bodyParser from "body-parser";
import dispatch from "./dispatch";

console.log(process.env);

app.use(
	bodyParser.json({
		limit: "500mb",
		type: function (req) {
			return /^application\/json/.test(req.get("content-type"));
		},
	})
);

app.post("/publish", async function (req, res) {
	console.log("publish to LDES");
	try {
		await dispatch(req.body);
		res.send("Resource added to LDES");
	} catch (e) {
		console.error(e);
		res.status(500).send();
	}
});

app.use(errorHandler);
