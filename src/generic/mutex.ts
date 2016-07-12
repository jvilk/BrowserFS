
declare var setImmediate: (cb: Function) => void;

/// non-recursive mutex
export class Mutex {
  private _locked: boolean = false;
  private _waiters: Function[] = [];

  lock(cb: Function): void {
    if (this._locked) {
      this._waiters.push(cb);
      return;
    }
    this._locked = true;
    cb();
  }

  unlock(): void {
    if (!this._locked)
      throw new Error('unlock of a non-locked mutex');

    let next = this._waiters.shift();
    // don't unlock - we want to queue up next for the
    // _end_ of the current task execution, but we don't
    // want it to be called inline with whatever the
    // current stack is.  This way we still get the nice
    // behavior that an unlock immediately followed by a
    // lock won't cause starvation.
    if (next) {
      setImmediate(next);
      return;
    }

    this._locked = false;
  }

  tryLock(): boolean {
    if (this._locked)
      return false;

    this._locked = true;
    return true;
  }

  isLocked(): boolean {
    return this._locked;
  }
}
