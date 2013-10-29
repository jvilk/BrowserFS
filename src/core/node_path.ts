import node_process = require('./node_process');
var process = node_process.process;

/**
 * Emulates Node's `path` module. This module contains utilities for handling and
 * transforming file paths. **All** of these methods perform only string
 * transformations. The file system is not consulted to check whether paths are
 * valid.
 * @see http://nodejs.org/api/path.html
 * @class
 */
export class path {
  /**
   * Normalize a string path, taking care of '..' and '.' parts.
   *
   * When multiple slashes are found, they're replaced by a single one; when the path contains a trailing slash, it is preserved. On Windows backslashes are used.
   * @example Usage example
   *   path.normalize('/foo/bar//baz/asdf/quux/..')
   *   // returns
   *   '/foo/bar/baz/asdf'
   * @param [String] p The path to normalize.
   * @return [String]
   */
  public static normalize(p: string): string {
    // Special case: '' -> '.'
    if (p === '') {
      p = '.';
    }
    // It's very important to know if the path is relative or not, since it
    // changes how we process .. and reconstruct the split string.
    var absolute = p.charAt(0) === path.sep;
    // Remove repeated //s
    p = path._removeDuplicateSeps(p);
    // Try to remove as many '../' as possible, and remove '.' completely.
    var components = p.split(path.sep);
    var goodComponents = [];
    for (var idx = 0; idx < components.length; idx++) {
      var c = components[idx];
      if (c === '.') {
        continue;
      } else if (c === '..' && (absolute || (!absolute && goodComponents.length > 0 && goodComponents[0] !== '..'))) {
        // In the absolute case: Path is relative to root, so we may pop even if
        // goodComponents is empty (e.g. /../ => /)
        // In the relative case: We're getting rid of a directory that preceded
        // it (e.g. /foo/../bar -> /bar)
        goodComponents.pop();
      } else {
        goodComponents.push(c);
      }
    }

    // Add in '.' when it's a relative path with no other nonempty components.
    // Possible results: '.' and './' (input: [''] or [])
    // @todo Can probably simplify this logic.
    if (!absolute && goodComponents.length < 2) {
      switch (goodComponents.length) {
        case 1:
          if (goodComponents[0] === '') {
            goodComponents.unshift('.');
          }
          break;
        default:
          goodComponents.push('.');
      }
    }
    p = goodComponents.join(path.sep);
    if (absolute && p.charAt(0) !== path.sep) {
      p = path.sep + p;
    }
    return p;
  }

  /**
   * Join all arguments together and normalize the resulting path.
   *
   * Arguments must be strings.
   * @example Usage
   *   path.join('/foo', 'bar', 'baz/asdf', 'quux', '..')
   *   // returns
   *   '/foo/bar/baz/asdf'
   *
   *   path.join('foo', {}, 'bar')
   *   // throws exception
   *   TypeError: Arguments to path.join must be strings
   * @param [String,...] paths Each component of the path
   * @return [String]
   */
  public static join(...paths: any[]): string {
    // Required: Prune any non-strings from the path. I also prune empty segments
    // so we can do a simple join of the array.
    var processed = [];
    for (var i = 0; i < paths.length; i++) {
      var segment = paths[i];
      if (typeof segment !== 'string') {
        throw new TypeError("Invalid argument type to path.join: " + (typeof segment));
      } else if (segment !== '') {
        processed.push(segment);
      }
    }
    return path.normalize(processed.join(path.sep));
  }

