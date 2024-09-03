import { SparqlClient } from "sparql-client-2";
import { sparqlEscapeUri, query } from "mu";
import httpContext from "express-http-context";
import fs from "fs";
import { initialization } from "./config/initialization";
import { v4 as uuid } from "uuid";

const limit = parseInt(process.env.INITIAL_STATE_LIMIT || "10000");
const LDES_BASE = process.env.LDES_BASE || "http://lmb.lblod.info/streams/ldes";
const DIRECT_DB_ENDPOINT =
  process.env.DIRECT_DB_ENDPOINT || "http://virtuoso:8890/sparql";
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

async function generateVersionedUris(type) {
  await ttlClient
    .query(
      `
    PREFIX ext: <http://mu.semte.ch/vocabularies/ext/>

    INSERT {
      GRAPH <http://mu.semte.ch/graphs/ldes-initializer> {
        ?s ext:versionedUri ?versionedUri .
      }
    } WHERE {
      {
        SELECT DISTINCT ?s {
          ?s a ${sparqlEscapeUri(type)}.
          FILTER NOT EXISTS {
            ?s ext:versionedUri ?existing.
          }
        }
      }
      BIND(URI(CONCAT("http://mu.semte.ch/services/ldes-time-fragmenter/versioned/", STRUUID())) as ?versionedUri)
    }
  `
    )
    .executeRaw();
  console.log("generated versioned uris");
}

async function cleanupVersionedUris() {
  await ttlClient
    .query(
      `
    PREFIX ext: <http://mu.semte.ch/vocabularies/ext/>

    DELETE {
      GRAPH <http://mu.semte.ch/graphs/ldes-initializer> {
        ?s ext:versionedUri ?versionedUri .
      }
    } WHERE {
      GRAPH <http://mu.semte.ch/graphs/ldes-initializer> {
        ?s ext:versionedUri ?versionedUri .
      }
    }`
    )
    .executeRaw();
  console.log("cleaned up versioned uris");
}

async function countMatchesForType(stream, type) {
  const filter = initialization[stream]?.[type]?.filter || "";
  const res = await query(
    `
    SELECT (COUNT(DISTINCT ?s) as ?count) WHERE {
      ?s a ${sparqlEscapeUri(type)}.
      ${filter}
    }`
  );
  return parseInt(res.results.bindings[0].count.value);
}

function getCurrentFile(ldesStream) {
  let highestNumber = 1;
  fs.readdirSync(`/data/${ldesStream}`).forEach((file) => {
    const number = parseInt(file.split(".")[0]);
    if (number > highestNumber) {
      highestNumber = number;
    }
  });
  return `${highestNumber}.ttl`;
}

async function endFile(file: string, stream: fs.WriteStream) {
  const uuidForRelation = uuid();
  const uriForRelation = `<http://mu.semte.ch/services/ldes-time-fragmenter/relations/${uuidForRelation}>`;
  const fileCount = parseInt(file.split(".")[0]);
  const triplesToAdd = `
  <./${fileCount}> <https://w3id.org/tree#relation> ${uriForRelation} .
  ${uriForRelation} <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <https://w3id.org/tree#GreaterThanOrEqualToRelation> .
  ${uriForRelation} <https://w3id.org/tree#value> "${new Date().toISOString()}"^^<http://www.w3.org/2001/XMLSchema#dateTime> .
  ${uriForRelation} <https://w3id.org/tree#node> <./${fileCount + 1}> .
  ${uriForRelation} <https://w3id.org/tree#path> <http://www.w3.org/ns/prov#generatedAtTime> .\n`;

  stream.write(triplesToAdd);
}

async function startFile(
  streamName: string,
  file: string,
  stream: fs.WriteStream
) {
  const fileCount = parseInt(file.split(".")[0]);
  console.log(`[${streamName}]  starting new file ${fileCount}`);
  const streamUri = `<${LDES_BASE}/${streamName}>`;
  const triplesToAdd = `
  ${streamUri} <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <http://w3id.org/ldes#EventStream> .
  ${streamUri} <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <https://w3id.org/tree#Collection> .
  ${streamUri} <https://w3id.org/tree#view> <./1> .
  <./${fileCount}> <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <https://w3id.org/tree#Node> .\n`;

  stream.write(triplesToAdd);
}

