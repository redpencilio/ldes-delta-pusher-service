import { SparqlClient } from "sparql-client-2";
import { sparqlEscapeUri, query } from "mu";
import httpContext from "express-http-context";
import fs from "fs";
import { initialization } from "./config/initialization";

const filePath = process.env.INITIAL_STATE_FILE_PATH || "2.ttl";
const limit = parseInt(process.env.INITIAL_STATE_LIMIT || "10000");

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

  return new SparqlClient(process.env.DIRECT_DB_ENDPOINT, options);
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

async function writeInitialStateForStreamAndType(ldesStream, type) {
  console.log(`[${ldesStream}]  writing initial state for ${type}`);

  var stream = fs.createWriteStream(`/data/${ldesStream}/${filePath}`, {
    flags: "a",
  });

  let offset = 0;
  const count = await countMatchesForType("TODO", type);

  const filter = initialization[ldesStream]?.[type]?.filter || "";

  while (offset + limit < count) {
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

      } WHERE {
        { SELECT ?s ?versionedS WHERE {
          ?s a ${sparqlEscapeUri(type)}.
          GRAPH <http://mu.semte.ch/graphs/ldes-initializer> { ?s ext:versionedUri ?versionedS . }
        } ORDER BY ?s LIMIT ${limit} OFFSET ${offset} }

        ?s ?p ?o .
        FILTER (?p != ext:versionedUri)

        BIND(NOW() as ?now)

        ${filter}
      }`
      )
      .executeRaw();
    stream.write(res.body + "\n");
    console.log(
      `[${ldesStream}]  wrote ${
        offset + limit
      }/${count} instances for type ${type} (${(
        ((offset + limit) / count) *
        100
      ).toFixed(2)}%)`
    );
    offset += limit;
  }
  stream.end();
  console.log(`[${ldesStream}]  done writing initial state for ${type}`);
}

export async function writeInitialState() {
  console.log("writing initial state");

  await cleanupVersionedUris();

  for (const ldesStream in initialization) {
    for (const type in initialization[ldesStream]) {
      await generateVersionedUris(type);
      await writeInitialStateForStreamAndType(ldesStream, type);
    }
  }

  console.log("done writing initial state");
}
