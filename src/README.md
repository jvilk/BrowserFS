What's this all about?
----------------------
`src/main` contains all source files that will be bundled together for the **main** JavaScript thread. This is where the filesystem lives.

`src/worker` contains all source files that will be bundled together for **WebWorker** instances. This contains all of the proxying logic for proxying filesystem requests across the WebWorker boundary.

`src/both` contains source files that must be defined on both sides.
