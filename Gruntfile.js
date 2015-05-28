var fs = require('fs'),
  path = require('path');

if (!fs.existsSync('build')) {
  fs.mkdirSync('build');
}

// Hack: Check if git fixed one of our fixture objects to have a different
// line ending.
try {
  var filePath = path.resolve("test", "fixtures", "files", "node", "x.txt");
  if (fs.readFileSync(filePath).toString() !== "xyz\n") {
    fs.writeFileSync(filePath, new Buffer("xyz\n"));
  }
} catch (e) {
  // Ignore.
}

/**
 * Removes a directory if it exists.
 * Throws an exception if deletion fails.
 */
function removeDir(dir) {
  if (fs.existsSync(dir) && fs.statSync(dir).isDirectory()) {
    // Delete its contents, since you can't delete non-empty folders.
    // :(
    var files = fs.readdirSync(dir);
    for (var i = 0; i < files.length; i++) {
      var fname = dir + path.sep + files[i];
      if (fs.statSync(fname).isDirectory()) {
        removeDir(fname);
      } else {
        removeFile(fname);
      }
    }
    fs.rmdirSync(dir);
  }
}

/**
 * Retrieves a file listing of backends.
 */
function getBackends() {
  var rv = [];
  fs.readdirSync('src/backend').forEach(function (backend) {
    if (backend.slice(-3) === '.ts') {
      // Don't use path.join; R.JS uses Unix slashes.
      // Trim the .ts extension.
      rv.push('backend/' + backend.slice(0, -3));
    }
  });
  return rv;
}

/**
 * Returns an array of essential modules that need to be loaded when BFS
 * loads.
 */
function getEssentialModules() {
  return ['core/browserfs', 'generic/emscripten_fs'].concat(getBackends());
}

/**
 * Get the snippet of JavaScript code that should precede the release version
 * of the library.
 */
function getIntro() {
  // Rhino fix at top of file so we can grab the global scope.
  fs.writeFileSync('build/intro.frag', "(function(global){");
  return 'build/intro.frag';
}

/**
 * RJS doesn't insert a newline between the last startfile and the main module,
 * leading to invalid syntax.
 */
function getNewline() {
  fs.writeFileSync('build/newline.frag', "\n");
  return 'build/newline.frag';
}

/**
 * Get the snippet of JavaScript code that should end the release version of
 * the library.
 */
function getOutro() {
  var modules = getEssentialModules(),
    bfsModule = modules.shift(),
    outro = [], i;
  outro.push("\nglobal.BrowserFS=require('" + bfsModule + "');");
  for (i = 0; i < modules.length; i++) {
    outro.push("require('" + modules[i] + "');");
  }
  outro.push("})(this);");
  fs.writeFileSync('build/outro.frag', outro.join(""));
  return 'build/outro.frag';
}

// Removes a file if it exists.
// Throws an exception if deletion fails.
function removeFile(file) {
  if (fs.existsSync(file) && fs.statSync(file).isFile()) {
    fs.unlinkSync(file);
  }
}

// The files that karma should load up. Stashed in a variable here so we can
// append to it in the dropbox test case.
var karmaFiles = [
  // Special: 'polyfills' is not a module.
  'build/test/src/core/polyfills.js',
  'bower_components/assert/assert.js',
  // Main module and fixtures loader
  'test/fixtures/load_fixtures.js',
  'build/test/test/harness/setup.js',
  /* AMD modules */
  // Tests
  { pattern: 'test/tests/**/*.js', included: false },
  // BFS modules
  { pattern: 'build/test/**/*.js*', included: false },
  // SourceMap support
  { pattern: 'src/**/*.ts*', included: false },
  { pattern: 'bower_components/async/lib/async.js', included: false },
  { pattern: 'node_modules/zlibjs/bin/*.js*', included: false },
  { pattern: 'node_modules/jasmine-tapreporter/src/tapreporter.js', included: false }
];

