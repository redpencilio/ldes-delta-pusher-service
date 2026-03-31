import bodyParser from "body-parser";
import type { Request, Response } from "express";
//@ts-ignore
import { app, errorHandler } from "mu";
import dispatch from "./config/dispatch";

import { DeltaChangeset } from "./types";
import { writeInitialState } from "./writeInitialState";

import { cronjob as autoHealing, manualTrigger } from "./self-healing/cron";
import ENV from "./environment";
import { ttlFileAsContentType } from "./util/ttlFileAsContentType";
import { cronjob as checkpointCron } from "./writeInitialState";

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
    const changeSets: DeltaChangeset[] = req.body;
    await dispatch(changeSets);
    res.send("Resource added to LDES");
  } catch (e) {
    console.error(e);
    res.status(500).send();
  }
});

app.get("/checkpoints/:stream", async function (req: Request, res: Response) {
  const acceptedContentTypes = [
    "application/ld+json",
    "application/n-quads",
    "application/n-triples",
    "application/trig",
    "text/n3",
    "text/turtle",
  ];

  try {
    const contentType = req.accepts(acceptedContentTypes);
    if (!contentType) {
      res.status(406).send("Not Acceptable");
      return;
    }
    const stream = req.params.stream;
    res.header("Content-Type", contentType);
    ttlFileAsContentType(
      `${ENV.DATA_FOLDER}/${stream}/checkpoints.ttl`,
      contentType,
      ENV.LDES_BASE
    ).pipe(res);
  } catch (e) {
    console.error(e);
    res.status(500).send();
  }
});
/**
* A manual trigger of the auto-healing process. Runs even if the AUTO_HEALING
* variable is false, for one-off occasions.
*/
app.post("/manual-healing", async function(_req: Request, res: Response) {
  try {
    await manualTrigger();
  } catch(e) {
    console.error(e)
    res.status(500).send()
  }
  res.status(200)
  .send(`Healing succesfully completed at ${new Date().toISOString()}`);
})

new Promise(async (resolve) => {
  if (process.env.WRITE_INITIAL_STATE === "true") {
    await writeInitialState();
  }

  if (ENV.AUTO_HEALING) {
    autoHealing.start();
  }
  if (checkpointCron) {
    checkpointCron.start();
  }

  resolve(true);
});

app.use(errorHandler);
