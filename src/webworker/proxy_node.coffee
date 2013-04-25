"use strict"

# A Proxy interface for the Node API.
# Use this in a WebWorker to communicate with the filesystem in the main
# JavaScript thread.
# NOTE: WebWorkers have their own current working directory / resolve logic!!
