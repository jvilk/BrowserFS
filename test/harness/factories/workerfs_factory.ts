import workerfs = require("../../../src/backend/workerfs");
import BackendFactory = require('../BackendFactory');
import file_system = require('../../../src/core/file_system');
import inmemfs_factory = require('./inmemory_factory');
import browserfs = require("../../../src/core/browserfs");
import util = require("../../../src/core/util");

function WorkerFSFactory(cb: (name: string, obj: file_system.FileSystem[]) => void): void {
  if (workerfs.WorkerFS.isAvailable()) {
    // Set up a worker, which will host an in-memory FS.
    var worker = new Worker("/test/harness/factories/workerfs_worker.js"),
      workerfsInstance = new workerfs.WorkerFS(worker);
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

var _: BackendFactory = WorkerFSFactory;

export = WorkerFSFactory;

// Use this script as the worker script. :)
if (util.isWebWorker) {
  // Construct an in-memory file system, 
  inmemfs_factory((name, objs) => {
    browserfs.initialize(objs[0]);
    // Listen for API requests.
    workerfs.WorkerFS.attachRemoteListener(<Worker> <any> self);
    // Tell the main thread that we are ready.
    (<Worker> <any> self).postMessage("Ready");
  });
}
