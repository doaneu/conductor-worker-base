/**
 * Conductor Worker Bootstrap
 *
 * Loads the worker module specified by WORKER_MODULE, registers its task
 * definition with Conductor, and starts polling. Workers only need to
 * export { workerDef, execute } — all Conductor boilerplate lives here.
 *
 * Environment variables (base):
 *   WORKER_MODULE        – Absolute path to the worker JS file (required)
 *   WORKER_CONCURRENCY   – Poll concurrency, overrides workerDef value (default: 5)
 *   CONDUCTOR_SERVER_URL – Conductor API base URL (default: http://localhost:8080/api)
 *   CONDUCTOR_KEY_ID     – Orkes key ID (leave blank for open-source Conductor)
 *   CONDUCTOR_KEY_SECRET – Orkes key secret (leave blank for open-source Conductor)
 */

const {
  orkesConductorClient,
  TaskManager,
  MetadataClient,
} = require("@io-orkes/conductor-javascript");
const path = require("path");

async function main() {
  // ---------------------------------------------------------------------------
  // Resolve worker module
  // ---------------------------------------------------------------------------
  const workerModule = process.env.WORKER_MODULE;
  if (!workerModule) {
    console.error("FATAL: WORKER_MODULE environment variable is not set.");
    process.exit(1);
  }

  const workerPath = path.resolve(workerModule);
  let worker;
  try {
    worker = require(workerPath);
  } catch (err) {
    console.error(`FATAL: Failed to load worker module at "${workerPath}": ${err.message}`);
    process.exit(1);
  }

  const { workerDef, execute } = worker;

  if (!workerDef || !workerDef.taskDefName) {
    console.error("FATAL: Worker module must export { workerDef: { taskDefName, ... }, execute }");
    process.exit(1);
  }

  if (typeof execute !== "function") {
    console.error("FATAL: Worker module must export an execute() function.");
    process.exit(1);
  }

  // ---------------------------------------------------------------------------
  // Concurrency — env var wins, falls back to workerDef, then default 5
  // ---------------------------------------------------------------------------
  const concurrency = process.env.WORKER_CONCURRENCY
    ? parseInt(process.env.WORKER_CONCURRENCY, 10)
    : (workerDef.concurrency ?? 5);

  if (isNaN(concurrency) || concurrency < 1) {
    console.error(`FATAL: WORKER_CONCURRENCY must be a positive integer, got "${process.env.WORKER_CONCURRENCY}"`);
    process.exit(1);
  }

  // ---------------------------------------------------------------------------
  // Conductor client
  // ---------------------------------------------------------------------------
  const client = await orkesConductorClient({
    keyId:     process.env.CONDUCTOR_KEY_ID     || "",
    keySecret: process.env.CONDUCTOR_KEY_SECRET || "",
    serverUrl: process.env.CONDUCTOR_SERVER_URL || "http://localhost:8080/api",
  });

  // ---------------------------------------------------------------------------
  // Task registration
  // ---------------------------------------------------------------------------
  if (workerDef.taskDef) {
    const metadataClient = new MetadataClient(client);
    try {
      await metadataClient.registerTasks([
        {
          // Worker-supplied metadata, with safe defaults
          retryCount:             3,
          timeoutSeconds:         360,
          timeoutPolicy:          "TIME_OUT_WF",
          retryLogic:             "FIXED",
          retryDelaySeconds:      10,
          responseTimeoutSeconds: 300,
          outputKeys:             ["result"],
          ...workerDef.taskDef,
          // These must always match — not overridable by taskDef
          name: workerDef.taskDefName,
        },
      ]);
      console.log(`Registered task definition: ${workerDef.taskDefName}`);
    } catch (err) {
      console.error(`WARNING: Task registration failed: ${err.message}`);
      // Non-fatal — task may already be registered
    }
  }

  // ---------------------------------------------------------------------------
  // Start polling
  // ---------------------------------------------------------------------------
  const manager = new TaskManager(client, [
    {
      taskDefName:  workerDef.taskDefName,
      execute,
      concurrency,
      pollInterval: workerDef.pollInterval ?? 1000,
    },
  ]);

  manager.startPolling();
  console.log(
    `Worker "${workerDef.taskDefName}" polling — concurrency: ${concurrency}, pollInterval: ${workerDef.pollInterval ?? 1000}ms`
  );
}

main();
