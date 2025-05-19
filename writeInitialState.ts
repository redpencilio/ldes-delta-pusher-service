import sparqlClient from "sparql-client-2";
const { SparqlClient } = sparqlClient;
import { sparqlEscapeUri, sparqlEscapeDateTime } from "mu";
import httpContext from "express-http-context";
import fs from "fs";
import { initialization } from "./config/initialization";
import { v4 as uuid } from "uuid";
import { querySudo } from "@lblod/mu-auth-sudo";
import {
  CRON_CHECKPOINT,
  DATA_FOLDER,
  DIRECT_DB_ENDPOINT,
  LDES_BASE,
} from "./environment";
import { CronJob } from "cron";

const limit = parseInt(process.env.INITIAL_STATE_LIMIT || "10000");
const MAX_PAGE_SIZE_BYTES = parseInt(
  process.env.MAX_PAGE_SIZE_BYTES || "10000000"
);

let currentStream: fs.WriteStream;
let currentStreamCharCount = 0;

function createTtlSparqlClient(turtle = true) {
  let options: any = {
    requestDefaults: { headers: {} },
  };
  if (turtle) {
    // NICE! we are allowed to concatenate turtle! prefixes are allowed to be redefined
    options.defaultParameters = { format: "turtle" };
  }

  if (httpContext.get("request")) {
    options.requestDefaults.headers["mu-session-id"] = httpContext
      .get("request")
      .get("mu-session-id");
    options.requestDefaults.headers["mu-call-id"] = httpContext
      .get("request")
      .get("mu-call-id");
    options.requestDefaults.headers["mu-auth-allowed-groups"] = httpContext
      .get("request")
      .get("mu-auth-allowed-groups"); // groups of incoming request
  }

  if (httpContext.get("response")) {
    const allowedGroups = httpContext
      .get("response")
      .get("mu-auth-allowed-groups"); // groups returned by a previous SPARQL query
    if (allowedGroups)
      options.requestDefaults.headers["mu-auth-allowed-groups"] = allowedGroups;
  }

  return new SparqlClient(DIRECT_DB_ENDPOINT, options);
}

const ttlClient = createTtlSparqlClient();

async function generateVersionedUris(
  type: string,
  filter: string,
  graphFilter: string
) {
  // filtering here makes it way easier later on. we should simply consider all instances of the type with a versioned uri
  // because the filter has already been applied to those instances
  const query = `
    PREFIX ext: <http://mu.semte.ch/vocabularies/ext/>

    INSERT {
      GRAPH <http://mu.semte.ch/graphs/ldes-initializer> {
        ?s ext:versionedUri ?versionedUri .
      }
    } WHERE {
      {
        SELECT DISTINCT ?s WHERE {
          GRAPH ?g {
            ?s a ${sparqlEscapeUri(type)}.
            ${filter}
          }
          ${graphFilter}
        }
      }
      OPTIONAL {
        ?s ext:fakeUuidPredAsWeWantSomethingNew ?fakeUuid.
      }
      BIND(IF(BOUND(?fakeUuid), ?fakeUuid, STRUUID()) as ?id)
      BIND(URI(CONCAT("http://mu.semte.ch/services/ldes-time-fragmenter/versioned/", ?id)) as ?versionedUri)
    }
  `;
  console.log(query);
  await executeDirectQuery(query, ttlClient);
  console.log("generated versioned uris");
}

async function cleanupVersionedUris() {
  await executeDirectQuery(
    "DROP SILENT GRAPH <http://mu.semte.ch/graphs/ldes-initializer>",
    ttlClient
  );
  console.log("cleaned up versioned uris");
}

async function executeDirectQuery(
  query: string,
  ttlClient: typeof SparqlClient,
  retries = 5
) {
  try {
    return await ttlClient.query(query).executeRaw();
  } catch (e) {
    if (retries > 0) {
      console.log(`Retrying query, ${retries} retries left`);
      return executeDirectQuery(query, ttlClient, retries - 1);
    } else {
      console.log(`Failed to execute query after 5 retries`);
      throw e;
    }
  }
}

