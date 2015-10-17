declare class path {
    static normalize(p: string): string;
    static join(...paths: any[]): string;
    static resolve(...paths: string[]): string;
    static relative(from: string, to: string): string;
    static dirname(p: string): string;
    static basename(p: string, ext?: string): string;
    static extname(p: string): string;
    static isAbsolute(p: string): boolean;
    static _makeLong(p: string): string;
    static sep: string;
    private static _replaceRegex;
    private static _removeDuplicateSeps(p);
    private static delimiter;
}
export = path;
