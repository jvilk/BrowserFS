import api_error = require('./api_error');

export enum ActionType {
  NOP = 0,
  THROW_EXCEPTION = 1,
  TRUNCATE_FILE = 2,
  CREATE_FILE = 3
}

export class FileFlag {
  private static flagCache: { [mode: string]: FileFlag } = {};
  private static validFlagStrs = ['r', 'r+', 'rs', 'rs+', 'w', 'wx', 'w+', 'wx+', 'a', 'ax', 'a+', 'ax+'];

  public static getFileFlag(flagStr: string): FileFlag {
    if (FileFlag.flagCache.hasOwnProperty(flagStr)) {
      return FileFlag.flagCache[flagStr];
    }
    return FileFlag.flagCache[flagStr] = new FileFlag(flagStr);
  }

  private flagStr: string;
  constructor(flagStr: string) {
    this.flagStr = flagStr;
    if (FileFlag.validFlagStrs.indexOf(flagStr) < 0) {
      throw new api_error.ApiError(api_error.ErrorType.INVALID_PARAM, "Invalid flag: " + flagStr);
    }
  }

  public isReadable(): boolean {
    return this.flagStr.indexOf('r') !== -1 || this.flagStr.indexOf('+') !== -1;
  }

  public isWriteable(): boolean {
    return this.flagStr.indexOf('w') !== -1 || this.flagStr.indexOf('a') !== -1 || this.flagStr.indexOf('+') !== -1;
  }

  public isTruncating(): boolean {
    return this.flagStr.indexOf('w') !== -1;
  }

  public isAppendable(): boolean {
    return this.flagStr.indexOf('a') !== -1;
  }

  public isSynchronous(): boolean {
    return this.flagStr.indexOf('s') !== -1;
  }

  public isExclusive(): boolean {
    return this.flagStr.indexOf('x') !== -1;
  }

  public pathExistsAction(): ActionType {
    if (this.isExclusive()) {
      return ActionType.THROW_EXCEPTION;
    } else if (this.isTruncating()) {
      return ActionType.TRUNCATE_FILE;
    } else {
      return ActionType.NOP;
    }
  }

  public pathNotExistsAction(): ActionType {
    if ((this.isWriteable() || this.isAppendable()) && this.flagStr !== 'r+') {
      return ActionType.CREATE_FILE;
    } else {
      return ActionType.THROW_EXCEPTION;
    }
  }
}
