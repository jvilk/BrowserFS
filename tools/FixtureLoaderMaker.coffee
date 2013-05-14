#!/usr/bin/env coffee
# FixtureLoaderMaker
# Makes a script that loads the test fixtures into the in-browser filesystem
# USING the in-browser filesystem.

path = require('path');
fs = require('fs');
fixturesPath = './test/fixtures'
outfile = null

files = []
dirs = []
count = 1
DEBUG = false

# Used to print debug messages.
debugPrint = (args...) -> if DEBUG then console.log.apply console, args

# Figure out dirs
# Emit code to create dirs.
# One by one, emit code to write files.
# Use a counting semaphore in the code to determine when to trigger tests.
# Trigger tests w/ karma start
# Make fixtures minimal!!!

emitHeader = (cb) ->
  buf = new Buffer """
  "use strict";
  var numdirs = #{dirs.length};
  var numfiles = #{files.length};
  var mcb = function(err) {
    if (err) then throw err;
    numdirs--;
    if (numdirs === 0) {
      __fixturesAddFiles();
    }
  };
  var fcb = function(err) {
    if (err) then throw err;
    numfiles--;
    if (numfiles === 0) {
      __karma__.start(true);
    }
  };

  """
  debugPrint "Writing header..."
  fs.write outfile, buf, 0, buf.length, null, (err) ->
    debugPrint "Header written"
    if err then throw err
    cb()

emitMkdir = (path, cb) ->
  debugPrint "Writing mkdir for #{path}..."
  buf = new Buffer """
  fs.mkdir("#{path}", mcb);
  """
  fs.write outfile, buf, 0, buf.length, null, cb

emitFileHeader = (cb) ->
  debugPrint "Writing file header..."
  buf = new Buffer """
  var __fixturesAddFiles = function() {

  """
  fs.write outfile, buf, 0, buf.length, null, cb
emitFile = (path, data, cb) ->
  debugPrint "Writing file data for #{path}..."
  buf = new Buffer """
  fs.writeFile("#{path}", "#{data.toString('base64')}", "base64", fcb);

  """
  fs.write outfile, buf, 0, buf.length, null, cb
emitFileFooter = (cb) ->
  debugPrint "Writing file footer..."
  buf = new Buffer """
  };

  """
  fs.write outfile, buf, 0, buf.length, null, cb

handleFile = (file, cb) ->
  fs.readFile file, (err, data) ->
    if err then throw err
    emitFile file, data, cb
emitAllFiles = (cb) ->
  len = files.length
  i = -1
  emitCb = ->
    i++
    if i is len then cb()
    else
      handleFile files[i], emitCb
  emitCb()
  return
emitAllMkdirs = (cb) ->
  len = dirs.length
  i = -1
  emitCb = ->
    i++
    if i is len then cb()
    else
      emitMkdir dirs[i], emitCb
  emitCb()
  return

emitFooter = ->
  debugPrint 'Writing footer...'
  buf = new Buffer """

  """
  fs.write outfile, buf, 0, buf.length, null, (err) ->
    if err then throw err
    fs.close outfile

decrCount = ->
  count--
  if count is 0
    emitHeader -> emitFileHeader -> emitAllFiles -> emitFileFooter -> emitAllMkdirs -> emitFooter()

_processReaddir = (path) ->
  fs.stat path, (err, stats) ->
    if err then throw err
    processStat path, stats
processReaddir = (p, files) ->
  debugPrint "Processing directory #{p}..."
  for file in files
    file_p = path.join(p, file)
    count++
    _processReaddir file_p
  decrCount()

processStat = (p, stat) ->
  if stat.isFile()
    files.push p
  else
    count++
    dirs.push p
    fs.readdir p, (err, files) ->
      if err then throw err
      processReaddir p, files
  decrCount()

# Kick everything off.
debugPrint 'Opening load_fixtures.js...'
fs.open './lib/load_fixtures.js', 'w', (err, fd) ->
  debugPrint 'load_fixtures.js opened!'
  if err then throw err
  outfile = fd
  dirs.push fixturesPath
  fs.readdir(fixturesPath, (err, files) ->
    if err then throw err
    processReaddir fixturesPath, files
  )
