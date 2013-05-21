// Karma configuration
// Generated on Fri May 10 2013 14:12:27 GMT-0400 (EDT)


// base path, that will be used to resolve files and exclude
basePath = '';

// list of files / patterns to load in the browser
files = [
  JASMINE,
  JASMINE_ADAPTER,
  'lib/browserfs.js',
  'test/000-setup.js',
  'test/node/test-buffer*.js',
  'test/node/test-path*.js',
  'test/node/test-fs-append-file.js',
  'test/node/test-fs-chmod.js',
  'test/node/test-fs-error-messages.js',
  'test/node/test-fs-exists.js',
  'test/node/test-fs-fsync.js',
  'test/node/test-fs-long-path.js',
  'test/node/test-fs-mkdir.js',
  'test/node/test-fs-null-bytes.js',
  'test/node/test-fs-open.js',
  'test/node/test-fs-read-buffer.js',
  'test/node/test-fs-read-file-sync.js',
  'test/node/test-fs-read.js',
  'test/node/test-fs-readfile-empty.js',
  'test/node/test-fs-readfile-unlink.js',
  'test/node/test-fs-stat.js',
  'test/node/test-fs-truncate.js',
  'test/node/test-fs-write-buffer.js',
  'test/node/test-fs-write-file-buffer.js',
  'test/node/test-fs-write-file-sync.js',
  'test/node/test-fs-write-file.js',
  'test/node/test-fs-write-sync.js',
  'test/node/test-fs-write.js',
  'test/zzz-test_def.js',
  'lib/load_fixtures.js'
];

// Uses streams; can't support yet.
// test-fs-empty-readStream.js
// test-fs-read-stream-err.js
// test-fs-read-stream-fd.js
// test-fs-read-stream-resume.js
// test-fs-read-stream.js
// test-fs-stream-double-close.js
// test-fs-write-stream-change-open.js
// test-fs-write-stream-end.js
// test-fs-write-stream-err.js
// test-fs-write-stream.js

// Uses symlinks, I think:
// test-fs-realpath.js
// test-fs-symlink-dir-junction.js [windows only...?]
// test-fs-symlink.js

// Uses props:
// test-fs-utimes.js

// Uses unsupported watch API:
// test-fs-watch.js

// Try:
// test-fs-sync-fs-leak.js

// Probably too slow // maybe should check FS size before running:
// test-fs-sir-writes-alot.js

// Tests crazy node usage:
// test-fs-non-number-arguments.js



// list of files to exclude
exclude = [
  
];


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
