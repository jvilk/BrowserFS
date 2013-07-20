# Emulation of Node's `fs.Stats` object.
#
# Attribute descriptions are from `man 2 stat'
# @see http://nodejs.org/api/fs.html#fs_class_fs_stats
# @see http://man7.org/linux/man-pages/man2/stat.2.html
class BrowserFS.node.fs.Stats
  # item_type indicating that this is a file
  @FILE: 1
  # item_type indicating that this is a directory
  @DIRECTORY: 2
  # item_type indicating that this is a symlink
  @SYMLINK: 3
  # item_type indicating that this is a socket
  @SOCKET: 4

  # Provides information about a particular entry in the file system.
  # @param [Number] item_type type of the item (FILE, DIRECTORY, SYMLINK, or SOCKET)
  # @param [Number] size Size of the item in bytes. For directories/symlinks,
  #   this is normally the size of the struct that represents the item.
  # @param [Number] mode Unix-style file mode (e.g. 0o644)
  # @param [Date?] atime time of last access
  # @param [Date?] mtime time of last modification
  # @param [Date?] ctime time of creation
  constructor: (@item_type, @size, @mode=0o644, @atime=(new Date()), @mtime=(new Date()), @ctime=(new Date())) ->
    # number of 512B blocks allocated
    @blocks = Math.ceil(size/512)

    # UNSUPPORTED ATTRIBUTES
    # I assume no one is going to need these details, although we could fake
    # appropriate values if need be.
    # ID of device containing file
    @dev = 0
    # inode number
    @ino = 0
    # device ID (if special file)
    @rdev = 0
    # number of hard links
    @nlink = 1
    # blocksize for file system I/O
    @blksize = 4096
    # TODO: Maybe support these? atm, it's a one-user filesystem.
    # user ID of owner
    @uid = 0
    # group ID of owner
    @gid = 0

  # **Nonstandard**: Clone the stats object.
  # @return [BrowserFS.node.fs.Stats]
  clone: () ->
    new BrowserFS.node.fs.Stats @item_type, @size, @mode, @atime, @mtime, @ctime

  # @return [Boolean] True if this item is a file.
  isFile: -> @item_type == Stats.FILE
  # @return [Boolean] True if this item is a directory.
  isDirectory: -> @item_type == Stats.DIRECTORY
  # @return [Boolean] True if this item is a symbolic link (only valid through lstat)
  isSymbolicLink: -> @item_type == Stats.SYMLINK
  # @return [Boolean] True if this item is a socket
  isSocket: -> @item_type == Stats.SOCKET

  # Until a character/FIFO filesystem comes about, everything is block based.
  # @return [Boolean] True; we currently only support block devices.
  isBlockDevice: -> true
  # @return [Boolean] False; we currently only support block devices.
  isCharacterDevice: -> false
  # @return [Boolean] False; we currently only support block devices.
  isFIFO: -> false
