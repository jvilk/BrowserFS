var fs = require('fs'),
  path = require('path'),
  _ = require('underscore'),
  browserifyConfig = {
    // Note: Cannot use "bare" here. That's a command-line-only switch.
    builtins: [],
    detectGlobals: false,
    debug: true,
    transform: [
      'aliasify'
    ],
    plugin: [
      'tsify', 'browserify-derequire'
    ]
  },
  nodeTSConfig = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'tsconfig.json')).toString());

// Filter out test/ files.
nodeTSConfig.files = nodeTSConfig.files.filter(function(file) {
  return file.slice(0, 4) !== 'test';
});

// Ugh, need to write this to a file for grunt-ts.
fs.writeFileSync(path.resolve(__dirname, "generated_node_tsconfig.json"), JSON.stringify(nodeTSConfig));

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
  // Main module and fixtures loader
  'test/harness/run.ts',
  /* AMD modules */
  // Tests
  { pattern: 'test/tests/**/*.js', included: false },
  // BFS modules
  { pattern: 'test/**/*.ts*', included: false },
  // SourceMap support
  { pattern: 'src/**/*.ts*', included: false },
  { pattern: 'typings/**/*.d.ts', included: false },
  { pattern: 'node_modules/pako/dist/*.js*', included: false }
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
    ts: {
      default: {
        tsconfig: path.resolve(__dirname, "generated_node_tsconfig.json")
      }
    },
    tsd: {
      browserfs: {
        options: {
          command: "reinstall",
          config: "tsd.json"
        }
      }
    },
    karma: {
      options: {
        // base path, that will be used to resolve files and exclude
        basePath: '.',
        frameworks: ['mocha', 'browserify'],
        files: karmaFiles,
        preprocessors: {
          'test/harness/run.ts': ['browserify']
        },
        browserify: _.extend({}, browserifyConfig,
          {
            builtins: ['assert']
          }
        ),
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
          files: karmaFiles.concat('node_modules/dropbox/lib/dropbox.js')
        }
      }
    },
    browserify: {
      workerfs_worker: {
        options: {
          browserifyOptions: browserifyConfig
        },
        files: {
          './test/harness/factories/workerfs_worker.js': './test/harness/factories/workerfs_worker.ts'
        }
      },
      browserfs: {
        options: {
          browserifyOptions: _.extend({}, browserifyConfig, {
            // Expose what's exported in main.ts under the name BrowserFS,
            // wrapped as an UMD module.
            standalone: 'BrowserFS'
          })
        },
        files: {
          './build/browserfs.js': './src/browserify_main.ts'
        }
      },
      watch: {
        options: {
          browserifyOptions: _.extend({}, browserifyConfig, {
            // Expose what's exported in main.ts under the name BrowserFS,
            // wrapped as an UMD module.
            standalone: 'BrowserFS'
          }),
          watch: true,
          keepAlive: true
        },
        files: {
          './build/browserfs.js': './src/main.ts'
        }
      }
    },
    uglify: {
      min: {
        options: {
          sourceMap: true,
          sourceMapIncludeSources: true,
          sourceMapIn: './build/browserfs.js.map'
        },
        files: {
          './build/browserfs.min.js': './build/browserfs.js'
        }
      }
    },
    exorcise: {
      all: {
        options: {
          strict: true
        },
        files: {
          './build/browserfs.js.map': './build/browserfs.js'
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
    },
    copy: {
      dist: {
        files: [{
          expand: true,
          cwd: 'build/',
          src: ['**'],
          dest: 'dist/'
        }]
      }
    }
  });

  grunt.loadNpmTasks('grunt-contrib-watch');
  grunt.loadNpmTasks('grunt-contrib-connect');
  grunt.loadNpmTasks('grunt-browserify');
  grunt.loadNpmTasks('grunt-contrib-uglify');
  grunt.loadNpmTasks('grunt-exorcise');
  grunt.loadNpmTasks('grunt-karma');
  grunt.loadNpmTasks('grunt-shell');
  grunt.loadNpmTasks('grunt-ts');
  grunt.loadNpmTasks('grunt-contrib-copy');
  grunt.loadNpmTasks('grunt-tsd');

  grunt.registerTask('clean', 'Removes all built files.', function () {
    removeFile('./test/fixtures/load_fixtures.js');
    removeFile('./listings.json');
    removeDir('./build');
    removeDir('./test/fixtures/dropbox');
    removeDir('./test/fixtures/zipfs');
  });

  grunt.registerTask('main.ts', 'Construct main.ts to include all backends and polyfills', function() {
    var modules = getEssentialModules(),
      bfsModule = modules.shift(),
      main = [];
    main.push(fs.readFileSync('src/main.tstemplate'));
    modules.forEach(function(mod) {
      main.push("require('./" + mod + "');");
    });
    main.push("import bfs = require('./" + bfsModule + "');\nexport = bfs;");
    fs.writeFileSync('src/main.ts', main.join('\n'));
  });

  grunt.registerTask('run.ts', 'Construct run.ts to include all tests and factories.', function() {
    var tests = {}, testsStringified, factoryStringified;
    function processDir(dir, dirInfo) {
      fs.readdirSync(dir).forEach(function(file) {
        var filePath = path.resolve(dir, file),
          relPath = path.relative(path.resolve('test/harness'), filePath);
        if (fs.statSync(filePath).isFile()) {
          relPath.slice(0, relPath.length - 3);
          dirInfo[file] = "require('" + relPath + "')";
        } else {
          dirInfo[file] = {};
          processDir(filePath, dirInfo[file]);
        }
      });
    }
    processDir('test/tests', tests);
    testsStringified = JSON.stringify(tests).replace(/:\"require\('([^)]*)'\)\"/g, ":require('$1')");
    // Remove { }.
    testsStringified = testsStringified.slice(1, testsStringified.length - 1);
    factoryStringified = fs.readdirSync('test/harness/factories')
      .filter(function(file) {
        return file.slice(file.length-11) === "_factory.ts";
      })
      .map(function(file) {
        return "require('./factories/" + file + "')";
      }).join(', ');

    fs.writeFileSync('test/harness/run.ts',
      fs.readFileSync('test/harness/run.tstemplate')
        .toString()
        .replace(/\/\*FACTORIES\*\//g, factoryStringified)
        .replace(/\/\*TESTS\*\//g, testsStringified), 'utf8'
    );
  });

  // test
  grunt.registerTask('test', ['main.ts', 'run.ts', 'browserify:workerfs_worker', 'shell:gen_zipfs_fixtures', 'shell:gen_listings', 'shell:load_fixtures', 'connect', 'karma:test']);
  // testing dropbox
  grunt.registerTask('dropbox_test', ['main.ts', 'run.ts', 'browserify:workerfs_worker', 'shell:gen_zipfs_fixtures', 'shell:gen_listings', 'shell:load_fixtures', 'shell:gen_cert', 'shell:gen_token', 'connect', 'karma:dropbox_test']);
  // dev build + watch for changes.
  grunt.registerTask('watch', ['main.ts', 'browserify:watch']);
  // dev build
  grunt.registerTask('dev', ['tsd:browserfs', 'main.ts', 'browserify:browserfs', 'exorcise', 'ts']);
  // release build (default)
  grunt.registerTask('default', ['dev', 'uglify']);
  // dist
  grunt.registerTask('dist', ['clean', 'dev', 'copy:dist']);
};
