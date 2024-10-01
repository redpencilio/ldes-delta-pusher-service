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
