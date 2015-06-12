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
  { pattern: 'bower_components/DefinitelyTyped/**/*.d.ts', included: false },
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
        frameworks: ['jasmine', 'browserify'],
        files: karmaFiles,
        preprocessors: {
          'test/harness/run.ts': ['browserify']
        },
        browserify: {
          bare: true,
          debug: true,
          transform: [
            'aliasify'
          ],
          plugin: [
            'tsify'
          ]
        },
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
        module: 'commonjs',
        comments: true,
        declaration: true
      },
      dev: {
        src: ["src/**/*.ts"],
        outDir: path.join('build', 'dev')
      },
      watch: {
        // Performs a dev build and rebuilds when changes are made.
        src: ["src/**/*.ts"],
        outDir: path.join('build', 'dev'),
        watch: 'src'
      }
    },
    browserify: {
      all: {
        options: {
          browserifyOptions: {
            // The output of the TypeScript compiler goes into this directory.
            basedir: path.join('build', 'dev'),
            // Expose what's exported in main.js under the name BrowserFS,
            // wrapped as an UMD module.
            standalone: 'BrowserFS',
            // Don't include all built-ins
            bare: true,
            // Generate source map.
            debug: true,
            // derequire the generated script so that the script won't chock if it is further processed.
            plugin: [
              ['browserify-derequire']
            ],
            transform: ['aliasify']
            // Noted that browserify-shim settings is in package.json.
          }
        },
        files: {
          './build/release/browserfs.js': ['./core/polyfills.js'].concat(getEssentialModules())
        }
      }
    },
    uglify: {
      min: {
        options: {
          sourceMap: true,
          sourceMapIncludeSources: true,
          sourceMapIn: './build/release/browserfs.js.map'
        },
        files: {
          './build/release/browserfs.min.js': './build/release/browserfs.js'
        }
      }
    },
    exorcise: {
      all: {
        options: {
          strict: true
        },
        files: {
          './build/release/browserfs.js.map': './build/release/browserfs.js'
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
  grunt.loadNpmTasks('grunt-browserify');
  grunt.loadNpmTasks('grunt-contrib-uglify');
  grunt.loadNpmTasks('grunt-exorcise');
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

  grunt.registerTask('main.js', 'Construct main.js to include all backends and polyfills', function() {
    var modules = getEssentialModules(),
      bfsModule = modules.shift(),
      main = [], i;

    main.push(fs.readFileSync('build/dev/core/polyfills.js'));
    main.push("module.exports=require('./" + bfsModule + "');");
    for (i = 0; i < modules.length; i++) {
      main.push("require('./" + modules[i] + "');");
    }

    fs.writeFileSync('build/dev/main.js', main.join('\n'));
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
      fs.readFileSync('test/harness/run_template.ts')
        .toString()
        .replace(/\/\*FACTORIES\*\//g, factoryStringified)
        .replace(/\/\*TESTS\*\//g, testsStringified), 'utf8'
    );
  });

  // test
  grunt.registerTask('test', ['run.ts', 'shell:gen_zipfs_fixtures', 'shell:gen_listings', 'shell:load_fixtures', 'connect', 'karma:test']);
  // testing dropbox
  grunt.registerTask('dropbox_test', ['ts:test', 'shell:gen_zipfs_fixtures', 'shell:gen_listings', 'shell:load_fixtures', 'shell:gen_cert', 'shell:gen_token', 'connect', 'karma:dropbox_test']);
  // dev build
  grunt.registerTask('dev', ['ts:dev']);
  // dev build + watch for changes.
  grunt.registerTask('watch', ['ts:watch']);
  // release build (default)
  grunt.registerTask('default', ['ts:dev', 'main.js', 'browserify', 'exorcise', 'uglify']);
  // testling
  grunt.registerTask('testling', ['default', 'shell:gen_listings', 'shell:gen_zipfs_fixtures', 'shell:load_fixtures']);
};
