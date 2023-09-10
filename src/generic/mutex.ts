export type MutexCallback = () => void;
/**
 * Non-recursive mutex
 * @hidden
 */
export default class Mutex {
	private _locked: boolean = false;
	private _waiters: MutexCallback[] = [];

	public lock(): Promise<void> {
		return new Promise(resolve => {
			if (this._locked) {
				this._waiters.push(resolve);
			}

			this._locked = true;
		});
	}

	public unlock(): void {
		if (!this._locked) {
			throw new Error('unlock of a non-locked mutex');
		}

		const next = this._waiters.shift();
		/* 
			don't unlock - we want to queue up next for the
			end of the current task execution, but we don't
			want it to be called inline with whatever the
			current stack is.  This way we still get the nice
			behavior that an unlock immediately followed by a
			lock won't cause starvation.
		*/
		if (next) {
			setTimeout(next, 0);
			return;
		}

		this._locked = false;
	}

	public tryLock(): boolean {
		if (this._locked) {
			return false;
		}

		this._locked = true;
		return true;
	}

	public isLocked(): boolean {
		return this._locked;
	}
}
