# Emulates Node's `path` module. This module contains utilities for handling and
# transforming file paths. **All** of these methods perform only string
# transformations. The file system is not consulted to check whether paths are
# valid.
# @see http://nodejs.org/api/path.html
class BrowserFS.node.path
  # Normalize a string path, taking care of '..' and '.' parts.
  #
  # When multiple slashes are found, they're replaced by a single one; when the path contains a trailing slash, it is preserved. On Windows backslashes are used.
  # @example Usage example
  #   path.normalize('/foo/bar//baz/asdf/quux/..')
  #   // returns
  #   '/foo/bar/baz/asdf'
  # @param [String] path The path to normalize.
  # @return [String]
  @normalize: (path) ->
    # It's very important to know if the path is relative or not, since it
    # changes how we process .. and reconstruct the split string.
    absolute = path.charAt(0) == @sep
    # Remove repeated //s
    path = @_removeDuplicateSeps path
    # Try to remove as many '../' as possible, and remove '.' completely.
    components = path.split @sep
    goodComponents = []
    for c, idx in components
      if c is '.' then continue
      else if c is '..' and (absolute or (!absolute and goodComponents.length > 0 and goodComponents[0] isnt '..'))
        # In the absolute case: Path is relative to root, so we may pop even if
        # goodComponents is empty (e.g. /../ => /)
        # In the relative case: We're getting rid of a directory that preceded
        # it (e.g. /foo/../bar -> /bar)
        goodComponents.pop()
      else
        goodComponents.push c

    # Add in '.' when it's a relative path with no other nonempty components.
    # Possible results: '.' and './' (input: [''] or [])
    if not absolute and goodComponents.length < 2
      switch goodComponents.length
        when 1
          if goodComponents[0] is '' then goodComponents.unshift '.'
        else
          goodComponents.push '.'

    path = goodComponents.join @sep
    if absolute and path.charAt(0) != @sep
      path = @sep + path
    return path

  # Join all arguments together and normalize the resulting path.
  #
  # Arguments must be strings.
  # @example Usage
  #   path.join('/foo', 'bar', 'baz/asdf', 'quux', '..')
  #   // returns
  #   '/foo/bar/baz/asdf'
  #
  #   path.join('foo', {}, 'bar')
  #   // throws exception
  #   TypeError: Arguments to path.join must be strings
  # @param [String,...] paths Each component of the path
  # @return [String]
  @join: (paths...) ->
    # Ignore any empty paths at the start and end of the array
    until paths.length is 0 or paths[0] isnt ''
      paths.shift()
    until paths.length is 0 or paths[paths.length-1] isnt ''
      paths.pop()
    return @normalize paths.join(@sep)
  # Resolves to to an absolute path.
  #
  # If to isn't already absolute from arguments are prepended in right to left
  # order, until an absolute path is found. If after using all from paths still
  # no absolute path is found, the current working directory is used as well.
  # The resulting path is normalized, and trailing slashes are removed unless
  # the path gets resolved to the root directory. Non-string arguments are
  # ignored.
  #
  # Another way to think of it is as a sequence of cd commands in a shell.
  #
  #     path.resolve('foo/bar', '/tmp/file/', '..', 'a/../subfile')
  #
  # Is similar to:
  #
  #     cd foo/bar
  #     cd /tmp/file/
  #     cd ..
  #     cd a/../subfile
  #     pwd
  #
  # The difference is that the different paths don't need to exist and may also
  # be files.
  # @example Usage example
  #   path.resolve('/foo/bar', './baz')
  #   // returns
  #   '/foo/bar/baz'
  #
  #   path.resolve('/foo/bar', '/tmp/file/')
  #   // returns
  #   '/tmp/file'
  #
  #   path.resolve('wwwroot', 'static_files/png/', '../gif/image.gif')
  #   // if currently in /home/myself/node, it returns
  #   '/home/myself/node/wwwroot/static_files/gif/image.gif'
  # @param [String,...] args
  # @return [String]
  @resolve: (args...) ->
  # Solve the relative path from from to to.
  #
  # At times we have two absolute paths, and we need to derive the relative path
  # from one to the other. This is actually the reverse transform of
  # path.resolve, which means we see that:
  #
  #    path.resolve(from, path.relative(from, to)) == path.resolve(to)
  #
  # @example Usage example
  #   path.relative('C:\\orandea\\test\\aaa', 'C:\\orandea\\impl\\bbb')
  #   // returns
  #   '..\\..\\impl\\bbb'
  #
  #   path.relative('/data/orandea/test/aaa', '/data/orandea/impl/bbb')
  #   // returns
  #   '../../impl/bbb'
  # @param [String] from
  # @param [String] to
  # @return [String]
  @relative: (from, to) ->
  # Return the directory name of a path. Similar to the Unix `dirname` command.
  #
  # Note that BrowserFS does not validate if the path is actually a valid
  # directory.
  # @example Usage example
  #   path.dirname('/foo/bar/baz/asdf/quux')
  #   // returns
  #   '/foo/bar/baz/asdf'
  # @param [String] p The path to get the directory name of.
  # @return [String]
  @dirname: (p) ->
    # We get rid of //, but we don't modify anything else (e.g. any extraneous .
    # and ../ are kept intact)
    p = @_removeDuplicateSeps p
    absolute = p.charAt(0) is @sep
    sections = p.split @sep
    # Do 1 if it's /foo/bar, 2 if it's /foo/bar/
    if sections.pop() is '' and sections.length > 0 then sections.pop()
    if sections.length > 1
      return sections.join @sep
    else if absolute then return @sep
    else return '.'
  # Return the last portion of a path. Similar to the Unix basename command.
  # @example Usage example
  #   path.basename('/foo/bar/baz/asdf/quux.html')
  #   // returns
  #   'quux.html'
  #
  #   path.basename('/foo/bar/baz/asdf/quux.html', '.html')
  #   // returns
  #   'quux'
  # @param [String] p
  # @param [String?] ext
  # @return [String]
  @basename: (p, ext="") ->
    # Special case: Normalize will modify this to '.'
    if p is '' then return p
    # Normalize the string first to remove any weirdness.
    p = @normalize p
    # Get the last part of the string.
    sections = p.split @sep
    lastPart = sections[sections.length-1]
    # Special case: If it's empty, then we have a string like so: foo/
    # Meaning, 'foo' is guaranteed to be a directory.
    if lastPart is '' and sections.length > 1 then return sections[sections.length-2]
    # Remove the extension, if need be.
    if ext.length > 0
      lastPartExt = lastPart.substr(lastPart.length-ext.length)
      if lastPartExt is ext
        return lastPart.substr(0, lastPart.length-ext.length)
    return lastPart
  # Return the extension of the path, from the last '.' to end of string in the
  # last portion of the path. If there is no '.' in the last portion of the path
  # or the first character of it is '.', then it returns an empty string.
  # @example Usage example
  #   path.extname('index.html')
  #   // returns
  #   '.html'
  #
  #   path.extname('index.')
  #   // returns
  #   '.'
  #
  #   path.extname('index')
  #   // returns
  #   ''
  # @param [String] p
  # @return [String]
  @extname: (p) ->
    p = @normalize p
    sections = p.split @sep
    p = sections.pop()
    # Special case: foo/file.ext/ should return '.ext'
    if p is '' and sections.length > 0 then p = sections.pop()
    # Special case
    return '' if p is '..'
    i = p.lastIndexOf '.'
    return '' if i is -1 or i is 0
    return p.substr i
  # The platform-specific file separator. BrowserFS uses `/`.
  # @return [String]
  @sep = '/'
  @_replaceRegex = new RegExp("//+",'g')
  @_removeDuplicateSeps: (p) ->
    p = p.replace @_replaceRegex, @sep
    return p
  # The platform-specific path delimiter. BrowserFS uses `:`.
  # @return [String]
  @delimiter = ':'
