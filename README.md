# LDES Publisher Service

This microservice allows you to publish additions and modifications to resources to an LDES backend. The `/publish` endpoint of this service can be added to a delta notifier configuration (https://github.com/mu-semtech/delta-notifier). This microservice has been evaluated to work with https://github.com/redpencilio/fragmentation-producer-service as an LDES-backend.

The following environment variables can be provided:

- `LDES_ENDPOINT`: the backend endpoint on which the resources should be posted.
- `LDES_FRAGMENTER` (optional): the fragmenter which should be applied when adding new resources. For time-based streams, this will typically be `time-fragmenter`.
- `LDES_STATUS_GRAPH`: EXPERIMENTAL optional the graph where the ldes-delta-pusher keeps its status. If empty, no status is kept and no catching up is done. If this is used, the pusher will write the last dct:modified timestamp that it processed into this graph. Upon restart, it will examine this graph and fetch all subjects from the database with a modified greater or equal to that value minus LDES_CATCH_UP_INITIAL_OFFSET in milliseconds. All of these will be sent (paginated) to the `handlePage` function in `catchUp.ts` in the config folder. Each page is a list of Catchup items {uri, type, modified}. The default config just writes all information about this subject to the LDES. This is naive, you probably want your own implementation of this.
- `LDES_CATCH_UP_PAGE_SIZE`: the page size used when catching up. Only used when `LDES_STATUS_GRAPH` is set
- `LDES_CATCH_UP_INITIAL_OFFSET`: the offset in ms used when catching up after restart. Only used when `LDES_STATUS_GRAPH` is set. Defaults to 1. Upon restart, the pusher will add all items on the LDES with a dct:modified >= the last sync date - the offset. This might add a little duplicate info on the LDES but this way, if two items had the same dct:modified and only the first one made it onto the LDES, now the second one is also there.

- `WRITE_INITIAL_STATE`: if set to "true", this writes the current state of the database to the ldes stream as one large page. Default: "false". Writes to `/data/${streamname}/${firstfilebynumericalsort}.ttl` or creates file `1.ttl` if no file exists. Streams are configured in `config/initialization.ts`
- `LDES_BASE`: base url to be used for the LDES stream that is published. Defaults to `http://lmb.lblod.info/streams/ldes`, only used if `WRITE_INITIAL_STATE` is true.
- `MAX_PAGE_SIZE_BYTES`: the maximum size of every initial LDES page file in bytes, defaults to `10000000`. Only used if `WRITE_INITIAL_STATE` is true.
- `INITIAL_STATE_LIMIT`: the limit to use when writing batches to the initial state file. Note: every batch will have its own prefixes, which means prefixes are redefined (allowed by the turtle spec and virtuoso). Default: 10000. Only used if `WRITE_INITIAL_STATE` is true.
- `DIRECT_DB_ENDPOINT`: writing the initial state requires a direct connection to the database (we use ttl directly). This is the url of the database. Default: http://virtuoso:8890/sparql. Only used if `WRITE_INITIAL_STATE` is true.

> [!CAUTION]
> The catching up after restart process is EXPERIMENTAL. It also has the drawback that IF you add a migration (not triggering deltas right now) with concepts that have modified dates earlier than the moment the LDES has caught up to, these instances will NOT be detected by the catch up process and will NOT appear on the LDES feed. You can get around that by setting the ext:lastSync for the LDES pusher to before these modified dates, but that will trigger some duplication on the feed.
