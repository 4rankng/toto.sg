// toto.sg — ceiling-probe worker. Receives {masks, from, to} jobs from the
// orchestrator's worker pool and returns the chunk aggregates unchanged.
import { parentPort } from "node:worker_threads";
import { probeChunk } from "./edge-routes.mjs";

parentPort.on("message", (job) => {
    const result = probeChunk(job.masks, job.from, job.to);
    parentPort.postMessage(result);
});
