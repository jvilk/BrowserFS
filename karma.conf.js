// Karma configuration
// Generated on Fri May 10 2013 14:12:27 GMT-0400 (EDT)


// base path, that will be used to resolve files and exclude
basePath = '';

// list of files / patterns to load in the browser
files = [
  JASMINE,
  JASMINE_ADAPTER,
  'vendor/*.js',
  'src/core/*.coffee',
  'src/generic/*.coffee',
  'src/backend/*.coffee',
  'test/000-setup.js',
  'test/node/*.js',
  'test/zzz-test_def.js',
  'lib/load_fixtures.js'
];

// list of files to exclude
exclude = [
  'test/node/test-fs-realpath.js',
  'test/node/test-fs-sir-writes-alot.js'
];

// compile coffee scripts
preprocessors = {
  'src/**/*.coffee': 'coffee'
};

// test results reporter to use
// possible values: 'dots', 'progress', 'junit'
reporters = ['progress'];


// web server port
port = 9876;


// cli runner port
runnerPort = 9100;


// enable / disable colors in the output (reporters and logs)
colors = true;


// level of logging
// possible values: LOG_DISABLE || LOG_ERROR || LOG_WARN || LOG_INFO || LOG_DEBUG
logLevel = LOG_INFO;


// enable / disable watching file and executing tests whenever any file changes
autoWatch = true;


// Start these browsers, currently available:
// - Chrome
// - ChromeCanary
// - Firefox
// - Opera
// - Safari (only Mac)
// - PhantomJS
// - IE (only Windows)
browsers = ['Chrome', 'Firefox', 'Safari', 'Opera'];


// If browser does not capture in given timeout [ms], kill it
captureTimeout = 60000;


// Continuous Integration mode
// if true, it capture browsers, run tests and exit
singleRun = false;