  /**
   * Resolves to to an absolute path.
   *
   * If to isn't already absolute from arguments are prepended in right to left
   * order, until an absolute path is found. If after using all from paths still
   * no absolute path is found, the current working directory is used as well.
   * The resulting path is normalized, and trailing slashes are removed unless
   * the path gets resolved to the root directory. Non-string arguments are
   * ignored.
   *
   * Another way to think of it is as a sequence of cd commands in a shell.
   *
   *     path.resolve('foo/bar', '/tmp/file/', '..', 'a/../subfile')
   *
   * Is similar to:
   *
   *     cd foo/bar
   *     cd /tmp/file/
   *     cd ..
   *     cd a/../subfile
   *     pwd
   *
   * The difference is that the different paths don't need to exist and may also
   * be files.
   * @example Usage example
   *   path.resolve('/foo/bar', './baz')
   *   // returns
   *   '/foo/bar/baz'
   *
   *   path.resolve('/foo/bar', '/tmp/file/')
   *   // returns
   *   '/tmp/file'
   *
   *   path.resolve('wwwroot', 'static_files/png/', '../gif/image.gif')
   *   // if currently in /home/myself/node, it returns
   *   '/home/myself/node/wwwroot/static_files/gif/image.gif'
   * @param [String,...] paths
   * @return [String]
   */
  public static resolve(...paths: string[]): string {
    // Monitor for invalid paths, throw out empty paths, and look for the *last*
    // absolute path that we see.
    var processed = [];
    for (var i = 0; i < paths.length; i++) {
      var p = paths[i];
      if (typeof p !== 'string') {
        throw new TypeError("Invalid argument type to path.join: " + (typeof p));
      } else if (p !== '') {
        // Remove anything that has occurred before this absolute path, as it
        // doesn't matter.
        if (p.charAt(0) === path.sep) {
          processed = [];
        }
        processed.push(p);
      }
    }
    // Special: Remove trailing slash unless it's the root
    var resolved = path.normalize(processed.join(path.sep));
    if (resolved.length > 1 && resolved.charAt(resolved.length - 1) === path.sep) {
      return resolved.substr(0, resolved.length - 1);
    }
    // Special: If it doesn't start with '/', it's relative and we need to append
    // the current directory.
    if (resolved.charAt(0) !== path.sep) {
      // Remove ./, since we're going to append the current directory.
      if (resolved.charAt(0) === '.' && (resolved.length === 1 || resolved.charAt(1) === path.sep)) {
        resolved = resolved.length === 1 ? '' : resolved.substr(2);
      }
      // Append the current directory, which *must* be an absolute path.
      var cwd = process.cwd();
      if (resolved !== '') {
        // cwd will never end in a /... unless it's the root.
        resolved = this.normalize(cwd + (cwd !== '/' ? path.sep : '') + resolved);
      } else {
        resolved = cwd;
      }
    }
    return resolved;
  }

  /**
   * Solve the relative path from from to to.
   *
   * At times we have two absolute paths, and we need to derive the relative path
   * from one to the other. This is actually the reverse transform of
   * path.resolve, which means we see that:
   *
   *    path.resolve(from, path.relative(from, to)) == path.resolve(to)
   *
   * @example Usage example
   *   path.relative('C:\\orandea\\test\\aaa', 'C:\\orandea\\impl\\bbb')
   *   // returns
   *   '..\\..\\impl\\bbb'
   *
   *   path.relative('/data/orandea/test/aaa', '/data/orandea/impl/bbb')
   *   // returns
   *   '../../impl/bbb'
   * @param [String] from
   * @param [String] to
   * @return [String]
   */
  public static relative(from: string, to: string): string {
    var i;
    // Alright. Let's resolve these two to absolute paths and remove any
    // weirdness.
    from = path.resolve(from);
    to = path.resolve(to);
    var fromSegs = from.split(path.sep);
    var toSegs = to.split(path.sep);
    // Remove the first segment on both, as it's '' (both are absolute paths)
    toSegs.shift();
    fromSegs.shift();
    // There are two segments to this path:
    // * Going *up* the directory hierarchy with '..'
    // * Going *down* the directory hierarchy with foo/baz/bat.
    var upCount = 0;
    var downSegs = [];
    // Figure out how many things in 'from' are shared with 'to'.
    for (i = 0; i < fromSegs.length; i++) {
      var seg = fromSegs[i];
      if (seg === toSegs[i]) {
        continue;
      }
      // The rest of 'from', including the current element, indicates how many
      // directories we need to go up.
      upCount = fromSegs.length - i;
      break;
    }
    // The rest of 'to' indicates where we need to change to. We place this
    // outside of the loop, as toSegs.length may be greater than fromSegs.length.
    downSegs = toSegs.slice(i);
    // Special case: If 'from' is '/'
    if (fromSegs.length === 1 && fromSegs[0] === '') {
      upCount = 0;
    }
    // upCount can't be greater than the number of fromSegs
    // (cd .. from / is still /)
    if (upCount > fromSegs.length) {
      upCount = fromSegs.length;
    }
    // Create the final string!
    var rv = '';
    for (i = 0; i < upCount; i++) {
      rv += '../';
    }
    rv += downSegs.join(path.sep);
    // Special case: Remove trailing '/'. Happens if it's all up and no down.
    if (rv.length > 1 && rv.charAt(rv.length - 1) === path.sep) {
      rv = rv.substr(0, rv.length - 1);
    }
    return rv;
  }

