// Nitro reads HOST and PORT when its generated server module is imported.
// Discloud sites must listen on 0.0.0.0:8080; an injected PORT still wins.
process.env.HOST ??= "0.0.0.0";
process.env.PORT ??= "8080";

await import("./build/server/index.mjs");
