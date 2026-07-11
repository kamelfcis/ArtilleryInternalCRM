/**
 * CLI shim: the app's services are marked `import "server-only"`, a package Next
 * provides but that throws/!resolves under a plain Node/tsx process. This makes
 * `server-only` (and `client-only`) resolve to an empty module so the importer
 * CLI can reuse those services unchanged. MUST be required before any tainted
 * module loads (it is the first import in scripts/import-documents.ts).
 */
const Module = require("module");
const originalLoad = Module._load;
Module._load = function patchedLoad(request, ...rest) {
  if (request === "server-only" || request === "client-only") return {};
  return originalLoad.apply(this, [request, ...rest]);
};
