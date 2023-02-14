//@ts-ignore
import { app, errorHandler } from "mu";
import bodyParser from "body-parser";
import dispatch from "./dispatch";
import type { Request, Response } from 'express';

app.use(
	bodyParser.json({
		limit: "500mb",
		// @ts-ignore
		type: function (req: Request) {
			return /^application\/json/.test(req.get("content-type") as string);
		},
	})
);

app.post("/publish", async function (req: Request, res: Response) {
	try {
		await dispatch(req.body);
		res.send("Resource added to LDES");
	} catch (e) {
		console.error(e);
		res.status(500).send();
	}
});

app.use(errorHandler);