async function countMatchesForType(stream, type) {
  const filter = initialization[stream]?.[type]?.filter || "";
  const graphFilter = initialization[stream]?.[type]?.graphFilter || "";
  const res = await querySudo(
    `
    SELECT (COUNT(DISTINCT ?s) as ?count) WHERE {
      GRAPH ?g {
        ?s a ${sparqlEscapeUri(type)}.
        ${filter}
      }
      ${graphFilter}
    }`
  );
  return parseInt(res.results.bindings[0].count.value);
}

function getCurrentFile(ldesStream: string, checkpoint?: string) {
  let highestNumber = 1;
  let directory = `${DATA_FOLDER}/${ldesStream}`;
  if (checkpoint) {
    directory = `${directory}/checkpoints/${checkpoint}`;
  }
  fs.readdirSync(directory).forEach((file) => {
    if (file.startsWith("checkpoints")) {
      return;
    }
    const number = parseInt(file.split(".")[0]);
    if (number > highestNumber) {
      highestNumber = number;
    }
  });
  return {
    file: `${directory}/${highestNumber}.ttl`,
    directory,
    number: highestNumber,
  };
}

async function endFile(fileCount: number, stream: fs.WriteStream) {
  const uuidForRelation = uuid();
  const uriForRelation = `<http://mu.semte.ch/services/ldes-time-fragmenter/relations/${uuidForRelation}>`;
  const triplesToAdd = `
  <./${fileCount}> <https://w3id.org/tree#relation> ${uriForRelation} .
  ${uriForRelation} <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <https://w3id.org/tree#GreaterThanOrEqualToRelation> .
  ${uriForRelation} <https://w3id.org/tree#value> "${new Date().toISOString()}"^^<http://www.w3.org/2001/XMLSchema#dateTime> .
  ${uriForRelation} <https://w3id.org/tree#node> <./${fileCount + 1}> .
  ${uriForRelation} <https://w3id.org/tree#path> <http://www.w3.org/ns/prov#generatedAtTime> .\n`;

  return new Promise((resolve) => {
    stream.on("finish", () => {
      resolve(true);
    });
    stream.write(triplesToAdd);
    stream.end();
  });
}

async function connectCheckpointToLastLDESPage(
  ldesStream: string,
  checkpoint: string
) {
  let { number: fileCount } = getCurrentFile(ldesStream, checkpoint);
  const { number: realStreamFileCount } = getCurrentFile(ldesStream);

  const uuidForRelation = uuid();
  const uriForRelation = `<http://mu.semte.ch/services/ldes-time-fragmenter/relations/${uuidForRelation}>`;
  // the greater than or equal here is a bit of a lie: the last page of the stream may actually
  // contain older entries but it doesn't matter because these entries will be replaced by the
  // newer ones later in the stream and we will still be up to date
  const triplesToAdd = `
  <./${fileCount}> <https://w3id.org/tree#relation> ${uriForRelation} .
  ${uriForRelation} <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <https://w3id.org/tree#GreaterThanOrEqualToRelation> .
  ${uriForRelation} <https://w3id.org/tree#value> "${new Date().toISOString()}"^^<http://www.w3.org/2001/XMLSchema#dateTime> .
  ${uriForRelation} <https://w3id.org/tree#node> <../../${realStreamFileCount}> .
  ${uriForRelation} <https://w3id.org/tree#path> <http://www.w3.org/ns/prov#generatedAtTime> .\n`;

  return new Promise((resolve) => {
    currentStream.on("finish", () => {
      resolve(true);
    });
    currentStream.write(triplesToAdd);
    currentStream.end();
  });
}

async function startFile(
  streamName: string,
  fileCount: number,
  stream: fs.WriteStream,
  checkpoint?: string
) {
  console.log(`[${streamName}]  starting new file ${fileCount}`);
  const streamUri = `<${LDES_BASE}${streamName}>`;
  const base = checkpoint ? `./checkpoints/${checkpoint}` : ".";
  const triplesToAdd = `
  ${streamUri} <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <http://w3id.org/ldes#EventStream> .

  ${streamUri} <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <https://w3id.org/tree#Collection> .
  ${streamUri} <https://w3id.org/tree#view> <./1> .
  <${base}/${fileCount}> <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <https://w3id.org/tree#Node> .\n`;

  stream.write(triplesToAdd);
}