async function writeToCurrentFile(ldesStream: string, contents: string) {
  currentStream.write(contents + "\n");
  currentStreamCharCount += contents.length;
  if (currentStreamCharCount > MAX_PAGE_SIZE_BYTES) {
    console.log(
      `[${ldesStream}]  reached max page size ${currentStreamCharCount} > ${MAX_PAGE_SIZE_BYTES}, starting new file`
    );
    await forceNewFile(ldesStream);
  } else {
    console.log(
      `[${ldesStream}]  current page size ${currentStreamCharCount} < ${MAX_PAGE_SIZE_BYTES}`
    );
  }
}

async function writeInitialStateForStreamAndType(ldesStream, type) {
  console.log(`[${ldesStream}]  writing initial state for ${type}`);

  let offset = 0;
  const count = await countMatchesForType(ldesStream, type);

  const filter = initialization[ldesStream]?.[type]?.filter || "";
  const extraConstruct =
    initialization[ldesStream]?.[type]?.extraConstruct || "";
  const extraWhere = initialization[ldesStream]?.[type]?.extraWhere || "";

  while (offset < count) {
    const res = await ttlClient
      .query(
        `
      PREFIX extlmb: <http://mu.semte.ch/vocabularies/ext/lmb/>
      PREFIX ext: <http://mu.semte.ch/vocabularies/ext/>

      CONSTRUCT {
        <http://lmb.lblod.info/streams/ldes/public> <https://w3id.org/tree#member> ?versionedS .
        ?versionedS ?p ?o .
        ?versionedS <http://purl.org/dc/terms/isVersionOf> ?s .
        ?versionedS <http://www.w3.org/ns/prov#generatedAtTime> ?now .
        ${extraConstruct}
      } WHERE {
        { SELECT DISTINCT ?s ?versionedS WHERE {
          ?s a ${sparqlEscapeUri(type)}.
          GRAPH <http://mu.semte.ch/graphs/ldes-initializer> { ?s ext:versionedUri ?versionedS . }
        } ORDER BY ?s OFFSET ${offset} LIMIT ${limit}  }

        ?s ?p ?o .
        FILTER (?p != ext:versionedUri)

        BIND(NOW() as ?now)

        ${filter}

        ${extraWhere}
      }`
      )
      .executeRaw();

    await writeToCurrentFile(ldesStream, res.body);

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

async function forceNewFile(ldesStream: string) {
  if (currentStream) {
    currentStream.end();
    await new Promise((resolve) => {
      currentStream.on("finish", resolve);
    });
  }

  let currentFile = getCurrentFile(ldesStream);
  if (fs.existsSync(`/data/${ldesStream}/${currentFile}`)) {
    const endStream = fs.createWriteStream(
      `/data/${ldesStream}/${currentFile}`,
      {
        flags: "a",
      }
    );

    await endFile(currentFile, endStream);
    endStream.end();
    await new Promise((resolve) => endStream.on("finish", resolve));
    const currentCount = parseInt(currentFile.split(".")[0]);
    currentFile = `${currentCount + 1}.ttl`;
  }

  const stream = fs.createWriteStream(`/data/${ldesStream}/${currentFile}`, {
    flags: "a",
  });
  await startFile(ldesStream, currentFile, stream);
  currentStream = stream;
  currentStreamCharCount = 0;
}

export async function writeInitialState() {
  console.log("writing initial state");

  await cleanupVersionedUris();

  for (const ldesStream in initialization) {
    if (!fs.existsSync(`/data/${ldesStream}`)) {
      fs.mkdirSync(`/data/${ldesStream}`);
    }
    // force new file twice so we get an empty first page that can easily be fetched a lot and later modified to point to shortcuts
    await forceNewFile(ldesStream);
    await forceNewFile(ldesStream);
    for (const type in initialization[ldesStream]) {
      await generateVersionedUris(type);
      await writeInitialStateForStreamAndType(ldesStream, type);
    }
    // this way we have a fresh small file from which to start the regular process
    await forceNewFile(ldesStream);
  }

  console.log("done writing initial state");
}
