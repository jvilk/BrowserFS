import assert = require('assert');
import wrapper = require('object-wrapper');
import wrapperInterfaces = require('object-wrapper/interfaces');

function construct(constructor: any, args: any): any {
    function F() : void {
        constructor.apply(this, args);
    }
    F.prototype = constructor.prototype;
    return new F();
}

function isAssertionError(e: any): e is assert.AssertionError {
  return typeof(e) === 'object' && e.hasOwnProperty('actual');
}

function wrapperFcn(funcInfo: wrapperInterfaces.IFunctionInfo, args: IArguments, isConstructor: boolean, caller: Function) {
  try {
    if (!isConstructor) {
      return funcInfo.originalFcn.apply(funcInfo.namespace, args);
    } else {
      return construct(funcInfo.originalFcn, args);
    }
  } catch (e) {
    if (isAssertionError(e)) {
      // XXX: Re-create the object to fix the stack trace.
      mocha.throwError(new assert.AssertionError({
        message: e.message,
        actual: e.actual,
        expected: e.expected,
        operator: e.operator,
        stackStartFunction: caller
      }));
    } else {
      mocha.throwError(e);
    }
  }
}

/**
 * Wraps the assert() module to appropriately pass exceptions through
 * mocha. Avoids the issue where Mocha can only report the throw site, and
 * not the stack trace.
 */
export = <typeof assert> wrapper(assert, wrapperFcn, 'assert');