async function writeToCurrentFile(
  ldesStream: string,
  contents: string,
  checkpointName?: string
) {
  currentStream.write(contents + "\n");
  currentStreamCharCount += contents.length;
  if (currentStreamCharCount > MAX_PAGE_SIZE_BYTES) {
    console.log(
      `[${ldesStream}]  reached max page size ${currentStreamCharCount} > ${MAX_PAGE_SIZE_BYTES}, starting new file`
    );
    await forceNewFile(ldesStream, checkpointName);
  } else {
    console.log(
      `[${ldesStream}]  current page size ${currentStreamCharCount} < ${MAX_PAGE_SIZE_BYTES}`
    );
  }
}

async function writeInitialStateForStreamAndType(
  ldesStream: string,
  type: string,
  checkpointName?: string
) {
  console.log(`[${ldesStream}]  writing initial state for ${type}`);

  let offset = 0;
  const count = await countMatchesForType(ldesStream, type);

  const graphFilter = initialization[ldesStream]?.[type]?.graphFilter || "";
  const extraConstruct =
    initialization[ldesStream]?.[type]?.extraConstruct || "";
  const extraWhere = initialization[ldesStream]?.[type]?.extraWhere || "";
  const instanceFilter = initialization[ldesStream]?.[type]?.filter || "";

  const now = sparqlEscapeDateTime(new Date().toISOString());
  while (offset < count) {
    const query = `
      PREFIX extlmb: <http://mu.semte.ch/vocabularies/ext/lmb/>
      PREFIX ext: <http://mu.semte.ch/vocabularies/ext/>

      CONSTRUCT {
        <${LDES_BASE}${ldesStream}> <https://w3id.org/tree#member> ?versionedS .
        ?versionedS ?p ?o .
        ?versionedS <http://purl.org/dc/terms/isVersionOf> ?s .
        ?versionedS <http://www.w3.org/ns/prov#generatedAtTime> ${now} .
        ${extraConstruct}
      } WHERE {
        { SELECT DISTINCT ?s ?versionedS WHERE {
          ?s a ${sparqlEscapeUri(type)}.
          GRAPH <http://mu.semte.ch/graphs/ldes-initializer> { ?s ext:versionedUri ?versionedS . }
        } ORDER BY ?s OFFSET ${offset} LIMIT ${limit}  }

        GRAPH ?g {
          ?s ?p ?o .
          FILTER (?p != ext:versionedUri)
        }
        ${instanceFilter}

        ${graphFilter}

        ${extraWhere}
      }`;
    console.log(query);
    const res = await executeDirectQuery(query, ttlClient);

    await writeToCurrentFile(ldesStream, res.body, checkpointName);

    const written = Math.min(count, offset + limit);
    console.log(
      `[${ldesStream}]  wrote ${written}/${count} instances for type ${type} (${(
        (written / count) *
        100
      ).toFixed(2)}%)`
    );
    offset += limit;
  }
  console.log(`[${ldesStream}]  done writing initial state for ${type}`);
}

async function forceNewFile(ldesStream: string, checkpoint?: string) {
  if (currentStream) {
    await new Promise((resolve) => {
      currentStream.on("finish", () => {
        resolve(true);
      });
      currentStream.end();
    });
  }

  let {
    file: currentFile,
    directory,
    number,
  } = getCurrentFile(ldesStream, checkpoint);
  if (fs.existsSync(currentFile)) {
    const endStream = fs.createWriteStream(currentFile, {
      flags: "a",
    });

    await endFile(number, endStream);
    number = number + 1;
    currentFile = `${directory}/${number}.ttl`;
  }

  const stream = fs.createWriteStream(currentFile, {
    flags: "a",
  });
  await startFile(ldesStream, number, stream, checkpoint);
  currentStream = stream;
  currentStreamCharCount = 0;
  return { number, directory, currentFile };
}

