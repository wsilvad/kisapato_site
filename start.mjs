import { existsSync } from "node:fs";

// Nitro reads HOST and PORT when its generated server module is imported.
// Discloud sites must listen on 0.0.0.0:8080; an injected PORT still wins.
process.env.HOST ??= "0.0.0.0";
process.env.PORT ??= "8080";

// Discloud can expose the automatic dist build from the runtime root. Support
// that layout and a preserved dist directory, which is also used locally.
const runtimeEntry = ["./server/index.mjs", "./dist/server/index.mjs"].find((entry) =>
  existsSync(new URL(entry, import.meta.url)),
);

if (!runtimeEntry) {
  throw new Error(
    "Nitro server bundle not found. Expected server/index.mjs in the Discloud runtime or dist/server/index.mjs after a local build.",
  );
}

await import(runtimeEntry);
