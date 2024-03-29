# LDES Publisher Service

This microservice allows you to publish additions and modifications to resources to an LDES backend. The `/publish` endpoint of this service can be added to a delta notifier configuration (https://github.com/mu-semtech/delta-notifier). This microservice has been evaluated to work with https://github.com/redpencilio/fragmentation-producer-service as an LDES-backend.

The following environment variables can be provided:

-   `LDES_ENDPOINT`: the backend endpoint on which the resources should be posted.
-   `LDES_FRAGMENTER` (optional): the fragmenter which should be applied when adding new resources. For time-based streams, this will typically be `time-fragmenter`.
