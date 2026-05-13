/**
 * Task result helpers — shared across all workers.
 *
 * completed(outputData) — wraps output in { result } so callers
 *   reference task.result.* consistently across all workers.
 *
 * failed(message, outputData?) — returns a clean FAILED status with a reason string.
 *   Optional outputData is wrapped in { result } and returned alongside the failure,
 *   useful for workflow branching on error details (e.g. http_status_code).
 */

function completed(outputData) {
  return { status: "COMPLETED", outputData: { result: outputData } };
}

function failed(message, outputData = {}) {
  return { status: "FAILED", reasonForIncompletion: message, outputData: { result: outputData } };
}

module.exports = { completed, failed };
