import { querySudo } from "@lblod/mu-auth-sudo";
import { CronJob } from "cron";

import { healEntities } from "./heal-ldes-data";
import {
  clearHealingTempGraphs,
  insertLdesPageToDumpGraph,
} from "./upload-entities-to-db";
import { transformLdesDataToEntities } from "./transform-ldes-data-to-entities";
import { CRON_HEALING } from "../config";
import { LDES_ENDPOINT } from "../config";
import { HealingConfig, getHealingConfig } from "../config/healing";
import {
  ttlFileAsContentType,
  ttlFileAsString,
} from "../util/ttlFileAsContentType";

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
  let currentPage: string | null = await determineFirstPageOrCheckpoint(stream);
  while (!isLdesInsertedInDatabase && currentPage) {
    const turtleText = await fetchPage(currentPage);
    if (turtleText) {
      await insertLdesPageToDumpGraph(turtleText);
    } else {
      isLdesInsertedInDatabase = true;
    }
    currentPage = await determineNextPage(currentPage, stream);
  }
}

async function determineFirstPageOrCheckpoint(stream: string): Promise<string> {
  console.log(`Fetching checkpoints for stream ${stream}`);
  const fileString = await ttlFileAsString(
    `/data/${stream}/checkpoints.ttl`,
    "application/ld+json",
    LDES_ENDPOINT
  );
  try {
    const modified = "http://purl.org/dc/terms/modified";
    const checkpoints = JSON.parse(fileString).filter((i) => i[modified]);
    checkpoints.sort((a: any, b: any) =>
      a[modified][0].value < b[modified][0].value ? 1 : -1
    );
    // take the second to last checkpoint so we are sure that we healed away things between last heal and checkpoint if any
    const checkpointName = checkpoints[1]["@id"].split("checkpoints/")[1];
    return `${LDES_ENDPOINT}${stream}/checkpoints/${checkpointName}`;
  } catch (e) {
    return `${LDES_ENDPOINT}${stream}/1`;
  }
}

async function determineNextPage(
  currentPage: string,
  stream: string
): Promise<string | null> {
  const relativePageUrl = currentPage.split(`${LDES_ENDPOINT}${stream}/`)[1];
  const query = `
    SELECT ?page WHERE {
      ?oldPage <https://w3id.org/tree#relation> ?relation .
      ?relation a <https://w3id.org/tree#GreaterThanOrEqualToRelation> .
      ?relation <https://w3id.org/tree#value> ?date .
      ?relation <https://w3id.org/tree#node> ?page .
      FILTER(STRENDS(STR(?oldPage), "${relativePageUrl}"))
    } LIMIT 1
  `;
  const result = await querySudo(query);
  console.log(
    `Next page query result: ${JSON.stringify(
      result.results.bindings[0]?.page?.value
    )}`
  );
  if (result.results.bindings.length === 0) {
    return null;
  }
  const page = result.results.bindings[0].page.value;
  const safePartOfPageUrl = page.split(`/${stream}/`)[1];
  return `${LDES_ENDPOINT}${stream}/${safePartOfPageUrl}`;
}

async function fetchPage(url: string): Promise<string | null> {
  console.log(`Loading LDES page ${url}`);

  const response = await fetch(url, {
    headers: {
      Accept: "text/turtle",
    },
  });
  if (response.status === 404) {
    console.log(`Page ${url} was the last page of the stream`);
    return null;
  }

  if (!response.ok) {
    throw new Error(
      `Failed to fetch LDES page ${url}, status ${
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

// setTimeout(cronMethod, 10000);
