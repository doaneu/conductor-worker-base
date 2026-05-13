# Conductor Worker Base

Base Docker image for [Conductor OSS](https://conductor-oss.org) workers. Handles all Conductor boilerplate — client setup, task registration, and polling — so individual worker images only need to export business logic.

---

## How it works

The base image provides a `bootstrap.js` entrypoint that:

1. Loads the worker file specified by `WORKER_MODULE`
2. Registers the task definition with Conductor
3. Starts the `TaskManager` polling loop

Worker images inherit from this base, copy in a single JS file, and set their environment variables. No Conductor code lives in the worker.

---

## Building the base image

```bash
docker build -t conductor-worker-base:latest .
```

---

## Creating a worker image

A worker needs two files: a JS module and a Dockerfile.

### Worker module

The worker exports `workerDef` and `execute`. All Conductor wiring is handled by the base.

```js
// my_worker.js
const { completed, failed } = require('/app/lib/helpers');
const { applyFilter }       = require('/app/lib/filter');

async function execute(task) {
  const input = task.inputData || {};

  try {
    // business logic here
    return completed({ some_value: 'result' });
  } catch (err) {
    return failed(err.message);
  }
}

const workerDef = {
  taskDefName: 'my_worker',
  pollInterval: 1000,
  taskDef: {
    description:            'My worker',
    retryCount:             3,
    timeoutSeconds:         360,
    inputKeys:              ['some_input'],
    outputKeys:             ['result'],
    timeoutPolicy:          'TIME_OUT_WF',
    retryLogic:             'FIXED',
    retryDelaySeconds:      10,
    responseTimeoutSeconds: 300,
  },
};

module.exports = { workerDef, execute };
```

### Dockerfile

```dockerfile
FROM conductor-worker-base:latest

COPY my_worker.js ./workers/

ENV WORKER_MODULE="/app/workers/my_worker.js"
ENV MY_WORKER_API=""
ENV MY_WORKER_KEY=""
```

### Build and run

```bash
docker build -t my-worker:latest .

docker run --rm \
  -e CONDUCTOR_SERVER_URL=http://conductor:8080/api \
  -e WORKER_CONCURRENCY=5 \
  -e MY_WORKER_API=https://api.example.com \
  -e MY_WORKER_KEY=secret \
  my-worker:latest
```

---

## Environment variables

### Base image (all workers inherit these)

| Variable | Required | Default | Description |
|---|---|---|---|
| `WORKER_MODULE` | Yes | — | Absolute path to the worker JS file |
| `WORKER_CONCURRENCY` | No | `5` | Number of tasks polled concurrently. Overrides `workerDef.concurrency` |
| `CONDUCTOR_SERVER_URL` | No | `http://localhost:8080/api` | Conductor API base URL |
| `CONDUCTOR_KEY_ID` | No | `""` | Orkes key ID. Leave blank for open-source Conductor |
| `CONDUCTOR_KEY_SECRET` | No | `""` | Orkes key secret. Leave blank for open-source Conductor |

### Worker images

Workers declare their own environment variables in their Dockerfile and read them inside `execute()`.

---

## Shared libraries

The base exposes two utility modules available to all workers.

### `/app/lib/helpers.js`

```js
const { completed, failed } = require('/app/lib/helpers');
```

| Function | Description |
|---|---|
| `completed(outputData)` | Returns a `COMPLETED` task result. Wraps `outputData` in `{ result }` — callers reference `task.result.*` |
| `failed(message)` | Returns a `FAILED` task result with `reasonForIncompletion` set to `message` |

### `/app/lib/filter.js`

```js
const { applyFilter } = require('/app/lib/filter');

const filtered = await applyFilter(responseBody, '.data.items[]');
```

Applies a [jq](https://jqlang.org) expression to a JSON object. Throws with a descriptive error if the expression is invalid — catch it and return `failed()`. Requires the system jq binary (pre-installed in the base image).

---

## Worker contract

| Export | Required | Description |
|---|---|---|
| `workerDef.taskDefName` | Yes | Conductor task name |
| `workerDef.pollInterval` | No | Poll interval in ms. Defaults to `1000` |
| `workerDef.taskDef` | No | Task registration metadata. If omitted, the task must already be registered in Conductor |
| `execute` | Yes | Async function `(task) => TaskResult` |

### Output shape

`completed()` always wraps output in `{ result }`. Reference output in workflows as:

```
${task_ref.output.result.your_field}
```

---

## Infrastructure

| Item | Value |
|---|---|
| Base image | `node:22-alpine` |
| System packages | `jq` |
| Conductor SDK | `@io-orkes/conductor-javascript ^3.0.0` |
| jq binding | `node-jq ^4.0.0` (uses system binary) |
| Default concurrency | 5 |
| Default poll interval | 1000 ms |

