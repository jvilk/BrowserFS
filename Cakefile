# Inspired by Dropbox-js's Cakefile
fs = require 'fs'
glob = require 'glob'
path = require 'path'
async = require 'async'
{spawn, exec} = require 'child_process'

task 'build', ->
  build()

# TODO: Tests should *only* use the BrowserFS functionality so you can use them
#       in Node.

#SOON.
#task 'test', ->
#  vendor ->
#    build ->
#      ssl_cert ->
#        tokens ->
#          test_cases = glob.sync 'test/js/**/*_test.js'
#          test_cases.sort()  # Consistent test case order.
#          run 'node_modules/.bin/mocha --colors --slow 200 --timeout 20000 ' +
#              "--require test/js/helpers/setup.js #{test_cases.join(' ')}"

#task 'webtest', ->
#  vendor ->
#    build ->
#      ssl_cert ->
#        tokens ->
#          webtest()

#SOON.
#task 'doc', ->
#  run 'node_modules/.bin/codo src'

# Needed capabilities:
# * Take in all coffee files sorted somehow.
# * Compile individually.
# * Compile together.
# * Minify.
# * Link up CoffeeScript sourcemap to Uglify sourcemap.
# * Any way to link up vendor code into this without messing up the sourcemap?
#   Passing into UglifyJS with no optimizations to create the final file?

build = (callback) ->
  commands = []

  # TODO: WebWorker build!
  source_files = glob.sync 'src/both/*.coffee'
  source_files = source_files.concat 'src/main/*.coffee'
  source_files.sort (a, b) -> a.localeCompare b
  vendor_files = glob.sync 'vendor/*.js'
  for i in [0...vendor_files.length]
    vendor_files[i] = '../'+vendor_files[i]

  # Compile without --join for decent error messages.
  commands.push 'node node_modules/coffee-script/bin/coffee --output tmp ' +
                '--compile ' + source_files.join(' ')
  commands.push 'node node_modules/coffee-script/bin/coffee --output lib ' +
                "--compile --join browserfs.js #{source_files.join(' ')}"
  commands.push 'cd lib && node ../node_modules/uglify-js/bin/uglifyjs ' +
      "-b --output browserfs.js #{vendor_files.join(' ')} browserfs.js"
  # Minify the javascript, for browser distribution.
  # TODO: Mangle.
  commands.push 'cd lib && node ../node_modules/uglify-js/bin/uglifyjs ' +
      '--compress unused=false --output browserfs.min.js ' +
      "--source-map browserfs.min.map #{vendor_files.join(' ')} browserfs.js"

  # Tests are supposed to be independent, so the build order doesn't matter.
  #test_dirs = glob.sync 'test/src/**/'
  #for test_dir in test_dirs
  #  out_dir = test_dir.replace(/^test\/src\//, 'test/js/')
  #  test_files = glob.sync path.join(test_dir, '*.coffee')
  #  commands.push "node node_modules/coffee-script/bin/coffee " +
  #                "--output #{out_dir} --compile #{test_files.join(' ')}"
  async.forEachSeries commands, run, ->
    callback() if callback

run = (command, callback) ->
  if /^win/i.test(process.platform) # Awful windows hacks.
    command = command.replace(/\//g, '\\')
    cmd = spawn 'cmd', ['/C', command]
  else
    cmd = spawn '/bin/sh', ['-c', command]
  cmd.stdout.on 'data', (data) -> process.stdout.write data
  cmd.stderr.on 'data', (data) -> process.stderr.write data
  cmd.on 'error', ->
    console.log "Non-zero exit code running\n #{command}"
    process.exit 1
  process.on 'SIGHUP', -> cmd.kill()
  cmd.on 'exit', (code) -> callback() if callback? and code is 0
