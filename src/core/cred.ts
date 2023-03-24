/**
 * Credentials used for FS ops.
 * Similar to Linux's cred struct. See https://github.com/torvalds/linux/blob/master/include/linux/cred.h
 */
export default class Cred {
	constructor(public uid: number, public gid: number, public suid: number, public sgid: number, public euid: number, public egid: number) {}

	public static Root = new Cred(0, 0, 0, 0, 0, 0);
}
