/// <reference path="../typings/index.d.ts" />

// Shim for Browserify so we can reference tsd.d.ts without
// accidentally referencing it in our *.d.ts files, which
// causes problems for TypeScript projects that depend on
// us.

export = require('./main');