  /**
   * Return the directory name of a path. Similar to the Unix `dirname` command.
   *
   * Note that BrowserFS does not validate if the path is actually a valid
   * directory.
   * @example Usage example
   *   path.dirname('/foo/bar/baz/asdf/quux')
   *   // returns
   *   '/foo/bar/baz/asdf'
   * @param [String] p The path to get the directory name of.
   * @return [String]
   */
  public static dirname(p: string): string {
    // We get rid of //, but we don't modify anything else (e.g. any extraneous .
    // and ../ are kept intact)
    p = path._removeDuplicateSeps(p);
    var absolute = p.charAt(0) === path.sep;
    var sections = p.split(path.sep);
    // Do 1 if it's /foo/bar, 2 if it's /foo/bar/
    if (sections.pop() === '' && sections.length > 0) {
      sections.pop();
    }
    if (sections.length > 1) {
      return sections.join(path.sep);
    } else if (absolute) {
      return path.sep;
    } else {
      return '.';
    }
  }

  /**
   * Return the last portion of a path. Similar to the Unix basename command.
   * @example Usage example
   *   path.basename('/foo/bar/baz/asdf/quux.html')
   *   // returns
   *   'quux.html'
   *
   *   path.basename('/foo/bar/baz/asdf/quux.html', '.html')
   *   // returns
   *   'quux'
   * @param [String] p
   * @param [String?] ext
   * @return [String]
   */
  public static basename(p: string, ext: string = ""): string {
    // Special case: Normalize will modify this to '.'
    if (p === '') {
      return p;
    }
    // Normalize the string first to remove any weirdness.
    p = path.normalize(p);
    // Get the last part of the string.
    var sections = p.split(path.sep);
    var lastPart = sections[sections.length - 1];
    // Special case: If it's empty, then we have a string like so: foo/
    // Meaning, 'foo' is guaranteed to be a directory.
    if (lastPart === '' && sections.length > 1) {
      return sections[sections.length - 2];
    }
    // Remove the extension, if need be.
    if (ext.length > 0) {
      var lastPartExt = lastPart.substr(lastPart.length - ext.length);
      if (lastPartExt === ext) {
        return lastPart.substr(0, lastPart.length - ext.length);
      }
    }
    return lastPart;
  }

  /**
   * Return the extension of the path, from the last '.' to end of string in the
   * last portion of the path. If there is no '.' in the last portion of the path
   * or the first character of it is '.', then it returns an empty string.
   * @example Usage example
   *   path.extname('index.html')
   *   // returns
   *   '.html'
   *
   *   path.extname('index.')
   *   // returns
   *   '.'
   *
   *   path.extname('index')
   *   // returns
   *   ''
   * @param [String] p
   * @return [String]
   */
  public static extname(p: string): string {
    p = path.normalize(p);
    var sections = p.split(path.sep);
    p = sections.pop();
    // Special case: foo/file.ext/ should return '.ext'
    if (p === '' && sections.length > 0) {
      p = sections.pop();
    }
    if (p === '..') {
      return '';
    }
    var i = p.lastIndexOf('.');
    if (i === -1 || i === 0) {
      return '';
    }
    return p.substr(i);
  }

  /**
   * Checks if the given path is an absolute path.
   *
   * Despite not being documented, this is a tested part of Node's path API.
   * @param [String] p
   * @return [Boolean] True if the path appears to be an absolute path.
   */
  public static isAbsolute(p: string): boolean {
    return p.length > 0 && p.charAt(0) === path.sep;
  }

  /**
   * Unknown. Undocumented.
   */
  public static _makeLong(p: string): string {
    return p;
  }

  // The platform-specific file separator. BrowserFS uses `/`.
  public static sep: string = '/';

  private static _replaceRegex = new RegExp("//+", 'g');

  private static _removeDuplicateSeps(p: string): string {
    p = p.replace(this._replaceRegex, this.sep);
    return p;
  }

  // The platform-specific path delimiter. BrowserFS uses `:`.
  private static delimiter = ':';
}
