startTime = Date.now()
# Partial implementation of Node's `process` module.
# We implement the portions that are relevant for the filesystem.
# @see http://nodejs.org/api/process.html
class BrowserFS.node.process
  @_cwd: '/'
  # Changes the current working directory.
  #
  # **Note**: BrowserFS does not validate that the directory actually exists.
  #
  # @example Usage example
  #   console.log('Starting directory: ' + process.cwd());
  #   process.chdir('/tmp');
  #   console.log('New directory: ' + process.cwd());
  # @param [String] dir The directory to change to.
  @chdir: (dir) -> _cwd = dir
  # Returns the current working directory.
  # @example Usage example
  #   console.log('Current directory: ' + process.cwd());
  # @return [String] The current working directory.
  @cwd: -> @_cwd
  # Returns what platform you are running on.
  # @return [String]
  @platform: -> 'browser'
  # Number of seconds BrowserFS has been running.
  # @return [Number]
  @uptime: -> ((Date.now() - startTime)/1000)|0
