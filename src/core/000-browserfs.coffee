# The main BrowserFS namespace. Defines global setup functions.
class BrowserFS
  # Defined here so the other files can fill it up with attributes for the node
  # API.
  @node: {}
  # Installs BrowserFS onto the given object.
  # We recommend that you run install with the 'window' object to make things
  # global, as in Node.
  #
  # Properties installed:
  #
  # * Buffer
  # * process
  # * require (we monkey-patch it)
  #
  # This allows you to write code as if you were running inside Node.
  # @param [Object] obj The object to install things onto (e.g. window)
  @install: (obj) ->
    obj.Buffer = BrowserFS.node.Buffer
    obj.process = BrowserFS.node.process
    oldRequire = if obj.require? then obj.require else null
    # Monkey-patch require for Node-style code.
    obj.require = (arg) ->
      return switch arg
        when 'fs' then BrowserFS.node.fs
        when 'path' then BrowserFS.node.path
        when 'process' then BrowserFS.node.process
        when 'buffer' then BrowserFS.node # require('buffer').Buffer
        else
          if oldRequire?
            oldRequire this, arguments
          else if arg of obj
            obj[arg]
          else
            throw new Error "Module not found: #{arg}"
  # You must call this function with a properly-instantiated root file system
  # before using any file system API method.
  # @param [BrowserFS.FileSystem] rootFS The root filesystem to use for the
  #   entire BrowserFS file system.
  @initialize: (rootfs) -> BrowserFS.node.fs._initialize rootfs
  # Debugging.
  @common:
      tmpDir: '/tmp/'
      fixturesDir: '/test/fixtures'
      # NodeJS uses 'common.error' for test messages, but this is inappropriate.
      # I map it to log, instead.
      error: (args...) -> console.log.apply(this, args)
