/// <reference path="typings/index.d.ts" />
import * as gulp from 'gulp';
import * as webpack from 'webpack';
import * as path from 'path';
import * as fs from 'fs';
import * as ts from 'gulp-typescript';
import * as async from 'async';
import * as rename from 'gulp-rename';
import * as uglify from 'gulp-uglify';
import * as gutil from 'gulp-util';
import * as minimist from 'minimist';
import * as sourcemaps from 'gulp-sourcemaps';
import * as merge from 'merge2';
import {Server as KarmaServer} from 'karma';
import {execSync} from 'child_process';
declare global {
  interface Function {
    description: string;
    flags: {[flag: string]: string};
  }
}

const rollup = require('gulp-rollup'),
  alias = require('rollup-plugin-alias'),
  buble = require('rollup-plugin-buble'),
  inject = require('rollup-plugin-inject'),
  connect = require('gulp-connect'),
  remapIstanbul = require('remap-istanbul/lib/gulpRemapIstanbul'),
  installedBrowsers = (<{name: string}[]> require('detect-browsers').getInstalledBrowsers())
    .map((item) => item.name)
    // Remove duplicates, and items with a space in them.
    .filter((name, index, arr) => arr.indexOf(name) === index && arr.indexOf(' ') === -1),
  args = minimist(process.argv.slice(2)),
  coffeeScriptPath = path.resolve('node_modules', '.bin', 'coffee');

/**
 * Generates a karma configuration file.
 */
function getKarmaConfig(dropbox: boolean, continuous: boolean, browsers: string[], coverage = false): any {
  let karmaFiles = [
    // Main module and fixtures loader
    'test/harness/test.js',
    // WebWorker script.
    { pattern: 'test/harness/factories/workerfs_worker.js', included: false, watched: true },
    /* Modules */
    // Tests
    { pattern: 'test/tests/**/*.js', included: false, watched: false },
    // BFS modules
    { pattern: 'test/**/*.ts*', included: false, watched: false },
    // SourceMap support
    { pattern: 'src/**/*.ts*', included: false, watched: false },
    { pattern: 'typings/**/*.d.ts', included: false },
    { pattern: 'node_modules/pako/dist/*.js*', included: false }
  ];
  // The presence of the Dropbox library dynamically toggles the tests.
  if (dropbox) {
    karmaFiles.unshift('node_modules/dropbox/lib/dropbox.js');
  }
  let rv = {
    frameworks: ['mocha'],
    files: karmaFiles,
    exclude: <string[]> [],
    reporters: ['progress'],
    port: 9876,
    colors: true,
    logLevel: 'INFO',
    autoWatch: true,
    concurrency: 1,
    browsers: browsers,
    captureTimeout: 60000,
    // Avoid hardcoding and cross-origin issues.
    proxies: {
      '/': 'http://localhost:8000/'
    },
    singleRun: !continuous,
    urlRoot: '/karma/',
    // Dropbox tests are slow.
    browserNoActivityTimeout: 30000,
    browserDisconnectTimeout: 10000,
    browserDisconnectTolerance: 3,
    preprocessors: <{[k: string]: string[]}> {},
    coverageReporter: <any> undefined,
    client: {
      mocha: {
        // Stop tests after first failure.
        // Our tests have some global state (e.g. # of pending callbacks). Once those get messed up by a failing test,
        // subsequent tests are likely to fail.
        bail: true
      }
    }
  };
  if (coverage) {
    rv.reporters.push('coverage');
    rv.preprocessors = {
      './test/harness/**/*.js': ['coverage']
    };
    rv.coverageReporter = { type: 'json', dir: 'coverage/' };
  }
  return rv;
}

/**
 * Sets up webpack;
 */
