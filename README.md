# LDES Publisher Service

This microservice allows you to publish additions and modifications to resources to an LDES backend. The `/publish` endpoint of this service can be added to a delta notifier configuration (https://github.com/mu-semtech/delta-notifier). This microservice has been evaluated to work with https://github.com/redpencilio/fragmentation-producer-service as an LDES-backend.

The following environment variables can be provided:

- `LDES_ENDPOINT`: the backend endpoint on which the resources should be posted.
- `LDES_FRAGMENTER` (optional): the fragmenter which should be applied when adding new resources. For time-based streams, this will typically be `time-fragmenter`.
- `LDES_STATUS_GRAPH`: EXPERIMENTAL optional the graph where the ldes-delta-pusher keeps its status. If empty, no status is kept and no catching up is done. If this is used, the pusher will write the last dct:modified timestamp that it processed into this graph. Upon restart, it will examine this graph and fetch all subjects from the database with a modified greater or equal to that value minus LDES_CATCH_UP_INITIAL_OFFSET in milliseconds. All of these will be sent (paginated) to the `handlePage` function in `catchUp.ts` in the config folder. Each page is a list of Catchup items {uri, type, modified}. The default config just writes all information about this subject to the LDES. This is naive, you probably want your own implementation of this.
- `LDES_STATUS_SUBJECT`: the subject used to representing the status of the ldes. Only used if LDES_STATUS_GRAPH is set. Currently the only triple stored is `LDES_STATUS_SUBJECT ext:lastSync lastsyncdate.`
- `LDES_CATCH_UP_PAGE_SIZE`: the page size used when catching up. Only used when `LDES_STATUS_GRAPH` is set
- `LDES_CATCH_UP_INITIAL_OFFSET`: the offset in ms used when catching up after restart. Only used when `LDES_STATUS_GRAPH` is set. Defaults to 1. Upon restart, the pusher will add all items on the LDES with a dct:modified >= the last sync date - the offset. This might add a little duplicate info on the LDES but this way, if two items had the same dct:modified and only the first one made it onto the LDES, now the second one is also there.
