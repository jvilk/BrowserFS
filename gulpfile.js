/**
 * Grunt build file for Doppio.
 * Bootstraps ourselves from JavaScript into TypeScript.
 */
var fs = require('fs'),
  child_process = require('child_process'),
  path = require('path'),
  ts_path = path.resolve('node_modules', '.bin', 'tsc' + (process.platform === 'win32' ? '.cmd' : '')),
  result;

/**
 * For a given TypeScript file, checks if we should recompile it based on
 * modification time.
 */
function shouldRecompile(file) {
  var jsFile = file.slice(0, file.length - 2) + 'js';
  // Recompile if a JS version doesn't exist, OR if the TS version has a
  // greater modification time.
  return !fs.existsSync(jsFile) || fs.statSync(file).mtime > fs.statSync(jsFile).mtime;
}

if (shouldRecompile(path.resolve('gulptasks.ts'))) {
  console.log('Recompiling gulptasks.ts...');
  result = child_process.spawnSync(ts_path, ['--noImplicitAny', '--module', 'commonjs', 'gulptasks.ts']);
  if (result.status !== 0) {
    throw new Error('Compilation error: ' + result.stdout + '\n' + result.stderr);
  }
}

require('./gulptasks');
