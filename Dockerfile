FROM node:22-alpine

# System dependencies available to all workers
RUN apk add --no-cache jq

WORKDIR /app

# Install base dependencies
COPY package.json ./
RUN npm install --omit=dev

# Tell node-jq to use the system binary
ENV NODE_JQ_SKIP_INSTALL_BINARY=true
ENV JQ_PATH=/usr/bin/jq

# Shared libraries available to all workers at /app/lib/
COPY lib/ ./lib/

# Bootstrap is the entrypoint — worker images inherit this
COPY bootstrap.js ./

# Conductor config — overridden at runtime or in worker image
ENV CONDUCTOR_SERVER_URL="http://localhost:8080/api"
ENV CONDUCTOR_KEY_ID=""
ENV CONDUCTOR_KEY_SECRET=""

# Concurrency — overridden per deployment
ENV WORKER_CONCURRENCY="5"

# Worker images must set this to their worker file path
ENV WORKER_MODULE=""

CMD ["node", "bootstrap.js"]