export async function writeInitialState() {
  await new Promise((resolve) => setTimeout(resolve, 20000));
  console.log("writing initial state");

  for (const ldesStream in initialization) {
    if (!fs.existsSync(`${DATA_FOLDER}/${ldesStream}`)) {
      fs.mkdirSync(`${DATA_FOLDER}/${ldesStream}`);
    }
    await cleanupVersionedUris();
    // force new file twice so we get an empty first page that can easily be fetched a lot and later modified to point to shortcuts
    await forceNewFile(ldesStream);
    await forceNewFile(ldesStream);
    for (const type in initialization[ldesStream]) {
      const graphFilter = initialization[ldesStream]?.[type]?.graphFilter || "";
      const filter = initialization[ldesStream]?.[type]?.filter || "";
      await generateVersionedUris(type, filter, graphFilter);
      await writeInitialStateForStreamAndType(ldesStream, type);
    }
    // this way we have a fresh small file from which to start the regular process
    await forceNewFile(ldesStream);
  }

  console.log("done writing initial state");
}

function ensureCheckpointDir(ldesStream: string) {
  const checkpointName = new Date()
    .toISOString()
    .split(":")
    .join("-")
    .split(".")[0];
  const checkpointDir = `${DATA_FOLDER}/${ldesStream}/checkpoints/${checkpointName}`;
  if (!fs.existsSync(checkpointDir)) {
    fs.mkdirSync(checkpointDir, { recursive: true });
  }
  return checkpointName;
}

async function writeCheckpointRef(ldesStream: string, checkpointName: string) {
  let directory = `${DATA_FOLDER}/${ldesStream}`;
  const stream = fs.createWriteStream(`${directory}/checkpoints.ttl`, {
    flags: "a",
  });
  console.log(
    `[${ldesStream}]  writing checkpoint reference ${checkpointName}`
  );
  const streamUri = `<${LDES_BASE}${ldesStream}>`;
  const triplesToAdd = `
    ${streamUri} <http://mu.semte.ch/vocabularies/ext/ldesCheckpoint> <./checkpoints/${checkpointName}/1> .
    <./checkpoints/${checkpointName}/1> <http://purl.org/dc/terms/modified> "${new Date().toISOString()}"^^<http://www.w3.org/2001/XMLSchema#dateTime> .\n`;

  stream.write(triplesToAdd);
  await new Promise((resolve) => {
    stream.on("finish", () => {
      resolve(true);
    });
    stream.end();
  });
}

export async function writeCheckpoint() {
  console.log("starting checkpoint");

  for (const ldesStream in initialization) {
    const checkpointName = ensureCheckpointDir(ldesStream);
    await cleanupVersionedUris();

    // no need to force the double new file here, we don't expect checkpoint to be fetched often
    await forceNewFile(ldesStream, checkpointName);
    for (const type in initialization[ldesStream]) {
      const graphFilter = initialization[ldesStream]?.[type]?.graphFilter || "";
      const filter = initialization[ldesStream]?.[type]?.filter || "";
      await generateVersionedUris(type, filter, graphFilter);
      await writeInitialStateForStreamAndType(ldesStream, type, checkpointName);
    }
    await connectCheckpointToLastLDESPage(ldesStream, checkpointName);
    await writeCheckpointRef(ldesStream, checkpointName);
  }

  console.log("done writing checkpoint");
}

let isRunning = false;
const checkpointCron = async () => {
  console.log(
    "*******************************************************************"
  );
  console.log(
    `*** Checkpoint triggered by CRON ${new Date().toISOString()} ***`
  );
  console.log(
    "*******************************************************************"
  );

  if (isRunning) {
    return;
  }
  isRunning = true;
  await writeCheckpoint();
  isRunning = false;
};

export const cronjob = CRON_CHECKPOINT
  ? CronJob.from({
      cronTime: CRON_CHECKPOINT,
      onTick: checkpointCron,
    })
  : null;
