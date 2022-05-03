FROM semtech/mu-javascript-template:feature-typescript-support
LABEL maintainer="madnificent@gmail.com"

ENV LDES_ENDPOINT "http://ldes-time-fragmenter:3000/example"
ENV LDES_STREAM "http://example.org/example-stream"
ENV LDES_RELATION_PATH "http://www.w3.org/ns/prov#generatedAtTime"
ENV LDES_FRAGMENTER "time-fragmenter"