function getWebpack(release: boolean, test: boolean, entries: {[name: string]: string}): webpack.compiler.Compiler {
  fs.writeFileSync('./build/temp/BFSBuffer.js', 'module.exports = require(\'buffer\').Buffer;\n');
  let config: webpack.Configuration = {
    devtool: 'source-map',
    entry: entries,
    output: test ? {
      path: __dirname,
      filename: '[name].js'
    } : {
      path: __dirname,
      filename: '[name].js',
      libraryTarget: 'umd',
      library: 'BrowserFS'
    },
    resolve: {
      extensions: ['', '.js', '.json'],
      // Use our versions of Node modules.
      alias: {
        'buffer': path.resolve(__dirname, 'node_modules', 'buffer', 'index.js'),
        'path': require.resolve('bfs-path'),
        'process': require.resolve('bfs-process'),
        'BFSBuffer': require.resolve('./build/temp/BFSBuffer.js')
      }
    },
    plugins: [
      new webpack.ProvidePlugin({ process: 'process', Buffer: 'BFSBuffer' }),
      new webpack.DefinePlugin({ RELEASE: release })
    ],
    node: {
      process: false,
      Buffer: false,
      setImmediate: false
    },
    target: 'web',
    module: {
      // Load source maps for any relevant files.
      preLoaders: [
        {
          test: /\.js$/,
          loader: 'source-map-loader'
        }
      ]
    }
  };
  if (test) {
    // Hack to fix relative paths in test bundle.
    config.plugins.push(new webpack.NormalModuleReplacementPlugin(/tests\/emscripten/, <any> function(requireReq: {request: string}) {
      // Ignore source-map-loader requests.
      const req = requireReq.request;
      if (req.indexOf('!') === -1) {
        requireReq.request = path.resolve('test', 'tests', 'emscripten', path.basename(req));
      }
    }));
  }
  return webpack(config);
}

/**
 * Generic config for rollup.
 */
function getRollupConfig(entries: string[]): any {
  // Use aliases to control what Rollup pulls in from
  // node_modules
  const aliases: {[p: string]: string | string[]} = {
    resolve: ['.js'],
    async: require.resolve('async-es'),
    'lodash-es': path.dirname(require.resolve('lodash-es'))
  };
  return {
    entry: entries,
    // Required to pull in async-es
    allowRealFiles: true,
    format: 'cjs',
    exports: 'named',
    useStrict: true,
    plugins: [
      alias(aliases),
      buble()
    ]
  };
}

// Hack: Check if git fixed one of our fixture objects to have a different
// line ending.
try {
  let filePath = path.resolve('test', 'fixtures', 'files', 'node', 'x.txt');
  if (fs.readFileSync(filePath).toString() !== 'xyz\n') {
    fs.writeFileSync(filePath, new Buffer('xyz\n'));
  }
} catch (e) {
  // Ignore.
}

const tsProject = ts.createProject('tsconfig.json');
function compileTypeScript(): NodeJS.ReadWriteStream {
  generateBackends();
  return tsProject.src()
    .pipe(sourcemaps.init())
    .pipe(ts(tsProject))
    .js;
}

function rollupBundle(entries: string[]): NodeJS.ReadWriteStream {
  return compileTypeScript()
    .pipe(rollup(getRollupConfig(entries)));
}

function runCommand(command: string, ignoreFailure?: boolean, outputFile?: string): void {
  try {
    const result = execSync(command);
    if (outputFile) {
      fs.writeFileSync(outputFile, result);
    }
  } catch (e) {
    if (!ignoreFailure) {
      throw e;
    }
  }
}

function needSafariCleanup(browsers: string[]): boolean {
  let safariCleanupNeeded = false;
  if (Array.isArray(browsers) && browsers.filter((b) => b.toLowerCase() === 'safari').length > 0) {
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
    execSync('defaults write com.apple.Safari ApplePersistenceIgnoreState YES');
  }
  return safariCleanupNeeded;
}

function safariCleanup() {
  execSync('defaults write com.apple.Safari ApplePersistenceIgnoreState NO');
}

function generateFixtures() {
  runCommand(`${coffeeScriptPath} ${path.resolve('tools', 'ZipFixtureMaker.coffee')}`);
  if (!fs.existsSync('test/fixtures/xhrfs')) {
    fs.mkdirSync('test/fixtures/xhrfs');
  }
  runCommand(`${coffeeScriptPath} ${path.resolve('tools', 'FixtureLoaderMaker.coffee')}`);
  runCommand(`${coffeeScriptPath} ${path.resolve('tools', 'XHRIndexer.coffee')}`, false, 'test/fixtures/xhrfs/listings.json');
}

function generateDropboxCerts() {
  runCommand([
    // Short circuit if the certificate exists.
    'test ! -e test/fixtures/dropbox/cert.pem',
    'mkdir -p test/fixtures/dropbox',
    'openssl req -new -x509 -days 365 -nodes -batch -out test/fixtures/dropbox/cert.pem -keyout test/fixtures/dropbox/cert.pem -subj /O=dropbox.js/OU=Testing/CN=localhost'
  ].join(' && '), true);
  runCommand(`${coffeeScriptPath} ${path.resolve('tools', 'get_db_credentials.coffee')}`);
}

