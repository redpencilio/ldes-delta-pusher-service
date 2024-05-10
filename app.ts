//@ts-ignore
import { app, errorHandler } from "mu";
import bodyParser from "body-parser";
import dispatch from "./config/dispatch";
import type { Request, Response } from "express";
import {
  status,
  catchUpAfterRestart,
  storeLastModifiedSynced,
} from "./catchUpAfterRestart";
import { Changeset, Quad } from "./types";

app.use(
  bodyParser.json({
    limit: "500mb",
    // @ts-ignore
    type: function (req: Request) {
      return /^application\/json/.test(req.get("content-type") as string);
    },
  })
);

async function updateLastModifiedSeen(quads: Quad[]) {
  let highestModified: Date | null = null;
  quads.forEach((quad) => {
    if (quad.predicate.value !== "http://purl.org/dc/terms/modified") {
      return;
    }
    const modified = new Date(quad.object.value);
    if (!highestModified || modified.getTime() > highestModified.getTime()) {
      highestModified = modified;
    }
  });
  if (highestModified) {
    await storeLastModifiedSynced(highestModified);
  }
}

app.post("/publish", async function (req: Request, res: Response) {
  if (!status.hasCaughtUpSinceRestart) {
    // we haven't finished catching up after restarting. We'll see this change by querying the db
    res
      .status(202)
      .send(
        "Still catching up after restart, we assume this request will be handled during catching up."
      );
    return;
  }
  try {
    const changeSets: Changeset[] = req.body;
    await dispatch(changeSets);
    await updateLastModifiedSeen(
      // deletes happen before inserts, so try inserts first, then deletes
      changeSets[changeSets.length - 1]?.inserts ||
        changeSets[changeSets.length - 1]?.deletes ||
        []
    );
    res.send("Resource added to LDES");
  } catch (e) {
    console.error(e);
    res.status(500).send();
  }
});

catchUpAfterRestart();

app.use(errorHandler);
