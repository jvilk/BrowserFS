import WorkerFS from "../../../src/backend/WorkerFS";
import {FileSystem} from '../../../src/core/file_system';

export default function WorkerFSFactory(cb: (name: string, obj: FileSystem[]) => void): void {
  if (WorkerFS.isAvailable()) {
    // Set up a worker, which will host an in-memory FS.
    var worker = new Worker("/test/harness/factories/workerfs_worker.js"),
      workerfsInstance = new WorkerFS(worker);
    worker.addEventListener("message", (e: MessageEvent) => {
      if (e.data === "Ready") {
        workerfsInstance.initialize(() => {
          cb("WorkerFS", [workerfsInstance]);
        });
      }
    });
    // Start the worker.
    worker.postMessage(null);
  } else {
    cb("WorkerFS", []);
  }
}
