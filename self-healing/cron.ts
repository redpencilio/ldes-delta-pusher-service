import { CronJob } from "cron";

import { healEntities } from "./heal-ldes-data";
import {
  clearHealingTempGraphs,
  insertLdesPageToDumpGraph,
} from "./upload-entities-to-db";
import { transformLdesDataToEntities } from "./transform-ldes-data-to-entities";
import { CRON_HEALING, EXTRA_HEADERS } from "./environment";
import { LDES_ENDPOINT } from "../config";
import { HealingConfig, getHealingConfig } from "../config/healing";
import { resolve } from "path";

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

    const turtleText = await fetchPage(LDES_ENDPOINT + stream, currentPage);
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
