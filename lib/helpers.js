/**
 * Task result helpers — shared across all workers.
 *
 * completed(outputData) — wraps output in { result } so callers
 *   reference task.result.* consistently across all workers.
 *
 * failed(message) — returns a clean FAILED status with a reason string.
 *   Workers should not pass outputData on failure.
 */

function completed(outputData) {
  return { status: "COMPLETED", outputData: { result: outputData } };
}

function failed(message) {
  return { status: "FAILED", reasonForIncompletion: message };
}

module.exports = { completed, failed };
