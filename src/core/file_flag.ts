import api_error = require('./api_error');

/**
 * @class
 */
export enum ActionType {
  // Indicates that the code should not do anything.
  NOP = 0,
  // Indicates that the code should throw an exception.
  THROW_EXCEPTION = 1,
  // Indicates that the code should truncate the file, but only if it is a file.
  TRUNCATE_FILE = 2,
  // Indicates that the code should create the file.
  CREATE_FILE = 3
}

/**
 * Represents one of the following file flags. A convenience object.
 *
 * * `'r'` - Open file for reading. An exception occurs if the file does not exist.
 * * `'r+'` - Open file for reading and writing. An exception occurs if the file does not exist.
 * * `'rs'` - Open file for reading in synchronous mode. Instructs the filesystem to not cache writes.
 * * `'rs+'` - Open file for reading and writing, and opens the file in synchronous mode.
 * * `'w'` - Open file for writing. The file is created (if it does not exist) or truncated (if it exists).
 * * `'wx'` - Like 'w' but opens the file in exclusive mode.
 * * `'w+'` - Open file for reading and writing. The file is created (if it does not exist) or truncated (if it exists).
 * * `'wx+'` - Like 'w+' but opens the file in exclusive mode.
 * * `'a'` - Open file for appending. The file is created if it does not exist.
 * * `'ax'` - Like 'a' but opens the file in exclusive mode.
 * * `'a+'` - Open file for reading and appending. The file is created if it does not exist.
 * * `'ax+'` - Like 'a+' but opens the file in exclusive mode.
 *
 * Exclusive mode ensures that the file path is newly created.
 * @class
 */
export class FileFlag {
  // Contains cached FileMode instances.
  private static flagCache: { [mode: string]: FileFlag } = {};
  // Array of valid mode strings.
  private static validFlagStrs = ['r', 'r+', 'rs', 'rs+', 'w', 'wx', 'w+', 'wx+', 'a', 'ax', 'a+', 'ax+'];

  /**
   * Get an object representing the given file mode.
   * @param [String] modeStr The string representing the mode
   * @return [BrowserFS.FileMode] The FileMode object representing the mode
   * @throw [BrowserFS.ApiError] when the mode string is invalid
   */
  public static getFileFlag(flagStr: string): FileFlag {
    // Check cache first.
    if (FileFlag.flagCache.hasOwnProperty(flagStr)) {
      return FileFlag.flagCache[flagStr];
    }
    return FileFlag.flagCache[flagStr] = new FileFlag(flagStr);
  }

  private flagStr: string;
  /**
   * This should never be called directly.
   * @param [String] modeStr The string representing the mode
   * @throw [BrowserFS.ApiError] when the mode string is invalid
   */
  constructor(flagStr: string) {
    this.flagStr = flagStr;
    if (FileFlag.validFlagStrs.indexOf(flagStr) < 0) {
      throw new api_error.ApiError(api_error.ErrorCode.EINVAL, "Invalid flag: " + flagStr);
    }
  }

  /**
   * Returns true if the file is readable.
   * @return [Boolean]
   */
  public isReadable(): boolean {
    return this.flagStr.indexOf('r') !== -1 || this.flagStr.indexOf('+') !== -1;
  }
  /**
   * Returns true if the file is writeable.
   * @return [Boolean]
   */
  public isWriteable(): boolean {
    return this.flagStr.indexOf('w') !== -1 || this.flagStr.indexOf('a') !== -1 || this.flagStr.indexOf('+') !== -1;
  }
  /**
   * Returns true if the file mode should truncate.
   * @return [Boolean]
   */
  public isTruncating(): boolean {
    return this.flagStr.indexOf('w') !== -1;
  }
  /**
   * Returns true if the file is appendable.
   * @return [Boolean]
   */
  public isAppendable(): boolean {
    return this.flagStr.indexOf('a') !== -1;
  }
  /**
   * Returns true if the file is open in synchronous mode.
   * @return [Boolean]
   */
  public isSynchronous(): boolean {
    return this.flagStr.indexOf('s') !== -1;
  }
  /**
   * Returns true if the file is open in exclusive mode.
   * @return [Boolean]
   */
  public isExclusive(): boolean {
    return this.flagStr.indexOf('x') !== -1;
  }
  /**
   * Returns one of the static fields on this object that indicates the
   * appropriate response to the path existing.
   * @return [Number]
   */
  public pathExistsAction(): ActionType {
    if (this.isExclusive()) {
      return ActionType.THROW_EXCEPTION;
    } else if (this.isTruncating()) {
      return ActionType.TRUNCATE_FILE;
    } else {
      return ActionType.NOP;
    }
  }
  /**
   * Returns one of the static fields on this object that indicates the
   * appropriate response to the path not existing.
   * @return [Number]
   */
  public pathNotExistsAction(): ActionType {
    if ((this.isWriteable() || this.isAppendable()) && this.flagStr !== 'r+') {
      return ActionType.CREATE_FILE;
    } else {
      return ActionType.THROW_EXCEPTION;
    }
  }
}
