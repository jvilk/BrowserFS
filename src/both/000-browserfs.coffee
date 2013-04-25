# Used for the BrowserFS namespace.
BrowserFS = {
  # Other files fill this up with attributes
  node: {}
  # Installs BrowserFS onto the given object. Use 'window' for node emulation.
  # Properties installed:
  # * Buffer
  # * process
  # * require (we monkey-patch it)
  Install: (obj) ->
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
        else oldRequire this, arguments if oldRequire?
  Initialize: () -> # TODO: Complete
}
