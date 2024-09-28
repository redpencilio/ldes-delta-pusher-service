import { CronJob } from "cron";

import { healEntities } from "./heal-ldes-data";
import {
  clearHealingTempGraphs,
  insertLdesPageToDumpGraph,
} from "./upload-entities-to-db";
import { transformLdesDataToEntities } from "./transform-ldes-data-to-entities";
import { CRON_HEALING, EXTRA_HEADERS, LDES_STREAM } from "./environment";
import { LDES_BASE } from "../config";

let isRunning = false;
const cronMethod = async () => {
  console.log(
    "*******************************************************************"
  );
  console.log(
    `*** Pull LDES triggered by cron job at ${new Date().toISOString()} ***`
  );
  console.log(
    "*******************************************************************"
  );

  if (isRunning) {
    return;
  }
  isRunning = true;
  const startTime = performance.now();
  // This is not yet handling the mutliple streams from the config
  // This one service can than handle multiple streams
  // await clearHealingTempGraphs();
  // await loadStreamIntoDumpGraph();
  console.log(
    `Loading LDES into dump graph took ${performance.now() - startTime} ms`
  );
  // await transformLdesDataToEntities();
  await healEntities(LDES_STREAM);
  console.log(`Healing the LDES took ${performance.now() - startTime} ms`);
  isRunning = false;
};

async function loadStreamIntoDumpGraph(): Promise<void> {
  let isLdesInsertedInDatabase = false;
  let currentPage = 0;
  while (!isLdesInsertedInDatabase) {
    currentPage++;
    // if (currentPage === 3) {
    //   // TODO: for testing ONLY
    //   isLdesInsertedInDatabase = true;
    //   return;
    // }
    const turtleText = await fetchPage(LDES_BASE + LDES_STREAM, currentPage);
    if (turtleText) {
      await insertLdesPageToDumpGraph(turtleText);
    } else {
      isLdesInsertedInDatabase = true;
    }
  }
}

async function fetchPage(url: string, page: number): Promise<string | null> {
  const fullUrl = `${url}/${page}`;
  console.log(`Loading LDES page ${fullUrl}`);

  const response = await fetch(fullUrl, {
    headers: {
      Accept: "text/turtle",
      ...EXTRA_HEADERS,
    },
  });
  if (response.status === 404) {
    console.log(`Page ${page - 1} was the last page of the stream`);
    return null;
  }

  if (!response.ok) {
    throw new Error(
      `Failed to fetch LDES page ${fullUrl}, status ${
        response.status
      }, ${await response.text()}`
    );
  }
  return await response.text();
}

export const cronjob = CronJob.from({
  cronTime: CRON_HEALING,
  onTick: cronMethod,
});
