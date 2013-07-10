# The MountableFileSystem allows you to mount multiple backend types or
# multiple instantiations of the same backend into a single file system tree.
# The file systems do not need to know about each other; all interactions are
# automatically facilitated through this interface.
#
# For example, if a file system is mounted at /mnt/blah, and a request came in
# for /mnt/blah/foo.txt, the file system would see a request for /foo.txt.
class BrowserFS.FileSystem.MountableFileSystem extends BrowserFS.FileSystem
  constructor: -> @mntMap = {}

  # Mounts the file system at the given mount point.
  mount: (mnt_pt, fs) ->
    if @mntMap[mnt_pt]
      throw new BrowserFS.ApiError BrowserFS.ApiError.INVALID_PARAM, "Mount point #{mnt_pt} is already taken."
    # TODO: Ensure new mount path is not subsumed by active mount paths.
    @mntMap[mnt_pt] = fs
  umount: (mnt_pt) ->
    unless @mntMap[mnt_pt]
      throw new BrowserFS.ApiError BrowserFS.ApiError.INVALID_PARAM, "Mount point #{mnt_pt} is already unmounted."
    delete @mntMap[mnt_pt]

  # Returns the file system that the path points to.
  # Throws an exception if the path is invalid and async is false, otherwise
  # it returns a new instance of the exception.
  _get_fs: (path, async=true, name='') ->
    # TODO: Optimize. :)
    for mnt_pt,fs of @mntMap
      if path.indexOf(mnt_pt) is 0
        return fs
    e = new BrowserFS.ApiError BrowserFS.ApiError.INVALID_PARAM, "#{name} failed: #{path} doesn't exist."
    if async then return e else throw e

  # Global information methods

  getName: -> 'MountableFileSystem'
  @isAvailable: -> true
  diskSpace: (path, cb) -> cb 0, 0
  isReadOnly: -> false
  supportsLinks: -> false # I'm not ready for cross-FS links yet.
  supportsProps: -> false
  supportsSynch: -> true

  # Tricky: Define all of the functions that merely forward arguments to the
  # relevant file system, or return/throw an error.
  # Take advantage of the fact that the *first* argument is always the path, and
  # the *last* is the callback function (if async).
  defineFcn = (name, isSync, numArgs) ->
    return (args...) ->
      relevantFs = this._get_fs args[0], !isSync, name
      if relevantFs instanceof BrowserFS.ApiError then return args[numArgs](relevantFs)
      return relevantFs[name].apply relevantFs, args
  fsCmdMap = [
    # 1 argument functions
    ['readdir', 'exists', 'unlink', 'rmdir', 'readlink'],
    # 2 argument functions
    ['stat', 'mkdir', 'realpath', 'truncate'],
    # 3 argument functions
    ['open', 'readFile', 'chmod', 'utimes'],
    # 4 argument functions
    ['chown'],
    # 5 argument functions
    ['writeFile', 'appendFile']
  ]
  for i in [0...fsCmdMap.length] by 1
    cmds = fsCmdMap[i]
    for j in [0...cmds.length] by 1
      fnName = cmds[j]
      MountableFileSystem.prototype[fnName] = defineFcn fnName, false, i+1
      MountableFileSystem.prototype[fnName+'Sync'] = defineFcn fnName+'Sync', true, i+1

  # The following methods involve multiple file systems, and thus have custom
  # logic.
  # Note that we go through the Node API to use its robust default argument
  # processing.

  rename: (oldPath, newPath, cb) ->
    # Scenario 1: old and new are on same FS.
    fs1 = @_get_fs oldPath
    fs2 = @_get_fs newPath
    if fs1 instanceof BrowserFS.ApiError then return cb fs1
    if fs1 is fs2
      return fs1.rename oldPath, newPath, cb

    # Scenario 2: Different file systems.
    # Read old file, write new file, delete old file.
    BrowserFS.node.fs.readFile oldPath, (err, data) ->
      if err then return cb err
      BrowserFS.node.fs.writeFile newPath, data, (err) ->
        if err then return cb err
        BrowserFS.node.fs.unlink oldPath, cb
  renameSync: (oldPath, newPath) ->
    # Scenario 1: old and new are on same FS.
    fs1 = @_get_fs oldPath
    fs2 = @_get_fs newPath
    if fs1 instanceof BrowserFS.ApiError then throw fs1
    if fs1 is fs2
      return fs1.renameSync oldPath, newPath

    # Scenario 2: Different file systems.
    data = BrowserFS.node.fs.readFileSync oldPath
    BrowserFS.node.fs.writeFileSync newPath, data
    return BrowserFS.node.fs.unlinkSync oldPath
