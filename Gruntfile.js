var fs = require('fs'),
  path = require('path'),
  _ = require('underscore'),
  mold = require('mold-source-map'),
  browserifyConfig = {
    // Note: Cannot use "bare" here. That's a command-line-only switch.
    builtins: _.extend({}, require('browserify/lib/builtins'), {
        "buffer": require.resolve('bfs-buffer'),
        "path": require.resolve("bfs-path")
    }),
    insertGlobalVars: {
        "Buffer": function() { return "require('bfs-buffer').Buffer" },
        "process": function () { return "require('bfs-process')" }
    },
    detectGlobals: true,
    debug: true,
    transform: [
      'aliasify'
    ],
    plugin: [
      'tsify', 'browserify-derequire'
    ]
  },
  nodeTSConfig = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'tsconfig.json')).toString()),
  karmaFiles = [
    // Main module and fixtures loader
    'test/harness/test.js',
    /* Modules */
    // Tests
    { pattern: 'test/tests/**/*.js', included: false, watched: false },
    // BFS modules
    { pattern: 'test/**/*.ts*', included: false, watched: false },
    // SourceMap support
    { pattern: 'src/**/*.ts*', included: false, watched: false },
    { pattern: 'typings/**/*.d.ts', included: false },
    { pattern: 'node_modules/pako/dist/*.js*', included: false }
  ],
  karmaBrowsers = require('detect-browsers').getInstalledBrowsers().map(function(item) {
    return item.name;
  }).filter(function(name, index, arr) {
    // Remove duplicates, and items with a space in them.
    return arr.indexOf(name) === index && arr.indexOf(' ') === -1;
  });

if (karmaBrowsers.indexOf('IE') !== -1) {
  karmaBrowsers.push('IE9', 'IE8');
}

var karmaConfig = {
    // base path, that will be used to resolve files and exclude
    basePath: '.',
    frameworks: ['mocha'],
    files: karmaFiles,
    exclude: [],
    reporters: ['progress'],
    port: 9876,
    runnerPort: 9100,
    colors: true,
    logLevel: 'INFO',
    autoWatch: true,
    customLaunchers: {
      IE9: {
        base: 'IE',
        'x-ua-compatible': 'IE=EmulateIE9'
      },
      IE8: {
        base: 'IE',
        'x-ua-compatible': 'IE=EmulateIE8'
      }
    },
    browsers: karmaBrowsers,
    captureTimeout: 60000,
    // Avoid hardcoding and cross-origin issues.
    proxies: {
      '/': 'http://localhost:8000/'
    },
    singleRun: true,
    urlRoot: '/karma/',
    // Dropbox tests are slow.
    browserNoActivityTimeout: 30000,
    browserDisconnectTimeout: 10000,
    browserDisconnectTolerance: 3,
    client: {
      mocha: {
        // Stop tests after first failure.
        // Our tests have some global state (e.g. # of pending callbacks). Once those get messed up by a failing test,
        // subsequent tests are likely to fail.
        bail: true
      }
    }
  };

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
 * Retrieves a file listing of backends.
 */
function getBackends() {
  var rv = [];
  fs.readdirSync('src/backend').forEach(function (backend) {
    if (backend.slice(-3) === '.ts') {
      // Trim the .ts extension.
      rv.push(backend.slice(0, -3));
    }
  });
  return rv;
}

