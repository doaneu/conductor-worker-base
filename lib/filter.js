/**
 * jq filter utility — shared across all workers.
 *
 * Applies a jq expression to a JSON object and returns the result.
 * Throws with a descriptive message if the expression fails, so the
 * caller can convert it to a failed() task result.
 *
 * Requires the system jq binary (installed in the base image) and
 * node-jq (installed in the base image's node_modules).
 *
 * Usage:
 *   const { applyFilter } = require('/app/lib/filter');
 *   const filtered = await applyFilter(responseBody, '.data.items[]');
 */

const jq = require("node-jq");

async function applyFilter(data, expression) {
  try {
    return await jq.run(expression, data, { input: "json", output: "json" });
  } catch (err) {
    throw new Error(`jq filter error: ${err.message}`);
  }
}

module.exports = { applyFilter };
