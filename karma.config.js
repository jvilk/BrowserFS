'use strict';

const express = require('express');
const execSync = require('child_process').execSync;
const path = require('path');
const {fork} = require('child_process');
let webdav_server;
// Browser detection does not work properly on Travis.

let dropbox = false;
let continuous = false;
let coverage = false;
let karmaFiles = [
  // Main module and fixtures loader
  'test/harness/test.js',
  // WebWorker script.
  {pattern: 'test/harness/factories/workerfs_worker.js', included: false, watched: true},
  // Source map support
  {pattern: 'src/**/*', included: false, watched: false},
  {pattern: 'test/**/*', included: false, watched: false}
];

// The presence of the Dropbox library dynamically toggles the tests.
if (dropbox) {
  karmaFiles.unshift('node_modules/dropbox/dist/Dropbox-sdk.min.js');
  // Generate token.
  execSync(`node ${path.resolve(__dirname, './build/scripts/get_db_credentials.js')} ${path.resolve(__dirname, './test/fixtures/dropbox/token.json')}`, {
    stdio: 'inherit'
  });
}

module.exports = function (configSetter) {
  let config = {
    basePath: __dirname,
    frameworks: ['mocha', 'events', 'detectBrowsers'],
    detectBrowsers: {
      usePhantomJS: false,
      preferHeadless: true,
      postDetection: (availableBrowsers) => {
        console.log("Available Browsers:" + availableBrowsers);
        const blockedBrowsers = ["IE"];// the tests don't even run on IE
        for (let browser of blockedBrowsers) {
          const index = availableBrowsers.indexOf(browser)
          if (index !== -1)
            availableBrowsers.splice(index, 1);
        }
        return availableBrowsers;
      }
    },
    files: karmaFiles,
    exclude: [],
    reporters: ['spec'],
    port: 9876,
    colors: true,
    logLevel: 'INFO',
    autoWatch: true,
    concurrency: 1,
    captureTimeout: 60000,
    singleRun: !continuous,
    urlRoot: '/',
    // Dropbox tests are slow.
    browserNoActivityTimeout: 60000,
    browserDisconnectTimeout: 10000,
    browserDisconnectTolerance: 3,
    preprocessors: {},
    coverageReporter: undefined,
    client: {
      mocha: {
        // Stop tests after first failure.
        // Our tests have some global state (e.g. # of pending callbacks). Once those get messed up by a failing test,
        // subsequent tests are likely to fail.
        bail: true
      }
    },
    middleware: ['static'],
    plugins: [
      'karma-*',
      {
        'middleware:static': ['factory', function () {
          return express.static(__dirname);
        }]
      }
    ],
    events: {
      events: {
        run_start: function (browsers, logger) {
          logger.info(`starting webdav server`);
          if (!webdav_server) {
            webdav_server = fork("./build/scripts/webdav_server.js", [], {
              stdio: [0, 1, 2, 'ipc'],
            });
          }
        },
        run_complete: function (browsers, results, logger) {
          logger.info(`run_complete: Stopping server.`);
          webdav_server.kill();
        }
      }
    }
  };
  if (coverage) {
    config.reporters.push('coverage');
    config.preprocessors = {
      './test/harness/**/*.js': ['coverage']
    };
    config.coverageReporter = {type: 'json', dir: 'coverage/'};
  }
  configSetter.set(config);
};
