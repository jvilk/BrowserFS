/**
 * Bare-minimum worker script to bootstrap us into TypeScript goodness.
 */
importScripts("/base/build/test/src/core/polyfills.js");
importScripts("/bower_components/requirejs/require.js");

// XXX: Copying from setup.ts. :(
require.config({
  baseUrl: '/base/build/test',
  paths: {
    'zlib': '../../node_modules/zlibjs/bin/rawinflate.min',
    'async': '../../bower_components/async/lib/async',
  },

  shim: {
    'zlib': {
      exports: 'Zlib.RawInflate'
    }
  },
  // dynamically load all test files
  deps: ['test/harness/factories/workerfs_factory']
});
