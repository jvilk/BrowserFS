/**
 * Bare-minimum worker script to bootstrap us into TypeScript goodness.
 */
importScripts("/vendor/requirejs/require.js");

// XXX: Copying from setup.ts. :(
require.config({
  baseUrl: '/base/build/test',
  paths: {
    'zlib': '../../vendor/zlib.js/rawinflate.min',
    'async': '../../vendor/async/lib/async',
  },

  shim: {
    'zlib': {
      exports: 'Zlib.RawInflate'
    }
  },
  // dynamically load all test files
  deps: ['test/harness/factories/workerfs_factory']
});
