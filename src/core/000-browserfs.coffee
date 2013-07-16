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
    obj.require = (arg, herp) ->
      # XXX: Hackfix for Ace Editor. The Ace Editor clobbers require definitions,
      # but recalls it with an empty first argument.
      if herp? and not arg? then arg = herp
      return switch arg
        when 'fs' then BrowserFS.node.fs
        when 'path' then BrowserFS.node.path
        when 'process' then BrowserFS.node.process
        when 'buffer' then BrowserFS.node # require('buffer').Buffer
        else
          if oldRequire?
            oldRequire.apply this, arguments
          else
            throw new Error "Module not found: #{arg}"
  # You must call this function with a properly-instantiated root file system
  # before using any file system API method.
  # @param [BrowserFS.FileSystem] rootFS The root filesystem to use for the
  #   entire BrowserFS file system.
  @initialize: (rootfs) -> BrowserFS.node.fs._initialize rootfs

  # Utility functions.
  @util = {
    # Estimates the size of a JS object.
    # @param [Object] the object to measure.
    # @return [Number] estimated object size.
    # @see http://stackoverflow.com/a/11900218/10601
    roughSizeOfObject: (object) ->
      objectList = []
      stack = [object]
      bytes = 0
      until stack.length is 0
        value = stack.pop()
        if typeof value is 'boolean'
          bytes += 4
        else if typeof value is 'string'
          bytes += value.length * 2
        else if typeof value is 'number'
          bytes += 8
        else if typeof value is 'object' and value not in objectList
          objectList.push value
          bytes += 4  # for the pointer to this object
          for key, prop of value
            bytes += key.length * 2
            stack.push prop
      return bytes
  }

  @isIE = /(msie) ([\w.]+)/.exec navigator.userAgent.toLowerCase()