module.exports = function(grunt) {
  grunt.initConfig({
    // Metadata.
    pkg: grunt.file.readJSON('package.json'),
    connect: {
      server: {
        options: {
          keepalive: false
        }
      }
    },
    karma: {
      options: {
        // base path, that will be used to resolve files and exclude
        basePath: '.',
        frameworks: ['jasmine', 'requirejs'],
        files: karmaFiles,
        exclude: [],
        reporters: ['progress'],
        port: 9876,
        runnerPort: 9100,
        colors: true,
        logLevel: 'INFO',
        autoWatch: true,
        browsers: ['Firefox'],
        captureTimeout: 60000,
        // Avoid hardcoding and cross-origin issues.
        proxies: {
          '/': 'http://localhost:8000/'
        },
        singleRun: false,
        urlRoot: '/karma/'
      },
      test: {},
      dropbox_test: {
        options: {
          files: karmaFiles.concat('bower_components/dropbox-build/dropbox.min.js')
        }
      }
    },
    ts: {
      options: {
        sourcemap: true,
        module: 'amd',
        comments: true,
        declaration: true
      },
      dev: {
        src: ["src/**/*.ts"],
        outDir: path.join('build', 'dev')
      },
      test: {
        src: ["src/**/*.ts", "test/harness/**/*.ts"],
        outDir: path.join('build', 'test')
      },
      watch: {
        // Performs a dev build and rebuilds when changes are made.
        src: ["src/**/*.ts"],
        outDir: path.join('build', 'dev'),
        watch: 'src'
      }
    },
    requirejs: {
      options: {
        // The output of the TypeScript compiler goes into this directory.
        baseUrl: path.join('build', 'dev'),
        // The main module that installs the BrowserFS global and needed polyfills.
        name: '../../bower_components/almond/almond',
        wrap: {
          startFile: [getIntro(), 'build/dev/core/polyfills.js', getNewline()],
          endFile: [getOutro()]
        },
        optimize: 'none',
        generateSourceMaps: true,
        // Need to set to false for source maps to work.
        preserveLicenseComments: false,
        include: getEssentialModules(),
        paths: {
          'zlib': '../../node_modules/zlibjs/bin/rawinflate.min',
          'async': '../../bower_components/async/lib/async'
        },
        shim: {
          'zlib': {
            exports: 'Zlib.RawInflate'
          }
        },
      },
      optimize: {
        options: {
          out: 'build/release/browserfs.min.js',
          optimize: 'uglify2'
        }
      },
      cat: {
        options: {
          out: 'build/release/browserfs.js'
        }
      }
    },
    umd: {
      options: {
        objectToExport: 'BrowserFS'
      },
      all: {
        options: {
          src: 'build/release/browserfs.js',
          dest: 'build/release/browserfs.js'
        }
      },
      min: {
        options: {
          src: 'build/release/browserfs.min.js',
          dest: 'build/release/browserfs.min.js'
        }
      }
    },
    shell: {
      gen_cert: {
        command: [
          // Short circuit if the certificate exists.
          'test ! -e test/fixtures/dropbox/cert.pem',
          'mkdir -p test/fixtures/dropbox',
          'openssl req -new -x509 -days 365 -nodes -batch -out test/fixtures/dropbox/cert.pem -keyout test/fixtures/dropbox/cert.pem -subj /O=dropbox.js/OU=Testing/CN=localhost'
        ].join('&&')
      },
      gen_token: {
        command: path.resolve('node_modules', '.bin', 'coffee') + " " + path.resolve('tools', 'get_db_credentials.coffee')
      },
      load_fixtures: {
        command: path.resolve('node_modules', '.bin', 'coffee') + " " + path.resolve('tools', 'FixtureLoaderMaker.coffee')
      },
      gen_listings: {
        command: path.resolve('node_modules', '.bin', 'coffee') + " " + path.resolve('tools', 'XHRIndexer.coffee'),
        options: {
          callback: function(err, stdout, stderr, cb) {
            if (err) throw err;
            // Write listings to a file.
            if (!fs.existsSync('test/fixtures/xhrfs')) {
              fs.mkdirSync('test/fixtures/xhrfs');
            }
            fs.writeFileSync('test/fixtures/xhrfs/listings.json', stdout);
            cb();
          }
        }
      },
      gen_zipfs_fixtures: {
        command: path.resolve('node_modules', '.bin', 'coffee') + " " + path.resolve('tools', 'ZipFixtureMaker.coffee')
      }
    }
  });

  grunt.loadNpmTasks('grunt-ts');
  grunt.loadNpmTasks('grunt-contrib-watch');
  grunt.loadNpmTasks('grunt-contrib-connect');
  grunt.loadNpmTasks('grunt-contrib-requirejs');
  grunt.loadNpmTasks('grunt-umd');
  grunt.loadNpmTasks('grunt-karma');
  grunt.loadNpmTasks('grunt-shell');

  grunt.registerTask('clean', 'Removes all built files.', function () {
    removeFile('./test/fixtures/load_fixtures.js');
    removeFile('./listings.json');
    removeDir('./build/dev');
    removeDir('./build/release');
    removeDir('./test/fixtures/dropbox');
    removeDir('./test/fixtures/zipfs');
  });

  grunt.registerTask('derequire', 'Apply derequire to output for umd script', function() {
    var derequire = require('derequire');

    var code = derequire(fs.readFileSync('./build/release/browserfs.js'));
    fs.writeFileSync('./build/release/browserfs.js', code);
  });

  // test
  grunt.registerTask('test', ['ts:test', 'shell:gen_zipfs_fixtures', 'shell:gen_listings', 'shell:load_fixtures', 'connect', 'karma:test']);
  // testing dropbox
  grunt.registerTask('dropbox_test', ['ts:test', 'shell:gen_zipfs_fixtures', 'shell:gen_listings', 'shell:load_fixtures', 'shell:gen_cert', 'shell:gen_token', 'connect', 'karma:dropbox_test']);
  // dev build
  grunt.registerTask('dev', ['ts:dev']);
  // dev build + watch for changes.
  grunt.registerTask('watch', ['ts:watch']);
  // release build (default)
  grunt.registerTask('default', ['ts:dev', 'requirejs', 'derequire', 'umd']);
  // testling
  grunt.registerTask('testling', ['default', 'shell:gen_listings', 'shell:gen_zipfs_fixtures', 'shell:load_fixtures']);
};
