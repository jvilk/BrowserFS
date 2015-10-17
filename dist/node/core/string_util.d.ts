export interface StringUtil {
    str2byte(str: string, buf: NodeBuffer): number;
    byte2str(buf: NodeBuffer): string;
    byteLength(str: string): number;
}
export declare function FindUtil(encoding: string): StringUtil;
export declare class UTF8 {
    static str2byte(str: string, buf: NodeBuffer): number;
    static byte2str(buff: NodeBuffer): string;
    static byteLength(str: string): number;
}
export declare class ASCII {
    static str2byte(str: string, buf: NodeBuffer): number;
    static byte2str(buff: NodeBuffer): string;
    static byteLength(str: string): number;
}
export declare class ExtendedASCII {
    private static extendedChars;
    static str2byte(str: string, buf: NodeBuffer): number;
    static byte2str(buff: NodeBuffer): string;
    static byteLength(str: string): number;
}
export declare class BINARY {
    static str2byte(str: string, buf: NodeBuffer): number;
    static byte2str(buff: NodeBuffer): string;
    static byteLength(str: string): number;
}
export declare class BASE64 {
    private static b64chars;
    private static num2b64;
    private static b642num;
    static byte2str(buff: NodeBuffer): string;
    static str2byte(str: string, buf: NodeBuffer): number;
    static byteLength(str: string): number;
}
export declare class UCS2 {
    static str2byte(str: string, buf: NodeBuffer): number;
    static byte2str(buff: NodeBuffer): string;
    static byteLength(str: string): number;
}
export declare class HEX {
    private static HEXCHARS;
    private static num2hex;
    private static hex2num;
    static str2byte(str: string, buf: NodeBuffer): number;
    static byte2str(buff: NodeBuffer): string;
    static byteLength(str: string): number;
}
export declare class BINSTR {
    static str2byte(str: string, buf: NodeBuffer): number;
    static byte2str(buff: NodeBuffer): string;
    static byteLength(str: string): number;
}
export declare class BINSTRIE {
    static str2byte(str: string, buf: NodeBuffer): number;
    static byte2str(buff: NodeBuffer): string;
    static byteLength(str: string): number;
}
