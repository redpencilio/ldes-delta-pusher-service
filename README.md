# LDES Publisher Service

This microservice allows you to publish additions and modifications to resources to an LDES backend. The `/publish` endpoint of this service can be added to a delta notifier configuration (https://github.com/mu-semtech/delta-notifier). This microservice has been evaluated to work with https://github.com/redpencilio/fragmentation-producer-service as an LDES-backend.

The following environment variables can be provided:

- `LDES_FOLDER`: the default folder being used.
- `LDES_FRAGMENTER` (optional): the fragmenter which should be applied when adding new resources. For time-based streams, this will typically be `time-fragmenter`.
- `LDES_STATUS_GRAPH`: EXPERIMENTAL optional the graph where the ldes-delta-pusher keeps its status. If empty, no status is kept and no catching up is done. If this is used, the pusher will write the last dct:modified timestamp that it processed into this graph. Upon restart, it will examine this graph and fetch all subjects from the database with a modified greater or equal to that value minus LDES_CATCH_UP_INITIAL_OFFSET in milliseconds. All of these will be sent (paginated) to the `handlePage` function in `catchUp.ts` in the config folder. Each page is a list of Catchup items {uri, type, modified}. The default config just writes all information about this subject to the LDES. This is naive, you probably want your own implementation of this.
- `LDES_CATCH_UP_PAGE_SIZE`: the page size used when catching up. Only used when `LDES_STATUS_GRAPH` is set
- `LDES_CATCH_UP_INITIAL_OFFSET`: the offset in ms used when catching up after restart. Only used when `LDES_STATUS_GRAPH` is set. Defaults to 1. Upon restart, the pusher will add all items on the LDES with a dct:modified >= the last sync date - the offset. This might add a little duplicate info on the LDES but this way, if two items had the same dct:modified and only the first one made it onto the LDES, now the second one is also there.

### LDES PRODUCER CONFIG:

The following environment variables must be configured:

- `BASE_URL` (required): the base-url on which this service is hosted. This ensures the service can resolve relative urls.
- `BASE_FOLDER`: the parent folder to store the LDES streams in. (default: `./data`)
- `LDES_STREAM_PREFIX`: the stream prefix to use to identify the streams. This prefix is used in conjunction with the folder name of the stream. (default: `http://mu.semte.ch/streams/`)
- `TIME_TREE_RELATION_PATH`: the path on which the relations should be defined when fragmenting resources using the time-fragmenter. This is also the predicate which is used when adding a timestamp to a new version of a resource. (default: `http://www.w3.org/ns/prov#generatedAtTime`)
- `PREFIX_TREE_RELATION_PATH`: the path on which the relations should be defined when fragmenting resources using the prefix-tree-fragmenter. (default: `https://example.org/name`)
- `CACHE_SIZE`: the maximum number of pages the cache should keep in memory. (default: `10`)
- `FOLDER_DEPTH`: the number of levels the data folder structure should contain. (default: `1`, a flat folder structure)
- `PAGE_RESOURCES_COUNT`: the number of resources (members) one page should contain. (default: `10`)
- `SUBFOLDER_NODE_COUNT`: the maximum number of nodes (pages) a subfolder should contain. (default: `10`)
  u
  > [!CAUTION]
  > The catching up after restart process is EXPERIMENTAL. It also has the drawback that IF you add a migration (not triggering deltas right now) with concepts that have modified dates earlier than the moment the LDES has caught up to, these instances will NOT be detected by the catch up process and will NOT appear on the LDES feed. You can get around that by setting the ext:lastSync for the LDES pusher to before these modified dates, but that will trigger some duplication on the feed.
