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
  # @param [String] p The path to normalize.
  # @return [String]
  @normalize: (p) -> return
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
  # @example Usage example
  #   path.dirname('/foo/bar/baz/asdf/quux')
  #   // returns
  #   '/foo/bar/baz/asdf'
  # @param [String] p The path to get the directory name of.
  # @return [String]
  @dirname: (p) -> return
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
  # Return the extension of the path, from the last '.' to end of string in the last portion of the path. If there is no '.' in the last portion of the path or the first character of it is '.', then it returns an empty string. Examples:
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
  @extname: (p) -> return
  # The platform-specific file separator. BrowserFS uses `/`.
  # @return [String]
  @sep = '/'
  # The platform-specific path delimiter. BrowserFS uses `:`.
  # @return [String]
  @delimiter = ':'
