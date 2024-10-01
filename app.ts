import bodyParser from "body-parser";
import type { Request, Response } from "express";
//@ts-ignore
import { app, errorHandler } from "mu";
import dispatch from "./config/dispatch";

import { Changeset } from "./types";
import { writeInitialState } from "./writeInitialState";

import { cronjob as autoHealing } from "./self-healing/cron";
import { AUTO_HEALING } from "./config";

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
    const changeSets: Changeset[] = req.body;
    await dispatch(changeSets);
    res.send("Resource added to LDES");
  } catch (e) {
    console.error(e);
    res.status(500).send();
  }
});

new Promise(async (resolve) => {
  if (process.env.WRITE_INITIAL_STATE === "true") {
    await writeInitialState();
  }

  if (AUTO_HEALING == "true") {
    autoHealing.start();
  }

  resolve(true);
});

app.use(errorHandler);
