export declare enum ActionType {
    NOP = 0,
    THROW_EXCEPTION = 1,
    TRUNCATE_FILE = 2,
    CREATE_FILE = 3,
}
export declare class FileFlag {
    private static flagCache;
    private static validFlagStrs;
    static getFileFlag(flagStr: string): FileFlag;
    private flagStr;
    constructor(flagStr: string);
    getFlagString(): string;
    isReadable(): boolean;
    isWriteable(): boolean;
    isTruncating(): boolean;
    isAppendable(): boolean;
    isSynchronous(): boolean;
    isExclusive(): boolean;
    pathExistsAction(): ActionType;
    pathNotExistsAction(): ActionType;
}