module.exports = function(grunt) {
  var dropboxEnabled = grunt.option('dropbox'),
    browser = grunt.option('browser') || "Chrome";
  if (dropboxEnabled) {
    karmaFiles = karmaFiles.concat('node_modules/dropbox/lib/dropbox.js');
  }
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
      options: karmaConfig,
      // Useful for development.
      continuous: {
        options: {
          singleRun: false,
          // Integrate browserify into the karma config.
          frameworks: karmaConfig.frameworks.concat('browserify'),
          // Use a single browser, otherwise things get messy.
          browsers: [browser],
          // Replace test.js w/ run.ts.
          files: ['test/harness/run.ts'].concat(karmaFiles.slice(1)),
          preprocessors: {
            'test/harness/run.ts': ['browserify']
          },
          browserify: browserifyConfig
        }
      }
    },
    // These will run browsers sequentially.
    'karma-sequence': {
      options: karmaConfig,
      test: {},
      test_travis: {
        options: {
          browsers: ['Firefox']
        }
      },
      coverage: {
        options: {
          reporters: karmaConfig.reporters.concat(['coverage']),
          preprocessors: {
            './test/harness/**/*.js': ['coverage']
          },
          coverageReporter: { type: 'json', dir: 'coverage/' }
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
      test: {
        options: {
          browserifyOptions: browserifyConfig
        },
        files: {
          './test/harness/test.js': './test/harness/run.ts'
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
    },
    remapIstanbul: {
      default: {
        files: [ {
          src: 'coverage/**/coverage-final.json',
          dest: 'coverage/coverage-combined.json',
          type: 'json'
        } ]
      }
    },
    makeReport: {
      src: 'coverage/coverage-combined.json',
      options: {
        type: 'html',
        dir: 'coverage/html'
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
  grunt.loadNpmTasks('remap-istanbul');
  grunt.loadNpmTasks('grunt-istanbul');

  // Inspired by https://github.com/Malkiz/grunt-karma-sequence
  grunt.registerMultiTask('karma-sequence', 'Run Karma with multiple browsers sequentially', function(){
    var _this = this;
    var options = _this.options();
    var browsers = options.browsers;
    var safariCleanupNeeded = false;

    function clone(obj) {
      return JSON.parse(JSON.stringify(obj));
    }

    if (typeof browsers == 'object' && browsers.length > 0) {
      browsers.forEach(function (browser) {
        var clonedData = clone(_this.data);
        clonedData.browsers = [browser];
        clonedData.singleRun = true;

        if (clonedData.junitReporter && clonedData.junitReporter.outputFile) {
          var path = clonedData.junitReporter.outputFile;
          var matched = path.match(/([^]*)\.([^\.]*)$/);
          clonedData.junitReporter.outputFile = matched[1] + '.' + browser + '.' + matched[2];
        }

        var taskName = 'karma';
        var name = _this.target + '-sequence-' + browser;
        grunt.config(taskName + '.' + name, clonedData);
        if (browser.toLowerCase() === 'safari') {
          // Workaround for Safari opening tons of tabs:
          // https://github.com/karma-runner/karma-safari-launcher/issues/6#issuecomment-28447748
          try {
            if (require('child_process').execSync('defaults read com.apple.Safari ApplePersistenceIgnoreState').toString().trim().toLowerCase() === 'yes') {
              safariCleanupNeeded = false;
            } else {
              safariCleanupNeeded = true;
            }
          } catch (e) {
            // No default set. Default is 'NO'.
            safariCleanupNeeded = true;
          }
          require('child_process').execSync('defaults write com.apple.Safari ApplePersistenceIgnoreState YES');
          safariQueued = true;
        }
        grunt.task.run(taskName + ':' + name);
      });

      if (safariCleanupNeeded) {
        grunt.task.run('karma-cleanup-safari');
      }
    }
  });

  grunt.registerTask('karma-cleanup-safari', 'Cleans up some settings we need to set for Safari to behave with Karma.', function() {
    // Revert the setting we made.
    require('child_process').execSync('defaults write com.apple.Safari ApplePersistenceIgnoreState NO');
  });

  grunt.registerTask('clean', 'Removes all built files.', function () {
    grunt.file.delete('./test/fixtures/load_fixtures.js');
    grunt.file.delete('./listings.json');
    grunt.file.delete('./build');
    grunt.file.delete('./test/fixtures/dropbox');
    grunt.file.delete('./test/fixtures/zipfs');
  });

  grunt.registerTask('clean_dist', 'Cleans old distributables.', function() {
    grunt.file.delete('./dist');
  });

  grunt.registerTask('backends.ts', 'Construct backends.ts to include all backends', function() {
    var backends = getBackends(),
      main = [];
    backends.forEach(function(backendName) {
      main.push("import " + backendName + " from '../backend/" + backendName + "';");
    });
    main.push("export {" + backends.join(", ") + "};\n");
    fs.writeFileSync('src/core/backends.ts', main.join('\n'));
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

  grunt.registerTask('adjust_test_bundle', 'Fixes the source map directory in the test bundle.', function() {
    var done = this.async();
    // Write to a temp file, then move.
    fs.createReadStream('test/harness/test.js').pipe(mold.transformSourcesRelativeTo('test/harness')).pipe(fs.createWriteStream('test/harness/test_fixed.js')).on('close', function() {
      grunt.file.copy('test/harness/test_fixed.js', 'test/harness/test.js');
      grunt.file.delete('test/harness/test_fixed.js');
      done();
    });
  });

  grunt.registerTask('adjust_coverage_json', 'Removes dependency/test coverage information from the remapped Istanbul output.', function() {
    // Remove anything that isn't in the src/ dir.
    var coverageInfo = grunt.file.readJSON('coverage/coverage-combined.json'), newCoverageInfo = {};
    Object.keys(coverageInfo).filter(function (filepath) {
      return path.relative('.', filepath).slice(0, 3) === 'src' || path.relative(".", filepath).slice(0, 17) === "node_modules/bfs-";
    }).forEach(function(filePath) {
      var newPath = filePath;
      // Weird issue caused by relative source map URLs.
      if (filePath.indexOf('node_modules') !== filePath.lastIndexOf('node_modules')) {
        newPath = path.resolve(filePath.slice(filePath.lastIndexOf('node_modules')));
      }
      newCoverageInfo[newPath] = coverageInfo[filePath];
      newCoverageInfo[newPath]['path'] = newPath;
    });
    grunt.file.write('coverage/coverage-combined.json', JSON.stringify(newCoverageInfo));
  });

  var testCommon = ['tsd:browserfs', 'backends.ts', 'run.ts', 'browserify:workerfs_worker', 'shell:gen_zipfs_fixtures', 'shell:gen_listings', 'shell:load_fixtures', 'connect'];
  if (dropboxEnabled) {
    testCommon.push('shell:gen_cert', 'shell:gen_token');
  }

  // test w/ rebuilds.
  grunt.registerTask('test_continuous', testCommon.concat('karma:continuous'));
  // test
  grunt.registerTask('test', testCommon.concat('browserify:test', 'karma-sequence:test'));
  // travis-ci test config
  grunt.registerTask('test_travis', testCommon.concat('browserify:test', 'karma-sequence:test_travis'));
  // coverage
  grunt.registerTask('coverage', testCommon.concat('browserify:test', 'adjust_test_bundle', 'karma-sequence:coverage', 'remapIstanbul', 'adjust_coverage_json', 'makeReport'));
  // dev build + watch for changes.
  grunt.registerTask('watch', ['tsd:browserfs', 'backends.ts', 'browserify:watch']);
  // dev build
  grunt.registerTask('dev', ['tsd:browserfs', 'backends.ts', 'browserify:browserfs', 'exorcise', 'ts']);
  // release build (default)
  grunt.registerTask('default', ['dev', 'uglify']);
  // dist
  grunt.registerTask('dist', ['clean', 'clean_dist', 'default', 'copy:dist']);
};
