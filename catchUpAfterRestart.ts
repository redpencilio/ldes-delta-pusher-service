import { querySudo as query, updateSudo as update } from "@lblod/mu-auth-sudo";
import { sparqlEscapeDateTime } from "mu";
import { handlePage } from "./config/catchUp";
import { CatchupPageItem } from "./types";

const statusSubject = "ext:ldesStatus";
const catchUpPageSize = parseInt(
  process.env.LDES_CATCH_UP_PAGE_SIZE || "1000",
  10
);
// We store the last date that we put onto the ldes. However, we may miss items with the same timestamp.
// So we will catch up until just BEFORE the stored timestamp upon restarting.
// This will introduce extra items on the ldes feed but that should be fine (they are simply redundant).
const initialCatchUpOffset = parseInt(
  process.env.LDES_CATCH_UP_INITIAL_OFFSET || "1",
  10
);

// if null, no catching up is done
const statusGraph = process.env.LDES_STATUS_GRAPH;

export const status = {
  hasCaughtUpSinceRestart: false,
};

export async function storeLastModifiedSynced(caughtUpUntil?: Date) {
  const date = caughtUpUntil ? caughtUpUntil : new Date();
  await update(`
  PREFIX ext: <http://mu.semte.ch/vocabularies/ext/>
  DELETE {
    GRAPH <${statusGraph}> {
      ${statusSubject} ext:lastSync ?date .
    }
  }
  WHERE {
    GRAPH <${statusGraph}> {
      ${statusSubject} ext:lastSync ?date .
    }
  }
  `);
  await update(`
  PREFIX ext: <http://mu.semte.ch/vocabularies/ext/>
  INSERT DATA {
    GRAPH <${statusGraph}> {
      ${statusSubject} ext:lastSync ${sparqlEscapeDateTime(date)} .
    }
  }
  `);
}

async function getCatchupStatusFromDB() {
  const result = await query(`
  PREFIX ext: <http://mu.semte.ch/vocabularies/ext/>
  SELECT ?date
  WHERE {
    GRAPH <${statusGraph}> {
      ${statusSubject} ext:lastSync ?date .
    }
  }
  `);
  const date = result.results.bindings[0]?.date?.value;
  return {
    caughtUpUntil: date ? new Date(date) : null,
  };
}

async function hasCaughtUp() {
  const status = await getCatchupStatusFromDB();
  if (!status.caughtUpUntil) {
    return false;
  }

  const firstItemAfterLastSync = await query(`
  PREFIX dct: <http://purl.org/dc/terms/>
  SELECT * WHERE {
    ?s dct:modified ?date .
    FILTER(?date > ${sparqlEscapeDateTime(status.caughtUpUntil)})
  } LIMIT 1`);
  return firstItemAfterLastSync.results.bindings.length === 0;
}

async function getCountOfItemsToSync(caughtUpUntil: Date) {
  const result = await query(`
  PREFIX dct: <http://purl.org/dc/terms/>
  SELECT (COUNT( DISTINCT *) as ?count) WHERE {
    ?s dct:modified ?date ;
         a ?type .
    FILTER(?date >= ${sparqlEscapeDateTime(caughtUpUntil)})
  }`);
  return parseInt(result.results.bindings[0].count.value);
}

async function pagedCatchUp() {
  let { caughtUpUntil } = await getCatchupStatusFromDB();

  if (!caughtUpUntil) {
    // we missed everything, set to the beginning of time
    caughtUpUntil = new Date("1988-01-01T00:00:00.000Z");
  }

  caughtUpUntil = new Date(caughtUpUntil.getTime() - initialCatchUpOffset);

  // we're fetching the count and then just getting the next page until we get
  // no more items. So in theory we don't really need the count.
  // however, it's nice to give the watchers of our logs an indication
  // of how many items we expect
  const count = await getCountOfItemsToSync(caughtUpUntil);
  let currentOffset = 0;
  let maxDate;
  let hasMoreItems = true;
  while (hasMoreItems) {
    const page = await query(`
    PREFIX dct: <http://purl.org/dc/terms/>
    SELECT DISTINCT ?s ?date ?type WHERE {
      ?s dct:modified ?date ;
         a ?type .
      FILTER(?date >= ${sparqlEscapeDateTime(caughtUpUntil)})
    }
    ORDER BY ASC(?date)
    LIMIT ${catchUpPageSize}
    OFFSET ${currentOffset}`);

    if (page.results.bindings.length === 0) {
      hasMoreItems = false;
    } else {
      maxDate =
        page.results.bindings[page.results.bindings.length - 1]?.date?.value;
      console.log(`Catching up until ${maxDate}: ${currentOffset}/${count}`);
      const items = page.results.bindings.map(
        (item) =>
          ({
            uri: item.s.value as string,
            date: new Date(item.date.value),
            type: item.type.value as string,
          } as CatchupPageItem)
      );
      await handlePage(items);
      // setting the last date we caught up to. This is safe because if we were
      // to crash now and items on the next page have the same last modified as
      // the last item on the page, we would still write all items with that same
      // last modified to the ldes (as duplicates, which is acceptable)
      await storeLastModifiedSynced(new Date(maxDate));
      currentOffset += catchUpPageSize;
    }
  }
}

async function waitForDb() {
  let dbReady = false;
  while (!dbReady) {
    try {
      await query("SELECT ?s WHERE { ?s ?p ?o } LIMIT 1");
      dbReady = true;
    } catch (e) {
      console.log("Waiting for db to be ready");
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
}

export async function catchUpAfterRestart() {
  console.log("Catching up after restart");
  if (!statusGraph || statusGraph.length === 0) {
    status.hasCaughtUpSinceRestart = true;
    return;
  }

  await waitForDb();

  await pagedCatchUp();
  status.hasCaughtUpSinceRestart = true;

  // doing another run because maybe we missed a delta that came in while we
  // were queried the items of our last page
  await pagedCatchUp();
  console.log("Done Catching up after restart");
}
