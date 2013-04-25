# Provides access to chdir / pwd functionality.
startTime = Date.now()
BrowserFS.node.process =
  _cwd: '/'
  # No way to error check synchronously.
  chdir: (dir) -> _cwd = dir
  cwd: -> @_cwd
  platform: -> 'browser'
  uptime: -> ((Date.now() - startTime)/1000)|0
