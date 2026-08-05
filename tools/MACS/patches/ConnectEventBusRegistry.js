const fs = require("fs");
const path = require("path");

const repoRoot = path.resolve(__dirname, "..", "..", "..");
const target = path.join(
  repoRoot,
  "PROJECTS",
  "CRM",
  "src",
  "EB-00_EnterpriseEventBus.js"
);

const source = fs.readFileSync(target, "utf8");

const functionName = "function MOS5EB_dispatchEvent_";
const start = source.indexOf(functionName);

if (start === -1) {
  throw new Error("MOS5EB_dispatchEvent_ was not found.");
}

const braceStart = source.indexOf("{", start);

if (braceStart === -1) {
  throw new Error("Dispatch function opening brace was not found.");
}

let depth = 0;
let end = -1;

for (let i = braceStart; i < source.length; i++) {
  if (source[i] === "{") {
    depth++;
  } else if (source[i] === "}") {
    depth--;

    if (depth === 0) {
      end = i + 1;
      break;
    }
  }
}

if (end === -1) {
  throw new Error("Dispatch function closing brace was not found.");
}

const replacement = `function MOS5EB_dispatchEvent_(event) {
  if (
    typeof MOS5SUB_dispatchEvent === "function"
  ) {
    return MOS5SUB_dispatchEvent(event);
  }

  const handlerNames =
    MOS5EB_getHandlerNames_(
      event.eventType
    );

  const results = [];

  handlerNames.forEach(function(handlerName) {
    const handler =
      globalThis[handlerName];

    if (typeof handler !== "function") {
      results.push({
        handler: handlerName,
        status: "UNAVAILABLE"
      });

      return;
    }

    try {
      const response = handler(event);

      results.push({
        handler: handlerName,
        status: "COMPLETED",
        response:
          response === undefined
            ? null
            : response
      });
    } catch (error) {
      results.push({
        handler: handlerName,
        status: "FAILED",
        error: String(
          error && error.message
            ? error.message
            : error
        )
      });
    }
  });

  return {
    eventType: event.eventType,
    dispatchMode: "LEGACY_FALLBACK",
    handlerCount: handlerNames.length,
    completedHandlers:
      results.filter(function(result) {
        return result.status === "COMPLETED";
      }).length,
    failedHandlers:
      results.filter(function(result) {
        return result.status === "FAILED";
      }).length,
    unavailableHandlers:
      results.filter(function(result) {
        return result.status === "UNAVAILABLE";
      }).length,
    handlers: results
  };
}`;

const updated =
  source.slice(0, start) +
  replacement +
  source.slice(end);

fs.writeFileSync(target, updated, "utf8");

console.log(
  "[PASS] EB-00 now dispatches through MOS5SUB_dispatchEvent()."
);