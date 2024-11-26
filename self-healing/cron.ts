import { CronJob } from "cron";
import { text } from 'node:stream/consumers';
import { healEntities } from "./heal-ldes-data";
import {
  clearHealingTempGraphs,
  insertLdesPageToDumpGraph,
} from "./upload-entities-to-db";
import { transformLdesDataToEntities } from "./transform-ldes-data-to-entities";
import { CRON_HEALING } from "../config";
import { HealingConfig, getHealingConfig } from "../config/healing";

import { getNode, getConfigFromEnv } from "@lblod/ldes-producer";
const ldesProducerConfig = getConfigFromEnv();

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
  const config = await getHealingConfig();
  console.log(`Healing config: ${JSON.stringify(config)}`);

  for (const stream of Object.keys(config)) {
    await healStream(stream, config);
  }
  isRunning = false;
};

async function healStream(stream: string, config: HealingConfig) {
  const startTime = performance.now();

  await clearHealingTempGraphs();
  await loadStreamIntoDumpGraph(stream);
  console.log(
    `Loading LDES into dump graph took ${performance.now() - startTime} ms`
  );
  await transformLdesDataToEntities();
  await healEntities(stream, config);
  console.log(`Healing the LDES took ${performance.now() - startTime} ms`);
}

async function loadStreamIntoDumpGraph(stream: string): Promise<void> {
  let isLdesInsertedInDatabase = false;
  let currentPage = 0;
  while (!isLdesInsertedInDatabase) {
    currentPage++;

    const turtleText = await fetchPage(stream, currentPage);
    if (turtleText) {
      await insertLdesPageToDumpGraph(turtleText);
    } else {
      isLdesInsertedInDatabase = true;
    }
  }
}

async function fetchPage(stream: string, page: number): Promise<string | null> {
  console.log(`Loading LDES page ${page}`);
  try {
    const response = await getNode(ldesProducerConfig, {
      folder: stream,
      contentType: "text/turtle",
      nodeId: page,
    });
    return await text(response.stream);
  } catch (e) {
    if (e.status === 404) {
      console.log(
        `Page ${page} not found, assuming it's the last page of the stream`
      );
      return null;
    }
    throw new Error(
      `Failed to fetch LDES page from stream ${stream}, error: ${e}`
    )
  }

}

export const cronjob = CronJob.from({
  cronTime: CRON_HEALING,
  onTick: cronMethod,
});