function generateBackends() {
  const backendFile = fs.openSync('src/core/backends.ts', 'w');
  const backends = fs.readdirSync('src/backend')
    .filter((p) => path.extname(p) === '.ts')
    .map((p) => p.slice(0, -3));

  backends.forEach((backend) => {
    fs.writeSync(backendFile, `import ${backend} from '../backend/${backend}';\n`);
  });
  fs.writeSync(backendFile, `const Backends = { ${backends.join(', ')} };\nexport default Backends;\n`);
  fs.closeSync(backendFile);
}

function generateRunFile() {
  let tests = '', importsStringified: string, testImports: string[] = [];
  function processDir(dir: string) {
    fs.readdirSync(dir).forEach(function(file) {
      let filePath = path.resolve(dir, file),
        relPath = path.relative(path.resolve('test/harness'), filePath);
      if (fs.statSync(filePath).isFile()) {
        let name = path.basename(relPath).replace(/-/g, '_');
        name = name.slice(0, name.length - 3);
        switch (path.extname(file)) {
        case '.ts':
          let modPath = relPath.slice(0, relPath.length - 3);
          testImports.push('import ' + name + ' from \'' + modPath + '\';');
          tests += '\'' + file + '\':' + name + ',';
          break;
        case '.js':
          let jsModPath = relPath.slice(0, relPath.length - 3);
          testImports.push('const ' + name + ' = require(\'' + jsModPath + '\');');
          tests += '\'' + file + '\':' + name + ',';
          break;
        default:
          break;
        }
      } else {
        tests += '\'' + file + '\':{';
        processDir(filePath);
        tests += '},';
      }
    });
    // Remove trailing ','.
    tests = tests.slice(0, tests.length - 1);
  }
  processDir('test/tests');
  const factoryList: string[] = [];
  importsStringified = fs.readdirSync('test/harness/factories')
    .filter(function(file) {
      return file.slice(file.length-11) === '_factory.ts';
    })
    .map(function(file) {
      var name = file.slice(0, file.length - 11);
      factoryList.push(name);
      return 'import ' + name + ' from \'./factories/' + file.slice(0, file.length - 3) + '\';';
    }).concat(testImports).join('\n');

  fs.writeFileSync('test/harness/run.ts',
    fs.readFileSync('test/harness/run.tstemplate')
      .toString()
      .replace(/\/\*IMPORTS\*\//g, importsStringified)
      .replace(/\/\*FACTORIES\*\//g, factoryList.join(', '))
      .replace(/\/\*TESTS\*\//g, tests), 'utf8');
}

function rollupTest(watch: boolean) {
  let running = false;
  let runAgain = false;
  function runRollup() {
    function done() {
      running = false;
      if (runAgain) {
        runAgain = false;
        runRollup();
      }
    }
    if (running) {
      runAgain = true;
      return;
    }
    running = true;
    return rollupBundle(['./test/harness/factories/workerfs_worker', './test/harness/run'])
      .pipe(sourcemaps.write())
      .pipe(rename((path) => {
        path.dirname = '.'
        if (path.basename === 'run') {
          path.basename = 'test';
        }
        path.basename += '.rollup'
      }))
      .pipe(gulp.dest('./build/temp'))
      .on('end', done)
      .on('error', done);
  }
  return (cb: (e?: Error) => void) => {
    function wrappedCb(e?: Error) {
      if (watch) {
        gulp.watch(['src/**/*.ts', 'test/harness/**/*.ts', 'test/tests/**/*.ts'], runRollup)
          .on('change', () => gutil.log('File changed. Triggering rebuild...'));
      }
      cb(e);
    }
    generateRunFile();
    generateFixtures();
    runRollup()
      .on('end', wrappedCb)
      .on('error', wrappedCb);
  };
}

function webpackTest(watch: boolean) {
  return (cb: (e?: Error) => void) => {
    const webpack = getWebpack(false, true, {
      './test/harness/test': './build/temp/test.rollup.js',
      './test/harness/factories/workerfs_worker': './build/temp/workerfs_worker.rollup.js'
    });
    if (watch) {
      let firstRun = true;
      webpack.watch({}, (e: Error) => {
        if (firstRun) {
          firstRun = false;
          cb(e);
        } else {
          gutil.log('Rebuild complete.');
        }
      });
    } else {
      webpack.run(cb);
    }
  };
}

function remapCoverage(cb: (e?: Error) => void) {
  return gulp.src('coverage/**/coverage-final.json')
    .pipe(remapIstanbul())
    .pipe(gulp.dest('coverage/coverage-combined.json'))
    .on('end', cb)
    .on('error', cb);
}

function test(cb: (e?: any) => void) {
  const watch = args['watch'] === true;
  const dropbox = args['dropbox'] === true;
  const coverage = args['coverage'] === true;
  let browsers: string[] = args['browser'] ? [args['browser']] : installedBrowsers;
  const cleanupSafari = needSafariCleanup(browsers);
  if (watch && browsers.length > 1) {
    // 'watch' only works with one browser.
    browsers = [browsers.indexOf('Chrome') !== -1 ? 'Chrome' : browsers[0]];
  }
  connect.server({
    port: 8000
  });
  if (dropbox) {
    generateDropboxCerts();
  }
  async.series([
    rollupTest(watch),
    webpackTest(watch),
    (cb) => {
      new KarmaServer(getKarmaConfig(dropbox, watch, browsers, coverage), (exitCode: number) => {
        if (cleanupSafari) {
          safariCleanup();
        }
        connect.serverClose();
        if (coverage) {
          remapCoverage(cb);
        } else {
          cb();
        }
      }).start();
    }
  ], cb);
}
test.description = "Runs unit tests in all installed web browsers.";
test.flags = {
  '--watch': 'Automatically re-runs tests when source files change.',
  '--dropbox': 'Run dropbox tests, too.',
  '--browser=': 'Manually specify browser to test in.',
  '--coverage': 'Generate test coverage.'
}
gulp.task('test', test);

function rollupRelease(watch: boolean) {
  function runRollup() {
    return rollupBundle(['./src/browserify_main'])
      .pipe(rename('browserfs.rollup.js'))
      .pipe(sourcemaps.write('.'))
      .pipe(gulp.dest('./build/temp'));
  }
  return (cb: (e?: Error) => void) => {
    function wrappedCb(e?: Error) {
      if (watch) {
        gulp.watch('src/**/*.ts', runRollup)
          .on('all', () => gutil.log('File changed. Triggering rebuild..'));
      }
      cb(e);
    }
    runRollup()
      .on('end', wrappedCb)
      .on('error', wrappedCb);
  };
}

function webpackRelease(watch: boolean) {
  return (cb: (e?: Error) => void) => {
    const webpack = getWebpack(true, false, {
      './build/browserfs': './build/temp/browserfs.rollup'
    });
    if (!watch) {
      webpack.run(cb);
    } else {
      let firstFinished = false;
      webpack.watch({}, (e?: Error) => {
        if (!firstFinished) {
          // Only call the callback once -- when a build first finishes.
          firstFinished = true;
          cb(e);
        } else {
          gutil.log('Rebuild complete.');
        }
      });
    }
  };
}

function uglifyRelease(watch: boolean) {
  function runUglify() {
    return gulp.src('./build/browserfs.js')
      .pipe(sourcemaps.init({ loadMaps: true }))
      .pipe(uglify())
      .pipe(rename('browserfs.min.js'))
      .pipe(sourcemaps.write('.'))
      .pipe(gulp.dest('build'));
  }
  return (cb: (e?: Error) => void) => {
    function wrappedCb(e?: Error) {
      if (watch) {
        gulp.watch('./build/browserfs.js', runUglify);
      }
      cb(e);
    }
    runUglify()
      .on('end', wrappedCb)
      .on('error', wrappedCb);
  };
}

function release(cb: (e?: Error) => void): void {
  const watch = args['watch'] === true;
  async.series([rollupRelease(watch), webpackRelease(watch), uglifyRelease(watch)], cb);
}
release.description = 'Performs a release build of BrowserFS.';
release.flags = {
  '--watch': 'Auto-rebuilds when files change.'
}
gulp.task('release', release);
function compileTypeScriptNode(): NodeJS.ReadWriteStream {
  const tsconfig = JSON.parse(fs.readFileSync(path.join(__dirname, 'tsconfig.json')).toString());
  const opts = tsconfig.compilerOptions;
  opts.target = 'es3';
  opts.module = 'commonjs';
  generateBackends();
  const result = gulp.src(['src/**/*.ts', 'typings/**/*.d.ts'])
    .pipe(sourcemaps.init())
    .pipe(ts(
      opts
    ));
  return merge([
    result.js.pipe(sourcemaps.write('.')),
    result.dts
  ]).pipe(gulp.dest('build/node'));
}
gulp.task('dist', ['release'], function(cb: (e?: Error) => void) {
  compileTypeScriptNode()
    .on('end', () => {
      merge(
        gulp.src('build/*.js*').pipe(gulp.dest('dist')),
        gulp.src('build/node/**/*').pipe(gulp.dest('dist/node')))
          .on('end', cb)
          .on('error', cb);
    })
    .on('error', cb);
});
gulp.task('default', ['release']);