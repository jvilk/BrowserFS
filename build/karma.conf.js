// Karma configuration
// Generated on Fri May 10 2013 14:12:27 GMT-0400 (EDT)

module.exports = function(config) {
  config.set({
    // base path, that will be used to resolve files and exclude
    basePath: '../',

    frameworks: ['jasmine'],

    // list of files / patterns to load in the browser
    files: [
      'node_modules/jasmine-tapreporter/src/tapreporter.js',
      'tmp/core/polyfills.js',
      'vendor/assert/assert.js',
      'vendor/requirejs/require.js',
      'vendor/dropbox-build/dropbox.min.js',
      'lib/load_fixtures.js',
      'test/setup.js',
      'test/node/*.js',
      {pattern: 'tmp/**/*.js', included: false, served: true}
    ],

    // list of files to exclude
    exclude: [
    ],

    // test results reporter to use
    // possible values: 'dots', 'progress', 'junit'
    reporters: ['progress'],


    // web server port
    port: 9876,


    // cli runner port
    runnerPort: 9100,


    // enable / disable colors in the output (reporters and logs)
    colors: true,


    // level of logging
    // possible values: LOG_DISABLE || LOG_ERROR || LOG_WARN || LOG_INFO || LOG_DEBUG
    logLevel: config.LOG_INFO,


    // enable / disable watching file and executing tests whenever any file changes
    autoWatch: true,


    // Start these browsers, currently available:
    // - Chrome
    // - ChromeCanary
    // - Firefox
    // - Opera
    // - Safari (only Mac)
    // - PhantomJS
    // - IE (only Windows)
    browsers: ['Chrome'],


    // If browser does not capture in given timeout [ms], kill it
    captureTimeout: 60000,


    // Continuous Integration mode
    // if true, it capture browsers, run tests and exit
    singleRun: false,

    // Avoid hardcoding and cross-origin issues.
    proxies: {
      '/': 'http://localhost:8000/'
    },

    urlRoot: '/karma/'

  });
};
