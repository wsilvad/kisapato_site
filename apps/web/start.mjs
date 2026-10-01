// Ponto de entrada exigido pela Discloud (MAIN); sobe o Next na porta 8080 do TYPE=site.
import { spawn } from "node:child_process";

const child = spawn("npx", ["next", "start", "-p", "8080"], { stdio: "inherit" });
child.on("exit", (code) => process.exit(code ?? 0));
