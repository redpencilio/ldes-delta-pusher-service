# LDES Publisher Service

This microservice allows you to publish additions and modifications to resources to an LDES backend. The `/publish` endpoint of this service can be added to a delta notifier configuration (https://github.com/mu-semtech/delta-notifier). This microservice has been evaluated to work with https://github.com/redpencilio/fragmentation-producer-service as an LDES-backend.

The following environment variables can be provided:

- `LDES_ENDPOINT`: the backend endpoint on which the resources should be posted.
- `LDES_FRAGMENTER` (optional): the fragmenter which should be applied when adding new resources. For time-based streams, this will typically be `time-fragmenter`.

- `WRITE_INITIAL_STATE`: if set to "true", this writes the current state of the database to the ldes stream as one large page. Default: "false". Writes to `/data/${streamname}/${firstfilebynumericalsort}.ttl` or creates file `1.ttl` if no file exists. Streams are configured in `config/initialization.ts`
- `LDES_BASE`: base url to be used for the LDES stream that is published. Defaults to `http://lmb.lblod.info/streams/ldes`, only used if `WRITE_INITIAL_STATE` is true.
- `MAX_PAGE_SIZE_BYTES`: the maximum size of every initial LDES page file in bytes, defaults to `10000000`. Only used if `WRITE_INITIAL_STATE` is true.
- `INITIAL_STATE_LIMIT`: the limit to use when writing batches to the initial state file. Note: every batch will have its own prefixes, which means prefixes are redefined (allowed by the turtle spec and virtuoso). Default: 10000. Only used if `WRITE_INITIAL_STATE` is true.
- `DIRECT_DB_ENDPOINT`: writing the initial state requires a direct connection to the database (we use ttl directly). This is the url of the database. Default: http://virtuoso:8890/sparql. Only used if `WRITE_INITIAL_STATE` is true.
- `AUTO_HEALING`: whether or not to use the auto-healing functionality for the LDES stream, set to "true" to activate auto healing. defaults to false.
- `CRON_HEALING`: the cron config for how often to trigger auto healing. Defaults to 0 \* \* \* \* (so every hour).
- `HEALING_LIMIT`: number of instances to heal in one iteration of the auto healing. Defaults to 1000. Only used if `AUTO_HEALING` is true.
- `HEALING_DUMP_GRAPH`: the (temporary) graph that is used to receive the raw triples posted on the LDES. Defaults to `http://mu.semte.ch/graphs/ldes-dump`. This graph is cleared every time the healing process is run.
- `HEALING_TRANSFORMED_GRAPH`: the (temporary) graph where the processed LDES data is stored. This holds the latest version of the LDES instances so they can be compared with what is currently in the database. Defaults to `http://mu.semte.ch/graphs/transformed-ldes-data`
- `HEALING_BATCH_SIZE`: the number of triples that are written to the dump graph at a time. Defaults to 100

## Auto Healing

The LDES delta pusher can fetch its own stream(s) and compare the final result with what is currently in the database. If it discovers changes, it will trigger a new dispatch of the affected instance to the stream.

The stream is read directly from the backend service (using the internal docker compose network) and stored into a temporary graph in the database. The default implementation only looks at the dct:modified time of the instances. The assumption here is that if the modified time is the same, then all other data will also be up to date on the stream. However, by adding other predicates to the `healingPredicates` array in the config, you can have the stream also check for values of other predicates that are not on the LDES stream. Have a look at the example config in `config/healing.ts`, it clarifies the meaning of each value
