// Appended before Emscripten output.
module.exports = function(Module) {

// The Module object: Our interface to the outside world. We import
// and export values on it, and do the work to get that through
// closure compiler if necessary. There are various ways Module can be used:
// 1. Not defined. We create it here
// 2. A function parameter, function(Module) { ..generated code.. }
// 3. pre-run appended it, var Module = {}; ..generated code..
// 4. External script tag defines var Module.
// We need to do an eval in order to handle the closure compiler
// case, where this code here is minified but Module was defined
// elsewhere (e.g. case 4 above). We also need to check if Module
// already exists (e.g. case 3 above).
// Note that if you want to run closure, and also to use Module
// after the generated code, you will need to define   var Module = {};
// before the code. Then that object will be used in the code, and you
// can continue to use Module afterwards as well.
var Module;
if (!Module) Module = (typeof Module !== 'undefined' ? Module : null) || {};

// Sometimes an existing Module object exists with properties
// meant to overwrite the default module functionality. Here
// we collect those properties and reapply _after_ we configure
// the current environment's defaults to avoid having to be so
// defensive during initialization.
var moduleOverrides = {};
for (var key in Module) {
  if (Module.hasOwnProperty(key)) {
    moduleOverrides[key] = Module[key];
  }
}

// The environment setup code below is customized to use Module.
// *** Environment setup code ***
var ENVIRONMENT_IS_WEB = typeof window === 'object';
// Three configurations we can be running in:
// 1) We could be the application main() thread running in the main JS UI thread. (ENVIRONMENT_IS_WORKER == false and ENVIRONMENT_IS_PTHREAD == false)
// 2) We could be the application main() thread proxied to worker. (with Emscripten -s PROXY_TO_WORKER=1) (ENVIRONMENT_IS_WORKER == true, ENVIRONMENT_IS_PTHREAD == false)
// 3) We could be an application pthread running in a worker. (ENVIRONMENT_IS_WORKER == true and ENVIRONMENT_IS_PTHREAD == true)
var ENVIRONMENT_IS_WORKER = typeof importScripts === 'function';
var ENVIRONMENT_IS_NODE = typeof process === 'object' && typeof require === 'function' && !ENVIRONMENT_IS_WEB && !ENVIRONMENT_IS_WORKER;
var ENVIRONMENT_IS_SHELL = !ENVIRONMENT_IS_WEB && !ENVIRONMENT_IS_NODE && !ENVIRONMENT_IS_WORKER;

if (ENVIRONMENT_IS_NODE) {
  // Expose functionality in the same simple way that the shells work
  // Note that we pollute the global namespace here, otherwise we break in node
  if (!Module['print']) Module['print'] = function print(x) {
    process['stdout'].write(x + '\n');
  };
  if (!Module['printErr']) Module['printErr'] = function printErr(x) {
    process['stderr'].write(x + '\n');
  };

  var nodeFS = require('fs');
  var nodePath = require('path');

  Module['read'] = function read(filename, binary) {
    filename = nodePath['normalize'](filename);
    var ret = nodeFS['readFileSync'](filename);
    // The path is absolute if the normalized version is the same as the resolved.
    if (!ret && filename != nodePath['resolve'](filename)) {
      filename = path.join(__dirname, '..', 'src', filename);
      ret = nodeFS['readFileSync'](filename);
    }
    if (ret && !binary) ret = ret.toString();
    return ret;
  };

  Module['readBinary'] = function readBinary(filename) {
    var ret = Module['read'](filename, true);
    if (!ret.buffer) {
      ret = new Uint8Array(ret);
    }
    assert(ret.buffer);
    return ret;
  };

  Module['load'] = function load(f) {
    globalEval(read(f));
  };

  if (!Module['thisProgram']) {
    if (process['argv'].length > 1) {
      Module['thisProgram'] = process['argv'][1].replace(/\\/g, '/');
    } else {
      Module['thisProgram'] = 'unknown-program';
    }
  }

  Module['arguments'] = process['argv'].slice(2);

  if (typeof module !== 'undefined') {
    module['exports'] = Module;
  }

  process['on']('uncaughtException', function(ex) {
    // suppress ExitStatus exceptions from showing an error
    if (!(ex instanceof ExitStatus)) {
      throw ex;
    }
  });

  Module['inspect'] = function () { return '[Emscripten Module object]'; };
}
else if (ENVIRONMENT_IS_SHELL) {
  if (!Module['print']) Module['print'] = print;
  if (typeof printErr != 'undefined') Module['printErr'] = printErr; // not present in v8 or older sm

  if (typeof read != 'undefined') {
    Module['read'] = read;
  } else {
    Module['read'] = function read() { throw 'no read() available (jsc?)' };
  }

  Module['readBinary'] = function readBinary(f) {
    if (typeof readbuffer === 'function') {
      return new Uint8Array(readbuffer(f));
    }
    var data = read(f, 'binary');
    assert(typeof data === 'object');
    return data;
  };

  if (typeof scriptArgs != 'undefined') {
    Module['arguments'] = scriptArgs;
  } else if (typeof arguments != 'undefined') {
    Module['arguments'] = arguments;
  }

}
else if (ENVIRONMENT_IS_WEB || ENVIRONMENT_IS_WORKER) {
  Module['read'] = function read(url) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', url, false);
    xhr.send(null);
    return xhr.responseText;
  };

  if (typeof arguments != 'undefined') {
    Module['arguments'] = arguments;
  }

  if (typeof console !== 'undefined') {
    if (!Module['print']) Module['print'] = function print(x) {
      console.log(x);
    };
    if (!Module['printErr']) Module['printErr'] = function printErr(x) {
      console.log(x);
    };
  } else {
    // Probably a worker, and without console.log. We can do very little here...
    var TRY_USE_DUMP = false;
    if (!Module['print']) Module['print'] = (TRY_USE_DUMP && (typeof(dump) !== "undefined") ? (function(x) {
      dump(x);
    }) : (function(x) {
      // self.postMessage(x); // enable this if you want stdout to be sent as messages
    }));
  }

  if (ENVIRONMENT_IS_WORKER) {
    Module['load'] = importScripts;
  }

  if (typeof Module['setWindowTitle'] === 'undefined') {
    Module['setWindowTitle'] = function(title) { document.title = title };
  }
}
else {
  // Unreachable because SHELL is dependant on the others
  throw 'Unknown runtime environment. Where are we?';
}

function globalEval(x) {
  eval.call(null, x);
}
if (!Module['load'] && Module['read']) {
  Module['load'] = function load(f) {
    globalEval(Module['read'](f));
  };
}
if (!Module['print']) {
  Module['print'] = function(){};
}
if (!Module['printErr']) {
  Module['printErr'] = Module['print'];
}
if (!Module['arguments']) {
  Module['arguments'] = [];
}
if (!Module['thisProgram']) {
  Module['thisProgram'] = './this.program';
}

// *** Environment setup code ***

// Closure helpers
Module.print = Module['print'];
Module.printErr = Module['printErr'];

// Callbacks
Module['preRun'] = [];
Module['postRun'] = [];

// Merge back in the overrides
for (var key in moduleOverrides) {
  if (moduleOverrides.hasOwnProperty(key)) {
    Module[key] = moduleOverrides[key];
  }
}



// === Preamble library stuff ===

// Documentation for the public APIs defined in this file must be updated in: 
//    site/source/docs/api_reference/preamble.js.rst
// A prebuilt local version of the documentation is available at: 
//    site/build/text/docs/api_reference/preamble.js.txt
// You can also build docs locally as HTML or other formats in site/
// An online HTML version (which may be of a different version of Emscripten)
//    is up at http://kripken.github.io/emscripten-site/docs/api_reference/preamble.js.html

//========================================
// Runtime code shared with compiler
//========================================

var Runtime = {
  setTempRet0: function (value) {
    tempRet0 = value;
  },
  getTempRet0: function () {
    return tempRet0;
  },
  stackSave: function () {
    return STACKTOP;
  },
  stackRestore: function (stackTop) {
    STACKTOP = stackTop;
  },
  getNativeTypeSize: function (type) {
    switch (type) {
      case 'i1': case 'i8': return 1;
      case 'i16': return 2;
      case 'i32': return 4;
      case 'i64': return 8;
      case 'float': return 4;
      case 'double': return 8;
      default: {
        if (type[type.length-1] === '*') {
          return Runtime.QUANTUM_SIZE; // A pointer
        } else if (type[0] === 'i') {
          var bits = parseInt(type.substr(1));
          assert(bits % 8 === 0);
          return bits/8;
        } else {
          return 0;
        }
      }
    }
  },
  getNativeFieldSize: function (type) {
    return Math.max(Runtime.getNativeTypeSize(type), Runtime.QUANTUM_SIZE);
  },
  STACK_ALIGN: 16,
  prepVararg: function (ptr, type) {
    if (type === 'double' || type === 'i64') {
      // move so the load is aligned
      if (ptr & 7) {
        assert((ptr & 7) === 4);
        ptr += 4;
      }
    } else {
      assert((ptr & 3) === 0);
    }
    return ptr;
  },
  getAlignSize: function (type, size, vararg) {
    // we align i64s and doubles on 64-bit boundaries, unlike x86
    if (!vararg && (type == 'i64' || type == 'double')) return 8;
    if (!type) return Math.min(size, 8); // align structures internally to 64 bits
    return Math.min(size || (type ? Runtime.getNativeFieldSize(type) : 0), Runtime.QUANTUM_SIZE);
  },
  dynCall: function (sig, ptr, args) {
    if (args && args.length) {
      if (!args.splice) args = Array.prototype.slice.call(args);
      args.splice(0, 0, ptr);
      return Module['dynCall_' + sig].apply(null, args);
    } else {
      return Module['dynCall_' + sig].call(null, ptr);
    }
  },
  functionPointers: [],
  addFunction: function (func) {
    for (var i = 0; i < Runtime.functionPointers.length; i++) {
      if (!Runtime.functionPointers[i]) {
        Runtime.functionPointers[i] = func;
        return 2*(1 + i);
      }
    }
    throw 'Finished up all reserved function pointers. Use a higher value for RESERVED_FUNCTION_POINTERS.';
  },
  removeFunction: function (index) {
    Runtime.functionPointers[(index-2)/2] = null;
  },
  warnOnce: function (text) {
    if (!Runtime.warnOnce.shown) Runtime.warnOnce.shown = {};
    if (!Runtime.warnOnce.shown[text]) {
      Runtime.warnOnce.shown[text] = 1;
      Module.printErr(text);
    }
  },
  funcWrappers: {},
  getFuncWrapper: function (func, sig) {
    assert(sig);
    if (!Runtime.funcWrappers[sig]) {
      Runtime.funcWrappers[sig] = {};
    }
    var sigCache = Runtime.funcWrappers[sig];
    if (!sigCache[func]) {
      sigCache[func] = function dynCall_wrapper() {
        return Runtime.dynCall(sig, func, arguments);
      };
    }
    return sigCache[func];
  },
  getCompilerSetting: function (name) {
    throw 'You must build with -s RETAIN_COMPILER_SETTINGS=1 for Runtime.getCompilerSetting or emscripten_get_compiler_setting to work';
  },
  stackAlloc: function (size) { var ret = STACKTOP;STACKTOP = (STACKTOP + size)|0;STACKTOP = (((STACKTOP)+15)&-16); return ret; },
  staticAlloc: function (size) { var ret = STATICTOP;STATICTOP = (STATICTOP + size)|0;STATICTOP = (((STATICTOP)+15)&-16); return ret; },
  dynamicAlloc: function (size) { var ret = DYNAMICTOP;DYNAMICTOP = (DYNAMICTOP + size)|0;DYNAMICTOP = (((DYNAMICTOP)+15)&-16); if (DYNAMICTOP >= TOTAL_MEMORY) { var success = enlargeMemory(); if (!success) { DYNAMICTOP = ret;  return 0; } }; return ret; },
  alignMemory: function (size,quantum) { var ret = size = Math.ceil((size)/(quantum ? quantum : 16))*(quantum ? quantum : 16); return ret; },
  makeBigInt: function (low,high,unsigned) { var ret = (unsigned ? ((+((low>>>0)))+((+((high>>>0)))*(+4294967296))) : ((+((low>>>0)))+((+((high|0)))*(+4294967296)))); return ret; },
  GLOBAL_BASE: 8,
  QUANTUM_SIZE: 4,
  __dummy__: 0
}



Module["Runtime"] = Runtime;



//========================================
// Runtime essentials
//========================================

var __THREW__ = 0; // Used in checking for thrown exceptions.

var ABORT = false; // whether we are quitting the application. no code should run after this. set in exit() and abort()
var EXITSTATUS = 0;

var undef = 0;
// tempInt is used for 32-bit signed values or smaller. tempBigInt is used
// for 32-bit unsigned values or more than 32 bits. TODO: audit all uses of tempInt
var tempValue, tempInt, tempBigInt, tempInt2, tempBigInt2, tempPair, tempBigIntI, tempBigIntR, tempBigIntS, tempBigIntP, tempBigIntD, tempDouble, tempFloat;
var tempI64, tempI64b;
var tempRet0, tempRet1, tempRet2, tempRet3, tempRet4, tempRet5, tempRet6, tempRet7, tempRet8, tempRet9;

function assert(condition, text) {
  if (!condition) {
    abort('Assertion failed: ' + text);
  }
}

var globalScope = this;

// Returns the C function with a specified identifier (for C++, you need to do manual name mangling)
function getCFunc(ident) {
  var func = Module['_' + ident]; // closure exported function
  if (!func) {
    try {
      func = eval('_' + ident); // explicit lookup
    } catch(e) {}
  }
  assert(func, 'Cannot call unknown function ' + ident + ' (perhaps LLVM optimizations or closure removed it?)');
  return func;
}

var cwrap, ccall;
(function(){
  var JSfuncs = {
    // Helpers for cwrap -- it can't refer to Runtime directly because it might
    // be renamed by closure, instead it calls JSfuncs['stackSave'].body to find
    // out what the minified function name is.
    'stackSave': function() {
      Runtime.stackSave()
    },
    'stackRestore': function() {
      Runtime.stackRestore()
    },
    // type conversion from js to c
    'arrayToC' : function(arr) {
      var ret = Runtime.stackAlloc(arr.length);
      writeArrayToMemory(arr, ret);
      return ret;
    },
    'stringToC' : function(str) {
      var ret = 0;
      if (str !== null && str !== undefined && str !== 0) { // null string
        // at most 4 bytes per UTF-8 code point, +1 for the trailing '\0'
        ret = Runtime.stackAlloc((str.length << 2) + 1);
        writeStringToMemory(str, ret);
      }
      return ret;
    }
  };
  // For fast lookup of conversion functions
  var toC = {'string' : JSfuncs['stringToC'], 'array' : JSfuncs['arrayToC']};

  // C calling interface. 
  ccall = function ccallFunc(ident, returnType, argTypes, args, opts) {
    var func = getCFunc(ident);
    var cArgs = [];
    var stack = 0;
    if (args) {
      for (var i = 0; i < args.length; i++) {
        var converter = toC[argTypes[i]];
        if (converter) {
          if (stack === 0) stack = Runtime.stackSave();
          cArgs[i] = converter(args[i]);
        } else {
          cArgs[i] = args[i];
        }
      }
    }
    var ret = func.apply(null, cArgs);
    if (returnType === 'string') ret = Pointer_stringify(ret);
    if (stack !== 0) {
      if (opts && opts.async) {
        EmterpreterAsync.asyncFinalizers.push(function() {
          Runtime.stackRestore(stack);
        });
        return;
      }
      Runtime.stackRestore(stack);
    }
    return ret;
  }

  var sourceRegex = /^function\s*\(([^)]*)\)\s*{\s*([^*]*?)[\s;]*(?:return\s*(.*?)[;\s]*)?}$/;
  function parseJSFunc(jsfunc) {
    // Match the body and the return value of a javascript function source
    var parsed = jsfunc.toString().match(sourceRegex).slice(1);
    return {arguments : parsed[0], body : parsed[1], returnValue: parsed[2]}
  }
  var JSsource = {};
  for (var fun in JSfuncs) {
    if (JSfuncs.hasOwnProperty(fun)) {
      // Elements of toCsource are arrays of three items:
      // the code, and the return value
      JSsource[fun] = parseJSFunc(JSfuncs[fun]);
    }
  }

  
  cwrap = function cwrap(ident, returnType, argTypes) {
    argTypes = argTypes || [];
    var cfunc = getCFunc(ident);
    // When the function takes numbers and returns a number, we can just return
    // the original function
    var numericArgs = argTypes.every(function(type){ return type === 'number'});
    var numericRet = (returnType !== 'string');
    if ( numericRet && numericArgs) {
      return cfunc;
    }
    // Creation of the arguments list (["$1","$2",...,"$nargs"])
    var argNames = argTypes.map(function(x,i){return '$'+i});
    var funcstr = "(function(" + argNames.join(',') + ") {";
    var nargs = argTypes.length;
    if (!numericArgs) {
      // Generate the code needed to convert the arguments from javascript
      // values to pointers
      funcstr += 'var stack = ' + JSsource['stackSave'].body + ';';
      for (var i = 0; i < nargs; i++) {
        var arg = argNames[i], type = argTypes[i];
        if (type === 'number') continue;
        var convertCode = JSsource[type + 'ToC']; // [code, return]
        funcstr += 'var ' + convertCode.arguments + ' = ' + arg + ';';
        funcstr += convertCode.body + ';';
        funcstr += arg + '=' + convertCode.returnValue + ';';
      }
    }

    // When the code is compressed, the name of cfunc is not literally 'cfunc' anymore
    var cfuncname = parseJSFunc(function(){return cfunc}).returnValue;
    // Call the function
    funcstr += 'var ret = ' + cfuncname + '(' + argNames.join(',') + ');';
    if (!numericRet) { // Return type can only by 'string' or 'number'
      // Convert the result to a string
      var strgfy = parseJSFunc(function(){return Pointer_stringify}).returnValue;
      funcstr += 'ret = ' + strgfy + '(ret);';
    }
    if (!numericArgs) {
      // If we had a stack, restore it
      funcstr += JSsource['stackRestore'].body.replace('()', '(stack)') + ';';
    }
    funcstr += 'return ret})';
    return eval(funcstr);
  };
})();
Module["ccall"] = ccall;
Module["cwrap"] = cwrap;

function setValue(ptr, value, type, noSafe) {
  type = type || 'i8';
  if (type.charAt(type.length-1) === '*') type = 'i32'; // pointers are 32-bit
    switch(type) {
      case 'i1': HEAP8[((ptr)>>0)]=value; break;
      case 'i8': HEAP8[((ptr)>>0)]=value; break;
      case 'i16': HEAP16[((ptr)>>1)]=value; break;
      case 'i32': HEAP32[((ptr)>>2)]=value; break;
      case 'i64': (tempI64 = [value>>>0,(tempDouble=value,(+(Math_abs(tempDouble))) >= (+1) ? (tempDouble > (+0) ? ((Math_min((+(Math_floor((tempDouble)/(+4294967296)))), (+4294967295)))|0)>>>0 : (~~((+(Math_ceil((tempDouble - +(((~~(tempDouble)))>>>0))/(+4294967296))))))>>>0) : 0)],HEAP32[((ptr)>>2)]=tempI64[0],HEAP32[(((ptr)+(4))>>2)]=tempI64[1]); break;
      case 'float': HEAPF32[((ptr)>>2)]=value; break;
      case 'double': HEAPF64[((ptr)>>3)]=value; break;
      default: abort('invalid type for setValue: ' + type);
    }
}
Module["setValue"] = setValue;


function getValue(ptr, type, noSafe) {
  type = type || 'i8';
  if (type.charAt(type.length-1) === '*') type = 'i32'; // pointers are 32-bit
    switch(type) {
      case 'i1': return HEAP8[((ptr)>>0)];
      case 'i8': return HEAP8[((ptr)>>0)];
      case 'i16': return HEAP16[((ptr)>>1)];
      case 'i32': return HEAP32[((ptr)>>2)];
      case 'i64': return HEAP32[((ptr)>>2)];
      case 'float': return HEAPF32[((ptr)>>2)];
      case 'double': return HEAPF64[((ptr)>>3)];
      default: abort('invalid type for setValue: ' + type);
    }
  return null;
}
Module["getValue"] = getValue;

var ALLOC_NORMAL = 0; // Tries to use _malloc()
var ALLOC_STACK = 1; // Lives for the duration of the current function call
var ALLOC_STATIC = 2; // Cannot be freed
var ALLOC_DYNAMIC = 3; // Cannot be freed except through sbrk
var ALLOC_NONE = 4; // Do not allocate
Module["ALLOC_NORMAL"] = ALLOC_NORMAL;
Module["ALLOC_STACK"] = ALLOC_STACK;
Module["ALLOC_STATIC"] = ALLOC_STATIC;
Module["ALLOC_DYNAMIC"] = ALLOC_DYNAMIC;
Module["ALLOC_NONE"] = ALLOC_NONE;

// allocate(): This is for internal use. You can use it yourself as well, but the interface
//             is a little tricky (see docs right below). The reason is that it is optimized
//             for multiple syntaxes to save space in generated code. So you should
//             normally not use allocate(), and instead allocate memory using _malloc(),
//             initialize it with setValue(), and so forth.
// @slab: An array of data, or a number. If a number, then the size of the block to allocate,
//        in *bytes* (note that this is sometimes confusing: the next parameter does not
//        affect this!)
// @types: Either an array of types, one for each byte (or 0 if no type at that position),
//         or a single type which is used for the entire block. This only matters if there
//         is initial data - if @slab is a number, then this does not matter at all and is
//         ignored.
// @allocator: How to allocate memory, see ALLOC_*
function allocate(slab, types, allocator, ptr) {
  var zeroinit, size;
  if (typeof slab === 'number') {
    zeroinit = true;
    size = slab;
  } else {
    zeroinit = false;
    size = slab.length;
  }

  var singleType = typeof types === 'string' ? types : null;

  var ret;
  if (allocator == ALLOC_NONE) {
    ret = ptr;
  } else {
    ret = [_malloc, Runtime.stackAlloc, Runtime.staticAlloc, Runtime.dynamicAlloc][allocator === undefined ? ALLOC_STATIC : allocator](Math.max(size, singleType ? 1 : types.length));
  }

  if (zeroinit) {
    var ptr = ret, stop;
    assert((ret & 3) == 0);
    stop = ret + (size & ~3);
    for (; ptr < stop; ptr += 4) {
      HEAP32[((ptr)>>2)]=0;
    }
    stop = ret + size;
    while (ptr < stop) {
      HEAP8[((ptr++)>>0)]=0;
    }
    return ret;
  }

  if (singleType === 'i8') {
    if (slab.subarray || slab.slice) {
      HEAPU8.set(slab, ret);
    } else {
      HEAPU8.set(new Uint8Array(slab), ret);
    }
    return ret;
  }

  var i = 0, type, typeSize, previousType;
  while (i < size) {
    var curr = slab[i];

    if (typeof curr === 'function') {
      curr = Runtime.getFunctionIndex(curr);
    }

    type = singleType || types[i];
    if (type === 0) {
      i++;
      continue;
    }

    if (type == 'i64') type = 'i32'; // special case: we have one i32 here, and one i32 later

    setValue(ret+i, curr, type);

    // no need to look up size unless type changes, so cache it
    if (previousType !== type) {
      typeSize = Runtime.getNativeTypeSize(type);
      previousType = type;
    }
    i += typeSize;
  }

  return ret;
}
Module["allocate"] = allocate;

// Allocate memory during any stage of startup - static memory early on, dynamic memory later, malloc when ready
function getMemory(size) {
  if (!staticSealed) return Runtime.staticAlloc(size);
  if ((typeof _sbrk !== 'undefined' && !_sbrk.called) || !runtimeInitialized) return Runtime.dynamicAlloc(size);
  return _malloc(size);
}
Module["getMemory"] = getMemory;

function Pointer_stringify(ptr, /* optional */ length) {
  if (length === 0 || !ptr) return '';
  // TODO: use TextDecoder
  // Find the length, and check for UTF while doing so
  var hasUtf = 0;
  var t;
  var i = 0;
  while (1) {
    t = HEAPU8[(((ptr)+(i))>>0)];
    hasUtf |= t;
    if (t == 0 && !length) break;
    i++;
    if (length && i == length) break;
  }
  if (!length) length = i;

  var ret = '';

  if (hasUtf < 128) {
    var MAX_CHUNK = 1024; // split up into chunks, because .apply on a huge string can overflow the stack
    var curr;
    while (length > 0) {
      curr = String.fromCharCode.apply(String, HEAPU8.subarray(ptr, ptr + Math.min(length, MAX_CHUNK)));
      ret = ret ? ret + curr : curr;
      ptr += MAX_CHUNK;
      length -= MAX_CHUNK;
    }
    return ret;
  }
  return Module['UTF8ToString'](ptr);
}
Module["Pointer_stringify"] = Pointer_stringify;

// Given a pointer 'ptr' to a null-terminated ASCII-encoded string in the emscripten HEAP, returns
// a copy of that string as a Javascript String object.

function AsciiToString(ptr) {
  var str = '';
  while (1) {
    var ch = HEAP8[((ptr++)>>0)];
    if (!ch) return str;
    str += String.fromCharCode(ch);
  }
}
Module["AsciiToString"] = AsciiToString;

// Copies the given Javascript String object 'str' to the emscripten HEAP at address 'outPtr',
// null-terminated and encoded in ASCII form. The copy will require at most str.length+1 bytes of space in the HEAP.

function stringToAscii(str, outPtr) {
  return writeAsciiToMemory(str, outPtr, false);
}
Module["stringToAscii"] = stringToAscii;

// Given a pointer 'ptr' to a null-terminated UTF8-encoded string in the given array that contains uint8 values, returns
// a copy of that string as a Javascript String object.

function UTF8ArrayToString(u8Array, idx) {
  var u0, u1, u2, u3, u4, u5;

  var str = '';
  while (1) {
    // For UTF8 byte structure, see http://en.wikipedia.org/wiki/UTF-8#Description and https://www.ietf.org/rfc/rfc2279.txt and https://tools.ietf.org/html/rfc3629
    u0 = u8Array[idx++];
    if (!u0) return str;
    if (!(u0 & 0x80)) { str += String.fromCharCode(u0); continue; }
    u1 = u8Array[idx++] & 63;
    if ((u0 & 0xE0) == 0xC0) { str += String.fromCharCode(((u0 & 31) << 6) | u1); continue; }
    u2 = u8Array[idx++] & 63;
    if ((u0 & 0xF0) == 0xE0) {
      u0 = ((u0 & 15) << 12) | (u1 << 6) | u2;
    } else {
      u3 = u8Array[idx++] & 63;
      if ((u0 & 0xF8) == 0xF0) {
        u0 = ((u0 & 7) << 18) | (u1 << 12) | (u2 << 6) | u3;
      } else {
        u4 = u8Array[idx++] & 63;
        if ((u0 & 0xFC) == 0xF8) {
          u0 = ((u0 & 3) << 24) | (u1 << 18) | (u2 << 12) | (u3 << 6) | u4;
        } else {
          u5 = u8Array[idx++] & 63;
          u0 = ((u0 & 1) << 30) | (u1 << 24) | (u2 << 18) | (u3 << 12) | (u4 << 6) | u5;
        }
      }
    }
    if (u0 < 0x10000) {
      str += String.fromCharCode(u0);
    } else {
      var ch = u0 - 0x10000;
      str += String.fromCharCode(0xD800 | (ch >> 10), 0xDC00 | (ch & 0x3FF));
    }
  }
}
Module["UTF8ArrayToString"] = UTF8ArrayToString;

// Given a pointer 'ptr' to a null-terminated UTF8-encoded string in the emscripten HEAP, returns
// a copy of that string as a Javascript String object.

function UTF8ToString(ptr) {
  return UTF8ArrayToString(HEAPU8,ptr);
}
Module["UTF8ToString"] = UTF8ToString;

// Copies the given Javascript String object 'str' to the given byte array at address 'outIdx',
// encoded in UTF8 form and null-terminated. The copy will require at most str.length*4+1 bytes of space in the HEAP.
// Use the function lengthBytesUTF8() to compute the exact number of bytes (excluding null terminator) that this function will write.
// Parameters:
//   str: the Javascript string to copy.
//   outU8Array: the array to copy to. Each index in this array is assumed to be one 8-byte element.
//   outIdx: The starting offset in the array to begin the copying.
//   maxBytesToWrite: The maximum number of bytes this function can write to the array. This count should include the null 
//                    terminator, i.e. if maxBytesToWrite=1, only the null terminator will be written and nothing else.
//                    maxBytesToWrite=0 does not write any bytes to the output, not even the null terminator.
// Returns the number of bytes written, EXCLUDING the null terminator.

function stringToUTF8Array(str, outU8Array, outIdx, maxBytesToWrite) {
  if (!(maxBytesToWrite > 0)) // Parameter maxBytesToWrite is not optional. Negative values, 0, null, undefined and false each don't write out any bytes.
    return 0;

  var startIdx = outIdx;
  var endIdx = outIdx + maxBytesToWrite - 1; // -1 for string null terminator.
  for (var i = 0; i < str.length; ++i) {
    // Gotcha: charCodeAt returns a 16-bit word that is a UTF-16 encoded code unit, not a Unicode code point of the character! So decode UTF16->UTF32->UTF8.
    // See http://unicode.org/faq/utf_bom.html#utf16-3
    // For UTF8 byte structure, see http://en.wikipedia.org/wiki/UTF-8#Description and https://www.ietf.org/rfc/rfc2279.txt and https://tools.ietf.org/html/rfc3629
    var u = str.charCodeAt(i); // possibly a lead surrogate
    if (u >= 0xD800 && u <= 0xDFFF) u = 0x10000 + ((u & 0x3FF) << 10) | (str.charCodeAt(++i) & 0x3FF);
    if (u <= 0x7F) {
      if (outIdx >= endIdx) break;
      outU8Array[outIdx++] = u;
    } else if (u <= 0x7FF) {
      if (outIdx + 1 >= endIdx) break;
      outU8Array[outIdx++] = 0xC0 | (u >> 6);
      outU8Array[outIdx++] = 0x80 | (u & 63);
    } else if (u <= 0xFFFF) {
      if (outIdx + 2 >= endIdx) break;
      outU8Array[outIdx++] = 0xE0 | (u >> 12);
      outU8Array[outIdx++] = 0x80 | ((u >> 6) & 63);
      outU8Array[outIdx++] = 0x80 | (u & 63);
    } else if (u <= 0x1FFFFF) {
      if (outIdx + 3 >= endIdx) break;
      outU8Array[outIdx++] = 0xF0 | (u >> 18);
      outU8Array[outIdx++] = 0x80 | ((u >> 12) & 63);
      outU8Array[outIdx++] = 0x80 | ((u >> 6) & 63);
      outU8Array[outIdx++] = 0x80 | (u & 63);
    } else if (u <= 0x3FFFFFF) {
      if (outIdx + 4 >= endIdx) break;
      outU8Array[outIdx++] = 0xF8 | (u >> 24);
      outU8Array[outIdx++] = 0x80 | ((u >> 18) & 63);
      outU8Array[outIdx++] = 0x80 | ((u >> 12) & 63);
      outU8Array[outIdx++] = 0x80 | ((u >> 6) & 63);
      outU8Array[outIdx++] = 0x80 | (u & 63);
    } else {
      if (outIdx + 5 >= endIdx) break;
      outU8Array[outIdx++] = 0xFC | (u >> 30);
      outU8Array[outIdx++] = 0x80 | ((u >> 24) & 63);
      outU8Array[outIdx++] = 0x80 | ((u >> 18) & 63);
      outU8Array[outIdx++] = 0x80 | ((u >> 12) & 63);
      outU8Array[outIdx++] = 0x80 | ((u >> 6) & 63);
      outU8Array[outIdx++] = 0x80 | (u & 63);
    }
  }
  // Null-terminate the pointer to the buffer.
  outU8Array[outIdx] = 0;
  return outIdx - startIdx;
}
Module["stringToUTF8Array"] = stringToUTF8Array;

// Copies the given Javascript String object 'str' to the emscripten HEAP at address 'outPtr',
// null-terminated and encoded in UTF8 form. The copy will require at most str.length*4+1 bytes of space in the HEAP.
// Use the function lengthBytesUTF8() to compute the exact number of bytes (excluding null terminator) that this function will write.
// Returns the number of bytes written, EXCLUDING the null terminator.

function stringToUTF8(str, outPtr, maxBytesToWrite) {
  return stringToUTF8Array(str, HEAPU8,outPtr, maxBytesToWrite);
}
Module["stringToUTF8"] = stringToUTF8;

// Returns the number of bytes the given Javascript string takes if encoded as a UTF8 byte array, EXCLUDING the null terminator byte.

function lengthBytesUTF8(str) {
  var len = 0;
  for (var i = 0; i < str.length; ++i) {
    // Gotcha: charCodeAt returns a 16-bit word that is a UTF-16 encoded code unit, not a Unicode code point of the character! So decode UTF16->UTF32->UTF8.
    // See http://unicode.org/faq/utf_bom.html#utf16-3
    var u = str.charCodeAt(i); // possibly a lead surrogate
    if (u >= 0xD800 && u <= 0xDFFF) u = 0x10000 + ((u & 0x3FF) << 10) | (str.charCodeAt(++i) & 0x3FF);
    if (u <= 0x7F) {
      ++len;
    } else if (u <= 0x7FF) {
      len += 2;
    } else if (u <= 0xFFFF) {
      len += 3;
    } else if (u <= 0x1FFFFF) {
      len += 4;
    } else if (u <= 0x3FFFFFF) {
      len += 5;
    } else {
      len += 6;
    }
  }
  return len;
}
Module["lengthBytesUTF8"] = lengthBytesUTF8;

// Given a pointer 'ptr' to a null-terminated UTF16LE-encoded string in the emscripten HEAP, returns
// a copy of that string as a Javascript String object.

function UTF16ToString(ptr) {
  var i = 0;

  var str = '';
  while (1) {
    var codeUnit = HEAP16[(((ptr)+(i*2))>>1)];
    if (codeUnit == 0)
      return str;
    ++i;
    // fromCharCode constructs a character from a UTF-16 code unit, so we can pass the UTF16 string right through.
    str += String.fromCharCode(codeUnit);
  }
}
Module["UTF16ToString"] = UTF16ToString;

// Copies the given Javascript String object 'str' to the emscripten HEAP at address 'outPtr',
// null-terminated and encoded in UTF16 form. The copy will require at most str.length*4+2 bytes of space in the HEAP.
// Use the function lengthBytesUTF16() to compute the exact number of bytes (excluding null terminator) that this function will write.
// Parameters:
//   str: the Javascript string to copy.
//   outPtr: Byte address in Emscripten HEAP where to write the string to.
//   maxBytesToWrite: The maximum number of bytes this function can write to the array. This count should include the null 
//                    terminator, i.e. if maxBytesToWrite=2, only the null terminator will be written and nothing else.
//                    maxBytesToWrite<2 does not write any bytes to the output, not even the null terminator.
// Returns the number of bytes written, EXCLUDING the null terminator.

function stringToUTF16(str, outPtr, maxBytesToWrite) {
  // Backwards compatibility: if max bytes is not specified, assume unsafe unbounded write is allowed.
  if (maxBytesToWrite === undefined) {
    maxBytesToWrite = 0x7FFFFFFF;
  }
  if (maxBytesToWrite < 2) return 0;
  maxBytesToWrite -= 2; // Null terminator.
  var startPtr = outPtr;
  var numCharsToWrite = (maxBytesToWrite < str.length*2) ? (maxBytesToWrite / 2) : str.length;
  for (var i = 0; i < numCharsToWrite; ++i) {
    // charCodeAt returns a UTF-16 encoded code unit, so it can be directly written to the HEAP.
    var codeUnit = str.charCodeAt(i); // possibly a lead surrogate
    HEAP16[((outPtr)>>1)]=codeUnit;
    outPtr += 2;
  }
  // Null-terminate the pointer to the HEAP.
  HEAP16[((outPtr)>>1)]=0;
  return outPtr - startPtr;
}
Module["stringToUTF16"] = stringToUTF16;

// Returns the number of bytes the given Javascript string takes if encoded as a UTF16 byte array, EXCLUDING the null terminator byte.

function lengthBytesUTF16(str) {
  return str.length*2;
}
Module["lengthBytesUTF16"] = lengthBytesUTF16;

function UTF32ToString(ptr) {
  var i = 0;

  var str = '';
  while (1) {
    var utf32 = HEAP32[(((ptr)+(i*4))>>2)];
    if (utf32 == 0)
      return str;
    ++i;
    // Gotcha: fromCharCode constructs a character from a UTF-16 encoded code (pair), not from a Unicode code point! So encode the code point to UTF-16 for constructing.
    // See http://unicode.org/faq/utf_bom.html#utf16-3
    if (utf32 >= 0x10000) {
      var ch = utf32 - 0x10000;
      str += String.fromCharCode(0xD800 | (ch >> 10), 0xDC00 | (ch & 0x3FF));
    } else {
      str += String.fromCharCode(utf32);
    }
  }
}
Module["UTF32ToString"] = UTF32ToString;

// Copies the given Javascript String object 'str' to the emscripten HEAP at address 'outPtr',
// null-terminated and encoded in UTF32 form. The copy will require at most str.length*4+4 bytes of space in the HEAP.
// Use the function lengthBytesUTF32() to compute the exact number of bytes (excluding null terminator) that this function will write.
// Parameters:
//   str: the Javascript string to copy.
//   outPtr: Byte address in Emscripten HEAP where to write the string to.
//   maxBytesToWrite: The maximum number of bytes this function can write to the array. This count should include the null 
//                    terminator, i.e. if maxBytesToWrite=4, only the null terminator will be written and nothing else.
//                    maxBytesToWrite<4 does not write any bytes to the output, not even the null terminator.
// Returns the number of bytes written, EXCLUDING the null terminator.

function stringToUTF32(str, outPtr, maxBytesToWrite) {
  // Backwards compatibility: if max bytes is not specified, assume unsafe unbounded write is allowed.
  if (maxBytesToWrite === undefined) {
    maxBytesToWrite = 0x7FFFFFFF;
  }
  if (maxBytesToWrite < 4) return 0;
  var startPtr = outPtr;
  var endPtr = startPtr + maxBytesToWrite - 4;
  for (var i = 0; i < str.length; ++i) {
    // Gotcha: charCodeAt returns a 16-bit word that is a UTF-16 encoded code unit, not a Unicode code point of the character! We must decode the string to UTF-32 to the heap.
    // See http://unicode.org/faq/utf_bom.html#utf16-3
    var codeUnit = str.charCodeAt(i); // possibly a lead surrogate
    if (codeUnit >= 0xD800 && codeUnit <= 0xDFFF) {
      var trailSurrogate = str.charCodeAt(++i);
      codeUnit = 0x10000 + ((codeUnit & 0x3FF) << 10) | (trailSurrogate & 0x3FF);
    }
    HEAP32[((outPtr)>>2)]=codeUnit;
    outPtr += 4;
    if (outPtr + 4 > endPtr) break;
  }
  // Null-terminate the pointer to the HEAP.
  HEAP32[((outPtr)>>2)]=0;
  return outPtr - startPtr;
}
Module["stringToUTF32"] = stringToUTF32;

// Returns the number of bytes the given Javascript string takes if encoded as a UTF16 byte array, EXCLUDING the null terminator byte.

function lengthBytesUTF32(str) {
  var len = 0;
  for (var i = 0; i < str.length; ++i) {
    // Gotcha: charCodeAt returns a 16-bit word that is a UTF-16 encoded code unit, not a Unicode code point of the character! We must decode the string to UTF-32 to the heap.
    // See http://unicode.org/faq/utf_bom.html#utf16-3
    var codeUnit = str.charCodeAt(i);
    if (codeUnit >= 0xD800 && codeUnit <= 0xDFFF) ++i; // possibly a lead surrogate, so skip over the tail surrogate.
    len += 4;
  }

  return len;
}
Module["lengthBytesUTF32"] = lengthBytesUTF32;

function demangle(func) {
  var hasLibcxxabi = !!Module['___cxa_demangle'];
  if (hasLibcxxabi) {
    try {
      var buf = _malloc(func.length);
      writeStringToMemory(func.substr(1), buf);
      var status = _malloc(4);
      var ret = Module['___cxa_demangle'](buf, 0, 0, status);
      if (getValue(status, 'i32') === 0 && ret) {
        return Pointer_stringify(ret);
      }
      // otherwise, libcxxabi failed, we can try ours which may return a partial result
    } catch(e) {
      // failure when using libcxxabi, we can try ours which may return a partial result
    } finally {
      if (buf) _free(buf);
      if (status) _free(status);
      if (ret) _free(ret);
    }
  }
  var i = 3;
  // params, etc.
  var basicTypes = {
    'v': 'void',
    'b': 'bool',
    'c': 'char',
    's': 'short',
    'i': 'int',
    'l': 'long',
    'f': 'float',
    'd': 'double',
    'w': 'wchar_t',
    'a': 'signed char',
    'h': 'unsigned char',
    't': 'unsigned short',
    'j': 'unsigned int',
    'm': 'unsigned long',
    'x': 'long long',
    'y': 'unsigned long long',
    'z': '...'
  };
  var subs = [];
  var first = true;
  function dump(x) {
    //return;
    if (x) Module.print(x);
    Module.print(func);
    var pre = '';
    for (var a = 0; a < i; a++) pre += ' ';
    Module.print (pre + '^');
  }
  function parseNested() {
    i++;
    if (func[i] === 'K') i++; // ignore const
    var parts = [];
    while (func[i] !== 'E') {
      if (func[i] === 'S') { // substitution
        i++;
        var next = func.indexOf('_', i);
        var num = func.substring(i, next) || 0;
        parts.push(subs[num] || '?');
        i = next+1;
        continue;
      }
      if (func[i] === 'C') { // constructor
        parts.push(parts[parts.length-1]);
        i += 2;
        continue;
      }
      var size = parseInt(func.substr(i));
      var pre = size.toString().length;
      if (!size || !pre) { i--; break; } // counter i++ below us
      var curr = func.substr(i + pre, size);
      parts.push(curr);
      subs.push(curr);
      i += pre + size;
    }
    i++; // skip E
    return parts;
  }
  function parse(rawList, limit, allowVoid) { // main parser
    limit = limit || Infinity;
    var ret = '', list = [];
    function flushList() {
      return '(' + list.join(', ') + ')';
    }
    var name;
    if (func[i] === 'N') {
      // namespaced N-E
      name = parseNested().join('::');
      limit--;
      if (limit === 0) return rawList ? [name] : name;
    } else {
      // not namespaced
      if (func[i] === 'K' || (first && func[i] === 'L')) i++; // ignore const and first 'L'
      var size = parseInt(func.substr(i));
      if (size) {
        var pre = size.toString().length;
        name = func.substr(i + pre, size);
        i += pre + size;
      }
    }
    first = false;
    if (func[i] === 'I') {
      i++;
      var iList = parse(true);
      var iRet = parse(true, 1, true);
      ret += iRet[0] + ' ' + name + '<' + iList.join(', ') + '>';
    } else {
      ret = name;
    }
    paramLoop: while (i < func.length && limit-- > 0) {
      //dump('paramLoop');
      var c = func[i++];
      if (c in basicTypes) {
        list.push(basicTypes[c]);
      } else {
        switch (c) {
          case 'P': list.push(parse(true, 1, true)[0] + '*'); break; // pointer
          case 'R': list.push(parse(true, 1, true)[0] + '&'); break; // reference
          case 'L': { // literal
            i++; // skip basic type
            var end = func.indexOf('E', i);
            var size = end - i;
            list.push(func.substr(i, size));
            i += size + 2; // size + 'EE'
            break;
          }
          case 'A': { // array
            var size = parseInt(func.substr(i));
            i += size.toString().length;
            if (func[i] !== '_') throw '?';
            i++; // skip _
            list.push(parse(true, 1, true)[0] + ' [' + size + ']');
            break;
          }
          case 'E': break paramLoop;
          default: ret += '?' + c; break paramLoop;
        }
      }
    }
    if (!allowVoid && list.length === 1 && list[0] === 'void') list = []; // avoid (void)
    if (rawList) {
      if (ret) {
        list.push(ret + '?');
      }
      return list;
    } else {
      return ret + flushList();
    }
  }
  var parsed = func;
  try {
    // Special-case the entry point, since its name differs from other name mangling.
    if (func == 'Object._main' || func == '_main') {
      return 'main()';
    }
    if (typeof func === 'number') func = Pointer_stringify(func);
    if (func[0] !== '_') return func;
    if (func[1] !== '_') return func; // C function
    if (func[2] !== 'Z') return func;
    switch (func[3]) {
      case 'n': return 'operator new()';
      case 'd': return 'operator delete()';
    }
    parsed = parse();
  } catch(e) {
    parsed += '?';
  }
  if (parsed.indexOf('?') >= 0 && !hasLibcxxabi) {
    Runtime.warnOnce('warning: a problem occurred in builtin C++ name demangling; build with  -s DEMANGLE_SUPPORT=1  to link in libcxxabi demangling');
  }
  return parsed;
}

function demangleAll(text) {
  return text.replace(/__Z[\w\d_]+/g, function(x) { var y = demangle(x); return x === y ? x : (x + ' [' + y + ']') });
}

function jsStackTrace() {
  var err = new Error();
  if (!err.stack) {
    // IE10+ special cases: It does have callstack info, but it is only populated if an Error object is thrown,
    // so try that as a special-case.
    try {
      throw new Error(0);
    } catch(e) {
      err = e;
    }
    if (!err.stack) {
      return '(no stack trace available)';
    }
  }
  return err.stack.toString();
}

function stackTrace() {
  return demangleAll(jsStackTrace());
}
Module["stackTrace"] = stackTrace;

// Memory management

var PAGE_SIZE = 4096;

function alignMemoryPage(x) {
  if (x % 4096 > 0) {
    x += (4096 - (x % 4096));
  }
  return x;
}

var HEAP;
var HEAP8, HEAPU8, HEAP16, HEAPU16, HEAP32, HEAPU32, HEAPF32, HEAPF64;

var STATIC_BASE = 0, STATICTOP = 0, staticSealed = false; // static area
var STACK_BASE = 0, STACKTOP = 0, STACK_MAX = 0; // stack area
var DYNAMIC_BASE = 0, DYNAMICTOP = 0; // dynamic area handled by sbrk


function abortOnCannotGrowMemory() {
  abort('Cannot enlarge memory arrays. Either (1) compile with  -s TOTAL_MEMORY=X  with X higher than the current value ' + TOTAL_MEMORY + ', (2) compile with  -s ALLOW_MEMORY_GROWTH=1  which adjusts the size at runtime but prevents some optimizations, (3) set Module.TOTAL_MEMORY to a higher value before the program runs, or if you want malloc to return NULL (0) instead of this abort, compile with  -s ABORTING_MALLOC=0 ');
}

function enlargeMemory() {
  abortOnCannotGrowMemory();
}


var TOTAL_STACK = Module['TOTAL_STACK'] || 5242880;
var TOTAL_MEMORY = Module['TOTAL_MEMORY'] || 16777216;

var totalMemory = 64*1024;
while (totalMemory < TOTAL_MEMORY || totalMemory < 2*TOTAL_STACK) {
  if (totalMemory < 16*1024*1024) {
    totalMemory *= 2;
  } else {
    totalMemory += 16*1024*1024
  }
}
if (totalMemory !== TOTAL_MEMORY) {
  TOTAL_MEMORY = totalMemory;
}

// Initialize the runtime's memory
// check for full engine support (use string 'subarray' to avoid closure compiler confusion)
assert(typeof Int32Array !== 'undefined' && typeof Float64Array !== 'undefined' && !!(new Int32Array(1)['subarray']) && !!(new Int32Array(1)['set']),
       'JS engine does not provide full typed array support');

var buffer;



buffer = new ArrayBuffer(TOTAL_MEMORY);
HEAP8 = new Int8Array(buffer);
HEAP16 = new Int16Array(buffer);
HEAP32 = new Int32Array(buffer);
HEAPU8 = new Uint8Array(buffer);
HEAPU16 = new Uint16Array(buffer);
HEAPU32 = new Uint32Array(buffer);
HEAPF32 = new Float32Array(buffer);
HEAPF64 = new Float64Array(buffer);


// Endianness check (note: assumes compiler arch was little-endian)
HEAP32[0] = 255;
assert(HEAPU8[0] === 255 && HEAPU8[3] === 0, 'Typed arrays 2 must be run on a little-endian system');

Module['HEAP'] = HEAP;
Module['buffer'] = buffer;
Module['HEAP8'] = HEAP8;
Module['HEAP16'] = HEAP16;
Module['HEAP32'] = HEAP32;
Module['HEAPU8'] = HEAPU8;
Module['HEAPU16'] = HEAPU16;
Module['HEAPU32'] = HEAPU32;
Module['HEAPF32'] = HEAPF32;
Module['HEAPF64'] = HEAPF64;

function callRuntimeCallbacks(callbacks) {
  while(callbacks.length > 0) {
    var callback = callbacks.shift();
    if (typeof callback == 'function') {
      callback();
      continue;
    }
    var func = callback.func;
    if (typeof func === 'number') {
      if (callback.arg === undefined) {
        Runtime.dynCall('v', func);
      } else {
        Runtime.dynCall('vi', func, [callback.arg]);
      }
    } else {
      func(callback.arg === undefined ? null : callback.arg);
    }
  }
}

var __ATPRERUN__  = []; // functions called before the runtime is initialized
var __ATINIT__    = []; // functions called during startup
var __ATMAIN__    = []; // functions called when main() is to be run
var __ATEXIT__    = []; // functions called during shutdown
var __ATPOSTRUN__ = []; // functions called after the runtime has exited

var runtimeInitialized = false;
var runtimeExited = false;


function preRun() {
  // compatibility - merge in anything from Module['preRun'] at this time
  if (Module['preRun']) {
    if (typeof Module['preRun'] == 'function') Module['preRun'] = [Module['preRun']];
    while (Module['preRun'].length) {
      addOnPreRun(Module['preRun'].shift());
    }
  }
  callRuntimeCallbacks(__ATPRERUN__);
}

function ensureInitRuntime() {
  if (runtimeInitialized) return;
  runtimeInitialized = true;
  callRuntimeCallbacks(__ATINIT__);
}

function preMain() {
  callRuntimeCallbacks(__ATMAIN__);
}

function exitRuntime() {
  callRuntimeCallbacks(__ATEXIT__);
  runtimeExited = true;
}

function postRun() {
  // compatibility - merge in anything from Module['postRun'] at this time
  if (Module['postRun']) {
    if (typeof Module['postRun'] == 'function') Module['postRun'] = [Module['postRun']];
    while (Module['postRun'].length) {
      addOnPostRun(Module['postRun'].shift());
    }
  }
  callRuntimeCallbacks(__ATPOSTRUN__);
}

function addOnPreRun(cb) {
  __ATPRERUN__.unshift(cb);
}
Module["addOnPreRun"] = addOnPreRun;

function addOnInit(cb) {
  __ATINIT__.unshift(cb);
}
Module["addOnInit"] = addOnInit;

function addOnPreMain(cb) {
  __ATMAIN__.unshift(cb);
}
Module["addOnPreMain"] = addOnPreMain;

function addOnExit(cb) {
  __ATEXIT__.unshift(cb);
}
Module["addOnExit"] = addOnExit;

function addOnPostRun(cb) {
  __ATPOSTRUN__.unshift(cb);
}
Module["addOnPostRun"] = addOnPostRun;

// Tools


function intArrayFromString(stringy, dontAddNull, length /* optional */) {
  var len = length > 0 ? length : lengthBytesUTF8(stringy)+1;
  var u8array = new Array(len);
  var numBytesWritten = stringToUTF8Array(stringy, u8array, 0, u8array.length);
  if (dontAddNull) u8array.length = numBytesWritten;
  return u8array;
}
Module["intArrayFromString"] = intArrayFromString;

function intArrayToString(array) {
  var ret = [];
  for (var i = 0; i < array.length; i++) {
    var chr = array[i];
    if (chr > 0xFF) {
      chr &= 0xFF;
    }
    ret.push(String.fromCharCode(chr));
  }
  return ret.join('');
}
Module["intArrayToString"] = intArrayToString;

function writeStringToMemory(string, buffer, dontAddNull) {
  var array = intArrayFromString(string, dontAddNull);
  var i = 0;
  while (i < array.length) {
    var chr = array[i];
    HEAP8[(((buffer)+(i))>>0)]=chr;
    i = i + 1;
  }
}
Module["writeStringToMemory"] = writeStringToMemory;

function writeArrayToMemory(array, buffer) {
  for (var i = 0; i < array.length; i++) {
    HEAP8[((buffer++)>>0)]=array[i];
  }
}
Module["writeArrayToMemory"] = writeArrayToMemory;

function writeAsciiToMemory(str, buffer, dontAddNull) {
  for (var i = 0; i < str.length; ++i) {
    HEAP8[((buffer++)>>0)]=str.charCodeAt(i);
  }
  // Null-terminate the pointer to the HEAP.
  if (!dontAddNull) HEAP8[((buffer)>>0)]=0;
}
Module["writeAsciiToMemory"] = writeAsciiToMemory;

function unSign(value, bits, ignore) {
  if (value >= 0) {
    return value;
  }
  return bits <= 32 ? 2*Math.abs(1 << (bits-1)) + value // Need some trickery, since if bits == 32, we are right at the limit of the bits JS uses in bitshifts
                    : Math.pow(2, bits)         + value;
}
function reSign(value, bits, ignore) {
  if (value <= 0) {
    return value;
  }
  var half = bits <= 32 ? Math.abs(1 << (bits-1)) // abs is needed if bits == 32
                        : Math.pow(2, bits-1);
  if (value >= half && (bits <= 32 || value > half)) { // for huge values, we can hit the precision limit and always get true here. so don't do that
                                                       // but, in general there is no perfect solution here. With 64-bit ints, we get rounding and errors
                                                       // TODO: In i64 mode 1, resign the two parts separately and safely
    value = -2*half + value; // Cannot bitshift half, as it may be at the limit of the bits JS uses in bitshifts
  }
  return value;
}


// check for imul support, and also for correctness ( https://bugs.webkit.org/show_bug.cgi?id=126345 )
if (!Math['imul'] || Math['imul'](0xffffffff, 5) !== -5) Math['imul'] = function imul(a, b) {
  var ah  = a >>> 16;
  var al = a & 0xffff;
  var bh  = b >>> 16;
  var bl = b & 0xffff;
  return (al*bl + ((ah*bl + al*bh) << 16))|0;
};
Math.imul = Math['imul'];


if (!Math['clz32']) Math['clz32'] = function(x) {
  x = x >>> 0;
  for (var i = 0; i < 32; i++) {
    if (x & (1 << (31 - i))) return i;
  }
  return 32;
};
Math.clz32 = Math['clz32']

var Math_abs = Math.abs;
var Math_cos = Math.cos;
var Math_sin = Math.sin;
var Math_tan = Math.tan;
var Math_acos = Math.acos;
var Math_asin = Math.asin;
var Math_atan = Math.atan;
var Math_atan2 = Math.atan2;
var Math_exp = Math.exp;
var Math_log = Math.log;
var Math_sqrt = Math.sqrt;
var Math_ceil = Math.ceil;
var Math_floor = Math.floor;
var Math_pow = Math.pow;
var Math_imul = Math.imul;
var Math_fround = Math.fround;
var Math_min = Math.min;
var Math_clz32 = Math.clz32;

// A counter of dependencies for calling run(). If we need to
// do asynchronous work before running, increment this and
// decrement it. Incrementing must happen in a place like
// PRE_RUN_ADDITIONS (used by emcc to add file preloading).
// Note that you can add dependencies in preRun, even though
// it happens right before run - run will be postponed until
// the dependencies are met.
var runDependencies = 0;
var runDependencyWatcher = null;
var dependenciesFulfilled = null; // overridden to take different actions when all run dependencies are fulfilled

function getUniqueRunDependency(id) {
  return id;
}

function addRunDependency(id) {
  runDependencies++;
  if (Module['monitorRunDependencies']) {
    Module['monitorRunDependencies'](runDependencies);
  }
}
Module["addRunDependency"] = addRunDependency;

function removeRunDependency(id) {
  runDependencies--;
  if (Module['monitorRunDependencies']) {
    Module['monitorRunDependencies'](runDependencies);
  }
  if (runDependencies == 0) {
    if (runDependencyWatcher !== null) {
      clearInterval(runDependencyWatcher);
      runDependencyWatcher = null;
    }
    if (dependenciesFulfilled) {
      var callback = dependenciesFulfilled;
      dependenciesFulfilled = null;
      callback(); // can add another dependenciesFulfilled
    }
  }
}
Module["removeRunDependency"] = removeRunDependency;

Module["preloadedImages"] = {}; // maps url to image data
Module["preloadedAudios"] = {}; // maps url to audio data



var memoryInitializer = null;



// === Body ===

var ASM_CONSTS = [];




STATIC_BASE = 8;

STATICTOP = STATIC_BASE + 6496;
  /* global initializers */  __ATINIT__.push();
  

memoryInitializer = "files.js.mem";





/* no memory initializer */
var tempDoublePtr = Runtime.alignMemory(allocate(12, "i8", ALLOC_STATIC), 8);

assert(tempDoublePtr % 8 == 0);

function copyTempFloat(ptr) { // functions, because inlining this code increases code size too much

  HEAP8[tempDoublePtr] = HEAP8[ptr];

  HEAP8[tempDoublePtr+1] = HEAP8[ptr+1];

  HEAP8[tempDoublePtr+2] = HEAP8[ptr+2];

  HEAP8[tempDoublePtr+3] = HEAP8[ptr+3];

}

function copyTempDouble(ptr) {

  HEAP8[tempDoublePtr] = HEAP8[ptr];

  HEAP8[tempDoublePtr+1] = HEAP8[ptr+1];

  HEAP8[tempDoublePtr+2] = HEAP8[ptr+2];

  HEAP8[tempDoublePtr+3] = HEAP8[ptr+3];

  HEAP8[tempDoublePtr+4] = HEAP8[ptr+4];

  HEAP8[tempDoublePtr+5] = HEAP8[ptr+5];

  HEAP8[tempDoublePtr+6] = HEAP8[ptr+6];

  HEAP8[tempDoublePtr+7] = HEAP8[ptr+7];

}

// {{PRE_LIBRARY}}


   
  Module["_i64Subtract"] = _i64Subtract;

  function ___assert_fail(condition, filename, line, func) {
      ABORT = true;
      throw 'Assertion failed: ' + Pointer_stringify(condition) + ', at: ' + [filename ? Pointer_stringify(filename) : 'unknown filename', line, func ? Pointer_stringify(func) : 'unknown function'] + ' at ' + stackTrace();
    }

   
  Module["_memset"] = _memset;

  var _BDtoILow=true;

   
  Module["_bitshift64Shl"] = _bitshift64Shl;

  function _abort() {
      Module['abort']();
    }

  function ___lock() {}

  function ___unlock() {}

   
  Module["_i64Add"] = _i64Add;

  var _fabs=Math_abs;

  
  
  
  var ERRNO_CODES={EPERM:1,ENOENT:2,ESRCH:3,EINTR:4,EIO:5,ENXIO:6,E2BIG:7,ENOEXEC:8,EBADF:9,ECHILD:10,EAGAIN:11,EWOULDBLOCK:11,ENOMEM:12,EACCES:13,EFAULT:14,ENOTBLK:15,EBUSY:16,EEXIST:17,EXDEV:18,ENODEV:19,ENOTDIR:20,EISDIR:21,EINVAL:22,ENFILE:23,EMFILE:24,ENOTTY:25,ETXTBSY:26,EFBIG:27,ENOSPC:28,ESPIPE:29,EROFS:30,EMLINK:31,EPIPE:32,EDOM:33,ERANGE:34,ENOMSG:42,EIDRM:43,ECHRNG:44,EL2NSYNC:45,EL3HLT:46,EL3RST:47,ELNRNG:48,EUNATCH:49,ENOCSI:50,EL2HLT:51,EDEADLK:35,ENOLCK:37,EBADE:52,EBADR:53,EXFULL:54,ENOANO:55,EBADRQC:56,EBADSLT:57,EDEADLOCK:35,EBFONT:59,ENOSTR:60,ENODATA:61,ETIME:62,ENOSR:63,ENONET:64,ENOPKG:65,EREMOTE:66,ENOLINK:67,EADV:68,ESRMNT:69,ECOMM:70,EPROTO:71,EMULTIHOP:72,EDOTDOT:73,EBADMSG:74,ENOTUNIQ:76,EBADFD:77,EREMCHG:78,ELIBACC:79,ELIBBAD:80,ELIBSCN:81,ELIBMAX:82,ELIBEXEC:83,ENOSYS:38,ENOTEMPTY:39,ENAMETOOLONG:36,ELOOP:40,EOPNOTSUPP:95,EPFNOSUPPORT:96,ECONNRESET:104,ENOBUFS:105,EAFNOSUPPORT:97,EPROTOTYPE:91,ENOTSOCK:88,ENOPROTOOPT:92,ESHUTDOWN:108,ECONNREFUSED:111,EADDRINUSE:98,ECONNABORTED:103,ENETUNREACH:101,ENETDOWN:100,ETIMEDOUT:110,EHOSTDOWN:112,EHOSTUNREACH:113,EINPROGRESS:115,EALREADY:114,EDESTADDRREQ:89,EMSGSIZE:90,EPROTONOSUPPORT:93,ESOCKTNOSUPPORT:94,EADDRNOTAVAIL:99,ENETRESET:102,EISCONN:106,ENOTCONN:107,ETOOMANYREFS:109,EUSERS:87,EDQUOT:122,ESTALE:116,ENOTSUP:95,ENOMEDIUM:123,EILSEQ:84,EOVERFLOW:75,ECANCELED:125,ENOTRECOVERABLE:131,EOWNERDEAD:130,ESTRPIPE:86};
  
  var ERRNO_MESSAGES={0:"Success",1:"Not super-user",2:"No such file or directory",3:"No such process",4:"Interrupted system call",5:"I/O error",6:"No such device or address",7:"Arg list too long",8:"Exec format error",9:"Bad file number",10:"No children",11:"No more processes",12:"Not enough core",13:"Permission denied",14:"Bad address",15:"Block device required",16:"Mount device busy",17:"File exists",18:"Cross-device link",19:"No such device",20:"Not a directory",21:"Is a directory",22:"Invalid argument",23:"Too many open files in system",24:"Too many open files",25:"Not a typewriter",26:"Text file busy",27:"File too large",28:"No space left on device",29:"Illegal seek",30:"Read only file system",31:"Too many links",32:"Broken pipe",33:"Math arg out of domain of func",34:"Math result not representable",35:"File locking deadlock error",36:"File or path name too long",37:"No record locks available",38:"Function not implemented",39:"Directory not empty",40:"Too many symbolic links",42:"No message of desired type",43:"Identifier removed",44:"Channel number out of range",45:"Level 2 not synchronized",46:"Level 3 halted",47:"Level 3 reset",48:"Link number out of range",49:"Protocol driver not attached",50:"No CSI structure available",51:"Level 2 halted",52:"Invalid exchange",53:"Invalid request descriptor",54:"Exchange full",55:"No anode",56:"Invalid request code",57:"Invalid slot",59:"Bad font file fmt",60:"Device not a stream",61:"No data (for no delay io)",62:"Timer expired",63:"Out of streams resources",64:"Machine is not on the network",65:"Package not installed",66:"The object is remote",67:"The link has been severed",68:"Advertise error",69:"Srmount error",70:"Communication error on send",71:"Protocol error",72:"Multihop attempted",73:"Cross mount point (not really error)",74:"Trying to read unreadable message",75:"Value too large for defined data type",76:"Given log. name not unique",77:"f.d. invalid for this operation",78:"Remote address changed",79:"Can   access a needed shared lib",80:"Accessing a corrupted shared lib",81:".lib section in a.out corrupted",82:"Attempting to link in too many libs",83:"Attempting to exec a shared library",84:"Illegal byte sequence",86:"Streams pipe error",87:"Too many users",88:"Socket operation on non-socket",89:"Destination address required",90:"Message too long",91:"Protocol wrong type for socket",92:"Protocol not available",93:"Unknown protocol",94:"Socket type not supported",95:"Not supported",96:"Protocol family not supported",97:"Address family not supported by protocol family",98:"Address already in use",99:"Address not available",100:"Network interface is not configured",101:"Network is unreachable",102:"Connection reset by network",103:"Connection aborted",104:"Connection reset by peer",105:"No buffer space available",106:"Socket is already connected",107:"Socket is not connected",108:"Can't send after socket shutdown",109:"Too many references",110:"Connection timed out",111:"Connection refused",112:"Host is down",113:"Host is unreachable",114:"Socket already connected",115:"Connection already in progress",116:"Stale file handle",122:"Quota exceeded",123:"No medium (in tape drive)",125:"Operation canceled",130:"Previous owner died",131:"State not recoverable"};
  
  function ___setErrNo(value) {
      if (Module['___errno_location']) HEAP32[((Module['___errno_location']())>>2)]=value;
      return value;
    }
  
  var TTY={ttys:[],init:function () {
        // https://github.com/kripken/emscripten/pull/1555
        // if (ENVIRONMENT_IS_NODE) {
        //   // currently, FS.init does not distinguish if process.stdin is a file or TTY
        //   // device, it always assumes it's a TTY device. because of this, we're forcing
        //   // process.stdin to UTF8 encoding to at least make stdin reading compatible
        //   // with text files until FS.init can be refactored.
        //   process['stdin']['setEncoding']('utf8');
        // }
      },shutdown:function () {
        // https://github.com/kripken/emscripten/pull/1555
        // if (ENVIRONMENT_IS_NODE) {
        //   // inolen: any idea as to why node -e 'process.stdin.read()' wouldn't exit immediately (with process.stdin being a tty)?
        //   // isaacs: because now it's reading from the stream, you've expressed interest in it, so that read() kicks off a _read() which creates a ReadReq operation
        //   // inolen: I thought read() in that case was a synchronous operation that just grabbed some amount of buffered data if it exists?
        //   // isaacs: it is. but it also triggers a _read() call, which calls readStart() on the handle
        //   // isaacs: do process.stdin.pause() and i'd think it'd probably close the pending call
        //   process['stdin']['pause']();
        // }
      },register:function (dev, ops) {
        TTY.ttys[dev] = { input: [], output: [], ops: ops };
        FS.registerDevice(dev, TTY.stream_ops);
      },stream_ops:{open:function (stream) {
          var tty = TTY.ttys[stream.node.rdev];
          if (!tty) {
            throw new FS.ErrnoError(ERRNO_CODES.ENODEV);
          }
          stream.tty = tty;
          stream.seekable = false;
        },close:function (stream) {
          // flush any pending line data
          stream.tty.ops.flush(stream.tty);
        },flush:function (stream) {
          stream.tty.ops.flush(stream.tty);
        },read:function (stream, buffer, offset, length, pos /* ignored */) {
          if (!stream.tty || !stream.tty.ops.get_char) {
            throw new FS.ErrnoError(ERRNO_CODES.ENXIO);
          }
          var bytesRead = 0;
          for (var i = 0; i < length; i++) {
            var result;
            try {
              result = stream.tty.ops.get_char(stream.tty);
            } catch (e) {
              throw new FS.ErrnoError(ERRNO_CODES.EIO);
            }
            if (result === undefined && bytesRead === 0) {
              throw new FS.ErrnoError(ERRNO_CODES.EAGAIN);
            }
            if (result === null || result === undefined) break;
            bytesRead++;
            buffer[offset+i] = result;
          }
          if (bytesRead) {
            stream.node.timestamp = Date.now();
          }
          return bytesRead;
        },write:function (stream, buffer, offset, length, pos) {
          if (!stream.tty || !stream.tty.ops.put_char) {
            throw new FS.ErrnoError(ERRNO_CODES.ENXIO);
          }
          for (var i = 0; i < length; i++) {
            try {
              stream.tty.ops.put_char(stream.tty, buffer[offset+i]);
            } catch (e) {
              throw new FS.ErrnoError(ERRNO_CODES.EIO);
            }
          }
          if (length) {
            stream.node.timestamp = Date.now();
          }
          return i;
        }},default_tty_ops:{get_char:function (tty) {
          if (!tty.input.length) {
            var result = null;
            if (ENVIRONMENT_IS_NODE) {
              // we will read data by chunks of BUFSIZE
              var BUFSIZE = 256;
              var buf = new Buffer(BUFSIZE);
              var bytesRead = 0;
  
              var fd = process.stdin.fd;
              // Linux and Mac cannot use process.stdin.fd (which isn't set up as sync)
              var usingDevice = false;
              try {
                fd = fs.openSync('/dev/stdin', 'r');
                usingDevice = true;
              } catch (e) {}
  
              bytesRead = fs.readSync(fd, buf, 0, BUFSIZE, null);
  
              if (usingDevice) { fs.closeSync(fd); }
              if (bytesRead > 0) {
                result = buf.slice(0, bytesRead).toString('utf-8');
              } else {
                result = null;
              }
  
            } else if (typeof window != 'undefined' &&
              typeof window.prompt == 'function') {
              // Browser.
              result = window.prompt('Input: ');  // returns null on cancel
              if (result !== null) {
                result += '\n';
              }
            } else if (typeof readline == 'function') {
              // Command line.
              result = readline();
              if (result !== null) {
                result += '\n';
              }
            }
            if (!result) {
              return null;
            }
            tty.input = intArrayFromString(result, true);
          }
          return tty.input.shift();
        },put_char:function (tty, val) {
          if (val === null || val === 10) {
            Module['print'](UTF8ArrayToString(tty.output, 0));
            tty.output = [];
          } else {
            if (val != 0) tty.output.push(val); // val == 0 would cut text output off in the middle.
          }
        },flush:function (tty) {
          if (tty.output && tty.output.length > 0) {
            Module['print'](UTF8ArrayToString(tty.output, 0));
            tty.output = [];
          }
        }},default_tty1_ops:{put_char:function (tty, val) {
          if (val === null || val === 10) {
            Module['printErr'](UTF8ArrayToString(tty.output, 0));
            tty.output = [];
          } else {
            if (val != 0) tty.output.push(val);
          }
        },flush:function (tty) {
          if (tty.output && tty.output.length > 0) {
            Module['printErr'](UTF8ArrayToString(tty.output, 0));
            tty.output = [];
          }
        }}};
  
  var MEMFS={ops_table:null,mount:function (mount) {
        return MEMFS.createNode(null, '/', 16384 | 511 /* 0777 */, 0);
      },createNode:function (parent, name, mode, dev) {
        if (FS.isBlkdev(mode) || FS.isFIFO(mode)) {
          // no supported
          throw new FS.ErrnoError(ERRNO_CODES.EPERM);
        }
        if (!MEMFS.ops_table) {
          MEMFS.ops_table = {
            dir: {
              node: {
                getattr: MEMFS.node_ops.getattr,
                setattr: MEMFS.node_ops.setattr,
                lookup: MEMFS.node_ops.lookup,
                mknod: MEMFS.node_ops.mknod,
                rename: MEMFS.node_ops.rename,
                unlink: MEMFS.node_ops.unlink,
                rmdir: MEMFS.node_ops.rmdir,
                readdir: MEMFS.node_ops.readdir,
                symlink: MEMFS.node_ops.symlink
              },
              stream: {
                llseek: MEMFS.stream_ops.llseek
              }
            },
            file: {
              node: {
                getattr: MEMFS.node_ops.getattr,
                setattr: MEMFS.node_ops.setattr
              },
              stream: {
                llseek: MEMFS.stream_ops.llseek,
                read: MEMFS.stream_ops.read,
                write: MEMFS.stream_ops.write,
                allocate: MEMFS.stream_ops.allocate,
                mmap: MEMFS.stream_ops.mmap,
                msync: MEMFS.stream_ops.msync
              }
            },
            link: {
              node: {
                getattr: MEMFS.node_ops.getattr,
                setattr: MEMFS.node_ops.setattr,
                readlink: MEMFS.node_ops.readlink
              },
              stream: {}
            },
            chrdev: {
              node: {
                getattr: MEMFS.node_ops.getattr,
                setattr: MEMFS.node_ops.setattr
              },
              stream: FS.chrdev_stream_ops
            }
          };
        }
        var node = FS.createNode(parent, name, mode, dev);
        if (FS.isDir(node.mode)) {
          node.node_ops = MEMFS.ops_table.dir.node;
          node.stream_ops = MEMFS.ops_table.dir.stream;
          node.contents = {};
        } else if (FS.isFile(node.mode)) {
          node.node_ops = MEMFS.ops_table.file.node;
          node.stream_ops = MEMFS.ops_table.file.stream;
          node.usedBytes = 0; // The actual number of bytes used in the typed array, as opposed to contents.buffer.byteLength which gives the whole capacity.
          // When the byte data of the file is populated, this will point to either a typed array, or a normal JS array. Typed arrays are preferred
          // for performance, and used by default. However, typed arrays are not resizable like normal JS arrays are, so there is a small disk size
          // penalty involved for appending file writes that continuously grow a file similar to std::vector capacity vs used -scheme.
          node.contents = null; 
        } else if (FS.isLink(node.mode)) {
          node.node_ops = MEMFS.ops_table.link.node;
          node.stream_ops = MEMFS.ops_table.link.stream;
        } else if (FS.isChrdev(node.mode)) {
          node.node_ops = MEMFS.ops_table.chrdev.node;
          node.stream_ops = MEMFS.ops_table.chrdev.stream;
        }
        node.timestamp = Date.now();
        // add the new node to the parent
        if (parent) {
          parent.contents[name] = node;
        }
        return node;
      },getFileDataAsRegularArray:function (node) {
        if (node.contents && node.contents.subarray) {
          var arr = [];
          for (var i = 0; i < node.usedBytes; ++i) arr.push(node.contents[i]);
          return arr; // Returns a copy of the original data.
        }
        return node.contents; // No-op, the file contents are already in a JS array. Return as-is.
      },getFileDataAsTypedArray:function (node) {
        if (!node.contents) return new Uint8Array;
        if (node.contents.subarray) return node.contents.subarray(0, node.usedBytes); // Make sure to not return excess unused bytes.
        return new Uint8Array(node.contents);
      },expandFileStorage:function (node, newCapacity) {
        // If we are asked to expand the size of a file that already exists, revert to using a standard JS array to store the file
        // instead of a typed array. This makes resizing the array more flexible because we can just .push() elements at the back to
        // increase the size.
        if (node.contents && node.contents.subarray && newCapacity > node.contents.length) {
          node.contents = MEMFS.getFileDataAsRegularArray(node);
          node.usedBytes = node.contents.length; // We might be writing to a lazy-loaded file which had overridden this property, so force-reset it.
        }
  
        if (!node.contents || node.contents.subarray) { // Keep using a typed array if creating a new storage, or if old one was a typed array as well.
          var prevCapacity = node.contents ? node.contents.buffer.byteLength : 0;
          if (prevCapacity >= newCapacity) return; // No need to expand, the storage was already large enough.
          // Don't expand strictly to the given requested limit if it's only a very small increase, but instead geometrically grow capacity.
          // For small filesizes (<1MB), perform size*2 geometric increase, but for large sizes, do a much more conservative size*1.125 increase to
          // avoid overshooting the allocation cap by a very large margin.
          var CAPACITY_DOUBLING_MAX = 1024 * 1024;
          newCapacity = Math.max(newCapacity, (prevCapacity * (prevCapacity < CAPACITY_DOUBLING_MAX ? 2.0 : 1.125)) | 0);
          if (prevCapacity != 0) newCapacity = Math.max(newCapacity, 256); // At minimum allocate 256b for each file when expanding.
          var oldContents = node.contents;
          node.contents = new Uint8Array(newCapacity); // Allocate new storage.
          if (node.usedBytes > 0) node.contents.set(oldContents.subarray(0, node.usedBytes), 0); // Copy old data over to the new storage.
          return;
        }
        // Not using a typed array to back the file storage. Use a standard JS array instead.
        if (!node.contents && newCapacity > 0) node.contents = [];
        while (node.contents.length < newCapacity) node.contents.push(0);
      },resizeFileStorage:function (node, newSize) {
        if (node.usedBytes == newSize) return;
        if (newSize == 0) {
          node.contents = null; // Fully decommit when requesting a resize to zero.
          node.usedBytes = 0;
          return;
        }
        if (!node.contents || node.contents.subarray) { // Resize a typed array if that is being used as the backing store.
          var oldContents = node.contents;
          node.contents = new Uint8Array(new ArrayBuffer(newSize)); // Allocate new storage.
          if (oldContents) {
            node.contents.set(oldContents.subarray(0, Math.min(newSize, node.usedBytes))); // Copy old data over to the new storage.
          }
          node.usedBytes = newSize;
          return;
        }
        // Backing with a JS array.
        if (!node.contents) node.contents = [];
        if (node.contents.length > newSize) node.contents.length = newSize;
        else while (node.contents.length < newSize) node.contents.push(0);
        node.usedBytes = newSize;
      },node_ops:{getattr:function (node) {
          var attr = {};
          // device numbers reuse inode numbers.
          attr.dev = FS.isChrdev(node.mode) ? node.id : 1;
          attr.ino = node.id;
          attr.mode = node.mode;
          attr.nlink = 1;
          attr.uid = 0;
          attr.gid = 0;
          attr.rdev = node.rdev;
          if (FS.isDir(node.mode)) {
            attr.size = 4096;
          } else if (FS.isFile(node.mode)) {
            attr.size = node.usedBytes;
          } else if (FS.isLink(node.mode)) {
            attr.size = node.link.length;
          } else {
            attr.size = 0;
          }
          attr.atime = new Date(node.timestamp);
          attr.mtime = new Date(node.timestamp);
          attr.ctime = new Date(node.timestamp);
          // NOTE: In our implementation, st_blocks = Math.ceil(st_size/st_blksize),
          //       but this is not required by the standard.
          attr.blksize = 4096;
          attr.blocks = Math.ceil(attr.size / attr.blksize);
          return attr;
        },setattr:function (node, attr) {
          if (attr.mode !== undefined) {
            node.mode = attr.mode;
          }
          if (attr.timestamp !== undefined) {
            node.timestamp = attr.timestamp;
          }
          if (attr.size !== undefined) {
            MEMFS.resizeFileStorage(node, attr.size);
          }
        },lookup:function (parent, name) {
          throw FS.genericErrors[ERRNO_CODES.ENOENT];
        },mknod:function (parent, name, mode, dev) {
          return MEMFS.createNode(parent, name, mode, dev);
        },rename:function (old_node, new_dir, new_name) {
          // if we're overwriting a directory at new_name, make sure it's empty.
          if (FS.isDir(old_node.mode)) {
            var new_node;
            try {
              new_node = FS.lookupNode(new_dir, new_name);
            } catch (e) {
            }
            if (new_node) {
              for (var i in new_node.contents) {
                throw new FS.ErrnoError(ERRNO_CODES.ENOTEMPTY);
              }
            }
          }
          // do the internal rewiring
          delete old_node.parent.contents[old_node.name];
          old_node.name = new_name;
          new_dir.contents[new_name] = old_node;
          old_node.parent = new_dir;
        },unlink:function (parent, name) {
          delete parent.contents[name];
        },rmdir:function (parent, name) {
          var node = FS.lookupNode(parent, name);
          for (var i in node.contents) {
            throw new FS.ErrnoError(ERRNO_CODES.ENOTEMPTY);
          }
          delete parent.contents[name];
        },readdir:function (node) {
          var entries = ['.', '..']
          for (var key in node.contents) {
            if (!node.contents.hasOwnProperty(key)) {
              continue;
            }
            entries.push(key);
          }
          return entries;
        },symlink:function (parent, newname, oldpath) {
          var node = MEMFS.createNode(parent, newname, 511 /* 0777 */ | 40960, 0);
          node.link = oldpath;
          return node;
        },readlink:function (node) {
          if (!FS.isLink(node.mode)) {
            throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
          }
          return node.link;
        }},stream_ops:{read:function (stream, buffer, offset, length, position) {
          var contents = stream.node.contents;
          if (position >= stream.node.usedBytes) return 0;
          var size = Math.min(stream.node.usedBytes - position, length);
          assert(size >= 0);
          if (size > 8 && contents.subarray) { // non-trivial, and typed array
            buffer.set(contents.subarray(position, position + size), offset);
          } else {
            for (var i = 0; i < size; i++) buffer[offset + i] = contents[position + i];
          }
          return size;
        },write:function (stream, buffer, offset, length, position, canOwn) {
          if (!length) return 0;
          var node = stream.node;
          node.timestamp = Date.now();
  
          if (buffer.subarray && (!node.contents || node.contents.subarray)) { // This write is from a typed array to a typed array?
            if (canOwn) { // Can we just reuse the buffer we are given?
              node.contents = buffer.subarray(offset, offset + length);
              node.usedBytes = length;
              return length;
            } else if (node.usedBytes === 0 && position === 0) { // If this is a simple first write to an empty file, do a fast set since we don't need to care about old data.
              node.contents = new Uint8Array(buffer.subarray(offset, offset + length));
              node.usedBytes = length;
              return length;
            } else if (position + length <= node.usedBytes) { // Writing to an already allocated and used subrange of the file?
              node.contents.set(buffer.subarray(offset, offset + length), position);
              return length;
            }
          }
  
          // Appending to an existing file and we need to reallocate, or source data did not come as a typed array.
          MEMFS.expandFileStorage(node, position+length);
          if (node.contents.subarray && buffer.subarray) node.contents.set(buffer.subarray(offset, offset + length), position); // Use typed array write if available.
          else {
            for (var i = 0; i < length; i++) {
             node.contents[position + i] = buffer[offset + i]; // Or fall back to manual write if not.
            }
          }
          node.usedBytes = Math.max(node.usedBytes, position+length);
          return length;
        },llseek:function (stream, offset, whence) {
          var position = offset;
          if (whence === 1) {  // SEEK_CUR.
            position += stream.position;
          } else if (whence === 2) {  // SEEK_END.
            if (FS.isFile(stream.node.mode)) {
              position += stream.node.usedBytes;
            }
          }
          if (position < 0) {
            throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
          }
          return position;
        },allocate:function (stream, offset, length) {
          MEMFS.expandFileStorage(stream.node, offset + length);
          stream.node.usedBytes = Math.max(stream.node.usedBytes, offset + length);
        },mmap:function (stream, buffer, offset, length, position, prot, flags) {
          if (!FS.isFile(stream.node.mode)) {
            throw new FS.ErrnoError(ERRNO_CODES.ENODEV);
          }
          var ptr;
          var allocated;
          var contents = stream.node.contents;
          // Only make a new copy when MAP_PRIVATE is specified.
          if ( !(flags & 2) &&
                (contents.buffer === buffer || contents.buffer === buffer.buffer) ) {
            // We can't emulate MAP_SHARED when the file is not backed by the buffer
            // we're mapping to (e.g. the HEAP buffer).
            allocated = false;
            ptr = contents.byteOffset;
          } else {
            // Try to avoid unnecessary slices.
            if (position > 0 || position + length < stream.node.usedBytes) {
              if (contents.subarray) {
                contents = contents.subarray(position, position + length);
              } else {
                contents = Array.prototype.slice.call(contents, position, position + length);
              }
            }
            allocated = true;
            ptr = _malloc(length);
            if (!ptr) {
              throw new FS.ErrnoError(ERRNO_CODES.ENOMEM);
            }
            buffer.set(contents, ptr);
          }
          return { ptr: ptr, allocated: allocated };
        },msync:function (stream, buffer, offset, length, mmapFlags) {
          if (!FS.isFile(stream.node.mode)) {
            throw new FS.ErrnoError(ERRNO_CODES.ENODEV);
          }
          if (mmapFlags & 2) {
            // MAP_PRIVATE calls need not to be synced back to underlying fs
            return 0;
          }
  
          var bytesWritten = MEMFS.stream_ops.write(stream, buffer, 0, length, offset, false);
          // should we check if bytesWritten and length are the same?
          return 0;
        }}};
  
  var IDBFS={dbs:{},indexedDB:function () {
        if (typeof indexedDB !== 'undefined') return indexedDB;
        var ret = null;
        if (typeof window === 'object') ret = window.indexedDB || window.mozIndexedDB || window.webkitIndexedDB || window.msIndexedDB;
        assert(ret, 'IDBFS used, but indexedDB not supported');
        return ret;
      },DB_VERSION:21,DB_STORE_NAME:"FILE_DATA",mount:function (mount) {
        // reuse all of the core MEMFS functionality
        return MEMFS.mount.apply(null, arguments);
      },syncfs:function (mount, populate, callback) {
        IDBFS.getLocalSet(mount, function(err, local) {
          if (err) return callback(err);
  
          IDBFS.getRemoteSet(mount, function(err, remote) {
            if (err) return callback(err);
  
            var src = populate ? remote : local;
            var dst = populate ? local : remote;
  
            IDBFS.reconcile(src, dst, callback);
          });
        });
      },getDB:function (name, callback) {
        // check the cache first
        var db = IDBFS.dbs[name];
        if (db) {
          return callback(null, db);
        }
  
        var req;
        try {
          req = IDBFS.indexedDB().open(name, IDBFS.DB_VERSION);
        } catch (e) {
          return callback(e);
        }
        req.onupgradeneeded = function(e) {
          var db = e.target.result;
          var transaction = e.target.transaction;
  
          var fileStore;
  
          if (db.objectStoreNames.contains(IDBFS.DB_STORE_NAME)) {
            fileStore = transaction.objectStore(IDBFS.DB_STORE_NAME);
          } else {
            fileStore = db.createObjectStore(IDBFS.DB_STORE_NAME);
          }
  
          if (!fileStore.indexNames.contains('timestamp')) {
            fileStore.createIndex('timestamp', 'timestamp', { unique: false });
          }
        };
        req.onsuccess = function() {
          db = req.result;
  
          // add to the cache
          IDBFS.dbs[name] = db;
          callback(null, db);
        };
        req.onerror = function(e) {
          callback(this.error);
          e.preventDefault();
        };
      },getLocalSet:function (mount, callback) {
        var entries = {};
  
        function isRealDir(p) {
          return p !== '.' && p !== '..';
        };
        function toAbsolute(root) {
          return function(p) {
            return PATH.join2(root, p);
          }
        };
  
        var check = FS.readdir(mount.mountpoint).filter(isRealDir).map(toAbsolute(mount.mountpoint));
  
        while (check.length) {
          var path = check.pop();
          var stat;
  
          try {
            stat = FS.stat(path);
          } catch (e) {
            return callback(e);
          }
  
          if (FS.isDir(stat.mode)) {
            check.push.apply(check, FS.readdir(path).filter(isRealDir).map(toAbsolute(path)));
          }
  
          entries[path] = { timestamp: stat.mtime };
        }
  
        return callback(null, { type: 'local', entries: entries });
      },getRemoteSet:function (mount, callback) {
        var entries = {};
  
        IDBFS.getDB(mount.mountpoint, function(err, db) {
          if (err) return callback(err);
  
          var transaction = db.transaction([IDBFS.DB_STORE_NAME], 'readonly');
          transaction.onerror = function(e) {
            callback(this.error);
            e.preventDefault();
          };
  
          var store = transaction.objectStore(IDBFS.DB_STORE_NAME);
          var index = store.index('timestamp');
  
          index.openKeyCursor().onsuccess = function(event) {
            var cursor = event.target.result;
  
            if (!cursor) {
              return callback(null, { type: 'remote', db: db, entries: entries });
            }
  
            entries[cursor.primaryKey] = { timestamp: cursor.key };
  
            cursor.continue();
          };
        });
      },loadLocalEntry:function (path, callback) {
        var stat, node;
  
        try {
          var lookup = FS.lookupPath(path);
          node = lookup.node;
          stat = FS.stat(path);
        } catch (e) {
          return callback(e);
        }
  
        if (FS.isDir(stat.mode)) {
          return callback(null, { timestamp: stat.mtime, mode: stat.mode });
        } else if (FS.isFile(stat.mode)) {
          // Performance consideration: storing a normal JavaScript array to a IndexedDB is much slower than storing a typed array.
          // Therefore always convert the file contents to a typed array first before writing the data to IndexedDB.
          node.contents = MEMFS.getFileDataAsTypedArray(node);
          return callback(null, { timestamp: stat.mtime, mode: stat.mode, contents: node.contents });
        } else {
          return callback(new Error('node type not supported'));
        }
      },storeLocalEntry:function (path, entry, callback) {
        try {
          if (FS.isDir(entry.mode)) {
            FS.mkdir(path, entry.mode);
          } else if (FS.isFile(entry.mode)) {
            FS.writeFile(path, entry.contents, { encoding: 'binary', canOwn: true });
          } else {
            return callback(new Error('node type not supported'));
          }
  
          FS.chmod(path, entry.mode);
          FS.utime(path, entry.timestamp, entry.timestamp);
        } catch (e) {
          return callback(e);
        }
  
        callback(null);
      },removeLocalEntry:function (path, callback) {
        try {
          var lookup = FS.lookupPath(path);
          var stat = FS.stat(path);
  
          if (FS.isDir(stat.mode)) {
            FS.rmdir(path);
          } else if (FS.isFile(stat.mode)) {
            FS.unlink(path);
          }
        } catch (e) {
          return callback(e);
        }
  
        callback(null);
      },loadRemoteEntry:function (store, path, callback) {
        var req = store.get(path);
        req.onsuccess = function(event) { callback(null, event.target.result); };
        req.onerror = function(e) {
          callback(this.error);
          e.preventDefault();
        };
      },storeRemoteEntry:function (store, path, entry, callback) {
        var req = store.put(entry, path);
        req.onsuccess = function() { callback(null); };
        req.onerror = function(e) {
          callback(this.error);
          e.preventDefault();
        };
      },removeRemoteEntry:function (store, path, callback) {
        var req = store.delete(path);
        req.onsuccess = function() { callback(null); };
        req.onerror = function(e) {
          callback(this.error);
          e.preventDefault();
        };
      },reconcile:function (src, dst, callback) {
        var total = 0;
  
        var create = [];
        Object.keys(src.entries).forEach(function (key) {
          var e = src.entries[key];
          var e2 = dst.entries[key];
          if (!e2 || e.timestamp > e2.timestamp) {
            create.push(key);
            total++;
          }
        });
  
        var remove = [];
        Object.keys(dst.entries).forEach(function (key) {
          var e = dst.entries[key];
          var e2 = src.entries[key];
          if (!e2) {
            remove.push(key);
            total++;
          }
        });
  
        if (!total) {
          return callback(null);
        }
  
        var errored = false;
        var completed = 0;
        var db = src.type === 'remote' ? src.db : dst.db;
        var transaction = db.transaction([IDBFS.DB_STORE_NAME], 'readwrite');
        var store = transaction.objectStore(IDBFS.DB_STORE_NAME);
  
        function done(err) {
          if (err) {
            if (!done.errored) {
              done.errored = true;
              return callback(err);
            }
            return;
          }
          if (++completed >= total) {
            return callback(null);
          }
        };
  
        transaction.onerror = function(e) {
          done(this.error);
          e.preventDefault();
        };
  
        // sort paths in ascending order so directory entries are created
        // before the files inside them
        create.sort().forEach(function (path) {
          if (dst.type === 'local') {
            IDBFS.loadRemoteEntry(store, path, function (err, entry) {
              if (err) return done(err);
              IDBFS.storeLocalEntry(path, entry, done);
            });
          } else {
            IDBFS.loadLocalEntry(path, function (err, entry) {
              if (err) return done(err);
              IDBFS.storeRemoteEntry(store, path, entry, done);
            });
          }
        });
  
        // sort paths in descending order so files are deleted before their
        // parent directories
        remove.sort().reverse().forEach(function(path) {
          if (dst.type === 'local') {
            IDBFS.removeLocalEntry(path, done);
          } else {
            IDBFS.removeRemoteEntry(store, path, done);
          }
        });
      }};
  
  var NODEFS={isWindows:false,staticInit:function () {
        NODEFS.isWindows = !!process.platform.match(/^win/);
      },mount:function (mount) {
        assert(ENVIRONMENT_IS_NODE);
        return NODEFS.createNode(null, '/', NODEFS.getMode(mount.opts.root), 0);
      },createNode:function (parent, name, mode, dev) {
        if (!FS.isDir(mode) && !FS.isFile(mode) && !FS.isLink(mode)) {
          throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
        }
        var node = FS.createNode(parent, name, mode);
        node.node_ops = NODEFS.node_ops;
        node.stream_ops = NODEFS.stream_ops;
        return node;
      },getMode:function (path) {
        var stat;
        try {
          stat = fs.lstatSync(path);
          if (NODEFS.isWindows) {
            // On Windows, directories return permission bits 'rw-rw-rw-', even though they have 'rwxrwxrwx', so
            // propagate write bits to execute bits.
            stat.mode = stat.mode | ((stat.mode & 146) >> 1);
          }
        } catch (e) {
          if (!e.code) throw e;
          throw new FS.ErrnoError(ERRNO_CODES[e.code]);
        }
        return stat.mode;
      },realPath:function (node) {
        var parts = [];
        while (node.parent !== node) {
          parts.push(node.name);
          node = node.parent;
        }
        parts.push(node.mount.opts.root);
        parts.reverse();
        return PATH.join.apply(null, parts);
      },flagsToPermissionStringMap:{0:"r",1:"r+",2:"r+",64:"r",65:"r+",66:"r+",129:"rx+",193:"rx+",514:"w+",577:"w",578:"w+",705:"wx",706:"wx+",1024:"a",1025:"a",1026:"a+",1089:"a",1090:"a+",1153:"ax",1154:"ax+",1217:"ax",1218:"ax+",4096:"rs",4098:"rs+"},flagsToPermissionString:function (flags) {
        flags &= ~0100000 /*O_LARGEFILE*/; // Ignore this flag from musl, otherwise node.js fails to open the file.
        if (flags in NODEFS.flagsToPermissionStringMap) {
          return NODEFS.flagsToPermissionStringMap[flags];
        } else {
          throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
        }
      },node_ops:{getattr:function (node) {
          var path = NODEFS.realPath(node);
          var stat;
          try {
            stat = fs.lstatSync(path);
          } catch (e) {
            if (!e.code) throw e;
            throw new FS.ErrnoError(ERRNO_CODES[e.code]);
          }
          // node.js v0.10.20 doesn't report blksize and blocks on Windows. Fake them with default blksize of 4096.
          // See http://support.microsoft.com/kb/140365
          if (NODEFS.isWindows && !stat.blksize) {
            stat.blksize = 4096;
          }
          if (NODEFS.isWindows && !stat.blocks) {
            stat.blocks = (stat.size+stat.blksize-1)/stat.blksize|0;
          }
          return {
            dev: stat.dev,
            ino: stat.ino,
            mode: stat.mode,
            nlink: stat.nlink,
            uid: stat.uid,
            gid: stat.gid,
            rdev: stat.rdev,
            size: stat.size,
            atime: stat.atime,
            mtime: stat.mtime,
            ctime: stat.ctime,
            blksize: stat.blksize,
            blocks: stat.blocks
          };
        },setattr:function (node, attr) {
          var path = NODEFS.realPath(node);
          try {
            if (attr.mode !== undefined) {
              fs.chmodSync(path, attr.mode);
              // update the common node structure mode as well
              node.mode = attr.mode;
            }
            if (attr.timestamp !== undefined) {
              var date = new Date(attr.timestamp);
              fs.utimesSync(path, date, date);
            }
            if (attr.size !== undefined) {
              fs.truncateSync(path, attr.size);
            }
          } catch (e) {
            if (!e.code) throw e;
            throw new FS.ErrnoError(ERRNO_CODES[e.code]);
          }
        },lookup:function (parent, name) {
          var path = PATH.join2(NODEFS.realPath(parent), name);
          var mode = NODEFS.getMode(path);
          return NODEFS.createNode(parent, name, mode);
        },mknod:function (parent, name, mode, dev) {
          var node = NODEFS.createNode(parent, name, mode, dev);
          // create the backing node for this in the fs root as well
          var path = NODEFS.realPath(node);
          try {
            if (FS.isDir(node.mode)) {
              fs.mkdirSync(path, node.mode);
            } else {
              fs.writeFileSync(path, '', { mode: node.mode });
            }
          } catch (e) {
            if (!e.code) throw e;
            throw new FS.ErrnoError(ERRNO_CODES[e.code]);
          }
          return node;
        },rename:function (oldNode, newDir, newName) {
          var oldPath = NODEFS.realPath(oldNode);
          var newPath = PATH.join2(NODEFS.realPath(newDir), newName);
          try {
            fs.renameSync(oldPath, newPath);
          } catch (e) {
            if (!e.code) throw e;
            throw new FS.ErrnoError(ERRNO_CODES[e.code]);
          }
        },unlink:function (parent, name) {
          var path = PATH.join2(NODEFS.realPath(parent), name);
          try {
            fs.unlinkSync(path);
          } catch (e) {
            if (!e.code) throw e;
            throw new FS.ErrnoError(ERRNO_CODES[e.code]);
          }
        },rmdir:function (parent, name) {
          var path = PATH.join2(NODEFS.realPath(parent), name);
          try {
            fs.rmdirSync(path);
          } catch (e) {
            if (!e.code) throw e;
            throw new FS.ErrnoError(ERRNO_CODES[e.code]);
          }
        },readdir:function (node) {
          var path = NODEFS.realPath(node);
          try {
            return fs.readdirSync(path);
          } catch (e) {
            if (!e.code) throw e;
            throw new FS.ErrnoError(ERRNO_CODES[e.code]);
          }
        },symlink:function (parent, newName, oldPath) {
          var newPath = PATH.join2(NODEFS.realPath(parent), newName);
          try {
            fs.symlinkSync(oldPath, newPath);
          } catch (e) {
            if (!e.code) throw e;
            throw new FS.ErrnoError(ERRNO_CODES[e.code]);
          }
        },readlink:function (node) {
          var path = NODEFS.realPath(node);
          try {
            path = fs.readlinkSync(path);
            path = NODEJS_PATH.relative(NODEJS_PATH.resolve(node.mount.opts.root), path);
            return path;
          } catch (e) {
            if (!e.code) throw e;
            throw new FS.ErrnoError(ERRNO_CODES[e.code]);
          }
        }},stream_ops:{open:function (stream) {
          var path = NODEFS.realPath(stream.node);
          try {
            if (FS.isFile(stream.node.mode)) {
              stream.nfd = fs.openSync(path, NODEFS.flagsToPermissionString(stream.flags));
            }
          } catch (e) {
            if (!e.code) throw e;
            throw new FS.ErrnoError(ERRNO_CODES[e.code]);
          }
        },close:function (stream) {
          try {
            if (FS.isFile(stream.node.mode) && stream.nfd) {
              fs.closeSync(stream.nfd);
            }
          } catch (e) {
            if (!e.code) throw e;
            throw new FS.ErrnoError(ERRNO_CODES[e.code]);
          }
        },read:function (stream, buffer, offset, length, position) {
          if (length === 0) return 0; // node errors on 0 length reads
          // FIXME this is terrible.
          var nbuffer = new Buffer(length);
          var res;
          try {
            res = fs.readSync(stream.nfd, nbuffer, 0, length, position);
          } catch (e) {
            throw new FS.ErrnoError(ERRNO_CODES[e.code]);
          }
          if (res > 0) {
            for (var i = 0; i < res; i++) {
              buffer[offset + i] = nbuffer[i];
            }
          }
          return res;
        },write:function (stream, buffer, offset, length, position) {
          // FIXME this is terrible.
          var nbuffer = new Buffer(buffer.subarray(offset, offset + length));
          var res;
          try {
            res = fs.writeSync(stream.nfd, nbuffer, 0, length, position);
          } catch (e) {
            throw new FS.ErrnoError(ERRNO_CODES[e.code]);
          }
          return res;
        },llseek:function (stream, offset, whence) {
          var position = offset;
          if (whence === 1) {  // SEEK_CUR.
            position += stream.position;
          } else if (whence === 2) {  // SEEK_END.
            if (FS.isFile(stream.node.mode)) {
              try {
                var stat = fs.fstatSync(stream.nfd);
                position += stat.size;
              } catch (e) {
                throw new FS.ErrnoError(ERRNO_CODES[e.code]);
              }
            }
          }
  
          if (position < 0) {
            throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
          }
  
          return position;
        }}};
  
  var WORKERFS={DIR_MODE:16895,FILE_MODE:33279,reader:null,mount:function (mount) {
        assert(ENVIRONMENT_IS_WORKER);
        if (!WORKERFS.reader) WORKERFS.reader = new FileReaderSync();
        var root = WORKERFS.createNode(null, '/', WORKERFS.DIR_MODE, 0);
        var createdParents = {};
        function ensureParent(path) {
          // return the parent node, creating subdirs as necessary
          var parts = path.split('/');
          var parent = root;
          for (var i = 0; i < parts.length-1; i++) {
            var curr = parts.slice(0, i+1).join('/');
            if (!createdParents[curr]) {
              createdParents[curr] = WORKERFS.createNode(parent, curr, WORKERFS.DIR_MODE, 0);
            }
            parent = createdParents[curr];
          }
          return parent;
        }
        function base(path) {
          var parts = path.split('/');
          return parts[parts.length-1];
        }
        // We also accept FileList here, by using Array.prototype
        Array.prototype.forEach.call(mount.opts["files"] || [], function(file) {
          WORKERFS.createNode(ensureParent(file.name), base(file.name), WORKERFS.FILE_MODE, 0, file, file.lastModifiedDate);
        });
        (mount.opts["blobs"] || []).forEach(function(obj) {
          WORKERFS.createNode(ensureParent(obj["name"]), base(obj["name"]), WORKERFS.FILE_MODE, 0, obj["data"]);
        });
        (mount.opts["packages"] || []).forEach(function(pack) {
          pack['metadata'].files.forEach(function(file) {
            var name = file.filename.substr(1); // remove initial slash
            WORKERFS.createNode(ensureParent(name), base(name), WORKERFS.FILE_MODE, 0, pack['blob'].slice(file.start, file.end));
          });
        });
        return root;
      },createNode:function (parent, name, mode, dev, contents, mtime) {
        var node = FS.createNode(parent, name, mode);
        node.mode = mode;
        node.node_ops = WORKERFS.node_ops;
        node.stream_ops = WORKERFS.stream_ops;
        node.timestamp = (mtime || new Date).getTime();
        assert(WORKERFS.FILE_MODE !== WORKERFS.DIR_MODE);
        if (mode === WORKERFS.FILE_MODE) {
          node.size = contents.size;
          node.contents = contents;
        } else {
          node.size = 4096;
          node.contents = {};
        }
        if (parent) {
          parent.contents[name] = node;
        }
        return node;
      },node_ops:{getattr:function (node) {
          return {
            dev: 1,
            ino: undefined,
            mode: node.mode,
            nlink: 1,
            uid: 0,
            gid: 0,
            rdev: undefined,
            size: node.size,
            atime: new Date(node.timestamp),
            mtime: new Date(node.timestamp),
            ctime: new Date(node.timestamp),
            blksize: 4096,
            blocks: Math.ceil(node.size / 4096),
          };
        },setattr:function (node, attr) {
          if (attr.mode !== undefined) {
            node.mode = attr.mode;
          }
          if (attr.timestamp !== undefined) {
            node.timestamp = attr.timestamp;
          }
        },lookup:function (parent, name) {
          throw new FS.ErrnoError(ERRNO_CODES.ENOENT);
        },mknod:function (parent, name, mode, dev) {
          throw new FS.ErrnoError(ERRNO_CODES.EPERM);
        },rename:function (oldNode, newDir, newName) {
          throw new FS.ErrnoError(ERRNO_CODES.EPERM);
        },unlink:function (parent, name) {
          throw new FS.ErrnoError(ERRNO_CODES.EPERM);
        },rmdir:function (parent, name) {
          throw new FS.ErrnoError(ERRNO_CODES.EPERM);
        },readdir:function (node) {
          throw new FS.ErrnoError(ERRNO_CODES.EPERM);
        },symlink:function (parent, newName, oldPath) {
          throw new FS.ErrnoError(ERRNO_CODES.EPERM);
        },readlink:function (node) {
          throw new FS.ErrnoError(ERRNO_CODES.EPERM);
        }},stream_ops:{read:function (stream, buffer, offset, length, position) {
          if (position >= stream.node.size) return 0;
          var chunk = stream.node.contents.slice(position, position + length);
          var ab = WORKERFS.reader.readAsArrayBuffer(chunk);
          buffer.set(new Uint8Array(ab), offset);
          return chunk.size;
        },write:function (stream, buffer, offset, length, position) {
          throw new FS.ErrnoError(ERRNO_CODES.EIO);
        },llseek:function (stream, offset, whence) {
          var position = offset;
          if (whence === 1) {  // SEEK_CUR.
            position += stream.position;
          } else if (whence === 2) {  // SEEK_END.
            if (FS.isFile(stream.node.mode)) {
              position += stream.node.size;
            }
          }
          if (position < 0) {
            throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
          }
          return position;
        }}};
  
  var _stdin=allocate(1, "i32*", ALLOC_STATIC);
  
  var _stdout=allocate(1, "i32*", ALLOC_STATIC);
  
  var _stderr=allocate(1, "i32*", ALLOC_STATIC);var FS={root:null,mounts:[],devices:[null],streams:[],nextInode:1,nameTable:null,currentPath:"/",initialized:false,ignorePermissions:true,trackingDelegate:{},tracking:{openFlags:{READ:1,WRITE:2}},ErrnoError:null,genericErrors:{},filesystems:null,handleFSError:function (e) {
        if (!(e instanceof FS.ErrnoError)) throw e + ' : ' + stackTrace();
        return ___setErrNo(e.errno);
      },lookupPath:function (path, opts) {
        path = PATH.resolve(FS.cwd(), path);
        opts = opts || {};
  
        if (!path) return { path: '', node: null };
  
        var defaults = {
          follow_mount: true,
          recurse_count: 0
        };
        for (var key in defaults) {
          if (opts[key] === undefined) {
            opts[key] = defaults[key];
          }
        }
  
        if (opts.recurse_count > 8) {  // max recursive lookup of 8
          throw new FS.ErrnoError(ERRNO_CODES.ELOOP);
        }
  
        // split the path
        var parts = PATH.normalizeArray(path.split('/').filter(function(p) {
          return !!p;
        }), false);
  
        // start at the root
        var current = FS.root;
        var current_path = '/';
  
        for (var i = 0; i < parts.length; i++) {
          var islast = (i === parts.length-1);
          if (islast && opts.parent) {
            // stop resolving
            break;
          }
  
          current = FS.lookupNode(current, parts[i]);
          current_path = PATH.join2(current_path, parts[i]);
  
          // jump to the mount's root node if this is a mountpoint
          if (FS.isMountpoint(current)) {
            if (!islast || (islast && opts.follow_mount)) {
              current = current.mounted.root;
            }
          }
  
          // by default, lookupPath will not follow a symlink if it is the final path component.
          // setting opts.follow = true will override this behavior.
          if (!islast || opts.follow) {
            var count = 0;
            while (FS.isLink(current.mode)) {
              var link = FS.readlink(current_path);
              current_path = PATH.resolve(PATH.dirname(current_path), link);
  
              var lookup = FS.lookupPath(current_path, { recurse_count: opts.recurse_count });
              current = lookup.node;
  
              if (count++ > 40) {  // limit max consecutive symlinks to 40 (SYMLOOP_MAX).
                throw new FS.ErrnoError(ERRNO_CODES.ELOOP);
              }
            }
          }
        }
  
        return { path: current_path, node: current };
      },getPath:function (node) {
        var path;
        while (true) {
          if (FS.isRoot(node)) {
            var mount = node.mount.mountpoint;
            if (!path) return mount;
            return mount[mount.length-1] !== '/' ? mount + '/' + path : mount + path;
          }
          path = path ? node.name + '/' + path : node.name;
          node = node.parent;
        }
      },hashName:function (parentid, name) {
        var hash = 0;
  
  
        for (var i = 0; i < name.length; i++) {
          hash = ((hash << 5) - hash + name.charCodeAt(i)) | 0;
        }
        return ((parentid + hash) >>> 0) % FS.nameTable.length;
      },hashAddNode:function (node) {
        var hash = FS.hashName(node.parent.id, node.name);
        node.name_next = FS.nameTable[hash];
        FS.nameTable[hash] = node;
      },hashRemoveNode:function (node) {
        var hash = FS.hashName(node.parent.id, node.name);
        if (FS.nameTable[hash] === node) {
          FS.nameTable[hash] = node.name_next;
        } else {
          var current = FS.nameTable[hash];
          while (current) {
            if (current.name_next === node) {
              current.name_next = node.name_next;
              break;
            }
            current = current.name_next;
          }
        }
      },lookupNode:function (parent, name) {
        var err = FS.mayLookup(parent);
        if (err) {
          throw new FS.ErrnoError(err, parent);
        }
        var hash = FS.hashName(parent.id, name);
        for (var node = FS.nameTable[hash]; node; node = node.name_next) {
          var nodeName = node.name;
          if (node.parent.id === parent.id && nodeName === name) {
            return node;
          }
        }
        // if we failed to find it in the cache, call into the VFS
        return FS.lookup(parent, name);
      },createNode:function (parent, name, mode, rdev) {
        if (!FS.FSNode) {
          FS.FSNode = function(parent, name, mode, rdev) {
            if (!parent) {
              parent = this;  // root node sets parent to itself
            }
            this.parent = parent;
            this.mount = parent.mount;
            this.mounted = null;
            this.id = FS.nextInode++;
            this.name = name;
            this.mode = mode;
            this.node_ops = {};
            this.stream_ops = {};
            this.rdev = rdev;
          };
  
          FS.FSNode.prototype = {};
  
          // compatibility
          var readMode = 292 | 73;
          var writeMode = 146;
  
          // NOTE we must use Object.defineProperties instead of individual calls to
          // Object.defineProperty in order to make closure compiler happy
          Object.defineProperties(FS.FSNode.prototype, {
            read: {
              get: function() { return (this.mode & readMode) === readMode; },
              set: function(val) { val ? this.mode |= readMode : this.mode &= ~readMode; }
            },
            write: {
              get: function() { return (this.mode & writeMode) === writeMode; },
              set: function(val) { val ? this.mode |= writeMode : this.mode &= ~writeMode; }
            },
            isFolder: {
              get: function() { return FS.isDir(this.mode); }
            },
            isDevice: {
              get: function() { return FS.isChrdev(this.mode); }
            }
          });
        }
  
        var node = new FS.FSNode(parent, name, mode, rdev);
  
        FS.hashAddNode(node);
  
        return node;
      },destroyNode:function (node) {
        FS.hashRemoveNode(node);
      },isRoot:function (node) {
        return node === node.parent;
      },isMountpoint:function (node) {
        return !!node.mounted;
      },isFile:function (mode) {
        return (mode & 61440) === 32768;
      },isDir:function (mode) {
        return (mode & 61440) === 16384;
      },isLink:function (mode) {
        return (mode & 61440) === 40960;
      },isChrdev:function (mode) {
        return (mode & 61440) === 8192;
      },isBlkdev:function (mode) {
        return (mode & 61440) === 24576;
      },isFIFO:function (mode) {
        return (mode & 61440) === 4096;
      },isSocket:function (mode) {
        return (mode & 49152) === 49152;
      },flagModes:{"r":0,"rs":1052672,"r+":2,"w":577,"wx":705,"xw":705,"w+":578,"wx+":706,"xw+":706,"a":1089,"ax":1217,"xa":1217,"a+":1090,"ax+":1218,"xa+":1218},modeStringToFlags:function (str) {
        var flags = FS.flagModes[str];
        if (typeof flags === 'undefined') {
          throw new Error('Unknown file open mode: ' + str);
        }
        return flags;
      },flagsToPermissionString:function (flag) {
        var perms = ['r', 'w', 'rw'][flag & 3];
        if ((flag & 512)) {
          perms += 'w';
        }
        return perms;
      },nodePermissions:function (node, perms) {
        if (FS.ignorePermissions) {
          return 0;
        }
        // return 0 if any user, group or owner bits are set.
        if (perms.indexOf('r') !== -1 && !(node.mode & 292)) {
          return ERRNO_CODES.EACCES;
        } else if (perms.indexOf('w') !== -1 && !(node.mode & 146)) {
          return ERRNO_CODES.EACCES;
        } else if (perms.indexOf('x') !== -1 && !(node.mode & 73)) {
          return ERRNO_CODES.EACCES;
        }
        return 0;
      },mayLookup:function (dir) {
        var err = FS.nodePermissions(dir, 'x');
        if (err) return err;
        if (!dir.node_ops.lookup) return ERRNO_CODES.EACCES;
        return 0;
      },mayCreate:function (dir, name) {
        try {
          var node = FS.lookupNode(dir, name);
          return ERRNO_CODES.EEXIST;
        } catch (e) {
        }
        return FS.nodePermissions(dir, 'wx');
      },mayDelete:function (dir, name, isdir) {
        var node;
        try {
          node = FS.lookupNode(dir, name);
        } catch (e) {
          return e.errno;
        }
        var err = FS.nodePermissions(dir, 'wx');
        if (err) {
          return err;
        }
        if (isdir) {
          if (!FS.isDir(node.mode)) {
            return ERRNO_CODES.ENOTDIR;
          }
          if (FS.isRoot(node) || FS.getPath(node) === FS.cwd()) {
            return ERRNO_CODES.EBUSY;
          }
        } else {
          if (FS.isDir(node.mode)) {
            return ERRNO_CODES.EISDIR;
          }
        }
        return 0;
      },mayOpen:function (node, flags) {
        if (!node) {
          return ERRNO_CODES.ENOENT;
        }
        if (FS.isLink(node.mode)) {
          return ERRNO_CODES.ELOOP;
        } else if (FS.isDir(node.mode)) {
          if ((flags & 2097155) !== 0 ||  // opening for write
              (flags & 512)) {
            return ERRNO_CODES.EISDIR;
          }
        }
        return FS.nodePermissions(node, FS.flagsToPermissionString(flags));
      },MAX_OPEN_FDS:4096,nextfd:function (fd_start, fd_end) {
        fd_start = fd_start || 0;
        fd_end = fd_end || FS.MAX_OPEN_FDS;
        for (var fd = fd_start; fd <= fd_end; fd++) {
          if (!FS.streams[fd]) {
            return fd;
          }
        }
        throw new FS.ErrnoError(ERRNO_CODES.EMFILE);
      },getStream:function (fd) {
        return FS.streams[fd];
      },createStream:function (stream, fd_start, fd_end) {
        if (!FS.FSStream) {
          FS.FSStream = function(){};
          FS.FSStream.prototype = {};
          // compatibility
          Object.defineProperties(FS.FSStream.prototype, {
            object: {
              get: function() { return this.node; },
              set: function(val) { this.node = val; }
            },
            isRead: {
              get: function() { return (this.flags & 2097155) !== 1; }
            },
            isWrite: {
              get: function() { return (this.flags & 2097155) !== 0; }
            },
            isAppend: {
              get: function() { return (this.flags & 1024); }
            }
          });
        }
        // clone it, so we can return an instance of FSStream
        var newStream = new FS.FSStream();
        for (var p in stream) {
          newStream[p] = stream[p];
        }
        stream = newStream;
        var fd = FS.nextfd(fd_start, fd_end);
        stream.fd = fd;
        FS.streams[fd] = stream;
        return stream;
      },closeStream:function (fd) {
        FS.streams[fd] = null;
      },chrdev_stream_ops:{open:function (stream) {
          var device = FS.getDevice(stream.node.rdev);
          // override node's stream ops with the device's
          stream.stream_ops = device.stream_ops;
          // forward the open call
          if (stream.stream_ops.open) {
            stream.stream_ops.open(stream);
          }
        },llseek:function () {
          throw new FS.ErrnoError(ERRNO_CODES.ESPIPE);
        }},major:function (dev) {
        return ((dev) >> 8);
      },minor:function (dev) {
        return ((dev) & 0xff);
      },makedev:function (ma, mi) {
        return ((ma) << 8 | (mi));
      },registerDevice:function (dev, ops) {
        FS.devices[dev] = { stream_ops: ops };
      },getDevice:function (dev) {
        return FS.devices[dev];
      },getMounts:function (mount) {
        var mounts = [];
        var check = [mount];
  
        while (check.length) {
          var m = check.pop();
  
          mounts.push(m);
  
          check.push.apply(check, m.mounts);
        }
  
        return mounts;
      },syncfs:function (populate, callback) {
        if (typeof(populate) === 'function') {
          callback = populate;
          populate = false;
        }
  
        var mounts = FS.getMounts(FS.root.mount);
        var completed = 0;
  
        function done(err) {
          if (err) {
            if (!done.errored) {
              done.errored = true;
              return callback(err);
            }
            return;
          }
          if (++completed >= mounts.length) {
            callback(null);
          }
        };
  
        // sync all mounts
        mounts.forEach(function (mount) {
          if (!mount.type.syncfs) {
            return done(null);
          }
          mount.type.syncfs(mount, populate, done);
        });
      },mount:function (type, opts, mountpoint) {
        var root = mountpoint === '/';
        var pseudo = !mountpoint;
        var node;
  
        if (root && FS.root) {
          throw new FS.ErrnoError(ERRNO_CODES.EBUSY);
        } else if (!root && !pseudo) {
          var lookup = FS.lookupPath(mountpoint, { follow_mount: false });
  
          mountpoint = lookup.path;  // use the absolute path
          node = lookup.node;
  
          if (FS.isMountpoint(node)) {
            throw new FS.ErrnoError(ERRNO_CODES.EBUSY);
          }
  
          if (!FS.isDir(node.mode)) {
            throw new FS.ErrnoError(ERRNO_CODES.ENOTDIR);
          }
        }
  
        var mount = {
          type: type,
          opts: opts,
          mountpoint: mountpoint,
          mounts: []
        };
  
        // create a root node for the fs
        var mountRoot = type.mount(mount);
        mountRoot.mount = mount;
        mount.root = mountRoot;
  
        if (root) {
          FS.root = mountRoot;
        } else if (node) {
          // set as a mountpoint
          node.mounted = mount;
  
          // add the new mount to the current mount's children
          if (node.mount) {
            node.mount.mounts.push(mount);
          }
        }
  
        return mountRoot;
      },unmount:function (mountpoint) {
        var lookup = FS.lookupPath(mountpoint, { follow_mount: false });
  
        if (!FS.isMountpoint(lookup.node)) {
          throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
        }
  
        // destroy the nodes for this mount, and all its child mounts
        var node = lookup.node;
        var mount = node.mounted;
        var mounts = FS.getMounts(mount);
  
        Object.keys(FS.nameTable).forEach(function (hash) {
          var current = FS.nameTable[hash];
  
          while (current) {
            var next = current.name_next;
  
            if (mounts.indexOf(current.mount) !== -1) {
              FS.destroyNode(current);
            }
  
            current = next;
          }
        });
  
        // no longer a mountpoint
        node.mounted = null;
  
        // remove this mount from the child mounts
        var idx = node.mount.mounts.indexOf(mount);
        assert(idx !== -1);
        node.mount.mounts.splice(idx, 1);
      },lookup:function (parent, name) {
        return parent.node_ops.lookup(parent, name);
      },mknod:function (path, mode, dev) {
        var lookup = FS.lookupPath(path, { parent: true });
        var parent = lookup.node;
        var name = PATH.basename(path);
        if (!name || name === '.' || name === '..') {
          throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
        }
        var err = FS.mayCreate(parent, name);
        if (err) {
          throw new FS.ErrnoError(err);
        }
        if (!parent.node_ops.mknod) {
          throw new FS.ErrnoError(ERRNO_CODES.EPERM);
        }
        return parent.node_ops.mknod(parent, name, mode, dev);
      },create:function (path, mode) {
        mode = mode !== undefined ? mode : 438 /* 0666 */;
        mode &= 4095;
        mode |= 32768;
        return FS.mknod(path, mode, 0);
      },mkdir:function (path, mode) {
        mode = mode !== undefined ? mode : 511 /* 0777 */;
        mode &= 511 | 512;
        mode |= 16384;
        return FS.mknod(path, mode, 0);
      },mkdev:function (path, mode, dev) {
        if (typeof(dev) === 'undefined') {
          dev = mode;
          mode = 438 /* 0666 */;
        }
        mode |= 8192;
        return FS.mknod(path, mode, dev);
      },symlink:function (oldpath, newpath) {
        if (!PATH.resolve(oldpath)) {
          throw new FS.ErrnoError(ERRNO_CODES.ENOENT);
        }
        var lookup = FS.lookupPath(newpath, { parent: true });
        var parent = lookup.node;
        if (!parent) {
          throw new FS.ErrnoError(ERRNO_CODES.ENOENT);
        }
        var newname = PATH.basename(newpath);
        var err = FS.mayCreate(parent, newname);
        if (err) {
          throw new FS.ErrnoError(err);
        }
        if (!parent.node_ops.symlink) {
          throw new FS.ErrnoError(ERRNO_CODES.EPERM);
        }
        return parent.node_ops.symlink(parent, newname, oldpath);
      },rename:function (old_path, new_path) {
        var old_dirname = PATH.dirname(old_path);
        var new_dirname = PATH.dirname(new_path);
        var old_name = PATH.basename(old_path);
        var new_name = PATH.basename(new_path);
        // parents must exist
        var lookup, old_dir, new_dir;
        try {
          lookup = FS.lookupPath(old_path, { parent: true });
          old_dir = lookup.node;
          lookup = FS.lookupPath(new_path, { parent: true });
          new_dir = lookup.node;
        } catch (e) {
          throw new FS.ErrnoError(ERRNO_CODES.EBUSY);
        }
        if (!old_dir || !new_dir) throw new FS.ErrnoError(ERRNO_CODES.ENOENT);
        // need to be part of the same mount
        if (old_dir.mount !== new_dir.mount) {
          throw new FS.ErrnoError(ERRNO_CODES.EXDEV);
        }
        // source must exist
        var old_node = FS.lookupNode(old_dir, old_name);
        // old path should not be an ancestor of the new path
        var relative = PATH.relative(old_path, new_dirname);
        if (relative.charAt(0) !== '.') {
          throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
        }
        // new path should not be an ancestor of the old path
        relative = PATH.relative(new_path, old_dirname);
        if (relative.charAt(0) !== '.') {
          throw new FS.ErrnoError(ERRNO_CODES.ENOTEMPTY);
        }
        // see if the new path already exists
        var new_node;
        try {
          new_node = FS.lookupNode(new_dir, new_name);
        } catch (e) {
          // not fatal
        }
        // early out if nothing needs to change
        if (old_node === new_node) {
          return;
        }
        // we'll need to delete the old entry
        var isdir = FS.isDir(old_node.mode);
        var err = FS.mayDelete(old_dir, old_name, isdir);
        if (err) {
          throw new FS.ErrnoError(err);
        }
        // need delete permissions if we'll be overwriting.
        // need create permissions if new doesn't already exist.
        err = new_node ?
          FS.mayDelete(new_dir, new_name, isdir) :
          FS.mayCreate(new_dir, new_name);
        if (err) {
          throw new FS.ErrnoError(err);
        }
        if (!old_dir.node_ops.rename) {
          throw new FS.ErrnoError(ERRNO_CODES.EPERM);
        }
        if (FS.isMountpoint(old_node) || (new_node && FS.isMountpoint(new_node))) {
          throw new FS.ErrnoError(ERRNO_CODES.EBUSY);
        }
        // if we are going to change the parent, check write permissions
        if (new_dir !== old_dir) {
          err = FS.nodePermissions(old_dir, 'w');
          if (err) {
            throw new FS.ErrnoError(err);
          }
        }
        try {
          if (FS.trackingDelegate['willMovePath']) {
            FS.trackingDelegate['willMovePath'](old_path, new_path);
          }
        } catch(e) {
          console.log("FS.trackingDelegate['willMovePath']('"+old_path+"', '"+new_path+"') threw an exception: " + e.message);
        }
        // remove the node from the lookup hash
        FS.hashRemoveNode(old_node);
        // do the underlying fs rename
        try {
          old_dir.node_ops.rename(old_node, new_dir, new_name);
        } catch (e) {
          throw e;
        } finally {
          // add the node back to the hash (in case node_ops.rename
          // changed its name)
          FS.hashAddNode(old_node);
        }
        try {
          if (FS.trackingDelegate['onMovePath']) FS.trackingDelegate['onMovePath'](old_path, new_path);
        } catch(e) {
          console.log("FS.trackingDelegate['onMovePath']('"+old_path+"', '"+new_path+"') threw an exception: " + e.message);
        }
      },rmdir:function (path) {
        var lookup = FS.lookupPath(path, { parent: true });
        var parent = lookup.node;
        var name = PATH.basename(path);
        var node = FS.lookupNode(parent, name);
        var err = FS.mayDelete(parent, name, true);
        if (err) {
          throw new FS.ErrnoError(err);
        }
        if (!parent.node_ops.rmdir) {
          throw new FS.ErrnoError(ERRNO_CODES.EPERM);
        }
        if (FS.isMountpoint(node)) {
          throw new FS.ErrnoError(ERRNO_CODES.EBUSY);
        }
        try {
          if (FS.trackingDelegate['willDeletePath']) {
            FS.trackingDelegate['willDeletePath'](path);
          }
        } catch(e) {
          console.log("FS.trackingDelegate['willDeletePath']('"+path+"') threw an exception: " + e.message);
        }
        parent.node_ops.rmdir(parent, name);
        FS.destroyNode(node);
        try {
          if (FS.trackingDelegate['onDeletePath']) FS.trackingDelegate['onDeletePath'](path);
        } catch(e) {
          console.log("FS.trackingDelegate['onDeletePath']('"+path+"') threw an exception: " + e.message);
        }
      },readdir:function (path) {
        var lookup = FS.lookupPath(path, { follow: true });
        var node = lookup.node;
        if (!node.node_ops.readdir) {
          throw new FS.ErrnoError(ERRNO_CODES.ENOTDIR);
        }
        return node.node_ops.readdir(node);
      },unlink:function (path) {
        var lookup = FS.lookupPath(path, { parent: true });
        var parent = lookup.node;
        var name = PATH.basename(path);
        var node = FS.lookupNode(parent, name);
        var err = FS.mayDelete(parent, name, false);
        if (err) {
          // POSIX says unlink should set EPERM, not EISDIR
          if (err === ERRNO_CODES.EISDIR) err = ERRNO_CODES.EPERM;
          throw new FS.ErrnoError(err);
        }
        if (!parent.node_ops.unlink) {
          throw new FS.ErrnoError(ERRNO_CODES.EPERM);
        }
        if (FS.isMountpoint(node)) {
          throw new FS.ErrnoError(ERRNO_CODES.EBUSY);
        }
        try {
          if (FS.trackingDelegate['willDeletePath']) {
            FS.trackingDelegate['willDeletePath'](path);
          }
        } catch(e) {
          console.log("FS.trackingDelegate['willDeletePath']('"+path+"') threw an exception: " + e.message);
        }
        parent.node_ops.unlink(parent, name);
        FS.destroyNode(node);
        try {
          if (FS.trackingDelegate['onDeletePath']) FS.trackingDelegate['onDeletePath'](path);
        } catch(e) {
          console.log("FS.trackingDelegate['onDeletePath']('"+path+"') threw an exception: " + e.message);
        }
      },readlink:function (path) {
        var lookup = FS.lookupPath(path);
        var link = lookup.node;
        if (!link) {
          throw new FS.ErrnoError(ERRNO_CODES.ENOENT);
        }
        if (!link.node_ops.readlink) {
          throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
        }
        return PATH.resolve(FS.getPath(link.parent), link.node_ops.readlink(link));
      },stat:function (path, dontFollow) {
        var lookup = FS.lookupPath(path, { follow: !dontFollow });
        var node = lookup.node;
        if (!node) {
          throw new FS.ErrnoError(ERRNO_CODES.ENOENT);
        }
        if (!node.node_ops.getattr) {
          throw new FS.ErrnoError(ERRNO_CODES.EPERM);
        }
        return node.node_ops.getattr(node);
      },lstat:function (path) {
        return FS.stat(path, true);
      },chmod:function (path, mode, dontFollow) {
        var node;
        if (typeof path === 'string') {
          var lookup = FS.lookupPath(path, { follow: !dontFollow });
          node = lookup.node;
        } else {
          node = path;
        }
        if (!node.node_ops.setattr) {
          throw new FS.ErrnoError(ERRNO_CODES.EPERM);
        }
        node.node_ops.setattr(node, {
          mode: (mode & 4095) | (node.mode & ~4095),
          timestamp: Date.now()
        });
      },lchmod:function (path, mode) {
        FS.chmod(path, mode, true);
      },fchmod:function (fd, mode) {
        var stream = FS.getStream(fd);
        if (!stream) {
          throw new FS.ErrnoError(ERRNO_CODES.EBADF);
        }
        FS.chmod(stream.node, mode);
      },chown:function (path, uid, gid, dontFollow) {
        var node;
        if (typeof path === 'string') {
          var lookup = FS.lookupPath(path, { follow: !dontFollow });
          node = lookup.node;
        } else {
          node = path;
        }
        if (!node.node_ops.setattr) {
          throw new FS.ErrnoError(ERRNO_CODES.EPERM);
        }
        node.node_ops.setattr(node, {
          timestamp: Date.now()
          // we ignore the uid / gid for now
        });
      },lchown:function (path, uid, gid) {
        FS.chown(path, uid, gid, true);
      },fchown:function (fd, uid, gid) {
        var stream = FS.getStream(fd);
        if (!stream) {
          throw new FS.ErrnoError(ERRNO_CODES.EBADF);
        }
        FS.chown(stream.node, uid, gid);
      },truncate:function (path, len) {
        if (len < 0) {
          throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
        }
        var node;
        if (typeof path === 'string') {
          var lookup = FS.lookupPath(path, { follow: true });
          node = lookup.node;
        } else {
          node = path;
        }
        if (!node.node_ops.setattr) {
          throw new FS.ErrnoError(ERRNO_CODES.EPERM);
        }
        if (FS.isDir(node.mode)) {
          throw new FS.ErrnoError(ERRNO_CODES.EISDIR);
        }
        if (!FS.isFile(node.mode)) {
          throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
        }
        var err = FS.nodePermissions(node, 'w');
        if (err) {
          throw new FS.ErrnoError(err);
        }
        node.node_ops.setattr(node, {
          size: len,
          timestamp: Date.now()
        });
      },ftruncate:function (fd, len) {
        var stream = FS.getStream(fd);
        if (!stream) {
          throw new FS.ErrnoError(ERRNO_CODES.EBADF);
        }
        if ((stream.flags & 2097155) === 0) {
          throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
        }
        FS.truncate(stream.node, len);
      },utime:function (path, atime, mtime) {
        var lookup = FS.lookupPath(path, { follow: true });
        var node = lookup.node;
        node.node_ops.setattr(node, {
          timestamp: Math.max(atime, mtime)
        });
      },open:function (path, flags, mode, fd_start, fd_end) {
        if (path === "") {
          throw new FS.ErrnoError(ERRNO_CODES.ENOENT);
        }
        flags = typeof flags === 'string' ? FS.modeStringToFlags(flags) : flags;
        mode = typeof mode === 'undefined' ? 438 /* 0666 */ : mode;
        if ((flags & 64)) {
          mode = (mode & 4095) | 32768;
        } else {
          mode = 0;
        }
        var node;
        if (typeof path === 'object') {
          node = path;
        } else {
          path = PATH.normalize(path);
          try {
            var lookup = FS.lookupPath(path, {
              follow: !(flags & 131072)
            });
            node = lookup.node;
          } catch (e) {
            // ignore
          }
        }
        // perhaps we need to create the node
        var created = false;
        if ((flags & 64)) {
          if (node) {
            // if O_CREAT and O_EXCL are set, error out if the node already exists
            if ((flags & 128)) {
              throw new FS.ErrnoError(ERRNO_CODES.EEXIST);
            }
          } else {
            // node doesn't exist, try to create it
            node = FS.mknod(path, mode, 0);
            created = true;
          }
        }
        if (!node) {
          throw new FS.ErrnoError(ERRNO_CODES.ENOENT);
        }
        // can't truncate a device
        if (FS.isChrdev(node.mode)) {
          flags &= ~512;
        }
        // if asked only for a directory, then this must be one
        if ((flags & 65536) && !FS.isDir(node.mode)) {
          throw new FS.ErrnoError(ERRNO_CODES.ENOTDIR);
        }
        // check permissions, if this is not a file we just created now (it is ok to
        // create and write to a file with read-only permissions; it is read-only
        // for later use)
        if (!created) {
          var err = FS.mayOpen(node, flags);
          if (err) {
            throw new FS.ErrnoError(err);
          }
        }
        // do truncation if necessary
        if ((flags & 512)) {
          FS.truncate(node, 0);
        }
        // we've already handled these, don't pass down to the underlying vfs
        flags &= ~(128 | 512);
  
        // register the stream with the filesystem
        var stream = FS.createStream({
          node: node,
          path: FS.getPath(node),  // we want the absolute path to the node
          flags: flags,
          seekable: true,
          position: 0,
          stream_ops: node.stream_ops,
          // used by the file family libc calls (fopen, fwrite, ferror, etc.)
          ungotten: [],
          error: false
        }, fd_start, fd_end);
        // call the new stream's open function
        if (stream.stream_ops.open) {
          stream.stream_ops.open(stream);
        }
        if (Module['logReadFiles'] && !(flags & 1)) {
          if (!FS.readFiles) FS.readFiles = {};
          if (!(path in FS.readFiles)) {
            FS.readFiles[path] = 1;
            Module['printErr']('read file: ' + path);
          }
        }
        try {
          if (FS.trackingDelegate['onOpenFile']) {
            var trackingFlags = 0;
            if ((flags & 2097155) !== 1) {
              trackingFlags |= FS.tracking.openFlags.READ;
            }
            if ((flags & 2097155) !== 0) {
              trackingFlags |= FS.tracking.openFlags.WRITE;
            }
            FS.trackingDelegate['onOpenFile'](path, trackingFlags);
          }
        } catch(e) {
          console.log("FS.trackingDelegate['onOpenFile']('"+path+"', flags) threw an exception: " + e.message);
        }
        return stream;
      },close:function (stream) {
        if (stream.getdents) stream.getdents = null; // free readdir state
        try {
          if (stream.stream_ops.close) {
            stream.stream_ops.close(stream);
          }
        } catch (e) {
          throw e;
        } finally {
          FS.closeStream(stream.fd);
        }
      },llseek:function (stream, offset, whence) {
        if (!stream.seekable || !stream.stream_ops.llseek) {
          throw new FS.ErrnoError(ERRNO_CODES.ESPIPE);
        }
        stream.position = stream.stream_ops.llseek(stream, offset, whence);
        stream.ungotten = [];
        return stream.position;
      },read:function (stream, buffer, offset, length, position) {
        if (length < 0 || position < 0) {
          throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
        }
        if ((stream.flags & 2097155) === 1) {
          throw new FS.ErrnoError(ERRNO_CODES.EBADF);
        }
        if (FS.isDir(stream.node.mode)) {
          throw new FS.ErrnoError(ERRNO_CODES.EISDIR);
        }
        if (!stream.stream_ops.read) {
          throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
        }
        var seeking = true;
        if (typeof position === 'undefined') {
          position = stream.position;
          seeking = false;
        } else if (!stream.seekable) {
          throw new FS.ErrnoError(ERRNO_CODES.ESPIPE);
        }
        var bytesRead = stream.stream_ops.read(stream, buffer, offset, length, position);
        if (!seeking) stream.position += bytesRead;
        return bytesRead;
      },write:function (stream, buffer, offset, length, position, canOwn) {
        if (length < 0 || position < 0) {
          throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
        }
        if ((stream.flags & 2097155) === 0) {
          throw new FS.ErrnoError(ERRNO_CODES.EBADF);
        }
        if (FS.isDir(stream.node.mode)) {
          throw new FS.ErrnoError(ERRNO_CODES.EISDIR);
        }
        if (!stream.stream_ops.write) {
          throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
        }
        if (stream.flags & 1024) {
          // seek to the end before writing in append mode
          FS.llseek(stream, 0, 2);
        }
        var seeking = true;
        if (typeof position === 'undefined') {
          position = stream.position;
          seeking = false;
        } else if (!stream.seekable) {
          throw new FS.ErrnoError(ERRNO_CODES.ESPIPE);
        }
        var bytesWritten = stream.stream_ops.write(stream, buffer, offset, length, position, canOwn);
        if (!seeking) stream.position += bytesWritten;
        try {
          if (stream.path && FS.trackingDelegate['onWriteToFile']) FS.trackingDelegate['onWriteToFile'](stream.path);
        } catch(e) {
          console.log("FS.trackingDelegate['onWriteToFile']('"+path+"') threw an exception: " + e.message);
        }
        return bytesWritten;
      },allocate:function (stream, offset, length) {
        if (offset < 0 || length <= 0) {
          throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
        }
        if ((stream.flags & 2097155) === 0) {
          throw new FS.ErrnoError(ERRNO_CODES.EBADF);
        }
        if (!FS.isFile(stream.node.mode) && !FS.isDir(node.mode)) {
          throw new FS.ErrnoError(ERRNO_CODES.ENODEV);
        }
        if (!stream.stream_ops.allocate) {
          throw new FS.ErrnoError(ERRNO_CODES.EOPNOTSUPP);
        }
        stream.stream_ops.allocate(stream, offset, length);
      },mmap:function (stream, buffer, offset, length, position, prot, flags) {
        // TODO if PROT is PROT_WRITE, make sure we have write access
        if ((stream.flags & 2097155) === 1) {
          throw new FS.ErrnoError(ERRNO_CODES.EACCES);
        }
        if (!stream.stream_ops.mmap) {
          throw new FS.ErrnoError(ERRNO_CODES.ENODEV);
        }
        return stream.stream_ops.mmap(stream, buffer, offset, length, position, prot, flags);
      },msync:function (stream, buffer, offset, length, mmapFlags) {
        if (!stream || !stream.stream_ops.msync) {
          return 0;
        }
        return stream.stream_ops.msync(stream, buffer, offset, length, mmapFlags);
      },munmap:function (stream) {
        return 0;
      },ioctl:function (stream, cmd, arg) {
        if (!stream.stream_ops.ioctl) {
          throw new FS.ErrnoError(ERRNO_CODES.ENOTTY);
        }
        return stream.stream_ops.ioctl(stream, cmd, arg);
      },readFile:function (path, opts) {
        opts = opts || {};
        opts.flags = opts.flags || 'r';
        opts.encoding = opts.encoding || 'binary';
        if (opts.encoding !== 'utf8' && opts.encoding !== 'binary') {
          throw new Error('Invalid encoding type "' + opts.encoding + '"');
        }
        var ret;
        var stream = FS.open(path, opts.flags);
        var stat = FS.stat(path);
        var length = stat.size;
        var buf = new Uint8Array(length);
        FS.read(stream, buf, 0, length, 0);
        if (opts.encoding === 'utf8') {
          ret = UTF8ArrayToString(buf, 0);
        } else if (opts.encoding === 'binary') {
          ret = buf;
        }
        FS.close(stream);
        return ret;
      },writeFile:function (path, data, opts) {
        opts = opts || {};
        opts.flags = opts.flags || 'w';
        opts.encoding = opts.encoding || 'utf8';
        if (opts.encoding !== 'utf8' && opts.encoding !== 'binary') {
          throw new Error('Invalid encoding type "' + opts.encoding + '"');
        }
        var stream = FS.open(path, opts.flags, opts.mode);
        if (opts.encoding === 'utf8') {
          var buf = new Uint8Array(lengthBytesUTF8(data)+1);
          var actualNumBytes = stringToUTF8Array(data, buf, 0, buf.length);
          FS.write(stream, buf, 0, actualNumBytes, 0, opts.canOwn);
        } else if (opts.encoding === 'binary') {
          FS.write(stream, data, 0, data.length, 0, opts.canOwn);
        }
        FS.close(stream);
      },cwd:function () {
        return FS.currentPath;
      },chdir:function (path) {
        var lookup = FS.lookupPath(path, { follow: true });
        if (!FS.isDir(lookup.node.mode)) {
          throw new FS.ErrnoError(ERRNO_CODES.ENOTDIR);
        }
        var err = FS.nodePermissions(lookup.node, 'x');
        if (err) {
          throw new FS.ErrnoError(err);
        }
        FS.currentPath = lookup.path;
      },createDefaultDirectories:function () {
        FS.mkdir('/tmp');
        FS.mkdir('/home');
        FS.mkdir('/home/web_user');
      },createDefaultDevices:function () {
        // create /dev
        FS.mkdir('/dev');
        // setup /dev/null
        FS.registerDevice(FS.makedev(1, 3), {
          read: function() { return 0; },
          write: function(stream, buffer, offset, length, pos) { return length; }
        });
        FS.mkdev('/dev/null', FS.makedev(1, 3));
        // setup /dev/tty and /dev/tty1
        // stderr needs to print output using Module['printErr']
        // so we register a second tty just for it.
        TTY.register(FS.makedev(5, 0), TTY.default_tty_ops);
        TTY.register(FS.makedev(6, 0), TTY.default_tty1_ops);
        FS.mkdev('/dev/tty', FS.makedev(5, 0));
        FS.mkdev('/dev/tty1', FS.makedev(6, 0));
        // setup /dev/[u]random
        var random_device;
        if (typeof crypto !== 'undefined') {
          // for modern web browsers
          var randomBuffer = new Uint8Array(1);
          random_device = function() { crypto.getRandomValues(randomBuffer); return randomBuffer[0]; };
        } else if (ENVIRONMENT_IS_NODE) {
          // for nodejs
          random_device = function() { return require('crypto').randomBytes(1)[0]; };
        } else {
          // default for ES5 platforms
          random_device = function() { return (Math.random()*256)|0; };
        }
        FS.createDevice('/dev', 'random', random_device);
        FS.createDevice('/dev', 'urandom', random_device);
        // we're not going to emulate the actual shm device,
        // just create the tmp dirs that reside in it commonly
        FS.mkdir('/dev/shm');
        FS.mkdir('/dev/shm/tmp');
      },createSpecialDirectories:function () {
        // create /proc/self/fd which allows /proc/self/fd/6 => readlink gives the name of the stream for fd 6 (see test_unistd_ttyname)
        FS.mkdir('/proc');
        FS.mkdir('/proc/self');
        FS.mkdir('/proc/self/fd');
        FS.mount({
          mount: function() {
            var node = FS.createNode('/proc/self', 'fd', 16384 | 0777, 73);
            node.node_ops = {
              lookup: function(parent, name) {
                var fd = +name;
                var stream = FS.getStream(fd);
                if (!stream) throw new FS.ErrnoError(ERRNO_CODES.EBADF);
                var ret = {
                  parent: null,
                  mount: { mountpoint: 'fake' },
                  node_ops: { readlink: function() { return stream.path } }
                };
                ret.parent = ret; // make it look like a simple root node
                return ret;
              }
            };
            return node;
          }
        }, {}, '/proc/self/fd');
      },createStandardStreams:function () {
        // TODO deprecate the old functionality of a single
        // input / output callback and that utilizes FS.createDevice
        // and instead require a unique set of stream ops
  
        // by default, we symlink the standard streams to the
        // default tty devices. however, if the standard streams
        // have been overwritten we create a unique device for
        // them instead.
        if (Module['stdin']) {
          FS.createDevice('/dev', 'stdin', Module['stdin']);
        } else {
          FS.symlink('/dev/tty', '/dev/stdin');
        }
        if (Module['stdout']) {
          FS.createDevice('/dev', 'stdout', null, Module['stdout']);
        } else {
          FS.symlink('/dev/tty', '/dev/stdout');
        }
        if (Module['stderr']) {
          FS.createDevice('/dev', 'stderr', null, Module['stderr']);
        } else {
          FS.symlink('/dev/tty1', '/dev/stderr');
        }
  
        // open default streams for the stdin, stdout and stderr devices
        var stdin = FS.open('/dev/stdin', 'r');
        assert(stdin.fd === 0, 'invalid handle for stdin (' + stdin.fd + ')');
  
        var stdout = FS.open('/dev/stdout', 'w');
        assert(stdout.fd === 1, 'invalid handle for stdout (' + stdout.fd + ')');
  
        var stderr = FS.open('/dev/stderr', 'w');
        assert(stderr.fd === 2, 'invalid handle for stderr (' + stderr.fd + ')');
      },ensureErrnoError:function () {
        if (FS.ErrnoError) return;
        FS.ErrnoError = function ErrnoError(errno, node) {
          //Module.printErr(stackTrace()); // useful for debugging
          this.node = node;
          this.setErrno = function(errno) {
            this.errno = errno;
            for (var key in ERRNO_CODES) {
              if (ERRNO_CODES[key] === errno) {
                this.code = key;
                break;
              }
            }
          };
          this.setErrno(errno);
          this.message = ERRNO_MESSAGES[errno];
        };
        FS.ErrnoError.prototype = new Error();
        FS.ErrnoError.prototype.constructor = FS.ErrnoError;
        // Some errors may happen quite a bit, to avoid overhead we reuse them (and suffer a lack of stack info)
        [ERRNO_CODES.ENOENT].forEach(function(code) {
          FS.genericErrors[code] = new FS.ErrnoError(code);
          FS.genericErrors[code].stack = '<generic error, no stack>';
        });
      },staticInit:function () {
        FS.ensureErrnoError();
  
        FS.nameTable = new Array(4096);
  
        FS.mount(MEMFS, {}, '/');
  
        FS.createDefaultDirectories();
        FS.createDefaultDevices();
        FS.createSpecialDirectories();
  
        FS.filesystems = {
          'MEMFS': MEMFS,
          'IDBFS': IDBFS,
          'NODEFS': NODEFS,
          'WORKERFS': WORKERFS,
        };
      },init:function (input, output, error) {
        assert(!FS.init.initialized, 'FS.init was previously called. If you want to initialize later with custom parameters, remove any earlier calls (note that one is automatically added to the generated code)');
        FS.init.initialized = true;
  
        FS.ensureErrnoError();
  
        // Allow Module.stdin etc. to provide defaults, if none explicitly passed to us here
        Module['stdin'] = input || Module['stdin'];
        Module['stdout'] = output || Module['stdout'];
        Module['stderr'] = error || Module['stderr'];
  
        FS.createStandardStreams();
      },quit:function () {
        FS.init.initialized = false;
        // force-flush all streams, so we get musl std streams printed out
        var fflush = Module['_fflush'];
        if (fflush) fflush(0);
        // close all of our streams
        for (var i = 0; i < FS.streams.length; i++) {
          var stream = FS.streams[i];
          if (!stream) {
            continue;
          }
          FS.close(stream);
        }
      },getMode:function (canRead, canWrite) {
        var mode = 0;
        if (canRead) mode |= 292 | 73;
        if (canWrite) mode |= 146;
        return mode;
      },joinPath:function (parts, forceRelative) {
        var path = PATH.join.apply(null, parts);
        if (forceRelative && path[0] == '/') path = path.substr(1);
        return path;
      },absolutePath:function (relative, base) {
        return PATH.resolve(base, relative);
      },standardizePath:function (path) {
        return PATH.normalize(path);
      },findObject:function (path, dontResolveLastLink) {
        var ret = FS.analyzePath(path, dontResolveLastLink);
        if (ret.exists) {
          return ret.object;
        } else {
          ___setErrNo(ret.error);
          return null;
        }
      },analyzePath:function (path, dontResolveLastLink) {
        // operate from within the context of the symlink's target
        try {
          var lookup = FS.lookupPath(path, { follow: !dontResolveLastLink });
          path = lookup.path;
        } catch (e) {
        }
        var ret = {
          isRoot: false, exists: false, error: 0, name: null, path: null, object: null,
          parentExists: false, parentPath: null, parentObject: null
        };
        try {
          var lookup = FS.lookupPath(path, { parent: true });
          ret.parentExists = true;
          ret.parentPath = lookup.path;
          ret.parentObject = lookup.node;
          ret.name = PATH.basename(path);
          lookup = FS.lookupPath(path, { follow: !dontResolveLastLink });
          ret.exists = true;
          ret.path = lookup.path;
          ret.object = lookup.node;
          ret.name = lookup.node.name;
          ret.isRoot = lookup.path === '/';
        } catch (e) {
          ret.error = e.errno;
        };
        return ret;
      },createFolder:function (parent, name, canRead, canWrite) {
        var path = PATH.join2(typeof parent === 'string' ? parent : FS.getPath(parent), name);
        var mode = FS.getMode(canRead, canWrite);
        return FS.mkdir(path, mode);
      },createPath:function (parent, path, canRead, canWrite) {
        parent = typeof parent === 'string' ? parent : FS.getPath(parent);
        var parts = path.split('/').reverse();
        while (parts.length) {
          var part = parts.pop();
          if (!part) continue;
          var current = PATH.join2(parent, part);
          try {
            FS.mkdir(current);
          } catch (e) {
            // ignore EEXIST
          }
          parent = current;
        }
        return current;
      },createFile:function (parent, name, properties, canRead, canWrite) {
        var path = PATH.join2(typeof parent === 'string' ? parent : FS.getPath(parent), name);
        var mode = FS.getMode(canRead, canWrite);
        return FS.create(path, mode);
      },createDataFile:function (parent, name, data, canRead, canWrite, canOwn) {
        var path = name ? PATH.join2(typeof parent === 'string' ? parent : FS.getPath(parent), name) : parent;
        var mode = FS.getMode(canRead, canWrite);
        var node = FS.create(path, mode);
        if (data) {
          if (typeof data === 'string') {
            var arr = new Array(data.length);
            for (var i = 0, len = data.length; i < len; ++i) arr[i] = data.charCodeAt(i);
            data = arr;
          }
          // make sure we can write to the file
          FS.chmod(node, mode | 146);
          var stream = FS.open(node, 'w');
          FS.write(stream, data, 0, data.length, 0, canOwn);
          FS.close(stream);
          FS.chmod(node, mode);
        }
        return node;
      },createDevice:function (parent, name, input, output) {
        var path = PATH.join2(typeof parent === 'string' ? parent : FS.getPath(parent), name);
        var mode = FS.getMode(!!input, !!output);
        if (!FS.createDevice.major) FS.createDevice.major = 64;
        var dev = FS.makedev(FS.createDevice.major++, 0);
        // Create a fake device that a set of stream ops to emulate
        // the old behavior.
        FS.registerDevice(dev, {
          open: function(stream) {
            stream.seekable = false;
          },
          close: function(stream) {
            // flush any pending line data
            if (output && output.buffer && output.buffer.length) {
              output(10);
            }
          },
          read: function(stream, buffer, offset, length, pos /* ignored */) {
            var bytesRead = 0;
            for (var i = 0; i < length; i++) {
              var result;
              try {
                result = input();
              } catch (e) {
                throw new FS.ErrnoError(ERRNO_CODES.EIO);
              }
              if (result === undefined && bytesRead === 0) {
                throw new FS.ErrnoError(ERRNO_CODES.EAGAIN);
              }
              if (result === null || result === undefined) break;
              bytesRead++;
              buffer[offset+i] = result;
            }
            if (bytesRead) {
              stream.node.timestamp = Date.now();
            }
            return bytesRead;
          },
          write: function(stream, buffer, offset, length, pos) {
            for (var i = 0; i < length; i++) {
              try {
                output(buffer[offset+i]);
              } catch (e) {
                throw new FS.ErrnoError(ERRNO_CODES.EIO);
              }
            }
            if (length) {
              stream.node.timestamp = Date.now();
            }
            return i;
          }
        });
        return FS.mkdev(path, mode, dev);
      },createLink:function (parent, name, target, canRead, canWrite) {
        var path = PATH.join2(typeof parent === 'string' ? parent : FS.getPath(parent), name);
        return FS.symlink(target, path);
      },forceLoadFile:function (obj) {
        if (obj.isDevice || obj.isFolder || obj.link || obj.contents) return true;
        var success = true;
        if (typeof XMLHttpRequest !== 'undefined') {
          throw new Error("Lazy loading should have been performed (contents set) in createLazyFile, but it was not. Lazy loading only works in web workers. Use --embed-file or --preload-file in emcc on the main thread.");
        } else if (Module['read']) {
          // Command-line.
          try {
            // WARNING: Can't read binary files in V8's d8 or tracemonkey's js, as
            //          read() will try to parse UTF8.
            obj.contents = intArrayFromString(Module['read'](obj.url), true);
            obj.usedBytes = obj.contents.length;
          } catch (e) {
            success = false;
          }
        } else {
          throw new Error('Cannot load without read() or XMLHttpRequest.');
        }
        if (!success) ___setErrNo(ERRNO_CODES.EIO);
        return success;
      },createLazyFile:function (parent, name, url, canRead, canWrite) {
        // Lazy chunked Uint8Array (implements get and length from Uint8Array). Actual getting is abstracted away for eventual reuse.
        function LazyUint8Array() {
          this.lengthKnown = false;
          this.chunks = []; // Loaded chunks. Index is the chunk number
        }
        LazyUint8Array.prototype.get = function LazyUint8Array_get(idx) {
          if (idx > this.length-1 || idx < 0) {
            return undefined;
          }
          var chunkOffset = idx % this.chunkSize;
          var chunkNum = (idx / this.chunkSize)|0;
          return this.getter(chunkNum)[chunkOffset];
        }
        LazyUint8Array.prototype.setDataGetter = function LazyUint8Array_setDataGetter(getter) {
          this.getter = getter;
        }
        LazyUint8Array.prototype.cacheLength = function LazyUint8Array_cacheLength() {
          // Find length
          var xhr = new XMLHttpRequest();
          xhr.open('HEAD', url, false);
          xhr.send(null);
          if (!(xhr.status >= 200 && xhr.status < 300 || xhr.status === 304)) throw new Error("Couldn't load " + url + ". Status: " + xhr.status);
          var datalength = Number(xhr.getResponseHeader("Content-length"));
          var header;
          var hasByteServing = (header = xhr.getResponseHeader("Accept-Ranges")) && header === "bytes";
          var chunkSize = 1024*1024; // Chunk size in bytes
  
          if (!hasByteServing) chunkSize = datalength;
  
          // Function to get a range from the remote URL.
          var doXHR = (function(from, to) {
            if (from > to) throw new Error("invalid range (" + from + ", " + to + ") or no bytes requested!");
            if (to > datalength-1) throw new Error("only " + datalength + " bytes available! programmer error!");
  
            // TODO: Use mozResponseArrayBuffer, responseStream, etc. if available.
            var xhr = new XMLHttpRequest();
            xhr.open('GET', url, false);
            if (datalength !== chunkSize) xhr.setRequestHeader("Range", "bytes=" + from + "-" + to);
  
            // Some hints to the browser that we want binary data.
            if (typeof Uint8Array != 'undefined') xhr.responseType = 'arraybuffer';
            if (xhr.overrideMimeType) {
              xhr.overrideMimeType('text/plain; charset=x-user-defined');
            }
  
            xhr.send(null);
            if (!(xhr.status >= 200 && xhr.status < 300 || xhr.status === 304)) throw new Error("Couldn't load " + url + ". Status: " + xhr.status);
            if (xhr.response !== undefined) {
              return new Uint8Array(xhr.response || []);
            } else {
              return intArrayFromString(xhr.responseText || '', true);
            }
          });
          var lazyArray = this;
          lazyArray.setDataGetter(function(chunkNum) {
            var start = chunkNum * chunkSize;
            var end = (chunkNum+1) * chunkSize - 1; // including this byte
            end = Math.min(end, datalength-1); // if datalength-1 is selected, this is the last block
            if (typeof(lazyArray.chunks[chunkNum]) === "undefined") {
              lazyArray.chunks[chunkNum] = doXHR(start, end);
            }
            if (typeof(lazyArray.chunks[chunkNum]) === "undefined") throw new Error("doXHR failed!");
            return lazyArray.chunks[chunkNum];
          });
  
          this._length = datalength;
          this._chunkSize = chunkSize;
          this.lengthKnown = true;
        }
        if (typeof XMLHttpRequest !== 'undefined') {
          if (!ENVIRONMENT_IS_WORKER) throw 'Cannot do synchronous binary XHRs outside webworkers in modern browsers. Use --embed-file or --preload-file in emcc';
          var lazyArray = new LazyUint8Array();
          Object.defineProperty(lazyArray, "length", {
              get: function() {
                  if(!this.lengthKnown) {
                      this.cacheLength();
                  }
                  return this._length;
              }
          });
          Object.defineProperty(lazyArray, "chunkSize", {
              get: function() {
                  if(!this.lengthKnown) {
                      this.cacheLength();
                  }
                  return this._chunkSize;
              }
          });
  
          var properties = { isDevice: false, contents: lazyArray };
        } else {
          var properties = { isDevice: false, url: url };
        }
  
        var node = FS.createFile(parent, name, properties, canRead, canWrite);
        // This is a total hack, but I want to get this lazy file code out of the
        // core of MEMFS. If we want to keep this lazy file concept I feel it should
        // be its own thin LAZYFS proxying calls to MEMFS.
        if (properties.contents) {
          node.contents = properties.contents;
        } else if (properties.url) {
          node.contents = null;
          node.url = properties.url;
        }
        // Add a function that defers querying the file size until it is asked the first time.
        Object.defineProperty(node, "usedBytes", {
            get: function() { return this.contents.length; }
        });
        // override each stream op with one that tries to force load the lazy file first
        var stream_ops = {};
        var keys = Object.keys(node.stream_ops);
        keys.forEach(function(key) {
          var fn = node.stream_ops[key];
          stream_ops[key] = function forceLoadLazyFile() {
            if (!FS.forceLoadFile(node)) {
              throw new FS.ErrnoError(ERRNO_CODES.EIO);
            }
            return fn.apply(null, arguments);
          };
        });
        // use a custom read function
        stream_ops.read = function stream_ops_read(stream, buffer, offset, length, position) {
          if (!FS.forceLoadFile(node)) {
            throw new FS.ErrnoError(ERRNO_CODES.EIO);
          }
          var contents = stream.node.contents;
          if (position >= contents.length)
            return 0;
          var size = Math.min(contents.length - position, length);
          assert(size >= 0);
          if (contents.slice) { // normal array
            for (var i = 0; i < size; i++) {
              buffer[offset + i] = contents[position + i];
            }
          } else {
            for (var i = 0; i < size; i++) { // LazyUint8Array from sync binary XHR
              buffer[offset + i] = contents.get(position + i);
            }
          }
          return size;
        };
        node.stream_ops = stream_ops;
        return node;
      },createPreloadedFile:function (parent, name, url, canRead, canWrite, onload, onerror, dontCreateFile, canOwn, preFinish) {
        Browser.init();
        // TODO we should allow people to just pass in a complete filename instead
        // of parent and name being that we just join them anyways
        var fullname = name ? PATH.resolve(PATH.join2(parent, name)) : parent;
        var dep = getUniqueRunDependency('cp ' + fullname); // might have several active requests for the same fullname
        function processData(byteArray) {
          function finish(byteArray) {
            if (preFinish) preFinish();
            if (!dontCreateFile) {
              FS.createDataFile(parent, name, byteArray, canRead, canWrite, canOwn);
            }
            if (onload) onload();
            removeRunDependency(dep);
          }
          var handled = false;
          Module['preloadPlugins'].forEach(function(plugin) {
            if (handled) return;
            if (plugin['canHandle'](fullname)) {
              plugin['handle'](byteArray, fullname, finish, function() {
                if (onerror) onerror();
                removeRunDependency(dep);
              });
              handled = true;
            }
          });
          if (!handled) finish(byteArray);
        }
        addRunDependency(dep);
        if (typeof url == 'string') {
          Browser.asyncLoad(url, function(byteArray) {
            processData(byteArray);
          }, onerror);
        } else {
          processData(url);
        }
      },indexedDB:function () {
        return window.indexedDB || window.mozIndexedDB || window.webkitIndexedDB || window.msIndexedDB;
      },DB_NAME:function () {
        return 'EM_FS_' + window.location.pathname;
      },DB_VERSION:20,DB_STORE_NAME:"FILE_DATA",saveFilesToDB:function (paths, onload, onerror) {
        onload = onload || function(){};
        onerror = onerror || function(){};
        var indexedDB = FS.indexedDB();
        try {
          var openRequest = indexedDB.open(FS.DB_NAME(), FS.DB_VERSION);
        } catch (e) {
          return onerror(e);
        }
        openRequest.onupgradeneeded = function openRequest_onupgradeneeded() {
          console.log('creating db');
          var db = openRequest.result;
          db.createObjectStore(FS.DB_STORE_NAME);
        };
        openRequest.onsuccess = function openRequest_onsuccess() {
          var db = openRequest.result;
          var transaction = db.transaction([FS.DB_STORE_NAME], 'readwrite');
          var files = transaction.objectStore(FS.DB_STORE_NAME);
          var ok = 0, fail = 0, total = paths.length;
          function finish() {
            if (fail == 0) onload(); else onerror();
          }
          paths.forEach(function(path) {
            var putRequest = files.put(FS.analyzePath(path).object.contents, path);
            putRequest.onsuccess = function putRequest_onsuccess() { ok++; if (ok + fail == total) finish() };
            putRequest.onerror = function putRequest_onerror() { fail++; if (ok + fail == total) finish() };
          });
          transaction.onerror = onerror;
        };
        openRequest.onerror = onerror;
      },loadFilesFromDB:function (paths, onload, onerror) {
        onload = onload || function(){};
        onerror = onerror || function(){};
        var indexedDB = FS.indexedDB();
        try {
          var openRequest = indexedDB.open(FS.DB_NAME(), FS.DB_VERSION);
        } catch (e) {
          return onerror(e);
        }
        openRequest.onupgradeneeded = onerror; // no database to load from
        openRequest.onsuccess = function openRequest_onsuccess() {
          var db = openRequest.result;
          try {
            var transaction = db.transaction([FS.DB_STORE_NAME], 'readonly');
          } catch(e) {
            onerror(e);
            return;
          }
          var files = transaction.objectStore(FS.DB_STORE_NAME);
          var ok = 0, fail = 0, total = paths.length;
          function finish() {
            if (fail == 0) onload(); else onerror();
          }
          paths.forEach(function(path) {
            var getRequest = files.get(path);
            getRequest.onsuccess = function getRequest_onsuccess() {
              if (FS.analyzePath(path).exists) {
                FS.unlink(path);
              }
              FS.createDataFile(PATH.dirname(path), PATH.basename(path), getRequest.result, true, true, true);
              ok++;
              if (ok + fail == total) finish();
            };
            getRequest.onerror = function getRequest_onerror() { fail++; if (ok + fail == total) finish() };
          });
          transaction.onerror = onerror;
        };
        openRequest.onerror = onerror;
      }};var PATH={splitPath:function (filename) {
        var splitPathRe = /^(\/?|)([\s\S]*?)((?:\.{1,2}|[^\/]+?|)(\.[^.\/]*|))(?:[\/]*)$/;
        return splitPathRe.exec(filename).slice(1);
      },normalizeArray:function (parts, allowAboveRoot) {
        // if the path tries to go above the root, `up` ends up > 0
        var up = 0;
        for (var i = parts.length - 1; i >= 0; i--) {
          var last = parts[i];
          if (last === '.') {
            parts.splice(i, 1);
          } else if (last === '..') {
            parts.splice(i, 1);
            up++;
          } else if (up) {
            parts.splice(i, 1);
            up--;
          }
        }
        // if the path is allowed to go above the root, restore leading ..s
        if (allowAboveRoot) {
          for (; up--; up) {
            parts.unshift('..');
          }
        }
        return parts;
      },normalize:function (path) {
        var isAbsolute = path.charAt(0) === '/',
            trailingSlash = path.substr(-1) === '/';
        // Normalize the path
        path = PATH.normalizeArray(path.split('/').filter(function(p) {
          return !!p;
        }), !isAbsolute).join('/');
        if (!path && !isAbsolute) {
          path = '.';
        }
        if (path && trailingSlash) {
          path += '/';
        }
        return (isAbsolute ? '/' : '') + path;
      },dirname:function (path) {
        var result = PATH.splitPath(path),
            root = result[0],
            dir = result[1];
        if (!root && !dir) {
          // No dirname whatsoever
          return '.';
        }
        if (dir) {
          // It has a dirname, strip trailing slash
          dir = dir.substr(0, dir.length - 1);
        }
        return root + dir;
      },basename:function (path) {
        // EMSCRIPTEN return '/'' for '/', not an empty string
        if (path === '/') return '/';
        var lastSlash = path.lastIndexOf('/');
        if (lastSlash === -1) return path;
        return path.substr(lastSlash+1);
      },extname:function (path) {
        return PATH.splitPath(path)[3];
      },join:function () {
        var paths = Array.prototype.slice.call(arguments, 0);
        return PATH.normalize(paths.join('/'));
      },join2:function (l, r) {
        return PATH.normalize(l + '/' + r);
      },resolve:function () {
        var resolvedPath = '',
          resolvedAbsolute = false;
        for (var i = arguments.length - 1; i >= -1 && !resolvedAbsolute; i--) {
          var path = (i >= 0) ? arguments[i] : FS.cwd();
          // Skip empty and invalid entries
          if (typeof path !== 'string') {
            throw new TypeError('Arguments to path.resolve must be strings');
          } else if (!path) {
            return ''; // an invalid portion invalidates the whole thing
          }
          resolvedPath = path + '/' + resolvedPath;
          resolvedAbsolute = path.charAt(0) === '/';
        }
        // At this point the path should be resolved to a full absolute path, but
        // handle relative paths to be safe (might happen when process.cwd() fails)
        resolvedPath = PATH.normalizeArray(resolvedPath.split('/').filter(function(p) {
          return !!p;
        }), !resolvedAbsolute).join('/');
        return ((resolvedAbsolute ? '/' : '') + resolvedPath) || '.';
      },relative:function (from, to) {
        from = PATH.resolve(from).substr(1);
        to = PATH.resolve(to).substr(1);
        function trim(arr) {
          var start = 0;
          for (; start < arr.length; start++) {
            if (arr[start] !== '') break;
          }
          var end = arr.length - 1;
          for (; end >= 0; end--) {
            if (arr[end] !== '') break;
          }
          if (start > end) return [];
          return arr.slice(start, end - start + 1);
        }
        var fromParts = trim(from.split('/'));
        var toParts = trim(to.split('/'));
        var length = Math.min(fromParts.length, toParts.length);
        var samePartsLength = length;
        for (var i = 0; i < length; i++) {
          if (fromParts[i] !== toParts[i]) {
            samePartsLength = i;
            break;
          }
        }
        var outputParts = [];
        for (var i = samePartsLength; i < fromParts.length; i++) {
          outputParts.push('..');
        }
        outputParts = outputParts.concat(toParts.slice(samePartsLength));
        return outputParts.join('/');
      }};
  
  
  function _emscripten_set_main_loop_timing(mode, value) {
      Browser.mainLoop.timingMode = mode;
      Browser.mainLoop.timingValue = value;
  
      if (!Browser.mainLoop.func) {
        return 1; // Return non-zero on failure, can't set timing mode when there is no main loop.
      }
  
      if (mode == 0 /*EM_TIMING_SETTIMEOUT*/) {
        Browser.mainLoop.scheduler = function Browser_mainLoop_scheduler_setTimeout() {
          setTimeout(Browser.mainLoop.runner, value); // doing this each time means that on exception, we stop
        };
        Browser.mainLoop.method = 'timeout';
      } else if (mode == 1 /*EM_TIMING_RAF*/) {
        Browser.mainLoop.scheduler = function Browser_mainLoop_scheduler_rAF() {
          Browser.requestAnimationFrame(Browser.mainLoop.runner);
        };
        Browser.mainLoop.method = 'rAF';
      } else if (mode == 2 /*EM_TIMING_SETIMMEDIATE*/) {
        if (!window['setImmediate']) {
          // Emulate setImmediate. (note: not a complete polyfill, we don't emulate clearImmediate() to keep code size to minimum, since not needed)
          var setImmediates = [];
          var emscriptenMainLoopMessageId = '__emcc';
          function Browser_setImmediate_messageHandler(event) {
            if (event.source === window && event.data === emscriptenMainLoopMessageId) {
              event.stopPropagation();
              setImmediates.shift()();
            }
          }
          window.addEventListener("message", Browser_setImmediate_messageHandler, true);
          window['setImmediate'] = function Browser_emulated_setImmediate(func) {
            setImmediates.push(func);
            window.postMessage(emscriptenMainLoopMessageId, "*");
          }
        }
        Browser.mainLoop.scheduler = function Browser_mainLoop_scheduler_setImmediate() {
          window['setImmediate'](Browser.mainLoop.runner);
        };
        Browser.mainLoop.method = 'immediate';
      }
      return 0;
    }function _emscripten_set_main_loop(func, fps, simulateInfiniteLoop, arg, noSetTiming) {
      Module['noExitRuntime'] = true;
  
      assert(!Browser.mainLoop.func, 'emscripten_set_main_loop: there can only be one main loop function at once: call emscripten_cancel_main_loop to cancel the previous one before setting a new one with different parameters.');
  
      Browser.mainLoop.func = func;
      Browser.mainLoop.arg = arg;
  
      var thisMainLoopId = Browser.mainLoop.currentlyRunningMainloop;
  
      Browser.mainLoop.runner = function Browser_mainLoop_runner() {
        if (ABORT) return;
        if (Browser.mainLoop.queue.length > 0) {
          var start = Date.now();
          var blocker = Browser.mainLoop.queue.shift();
          blocker.func(blocker.arg);
          if (Browser.mainLoop.remainingBlockers) {
            var remaining = Browser.mainLoop.remainingBlockers;
            var next = remaining%1 == 0 ? remaining-1 : Math.floor(remaining);
            if (blocker.counted) {
              Browser.mainLoop.remainingBlockers = next;
            } else {
              // not counted, but move the progress along a tiny bit
              next = next + 0.5; // do not steal all the next one's progress
              Browser.mainLoop.remainingBlockers = (8*remaining + next)/9;
            }
          }
          console.log('main loop blocker "' + blocker.name + '" took ' + (Date.now() - start) + ' ms'); //, left: ' + Browser.mainLoop.remainingBlockers);
          Browser.mainLoop.updateStatus();
          setTimeout(Browser.mainLoop.runner, 0);
          return;
        }
  
        // catch pauses from non-main loop sources
        if (thisMainLoopId < Browser.mainLoop.currentlyRunningMainloop) return;
  
        // Implement very basic swap interval control
        Browser.mainLoop.currentFrameNumber = Browser.mainLoop.currentFrameNumber + 1 | 0;
        if (Browser.mainLoop.timingMode == 1/*EM_TIMING_RAF*/ && Browser.mainLoop.timingValue > 1 && Browser.mainLoop.currentFrameNumber % Browser.mainLoop.timingValue != 0) {
          // Not the scheduled time to render this frame - skip.
          Browser.mainLoop.scheduler();
          return;
        }
  
        // Signal GL rendering layer that processing of a new frame is about to start. This helps it optimize
        // VBO double-buffering and reduce GPU stalls.
  
        if (Browser.mainLoop.method === 'timeout' && Module.ctx) {
          Module.printErr('Looks like you are rendering without using requestAnimationFrame for the main loop. You should use 0 for the frame rate in emscripten_set_main_loop in order to use requestAnimationFrame, as that can greatly improve your frame rates!');
          Browser.mainLoop.method = ''; // just warn once per call to set main loop
        }
  
        Browser.mainLoop.runIter(function() {
          if (typeof arg !== 'undefined') {
            Runtime.dynCall('vi', func, [arg]);
          } else {
            Runtime.dynCall('v', func);
          }
        });
  
        // catch pauses from the main loop itself
        if (thisMainLoopId < Browser.mainLoop.currentlyRunningMainloop) return;
  
        // Queue new audio data. This is important to be right after the main loop invocation, so that we will immediately be able
        // to queue the newest produced audio samples.
        // TODO: Consider adding pre- and post- rAF callbacks so that GL.newRenderingFrameStarted() and SDL.audio.queueNewAudioData()
        //       do not need to be hardcoded into this function, but can be more generic.
        if (typeof SDL === 'object' && SDL.audio && SDL.audio.queueNewAudioData) SDL.audio.queueNewAudioData();
  
        Browser.mainLoop.scheduler();
      }
  
      if (!noSetTiming) {
        if (fps && fps > 0) _emscripten_set_main_loop_timing(0/*EM_TIMING_SETTIMEOUT*/, 1000.0 / fps);
        else _emscripten_set_main_loop_timing(1/*EM_TIMING_RAF*/, 1); // Do rAF by rendering each frame (no decimating)
  
        Browser.mainLoop.scheduler();
      }
  
      if (simulateInfiniteLoop) {
        throw 'SimulateInfiniteLoop';
      }
    }var Browser={mainLoop:{scheduler:null,method:"",currentlyRunningMainloop:0,func:null,arg:0,timingMode:0,timingValue:0,currentFrameNumber:0,queue:[],pause:function () {
          Browser.mainLoop.scheduler = null;
          Browser.mainLoop.currentlyRunningMainloop++; // Incrementing this signals the previous main loop that it's now become old, and it must return.
        },resume:function () {
          Browser.mainLoop.currentlyRunningMainloop++;
          var timingMode = Browser.mainLoop.timingMode;
          var timingValue = Browser.mainLoop.timingValue;
          var func = Browser.mainLoop.func;
          Browser.mainLoop.func = null;
          _emscripten_set_main_loop(func, 0, false, Browser.mainLoop.arg, true /* do not set timing and call scheduler, we will do it on the next lines */);
          _emscripten_set_main_loop_timing(timingMode, timingValue);
          Browser.mainLoop.scheduler();
        },updateStatus:function () {
          if (Module['setStatus']) {
            var message = Module['statusMessage'] || 'Please wait...';
            var remaining = Browser.mainLoop.remainingBlockers;
            var expected = Browser.mainLoop.expectedBlockers;
            if (remaining) {
              if (remaining < expected) {
                Module['setStatus'](message + ' (' + (expected - remaining) + '/' + expected + ')');
              } else {
                Module['setStatus'](message);
              }
            } else {
              Module['setStatus']('');
            }
          }
        },runIter:function (func) {
          if (ABORT) return;
          if (Module['preMainLoop']) {
            var preRet = Module['preMainLoop']();
            if (preRet === false) {
              return; // |return false| skips a frame
            }
          }
          try {
            func();
          } catch (e) {
            if (e instanceof ExitStatus) {
              return;
            } else {
              if (e && typeof e === 'object' && e.stack) Module.printErr('exception thrown: ' + [e, e.stack]);
              throw e;
            }
          }
          if (Module['postMainLoop']) Module['postMainLoop']();
        }},isFullScreen:false,pointerLock:false,moduleContextCreatedCallbacks:[],workers:[],init:function () {
        if (!Module["preloadPlugins"]) Module["preloadPlugins"] = []; // needs to exist even in workers
  
        if (Browser.initted) return;
        Browser.initted = true;
  
        try {
          new Blob();
          Browser.hasBlobConstructor = true;
        } catch(e) {
          Browser.hasBlobConstructor = false;
          console.log("warning: no blob constructor, cannot create blobs with mimetypes");
        }
        Browser.BlobBuilder = typeof MozBlobBuilder != "undefined" ? MozBlobBuilder : (typeof WebKitBlobBuilder != "undefined" ? WebKitBlobBuilder : (!Browser.hasBlobConstructor ? console.log("warning: no BlobBuilder") : null));
        Browser.URLObject = typeof window != "undefined" ? (window.URL ? window.URL : window.webkitURL) : undefined;
        if (!Module.noImageDecoding && typeof Browser.URLObject === 'undefined') {
          console.log("warning: Browser does not support creating object URLs. Built-in browser image decoding will not be available.");
          Module.noImageDecoding = true;
        }
  
        // Support for plugins that can process preloaded files. You can add more of these to
        // your app by creating and appending to Module.preloadPlugins.
        //
        // Each plugin is asked if it can handle a file based on the file's name. If it can,
        // it is given the file's raw data. When it is done, it calls a callback with the file's
        // (possibly modified) data. For example, a plugin might decompress a file, or it
        // might create some side data structure for use later (like an Image element, etc.).
  
        var imagePlugin = {};
        imagePlugin['canHandle'] = function imagePlugin_canHandle(name) {
          return !Module.noImageDecoding && /\.(jpg|jpeg|png|bmp)$/i.test(name);
        };
        imagePlugin['handle'] = function imagePlugin_handle(byteArray, name, onload, onerror) {
          var b = null;
          if (Browser.hasBlobConstructor) {
            try {
              b = new Blob([byteArray], { type: Browser.getMimetype(name) });
              if (b.size !== byteArray.length) { // Safari bug #118630
                // Safari's Blob can only take an ArrayBuffer
                b = new Blob([(new Uint8Array(byteArray)).buffer], { type: Browser.getMimetype(name) });
              }
            } catch(e) {
              Runtime.warnOnce('Blob constructor present but fails: ' + e + '; falling back to blob builder');
            }
          }
          if (!b) {
            var bb = new Browser.BlobBuilder();
            bb.append((new Uint8Array(byteArray)).buffer); // we need to pass a buffer, and must copy the array to get the right data range
            b = bb.getBlob();
          }
          var url = Browser.URLObject.createObjectURL(b);
          var img = new Image();
          img.onload = function img_onload() {
            assert(img.complete, 'Image ' + name + ' could not be decoded');
            var canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            var ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);
            Module["preloadedImages"][name] = canvas;
            Browser.URLObject.revokeObjectURL(url);
            if (onload) onload(byteArray);
          };
          img.onerror = function img_onerror(event) {
            console.log('Image ' + url + ' could not be decoded');
            if (onerror) onerror();
          };
          img.src = url;
        };
        Module['preloadPlugins'].push(imagePlugin);
  
        var audioPlugin = {};
        audioPlugin['canHandle'] = function audioPlugin_canHandle(name) {
          return !Module.noAudioDecoding && name.substr(-4) in { '.ogg': 1, '.wav': 1, '.mp3': 1 };
        };
        audioPlugin['handle'] = function audioPlugin_handle(byteArray, name, onload, onerror) {
          var done = false;
          function finish(audio) {
            if (done) return;
            done = true;
            Module["preloadedAudios"][name] = audio;
            if (onload) onload(byteArray);
          }
          function fail() {
            if (done) return;
            done = true;
            Module["preloadedAudios"][name] = new Audio(); // empty shim
            if (onerror) onerror();
          }
          if (Browser.hasBlobConstructor) {
            try {
              var b = new Blob([byteArray], { type: Browser.getMimetype(name) });
            } catch(e) {
              return fail();
            }
            var url = Browser.URLObject.createObjectURL(b); // XXX we never revoke this!
            var audio = new Audio();
            audio.addEventListener('canplaythrough', function() { finish(audio) }, false); // use addEventListener due to chromium bug 124926
            audio.onerror = function audio_onerror(event) {
              if (done) return;
              console.log('warning: browser could not fully decode audio ' + name + ', trying slower base64 approach');
              function encode64(data) {
                var BASE = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
                var PAD = '=';
                var ret = '';
                var leftchar = 0;
                var leftbits = 0;
                for (var i = 0; i < data.length; i++) {
                  leftchar = (leftchar << 8) | data[i];
                  leftbits += 8;
                  while (leftbits >= 6) {
                    var curr = (leftchar >> (leftbits-6)) & 0x3f;
                    leftbits -= 6;
                    ret += BASE[curr];
                  }
                }
                if (leftbits == 2) {
                  ret += BASE[(leftchar&3) << 4];
                  ret += PAD + PAD;
                } else if (leftbits == 4) {
                  ret += BASE[(leftchar&0xf) << 2];
                  ret += PAD;
                }
                return ret;
              }
              audio.src = 'data:audio/x-' + name.substr(-3) + ';base64,' + encode64(byteArray);
              finish(audio); // we don't wait for confirmation this worked - but it's worth trying
            };
            audio.src = url;
            // workaround for chrome bug 124926 - we do not always get oncanplaythrough or onerror
            Browser.safeSetTimeout(function() {
              finish(audio); // try to use it even though it is not necessarily ready to play
            }, 10000);
          } else {
            return fail();
          }
        };
        Module['preloadPlugins'].push(audioPlugin);
  
        // Canvas event setup
  
        var canvas = Module['canvas'];
        function pointerLockChange() {
          Browser.pointerLock = document['pointerLockElement'] === canvas ||
                                document['mozPointerLockElement'] === canvas ||
                                document['webkitPointerLockElement'] === canvas ||
                                document['msPointerLockElement'] === canvas;
        }
        if (canvas) {
          // forced aspect ratio can be enabled by defining 'forcedAspectRatio' on Module
          // Module['forcedAspectRatio'] = 4 / 3;
          
          canvas.requestPointerLock = canvas['requestPointerLock'] ||
                                      canvas['mozRequestPointerLock'] ||
                                      canvas['webkitRequestPointerLock'] ||
                                      canvas['msRequestPointerLock'] ||
                                      function(){};
          canvas.exitPointerLock = document['exitPointerLock'] ||
                                   document['mozExitPointerLock'] ||
                                   document['webkitExitPointerLock'] ||
                                   document['msExitPointerLock'] ||
                                   function(){}; // no-op if function does not exist
          canvas.exitPointerLock = canvas.exitPointerLock.bind(document);
  
  
          document.addEventListener('pointerlockchange', pointerLockChange, false);
          document.addEventListener('mozpointerlockchange', pointerLockChange, false);
          document.addEventListener('webkitpointerlockchange', pointerLockChange, false);
          document.addEventListener('mspointerlockchange', pointerLockChange, false);
  
          if (Module['elementPointerLock']) {
            canvas.addEventListener("click", function(ev) {
              if (!Browser.pointerLock && canvas.requestPointerLock) {
                canvas.requestPointerLock();
                ev.preventDefault();
              }
            }, false);
          }
        }
      },createContext:function (canvas, useWebGL, setInModule, webGLContextAttributes) {
        if (useWebGL && Module.ctx && canvas == Module.canvas) return Module.ctx; // no need to recreate GL context if it's already been created for this canvas.
  
        var ctx;
        var contextHandle;
        if (useWebGL) {
          // For GLES2/desktop GL compatibility, adjust a few defaults to be different to WebGL defaults, so that they align better with the desktop defaults.
          var contextAttributes = {
            antialias: false,
            alpha: false
          };
  
          if (webGLContextAttributes) {
            for (var attribute in webGLContextAttributes) {
              contextAttributes[attribute] = webGLContextAttributes[attribute];
            }
          }
  
          contextHandle = GL.createContext(canvas, contextAttributes);
          if (contextHandle) {
            ctx = GL.getContext(contextHandle).GLctx;
          }
          // Set the background of the WebGL canvas to black
          canvas.style.backgroundColor = "black";
        } else {
          ctx = canvas.getContext('2d');
        }
  
        if (!ctx) return null;
  
        if (setInModule) {
          if (!useWebGL) assert(typeof GLctx === 'undefined', 'cannot set in module if GLctx is used, but we are a non-GL context that would replace it');
  
          Module.ctx = ctx;
          if (useWebGL) GL.makeContextCurrent(contextHandle);
          Module.useWebGL = useWebGL;
          Browser.moduleContextCreatedCallbacks.forEach(function(callback) { callback() });
          Browser.init();
        }
        return ctx;
      },destroyContext:function (canvas, useWebGL, setInModule) {},fullScreenHandlersInstalled:false,lockPointer:undefined,resizeCanvas:undefined,requestFullScreen:function (lockPointer, resizeCanvas, vrDevice) {
        Browser.lockPointer = lockPointer;
        Browser.resizeCanvas = resizeCanvas;
        Browser.vrDevice = vrDevice;
        if (typeof Browser.lockPointer === 'undefined') Browser.lockPointer = true;
        if (typeof Browser.resizeCanvas === 'undefined') Browser.resizeCanvas = false;
        if (typeof Browser.vrDevice === 'undefined') Browser.vrDevice = null;
  
        var canvas = Module['canvas'];
        function fullScreenChange() {
          Browser.isFullScreen = false;
          var canvasContainer = canvas.parentNode;
          if ((document['webkitFullScreenElement'] || document['webkitFullscreenElement'] ||
               document['mozFullScreenElement'] || document['mozFullscreenElement'] ||
               document['fullScreenElement'] || document['fullscreenElement'] ||
               document['msFullScreenElement'] || document['msFullscreenElement'] ||
               document['webkitCurrentFullScreenElement']) === canvasContainer) {
            canvas.cancelFullScreen = document['cancelFullScreen'] ||
                                      document['mozCancelFullScreen'] ||
                                      document['webkitCancelFullScreen'] ||
                                      document['msExitFullscreen'] ||
                                      document['exitFullscreen'] ||
                                      function() {};
            canvas.cancelFullScreen = canvas.cancelFullScreen.bind(document);
            if (Browser.lockPointer) canvas.requestPointerLock();
            Browser.isFullScreen = true;
            if (Browser.resizeCanvas) Browser.setFullScreenCanvasSize();
          } else {
            
            // remove the full screen specific parent of the canvas again to restore the HTML structure from before going full screen
            canvasContainer.parentNode.insertBefore(canvas, canvasContainer);
            canvasContainer.parentNode.removeChild(canvasContainer);
            
            if (Browser.resizeCanvas) Browser.setWindowedCanvasSize();
          }
          if (Module['onFullScreen']) Module['onFullScreen'](Browser.isFullScreen);
          Browser.updateCanvasDimensions(canvas);
        }
  
        if (!Browser.fullScreenHandlersInstalled) {
          Browser.fullScreenHandlersInstalled = true;
          document.addEventListener('fullscreenchange', fullScreenChange, false);
          document.addEventListener('mozfullscreenchange', fullScreenChange, false);
          document.addEventListener('webkitfullscreenchange', fullScreenChange, false);
          document.addEventListener('MSFullscreenChange', fullScreenChange, false);
        }
  
        // create a new parent to ensure the canvas has no siblings. this allows browsers to optimize full screen performance when its parent is the full screen root
        var canvasContainer = document.createElement("div");
        canvas.parentNode.insertBefore(canvasContainer, canvas);
        canvasContainer.appendChild(canvas);
  
        // use parent of canvas as full screen root to allow aspect ratio correction (Firefox stretches the root to screen size)
        canvasContainer.requestFullScreen = canvasContainer['requestFullScreen'] ||
                                            canvasContainer['mozRequestFullScreen'] ||
                                            canvasContainer['msRequestFullscreen'] ||
                                           (canvasContainer['webkitRequestFullScreen'] ? function() { canvasContainer['webkitRequestFullScreen'](Element['ALLOW_KEYBOARD_INPUT']) } : null);
  
        if (vrDevice) {
          canvasContainer.requestFullScreen({ vrDisplay: vrDevice });
        } else {
          canvasContainer.requestFullScreen();
        }
      },nextRAF:0,fakeRequestAnimationFrame:function (func) {
        // try to keep 60fps between calls to here
        var now = Date.now();
        if (Browser.nextRAF === 0) {
          Browser.nextRAF = now + 1000/60;
        } else {
          while (now + 2 >= Browser.nextRAF) { // fudge a little, to avoid timer jitter causing us to do lots of delay:0
            Browser.nextRAF += 1000/60;
          }
        }
        var delay = Math.max(Browser.nextRAF - now, 0);
        setTimeout(func, delay);
      },requestAnimationFrame:function requestAnimationFrame(func) {
        if (typeof window === 'undefined') { // Provide fallback to setTimeout if window is undefined (e.g. in Node.js)
          Browser.fakeRequestAnimationFrame(func);
        } else {
          if (!window.requestAnimationFrame) {
            window.requestAnimationFrame = window['requestAnimationFrame'] ||
                                           window['mozRequestAnimationFrame'] ||
                                           window['webkitRequestAnimationFrame'] ||
                                           window['msRequestAnimationFrame'] ||
                                           window['oRequestAnimationFrame'] ||
                                           Browser.fakeRequestAnimationFrame;
          }
          window.requestAnimationFrame(func);
        }
      },safeCallback:function (func) {
        return function() {
          if (!ABORT) return func.apply(null, arguments);
        };
      },allowAsyncCallbacks:true,queuedAsyncCallbacks:[],pauseAsyncCallbacks:function () {
        Browser.allowAsyncCallbacks = false;
      },resumeAsyncCallbacks:function () { // marks future callbacks as ok to execute, and synchronously runs any remaining ones right now
        Browser.allowAsyncCallbacks = true;
        if (Browser.queuedAsyncCallbacks.length > 0) {
          var callbacks = Browser.queuedAsyncCallbacks;
          Browser.queuedAsyncCallbacks = [];
          callbacks.forEach(function(func) {
            func();
          });
        }
      },safeRequestAnimationFrame:function (func) {
        return Browser.requestAnimationFrame(function() {
          if (ABORT) return;
          if (Browser.allowAsyncCallbacks) {
            func();
          } else {
            Browser.queuedAsyncCallbacks.push(func);
          }
        });
      },safeSetTimeout:function (func, timeout) {
        Module['noExitRuntime'] = true;
        return setTimeout(function() {
          if (ABORT) return;
          if (Browser.allowAsyncCallbacks) {
            func();
          } else {
            Browser.queuedAsyncCallbacks.push(func);
          }
        }, timeout);
      },safeSetInterval:function (func, timeout) {
        Module['noExitRuntime'] = true;
        return setInterval(function() {
          if (ABORT) return;
          if (Browser.allowAsyncCallbacks) {
            func();
          } // drop it on the floor otherwise, next interval will kick in
        }, timeout);
      },getMimetype:function (name) {
        return {
          'jpg': 'image/jpeg',
          'jpeg': 'image/jpeg',
          'png': 'image/png',
          'bmp': 'image/bmp',
          'ogg': 'audio/ogg',
          'wav': 'audio/wav',
          'mp3': 'audio/mpeg'
        }[name.substr(name.lastIndexOf('.')+1)];
      },getUserMedia:function (func) {
        if(!window.getUserMedia) {
          window.getUserMedia = navigator['getUserMedia'] ||
                                navigator['mozGetUserMedia'];
        }
        window.getUserMedia(func);
      },getMovementX:function (event) {
        return event['movementX'] ||
               event['mozMovementX'] ||
               event['webkitMovementX'] ||
               0;
      },getMovementY:function (event) {
        return event['movementY'] ||
               event['mozMovementY'] ||
               event['webkitMovementY'] ||
               0;
      },getMouseWheelDelta:function (event) {
        var delta = 0;
        switch (event.type) {
          case 'DOMMouseScroll': 
            delta = event.detail;
            break;
          case 'mousewheel': 
            delta = event.wheelDelta;
            break;
          case 'wheel': 
            delta = event['deltaY'];
            break;
          default:
            throw 'unrecognized mouse wheel event: ' + event.type;
        }
        return delta;
      },mouseX:0,mouseY:0,mouseMovementX:0,mouseMovementY:0,touches:{},lastTouches:{},calculateMouseEvent:function (event) { // event should be mousemove, mousedown or mouseup
        if (Browser.pointerLock) {
          // When the pointer is locked, calculate the coordinates
          // based on the movement of the mouse.
          // Workaround for Firefox bug 764498
          if (event.type != 'mousemove' &&
              ('mozMovementX' in event)) {
            Browser.mouseMovementX = Browser.mouseMovementY = 0;
          } else {
            Browser.mouseMovementX = Browser.getMovementX(event);
            Browser.mouseMovementY = Browser.getMovementY(event);
          }
          
          // check if SDL is available
          if (typeof SDL != "undefined") {
          	Browser.mouseX = SDL.mouseX + Browser.mouseMovementX;
          	Browser.mouseY = SDL.mouseY + Browser.mouseMovementY;
          } else {
          	// just add the mouse delta to the current absolut mouse position
          	// FIXME: ideally this should be clamped against the canvas size and zero
          	Browser.mouseX += Browser.mouseMovementX;
          	Browser.mouseY += Browser.mouseMovementY;
          }        
        } else {
          // Otherwise, calculate the movement based on the changes
          // in the coordinates.
          var rect = Module["canvas"].getBoundingClientRect();
          var cw = Module["canvas"].width;
          var ch = Module["canvas"].height;
  
          // Neither .scrollX or .pageXOffset are defined in a spec, but
          // we prefer .scrollX because it is currently in a spec draft.
          // (see: http://www.w3.org/TR/2013/WD-cssom-view-20131217/)
          var scrollX = ((typeof window.scrollX !== 'undefined') ? window.scrollX : window.pageXOffset);
          var scrollY = ((typeof window.scrollY !== 'undefined') ? window.scrollY : window.pageYOffset);
  
          if (event.type === 'touchstart' || event.type === 'touchend' || event.type === 'touchmove') {
            var touch = event.touch;
            if (touch === undefined) {
              return; // the "touch" property is only defined in SDL
  
            }
            var adjustedX = touch.pageX - (scrollX + rect.left);
            var adjustedY = touch.pageY - (scrollY + rect.top);
  
            adjustedX = adjustedX * (cw / rect.width);
            adjustedY = adjustedY * (ch / rect.height);
  
            var coords = { x: adjustedX, y: adjustedY };
            
            if (event.type === 'touchstart') {
              Browser.lastTouches[touch.identifier] = coords;
              Browser.touches[touch.identifier] = coords;
            } else if (event.type === 'touchend' || event.type === 'touchmove') {
              var last = Browser.touches[touch.identifier];
              if (!last) last = coords;
              Browser.lastTouches[touch.identifier] = last;
              Browser.touches[touch.identifier] = coords;
            } 
            return;
          }
  
          var x = event.pageX - (scrollX + rect.left);
          var y = event.pageY - (scrollY + rect.top);
  
          // the canvas might be CSS-scaled compared to its backbuffer;
          // SDL-using content will want mouse coordinates in terms
          // of backbuffer units.
          x = x * (cw / rect.width);
          y = y * (ch / rect.height);
  
          Browser.mouseMovementX = x - Browser.mouseX;
          Browser.mouseMovementY = y - Browser.mouseY;
          Browser.mouseX = x;
          Browser.mouseY = y;
        }
      },xhrLoad:function (url, onload, onerror) {
        var xhr = new XMLHttpRequest();
        xhr.open('GET', url, true);
        xhr.responseType = 'arraybuffer';
        xhr.onload = function xhr_onload() {
          if (xhr.status == 200 || (xhr.status == 0 && xhr.response)) { // file URLs can return 0
            onload(xhr.response);
          } else {
            onerror();
          }
        };
        xhr.onerror = onerror;
        xhr.send(null);
      },asyncLoad:function (url, onload, onerror, noRunDep) {
        Browser.xhrLoad(url, function(arrayBuffer) {
          assert(arrayBuffer, 'Loading data file "' + url + '" failed (no arrayBuffer).');
          onload(new Uint8Array(arrayBuffer));
          if (!noRunDep) removeRunDependency('al ' + url);
        }, function(event) {
          if (onerror) {
            onerror();
          } else {
            throw 'Loading data file "' + url + '" failed.';
          }
        });
        if (!noRunDep) addRunDependency('al ' + url);
      },resizeListeners:[],updateResizeListeners:function () {
        var canvas = Module['canvas'];
        Browser.resizeListeners.forEach(function(listener) {
          listener(canvas.width, canvas.height);
        });
      },setCanvasSize:function (width, height, noUpdates) {
        var canvas = Module['canvas'];
        Browser.updateCanvasDimensions(canvas, width, height);
        if (!noUpdates) Browser.updateResizeListeners();
      },windowedWidth:0,windowedHeight:0,setFullScreenCanvasSize:function () {
        // check if SDL is available   
        if (typeof SDL != "undefined") {
        	var flags = HEAPU32[((SDL.screen+Runtime.QUANTUM_SIZE*0)>>2)];
        	flags = flags | 0x00800000; // set SDL_FULLSCREEN flag
        	HEAP32[((SDL.screen+Runtime.QUANTUM_SIZE*0)>>2)]=flags
        }
        Browser.updateResizeListeners();
      },setWindowedCanvasSize:function () {
        // check if SDL is available       
        if (typeof SDL != "undefined") {
        	var flags = HEAPU32[((SDL.screen+Runtime.QUANTUM_SIZE*0)>>2)];
        	flags = flags & ~0x00800000; // clear SDL_FULLSCREEN flag
        	HEAP32[((SDL.screen+Runtime.QUANTUM_SIZE*0)>>2)]=flags
        }
        Browser.updateResizeListeners();
      },updateCanvasDimensions:function (canvas, wNative, hNative) {
        if (wNative && hNative) {
          canvas.widthNative = wNative;
          canvas.heightNative = hNative;
        } else {
          wNative = canvas.widthNative;
          hNative = canvas.heightNative;
        }
        var w = wNative;
        var h = hNative;
        if (Module['forcedAspectRatio'] && Module['forcedAspectRatio'] > 0) {
          if (w/h < Module['forcedAspectRatio']) {
            w = Math.round(h * Module['forcedAspectRatio']);
          } else {
            h = Math.round(w / Module['forcedAspectRatio']);
          }
        }
        if (((document['webkitFullScreenElement'] || document['webkitFullscreenElement'] ||
             document['mozFullScreenElement'] || document['mozFullscreenElement'] ||
             document['fullScreenElement'] || document['fullscreenElement'] ||
             document['msFullScreenElement'] || document['msFullscreenElement'] ||
             document['webkitCurrentFullScreenElement']) === canvas.parentNode) && (typeof screen != 'undefined')) {
           var factor = Math.min(screen.width / w, screen.height / h);
           w = Math.round(w * factor);
           h = Math.round(h * factor);
        }
        if (Browser.resizeCanvas) {
          if (canvas.width  != w) canvas.width  = w;
          if (canvas.height != h) canvas.height = h;
          if (typeof canvas.style != 'undefined') {
            canvas.style.removeProperty( "width");
            canvas.style.removeProperty("height");
          }
        } else {
          if (canvas.width  != wNative) canvas.width  = wNative;
          if (canvas.height != hNative) canvas.height = hNative;
          if (typeof canvas.style != 'undefined') {
            if (w != wNative || h != hNative) {
              canvas.style.setProperty( "width", w + "px", "important");
              canvas.style.setProperty("height", h + "px", "important");
            } else {
              canvas.style.removeProperty( "width");
              canvas.style.removeProperty("height");
            }
          }
        }
      },wgetRequests:{},nextWgetRequestHandle:0,getNextWgetRequestHandle:function () {
        var handle = Browser.nextWgetRequestHandle;
        Browser.nextWgetRequestHandle++;
        return handle;
      }};

  
  var SYSCALLS={DEFAULT_POLLMASK:5,mappings:{},umask:511,calculateAt:function (dirfd, path) {
        if (path[0] !== '/') {
          // relative path
          var dir;
          if (dirfd === -100) {
            dir = FS.cwd();
          } else {
            var dirstream = FS.getStream(dirfd);
            if (!dirstream) throw new FS.ErrnoError(ERRNO_CODES.EBADF);
            dir = dirstream.path;
          }
          path = PATH.join2(dir, path);
        }
        return path;
      },doStat:function (func, path, buf) {
        try {
          var stat = func(path);
        } catch (e) {
          if (e && e.node && PATH.normalize(path) !== PATH.normalize(FS.getPath(e.node))) {
            // an error occurred while trying to look up the path; we should just report ENOTDIR
            return -ERRNO_CODES.ENOTDIR;
          }
          throw e;
        }
        HEAP32[((buf)>>2)]=stat.dev;
        HEAP32[(((buf)+(4))>>2)]=0;
        HEAP32[(((buf)+(8))>>2)]=stat.ino;
        HEAP32[(((buf)+(12))>>2)]=stat.mode;
        HEAP32[(((buf)+(16))>>2)]=stat.nlink;
        HEAP32[(((buf)+(20))>>2)]=stat.uid;
        HEAP32[(((buf)+(24))>>2)]=stat.gid;
        HEAP32[(((buf)+(28))>>2)]=stat.rdev;
        HEAP32[(((buf)+(32))>>2)]=0;
        HEAP32[(((buf)+(36))>>2)]=stat.size;
        HEAP32[(((buf)+(40))>>2)]=4096;
        HEAP32[(((buf)+(44))>>2)]=stat.blocks;
        HEAP32[(((buf)+(48))>>2)]=(stat.atime.getTime() / 1000)|0;
        HEAP32[(((buf)+(52))>>2)]=0;
        HEAP32[(((buf)+(56))>>2)]=(stat.mtime.getTime() / 1000)|0;
        HEAP32[(((buf)+(60))>>2)]=0;
        HEAP32[(((buf)+(64))>>2)]=(stat.ctime.getTime() / 1000)|0;
        HEAP32[(((buf)+(68))>>2)]=0;
        HEAP32[(((buf)+(72))>>2)]=stat.ino;
        return 0;
      },doMsync:function (addr, stream, len, flags) {
        var buffer = new Uint8Array(HEAPU8.subarray(addr, addr + len));
        FS.msync(stream, buffer, 0, len, flags);
      },doMkdir:function (path, mode) {
        // remove a trailing slash, if one - /a/b/ has basename of '', but
        // we want to create b in the context of this function
        path = PATH.normalize(path);
        if (path[path.length-1] === '/') path = path.substr(0, path.length-1);
        FS.mkdir(path, mode, 0);
        return 0;
      },doMknod:function (path, mode, dev) {
        // we don't want this in the JS API as it uses mknod to create all nodes.
        switch (mode & 61440) {
          case 32768:
          case 8192:
          case 24576:
          case 4096:
          case 49152:
            break;
          default: return -ERRNO_CODES.EINVAL;
        }
        FS.mknod(path, mode, dev);
        return 0;
      },doReadlink:function (path, buf, bufsize) {
        if (bufsize <= 0) return -ERRNO_CODES.EINVAL;
        var ret = FS.readlink(path);
        ret = ret.slice(0, Math.max(0, bufsize));
        writeStringToMemory(ret, buf, true);
        return ret.length;
      },doAccess:function (path, amode) {
        if (amode & ~7) {
          // need a valid mode
          return -ERRNO_CODES.EINVAL;
        }
        var node;
        var lookup = FS.lookupPath(path, { follow: true });
        node = lookup.node;
        var perms = '';
        if (amode & 4) perms += 'r';
        if (amode & 2) perms += 'w';
        if (amode & 1) perms += 'x';
        if (perms /* otherwise, they've just passed F_OK */ && FS.nodePermissions(node, perms)) {
          return -ERRNO_CODES.EACCES;
        }
        return 0;
      },doDup:function (path, flags, suggestFD) {
        var suggest = FS.getStream(suggestFD);
        if (suggest) FS.close(suggest);
        return FS.open(path, flags, 0, suggestFD, suggestFD).fd;
      },doReadv:function (stream, iov, iovcnt, offset) {
        var ret = 0;
        for (var i = 0; i < iovcnt; i++) {
          var ptr = HEAP32[(((iov)+(i*8))>>2)];
          var len = HEAP32[(((iov)+(i*8 + 4))>>2)];
          var curr = FS.read(stream, HEAP8,ptr, len, offset);
          if (curr < 0) return -1;
          ret += curr;
          if (curr < len) break; // nothing more to read
        }
        return ret;
      },doWritev:function (stream, iov, iovcnt, offset) {
        var ret = 0;
        for (var i = 0; i < iovcnt; i++) {
          var ptr = HEAP32[(((iov)+(i*8))>>2)];
          var len = HEAP32[(((iov)+(i*8 + 4))>>2)];
          var curr = FS.write(stream, HEAP8,ptr, len, offset);
          if (curr < 0) return -1;
          ret += curr;
        }
        return ret;
      },varargs:0,get:function (varargs) {
        SYSCALLS.varargs += 4;
        var ret = HEAP32[(((SYSCALLS.varargs)-(4))>>2)];
        return ret;
      },getStr:function () {
        var ret = Pointer_stringify(SYSCALLS.get());
        return ret;
      },getStreamFromFD:function () {
        var stream = FS.getStream(SYSCALLS.get());
        if (!stream) throw new FS.ErrnoError(ERRNO_CODES.EBADF);
        return stream;
      },getSocketFromFD:function () {
        var socket = SOCKFS.getSocket(SYSCALLS.get());
        if (!socket) throw new FS.ErrnoError(ERRNO_CODES.EBADF);
        return socket;
      },getSocketAddress:function (allowNull) {
        var addrp = SYSCALLS.get(), addrlen = SYSCALLS.get();
        if (allowNull && addrp === 0) return null;
        var info = __read_sockaddr(addrp, addrlen);
        if (info.errno) throw new FS.ErrnoError(info.errno);
        info.addr = DNS.lookup_addr(info.addr) || info.addr;
        return info;
      },get64:function () {
        var low = SYSCALLS.get(), high = SYSCALLS.get();
        if (low >= 0) assert(high === 0);
        else assert(high === -1);
        return low;
      },getZero:function () {
        assert(SYSCALLS.get() === 0);
      }};function ___syscall54(which, varargs) {SYSCALLS.varargs = varargs;
  try {
   // ioctl
      var stream = SYSCALLS.getStreamFromFD(), op = SYSCALLS.get();
      switch (op) {
        case 21505: {
          if (!stream.tty) return -ERRNO_CODES.ENOTTY;
          return 0;
        }
        case 21506: {
          if (!stream.tty) return -ERRNO_CODES.ENOTTY;
          return 0; // no-op, not actually adjusting terminal settings
        }
        case 21519: {
          if (!stream.tty) return -ERRNO_CODES.ENOTTY;
          var argp = SYSCALLS.get();
          HEAP32[((argp)>>2)]=0;
          return 0;
        }
        case 21520: {
          if (!stream.tty) return -ERRNO_CODES.ENOTTY;
          return -ERRNO_CODES.EINVAL; // not supported
        }
        case 21531: {
          var argp = SYSCALLS.get();
          return FS.ioctl(stream, op, argp);
        }
        default: abort('bad ioctl syscall ' + op);
      }
    } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
  }

  function _sysconf(name) {
      // long sysconf(int name);
      // http://pubs.opengroup.org/onlinepubs/009695399/functions/sysconf.html
      switch(name) {
        case 30: return PAGE_SIZE;
        case 85: return totalMemory / PAGE_SIZE;
        case 132:
        case 133:
        case 12:
        case 137:
        case 138:
        case 15:
        case 235:
        case 16:
        case 17:
        case 18:
        case 19:
        case 20:
        case 149:
        case 13:
        case 10:
        case 236:
        case 153:
        case 9:
        case 21:
        case 22:
        case 159:
        case 154:
        case 14:
        case 77:
        case 78:
        case 139:
        case 80:
        case 81:
        case 82:
        case 68:
        case 67:
        case 164:
        case 11:
        case 29:
        case 47:
        case 48:
        case 95:
        case 52:
        case 51:
        case 46:
          return 200809;
        case 79:
          return 0;
        case 27:
        case 246:
        case 127:
        case 128:
        case 23:
        case 24:
        case 160:
        case 161:
        case 181:
        case 182:
        case 242:
        case 183:
        case 184:
        case 243:
        case 244:
        case 245:
        case 165:
        case 178:
        case 179:
        case 49:
        case 50:
        case 168:
        case 169:
        case 175:
        case 170:
        case 171:
        case 172:
        case 97:
        case 76:
        case 32:
        case 173:
        case 35:
          return -1;
        case 176:
        case 177:
        case 7:
        case 155:
        case 8:
        case 157:
        case 125:
        case 126:
        case 92:
        case 93:
        case 129:
        case 130:
        case 131:
        case 94:
        case 91:
          return 1;
        case 74:
        case 60:
        case 69:
        case 70:
        case 4:
          return 1024;
        case 31:
        case 42:
        case 72:
          return 32;
        case 87:
        case 26:
        case 33:
          return 2147483647;
        case 34:
        case 1:
          return 47839;
        case 38:
        case 36:
          return 99;
        case 43:
        case 37:
          return 2048;
        case 0: return 2097152;
        case 3: return 65536;
        case 28: return 32768;
        case 44: return 32767;
        case 75: return 16384;
        case 39: return 1000;
        case 89: return 700;
        case 71: return 256;
        case 40: return 255;
        case 2: return 100;
        case 180: return 64;
        case 25: return 20;
        case 5: return 16;
        case 6: return 6;
        case 73: return 4;
        case 84: {
          if (typeof navigator === 'object') return navigator['hardwareConcurrency'] || 1;
          return 1;
        }
      }
      ___setErrNo(ERRNO_CODES.EINVAL);
      return -1;
    }

   
  Module["_bitshift64Lshr"] = _bitshift64Lshr;

  function ___syscall33(which, varargs) {SYSCALLS.varargs = varargs;
  try {
   // access
      var path = SYSCALLS.getStr(), amode = SYSCALLS.get();
      return SYSCALLS.doAccess(path, amode);
    } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
  }

  var _BDtoIHigh=true;

  function _pthread_cleanup_push(routine, arg) {
      __ATEXIT__.push(function() { Runtime.dynCall('vi', routine, [arg]) })
      _pthread_cleanup_push.level = __ATEXIT__.length;
    }

  function ___syscall10(which, varargs) {SYSCALLS.varargs = varargs;
  try {
   // unlink
      var path = SYSCALLS.getStr();
      FS.unlink(path);
      return 0;
    } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
  }

  
  
  function _emscripten_get_now() {
      if (!_emscripten_get_now.actual) {
        if (ENVIRONMENT_IS_NODE) {
          _emscripten_get_now.actual = function _emscripten_get_now_actual() {
            var t = process['hrtime']();
            return t[0] * 1e3 + t[1] / 1e6;
          }
        } else if (typeof dateNow !== 'undefined') {
          _emscripten_get_now.actual = dateNow;
        } else if (typeof self === 'object' && self['performance'] && typeof self['performance']['now'] === 'function') {
          _emscripten_get_now.actual = function _emscripten_get_now_actual() { return self['performance']['now'](); };
        } else if (typeof performance === 'object' && typeof performance['now'] === 'function') {
          _emscripten_get_now.actual = function _emscripten_get_now_actual() { return performance['now'](); };
        } else {
          _emscripten_get_now.actual = Date.now;
        }
      }
      return _emscripten_get_now.actual();
    }
  
  function _emscripten_get_now_is_monotonic() {
      // return whether emscripten_get_now is guaranteed monotonic; the Date.now
      // implementation is not :(
      return ENVIRONMENT_IS_NODE || (typeof dateNow !== 'undefined') ||
          ((ENVIRONMENT_IS_WEB || ENVIRONMENT_IS_WORKER) && self['performance'] && self['performance']['now']);
    }function _clock_gettime(clk_id, tp) {
      // int clock_gettime(clockid_t clk_id, struct timespec *tp);
      var now;
      if (clk_id === 0) {
        now = Date.now();
      } else if (clk_id === 1 && _emscripten_get_now_is_monotonic()) {
        now = _emscripten_get_now();
      } else {
        ___setErrNo(ERRNO_CODES.EINVAL);
        return -1;
      }
      HEAP32[((tp)>>2)]=(now/1000)|0; // seconds
      HEAP32[(((tp)+(4))>>2)]=((now % 1000)*1000*1000)|0; // nanoseconds
      return 0;
    }function ___clock_gettime() {
  return _clock_gettime.apply(null, arguments)
  }

  function _pthread_cleanup_pop() {
      assert(_pthread_cleanup_push.level == __ATEXIT__.length, 'cannot pop if something else added meanwhile!');
      __ATEXIT__.pop();
      _pthread_cleanup_push.level = __ATEXIT__.length;
    }

  function ___syscall5(which, varargs) {SYSCALLS.varargs = varargs;
  try {
   // open
      var pathname = SYSCALLS.getStr(), flags = SYSCALLS.get(), mode = SYSCALLS.get() // optional TODO
      var stream = FS.open(pathname, flags, mode);
      return stream.fd;
    } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
  }

  
  function _emscripten_memcpy_big(dest, src, num) {
      HEAPU8.set(HEAPU8.subarray(src, src+num), dest);
      return dest;
    } 
  Module["_memcpy"] = _memcpy;

  function ___syscall6(which, varargs) {SYSCALLS.varargs = varargs;
  try {
   // close
      var stream = SYSCALLS.getStreamFromFD();
      FS.close(stream);
      return 0;
    } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
  }

  function _sbrk(bytes) {
      // Implement a Linux-like 'memory area' for our 'process'.
      // Changes the size of the memory area by |bytes|; returns the
      // address of the previous top ('break') of the memory area
      // We control the "dynamic" memory - DYNAMIC_BASE to DYNAMICTOP
      var self = _sbrk;
      if (!self.called) {
        DYNAMICTOP = alignMemoryPage(DYNAMICTOP); // make sure we start out aligned
        self.called = true;
        assert(Runtime.dynamicAlloc);
        self.alloc = Runtime.dynamicAlloc;
        Runtime.dynamicAlloc = function() { abort('cannot dynamically allocate, sbrk now has control') };
      }
      var ret = DYNAMICTOP;
      if (bytes != 0) {
        var success = self.alloc(bytes);
        if (!success) return -1 >>> 0; // sbrk failure code
      }
      return ret;  // Previous break location.
    }

  var _BItoD=true;

  function ___syscall265(which, varargs) {SYSCALLS.varargs = varargs;
  try {
   // clock_nanosleep
      return 0;
    } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
  }

  function _time(ptr) {
      var ret = (Date.now()/1000)|0;
      if (ptr) {
        HEAP32[((ptr)>>2)]=ret;
      }
      return ret;
    }

  function _pthread_self() {
      //FIXME: assumes only a single thread
      return 0;
    }

  function ___syscall140(which, varargs) {SYSCALLS.varargs = varargs;
  try {
   // llseek
      var stream = SYSCALLS.getStreamFromFD(), offset_high = SYSCALLS.get(), offset_low = SYSCALLS.get(), result = SYSCALLS.get(), whence = SYSCALLS.get();
      var offset = offset_low;
      assert(offset_high === 0);
      FS.llseek(stream, offset, whence);
      HEAP32[((result)>>2)]=stream.position;
      if (stream.getdents && offset === 0 && whence === 0) stream.getdents = null; // reset readdir state
      return 0;
    } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
  }

  function ___syscall146(which, varargs) {SYSCALLS.varargs = varargs;
  try {
   // writev
      var stream = SYSCALLS.getStreamFromFD(), iov = SYSCALLS.get(), iovcnt = SYSCALLS.get();
      return SYSCALLS.doWritev(stream, iov, iovcnt);
    } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
  }

  function ___syscall221(which, varargs) {SYSCALLS.varargs = varargs;
  try {
   // fcntl64
      var stream = SYSCALLS.getStreamFromFD(), cmd = SYSCALLS.get();
      switch (cmd) {
        case 0: {
          var arg = SYSCALLS.get();
          if (arg < 0) {
            return -ERRNO_CODES.EINVAL;
          }
          var newStream;
          newStream = FS.open(stream.path, stream.flags, 0, arg);
          return newStream.fd;
        }
        case 1:
        case 2:
          return 0;  // FD_CLOEXEC makes no sense for a single process.
        case 3:
          return stream.flags;
        case 4: {
          var arg = SYSCALLS.get();
          stream.flags |= arg;
          return 0;
        }
        case 12:
        case 12: {
          var arg = SYSCALLS.get();
          var offset = 0;
          // We're always unlocked.
          HEAP16[(((arg)+(offset))>>1)]=2;
          return 0;
        }
        case 13:
        case 14:
        case 13:
        case 14:
          return 0; // Pretend that the locking is successful.
        case 16:
        case 8:
          return -ERRNO_CODES.EINVAL; // These are for sockets. We don't have them fully implemented yet.
        case 9:
          // musl trusts getown return values, due to a bug where they must be, as they overlap with errors. just return -1 here, so fnctl() returns that, and we set errno ourselves.
          ___setErrNo(ERRNO_CODES.EINVAL);
          return -1;
        default: {
          return -ERRNO_CODES.EINVAL;
        }
      }
    } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
  }

  function ___syscall145(which, varargs) {SYSCALLS.varargs = varargs;
  try {
   // readv
      var stream = SYSCALLS.getStreamFromFD(), iov = SYSCALLS.get(), iovcnt = SYSCALLS.get();
      return SYSCALLS.doReadv(stream, iov, iovcnt);
    } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
  }
Module["requestFullScreen"] = function Module_requestFullScreen(lockPointer, resizeCanvas, vrDevice) { Browser.requestFullScreen(lockPointer, resizeCanvas, vrDevice) };
  Module["requestAnimationFrame"] = function Module_requestAnimationFrame(func) { Browser.requestAnimationFrame(func) };
  Module["setCanvasSize"] = function Module_setCanvasSize(width, height, noUpdates) { Browser.setCanvasSize(width, height, noUpdates) };
  Module["pauseMainLoop"] = function Module_pauseMainLoop() { Browser.mainLoop.pause() };
  Module["resumeMainLoop"] = function Module_resumeMainLoop() { Browser.mainLoop.resume() };
  Module["getUserMedia"] = function Module_getUserMedia() { Browser.getUserMedia() }
  Module["createContext"] = function Module_createContext(canvas, useWebGL, setInModule, webGLContextAttributes) { return Browser.createContext(canvas, useWebGL, setInModule, webGLContextAttributes) }
FS.staticInit();__ATINIT__.unshift(function() { if (!Module["noFSInit"] && !FS.init.initialized) FS.init() });__ATMAIN__.push(function() { FS.ignorePermissions = false });__ATEXIT__.push(function() { FS.quit() });Module["FS_createFolder"] = FS.createFolder;Module["FS_createPath"] = FS.createPath;Module["FS_createDataFile"] = FS.createDataFile;Module["FS_createPreloadedFile"] = FS.createPreloadedFile;Module["FS_createLazyFile"] = FS.createLazyFile;Module["FS_createLink"] = FS.createLink;Module["FS_createDevice"] = FS.createDevice;Module["FS_unlink"] = FS.unlink;
__ATINIT__.unshift(function() { TTY.init() });__ATEXIT__.push(function() { TTY.shutdown() });
if (ENVIRONMENT_IS_NODE) { var fs = require("fs"); var NODEJS_PATH = require("path"); NODEFS.staticInit(); }
STACK_BASE = STACKTOP = Runtime.alignMemory(STATICTOP);

staticSealed = true; // seal the static portion of memory

STACK_MAX = STACK_BASE + TOTAL_STACK;

DYNAMIC_BASE = DYNAMICTOP = Runtime.alignMemory(STACK_MAX);

assert(DYNAMIC_BASE < TOTAL_MEMORY, "TOTAL_MEMORY not big enough for stack");

 var cttz_i8 = allocate([8,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,4,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,5,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,4,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,6,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,4,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,5,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,4,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,7,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,4,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,5,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,4,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,6,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,4,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,5,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,4,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0], "i8", ALLOC_DYNAMIC);


function invoke_ii(index,a1) {
  try {
    return Module["dynCall_ii"](index,a1);
  } catch(e) {
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    asm["setThrew"](1, 0);
  }
}

function invoke_iiii(index,a1,a2,a3) {
  try {
    return Module["dynCall_iiii"](index,a1,a2,a3);
  } catch(e) {
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    asm["setThrew"](1, 0);
  }
}

function invoke_vi(index,a1) {
  try {
    Module["dynCall_vi"](index,a1);
  } catch(e) {
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    asm["setThrew"](1, 0);
  }
}

Module.asmGlobalArg = { "Math": Math, "Int8Array": Int8Array, "Int16Array": Int16Array, "Int32Array": Int32Array, "Uint8Array": Uint8Array, "Uint16Array": Uint16Array, "Uint32Array": Uint32Array, "Float32Array": Float32Array, "Float64Array": Float64Array, "NaN": NaN, "Infinity": Infinity };

Module.asmLibraryArg = { "abort": abort, "assert": assert, "invoke_ii": invoke_ii, "invoke_iiii": invoke_iiii, "invoke_vi": invoke_vi, "_fabs": _fabs, "_pthread_cleanup_pop": _pthread_cleanup_pop, "_emscripten_get_now_is_monotonic": _emscripten_get_now_is_monotonic, "___syscall265": ___syscall265, "_pthread_cleanup_push": _pthread_cleanup_push, "_abort": _abort, "___setErrNo": ___setErrNo, "___assert_fail": ___assert_fail, "_clock_gettime": _clock_gettime, "_emscripten_set_main_loop_timing": _emscripten_set_main_loop_timing, "_sbrk": _sbrk, "_emscripten_memcpy_big": _emscripten_memcpy_big, "_sysconf": _sysconf, "___syscall221": ___syscall221, "_pthread_self": _pthread_self, "___syscall33": ___syscall33, "___syscall54": ___syscall54, "___unlock": ___unlock, "_emscripten_set_main_loop": _emscripten_set_main_loop, "_emscripten_get_now": _emscripten_get_now, "___syscall10": ___syscall10, "___lock": ___lock, "___syscall6": ___syscall6, "___syscall5": ___syscall5, "___clock_gettime": ___clock_gettime, "_time": _time, "___syscall140": ___syscall140, "___syscall145": ___syscall145, "___syscall146": ___syscall146, "STACKTOP": STACKTOP, "STACK_MAX": STACK_MAX, "tempDoublePtr": tempDoublePtr, "ABORT": ABORT, "cttz_i8": cttz_i8 };
// EMSCRIPTEN_START_ASM
var asm = (function(global, env, buffer) {
  'use asm';
  
  
  var HEAP8 = new global.Int8Array(buffer);
  var HEAP16 = new global.Int16Array(buffer);
  var HEAP32 = new global.Int32Array(buffer);
  var HEAPU8 = new global.Uint8Array(buffer);
  var HEAPU16 = new global.Uint16Array(buffer);
  var HEAPU32 = new global.Uint32Array(buffer);
  var HEAPF32 = new global.Float32Array(buffer);
  var HEAPF64 = new global.Float64Array(buffer);


  var STACKTOP=env.STACKTOP|0;
  var STACK_MAX=env.STACK_MAX|0;
  var tempDoublePtr=env.tempDoublePtr|0;
  var ABORT=env.ABORT|0;
  var cttz_i8=env.cttz_i8|0;

  var __THREW__ = 0;
  var threwValue = 0;
  var setjmpId = 0;
  var undef = 0;
  var nan = global.NaN, inf = global.Infinity;
  var tempInt = 0, tempBigInt = 0, tempBigIntP = 0, tempBigIntS = 0, tempBigIntR = 0.0, tempBigIntI = 0, tempBigIntD = 0, tempValue = 0, tempDouble = 0.0;

  var tempRet0 = 0;
  var tempRet1 = 0;
  var tempRet2 = 0;
  var tempRet3 = 0;
  var tempRet4 = 0;
  var tempRet5 = 0;
  var tempRet6 = 0;
  var tempRet7 = 0;
  var tempRet8 = 0;
  var tempRet9 = 0;
  var Math_floor=global.Math.floor;
  var Math_abs=global.Math.abs;
  var Math_sqrt=global.Math.sqrt;
  var Math_pow=global.Math.pow;
  var Math_cos=global.Math.cos;
  var Math_sin=global.Math.sin;
  var Math_tan=global.Math.tan;
  var Math_acos=global.Math.acos;
  var Math_asin=global.Math.asin;
  var Math_atan=global.Math.atan;
  var Math_atan2=global.Math.atan2;
  var Math_exp=global.Math.exp;
  var Math_log=global.Math.log;
  var Math_ceil=global.Math.ceil;
  var Math_imul=global.Math.imul;
  var Math_min=global.Math.min;
  var Math_clz32=global.Math.clz32;
  var abort=env.abort;
  var assert=env.assert;
  var invoke_ii=env.invoke_ii;
  var invoke_iiii=env.invoke_iiii;
  var invoke_vi=env.invoke_vi;
  var _fabs=env._fabs;
  var _pthread_cleanup_pop=env._pthread_cleanup_pop;
  var _emscripten_get_now_is_monotonic=env._emscripten_get_now_is_monotonic;
  var ___syscall265=env.___syscall265;
  var _pthread_cleanup_push=env._pthread_cleanup_push;
  var _abort=env._abort;
  var ___setErrNo=env.___setErrNo;
  var ___assert_fail=env.___assert_fail;
  var _clock_gettime=env._clock_gettime;
  var _emscripten_set_main_loop_timing=env._emscripten_set_main_loop_timing;
  var _sbrk=env._sbrk;
  var _emscripten_memcpy_big=env._emscripten_memcpy_big;
  var _sysconf=env._sysconf;
  var ___syscall221=env.___syscall221;
  var _pthread_self=env._pthread_self;
  var ___syscall33=env.___syscall33;
  var ___syscall54=env.___syscall54;
  var ___unlock=env.___unlock;
  var _emscripten_set_main_loop=env._emscripten_set_main_loop;
  var _emscripten_get_now=env._emscripten_get_now;
  var ___syscall10=env.___syscall10;
  var ___lock=env.___lock;
  var ___syscall6=env.___syscall6;
  var ___syscall5=env.___syscall5;
  var ___clock_gettime=env.___clock_gettime;
  var _time=env._time;
  var ___syscall140=env.___syscall140;
  var ___syscall145=env.___syscall145;
  var ___syscall146=env.___syscall146;
  var tempFloat = 0.0;

// EMSCRIPTEN_START_FUNCS
function _malloc($bytes) {
 $bytes = $bytes | 0;
 var $$3$i = 0, $$lcssa = 0, $$lcssa211 = 0, $$lcssa215 = 0, $$lcssa216 = 0, $$lcssa217 = 0, $$lcssa219 = 0, $$lcssa222 = 0, $$lcssa224 = 0, $$lcssa226 = 0, $$lcssa228 = 0, $$lcssa230 = 0, $$lcssa232 = 0, $$pre$phi$i$iZ2D = 0, $$pre$phi$i23$iZ2D = 0, $$pre$phi$i26Z2D = 0, $$pre$phi$iZ2D = 0, $$pre$phi58$i$iZ2D = 0, $$pre$phiZ2D = 0, $$rsize$3$i = 0, $$sum$i19$i = 0, $$sum2$i21$i = 0, $$sum3132$i$i = 0, $$sum67$i$i = 0, $100 = 0, $1000 = 0, $1002 = 0, $1005 = 0, $1010 = 0, $1016 = 0, $1019 = 0, $1020 = 0, $1027 = 0, $1039 = 0, $1044 = 0, $1051 = 0, $1052 = 0, $1053 = 0, $106 = 0, $1060 = 0, $1062 = 0, $1063 = 0, $110 = 0, $112 = 0, $113 = 0, $115 = 0, $117 = 0, $119 = 0, $12 = 0, $121 = 0, $123 = 0, $125 = 0, $127 = 0, $13 = 0, $132 = 0, $138 = 0, $14 = 0, $141 = 0, $144 = 0, $147 = 0, $148 = 0, $149 = 0, $15 = 0, $151 = 0, $154 = 0, $156 = 0, $159 = 0, $16 = 0, $161 = 0, $164 = 0, $167 = 0, $168 = 0, $17 = 0, $170 = 0, $171 = 0, $173 = 0, $174 = 0, $176 = 0, $177 = 0, $18 = 0, $182 = 0, $183 = 0, $192 = 0, $197 = 0, $201 = 0, $207 = 0, $214 = 0, $217 = 0, $225 = 0, $227 = 0, $228 = 0, $229 = 0, $230 = 0, $231 = 0, $232 = 0, $236 = 0, $237 = 0, $245 = 0, $246 = 0, $247 = 0, $249 = 0, $25 = 0, $250 = 0, $255 = 0, $256 = 0, $259 = 0, $261 = 0, $264 = 0, $269 = 0, $276 = 0, $28 = 0, $285 = 0, $286 = 0, $290 = 0, $300 = 0, $303 = 0, $307 = 0, $309 = 0, $31 = 0, $310 = 0, $312 = 0, $314 = 0, $316 = 0, $318 = 0, $320 = 0, $322 = 0, $324 = 0, $334 = 0, $335 = 0, $337 = 0, $34 = 0, $346 = 0, $348 = 0, $351 = 0, $353 = 0, $356 = 0, $358 = 0, $361 = 0, $364 = 0, $365 = 0, $367 = 0, $368 = 0, $370 = 0, $371 = 0, $373 = 0, $374 = 0, $379 = 0, $38 = 0, $380 = 0, $389 = 0, $394 = 0, $398 = 0, $4 = 0, $404 = 0, $41 = 0, $411 = 0, $414 = 0, $422 = 0, $424 = 0, $425 = 0, $426 = 0, $427 = 0, $431 = 0, $432 = 0, $438 = 0, $44 = 0, $443 = 0, $444 = 0, $447 = 0, $449 = 0, $452 = 0, $457 = 0, $46 = 0, $463 = 0, $467 = 0, $468 = 0, $47 = 0, $475 = 0, $487 = 0, $49 = 0, $492 = 0, $499 = 0, $5 = 0, $500 = 0, $501 = 0, $509 = 0, $51 = 0, $511 = 0, $512 = 0, $522 = 0, $526 = 0, $528 = 0, $529 = 0, $53 = 0, $538 = 0, $545 = 0, $546 = 0, $547 = 0, $548 = 0, $549 = 0, $55 = 0, $550 = 0, $552 = 0, $554 = 0, $555 = 0, $561 = 0, $563 = 0, $565 = 0, $57 = 0, $572 = 0, $574 = 0, $575 = 0, $576 = 0, $584 = 0, $585 = 0, $588 = 0, $59 = 0, $592 = 0, $593 = 0, $596 = 0, $598 = 0, $6 = 0, $602 = 0, $604 = 0, $608 = 0, $61 = 0, $612 = 0, $621 = 0, $622 = 0, $628 = 0, $630 = 0, $632 = 0, $635 = 0, $637 = 0, $64 = 0, $641 = 0, $642 = 0, $648 = 0, $65 = 0, $653 = 0, $655 = 0, $66 = 0, $660 = 0, $661 = 0, $662 = 0, $67 = 0, $676 = 0, $678 = 0, $68 = 0, $683 = 0, $685 = 0, $69 = 0, $690 = 0, $692 = 0, $7 = 0, $70 = 0, $702 = 0, $706 = 0, $711 = 0, $714 = 0, $719 = 0, $720 = 0, $724 = 0, $725 = 0, $730 = 0, $736 = 0, $741 = 0, $744 = 0, $745 = 0, $748 = 0, $750 = 0, $752 = 0, $755 = 0, $766 = 0, $77 = 0, $771 = 0, $773 = 0, $776 = 0, $778 = 0, $781 = 0, $784 = 0, $785 = 0, $787 = 0, $788 = 0, $790 = 0, $791 = 0, $793 = 0, $794 = 0, $799 = 0, $80 = 0, $800 = 0, $809 = 0, $81 = 0, $814 = 0, $818 = 0, $824 = 0, $832 = 0, $838 = 0, $84 = 0, $840 = 0, $841 = 0, $842 = 0, $843 = 0, $847 = 0, $848 = 0, $854 = 0, $859 = 0, $860 = 0, $863 = 0, $865 = 0, $868 = 0, $873 = 0, $879 = 0, $883 = 0, $884 = 0, $89 = 0, $891 = 0, $90 = 0, $903 = 0, $908 = 0, $91 = 0, $915 = 0, $916 = 0, $917 = 0, $92 = 0, $925 = 0, $928 = 0, $929 = 0, $93 = 0, $934 = 0, $94 = 0, $940 = 0, $941 = 0, $943 = 0, $944 = 0, $947 = 0, $95 = 0, $952 = 0, $954 = 0, $959 = 0, $960 = 0, $964 = 0, $970 = 0, $975 = 0, $977 = 0, $978 = 0, $979 = 0, $980 = 0, $984 = 0, $985 = 0, $99 = 0, $991 = 0, $996 = 0, $997 = 0, $F$0$i$i = 0, $F1$0$i = 0, $F4$0 = 0, $F4$0$i$i = 0, $F5$0$i = 0, $I1$0$i$i = 0, $I7$0$i = 0, $I7$0$i$i = 0, $K12$029$i = 0, $K2$07$i$i = 0, $K8$051$i$i = 0, $R$0$i = 0, $R$0$i$i = 0, $R$0$i$i$lcssa = 0, $R$0$i$lcssa = 0, $R$0$i18 = 0, $R$0$i18$lcssa = 0, $R$1$i = 0, $R$1$i$i = 0, $R$1$i20 = 0, $RP$0$i = 0, $RP$0$i$i = 0, $RP$0$i$i$lcssa = 0, $RP$0$i$lcssa = 0, $RP$0$i17 = 0, $RP$0$i17$lcssa = 0, $T$0$lcssa$i = 0, $T$0$lcssa$i$i = 0, $T$0$lcssa$i25$i = 0, $T$028$i = 0, $T$028$i$lcssa = 0, $T$050$i$i = 0, $T$050$i$i$lcssa = 0, $T$06$i$i = 0, $T$06$i$i$lcssa = 0, $br$0$ph$i = 0, $i$02$i$i = 0, $idx$0$i = 0, $mem$0 = 0, $nb$0 = 0, $oldfirst$0$i$i = 0, $qsize$0$i$i = 0, $rsize$0$i = 0, $rsize$0$i$lcssa = 0, $rsize$0$i15 = 0, $rsize$1$i = 0, $rsize$2$i = 0, $rsize$3$lcssa$i = 0, $rsize$331$i = 0, $rst$0$i = 0, $rst$1$i = 0, $sizebits$0$i = 0, $sp$0$i$i = 0, $sp$0$i$i$i = 0, $sp$084$i = 0, $sp$084$i$lcssa = 0, $sp$183$i = 0, $sp$183$i$lcssa = 0, $ssize$0$$i = 0, $ssize$0$i = 0, $ssize$1$ph$i = 0, $ssize$2$i = 0, $t$0$i = 0, $t$0$i14 = 0, $t$1$i = 0, $t$2$ph$i = 0, $t$2$v$3$i = 0, $t$230$i = 0, $tbase$255$i = 0, $tsize$0$ph$i = 0, $tsize$0323944$i = 0, $tsize$1$i = 0, $tsize$254$i = 0, $v$0$i = 0, $v$0$i$lcssa = 0, $v$0$i16 = 0, $v$1$i = 0, $v$2$i = 0, $v$3$lcssa$i = 0, $v$3$ph$i = 0, $v$332$i = 0, label = 0, $964$looptemp = 0;
 do {
  if ($bytes >>> 0 < 245) {
   $4 = $bytes >>> 0 < 11 ? 16 : $bytes + 11 & -8; //@line 9895
   $5 = $4 >>> 3; //@line 9896
   $6 = HEAP32[191] | 0; //@line 9897
   $7 = $6 >>> $5; //@line 9898
   if ($7 & 3) {
    $12 = ($7 & 1 ^ 1) + $5 | 0; //@line 9904
    $13 = $12 << 1; //@line 9905
    $14 = 804 + ($13 << 2) | 0; //@line 9906
    $15 = 804 + ($13 + 2 << 2) | 0; //@line 9908
    $16 = HEAP32[$15 >> 2] | 0; //@line 9909
    $17 = $16 + 8 | 0; //@line 9910
    $18 = HEAP32[$17 >> 2] | 0; //@line 9911
    do {
     if (($14 | 0) == ($18 | 0)) {
      HEAP32[191] = $6 & ~(1 << $12); //@line 9918
     } else {
      if ($18 >>> 0 < (HEAP32[195] | 0) >>> 0) {
       _abort(); //@line 9923
      }
      $25 = $18 + 12 | 0; //@line 9926
      if ((HEAP32[$25 >> 2] | 0) == ($16 | 0)) {
       HEAP32[$25 >> 2] = $14; //@line 9930
       HEAP32[$15 >> 2] = $18; //@line 9931
       break;
      } else {
       _abort(); //@line 9934
      }
     }
    } while (0);
    $28 = $12 << 3; //@line 9939
    HEAP32[$16 + 4 >> 2] = $28 | 3; //@line 9942
    $31 = $16 + ($28 | 4) | 0; //@line 9944
    HEAP32[$31 >> 2] = HEAP32[$31 >> 2] | 1; //@line 9947
    $mem$0 = $17; //@line 9948
    return $mem$0 | 0; //@line 9949
   }
   $34 = HEAP32[193] | 0; //@line 9951
   if ($4 >>> 0 > $34 >>> 0) {
    if ($7) {
     $38 = 2 << $5; //@line 9957
     $41 = $7 << $5 & ($38 | 0 - $38); //@line 9960
     $44 = ($41 & 0 - $41) + -1 | 0; //@line 9963
     $46 = $44 >>> 12 & 16; //@line 9965
     $47 = $44 >>> $46; //@line 9966
     $49 = $47 >>> 5 & 8; //@line 9968
     $51 = $47 >>> $49; //@line 9970
     $53 = $51 >>> 2 & 4; //@line 9972
     $55 = $51 >>> $53; //@line 9974
     $57 = $55 >>> 1 & 2; //@line 9976
     $59 = $55 >>> $57; //@line 9978
     $61 = $59 >>> 1 & 1; //@line 9980
     $64 = ($49 | $46 | $53 | $57 | $61) + ($59 >>> $61) | 0; //@line 9983
     $65 = $64 << 1; //@line 9984
     $66 = 804 + ($65 << 2) | 0; //@line 9985
     $67 = 804 + ($65 + 2 << 2) | 0; //@line 9987
     $68 = HEAP32[$67 >> 2] | 0; //@line 9988
     $69 = $68 + 8 | 0; //@line 9989
     $70 = HEAP32[$69 >> 2] | 0; //@line 9990
     do {
      if (($66 | 0) == ($70 | 0)) {
       HEAP32[191] = $6 & ~(1 << $64); //@line 9997
       $89 = $34; //@line 9998
      } else {
       if ($70 >>> 0 < (HEAP32[195] | 0) >>> 0) {
        _abort(); //@line 10003
       }
       $77 = $70 + 12 | 0; //@line 10006
       if ((HEAP32[$77 >> 2] | 0) == ($68 | 0)) {
        HEAP32[$77 >> 2] = $66; //@line 10010
        HEAP32[$67 >> 2] = $70; //@line 10011
        $89 = HEAP32[193] | 0; //@line 10013
        break;
       } else {
        _abort(); //@line 10016
       }
      }
     } while (0);
     $80 = $64 << 3; //@line 10021
     $81 = $80 - $4 | 0; //@line 10022
     HEAP32[$68 + 4 >> 2] = $4 | 3; //@line 10025
     $84 = $68 + $4 | 0; //@line 10026
     HEAP32[$68 + ($4 | 4) >> 2] = $81 | 1; //@line 10030
     HEAP32[$68 + $80 >> 2] = $81; //@line 10032
     if ($89) {
      $90 = HEAP32[196] | 0; //@line 10035
      $91 = $89 >>> 3; //@line 10036
      $92 = $91 << 1; //@line 10037
      $93 = 804 + ($92 << 2) | 0; //@line 10038
      $94 = HEAP32[191] | 0; //@line 10039
      $95 = 1 << $91; //@line 10040
      if (!($94 & $95)) {
       HEAP32[191] = $94 | $95; //@line 10045
       $$pre$phiZ2D = 804 + ($92 + 2 << 2) | 0; //@line 10048
       $F4$0 = $93; //@line 10048
      } else {
       $99 = 804 + ($92 + 2 << 2) | 0; //@line 10051
       $100 = HEAP32[$99 >> 2] | 0; //@line 10052
       if ($100 >>> 0 < (HEAP32[195] | 0) >>> 0) {
        _abort(); //@line 10056
       } else {
        $$pre$phiZ2D = $99; //@line 10059
        $F4$0 = $100; //@line 10059
       }
      }
      HEAP32[$$pre$phiZ2D >> 2] = $90; //@line 10062
      HEAP32[$F4$0 + 12 >> 2] = $90; //@line 10064
      HEAP32[$90 + 8 >> 2] = $F4$0; //@line 10066
      HEAP32[$90 + 12 >> 2] = $93; //@line 10068
     }
     HEAP32[193] = $81; //@line 10070
     HEAP32[196] = $84; //@line 10071
     $mem$0 = $69; //@line 10072
     return $mem$0 | 0; //@line 10073
    }
    $106 = HEAP32[192] | 0; //@line 10075
    if (!$106) {
     $nb$0 = $4; //@line 10078
    } else {
     $110 = ($106 & 0 - $106) + -1 | 0; //@line 10082
     $112 = $110 >>> 12 & 16; //@line 10084
     $113 = $110 >>> $112; //@line 10085
     $115 = $113 >>> 5 & 8; //@line 10087
     $117 = $113 >>> $115; //@line 10089
     $119 = $117 >>> 2 & 4; //@line 10091
     $121 = $117 >>> $119; //@line 10093
     $123 = $121 >>> 1 & 2; //@line 10095
     $125 = $121 >>> $123; //@line 10097
     $127 = $125 >>> 1 & 1; //@line 10099
     $132 = HEAP32[1068 + (($115 | $112 | $119 | $123 | $127) + ($125 >>> $127) << 2) >> 2] | 0; //@line 10104
     $rsize$0$i = (HEAP32[$132 + 4 >> 2] & -8) - $4 | 0; //@line 10109
     $t$0$i = $132; //@line 10109
     $v$0$i = $132; //@line 10109
     while (1) {
      $138 = HEAP32[$t$0$i + 16 >> 2] | 0; //@line 10112
      if (!$138) {
       $141 = HEAP32[$t$0$i + 20 >> 2] | 0; //@line 10116
       if (!$141) {
        $rsize$0$i$lcssa = $rsize$0$i; //@line 10119
        $v$0$i$lcssa = $v$0$i; //@line 10119
        break;
       } else {
        $144 = $141; //@line 10122
       }
      } else {
       $144 = $138; //@line 10125
      }
      $147 = (HEAP32[$144 + 4 >> 2] & -8) - $4 | 0; //@line 10130
      $148 = $147 >>> 0 < $rsize$0$i >>> 0; //@line 10131
      $rsize$0$i = $148 ? $147 : $rsize$0$i; //@line 10134
      $t$0$i = $144; //@line 10134
      $v$0$i = $148 ? $144 : $v$0$i; //@line 10134
     }
     $149 = HEAP32[195] | 0; //@line 10136
     if ($v$0$i$lcssa >>> 0 < $149 >>> 0) {
      _abort(); //@line 10139
     }
     $151 = $v$0$i$lcssa + $4 | 0; //@line 10142
     if ($v$0$i$lcssa >>> 0 >= $151 >>> 0) {
      _abort(); //@line 10145
     }
     $154 = HEAP32[$v$0$i$lcssa + 24 >> 2] | 0; //@line 10149
     $156 = HEAP32[$v$0$i$lcssa + 12 >> 2] | 0; //@line 10151
     do {
      if (($156 | 0) == ($v$0$i$lcssa | 0)) {
       $167 = $v$0$i$lcssa + 20 | 0; //@line 10155
       $168 = HEAP32[$167 >> 2] | 0; //@line 10156
       if (!$168) {
        $170 = $v$0$i$lcssa + 16 | 0; //@line 10159
        $171 = HEAP32[$170 >> 2] | 0; //@line 10160
        if (!$171) {
         $R$1$i = 0; //@line 10163
         break;
        } else {
         $R$0$i = $171; //@line 10166
         $RP$0$i = $170; //@line 10166
        }
       } else {
        $R$0$i = $168; //@line 10169
        $RP$0$i = $167; //@line 10169
       }
       while (1) {
        $173 = $R$0$i + 20 | 0; //@line 10172
        $174 = HEAP32[$173 >> 2] | 0; //@line 10173
        if ($174) {
         $R$0$i = $174; //@line 10176
         $RP$0$i = $173; //@line 10176
         continue;
        }
        $176 = $R$0$i + 16 | 0; //@line 10179
        $177 = HEAP32[$176 >> 2] | 0; //@line 10180
        if (!$177) {
         $R$0$i$lcssa = $R$0$i; //@line 10183
         $RP$0$i$lcssa = $RP$0$i; //@line 10183
         break;
        } else {
         $R$0$i = $177; //@line 10186
         $RP$0$i = $176; //@line 10186
        }
       }
       if ($RP$0$i$lcssa >>> 0 < $149 >>> 0) {
        _abort(); //@line 10191
       } else {
        HEAP32[$RP$0$i$lcssa >> 2] = 0; //@line 10194
        $R$1$i = $R$0$i$lcssa; //@line 10195
        break;
       }
      } else {
       $159 = HEAP32[$v$0$i$lcssa + 8 >> 2] | 0; //@line 10200
       if ($159 >>> 0 < $149 >>> 0) {
        _abort(); //@line 10203
       }
       $161 = $159 + 12 | 0; //@line 10206
       if ((HEAP32[$161 >> 2] | 0) != ($v$0$i$lcssa | 0)) {
        _abort(); //@line 10210
       }
       $164 = $156 + 8 | 0; //@line 10213
       if ((HEAP32[$164 >> 2] | 0) == ($v$0$i$lcssa | 0)) {
        HEAP32[$161 >> 2] = $156; //@line 10217
        HEAP32[$164 >> 2] = $159; //@line 10218
        $R$1$i = $156; //@line 10219
        break;
       } else {
        _abort(); //@line 10222
       }
      }
     } while (0);
     do {
      if ($154) {
       $182 = HEAP32[$v$0$i$lcssa + 28 >> 2] | 0; //@line 10231
       $183 = 1068 + ($182 << 2) | 0; //@line 10232
       if (($v$0$i$lcssa | 0) == (HEAP32[$183 >> 2] | 0)) {
        HEAP32[$183 >> 2] = $R$1$i; //@line 10236
        if (!$R$1$i) {
         HEAP32[192] = HEAP32[192] & ~(1 << $182); //@line 10243
         break;
        }
       } else {
        if ($154 >>> 0 < (HEAP32[195] | 0) >>> 0) {
         _abort(); //@line 10250
        }
        $192 = $154 + 16 | 0; //@line 10253
        if ((HEAP32[$192 >> 2] | 0) == ($v$0$i$lcssa | 0)) {
         HEAP32[$192 >> 2] = $R$1$i; //@line 10257
        } else {
         HEAP32[$154 + 20 >> 2] = $R$1$i; //@line 10260
        }
        if (!$R$1$i) {
         break;
        }
       }
       $197 = HEAP32[195] | 0; //@line 10267
       if ($R$1$i >>> 0 < $197 >>> 0) {
        _abort(); //@line 10270
       }
       HEAP32[$R$1$i + 24 >> 2] = $154; //@line 10274
       $201 = HEAP32[$v$0$i$lcssa + 16 >> 2] | 0; //@line 10276
       do {
        if ($201) {
         if ($201 >>> 0 < $197 >>> 0) {
          _abort(); //@line 10282
         } else {
          HEAP32[$R$1$i + 16 >> 2] = $201; //@line 10286
          HEAP32[$201 + 24 >> 2] = $R$1$i; //@line 10288
          break;
         }
        }
       } while (0);
       $207 = HEAP32[$v$0$i$lcssa + 20 >> 2] | 0; //@line 10294
       if ($207) {
        if ($207 >>> 0 < (HEAP32[195] | 0) >>> 0) {
         _abort(); //@line 10300
        } else {
         HEAP32[$R$1$i + 20 >> 2] = $207; //@line 10304
         HEAP32[$207 + 24 >> 2] = $R$1$i; //@line 10306
         break;
        }
       }
      }
     } while (0);
     if ($rsize$0$i$lcssa >>> 0 < 16) {
      $214 = $rsize$0$i$lcssa + $4 | 0; //@line 10314
      HEAP32[$v$0$i$lcssa + 4 >> 2] = $214 | 3; //@line 10317
      $217 = $v$0$i$lcssa + ($214 + 4) | 0; //@line 10319
      HEAP32[$217 >> 2] = HEAP32[$217 >> 2] | 1; //@line 10322
     } else {
      HEAP32[$v$0$i$lcssa + 4 >> 2] = $4 | 3; //@line 10326
      HEAP32[$v$0$i$lcssa + ($4 | 4) >> 2] = $rsize$0$i$lcssa | 1; //@line 10330
      HEAP32[$v$0$i$lcssa + ($rsize$0$i$lcssa + $4) >> 2] = $rsize$0$i$lcssa; //@line 10333
      $225 = HEAP32[193] | 0; //@line 10334
      if ($225) {
       $227 = HEAP32[196] | 0; //@line 10337
       $228 = $225 >>> 3; //@line 10338
       $229 = $228 << 1; //@line 10339
       $230 = 804 + ($229 << 2) | 0; //@line 10340
       $231 = HEAP32[191] | 0; //@line 10341
       $232 = 1 << $228; //@line 10342
       if (!($231 & $232)) {
        HEAP32[191] = $231 | $232; //@line 10347
        $$pre$phi$iZ2D = 804 + ($229 + 2 << 2) | 0; //@line 10350
        $F1$0$i = $230; //@line 10350
       } else {
        $236 = 804 + ($229 + 2 << 2) | 0; //@line 10353
        $237 = HEAP32[$236 >> 2] | 0; //@line 10354
        if ($237 >>> 0 < (HEAP32[195] | 0) >>> 0) {
         _abort(); //@line 10358
        } else {
         $$pre$phi$iZ2D = $236; //@line 10361
         $F1$0$i = $237; //@line 10361
        }
       }
       HEAP32[$$pre$phi$iZ2D >> 2] = $227; //@line 10364
       HEAP32[$F1$0$i + 12 >> 2] = $227; //@line 10366
       HEAP32[$227 + 8 >> 2] = $F1$0$i; //@line 10368
       HEAP32[$227 + 12 >> 2] = $230; //@line 10370
      }
      HEAP32[193] = $rsize$0$i$lcssa; //@line 10372
      HEAP32[196] = $151; //@line 10373
     }
     $mem$0 = $v$0$i$lcssa + 8 | 0; //@line 10376
     return $mem$0 | 0; //@line 10377
    }
   } else {
    $nb$0 = $4; //@line 10380
   }
  } else {
   if ($bytes >>> 0 > 4294967231) {
    $nb$0 = -1; //@line 10385
   } else {
    $245 = $bytes + 11 | 0; //@line 10387
    $246 = $245 & -8; //@line 10388
    $247 = HEAP32[192] | 0; //@line 10389
    if (!$247) {
     $nb$0 = $246; //@line 10392
    } else {
     $249 = 0 - $246 | 0; //@line 10394
     $250 = $245 >>> 8; //@line 10395
     if (!$250) {
      $idx$0$i = 0; //@line 10398
     } else {
      if ($246 >>> 0 > 16777215) {
       $idx$0$i = 31; //@line 10402
      } else {
       $255 = ($250 + 1048320 | 0) >>> 16 & 8; //@line 10406
       $256 = $250 << $255; //@line 10407
       $259 = ($256 + 520192 | 0) >>> 16 & 4; //@line 10410
       $261 = $256 << $259; //@line 10412
       $264 = ($261 + 245760 | 0) >>> 16 & 2; //@line 10415
       $269 = 14 - ($259 | $255 | $264) + ($261 << $264 >>> 15) | 0; //@line 10420
       $idx$0$i = $246 >>> ($269 + 7 | 0) & 1 | $269 << 1; //@line 10426
      }
     }
     $276 = HEAP32[1068 + ($idx$0$i << 2) >> 2] | 0; //@line 10430
     L123 : do {
      if (!$276) {
       $rsize$2$i = $249; //@line 10434
       $t$1$i = 0; //@line 10434
       $v$2$i = 0; //@line 10434
       label = 86; //@line 10435
      } else {
       $rsize$0$i15 = $249; //@line 10442
       $rst$0$i = 0; //@line 10442
       $sizebits$0$i = $246 << (($idx$0$i | 0) == 31 ? 0 : 25 - ($idx$0$i >>> 1) | 0); //@line 10442
       $t$0$i14 = $276; //@line 10442
       $v$0$i16 = 0; //@line 10442
       while (1) {
        $285 = HEAP32[$t$0$i14 + 4 >> 2] & -8; //@line 10446
        $286 = $285 - $246 | 0; //@line 10447
        if ($286 >>> 0 < $rsize$0$i15 >>> 0) {
         if (($285 | 0) == ($246 | 0)) {
          $rsize$331$i = $286; //@line 10452
          $t$230$i = $t$0$i14; //@line 10452
          $v$332$i = $t$0$i14; //@line 10452
          label = 90; //@line 10453
          break L123;
         } else {
          $rsize$1$i = $286; //@line 10456
          $v$1$i = $t$0$i14; //@line 10456
         }
        } else {
         $rsize$1$i = $rsize$0$i15; //@line 10459
         $v$1$i = $v$0$i16; //@line 10459
        }
        $290 = HEAP32[$t$0$i14 + 20 >> 2] | 0; //@line 10462
        $t$0$i14 = HEAP32[$t$0$i14 + 16 + ($sizebits$0$i >>> 31 << 2) >> 2] | 0; //@line 10465
        $rst$1$i = ($290 | 0) == 0 | ($290 | 0) == ($t$0$i14 | 0) ? $rst$0$i : $290; //@line 10469
        if (!$t$0$i14) {
         $rsize$2$i = $rsize$1$i; //@line 10473
         $t$1$i = $rst$1$i; //@line 10473
         $v$2$i = $v$1$i; //@line 10473
         label = 86; //@line 10474
         break;
        } else {
         $rsize$0$i15 = $rsize$1$i; //@line 10477
         $rst$0$i = $rst$1$i; //@line 10477
         $sizebits$0$i = $sizebits$0$i << 1; //@line 10477
         $v$0$i16 = $v$1$i; //@line 10477
        }
       }
      }
     } while (0);
     if ((label | 0) == 86) {
      if (($t$1$i | 0) == 0 & ($v$2$i | 0) == 0) {
       $300 = 2 << $idx$0$i; //@line 10487
       $303 = $247 & ($300 | 0 - $300); //@line 10490
       if (!$303) {
        $nb$0 = $246; //@line 10493
        break;
       }
       $307 = ($303 & 0 - $303) + -1 | 0; //@line 10498
       $309 = $307 >>> 12 & 16; //@line 10500
       $310 = $307 >>> $309; //@line 10501
       $312 = $310 >>> 5 & 8; //@line 10503
       $314 = $310 >>> $312; //@line 10505
       $316 = $314 >>> 2 & 4; //@line 10507
       $318 = $314 >>> $316; //@line 10509
       $320 = $318 >>> 1 & 2; //@line 10511
       $322 = $318 >>> $320; //@line 10513
       $324 = $322 >>> 1 & 1; //@line 10515
       $t$2$ph$i = HEAP32[1068 + (($312 | $309 | $316 | $320 | $324) + ($322 >>> $324) << 2) >> 2] | 0; //@line 10521
       $v$3$ph$i = 0; //@line 10521
      } else {
       $t$2$ph$i = $t$1$i; //@line 10523
       $v$3$ph$i = $v$2$i; //@line 10523
      }
      if (!$t$2$ph$i) {
       $rsize$3$lcssa$i = $rsize$2$i; //@line 10527
       $v$3$lcssa$i = $v$3$ph$i; //@line 10527
      } else {
       $rsize$331$i = $rsize$2$i; //@line 10529
       $t$230$i = $t$2$ph$i; //@line 10529
       $v$332$i = $v$3$ph$i; //@line 10529
       label = 90; //@line 10530
      }
     }
     if ((label | 0) == 90) {
      while (1) {
       label = 0; //@line 10535
       $334 = (HEAP32[$t$230$i + 4 >> 2] & -8) - $246 | 0; //@line 10539
       $335 = $334 >>> 0 < $rsize$331$i >>> 0; //@line 10540
       $$rsize$3$i = $335 ? $334 : $rsize$331$i; //@line 10541
       $t$2$v$3$i = $335 ? $t$230$i : $v$332$i; //@line 10542
       $337 = HEAP32[$t$230$i + 16 >> 2] | 0; //@line 10544
       if ($337) {
        $rsize$331$i = $$rsize$3$i; //@line 10547
        $t$230$i = $337; //@line 10547
        $v$332$i = $t$2$v$3$i; //@line 10547
        label = 90; //@line 10548
        continue;
       }
       $t$230$i = HEAP32[$t$230$i + 20 >> 2] | 0; //@line 10552
       if (!$t$230$i) {
        $rsize$3$lcssa$i = $$rsize$3$i; //@line 10555
        $v$3$lcssa$i = $t$2$v$3$i; //@line 10555
        break;
       } else {
        $rsize$331$i = $$rsize$3$i; //@line 10558
        $v$332$i = $t$2$v$3$i; //@line 10558
        label = 90; //@line 10559
       }
      }
     }
     if (!$v$3$lcssa$i) {
      $nb$0 = $246; //@line 10565
     } else {
      if ($rsize$3$lcssa$i >>> 0 < ((HEAP32[193] | 0) - $246 | 0) >>> 0) {
       $346 = HEAP32[195] | 0; //@line 10571
       if ($v$3$lcssa$i >>> 0 < $346 >>> 0) {
        _abort(); //@line 10574
       }
       $348 = $v$3$lcssa$i + $246 | 0; //@line 10577
       if ($v$3$lcssa$i >>> 0 >= $348 >>> 0) {
        _abort(); //@line 10580
       }
       $351 = HEAP32[$v$3$lcssa$i + 24 >> 2] | 0; //@line 10584
       $353 = HEAP32[$v$3$lcssa$i + 12 >> 2] | 0; //@line 10586
       do {
        if (($353 | 0) == ($v$3$lcssa$i | 0)) {
         $364 = $v$3$lcssa$i + 20 | 0; //@line 10590
         $365 = HEAP32[$364 >> 2] | 0; //@line 10591
         if (!$365) {
          $367 = $v$3$lcssa$i + 16 | 0; //@line 10594
          $368 = HEAP32[$367 >> 2] | 0; //@line 10595
          if (!$368) {
           $R$1$i20 = 0; //@line 10598
           break;
          } else {
           $R$0$i18 = $368; //@line 10601
           $RP$0$i17 = $367; //@line 10601
          }
         } else {
          $R$0$i18 = $365; //@line 10604
          $RP$0$i17 = $364; //@line 10604
         }
         while (1) {
          $370 = $R$0$i18 + 20 | 0; //@line 10607
          $371 = HEAP32[$370 >> 2] | 0; //@line 10608
          if ($371) {
           $R$0$i18 = $371; //@line 10611
           $RP$0$i17 = $370; //@line 10611
           continue;
          }
          $373 = $R$0$i18 + 16 | 0; //@line 10614
          $374 = HEAP32[$373 >> 2] | 0; //@line 10615
          if (!$374) {
           $R$0$i18$lcssa = $R$0$i18; //@line 10618
           $RP$0$i17$lcssa = $RP$0$i17; //@line 10618
           break;
          } else {
           $R$0$i18 = $374; //@line 10621
           $RP$0$i17 = $373; //@line 10621
          }
         }
         if ($RP$0$i17$lcssa >>> 0 < $346 >>> 0) {
          _abort(); //@line 10626
         } else {
          HEAP32[$RP$0$i17$lcssa >> 2] = 0; //@line 10629
          $R$1$i20 = $R$0$i18$lcssa; //@line 10630
          break;
         }
        } else {
         $356 = HEAP32[$v$3$lcssa$i + 8 >> 2] | 0; //@line 10635
         if ($356 >>> 0 < $346 >>> 0) {
          _abort(); //@line 10638
         }
         $358 = $356 + 12 | 0; //@line 10641
         if ((HEAP32[$358 >> 2] | 0) != ($v$3$lcssa$i | 0)) {
          _abort(); //@line 10645
         }
         $361 = $353 + 8 | 0; //@line 10648
         if ((HEAP32[$361 >> 2] | 0) == ($v$3$lcssa$i | 0)) {
          HEAP32[$358 >> 2] = $353; //@line 10652
          HEAP32[$361 >> 2] = $356; //@line 10653
          $R$1$i20 = $353; //@line 10654
          break;
         } else {
          _abort(); //@line 10657
         }
        }
       } while (0);
       do {
        if ($351) {
         $379 = HEAP32[$v$3$lcssa$i + 28 >> 2] | 0; //@line 10666
         $380 = 1068 + ($379 << 2) | 0; //@line 10667
         if (($v$3$lcssa$i | 0) == (HEAP32[$380 >> 2] | 0)) {
          HEAP32[$380 >> 2] = $R$1$i20; //@line 10671
          if (!$R$1$i20) {
           HEAP32[192] = HEAP32[192] & ~(1 << $379); //@line 10678
           break;
          }
         } else {
          if ($351 >>> 0 < (HEAP32[195] | 0) >>> 0) {
           _abort(); //@line 10685
          }
          $389 = $351 + 16 | 0; //@line 10688
          if ((HEAP32[$389 >> 2] | 0) == ($v$3$lcssa$i | 0)) {
           HEAP32[$389 >> 2] = $R$1$i20; //@line 10692
          } else {
           HEAP32[$351 + 20 >> 2] = $R$1$i20; //@line 10695
          }
          if (!$R$1$i20) {
           break;
          }
         }
         $394 = HEAP32[195] | 0; //@line 10702
         if ($R$1$i20 >>> 0 < $394 >>> 0) {
          _abort(); //@line 10705
         }
         HEAP32[$R$1$i20 + 24 >> 2] = $351; //@line 10709
         $398 = HEAP32[$v$3$lcssa$i + 16 >> 2] | 0; //@line 10711
         do {
          if ($398) {
           if ($398 >>> 0 < $394 >>> 0) {
            _abort(); //@line 10717
           } else {
            HEAP32[$R$1$i20 + 16 >> 2] = $398; //@line 10721
            HEAP32[$398 + 24 >> 2] = $R$1$i20; //@line 10723
            break;
           }
          }
         } while (0);
         $404 = HEAP32[$v$3$lcssa$i + 20 >> 2] | 0; //@line 10729
         if ($404) {
          if ($404 >>> 0 < (HEAP32[195] | 0) >>> 0) {
           _abort(); //@line 10735
          } else {
           HEAP32[$R$1$i20 + 20 >> 2] = $404; //@line 10739
           HEAP32[$404 + 24 >> 2] = $R$1$i20; //@line 10741
           break;
          }
         }
        }
       } while (0);
       L199 : do {
        if ($rsize$3$lcssa$i >>> 0 < 16) {
         $411 = $rsize$3$lcssa$i + $246 | 0; //@line 10750
         HEAP32[$v$3$lcssa$i + 4 >> 2] = $411 | 3; //@line 10753
         $414 = $v$3$lcssa$i + ($411 + 4) | 0; //@line 10755
         HEAP32[$414 >> 2] = HEAP32[$414 >> 2] | 1; //@line 10758
        } else {
         HEAP32[$v$3$lcssa$i + 4 >> 2] = $246 | 3; //@line 10762
         HEAP32[$v$3$lcssa$i + ($246 | 4) >> 2] = $rsize$3$lcssa$i | 1; //@line 10766
         HEAP32[$v$3$lcssa$i + ($rsize$3$lcssa$i + $246) >> 2] = $rsize$3$lcssa$i; //@line 10769
         $422 = $rsize$3$lcssa$i >>> 3; //@line 10770
         if ($rsize$3$lcssa$i >>> 0 < 256) {
          $424 = $422 << 1; //@line 10773
          $425 = 804 + ($424 << 2) | 0; //@line 10774
          $426 = HEAP32[191] | 0; //@line 10775
          $427 = 1 << $422; //@line 10776
          if (!($426 & $427)) {
           HEAP32[191] = $426 | $427; //@line 10781
           $$pre$phi$i26Z2D = 804 + ($424 + 2 << 2) | 0; //@line 10784
           $F5$0$i = $425; //@line 10784
          } else {
           $431 = 804 + ($424 + 2 << 2) | 0; //@line 10787
           $432 = HEAP32[$431 >> 2] | 0; //@line 10788
           if ($432 >>> 0 < (HEAP32[195] | 0) >>> 0) {
            _abort(); //@line 10792
           } else {
            $$pre$phi$i26Z2D = $431; //@line 10795
            $F5$0$i = $432; //@line 10795
           }
          }
          HEAP32[$$pre$phi$i26Z2D >> 2] = $348; //@line 10798
          HEAP32[$F5$0$i + 12 >> 2] = $348; //@line 10800
          HEAP32[$v$3$lcssa$i + ($246 + 8) >> 2] = $F5$0$i; //@line 10803
          HEAP32[$v$3$lcssa$i + ($246 + 12) >> 2] = $425; //@line 10806
          break;
         }
         $438 = $rsize$3$lcssa$i >>> 8; //@line 10809
         if (!$438) {
          $I7$0$i = 0; //@line 10812
         } else {
          if ($rsize$3$lcssa$i >>> 0 > 16777215) {
           $I7$0$i = 31; //@line 10816
          } else {
           $443 = ($438 + 1048320 | 0) >>> 16 & 8; //@line 10820
           $444 = $438 << $443; //@line 10821
           $447 = ($444 + 520192 | 0) >>> 16 & 4; //@line 10824
           $449 = $444 << $447; //@line 10826
           $452 = ($449 + 245760 | 0) >>> 16 & 2; //@line 10829
           $457 = 14 - ($447 | $443 | $452) + ($449 << $452 >>> 15) | 0; //@line 10834
           $I7$0$i = $rsize$3$lcssa$i >>> ($457 + 7 | 0) & 1 | $457 << 1; //@line 10840
          }
         }
         $463 = 1068 + ($I7$0$i << 2) | 0; //@line 10843
         HEAP32[$v$3$lcssa$i + ($246 + 28) >> 2] = $I7$0$i; //@line 10846
         HEAP32[$v$3$lcssa$i + ($246 + 20) >> 2] = 0; //@line 10851
         HEAP32[$v$3$lcssa$i + ($246 + 16) >> 2] = 0; //@line 10852
         $467 = HEAP32[192] | 0; //@line 10853
         $468 = 1 << $I7$0$i; //@line 10854
         if (!($467 & $468)) {
          HEAP32[192] = $467 | $468; //@line 10859
          HEAP32[$463 >> 2] = $348; //@line 10860
          HEAP32[$v$3$lcssa$i + ($246 + 24) >> 2] = $463; //@line 10863
          HEAP32[$v$3$lcssa$i + ($246 + 12) >> 2] = $348; //@line 10866
          HEAP32[$v$3$lcssa$i + ($246 + 8) >> 2] = $348; //@line 10869
          break;
         }
         $475 = HEAP32[$463 >> 2] | 0; //@line 10872
         L217 : do {
          if ((HEAP32[$475 + 4 >> 2] & -8 | 0) == ($rsize$3$lcssa$i | 0)) {
           $T$0$lcssa$i = $475; //@line 10879
          } else {
           $K12$029$i = $rsize$3$lcssa$i << (($I7$0$i | 0) == 31 ? 0 : 25 - ($I7$0$i >>> 1) | 0); //@line 10886
           $T$028$i = $475; //@line 10886
           while (1) {
            $492 = $T$028$i + 16 + ($K12$029$i >>> 31 << 2) | 0; //@line 10889
            $487 = HEAP32[$492 >> 2] | 0; //@line 10890
            if (!$487) {
             $$lcssa232 = $492; //@line 10893
             $T$028$i$lcssa = $T$028$i; //@line 10893
             break;
            }
            if ((HEAP32[$487 + 4 >> 2] & -8 | 0) == ($rsize$3$lcssa$i | 0)) {
             $T$0$lcssa$i = $487; //@line 10902
             break L217;
            } else {
             $K12$029$i = $K12$029$i << 1; //@line 10905
             $T$028$i = $487; //@line 10905
            }
           }
           if ($$lcssa232 >>> 0 < (HEAP32[195] | 0) >>> 0) {
            _abort(); //@line 10911
           } else {
            HEAP32[$$lcssa232 >> 2] = $348; //@line 10914
            HEAP32[$v$3$lcssa$i + ($246 + 24) >> 2] = $T$028$i$lcssa; //@line 10917
            HEAP32[$v$3$lcssa$i + ($246 + 12) >> 2] = $348; //@line 10920
            HEAP32[$v$3$lcssa$i + ($246 + 8) >> 2] = $348; //@line 10923
            break L199;
           }
          }
         } while (0);
         $499 = $T$0$lcssa$i + 8 | 0; //@line 10928
         $500 = HEAP32[$499 >> 2] | 0; //@line 10929
         $501 = HEAP32[195] | 0; //@line 10930
         if ($500 >>> 0 >= $501 >>> 0 & $T$0$lcssa$i >>> 0 >= $501 >>> 0) {
          HEAP32[$500 + 12 >> 2] = $348; //@line 10936
          HEAP32[$499 >> 2] = $348; //@line 10937
          HEAP32[$v$3$lcssa$i + ($246 + 8) >> 2] = $500; //@line 10940
          HEAP32[$v$3$lcssa$i + ($246 + 12) >> 2] = $T$0$lcssa$i; //@line 10943
          HEAP32[$v$3$lcssa$i + ($246 + 24) >> 2] = 0; //@line 10946
          break;
         } else {
          _abort(); //@line 10949
         }
        }
       } while (0);
       $mem$0 = $v$3$lcssa$i + 8 | 0; //@line 10955
       return $mem$0 | 0; //@line 10956
      } else {
       $nb$0 = $246; //@line 10958
      }
     }
    }
   }
  }
 } while (0);
 $509 = HEAP32[193] | 0; //@line 10965
 if ($509 >>> 0 >= $nb$0 >>> 0) {
  $511 = $509 - $nb$0 | 0; //@line 10968
  $512 = HEAP32[196] | 0; //@line 10969
  if ($511 >>> 0 > 15) {
   HEAP32[196] = $512 + $nb$0; //@line 10973
   HEAP32[193] = $511; //@line 10974
   HEAP32[$512 + ($nb$0 + 4) >> 2] = $511 | 1; //@line 10978
   HEAP32[$512 + $509 >> 2] = $511; //@line 10980
   HEAP32[$512 + 4 >> 2] = $nb$0 | 3; //@line 10983
  } else {
   HEAP32[193] = 0; //@line 10985
   HEAP32[196] = 0; //@line 10986
   HEAP32[$512 + 4 >> 2] = $509 | 3; //@line 10989
   $522 = $512 + ($509 + 4) | 0; //@line 10991
   HEAP32[$522 >> 2] = HEAP32[$522 >> 2] | 1; //@line 10994
  }
  $mem$0 = $512 + 8 | 0; //@line 10997
  return $mem$0 | 0; //@line 10998
 }
 $526 = HEAP32[194] | 0; //@line 11000
 if ($526 >>> 0 > $nb$0 >>> 0) {
  $528 = $526 - $nb$0 | 0; //@line 11003
  HEAP32[194] = $528; //@line 11004
  $529 = HEAP32[197] | 0; //@line 11005
  HEAP32[197] = $529 + $nb$0; //@line 11007
  HEAP32[$529 + ($nb$0 + 4) >> 2] = $528 | 1; //@line 11011
  HEAP32[$529 + 4 >> 2] = $nb$0 | 3; //@line 11014
  $mem$0 = $529 + 8 | 0; //@line 11016
  return $mem$0 | 0; //@line 11017
 }
 do {
  if (!(HEAP32[309] | 0)) {
   $538 = _sysconf(30) | 0; //@line 11023
   if (!($538 + -1 & $538)) {
    HEAP32[311] = $538; //@line 11028
    HEAP32[310] = $538; //@line 11029
    HEAP32[312] = -1; //@line 11030
    HEAP32[313] = -1; //@line 11031
    HEAP32[314] = 0; //@line 11032
    HEAP32[302] = 0; //@line 11033
    HEAP32[309] = (_time(0) | 0) & -16 ^ 1431655768; //@line 11037
    break;
   } else {
    _abort(); //@line 11040
   }
  }
 } while (0);
 $545 = $nb$0 + 48 | 0; //@line 11045
 $546 = HEAP32[311] | 0; //@line 11046
 $547 = $nb$0 + 47 | 0; //@line 11047
 $548 = $546 + $547 | 0; //@line 11048
 $549 = 0 - $546 | 0; //@line 11049
 $550 = $548 & $549; //@line 11050
 if ($550 >>> 0 <= $nb$0 >>> 0) {
  $mem$0 = 0; //@line 11053
  return $mem$0 | 0; //@line 11054
 }
 $552 = HEAP32[301] | 0; //@line 11056
 if ($552) {
  $554 = HEAP32[299] | 0; //@line 11059
  $555 = $554 + $550 | 0; //@line 11060
  if ($555 >>> 0 <= $554 >>> 0 | $555 >>> 0 > $552 >>> 0) {
   $mem$0 = 0; //@line 11065
   return $mem$0 | 0; //@line 11066
  }
 }
 L258 : do {
  if (!(HEAP32[302] & 4)) {
   $561 = HEAP32[197] | 0; //@line 11074
   L260 : do {
    if (!$561) {
     label = 174; //@line 11078
    } else {
     $sp$0$i$i = 1212; //@line 11080
     while (1) {
      $563 = HEAP32[$sp$0$i$i >> 2] | 0; //@line 11082
      if ($563 >>> 0 <= $561 >>> 0) {
       $565 = $sp$0$i$i + 4 | 0; //@line 11085
       if (($563 + (HEAP32[$565 >> 2] | 0) | 0) >>> 0 > $561 >>> 0) {
        $$lcssa228 = $sp$0$i$i; //@line 11090
        $$lcssa230 = $565; //@line 11090
        break;
       }
      }
      $sp$0$i$i = HEAP32[$sp$0$i$i + 8 >> 2] | 0; //@line 11095
      if (!$sp$0$i$i) {
       label = 174; //@line 11098
       break L260;
      }
     }
     $596 = $548 - (HEAP32[194] | 0) & $549; //@line 11106
     if ($596 >>> 0 < 2147483647) {
      $598 = _sbrk($596 | 0) | 0; //@line 11109
      $602 = ($598 | 0) == ((HEAP32[$$lcssa228 >> 2] | 0) + (HEAP32[$$lcssa230 >> 2] | 0) | 0); //@line 11113
      $$3$i = $602 ? $596 : 0; //@line 11114
      if ($602) {
       if (($598 | 0) == (-1 | 0)) {
        $tsize$0323944$i = $$3$i; //@line 11118
       } else {
        $tbase$255$i = $598; //@line 11120
        $tsize$254$i = $$3$i; //@line 11120
        label = 194; //@line 11121
        break L258;
       }
      } else {
       $br$0$ph$i = $598; //@line 11125
       $ssize$1$ph$i = $596; //@line 11125
       $tsize$0$ph$i = $$3$i; //@line 11125
       label = 184; //@line 11126
      }
     } else {
      $tsize$0323944$i = 0; //@line 11129
     }
    }
   } while (0);
   do {
    if ((label | 0) == 174) {
     $572 = _sbrk(0) | 0; //@line 11135
     if (($572 | 0) == (-1 | 0)) {
      $tsize$0323944$i = 0; //@line 11138
     } else {
      $574 = $572; //@line 11140
      $575 = HEAP32[310] | 0; //@line 11141
      $576 = $575 + -1 | 0; //@line 11142
      if (!($576 & $574)) {
       $ssize$0$i = $550; //@line 11146
      } else {
       $ssize$0$i = $550 - $574 + ($576 + $574 & 0 - $575) | 0; //@line 11153
      }
      $584 = HEAP32[299] | 0; //@line 11155
      $585 = $584 + $ssize$0$i | 0; //@line 11156
      if ($ssize$0$i >>> 0 > $nb$0 >>> 0 & $ssize$0$i >>> 0 < 2147483647) {
       $588 = HEAP32[301] | 0; //@line 11161
       if ($588) {
        if ($585 >>> 0 <= $584 >>> 0 | $585 >>> 0 > $588 >>> 0) {
         $tsize$0323944$i = 0; //@line 11168
         break;
        }
       }
       $592 = _sbrk($ssize$0$i | 0) | 0; //@line 11172
       $593 = ($592 | 0) == ($572 | 0); //@line 11173
       $ssize$0$$i = $593 ? $ssize$0$i : 0; //@line 11174
       if ($593) {
        $tbase$255$i = $572; //@line 11176
        $tsize$254$i = $ssize$0$$i; //@line 11176
        label = 194; //@line 11177
        break L258;
       } else {
        $br$0$ph$i = $592; //@line 11180
        $ssize$1$ph$i = $ssize$0$i; //@line 11180
        $tsize$0$ph$i = $ssize$0$$i; //@line 11180
        label = 184; //@line 11181
       }
      } else {
       $tsize$0323944$i = 0; //@line 11184
      }
     }
    }
   } while (0);
   L280 : do {
    if ((label | 0) == 184) {
     $604 = 0 - $ssize$1$ph$i | 0; //@line 11191
     do {
      if ($545 >>> 0 > $ssize$1$ph$i >>> 0 & ($ssize$1$ph$i >>> 0 < 2147483647 & ($br$0$ph$i | 0) != (-1 | 0))) {
       $608 = HEAP32[311] | 0; //@line 11199
       $612 = $547 - $ssize$1$ph$i + $608 & 0 - $608; //@line 11203
       if ($612 >>> 0 < 2147483647) {
        if ((_sbrk($612 | 0) | 0) == (-1 | 0)) {
         _sbrk($604 | 0) | 0; //@line 11209
         $tsize$0323944$i = $tsize$0$ph$i; //@line 11210
         break L280;
        } else {
         $ssize$2$i = $612 + $ssize$1$ph$i | 0; //@line 11214
         break;
        }
       } else {
        $ssize$2$i = $ssize$1$ph$i; //@line 11218
       }
      } else {
       $ssize$2$i = $ssize$1$ph$i; //@line 11221
      }
     } while (0);
     if (($br$0$ph$i | 0) == (-1 | 0)) {
      $tsize$0323944$i = $tsize$0$ph$i; //@line 11226
     } else {
      $tbase$255$i = $br$0$ph$i; //@line 11228
      $tsize$254$i = $ssize$2$i; //@line 11228
      label = 194; //@line 11229
      break L258;
     }
    }
   } while (0);
   HEAP32[302] = HEAP32[302] | 4; //@line 11236
   $tsize$1$i = $tsize$0323944$i; //@line 11237
   label = 191; //@line 11238
  } else {
   $tsize$1$i = 0; //@line 11240
   label = 191; //@line 11241
  }
 } while (0);
 if ((label | 0) == 191) {
  if ($550 >>> 0 < 2147483647) {
   $621 = _sbrk($550 | 0) | 0; //@line 11247
   $622 = _sbrk(0) | 0; //@line 11248
   if ($621 >>> 0 < $622 >>> 0 & (($621 | 0) != (-1 | 0) & ($622 | 0) != (-1 | 0))) {
    $628 = $622 - $621 | 0; //@line 11257
    $630 = $628 >>> 0 > ($nb$0 + 40 | 0) >>> 0; //@line 11259
    if ($630) {
     $tbase$255$i = $621; //@line 11262
     $tsize$254$i = $630 ? $628 : $tsize$1$i; //@line 11262
     label = 194; //@line 11263
    }
   }
  }
 }
 if ((label | 0) == 194) {
  $632 = (HEAP32[299] | 0) + $tsize$254$i | 0; //@line 11270
  HEAP32[299] = $632; //@line 11271
  if ($632 >>> 0 > (HEAP32[300] | 0) >>> 0) {
   HEAP32[300] = $632; //@line 11275
  }
  $635 = HEAP32[197] | 0; //@line 11277
  L299 : do {
   if (!$635) {
    $637 = HEAP32[195] | 0; //@line 11281
    if (($637 | 0) == 0 | $tbase$255$i >>> 0 < $637 >>> 0) {
     HEAP32[195] = $tbase$255$i; //@line 11286
    }
    HEAP32[303] = $tbase$255$i; //@line 11288
    HEAP32[304] = $tsize$254$i; //@line 11289
    HEAP32[306] = 0; //@line 11290
    HEAP32[200] = HEAP32[309]; //@line 11292
    HEAP32[199] = -1; //@line 11293
    $i$02$i$i = 0; //@line 11294
    do {
     $641 = $i$02$i$i << 1; //@line 11296
     $642 = 804 + ($641 << 2) | 0; //@line 11297
     HEAP32[804 + ($641 + 3 << 2) >> 2] = $642; //@line 11300
     HEAP32[804 + ($641 + 2 << 2) >> 2] = $642; //@line 11303
     $i$02$i$i = $i$02$i$i + 1 | 0; //@line 11304
    } while (($i$02$i$i | 0) != 32);
    $648 = $tbase$255$i + 8 | 0; //@line 11314
    $653 = ($648 & 7 | 0) == 0 ? 0 : 0 - $648 & 7; //@line 11319
    $655 = $tsize$254$i + -40 - $653 | 0; //@line 11321
    HEAP32[197] = $tbase$255$i + $653; //@line 11322
    HEAP32[194] = $655; //@line 11323
    HEAP32[$tbase$255$i + ($653 + 4) >> 2] = $655 | 1; //@line 11327
    HEAP32[$tbase$255$i + ($tsize$254$i + -36) >> 2] = 40; //@line 11330
    HEAP32[198] = HEAP32[313]; //@line 11332
   } else {
    $sp$084$i = 1212; //@line 11334
    do {
     $660 = HEAP32[$sp$084$i >> 2] | 0; //@line 11336
     $661 = $sp$084$i + 4 | 0; //@line 11337
     $662 = HEAP32[$661 >> 2] | 0; //@line 11338
     if (($tbase$255$i | 0) == ($660 + $662 | 0)) {
      $$lcssa222 = $660; //@line 11342
      $$lcssa224 = $661; //@line 11342
      $$lcssa226 = $662; //@line 11342
      $sp$084$i$lcssa = $sp$084$i; //@line 11342
      label = 204; //@line 11343
      break;
     }
     $sp$084$i = HEAP32[$sp$084$i + 8 >> 2] | 0; //@line 11347
    } while (($sp$084$i | 0) != 0);
    if ((label | 0) == 204) {
     if (!(HEAP32[$sp$084$i$lcssa + 12 >> 2] & 8)) {
      if ($635 >>> 0 < $tbase$255$i >>> 0 & $635 >>> 0 >= $$lcssa222 >>> 0) {
       HEAP32[$$lcssa224 >> 2] = $$lcssa226 + $tsize$254$i; //@line 11366
       $676 = (HEAP32[194] | 0) + $tsize$254$i | 0; //@line 11368
       $678 = $635 + 8 | 0; //@line 11370
       $683 = ($678 & 7 | 0) == 0 ? 0 : 0 - $678 & 7; //@line 11375
       $685 = $676 - $683 | 0; //@line 11377
       HEAP32[197] = $635 + $683; //@line 11378
       HEAP32[194] = $685; //@line 11379
       HEAP32[$635 + ($683 + 4) >> 2] = $685 | 1; //@line 11383
       HEAP32[$635 + ($676 + 4) >> 2] = 40; //@line 11386
       HEAP32[198] = HEAP32[313]; //@line 11388
       break;
      }
     }
    }
    $690 = HEAP32[195] | 0; //@line 11393
    if ($tbase$255$i >>> 0 < $690 >>> 0) {
     HEAP32[195] = $tbase$255$i; //@line 11396
     $755 = $tbase$255$i; //@line 11397
    } else {
     $755 = $690; //@line 11399
    }
    $692 = $tbase$255$i + $tsize$254$i | 0; //@line 11401
    $sp$183$i = 1212; //@line 11402
    while (1) {
     if ((HEAP32[$sp$183$i >> 2] | 0) == ($692 | 0)) {
      $$lcssa219 = $sp$183$i; //@line 11407
      $sp$183$i$lcssa = $sp$183$i; //@line 11407
      label = 212; //@line 11408
      break;
     }
     $sp$183$i = HEAP32[$sp$183$i + 8 >> 2] | 0; //@line 11412
     if (!$sp$183$i) {
      $sp$0$i$i$i = 1212; //@line 11415
      break;
     }
    }
    if ((label | 0) == 212) {
     if (!(HEAP32[$sp$183$i$lcssa + 12 >> 2] & 8)) {
      HEAP32[$$lcssa219 >> 2] = $tbase$255$i; //@line 11427
      $702 = $sp$183$i$lcssa + 4 | 0; //@line 11428
      HEAP32[$702 >> 2] = (HEAP32[$702 >> 2] | 0) + $tsize$254$i; //@line 11431
      $706 = $tbase$255$i + 8 | 0; //@line 11433
      $711 = ($706 & 7 | 0) == 0 ? 0 : 0 - $706 & 7; //@line 11438
      $714 = $tbase$255$i + ($tsize$254$i + 8) | 0; //@line 11442
      $719 = ($714 & 7 | 0) == 0 ? 0 : 0 - $714 & 7; //@line 11447
      $720 = $tbase$255$i + ($719 + $tsize$254$i) | 0; //@line 11449
      $$sum$i19$i = $711 + $nb$0 | 0; //@line 11453
      $724 = $tbase$255$i + $$sum$i19$i | 0; //@line 11454
      $725 = $720 - ($tbase$255$i + $711) - $nb$0 | 0; //@line 11455
      HEAP32[$tbase$255$i + ($711 + 4) >> 2] = $nb$0 | 3; //@line 11459
      L324 : do {
       if (($720 | 0) == ($635 | 0)) {
        $730 = (HEAP32[194] | 0) + $725 | 0; //@line 11464
        HEAP32[194] = $730; //@line 11465
        HEAP32[197] = $724; //@line 11466
        HEAP32[$tbase$255$i + ($$sum$i19$i + 4) >> 2] = $730 | 1; //@line 11470
       } else {
        if (($720 | 0) == (HEAP32[196] | 0)) {
         $736 = (HEAP32[193] | 0) + $725 | 0; //@line 11476
         HEAP32[193] = $736; //@line 11477
         HEAP32[196] = $724; //@line 11478
         HEAP32[$tbase$255$i + ($$sum$i19$i + 4) >> 2] = $736 | 1; //@line 11482
         HEAP32[$tbase$255$i + ($736 + $$sum$i19$i) >> 2] = $736; //@line 11485
         break;
        }
        $$sum2$i21$i = $tsize$254$i + 4 | 0; //@line 11488
        $741 = HEAP32[$tbase$255$i + ($$sum2$i21$i + $719) >> 2] | 0; //@line 11491
        if (($741 & 3 | 0) == 1) {
         $744 = $741 & -8; //@line 11495
         $745 = $741 >>> 3; //@line 11496
         L332 : do {
          if ($741 >>> 0 < 256) {
           $748 = HEAP32[$tbase$255$i + (($719 | 8) + $tsize$254$i) >> 2] | 0; //@line 11503
           $750 = HEAP32[$tbase$255$i + ($tsize$254$i + 12 + $719) >> 2] | 0; //@line 11507
           $752 = 804 + ($745 << 1 << 2) | 0; //@line 11509
           do {
            if (($748 | 0) != ($752 | 0)) {
             if ($748 >>> 0 < $755 >>> 0) {
              _abort(); //@line 11515
             }
             if ((HEAP32[$748 + 12 >> 2] | 0) == ($720 | 0)) {
              break;
             }
             _abort(); //@line 11524
            }
           } while (0);
           if (($750 | 0) == ($748 | 0)) {
            HEAP32[191] = HEAP32[191] & ~(1 << $745); //@line 11534
            break;
           }
           do {
            if (($750 | 0) == ($752 | 0)) {
             $$pre$phi58$i$iZ2D = $750 + 8 | 0; //@line 11541
            } else {
             if ($750 >>> 0 < $755 >>> 0) {
              _abort(); //@line 11545
             }
             $766 = $750 + 8 | 0; //@line 11548
             if ((HEAP32[$766 >> 2] | 0) == ($720 | 0)) {
              $$pre$phi58$i$iZ2D = $766; //@line 11552
              break;
             }
             _abort(); //@line 11555
            }
           } while (0);
           HEAP32[$748 + 12 >> 2] = $750; //@line 11560
           HEAP32[$$pre$phi58$i$iZ2D >> 2] = $748; //@line 11561
          } else {
           $771 = HEAP32[$tbase$255$i + (($719 | 24) + $tsize$254$i) >> 2] | 0; //@line 11566
           $773 = HEAP32[$tbase$255$i + ($tsize$254$i + 12 + $719) >> 2] | 0; //@line 11570
           do {
            if (($773 | 0) == ($720 | 0)) {
             $$sum67$i$i = $719 | 16; //@line 11574
             $784 = $tbase$255$i + ($$sum2$i21$i + $$sum67$i$i) | 0; //@line 11576
             $785 = HEAP32[$784 >> 2] | 0; //@line 11577
             if (!$785) {
              $787 = $tbase$255$i + ($$sum67$i$i + $tsize$254$i) | 0; //@line 11581
              $788 = HEAP32[$787 >> 2] | 0; //@line 11582
              if (!$788) {
               $R$1$i$i = 0; //@line 11585
               break;
              } else {
               $R$0$i$i = $788; //@line 11588
               $RP$0$i$i = $787; //@line 11588
              }
             } else {
              $R$0$i$i = $785; //@line 11591
              $RP$0$i$i = $784; //@line 11591
             }
             while (1) {
              $790 = $R$0$i$i + 20 | 0; //@line 11594
              $791 = HEAP32[$790 >> 2] | 0; //@line 11595
              if ($791) {
               $R$0$i$i = $791; //@line 11598
               $RP$0$i$i = $790; //@line 11598
               continue;
              }
              $793 = $R$0$i$i + 16 | 0; //@line 11601
              $794 = HEAP32[$793 >> 2] | 0; //@line 11602
              if (!$794) {
               $R$0$i$i$lcssa = $R$0$i$i; //@line 11605
               $RP$0$i$i$lcssa = $RP$0$i$i; //@line 11605
               break;
              } else {
               $R$0$i$i = $794; //@line 11608
               $RP$0$i$i = $793; //@line 11608
              }
             }
             if ($RP$0$i$i$lcssa >>> 0 < $755 >>> 0) {
              _abort(); //@line 11613
             } else {
              HEAP32[$RP$0$i$i$lcssa >> 2] = 0; //@line 11616
              $R$1$i$i = $R$0$i$i$lcssa; //@line 11617
              break;
             }
            } else {
             $776 = HEAP32[$tbase$255$i + (($719 | 8) + $tsize$254$i) >> 2] | 0; //@line 11624
             if ($776 >>> 0 < $755 >>> 0) {
              _abort(); //@line 11627
             }
             $778 = $776 + 12 | 0; //@line 11630
             if ((HEAP32[$778 >> 2] | 0) != ($720 | 0)) {
              _abort(); //@line 11634
             }
             $781 = $773 + 8 | 0; //@line 11637
             if ((HEAP32[$781 >> 2] | 0) == ($720 | 0)) {
              HEAP32[$778 >> 2] = $773; //@line 11641
              HEAP32[$781 >> 2] = $776; //@line 11642
              $R$1$i$i = $773; //@line 11643
              break;
             } else {
              _abort(); //@line 11646
             }
            }
           } while (0);
           if (!$771) {
            break;
           }
           $799 = HEAP32[$tbase$255$i + ($tsize$254$i + 28 + $719) >> 2] | 0; //@line 11658
           $800 = 1068 + ($799 << 2) | 0; //@line 11659
           do {
            if (($720 | 0) == (HEAP32[$800 >> 2] | 0)) {
             HEAP32[$800 >> 2] = $R$1$i$i; //@line 11664
             if ($R$1$i$i) {
              break;
             }
             HEAP32[192] = HEAP32[192] & ~(1 << $799); //@line 11673
             break L332;
            } else {
             if ($771 >>> 0 < (HEAP32[195] | 0) >>> 0) {
              _abort(); //@line 11679
             }
             $809 = $771 + 16 | 0; //@line 11682
             if ((HEAP32[$809 >> 2] | 0) == ($720 | 0)) {
              HEAP32[$809 >> 2] = $R$1$i$i; //@line 11686
             } else {
              HEAP32[$771 + 20 >> 2] = $R$1$i$i; //@line 11689
             }
             if (!$R$1$i$i) {
              break L332;
             }
            }
           } while (0);
           $814 = HEAP32[195] | 0; //@line 11697
           if ($R$1$i$i >>> 0 < $814 >>> 0) {
            _abort(); //@line 11700
           }
           HEAP32[$R$1$i$i + 24 >> 2] = $771; //@line 11704
           $$sum3132$i$i = $719 | 16; //@line 11705
           $818 = HEAP32[$tbase$255$i + ($$sum3132$i$i + $tsize$254$i) >> 2] | 0; //@line 11708
           do {
            if ($818) {
             if ($818 >>> 0 < $814 >>> 0) {
              _abort(); //@line 11714
             } else {
              HEAP32[$R$1$i$i + 16 >> 2] = $818; //@line 11718
              HEAP32[$818 + 24 >> 2] = $R$1$i$i; //@line 11720
              break;
             }
            }
           } while (0);
           $824 = HEAP32[$tbase$255$i + ($$sum2$i21$i + $$sum3132$i$i) >> 2] | 0; //@line 11727
           if (!$824) {
            break;
           }
           if ($824 >>> 0 < (HEAP32[195] | 0) >>> 0) {
            _abort(); //@line 11735
           } else {
            HEAP32[$R$1$i$i + 20 >> 2] = $824; //@line 11739
            HEAP32[$824 + 24 >> 2] = $R$1$i$i; //@line 11741
            break;
           }
          }
         } while (0);
         $oldfirst$0$i$i = $tbase$255$i + (($744 | $719) + $tsize$254$i) | 0; //@line 11750
         $qsize$0$i$i = $744 + $725 | 0; //@line 11750
        } else {
         $oldfirst$0$i$i = $720; //@line 11752
         $qsize$0$i$i = $725; //@line 11752
        }
        $832 = $oldfirst$0$i$i + 4 | 0; //@line 11754
        HEAP32[$832 >> 2] = HEAP32[$832 >> 2] & -2; //@line 11757
        HEAP32[$tbase$255$i + ($$sum$i19$i + 4) >> 2] = $qsize$0$i$i | 1; //@line 11761
        HEAP32[$tbase$255$i + ($qsize$0$i$i + $$sum$i19$i) >> 2] = $qsize$0$i$i; //@line 11764
        $838 = $qsize$0$i$i >>> 3; //@line 11765
        if ($qsize$0$i$i >>> 0 < 256) {
         $840 = $838 << 1; //@line 11768
         $841 = 804 + ($840 << 2) | 0; //@line 11769
         $842 = HEAP32[191] | 0; //@line 11770
         $843 = 1 << $838; //@line 11771
         do {
          if (!($842 & $843)) {
           HEAP32[191] = $842 | $843; //@line 11777
           $$pre$phi$i23$iZ2D = 804 + ($840 + 2 << 2) | 0; //@line 11780
           $F4$0$i$i = $841; //@line 11780
          } else {
           $847 = 804 + ($840 + 2 << 2) | 0; //@line 11783
           $848 = HEAP32[$847 >> 2] | 0; //@line 11784
           if ($848 >>> 0 >= (HEAP32[195] | 0) >>> 0) {
            $$pre$phi$i23$iZ2D = $847; //@line 11788
            $F4$0$i$i = $848; //@line 11788
            break;
           }
           _abort(); //@line 11791
          }
         } while (0);
         HEAP32[$$pre$phi$i23$iZ2D >> 2] = $724; //@line 11795
         HEAP32[$F4$0$i$i + 12 >> 2] = $724; //@line 11797
         HEAP32[$tbase$255$i + ($$sum$i19$i + 8) >> 2] = $F4$0$i$i; //@line 11800
         HEAP32[$tbase$255$i + ($$sum$i19$i + 12) >> 2] = $841; //@line 11803
         break;
        }
        $854 = $qsize$0$i$i >>> 8; //@line 11806
        do {
         if (!$854) {
          $I7$0$i$i = 0; //@line 11810
         } else {
          if ($qsize$0$i$i >>> 0 > 16777215) {
           $I7$0$i$i = 31; //@line 11814
           break;
          }
          $859 = ($854 + 1048320 | 0) >>> 16 & 8; //@line 11819
          $860 = $854 << $859; //@line 11820
          $863 = ($860 + 520192 | 0) >>> 16 & 4; //@line 11823
          $865 = $860 << $863; //@line 11825
          $868 = ($865 + 245760 | 0) >>> 16 & 2; //@line 11828
          $873 = 14 - ($863 | $859 | $868) + ($865 << $868 >>> 15) | 0; //@line 11833
          $I7$0$i$i = $qsize$0$i$i >>> ($873 + 7 | 0) & 1 | $873 << 1; //@line 11839
         }
        } while (0);
        $879 = 1068 + ($I7$0$i$i << 2) | 0; //@line 11842
        HEAP32[$tbase$255$i + ($$sum$i19$i + 28) >> 2] = $I7$0$i$i; //@line 11845
        HEAP32[$tbase$255$i + ($$sum$i19$i + 20) >> 2] = 0; //@line 11850
        HEAP32[$tbase$255$i + ($$sum$i19$i + 16) >> 2] = 0; //@line 11851
        $883 = HEAP32[192] | 0; //@line 11852
        $884 = 1 << $I7$0$i$i; //@line 11853
        if (!($883 & $884)) {
         HEAP32[192] = $883 | $884; //@line 11858
         HEAP32[$879 >> 2] = $724; //@line 11859
         HEAP32[$tbase$255$i + ($$sum$i19$i + 24) >> 2] = $879; //@line 11862
         HEAP32[$tbase$255$i + ($$sum$i19$i + 12) >> 2] = $724; //@line 11865
         HEAP32[$tbase$255$i + ($$sum$i19$i + 8) >> 2] = $724; //@line 11868
         break;
        }
        $891 = HEAP32[$879 >> 2] | 0; //@line 11871
        L418 : do {
         if ((HEAP32[$891 + 4 >> 2] & -8 | 0) == ($qsize$0$i$i | 0)) {
          $T$0$lcssa$i25$i = $891; //@line 11878
         } else {
          $K8$051$i$i = $qsize$0$i$i << (($I7$0$i$i | 0) == 31 ? 0 : 25 - ($I7$0$i$i >>> 1) | 0); //@line 11885
          $T$050$i$i = $891; //@line 11885
          while (1) {
           $908 = $T$050$i$i + 16 + ($K8$051$i$i >>> 31 << 2) | 0; //@line 11888
           $903 = HEAP32[$908 >> 2] | 0; //@line 11889
           if (!$903) {
            $$lcssa = $908; //@line 11892
            $T$050$i$i$lcssa = $T$050$i$i; //@line 11892
            break;
           }
           if ((HEAP32[$903 + 4 >> 2] & -8 | 0) == ($qsize$0$i$i | 0)) {
            $T$0$lcssa$i25$i = $903; //@line 11901
            break L418;
           } else {
            $K8$051$i$i = $K8$051$i$i << 1; //@line 11904
            $T$050$i$i = $903; //@line 11904
           }
          }
          if ($$lcssa >>> 0 < (HEAP32[195] | 0) >>> 0) {
           _abort(); //@line 11910
          } else {
           HEAP32[$$lcssa >> 2] = $724; //@line 11913
           HEAP32[$tbase$255$i + ($$sum$i19$i + 24) >> 2] = $T$050$i$i$lcssa; //@line 11916
           HEAP32[$tbase$255$i + ($$sum$i19$i + 12) >> 2] = $724; //@line 11919
           HEAP32[$tbase$255$i + ($$sum$i19$i + 8) >> 2] = $724; //@line 11922
           break L324;
          }
         }
        } while (0);
        $915 = $T$0$lcssa$i25$i + 8 | 0; //@line 11927
        $916 = HEAP32[$915 >> 2] | 0; //@line 11928
        $917 = HEAP32[195] | 0; //@line 11929
        if ($916 >>> 0 >= $917 >>> 0 & $T$0$lcssa$i25$i >>> 0 >= $917 >>> 0) {
         HEAP32[$916 + 12 >> 2] = $724; //@line 11935
         HEAP32[$915 >> 2] = $724; //@line 11936
         HEAP32[$tbase$255$i + ($$sum$i19$i + 8) >> 2] = $916; //@line 11939
         HEAP32[$tbase$255$i + ($$sum$i19$i + 12) >> 2] = $T$0$lcssa$i25$i; //@line 11942
         HEAP32[$tbase$255$i + ($$sum$i19$i + 24) >> 2] = 0; //@line 11945
         break;
        } else {
         _abort(); //@line 11948
        }
       }
      } while (0);
      $mem$0 = $tbase$255$i + ($711 | 8) | 0; //@line 11955
      return $mem$0 | 0; //@line 11956
     } else {
      $sp$0$i$i$i = 1212; //@line 11958
     }
    }
    while (1) {
     $925 = HEAP32[$sp$0$i$i$i >> 2] | 0; //@line 11962
     if ($925 >>> 0 <= $635 >>> 0) {
      $928 = HEAP32[$sp$0$i$i$i + 4 >> 2] | 0; //@line 11966
      $929 = $925 + $928 | 0; //@line 11967
      if ($929 >>> 0 > $635 >>> 0) {
       $$lcssa215 = $925; //@line 11970
       $$lcssa216 = $928; //@line 11970
       $$lcssa217 = $929; //@line 11970
       break;
      }
     }
     $sp$0$i$i$i = HEAP32[$sp$0$i$i$i + 8 >> 2] | 0; //@line 11976
    }
    $934 = $$lcssa215 + ($$lcssa216 + -39) | 0; //@line 11981
    $940 = $$lcssa215 + ($$lcssa216 + -47 + (($934 & 7 | 0) == 0 ? 0 : 0 - $934 & 7)) | 0; //@line 11988
    $941 = $635 + 16 | 0; //@line 11989
    $943 = $940 >>> 0 < $941 >>> 0 ? $635 : $940; //@line 11991
    $944 = $943 + 8 | 0; //@line 11992
    $947 = $tbase$255$i + 8 | 0; //@line 11995
    $952 = ($947 & 7 | 0) == 0 ? 0 : 0 - $947 & 7; //@line 12000
    $954 = $tsize$254$i + -40 - $952 | 0; //@line 12002
    HEAP32[197] = $tbase$255$i + $952; //@line 12003
    HEAP32[194] = $954; //@line 12004
    HEAP32[$tbase$255$i + ($952 + 4) >> 2] = $954 | 1; //@line 12008
    HEAP32[$tbase$255$i + ($tsize$254$i + -36) >> 2] = 40; //@line 12011
    HEAP32[198] = HEAP32[313]; //@line 12013
    $959 = $943 + 4 | 0; //@line 12014
    HEAP32[$959 >> 2] = 27; //@line 12015
    HEAP32[$944 >> 2] = HEAP32[303]; //@line 12016
    HEAP32[$944 + 4 >> 2] = HEAP32[304]; //@line 12016
    HEAP32[$944 + 8 >> 2] = HEAP32[305]; //@line 12016
    HEAP32[$944 + 12 >> 2] = HEAP32[306]; //@line 12016
    HEAP32[303] = $tbase$255$i; //@line 12017
    HEAP32[304] = $tsize$254$i; //@line 12018
    HEAP32[306] = 0; //@line 12019
    HEAP32[305] = $944; //@line 12020
    $960 = $943 + 28 | 0; //@line 12021
    HEAP32[$960 >> 2] = 7; //@line 12022
    if (($943 + 32 | 0) >>> 0 < $$lcssa217 >>> 0) {
     $964 = $960; //@line 12026
     do {
      $964$looptemp = $964;
      $964 = $964 + 4 | 0; //@line 12028
      HEAP32[$964 >> 2] = 7; //@line 12029
     } while (($964$looptemp + 8 | 0) >>> 0 < $$lcssa217 >>> 0);
    }
    if (($943 | 0) != ($635 | 0)) {
     $970 = $943 - $635 | 0; //@line 12043
     HEAP32[$959 >> 2] = HEAP32[$959 >> 2] & -2; //@line 12046
     HEAP32[$635 + 4 >> 2] = $970 | 1; //@line 12049
     HEAP32[$943 >> 2] = $970; //@line 12050
     $975 = $970 >>> 3; //@line 12051
     if ($970 >>> 0 < 256) {
      $977 = $975 << 1; //@line 12054
      $978 = 804 + ($977 << 2) | 0; //@line 12055
      $979 = HEAP32[191] | 0; //@line 12056
      $980 = 1 << $975; //@line 12057
      if (!($979 & $980)) {
       HEAP32[191] = $979 | $980; //@line 12062
       $$pre$phi$i$iZ2D = 804 + ($977 + 2 << 2) | 0; //@line 12065
       $F$0$i$i = $978; //@line 12065
      } else {
       $984 = 804 + ($977 + 2 << 2) | 0; //@line 12068
       $985 = HEAP32[$984 >> 2] | 0; //@line 12069
       if ($985 >>> 0 < (HEAP32[195] | 0) >>> 0) {
        _abort(); //@line 12073
       } else {
        $$pre$phi$i$iZ2D = $984; //@line 12076
        $F$0$i$i = $985; //@line 12076
       }
      }
      HEAP32[$$pre$phi$i$iZ2D >> 2] = $635; //@line 12079
      HEAP32[$F$0$i$i + 12 >> 2] = $635; //@line 12081
      HEAP32[$635 + 8 >> 2] = $F$0$i$i; //@line 12083
      HEAP32[$635 + 12 >> 2] = $978; //@line 12085
      break;
     }
     $991 = $970 >>> 8; //@line 12088
     if (!$991) {
      $I1$0$i$i = 0; //@line 12091
     } else {
      if ($970 >>> 0 > 16777215) {
       $I1$0$i$i = 31; //@line 12095
      } else {
       $996 = ($991 + 1048320 | 0) >>> 16 & 8; //@line 12099
       $997 = $991 << $996; //@line 12100
       $1000 = ($997 + 520192 | 0) >>> 16 & 4; //@line 12103
       $1002 = $997 << $1000; //@line 12105
       $1005 = ($1002 + 245760 | 0) >>> 16 & 2; //@line 12108
       $1010 = 14 - ($1000 | $996 | $1005) + ($1002 << $1005 >>> 15) | 0; //@line 12113
       $I1$0$i$i = $970 >>> ($1010 + 7 | 0) & 1 | $1010 << 1; //@line 12119
      }
     }
     $1016 = 1068 + ($I1$0$i$i << 2) | 0; //@line 12122
     HEAP32[$635 + 28 >> 2] = $I1$0$i$i; //@line 12124
     HEAP32[$635 + 20 >> 2] = 0; //@line 12126
     HEAP32[$941 >> 2] = 0; //@line 12127
     $1019 = HEAP32[192] | 0; //@line 12128
     $1020 = 1 << $I1$0$i$i; //@line 12129
     if (!($1019 & $1020)) {
      HEAP32[192] = $1019 | $1020; //@line 12134
      HEAP32[$1016 >> 2] = $635; //@line 12135
      HEAP32[$635 + 24 >> 2] = $1016; //@line 12137
      HEAP32[$635 + 12 >> 2] = $635; //@line 12139
      HEAP32[$635 + 8 >> 2] = $635; //@line 12141
      break;
     }
     $1027 = HEAP32[$1016 >> 2] | 0; //@line 12144
     L459 : do {
      if ((HEAP32[$1027 + 4 >> 2] & -8 | 0) == ($970 | 0)) {
       $T$0$lcssa$i$i = $1027; //@line 12151
      } else {
       $K2$07$i$i = $970 << (($I1$0$i$i | 0) == 31 ? 0 : 25 - ($I1$0$i$i >>> 1) | 0); //@line 12158
       $T$06$i$i = $1027; //@line 12158
       while (1) {
        $1044 = $T$06$i$i + 16 + ($K2$07$i$i >>> 31 << 2) | 0; //@line 12161
        $1039 = HEAP32[$1044 >> 2] | 0; //@line 12162
        if (!$1039) {
         $$lcssa211 = $1044; //@line 12165
         $T$06$i$i$lcssa = $T$06$i$i; //@line 12165
         break;
        }
        if ((HEAP32[$1039 + 4 >> 2] & -8 | 0) == ($970 | 0)) {
         $T$0$lcssa$i$i = $1039; //@line 12174
         break L459;
        } else {
         $K2$07$i$i = $K2$07$i$i << 1; //@line 12177
         $T$06$i$i = $1039; //@line 12177
        }
       }
       if ($$lcssa211 >>> 0 < (HEAP32[195] | 0) >>> 0) {
        _abort(); //@line 12183
       } else {
        HEAP32[$$lcssa211 >> 2] = $635; //@line 12186
        HEAP32[$635 + 24 >> 2] = $T$06$i$i$lcssa; //@line 12188
        HEAP32[$635 + 12 >> 2] = $635; //@line 12190
        HEAP32[$635 + 8 >> 2] = $635; //@line 12192
        break L299;
       }
      }
     } while (0);
     $1051 = $T$0$lcssa$i$i + 8 | 0; //@line 12197
     $1052 = HEAP32[$1051 >> 2] | 0; //@line 12198
     $1053 = HEAP32[195] | 0; //@line 12199
     if ($1052 >>> 0 >= $1053 >>> 0 & $T$0$lcssa$i$i >>> 0 >= $1053 >>> 0) {
      HEAP32[$1052 + 12 >> 2] = $635; //@line 12205
      HEAP32[$1051 >> 2] = $635; //@line 12206
      HEAP32[$635 + 8 >> 2] = $1052; //@line 12208
      HEAP32[$635 + 12 >> 2] = $T$0$lcssa$i$i; //@line 12210
      HEAP32[$635 + 24 >> 2] = 0; //@line 12212
      break;
     } else {
      _abort(); //@line 12215
     }
    }
   }
  } while (0);
  $1060 = HEAP32[194] | 0; //@line 12221
  if ($1060 >>> 0 > $nb$0 >>> 0) {
   $1062 = $1060 - $nb$0 | 0; //@line 12224
   HEAP32[194] = $1062; //@line 12225
   $1063 = HEAP32[197] | 0; //@line 12226
   HEAP32[197] = $1063 + $nb$0; //@line 12228
   HEAP32[$1063 + ($nb$0 + 4) >> 2] = $1062 | 1; //@line 12232
   HEAP32[$1063 + 4 >> 2] = $nb$0 | 3; //@line 12235
   $mem$0 = $1063 + 8 | 0; //@line 12237
   return $mem$0 | 0; //@line 12238
  }
 }
 HEAP32[(___errno_location() | 0) >> 2] = 12; //@line 12242
 $mem$0 = 0; //@line 12243
 return $mem$0 | 0; //@line 12244
}
function ___floatscan($f, $prec, $pok) {
 $f = $f | 0;
 $prec = $prec | 0;
 $pok = $pok | 0;
 var $$0 = 0.0, $$0$i27 = 0.0, $$010$i = 0, $$07$i = 0, $$0710$i = 0, $$0711$i = 0, $$09$i = 0, $$1$be$i = 0, $$1$ph$i = 0, $$18$i = 0, $$2$i = 0, $$3$be$i = 0, $$3$lcssa$i = 0, $$3105$i = 0, $$in = 0, $$lcssa = 0, $$lcssa256 = 0, $$lcssa256$lcssa = 0, $$lcssa257 = 0, $$lcssa257$lcssa = 0, $$lcssa263 = 0, $$lcssa264 = 0, $$lcssa265 = 0, $$lcssa275 = 0, $$not$i = 0, $$pre$i = 0, $$pre$i17 = 0, $$pre$phi42$iZ2D = 0.0, $$sink$off0$i = 0, $0 = 0, $1 = 0, $115 = 0, $123 = 0, $125 = 0, $132 = 0, $139 = 0, $147 = 0, $15 = 0, $154 = 0, $155 = 0, $156 = 0, $157 = 0, $159 = 0, $16 = 0, $160 = 0, $164 = 0, $169 = 0, $171 = 0, $183 = 0.0, $190 = 0, $192 = 0, $2 = 0, $201 = 0, $205 = 0, $211 = 0, $212 = 0, $213 = 0, $214 = 0, $215 = 0, $216 = 0, $217 = 0, $223 = 0, $224 = 0, $225 = 0, $235 = 0, $236 = 0, $249 = 0, $251 = 0, $253 = 0, $254 = 0, $255 = 0, $256 = 0, $270 = 0, $272 = 0, $283 = 0, $287 = 0, $288 = 0, $289 = 0, $29 = 0, $290 = 0, $291 = 0, $295 = 0, $297 = 0, $298 = 0, $299 = 0, $300 = 0, $310 = 0.0, $322 = 0.0, $330 = 0, $331 = 0, $338 = 0, $346 = 0, $347 = 0, $348 = 0, $349 = 0, $350 = 0, $358 = 0, $36 = 0, $360 = 0, $362 = 0, $365 = 0, $366 = 0, $367 = 0, $368 = 0, $369 = 0, $371 = 0, $376 = 0, $377 = 0, $381 = 0, $39 = 0, $392 = 0, $393 = 0, $394 = 0, $395 = 0, $396 = 0, $397 = 0, $398 = 0, $399 = 0, $402 = 0, $403 = 0, $412 = 0, $413 = 0, $414 = 0, $42 = 0, $422 = 0, $427 = 0, $428 = 0, $430 = 0, $431 = 0, $444 = 0, $446 = 0, $456 = 0, $458 = 0, $470 = 0, $471 = 0, $472 = 0, $494 = 0, $506 = 0, $510 = 0, $513 = 0, $515 = 0, $516 = 0, $517 = 0, $520 = 0, $521 = 0, $533 = 0, $534 = 0, $535 = 0, $539 = 0, $541 = 0, $543 = 0, $544 = 0, $550 = 0, $552 = 0, $557 = 0, $560 = 0, $564 = 0, $567 = 0, $572 = 0, $576 = 0, $577 = 0, $579 = 0, $583 = 0, $585 = 0, $588 = 0, $589 = 0, $590 = 0, $591 = 0, $594 = 0, $595 = 0, $60 = 0, $604 = 0, $609 = 0, $610 = 0, $617 = 0, $619 = 0.0, $621 = 0, $625 = 0.0, $626 = 0.0, $629 = 0.0, $633 = 0, $636 = 0, $643 = 0.0, $661 = 0.0, $663 = 0, $669 = 0, $67 = 0, $670 = 0, $680 = 0, $69 = 0, $691 = 0, $694 = 0, $695 = 0, $696 = 0, $697 = 0, $698 = 0, $699 = 0, $700 = 0, $701 = 0, $702 = 0, $703 = 0, $704 = 0, $705 = 0, $706 = 0, $707 = 0, $708 = 0, $709 = 0, $710 = 0, $711 = 0, $712 = 0, $713 = 0, $714 = 0, $715 = 0, $716 = 0, $717 = 0, $718 = 0, $719 = 0, $720 = 0, $721 = 0, $722 = 0, $723 = 0, $77 = 0, $82 = 0, $9 = 0, $90 = 0, $99 = 0, $a$0$lcssa151$i = 0, $a$085$i = 0, $a$1$i = 0, $a$1$i$lcssa = 0, $a$2$ph38$i = 0, $a$3$i = 0, $a$3$i$lcssa248 = 0, $a$3$i249 = 0, $a$3$ph$i = 0, $a$3$ph157$i = 0, $a$478$i = 0, $a$5$i = 0, $a$5$i$lcssa = 0, $a$5$i$lcssa$lcssa = 0, $bias$0$i = 0.0, $bias$0$i25 = 0.0, $bits$0$ph = 0, $c$0 = 0, $c$0$i = 0, $c$1$lcssa = 0, $c$1$ph$i = 0, $c$179 = 0, $c$2 = 0, $c$2$i = 0, $c$2$lcssa$i = 0, $c$377 = 0, $c$4 = 0, $c$5 = 0, $c$6 = 0, $carry$087$i = 0, $carry1$0$i = 0, $carry1$1$i = 0, $carry1$1$i$lcssa = 0, $carry1$1$i$lcssa$lcssa = 0, $carry3$081$i = 0, $d$0$i = 0, $denormal$0$i = 0, $denormal$2$i = 0, $e2$0$i19 = 0, $e2$0$ph$i = 0, $e2$1$i = 0, $e2$1$i246 = 0, $e2$1$ph$i = 0, $e2$1$ph156$i = 0, $e2$2$i = 0, $e2$3$i = 0, $emin$0$ph = 0, $frac$0$i = 0.0, $frac$1$i = 0.0, $frac$2$i = 0.0, $gotdig$0$i = 0, $gotdig$0$i$lcssa242 = 0, $gotdig$0$i12 = 0, $gotdig$0$i12$lcssa273 = 0, $gotdig$2$i = 0, $gotdig$2$i$lcssa = 0, $gotdig$2$i13 = 0, $gotdig$3$i = 0, $gotdig$3$lcssa$i = 0, $gotdig$3101$i = 0, $gotdig$3101$i$lcssa = 0, $gotdig$4$i = 0, $gotrad$0$i = 0, $gotrad$0$i$lcssa = 0, $gotrad$0$i14 = 0, $gotrad$1$i = 0, $gotrad$1$lcssa$i = 0, $gotrad$1102$i = 0, $gotrad$2$i = 0, $gottail$0$i = 0, $gottail$1$i = 0, $gottail$2$i = 0, $i$0$lcssa = 0, $i$078 = 0, $i$1 = 0, $i$276 = 0, $i$3 = 0, $i$4 = 0, $i$4$lcssa = 0, $j$0$lcssa$i = 0, $j$0104$i = 0, $j$0104$i$lcssa = 0, $j$067$i = 0, $j$068$i = 0, $j$069$i = 0, $j$2$i = 0, $j$394$i = 0, $k$0$lcssa$i = 0, $k$0103$i = 0, $k$0103$i$lcssa = 0, $k$063$i = 0, $k$064$i = 0, $k$065$i = 0, $k$2$i = 0, $k$3$i = 0, $k$486$i = 0, $k$5$i = 0, $k$5$in$i = 0, $k$679$i = 0, $lnz$0$lcssa$i = 0, $lnz$0100$i = 0, $lnz$0100$i$lcssa = 0, $lnz$057$i = 0, $lnz$058$i = 0, $lnz$059$i = 0, $lnz$2$i = 0, $or$cond16$i = 0, $or$cond19$i = 0, $or$cond9$i = 0, $rp$0$lcssa152$i = 0, $rp$084$i = 0, $rp$1$i18 = 0, $rp$1$i18$lcssa = 0, $rp$2$ph36$i = 0, $rp$3$ph$i = 0, $rp$3$ph34$i = 0, $rp$477$i = 0, $rp$5$i = 0, $rp$5$i$lcssa = 0, $rp$5$i$lcssa$lcssa = 0, $scale$0$i = 0.0, $scale$1$i = 0.0, $scale$2$i = 0.0, $sign$0 = 0, $storemerge$i = 0, $sum$i = 0, $x$0$i = 0, $x$0$i$lcssa = 0, $x$1$i = 0, $x$2$i = 0, $x$3$lcssa$i = 0, $x$324$i = 0, $x$4$lcssa$i = 0, $x$419$i = 0, $x$5$i = 0, $x$i = 0, $y$0$i = 0.0, $y$0$i$lcssa = 0.0, $y$1$i = 0.0, $y$1$i24 = 0.0, $y$2$i = 0.0, $y$2$i26 = 0.0, $y$3$i = 0.0, $y$3$lcssa$i = 0.0, $y$320$i = 0.0, $y$4$i = 0.0, $z$0$i = 0, $z$1$i = 0, $z$1$ph37$i = 0, $z$2$i = 0, $z$3$i = 0, $z$3$i$lcssa = 0, $z$3$i$lcssa$lcssa = 0, $z$4$i = 0, $z$5$ph$i = 0, $z$7$1$i = 0, $z$7$i = 0, label = 0, sp = 0;
 sp = STACKTOP; //@line 459
 STACKTOP = STACKTOP + 512 | 0; //@line 460
 $x$i = sp; //@line 461
 switch ($prec | 0) {
 case 0:
  {
   $bits$0$ph = 24; //@line 464
   $emin$0$ph = -149; //@line 464
   label = 4; //@line 465
   break;
  }
 case 1:
  {
   $bits$0$ph = 53; //@line 469
   $emin$0$ph = -1074; //@line 469
   label = 4; //@line 470
   break;
  }
 case 2:
  {
   $bits$0$ph = 53; //@line 474
   $emin$0$ph = -1074; //@line 474
   label = 4; //@line 475
   break;
  }
 default:
  {
   $$0 = 0.0; //@line 479
  }
 }
 L4 : do {
  if ((label | 0) == 4) {
   $0 = $f + 4 | 0; //@line 484
   $1 = $f + 100 | 0; //@line 485
   do {
    $2 = HEAP32[$0 >> 2] | 0; //@line 487
    if ($2 >>> 0 < (HEAP32[$1 >> 2] | 0) >>> 0) {
     HEAP32[$0 >> 2] = $2 + 1; //@line 492
     $9 = HEAPU8[$2 >> 0] | 0; //@line 495
    } else {
     $9 = ___shgetc($f) | 0; //@line 498
    }
   } while ((_isspace($9) | 0) != 0);
   $$lcssa275 = $9; //@line 503
   L13 : do {
    switch ($$lcssa275 | 0) {
    case 43:
    case 45:
     {
      $15 = 1 - ((($$lcssa275 | 0) == 45 & 1) << 1) | 0; //@line 513
      $16 = HEAP32[$0 >> 2] | 0; //@line 514
      if ($16 >>> 0 < (HEAP32[$1 >> 2] | 0) >>> 0) {
       HEAP32[$0 >> 2] = $16 + 1; //@line 519
       $c$0 = HEAPU8[$16 >> 0] | 0; //@line 522
       $sign$0 = $15; //@line 522
       break L13;
      } else {
       $c$0 = ___shgetc($f) | 0; //@line 526
       $sign$0 = $15; //@line 526
       break L13;
      }
      break;
     }
    default:
     {
      $c$0 = $$lcssa275; //@line 532
      $sign$0 = 1; //@line 532
     }
    }
   } while (0);
   $c$179 = $c$0; //@line 536
   $i$078 = 0; //@line 536
   while (1) {
    if (($c$179 | 32 | 0) != (HEAP8[3564 + $i$078 >> 0] | 0)) {
     $c$1$lcssa = $c$179; //@line 544
     $i$0$lcssa = $i$078; //@line 544
     break;
    }
    do {
     if ($i$078 >>> 0 < 7) {
      $29 = HEAP32[$0 >> 2] | 0; //@line 550
      if ($29 >>> 0 < (HEAP32[$1 >> 2] | 0) >>> 0) {
       HEAP32[$0 >> 2] = $29 + 1; //@line 555
       $c$2 = HEAPU8[$29 >> 0] | 0; //@line 558
       break;
      } else {
       $c$2 = ___shgetc($f) | 0; //@line 562
       break;
      }
     } else {
      $c$2 = $c$179; //@line 566
     }
    } while (0);
    $36 = $i$078 + 1 | 0; //@line 569
    if ($36 >>> 0 < 8) {
     $c$179 = $c$2; //@line 572
     $i$078 = $36; //@line 572
    } else {
     $c$1$lcssa = $c$2; //@line 574
     $i$0$lcssa = $36; //@line 574
     break;
    }
   }
   L29 : do {
    switch ($i$0$lcssa | 0) {
    case 8:
     {
      break;
     }
    case 3:
     {
      label = 23; //@line 584
      break;
     }
    default:
     {
      $39 = ($pok | 0) != 0; //@line 589
      if ($39 & $i$0$lcssa >>> 0 > 3) {
       if (($i$0$lcssa | 0) == 8) {
        break L29;
       } else {
        label = 23; //@line 596
        break L29;
       }
      }
      L34 : do {
       if (!$i$0$lcssa) {
        $c$377 = $c$1$lcssa; //@line 603
        $i$276 = 0; //@line 603
        while (1) {
         if (($c$377 | 32 | 0) != (HEAP8[6486 + $i$276 >> 0] | 0)) {
          $c$5 = $c$377; //@line 611
          $i$3 = $i$276; //@line 611
          break L34;
         }
         do {
          if ($i$276 >>> 0 < 2) {
           $60 = HEAP32[$0 >> 2] | 0; //@line 617
           if ($60 >>> 0 < (HEAP32[$1 >> 2] | 0) >>> 0) {
            HEAP32[$0 >> 2] = $60 + 1; //@line 622
            $c$4 = HEAPU8[$60 >> 0] | 0; //@line 625
            break;
           } else {
            $c$4 = ___shgetc($f) | 0; //@line 629
            break;
           }
          } else {
           $c$4 = $c$377; //@line 633
          }
         } while (0);
         $67 = $i$276 + 1 | 0; //@line 636
         if ($67 >>> 0 < 3) {
          $c$377 = $c$4; //@line 639
          $i$276 = $67; //@line 639
         } else {
          $c$5 = $c$4; //@line 641
          $i$3 = $67; //@line 641
          break;
         }
        }
       } else {
        $c$5 = $c$1$lcssa; //@line 646
        $i$3 = $i$0$lcssa; //@line 646
       }
      } while (0);
      switch ($i$3 | 0) {
      case 3:
       {
        $69 = HEAP32[$0 >> 2] | 0; //@line 651
        if ($69 >>> 0 < (HEAP32[$1 >> 2] | 0) >>> 0) {
         HEAP32[$0 >> 2] = $69 + 1; //@line 656
         $77 = HEAPU8[$69 >> 0] | 0; //@line 659
        } else {
         $77 = ___shgetc($f) | 0; //@line 662
        }
        if (($77 | 0) == 40) {
         $i$4 = 1; //@line 666
        } else {
         if (!(HEAP32[$1 >> 2] | 0)) {
          $$0 = nan; //@line 671
          break L4;
         }
         HEAP32[$0 >> 2] = (HEAP32[$0 >> 2] | 0) + -1; //@line 676
         $$0 = nan; //@line 677
         break L4;
        }
        while (1) {
         $82 = HEAP32[$0 >> 2] | 0; //@line 681
         if ($82 >>> 0 < (HEAP32[$1 >> 2] | 0) >>> 0) {
          HEAP32[$0 >> 2] = $82 + 1; //@line 686
          $90 = HEAPU8[$82 >> 0] | 0; //@line 689
         } else {
          $90 = ___shgetc($f) | 0; //@line 692
         }
         if (!(($90 + -48 | 0) >>> 0 < 10 | ($90 + -65 | 0) >>> 0 < 26)) {
          if (!(($90 | 0) == 95 | ($90 + -97 | 0) >>> 0 < 26)) {
           $$lcssa = $90; //@line 705
           $i$4$lcssa = $i$4; //@line 705
           break;
          }
         }
         $i$4 = $i$4 + 1 | 0; //@line 710
        }
        if (($$lcssa | 0) == 41) {
         $$0 = nan; //@line 714
         break L4;
        }
        $99 = (HEAP32[$1 >> 2] | 0) == 0; //@line 718
        if (!$99) {
         HEAP32[$0 >> 2] = (HEAP32[$0 >> 2] | 0) + -1; //@line 722
        }
        if (!$39) {
         HEAP32[(___errno_location() | 0) >> 2] = 22; //@line 726
         ___shlim($f, 0); //@line 727
         $$0 = 0.0; //@line 728
         break L4;
        }
        if (!$i$4$lcssa) {
         $$0 = nan; //@line 733
         break L4;
        } else {
         $$in = $i$4$lcssa; //@line 736
        }
        while (1) {
         $$in = $$in + -1 | 0; //@line 739
         if (!$99) {
          HEAP32[$0 >> 2] = (HEAP32[$0 >> 2] | 0) + -1; //@line 743
         }
         if (!$$in) {
          $$0 = nan; //@line 747
          break L4;
         }
        }
        break;
       }
      case 0:
       {
        do {
         if (($c$5 | 0) == 48) {
          $115 = HEAP32[$0 >> 2] | 0; //@line 759
          if ($115 >>> 0 < (HEAP32[$1 >> 2] | 0) >>> 0) {
           HEAP32[$0 >> 2] = $115 + 1; //@line 764
           $123 = HEAPU8[$115 >> 0] | 0; //@line 767
          } else {
           $123 = ___shgetc($f) | 0; //@line 770
          }
          if (($123 | 32 | 0) != 120) {
           if (!(HEAP32[$1 >> 2] | 0)) {
            $c$6 = 48; //@line 778
            break;
           }
           HEAP32[$0 >> 2] = (HEAP32[$0 >> 2] | 0) + -1; //@line 783
           $c$6 = 48; //@line 784
           break;
          }
          $125 = HEAP32[$0 >> 2] | 0; //@line 787
          if ($125 >>> 0 < (HEAP32[$1 >> 2] | 0) >>> 0) {
           HEAP32[$0 >> 2] = $125 + 1; //@line 792
           $c$0$i = HEAPU8[$125 >> 0] | 0; //@line 795
           $gotdig$0$i = 0; //@line 795
          } else {
           $c$0$i = ___shgetc($f) | 0; //@line 798
           $gotdig$0$i = 0; //@line 798
          }
          L94 : while (1) {
           switch ($c$0$i | 0) {
           case 46:
            {
             $gotdig$0$i$lcssa242 = $gotdig$0$i; //@line 803
             label = 74; //@line 804
             break L94;
             break;
            }
           case 48:
            {
             break;
            }
           default:
            {
             $169 = 0; //@line 812
             $171 = 0; //@line 812
             $694 = 0; //@line 812
             $695 = 0; //@line 812
             $c$2$i = $c$0$i; //@line 812
             $gotdig$2$i = $gotdig$0$i; //@line 812
             $gotrad$0$i = 0; //@line 812
             $gottail$0$i = 0; //@line 812
             $scale$0$i = 1.0; //@line 812
             $x$0$i = 0; //@line 812
             $y$0$i = 0.0; //@line 812
             break L94;
            }
           }
           $132 = HEAP32[$0 >> 2] | 0; //@line 816
           if ($132 >>> 0 < (HEAP32[$1 >> 2] | 0) >>> 0) {
            HEAP32[$0 >> 2] = $132 + 1; //@line 821
            $c$0$i = HEAPU8[$132 >> 0] | 0; //@line 824
            $gotdig$0$i = 1; //@line 824
            continue;
           } else {
            $c$0$i = ___shgetc($f) | 0; //@line 828
            $gotdig$0$i = 1; //@line 828
            continue;
           }
          }
          if ((label | 0) == 74) {
           $139 = HEAP32[$0 >> 2] | 0; //@line 833
           if ($139 >>> 0 < (HEAP32[$1 >> 2] | 0) >>> 0) {
            HEAP32[$0 >> 2] = $139 + 1; //@line 838
            $c$1$ph$i = HEAPU8[$139 >> 0] | 0; //@line 841
           } else {
            $c$1$ph$i = ___shgetc($f) | 0; //@line 844
           }
           if (($c$1$ph$i | 0) == 48) {
            $154 = 0; //@line 848
            $155 = 0; //@line 848
            while (1) {
             $147 = HEAP32[$0 >> 2] | 0; //@line 850
             if ($147 >>> 0 < (HEAP32[$1 >> 2] | 0) >>> 0) {
              HEAP32[$0 >> 2] = $147 + 1; //@line 855
              $159 = HEAPU8[$147 >> 0] | 0; //@line 858
             } else {
              $159 = ___shgetc($f) | 0; //@line 861
             }
             $156 = _i64Add($154 | 0, $155 | 0, -1, -1) | 0; //@line 863
             $157 = tempRet0; //@line 864
             if (($159 | 0) == 48) {
              $154 = $156; //@line 867
              $155 = $157; //@line 867
             } else {
              $169 = 0; //@line 869
              $171 = 0; //@line 869
              $694 = $156; //@line 869
              $695 = $157; //@line 869
              $c$2$i = $159; //@line 869
              $gotdig$2$i = 1; //@line 869
              $gotrad$0$i = 1; //@line 869
              $gottail$0$i = 0; //@line 869
              $scale$0$i = 1.0; //@line 869
              $x$0$i = 0; //@line 869
              $y$0$i = 0.0; //@line 869
              break;
             }
            }
           } else {
            $169 = 0; //@line 874
            $171 = 0; //@line 874
            $694 = 0; //@line 874
            $695 = 0; //@line 874
            $c$2$i = $c$1$ph$i; //@line 874
            $gotdig$2$i = $gotdig$0$i$lcssa242; //@line 874
            $gotrad$0$i = 1; //@line 874
            $gottail$0$i = 0; //@line 874
            $scale$0$i = 1.0; //@line 874
            $x$0$i = 0; //@line 874
            $y$0$i = 0.0; //@line 874
           }
          }
          while (1) {
           $160 = $c$2$i + -48 | 0; //@line 878
           $$pre$i = $c$2$i | 32; //@line 880
           if ($160 >>> 0 < 10) {
            label = 86; //@line 882
           } else {
            $164 = ($c$2$i | 0) == 46; //@line 886
            if (!($164 | ($$pre$i + -97 | 0) >>> 0 < 6)) {
             $213 = $171; //@line 889
             $214 = $694; //@line 889
             $216 = $169; //@line 889
             $217 = $695; //@line 889
             $c$2$lcssa$i = $c$2$i; //@line 889
             $gotdig$2$i$lcssa = $gotdig$2$i; //@line 889
             $gotrad$0$i$lcssa = $gotrad$0$i; //@line 889
             $x$0$i$lcssa = $x$0$i; //@line 889
             $y$0$i$lcssa = $y$0$i; //@line 889
             break;
            }
            if ($164) {
             if (!$gotrad$0$i) {
              $696 = $171; //@line 895
              $697 = $169; //@line 895
              $698 = $171; //@line 895
              $699 = $169; //@line 895
              $gotdig$3$i = $gotdig$2$i; //@line 895
              $gotrad$1$i = 1; //@line 895
              $gottail$2$i = $gottail$0$i; //@line 895
              $scale$2$i = $scale$0$i; //@line 895
              $x$2$i = $x$0$i; //@line 895
              $y$2$i = $y$0$i; //@line 895
             } else {
              $213 = $171; //@line 897
              $214 = $694; //@line 897
              $216 = $169; //@line 897
              $217 = $695; //@line 897
              $c$2$lcssa$i = 46; //@line 897
              $gotdig$2$i$lcssa = $gotdig$2$i; //@line 897
              $gotrad$0$i$lcssa = $gotrad$0$i; //@line 897
              $x$0$i$lcssa = $x$0$i; //@line 897
              $y$0$i$lcssa = $y$0$i; //@line 897
              break;
             }
            } else {
             label = 86; //@line 901
            }
           }
           if ((label | 0) == 86) {
            label = 0; //@line 905
            $d$0$i = ($c$2$i | 0) > 57 ? $$pre$i + -87 | 0 : $160; //@line 908
            do {
             if (($169 | 0) < 0 | ($169 | 0) == 0 & $171 >>> 0 < 8) {
              $gottail$1$i = $gottail$0$i; //@line 918
              $scale$1$i = $scale$0$i; //@line 918
              $x$1$i = $d$0$i + ($x$0$i << 4) | 0; //@line 918
              $y$1$i = $y$0$i; //@line 918
             } else {
              if (($169 | 0) < 0 | ($169 | 0) == 0 & $171 >>> 0 < 14) {
               $183 = $scale$0$i * .0625; //@line 927
               $gottail$1$i = $gottail$0$i; //@line 930
               $scale$1$i = $183; //@line 930
               $x$1$i = $x$0$i; //@line 930
               $y$1$i = $y$0$i + $183 * +($d$0$i | 0); //@line 930
               break;
              }
              if (($gottail$0$i | 0) != 0 | ($d$0$i | 0) == 0) {
               $gottail$1$i = $gottail$0$i; //@line 937
               $scale$1$i = $scale$0$i; //@line 937
               $x$1$i = $x$0$i; //@line 937
               $y$1$i = $y$0$i; //@line 937
              } else {
               $gottail$1$i = 1; //@line 941
               $scale$1$i = $scale$0$i; //@line 941
               $x$1$i = $x$0$i; //@line 941
               $y$1$i = $y$0$i + $scale$0$i * .5; //@line 941
              }
             }
            } while (0);
            $190 = _i64Add($171 | 0, $169 | 0, 1, 0) | 0; //@line 945
            $696 = $694; //@line 947
            $697 = $695; //@line 947
            $698 = $190; //@line 947
            $699 = tempRet0; //@line 947
            $gotdig$3$i = 1; //@line 947
            $gotrad$1$i = $gotrad$0$i; //@line 947
            $gottail$2$i = $gottail$1$i; //@line 947
            $scale$2$i = $scale$1$i; //@line 947
            $x$2$i = $x$1$i; //@line 947
            $y$2$i = $y$1$i; //@line 947
           }
           $192 = HEAP32[$0 >> 2] | 0; //@line 949
           if ($192 >>> 0 < (HEAP32[$1 >> 2] | 0) >>> 0) {
            HEAP32[$0 >> 2] = $192 + 1; //@line 954
            $169 = $699; //@line 957
            $171 = $698; //@line 957
            $694 = $696; //@line 957
            $695 = $697; //@line 957
            $c$2$i = HEAPU8[$192 >> 0] | 0; //@line 957
            $gotdig$2$i = $gotdig$3$i; //@line 957
            $gotrad$0$i = $gotrad$1$i; //@line 957
            $gottail$0$i = $gottail$2$i; //@line 957
            $scale$0$i = $scale$2$i; //@line 957
            $x$0$i = $x$2$i; //@line 957
            $y$0$i = $y$2$i; //@line 957
            continue;
           } else {
            $169 = $699; //@line 961
            $171 = $698; //@line 961
            $694 = $696; //@line 961
            $695 = $697; //@line 961
            $c$2$i = ___shgetc($f) | 0; //@line 961
            $gotdig$2$i = $gotdig$3$i; //@line 961
            $gotrad$0$i = $gotrad$1$i; //@line 961
            $gottail$0$i = $gottail$2$i; //@line 961
            $scale$0$i = $scale$2$i; //@line 961
            $x$0$i = $x$2$i; //@line 961
            $y$0$i = $y$2$i; //@line 961
            continue;
           }
          }
          if (!$gotdig$2$i$lcssa) {
           $201 = (HEAP32[$1 >> 2] | 0) == 0; //@line 968
           if (!$201) {
            HEAP32[$0 >> 2] = (HEAP32[$0 >> 2] | 0) + -1; //@line 972
           }
           if (!$pok) {
            ___shlim($f, 0); //@line 976
           } else {
            if (!$201) {
             $205 = HEAP32[$0 >> 2] | 0; //@line 979
             HEAP32[$0 >> 2] = $205 + -1; //@line 981
             if ($gotrad$0$i$lcssa) {
              HEAP32[$0 >> 2] = $205 + -2; //@line 985
             }
            }
           }
           $$0 = +($sign$0 | 0) * 0.0; //@line 991
           break L4;
          }
          $211 = ($gotrad$0$i$lcssa | 0) == 0; //@line 994
          $212 = $211 ? $213 : $214; //@line 995
          $215 = $211 ? $216 : $217; //@line 996
          if (($216 | 0) < 0 | ($216 | 0) == 0 & $213 >>> 0 < 8) {
           $224 = $213; //@line 1003
           $225 = $216; //@line 1003
           $x$324$i = $x$0$i$lcssa; //@line 1003
           while (1) {
            $223 = $x$324$i << 4; //@line 1005
            $224 = _i64Add($224 | 0, $225 | 0, 1, 0) | 0; //@line 1006
            $225 = tempRet0; //@line 1007
            if (!(($225 | 0) < 0 | ($225 | 0) == 0 & $224 >>> 0 < 8)) {
             $x$3$lcssa$i = $223; //@line 1016
             break;
            } else {
             $x$324$i = $223; //@line 1014
            }
           }
          } else {
           $x$3$lcssa$i = $x$0$i$lcssa; //@line 1021
          }
          if (($c$2$lcssa$i | 32 | 0) == 112) {
           $235 = _scanexp($f, $pok) | 0; //@line 1026
           $236 = tempRet0; //@line 1027
           if (($235 | 0) == 0 & ($236 | 0) == -2147483648) {
            if (!$pok) {
             ___shlim($f, 0); //@line 1034
             $$0 = 0.0; //@line 1035
             break L4;
            }
            if (!(HEAP32[$1 >> 2] | 0)) {
             $253 = 0; //@line 1041
             $254 = 0; //@line 1041
            } else {
             HEAP32[$0 >> 2] = (HEAP32[$0 >> 2] | 0) + -1; //@line 1045
             $253 = 0; //@line 1046
             $254 = 0; //@line 1046
            }
           } else {
            $253 = $235; //@line 1049
            $254 = $236; //@line 1049
           }
          } else {
           if (!(HEAP32[$1 >> 2] | 0)) {
            $253 = 0; //@line 1055
            $254 = 0; //@line 1055
           } else {
            HEAP32[$0 >> 2] = (HEAP32[$0 >> 2] | 0) + -1; //@line 1059
            $253 = 0; //@line 1060
            $254 = 0; //@line 1060
           }
          }
          $249 = _bitshift64Shl($212 | 0, $215 | 0, 2) | 0; //@line 1063
          $251 = _i64Add($249 | 0, tempRet0 | 0, -32, -1) | 0; //@line 1065
          $255 = _i64Add($251 | 0, tempRet0 | 0, $253 | 0, $254 | 0) | 0; //@line 1067
          $256 = tempRet0; //@line 1068
          if (!$x$3$lcssa$i) {
           $$0 = +($sign$0 | 0) * 0.0; //@line 1073
           break L4;
          }
          if (($256 | 0) > 0 | ($256 | 0) == 0 & $255 >>> 0 > (0 - $emin$0$ph | 0) >>> 0) {
           HEAP32[(___errno_location() | 0) >> 2] = 34; //@line 1084
           $$0 = +($sign$0 | 0) * 1.7976931348623157e+308 * 1.7976931348623157e+308; //@line 1088
           break L4;
          }
          $270 = $emin$0$ph + -106 | 0; //@line 1091
          $272 = (($270 | 0) < 0) << 31 >> 31; //@line 1093
          if (($256 | 0) < ($272 | 0) | ($256 | 0) == ($272 | 0) & $255 >>> 0 < $270 >>> 0) {
           HEAP32[(___errno_location() | 0) >> 2] = 34; //@line 1101
           $$0 = +($sign$0 | 0) * 2.2250738585072014e-308 * 2.2250738585072014e-308; //@line 1105
           break L4;
          }
          if (($x$3$lcssa$i | 0) > -1) {
           $288 = $255; //@line 1110
           $289 = $256; //@line 1110
           $x$419$i = $x$3$lcssa$i; //@line 1110
           $y$320$i = $y$0$i$lcssa; //@line 1110
           while (1) {
            $283 = !($y$320$i >= .5); //@line 1112
            $287 = $283 & 1 | $x$419$i << 1; //@line 1116
            $x$5$i = $287 ^ 1; //@line 1117
            $y$4$i = $y$320$i + ($283 ? $y$320$i : $y$320$i + -1.0); //@line 1119
            $290 = _i64Add($288 | 0, $289 | 0, -1, -1) | 0; //@line 1120
            $291 = tempRet0; //@line 1121
            if (($287 | 0) > -1) {
             $288 = $290; //@line 1124
             $289 = $291; //@line 1124
             $x$419$i = $x$5$i; //@line 1124
             $y$320$i = $y$4$i; //@line 1124
            } else {
             $297 = $290; //@line 1126
             $298 = $291; //@line 1126
             $x$4$lcssa$i = $x$5$i; //@line 1126
             $y$3$lcssa$i = $y$4$i; //@line 1126
             break;
            }
           }
          } else {
           $297 = $255; //@line 1131
           $298 = $256; //@line 1131
           $x$4$lcssa$i = $x$3$lcssa$i; //@line 1131
           $y$3$lcssa$i = $y$0$i$lcssa; //@line 1131
          }
          $295 = _i64Subtract(32, 0, $emin$0$ph | 0, (($emin$0$ph | 0) < 0) << 31 >> 31 | 0) | 0; //@line 1135
          $299 = _i64Add($297 | 0, $298 | 0, $295 | 0, tempRet0 | 0) | 0; //@line 1137
          $300 = tempRet0; //@line 1138
          if (0 > ($300 | 0) | 0 == ($300 | 0) & $bits$0$ph >>> 0 > $299 >>> 0) {
           if (($299 | 0) < 0) {
            $$0710$i = 0; //@line 1147
            label = 127; //@line 1148
           } else {
            $$07$i = $299; //@line 1150
            label = 125; //@line 1151
           }
          } else {
           $$07$i = $bits$0$ph; //@line 1154
           label = 125; //@line 1155
          }
          if ((label | 0) == 125) {
           if (($$07$i | 0) < 53) {
            $$0710$i = $$07$i; //@line 1160
            label = 127; //@line 1161
           } else {
            $$0711$i = $$07$i; //@line 1164
            $$pre$phi42$iZ2D = +($sign$0 | 0); //@line 1164
            $bias$0$i = 0.0; //@line 1164
           }
          }
          if ((label | 0) == 127) {
           $310 = +($sign$0 | 0); //@line 1170
           $$0711$i = $$0710$i; //@line 1172
           $$pre$phi42$iZ2D = $310; //@line 1172
           $bias$0$i = +_copysignl(+_scalbn(1.0, 84 - $$0710$i | 0), $310); //@line 1172
          }
          $or$cond9$i = ($x$4$lcssa$i & 1 | 0) == 0 & ($y$3$lcssa$i != 0.0 & ($$0711$i | 0) < 32); //@line 1179
          $322 = $$pre$phi42$iZ2D * ($or$cond9$i ? 0.0 : $y$3$lcssa$i) + ($bias$0$i + $$pre$phi42$iZ2D * +((($or$cond9$i & 1) + $x$4$lcssa$i | 0) >>> 0)) - $bias$0$i; //@line 1188
          if (!($322 != 0.0)) {
           HEAP32[(___errno_location() | 0) >> 2] = 34; //@line 1192
          }
          $$0 = +_scalbnl($322, $297); //@line 1195
          break L4;
         } else {
          $c$6 = $c$5; //@line 1198
         }
        } while (0);
        $sum$i = $emin$0$ph + $bits$0$ph | 0; //@line 1201
        $330 = 0 - $sum$i | 0; //@line 1202
        $$09$i = $c$6; //@line 1203
        $gotdig$0$i12 = 0; //@line 1203
        L184 : while (1) {
         switch ($$09$i | 0) {
         case 46:
          {
           $gotdig$0$i12$lcssa273 = $gotdig$0$i12; //@line 1207
           label = 138; //@line 1208
           break L184;
           break;
          }
         case 48:
          {
           break;
          }
         default:
          {
           $$2$i = $$09$i; //@line 1216
           $700 = 0; //@line 1216
           $701 = 0; //@line 1216
           $gotdig$2$i13 = $gotdig$0$i12; //@line 1216
           $gotrad$0$i14 = 0; //@line 1216
           break L184;
          }
         }
         $331 = HEAP32[$0 >> 2] | 0; //@line 1220
         if ($331 >>> 0 < (HEAP32[$1 >> 2] | 0) >>> 0) {
          HEAP32[$0 >> 2] = $331 + 1; //@line 1225
          $$09$i = HEAPU8[$331 >> 0] | 0; //@line 1228
          $gotdig$0$i12 = 1; //@line 1228
          continue;
         } else {
          $$09$i = ___shgetc($f) | 0; //@line 1232
          $gotdig$0$i12 = 1; //@line 1232
          continue;
         }
        }
        if ((label | 0) == 138) {
         $338 = HEAP32[$0 >> 2] | 0; //@line 1237
         if ($338 >>> 0 < (HEAP32[$1 >> 2] | 0) >>> 0) {
          HEAP32[$0 >> 2] = $338 + 1; //@line 1242
          $$1$ph$i = HEAPU8[$338 >> 0] | 0; //@line 1245
         } else {
          $$1$ph$i = ___shgetc($f) | 0; //@line 1248
         }
         if (($$1$ph$i | 0) == 48) {
          $346 = 0; //@line 1252
          $347 = 0; //@line 1252
          while (1) {
           $348 = _i64Add($346 | 0, $347 | 0, -1, -1) | 0; //@line 1254
           $349 = tempRet0; //@line 1255
           $350 = HEAP32[$0 >> 2] | 0; //@line 1256
           if ($350 >>> 0 < (HEAP32[$1 >> 2] | 0) >>> 0) {
            HEAP32[$0 >> 2] = $350 + 1; //@line 1261
            $$1$be$i = HEAPU8[$350 >> 0] | 0; //@line 1264
           } else {
            $$1$be$i = ___shgetc($f) | 0; //@line 1267
           }
           if (($$1$be$i | 0) == 48) {
            $346 = $348; //@line 1271
            $347 = $349; //@line 1271
           } else {
            $$2$i = $$1$be$i; //@line 1273
            $700 = $348; //@line 1273
            $701 = $349; //@line 1273
            $gotdig$2$i13 = 1; //@line 1273
            $gotrad$0$i14 = 1; //@line 1273
            break;
           }
          }
         } else {
          $$2$i = $$1$ph$i; //@line 1278
          $700 = 0; //@line 1278
          $701 = 0; //@line 1278
          $gotdig$2$i13 = $gotdig$0$i12$lcssa273; //@line 1278
          $gotrad$0$i14 = 1; //@line 1278
         }
        }
        HEAP32[$x$i >> 2] = 0; //@line 1281
        $358 = $$2$i + -48 | 0; //@line 1282
        $360 = ($$2$i | 0) == 46; //@line 1284
        L203 : do {
         if ($360 | $358 >>> 0 < 10) {
          $362 = $x$i + 496 | 0; //@line 1288
          $$3105$i = $$2$i; //@line 1289
          $365 = 0; //@line 1289
          $366 = 0; //@line 1289
          $702 = $360; //@line 1289
          $703 = $358; //@line 1289
          $704 = $700; //@line 1289
          $705 = $701; //@line 1289
          $gotdig$3101$i = $gotdig$2$i13; //@line 1289
          $gotrad$1102$i = $gotrad$0$i14; //@line 1289
          $j$0104$i = 0; //@line 1289
          $k$0103$i = 0; //@line 1289
          $lnz$0100$i = 0; //@line 1289
          L205 : while (1) {
           do {
            if ($702) {
             if (!$gotrad$1102$i) {
              $706 = $365; //@line 1295
              $707 = $366; //@line 1295
              $708 = $365; //@line 1295
              $709 = $366; //@line 1295
              $gotdig$4$i = $gotdig$3101$i; //@line 1295
              $gotrad$2$i = 1; //@line 1295
              $j$2$i = $j$0104$i; //@line 1295
              $k$2$i = $k$0103$i; //@line 1295
              $lnz$2$i = $lnz$0100$i; //@line 1295
             } else {
              $710 = $704; //@line 1297
              $711 = $705; //@line 1297
              $712 = $365; //@line 1297
              $713 = $366; //@line 1297
              $gotdig$3101$i$lcssa = $gotdig$3101$i; //@line 1297
              $j$0104$i$lcssa = $j$0104$i; //@line 1297
              $k$0103$i$lcssa = $k$0103$i; //@line 1297
              $lnz$0100$i$lcssa = $lnz$0100$i; //@line 1297
              break L205;
             }
            } else {
             $367 = _i64Add($365 | 0, $366 | 0, 1, 0) | 0; //@line 1302
             $368 = tempRet0; //@line 1303
             $369 = ($$3105$i | 0) != 48; //@line 1304
             if (($k$0103$i | 0) >= 125) {
              if (!$369) {
               $706 = $704; //@line 1307
               $707 = $705; //@line 1307
               $708 = $367; //@line 1307
               $709 = $368; //@line 1307
               $gotdig$4$i = $gotdig$3101$i; //@line 1307
               $gotrad$2$i = $gotrad$1102$i; //@line 1307
               $j$2$i = $j$0104$i; //@line 1307
               $k$2$i = $k$0103$i; //@line 1307
               $lnz$2$i = $lnz$0100$i; //@line 1307
               break;
              }
              HEAP32[$362 >> 2] = HEAP32[$362 >> 2] | 1; //@line 1312
              $706 = $704; //@line 1313
              $707 = $705; //@line 1313
              $708 = $367; //@line 1313
              $709 = $368; //@line 1313
              $gotdig$4$i = $gotdig$3101$i; //@line 1313
              $gotrad$2$i = $gotrad$1102$i; //@line 1313
              $j$2$i = $j$0104$i; //@line 1313
              $k$2$i = $k$0103$i; //@line 1313
              $lnz$2$i = $lnz$0100$i; //@line 1313
              break;
             }
             $371 = $x$i + ($k$0103$i << 2) | 0; //@line 1318
             if (!$j$0104$i) {
              $storemerge$i = $703; //@line 1320
             } else {
              $storemerge$i = $$3105$i + -48 + ((HEAP32[$371 >> 2] | 0) * 10 | 0) | 0; //@line 1326
             }
             HEAP32[$371 >> 2] = $storemerge$i; //@line 1328
             $376 = $j$0104$i + 1 | 0; //@line 1329
             $377 = ($376 | 0) == 9; //@line 1330
             $706 = $704; //@line 1334
             $707 = $705; //@line 1334
             $708 = $367; //@line 1334
             $709 = $368; //@line 1334
             $gotdig$4$i = 1; //@line 1334
             $gotrad$2$i = $gotrad$1102$i; //@line 1334
             $j$2$i = $377 ? 0 : $376; //@line 1334
             $k$2$i = ($377 & 1) + $k$0103$i | 0; //@line 1334
             $lnz$2$i = $369 ? $367 : $lnz$0100$i; //@line 1334
            }
           } while (0);
           $381 = HEAP32[$0 >> 2] | 0; //@line 1337
           if ($381 >>> 0 < (HEAP32[$1 >> 2] | 0) >>> 0) {
            HEAP32[$0 >> 2] = $381 + 1; //@line 1342
            $$3$be$i = HEAPU8[$381 >> 0] | 0; //@line 1345
           } else {
            $$3$be$i = ___shgetc($f) | 0; //@line 1348
           }
           $703 = $$3$be$i + -48 | 0; //@line 1350
           $702 = ($$3$be$i | 0) == 46; //@line 1352
           if (!($702 | $703 >>> 0 < 10)) {
            $$3$lcssa$i = $$3$be$i; //@line 1357
            $394 = $708; //@line 1357
            $395 = $706; //@line 1357
            $397 = $709; //@line 1357
            $398 = $707; //@line 1357
            $gotdig$3$lcssa$i = $gotdig$4$i; //@line 1357
            $gotrad$1$lcssa$i = $gotrad$2$i; //@line 1357
            $j$0$lcssa$i = $j$2$i; //@line 1357
            $k$0$lcssa$i = $k$2$i; //@line 1357
            $lnz$0$lcssa$i = $lnz$2$i; //@line 1357
            label = 161; //@line 1358
            break L203;
           } else {
            $$3105$i = $$3$be$i; //@line 1355
            $365 = $708; //@line 1355
            $366 = $709; //@line 1355
            $704 = $706; //@line 1355
            $705 = $707; //@line 1355
            $gotdig$3101$i = $gotdig$4$i; //@line 1355
            $gotrad$1102$i = $gotrad$2$i; //@line 1355
            $j$0104$i = $j$2$i; //@line 1355
            $k$0103$i = $k$2$i; //@line 1355
            $lnz$0100$i = $lnz$2$i; //@line 1355
           }
          }
          $714 = $712; //@line 1363
          $715 = $713; //@line 1363
          $716 = $710; //@line 1363
          $717 = $711; //@line 1363
          $718 = ($gotdig$3101$i$lcssa | 0) != 0; //@line 1363
          $j$069$i = $j$0104$i$lcssa; //@line 1363
          $k$065$i = $k$0103$i$lcssa; //@line 1363
          $lnz$059$i = $lnz$0100$i$lcssa; //@line 1363
          label = 169; //@line 1364
         } else {
          $$3$lcssa$i = $$2$i; //@line 1366
          $394 = 0; //@line 1366
          $395 = $700; //@line 1366
          $397 = 0; //@line 1366
          $398 = $701; //@line 1366
          $gotdig$3$lcssa$i = $gotdig$2$i13; //@line 1366
          $gotrad$1$lcssa$i = $gotrad$0$i14; //@line 1366
          $j$0$lcssa$i = 0; //@line 1366
          $k$0$lcssa$i = 0; //@line 1366
          $lnz$0$lcssa$i = 0; //@line 1366
          label = 161; //@line 1367
         }
        } while (0);
        do {
         if ((label | 0) == 161) {
          $392 = ($gotrad$1$lcssa$i | 0) == 0; //@line 1372
          $393 = $392 ? $394 : $395; //@line 1373
          $396 = $392 ? $397 : $398; //@line 1374
          $399 = ($gotdig$3$lcssa$i | 0) != 0; //@line 1375
          if (!(($$3$lcssa$i | 32 | 0) == 101 & $399)) {
           if (($$3$lcssa$i | 0) > -1) {
            $714 = $394; //@line 1382
            $715 = $397; //@line 1382
            $716 = $393; //@line 1382
            $717 = $396; //@line 1382
            $718 = $399; //@line 1382
            $j$069$i = $j$0$lcssa$i; //@line 1382
            $k$065$i = $k$0$lcssa$i; //@line 1382
            $lnz$059$i = $lnz$0$lcssa$i; //@line 1382
            label = 169; //@line 1383
            break;
           } else {
            $719 = $394; //@line 1386
            $720 = $397; //@line 1386
            $721 = $399; //@line 1386
            $722 = $393; //@line 1386
            $723 = $396; //@line 1386
            $j$068$i = $j$0$lcssa$i; //@line 1386
            $k$064$i = $k$0$lcssa$i; //@line 1386
            $lnz$058$i = $lnz$0$lcssa$i; //@line 1386
            label = 171; //@line 1387
            break;
           }
          }
          $402 = _scanexp($f, $pok) | 0; //@line 1391
          $403 = tempRet0; //@line 1392
          if (($402 | 0) == 0 & ($403 | 0) == -2147483648) {
           if (!$pok) {
            ___shlim($f, 0); //@line 1399
            $$0$i27 = 0.0; //@line 1400
            break;
           }
           if (!(HEAP32[$1 >> 2] | 0)) {
            $412 = 0; //@line 1406
            $413 = 0; //@line 1406
           } else {
            HEAP32[$0 >> 2] = (HEAP32[$0 >> 2] | 0) + -1; //@line 1410
            $412 = 0; //@line 1411
            $413 = 0; //@line 1411
           }
          } else {
           $412 = $402; //@line 1414
           $413 = $403; //@line 1414
          }
          $414 = _i64Add($412 | 0, $413 | 0, $393 | 0, $396 | 0) | 0; //@line 1416
          $427 = $414; //@line 1418
          $428 = $394; //@line 1418
          $430 = tempRet0; //@line 1418
          $431 = $397; //@line 1418
          $j$067$i = $j$0$lcssa$i; //@line 1418
          $k$063$i = $k$0$lcssa$i; //@line 1418
          $lnz$057$i = $lnz$0$lcssa$i; //@line 1418
          label = 173; //@line 1419
         }
        } while (0);
        if ((label | 0) == 169) {
         if (!(HEAP32[$1 >> 2] | 0)) {
          $719 = $714; //@line 1426
          $720 = $715; //@line 1426
          $721 = $718; //@line 1426
          $722 = $716; //@line 1426
          $723 = $717; //@line 1426
          $j$068$i = $j$069$i; //@line 1426
          $k$064$i = $k$065$i; //@line 1426
          $lnz$058$i = $lnz$059$i; //@line 1426
          label = 171; //@line 1427
         } else {
          HEAP32[$0 >> 2] = (HEAP32[$0 >> 2] | 0) + -1; //@line 1431
          if ($718) {
           $427 = $716; //@line 1433
           $428 = $714; //@line 1433
           $430 = $717; //@line 1433
           $431 = $715; //@line 1433
           $j$067$i = $j$069$i; //@line 1433
           $k$063$i = $k$065$i; //@line 1433
           $lnz$057$i = $lnz$059$i; //@line 1433
           label = 173; //@line 1434
          } else {
           label = 172; //@line 1436
          }
         }
        }
        if ((label | 0) == 171) {
         if ($721) {
          $427 = $722; //@line 1442
          $428 = $719; //@line 1442
          $430 = $723; //@line 1442
          $431 = $720; //@line 1442
          $j$067$i = $j$068$i; //@line 1442
          $k$063$i = $k$064$i; //@line 1442
          $lnz$057$i = $lnz$058$i; //@line 1442
          label = 173; //@line 1443
         } else {
          label = 172; //@line 1445
         }
        }
        do {
         if ((label | 0) == 172) {
          HEAP32[(___errno_location() | 0) >> 2] = 22; //@line 1451
          ___shlim($f, 0); //@line 1452
          $$0$i27 = 0.0; //@line 1453
         } else if ((label | 0) == 173) {
          $422 = HEAP32[$x$i >> 2] | 0; //@line 1456
          if (!$422) {
           $$0$i27 = +($sign$0 | 0) * 0.0; //@line 1461
           break;
          }
          if ((($431 | 0) < 0 | ($431 | 0) == 0 & $428 >>> 0 < 10) & (($427 | 0) == ($428 | 0) & ($430 | 0) == ($431 | 0))) {
           if ($bits$0$ph >>> 0 > 30 | ($422 >>> $bits$0$ph | 0) == 0) {
            $$0$i27 = +($sign$0 | 0) * +($422 >>> 0); //@line 1482
            break;
           }
          }
          $444 = ($emin$0$ph | 0) / -2 | 0; //@line 1486
          $446 = (($444 | 0) < 0) << 31 >> 31; //@line 1488
          if (($430 | 0) > ($446 | 0) | ($430 | 0) == ($446 | 0) & $427 >>> 0 > $444 >>> 0) {
           HEAP32[(___errno_location() | 0) >> 2] = 34; //@line 1496
           $$0$i27 = +($sign$0 | 0) * 1.7976931348623157e+308 * 1.7976931348623157e+308; //@line 1500
           break;
          }
          $456 = $emin$0$ph + -106 | 0; //@line 1503
          $458 = (($456 | 0) < 0) << 31 >> 31; //@line 1505
          if (($430 | 0) < ($458 | 0) | ($430 | 0) == ($458 | 0) & $427 >>> 0 < $456 >>> 0) {
           HEAP32[(___errno_location() | 0) >> 2] = 34; //@line 1513
           $$0$i27 = +($sign$0 | 0) * 2.2250738585072014e-308 * 2.2250738585072014e-308; //@line 1517
           break;
          }
          if (!$j$067$i) {
           $k$3$i = $k$063$i; //@line 1522
          } else {
           if (($j$067$i | 0) < 9) {
            $470 = $x$i + ($k$063$i << 2) | 0; //@line 1526
            $472 = HEAP32[$470 >> 2] | 0; //@line 1528
            $j$394$i = $j$067$i; //@line 1528
            while (1) {
             $471 = $472 * 10 | 0; //@line 1530
             $j$394$i = $j$394$i + 1 | 0; //@line 1531
             if (($j$394$i | 0) == 9) {
              $$lcssa265 = $471; //@line 1534
              break;
             } else {
              $472 = $471; //@line 1537
             }
            }
            HEAP32[$470 >> 2] = $$lcssa265; //@line 1540
           }
           $k$3$i = $k$063$i + 1 | 0; //@line 1543
          }
          if (($lnz$057$i | 0) < 9) {
           if (($lnz$057$i | 0) <= ($427 | 0) & ($427 | 0) < 18) {
            if (($427 | 0) == 9) {
             $$0$i27 = +($sign$0 | 0) * +((HEAP32[$x$i >> 2] | 0) >>> 0); //@line 1557
             break;
            }
            if (($427 | 0) < 9) {
             $$0$i27 = +($sign$0 | 0) * +((HEAP32[$x$i >> 2] | 0) >>> 0) / +(HEAP32[276 + (8 - $427 << 2) >> 2] | 0); //@line 1571
             break;
            }
            $494 = $bits$0$ph + 27 + (Math_imul($427, -3) | 0) | 0; //@line 1576
            $$pre$i17 = HEAP32[$x$i >> 2] | 0; //@line 1578
            if (($494 | 0) > 30 | ($$pre$i17 >>> $494 | 0) == 0) {
             $$0$i27 = +($sign$0 | 0) * +($$pre$i17 >>> 0) * +(HEAP32[276 + ($427 + -10 << 2) >> 2] | 0); //@line 1591
             break;
            }
           }
          }
          $506 = ($427 | 0) % 9 | 0; //@line 1596
          if (!$506) {
           $a$2$ph38$i = 0; //@line 1599
           $e2$0$ph$i = 0; //@line 1599
           $rp$2$ph36$i = $427; //@line 1599
           $z$1$ph37$i = $k$3$i; //@line 1599
          } else {
           $510 = ($427 | 0) > -1 ? $506 : $506 + 9 | 0; //@line 1603
           $513 = HEAP32[276 + (8 - $510 << 2) >> 2] | 0; //@line 1606
           if (!$k$3$i) {
            $a$0$lcssa151$i = 0; //@line 1609
            $rp$0$lcssa152$i = $427; //@line 1609
            $z$0$i = 0; //@line 1609
           } else {
            $515 = 1e9 / ($513 | 0) | 0; //@line 1611
            $a$085$i = 0; //@line 1612
            $carry$087$i = 0; //@line 1612
            $k$486$i = 0; //@line 1612
            $rp$084$i = $427; //@line 1612
            while (1) {
             $516 = $x$i + ($k$486$i << 2) | 0; //@line 1614
             $517 = HEAP32[$516 >> 2] | 0; //@line 1615
             $520 = (($517 >>> 0) / ($513 >>> 0) | 0) + $carry$087$i | 0; //@line 1618
             HEAP32[$516 >> 2] = $520; //@line 1619
             $521 = Math_imul(($517 >>> 0) % ($513 >>> 0) | 0, $515) | 0; //@line 1620
             $or$cond16$i = ($k$486$i | 0) == ($a$085$i | 0) & ($520 | 0) == 0; //@line 1623
             $k$486$i = $k$486$i + 1 | 0; //@line 1624
             $rp$1$i18 = $or$cond16$i ? $rp$084$i + -9 | 0 : $rp$084$i; //@line 1627
             $a$1$i = $or$cond16$i ? $k$486$i & 127 : $a$085$i; //@line 1628
             if (($k$486$i | 0) == ($k$3$i | 0)) {
              $$lcssa264 = $521; //@line 1631
              $a$1$i$lcssa = $a$1$i; //@line 1631
              $rp$1$i18$lcssa = $rp$1$i18; //@line 1631
              break;
             } else {
              $a$085$i = $a$1$i; //@line 1634
              $carry$087$i = $521; //@line 1634
              $rp$084$i = $rp$1$i18; //@line 1634
             }
            }
            if (!$$lcssa264) {
             $a$0$lcssa151$i = $a$1$i$lcssa; //@line 1639
             $rp$0$lcssa152$i = $rp$1$i18$lcssa; //@line 1639
             $z$0$i = $k$3$i; //@line 1639
            } else {
             HEAP32[$x$i + ($k$3$i << 2) >> 2] = $$lcssa264; //@line 1643
             $a$0$lcssa151$i = $a$1$i$lcssa; //@line 1644
             $rp$0$lcssa152$i = $rp$1$i18$lcssa; //@line 1644
             $z$0$i = $k$3$i + 1 | 0; //@line 1644
            }
           }
           $a$2$ph38$i = $a$0$lcssa151$i; //@line 1649
           $e2$0$ph$i = 0; //@line 1649
           $rp$2$ph36$i = 9 - $510 + $rp$0$lcssa152$i | 0; //@line 1649
           $z$1$ph37$i = $z$0$i; //@line 1649
          }
          L284 : while (1) {
           $533 = ($rp$2$ph36$i | 0) < 18; //@line 1652
           $534 = ($rp$2$ph36$i | 0) == 18; //@line 1653
           $535 = $x$i + ($a$2$ph38$i << 2) | 0; //@line 1654
           $e2$0$i19 = $e2$0$ph$i; //@line 1655
           $z$1$i = $z$1$ph37$i; //@line 1655
           while (1) {
            if (!$533) {
             if (!$534) {
              $a$3$ph$i = $a$2$ph38$i; //@line 1659
              $e2$1$ph$i = $e2$0$i19; //@line 1659
              $rp$3$ph34$i = $rp$2$ph36$i; //@line 1659
              $z$5$ph$i = $z$1$i; //@line 1659
              break L284;
             }
             if ((HEAP32[$535 >> 2] | 0) >>> 0 >= 9007199) {
              $a$3$ph$i = $a$2$ph38$i; //@line 1665
              $e2$1$ph$i = $e2$0$i19; //@line 1665
              $rp$3$ph34$i = 18; //@line 1665
              $z$5$ph$i = $z$1$i; //@line 1665
              break L284;
             }
            }
            $carry1$0$i = 0; //@line 1670
            $k$5$in$i = $z$1$i + 127 | 0; //@line 1670
            $z$2$i = $z$1$i; //@line 1670
            while (1) {
             $k$5$i = $k$5$in$i & 127; //@line 1672
             $539 = $x$i + ($k$5$i << 2) | 0; //@line 1673
             $541 = _bitshift64Shl(HEAP32[$539 >> 2] | 0, 0, 29) | 0; //@line 1675
             $543 = _i64Add($541 | 0, tempRet0 | 0, $carry1$0$i | 0, 0) | 0; //@line 1677
             $544 = tempRet0; //@line 1678
             if ($544 >>> 0 > 0 | ($544 | 0) == 0 & $543 >>> 0 > 1e9) {
              $550 = ___udivdi3($543 | 0, $544 | 0, 1e9, 0) | 0; //@line 1685
              $552 = ___uremdi3($543 | 0, $544 | 0, 1e9, 0) | 0; //@line 1687
              $$sink$off0$i = $552; //@line 1689
              $carry1$1$i = $550; //@line 1689
             } else {
              $$sink$off0$i = $543; //@line 1691
              $carry1$1$i = 0; //@line 1691
             }
             HEAP32[$539 >> 2] = $$sink$off0$i; //@line 1693
             $557 = ($k$5$i | 0) == ($a$2$ph38$i | 0); //@line 1697
             $z$3$i = ($k$5$i | 0) != ($z$2$i + 127 & 127 | 0) | $557 ? $z$2$i : ($$sink$off0$i | 0) == 0 ? $k$5$i : $z$2$i; //@line 1701
             if ($557) {
              $carry1$1$i$lcssa = $carry1$1$i; //@line 1704
              $z$3$i$lcssa = $z$3$i; //@line 1704
              break;
             } else {
              $carry1$0$i = $carry1$1$i; //@line 1707
              $k$5$in$i = $k$5$i + -1 | 0; //@line 1707
              $z$2$i = $z$3$i; //@line 1707
             }
            }
            $560 = $e2$0$i19 + -29 | 0; //@line 1710
            if (!$carry1$1$i$lcssa) {
             $e2$0$i19 = $560; //@line 1713
             $z$1$i = $z$3$i$lcssa; //@line 1713
            } else {
             $$lcssa263 = $560; //@line 1715
             $carry1$1$i$lcssa$lcssa = $carry1$1$i$lcssa; //@line 1715
             $z$3$i$lcssa$lcssa = $z$3$i$lcssa; //@line 1715
             break;
            }
           }
           $564 = $a$2$ph38$i + 127 & 127; //@line 1721
           if (($564 | 0) == ($z$3$i$lcssa$lcssa | 0)) {
            $567 = $z$3$i$lcssa$lcssa + 127 & 127; //@line 1725
            $572 = $x$i + (($z$3$i$lcssa$lcssa + 126 & 127) << 2) | 0; //@line 1730
            HEAP32[$572 >> 2] = HEAP32[$572 >> 2] | HEAP32[$x$i + ($567 << 2) >> 2]; //@line 1733
            $z$4$i = $567; //@line 1734
           } else {
            $z$4$i = $z$3$i$lcssa$lcssa; //@line 1736
           }
           HEAP32[$x$i + ($564 << 2) >> 2] = $carry1$1$i$lcssa$lcssa; //@line 1739
           $a$2$ph38$i = $564; //@line 1740
           $e2$0$ph$i = $$lcssa263; //@line 1740
           $rp$2$ph36$i = $rp$2$ph36$i + 9 | 0; //@line 1740
           $z$1$ph37$i = $z$4$i; //@line 1740
          }
          L302 : while (1) {
           $604 = $z$5$ph$i + 1 & 127; //@line 1744
           $609 = $x$i + (($z$5$ph$i + 127 & 127) << 2) | 0; //@line 1747
           $a$3$ph157$i = $a$3$ph$i; //@line 1748
           $e2$1$ph156$i = $e2$1$ph$i; //@line 1748
           $rp$3$ph$i = $rp$3$ph34$i; //@line 1748
           while (1) {
            $610 = ($rp$3$ph$i | 0) == 18; //@line 1750
            $$18$i = ($rp$3$ph$i | 0) > 27 ? 9 : 1; //@line 1752
            $$not$i = $610 ^ 1; //@line 1753
            $a$3$i = $a$3$ph157$i; //@line 1754
            $e2$1$i = $e2$1$ph156$i; //@line 1754
            while (1) {
             $576 = $a$3$i & 127; //@line 1756
             $577 = ($576 | 0) == ($z$5$ph$i | 0); //@line 1757
             do {
              if ($577) {
               label = 219; //@line 1760
              } else {
               $579 = HEAP32[$x$i + ($576 << 2) >> 2] | 0; //@line 1763
               if ($579 >>> 0 < 9007199) {
                label = 219; //@line 1766
                break;
               }
               if ($579 >>> 0 > 9007199) {
                break;
               }
               $583 = $a$3$i + 1 & 127; //@line 1774
               if (($583 | 0) == ($z$5$ph$i | 0)) {
                label = 219; //@line 1777
                break;
               }
               $691 = HEAP32[$x$i + ($583 << 2) >> 2] | 0; //@line 1781
               if ($691 >>> 0 < 254740991) {
                label = 219; //@line 1784
                break;
               }
               if (!($691 >>> 0 > 254740991 | $$not$i)) {
                $617 = $576; //@line 1790
                $a$3$i249 = $a$3$i; //@line 1790
                $e2$1$i246 = $e2$1$i; //@line 1790
                $z$7$i = $z$5$ph$i; //@line 1790
                break L302;
               }
              }
             } while (0);
             if ((label | 0) == 219) {
              label = 0; //@line 1796
              if ($610) {
               label = 220; //@line 1798
               break L302;
              }
             }
             $585 = $e2$1$i + $$18$i | 0; //@line 1802
             if (($a$3$i | 0) == ($z$5$ph$i | 0)) {
              $a$3$i = $z$5$ph$i; //@line 1805
              $e2$1$i = $585; //@line 1805
             } else {
              $$lcssa256 = $585; //@line 1807
              $a$3$i$lcssa248 = $a$3$i; //@line 1807
              break;
             }
            }
            $588 = (1 << $$18$i) + -1 | 0; //@line 1812
            $589 = 1e9 >>> $$18$i; //@line 1813
            $a$478$i = $a$3$i$lcssa248; //@line 1814
            $carry3$081$i = 0; //@line 1814
            $k$679$i = $a$3$i$lcssa248; //@line 1814
            $rp$477$i = $rp$3$ph$i; //@line 1814
            while (1) {
             $590 = $x$i + ($k$679$i << 2) | 0; //@line 1816
             $591 = HEAP32[$590 >> 2] | 0; //@line 1817
             $594 = ($591 >>> $$18$i) + $carry3$081$i | 0; //@line 1820
             HEAP32[$590 >> 2] = $594; //@line 1821
             $595 = Math_imul($591 & $588, $589) | 0; //@line 1822
             $or$cond19$i = ($k$679$i | 0) == ($a$478$i | 0) & ($594 | 0) == 0; //@line 1825
             $k$679$i = $k$679$i + 1 & 127; //@line 1827
             $rp$5$i = $or$cond19$i ? $rp$477$i + -9 | 0 : $rp$477$i; //@line 1829
             $a$5$i = $or$cond19$i ? $k$679$i : $a$478$i; //@line 1830
             if (($k$679$i | 0) == ($z$5$ph$i | 0)) {
              $$lcssa257 = $595; //@line 1833
              $a$5$i$lcssa = $a$5$i; //@line 1833
              $rp$5$i$lcssa = $rp$5$i; //@line 1833
              break;
             } else {
              $a$478$i = $a$5$i; //@line 1836
              $carry3$081$i = $595; //@line 1836
              $rp$477$i = $rp$5$i; //@line 1836
             }
            }
            if (!$$lcssa257) {
             $a$3$ph157$i = $a$5$i$lcssa; //@line 1841
             $e2$1$ph156$i = $$lcssa256; //@line 1841
             $rp$3$ph$i = $rp$5$i$lcssa; //@line 1841
             continue;
            }
            if (($604 | 0) != ($a$5$i$lcssa | 0)) {
             $$lcssa256$lcssa = $$lcssa256; //@line 1846
             $$lcssa257$lcssa = $$lcssa257; //@line 1846
             $a$5$i$lcssa$lcssa = $a$5$i$lcssa; //@line 1846
             $rp$5$i$lcssa$lcssa = $rp$5$i$lcssa; //@line 1846
             break;
            }
            HEAP32[$609 >> 2] = HEAP32[$609 >> 2] | 1; //@line 1851
            $a$3$ph157$i = $a$5$i$lcssa; //@line 1852
            $e2$1$ph156$i = $$lcssa256; //@line 1852
            $rp$3$ph$i = $rp$5$i$lcssa; //@line 1852
           }
           HEAP32[$x$i + ($z$5$ph$i << 2) >> 2] = $$lcssa257$lcssa; //@line 1855
           $a$3$ph$i = $a$5$i$lcssa$lcssa; //@line 1856
           $e2$1$ph$i = $$lcssa256$lcssa; //@line 1856
           $rp$3$ph34$i = $rp$5$i$lcssa$lcssa; //@line 1856
           $z$5$ph$i = $604; //@line 1856
          }
          if ((label | 0) == 220) {
           if ($577) {
            HEAP32[$x$i + ($604 + -1 << 2) >> 2] = 0; //@line 1862
            $617 = $z$5$ph$i; //@line 1863
            $a$3$i249 = $a$3$i; //@line 1863
            $e2$1$i246 = $e2$1$i; //@line 1863
            $z$7$i = $604; //@line 1863
           } else {
            $617 = $576; //@line 1865
            $a$3$i249 = $a$3$i; //@line 1865
            $e2$1$i246 = $e2$1$i; //@line 1865
            $z$7$i = $z$5$ph$i; //@line 1865
           }
          }
          $619 = +((HEAP32[$x$i + ($617 << 2) >> 2] | 0) >>> 0); //@line 1870
          $621 = $a$3$i249 + 1 & 127; //@line 1872
          if (($621 | 0) == ($z$7$i | 0)) {
           $680 = $a$3$i249 + 2 & 127; //@line 1876
           HEAP32[$x$i + ($680 + -1 << 2) >> 2] = 0; //@line 1879
           $z$7$1$i = $680; //@line 1880
          } else {
           $z$7$1$i = $z$7$i; //@line 1882
          }
          $643 = +($sign$0 | 0); //@line 1889
          $625 = $643 * ($619 * 1.0e9 + +((HEAP32[$x$i + ($621 << 2) >> 2] | 0) >>> 0)); //@line 1890
          $663 = $e2$1$i246 + 53 | 0; //@line 1891
          $669 = $663 - $emin$0$ph | 0; //@line 1892
          $670 = ($669 | 0) < ($bits$0$ph | 0); //@line 1893
          $denormal$0$i = $670 & 1; //@line 1896
          $$010$i = $670 ? ($669 | 0) < 0 ? 0 : $669 : $bits$0$ph; //@line 1897
          if (($$010$i | 0) < 53) {
           $626 = +_copysignl(+_scalbn(1.0, 105 - $$010$i | 0), $625); //@line 1902
           $629 = +_fmodl($625, +_scalbn(1.0, 53 - $$010$i | 0)); //@line 1905
           $bias$0$i25 = $626; //@line 1908
           $frac$0$i = $629; //@line 1908
           $y$1$i24 = $626 + ($625 - $629); //@line 1908
          } else {
           $bias$0$i25 = 0.0; //@line 1910
           $frac$0$i = 0.0; //@line 1910
           $y$1$i24 = $625; //@line 1910
          }
          $633 = $a$3$i249 + 2 & 127; //@line 1913
          do {
           if (($633 | 0) == ($z$7$1$i | 0)) {
            $frac$2$i = $frac$0$i; //@line 1917
           } else {
            $636 = HEAP32[$x$i + ($633 << 2) >> 2] | 0; //@line 1920
            do {
             if ($636 >>> 0 < 5e8) {
              if (!$636) {
               if (($a$3$i249 + 3 & 127 | 0) == ($z$7$1$i | 0)) {
                $frac$1$i = $frac$0$i; //@line 1930
                break;
               }
              }
              $frac$1$i = $643 * .25 + $frac$0$i; //@line 1936
             } else {
              if ($636 >>> 0 > 5e8) {
               $frac$1$i = $643 * .75 + $frac$0$i; //@line 1942
               break;
              }
              if (($a$3$i249 + 3 & 127 | 0) == ($z$7$1$i | 0)) {
               $frac$1$i = $643 * .5 + $frac$0$i; //@line 1951
               break;
              } else {
               $frac$1$i = $643 * .75 + $frac$0$i; //@line 1956
               break;
              }
             }
            } while (0);
            if ((53 - $$010$i | 0) <= 1) {
             $frac$2$i = $frac$1$i; //@line 1964
             break;
            }
            if (+_fmodl($frac$1$i, 1.0) != 0.0) {
             $frac$2$i = $frac$1$i; //@line 1970
             break;
            }
            $frac$2$i = $frac$1$i + 1.0; //@line 1974
           }
          } while (0);
          $661 = $y$1$i24 + $frac$2$i - $bias$0$i25; //@line 1978
          do {
           if (($663 & 2147483647 | 0) > (-2 - $sum$i | 0)) {
            if (!(+Math_abs(+$661) >= 9007199254740992.0)) {
             $denormal$2$i = $denormal$0$i; //@line 1987
             $e2$2$i = $e2$1$i246; //@line 1987
             $y$2$i26 = $661; //@line 1987
            } else {
             $denormal$2$i = $670 & ($$010$i | 0) == ($669 | 0) ? 0 : $denormal$0$i; //@line 1994
             $e2$2$i = $e2$1$i246 + 1 | 0; //@line 1994
             $y$2$i26 = $661 * .5; //@line 1994
            }
            if (($e2$2$i + 50 | 0) <= ($330 | 0)) {
             if (!($frac$2$i != 0.0 & ($denormal$2$i | 0) != 0)) {
              $e2$3$i = $e2$2$i; //@line 2003
              $y$3$i = $y$2$i26; //@line 2003
              break;
             }
            }
            HEAP32[(___errno_location() | 0) >> 2] = 34; //@line 2008
            $e2$3$i = $e2$2$i; //@line 2009
            $y$3$i = $y$2$i26; //@line 2009
           } else {
            $e2$3$i = $e2$1$i246; //@line 2011
            $y$3$i = $661; //@line 2011
           }
          } while (0);
          $$0$i27 = +_scalbnl($y$3$i, $e2$3$i); //@line 2015
         }
        } while (0);
        $$0 = $$0$i27; //@line 2018
        break L4;
        break;
       }
      default:
       {
        if (HEAP32[$1 >> 2] | 0) {
         HEAP32[$0 >> 2] = (HEAP32[$0 >> 2] | 0) + -1; //@line 2028
        }
        HEAP32[(___errno_location() | 0) >> 2] = 22; //@line 2031
        ___shlim($f, 0); //@line 2032
        $$0 = 0.0; //@line 2033
        break L4;
       }
      }
     }
    }
   } while (0);
   if ((label | 0) == 23) {
    $42 = (HEAP32[$1 >> 2] | 0) == 0; //@line 2042
    if (!$42) {
     HEAP32[$0 >> 2] = (HEAP32[$0 >> 2] | 0) + -1; //@line 2046
    }
    if (($pok | 0) != 0 & $i$0$lcssa >>> 0 > 3) {
     $i$1 = $i$0$lcssa; //@line 2052
     do {
      if (!$42) {
       HEAP32[$0 >> 2] = (HEAP32[$0 >> 2] | 0) + -1; //@line 2057
      }
      $i$1 = $i$1 + -1 | 0; //@line 2059
     } while ($i$1 >>> 0 > 3);
    }
   }
   $$0 = +($sign$0 | 0) * inf; //@line 2072
  }
 } while (0);
 STACKTOP = sp; //@line 2075
 return +$$0;
}
function _printf_core($f, $fmt, $ap, $nl_arg, $nl_type) {
 $f = $f | 0;
 $fmt = $fmt | 0;
 $ap = $ap | 0;
 $nl_arg = $nl_arg | 0;
 $nl_type = $nl_type | 0;
 var $$0 = 0, $$0$i = 0, $$0$lcssa$i = 0, $$012$i = 0, $$013$i = 0, $$03$i33 = 0, $$07$i = 0.0, $$1$i = 0.0, $$114$i = 0, $$2$i = 0.0, $$20$i = 0.0, $$21$i = 0, $$210$i = 0, $$23$i = 0, $$3$i = 0.0, $$31$i = 0, $$311$i = 0, $$4$i = 0.0, $$412$lcssa$i = 0, $$41276$i = 0, $$5$lcssa$i = 0, $$51 = 0, $$587$i = 0, $$a$3$i = 0, $$a$3186$i = 0, $$fl$4 = 0, $$lcssa = 0, $$lcssa159$i = 0, $$lcssa318 = 0, $$lcssa323 = 0, $$lcssa324 = 0, $$lcssa325 = 0, $$lcssa326 = 0, $$lcssa327 = 0, $$lcssa329 = 0, $$lcssa339 = 0, $$lcssa342 = 0.0, $$lcssa344 = 0, $$p$$i = 0, $$p$5 = 0, $$p$i = 0, $$pn$i = 0, $$pr$i = 0, $$pr47$i = 0, $$pre$phi184$iZ2D = 0, $$pre182$i = 0, $$z$4$i = 0, $0 = 0, $1 = 0, $10 = 0, $100 = 0, $106 = 0, $107 = 0, $109 = 0, $11 = 0, $12 = 0, $13 = 0, $133 = 0, $134 = 0, $137 = 0, $138 = 0, $139 = 0, $14 = 0, $144 = 0, $146 = 0, $148 = 0, $149 = 0, $15 = 0, $154 = 0, $157 = 0, $162 = 0, $163 = 0, $168 = 0, $175 = 0, $176 = 0, $187 = 0, $199 = 0, $2 = 0, $206 = 0, $208 = 0, $21 = 0, $211 = 0, $212 = 0, $217 = 0, $223 = 0, $224 = 0, $23 = 0, $230 = 0, $24 = 0, $243 = 0, $245 = 0, $248 = 0, $253 = 0, $256 = 0, $257 = 0, $267 = 0, $269 = 0, $271 = 0, $274 = 0, $276 = 0, $277 = 0, $278 = 0, $28 = 0, $284 = 0, $286 = 0, $287 = 0, $29 = 0, $291 = 0, $299 = 0, $3 = 0, $305 = 0, $317 = 0, $320 = 0, $321 = 0, $334 = 0, $336 = 0, $34 = 0, $341 = 0, $346 = 0, $349 = 0, $359 = 0.0, $366 = 0, $370 = 0, $377 = 0, $379 = 0, $381 = 0, $382 = 0, $386 = 0, $39 = 0, $392 = 0.0, $393 = 0, $396 = 0, $398 = 0, $4 = 0, $40 = 0, $401 = 0, $403 = 0, $407 = 0.0, $417 = 0, $420 = 0, $423 = 0, $432 = 0, $434 = 0, $435 = 0, $44 = 0, $441 = 0, $459 = 0, $46 = 0, $464 = 0, $469 = 0, $47 = 0, $479 = 0, $481 = 0, $482 = 0, $483 = 0, $484 = 0, $491 = 0, $492 = 0, $495 = 0, $497 = 0, $498 = 0, $499 = 0, $5 = 0, $501 = 0, $505 = 0, $507 = 0, $51 = 0, $511 = 0, $516 = 0, $517 = 0, $518 = 0, $519 = 0, $521 = 0, $527 = 0, $528 = 0, $529 = 0, $533 = 0, $541 = 0, $555 = 0, $556 = 0, $559 = 0, $56 = 0, $564 = 0, $565 = 0, $567 = 0, $574 = 0, $575 = 0, $576 = 0, $579 = 0, $580 = 0, $581 = 0, $588 = 0, $59 = 0, $598 = 0, $6 = 0, $60 = 0, $601 = 0, $603 = 0, $605 = 0, $607 = 0, $61 = 0, $612 = 0, $613 = 0, $616 = 0, $618 = 0, $620 = 0, $622 = 0, $633 = 0, $636 = 0, $641 = 0, $650 = 0, $651 = 0, $655 = 0, $658 = 0, $66 = 0, $660 = 0, $662 = 0, $666 = 0, $669 = 0, $67 = 0, $673 = 0, $683 = 0, $688 = 0, $695 = 0, $698 = 0, $7 = 0, $706 = 0, $716 = 0, $718 = 0, $726 = 0, $733 = 0, $735 = 0, $739 = 0, $741 = 0, $750 = 0, $756 = 0, $771 = 0, $773 = 0, $786 = 0, $8 = 0, $9 = 0, $91 = 0, $92 = 0, $98 = 0, $99 = 0, $a$0 = 0, $a$1 = 0, $a$1$lcssa$i = 0, $a$1147$i = 0, $a$2 = 0, $a$2$ph$i = 0, $a$3$lcssa$i = 0, $a$3134$i = 0, $a$5$lcssa$i = 0, $a$5109$i = 0, $a$6$i = 0, $a$7$i = 0, $a$8$ph$i = 0, $arg = 0, $argpos$0 = 0, $big$i = 0, $buf = 0, $buf$i = 0, $carry$0140$i = 0, $carry3$0128$i = 0, $cnt$0 = 0, $cnt$1 = 0, $cnt$1$lcssa = 0, $d$0139$i = 0, $d$0141$i = 0, $d$1127$i = 0, $d$2$lcssa$i = 0, $d$2108$i = 0, $d$3$i = 0, $d$482$i = 0, $d$575$i = 0, $d$686$i = 0, $e$0123$i = 0, $e$1$i = 0, $e$2104$i = 0, $e$3$i = 0, $e$4$ph$i = 0, $e2$i = 0, $ebuf0$i = 0, $estr$0$i = 0, $estr$1$lcssa$i = 0, $estr$193$i = 0, $estr$2$i = 0, $fl$0109 = 0, $fl$062 = 0, $fl$1 = 0, $fl$1$ = 0, $fl$3 = 0, $fl$4 = 0, $fl$6 = 0, $fmt39$lcssa = 0, $fmt39101 = 0, $fmt40 = 0, $fmt41 = 0, $fmt42 = 0, $fmt44 = 0, $fmt44$lcssa321 = 0, $fmt45 = 0, $i$0$lcssa = 0, $i$0$lcssa200 = 0, $i$0114 = 0, $i$0122$i = 0, $i$03$i = 0, $i$03$i25 = 0, $i$1$lcssa$i = 0, $i$1116$i = 0, $i$1125 = 0, $i$2100 = 0, $i$2100$lcssa = 0, $i$2103$i = 0, $i$398 = 0, $i$399$i = 0, $isdigittmp = 0, $isdigittmp1$i = 0, $isdigittmp1$i22 = 0, $isdigittmp11 = 0, $isdigittmp4$i = 0, $isdigittmp4$i24 = 0, $isdigittmp9 = 0, $j$0115$i = 0, $j$0117$i = 0, $j$1100$i = 0, $j$2$i = 0, $l$0 = 0, $l$0$i = 0, $l$1113 = 0, $l$2 = 0, $l10n$0 = 0, $l10n$0$lcssa = 0, $l10n$1 = 0, $l10n$2 = 0, $l10n$3 = 0, $mb = 0, $notrhs$i = 0, $p$0 = 0, $p$1 = 0, $p$2 = 0, $p$4198 = 0, $p$5 = 0, $pl$0 = 0, $pl$0$i = 0, $pl$1 = 0, $pl$1$i = 0, $pl$2 = 0, $prefix$0 = 0, $prefix$0$$i = 0, $prefix$0$i = 0, $prefix$1 = 0, $prefix$2 = 0, $r$0$a$8$i = 0, $re$169$i = 0, $round$068$i = 0.0, $round6$1$i = 0.0, $s$0$i = 0, $s$1$i = 0, $s$1$i$lcssa = 0, $s7$079$i = 0, $s7$1$i = 0, $s8$0$lcssa$i = 0, $s8$070$i = 0, $s9$0$i = 0, $s9$183$i = 0, $s9$2$i = 0, $small$0$i = 0.0, $small$1$i = 0.0, $st$0 = 0, $st$0$lcssa322 = 0, $storemerge = 0, $storemerge13 = 0, $storemerge8108 = 0, $storemerge860 = 0, $t$0 = 0, $t$1 = 0, $w$0 = 0, $w$1 = 0, $w$2 = 0, $wc = 0, $ws$0115 = 0, $ws$1126 = 0, $z$0$i = 0, $z$0$lcssa = 0, $z$0102 = 0, $z$1$lcssa$i = 0, $z$1146$i = 0, $z$2 = 0, $z$2$i = 0, $z$2$i$lcssa = 0, $z$3$lcssa$i = 0, $z$3133$i = 0, $z$4$i = 0, $z$6$$i = 0, $z$6$i = 0, $z$6$i$lcssa = 0, $z$6$ph$i = 0, label = 0, sp = 0;
 sp = STACKTOP; //@line 7420
 STACKTOP = STACKTOP + 624 | 0; //@line 7421
 $big$i = sp + 24 | 0; //@line 7422
 $e2$i = sp + 16 | 0; //@line 7423
 $buf$i = sp + 588 | 0; //@line 7424
 $ebuf0$i = sp + 576 | 0; //@line 7425
 $arg = sp; //@line 7426
 $buf = sp + 536 | 0; //@line 7427
 $wc = sp + 8 | 0; //@line 7428
 $mb = sp + 528 | 0; //@line 7429
 $0 = ($f | 0) != 0; //@line 7430
 $1 = $buf + 40 | 0; //@line 7431
 $2 = $1; //@line 7432
 $3 = $buf + 39 | 0; //@line 7433
 $4 = $wc + 4 | 0; //@line 7434
 $5 = $ebuf0$i + 12 | 0; //@line 7435
 $6 = $ebuf0$i + 11 | 0; //@line 7436
 $7 = $buf$i; //@line 7437
 $8 = $5; //@line 7438
 $9 = $8 - $7 | 0; //@line 7439
 $10 = -2 - $7 | 0; //@line 7440
 $11 = $8 + 2 | 0; //@line 7441
 $12 = $big$i + 288 | 0; //@line 7442
 $13 = $buf$i + 9 | 0; //@line 7443
 $14 = $13; //@line 7444
 $15 = $buf$i + 8 | 0; //@line 7445
 $cnt$0 = 0; //@line 7446
 $fmt41 = $fmt; //@line 7446
 $l$0 = 0; //@line 7446
 $l10n$0 = 0; //@line 7446
 L1 : while (1) {
  do {
   if (($cnt$0 | 0) > -1) {
    if (($l$0 | 0) > (2147483647 - $cnt$0 | 0)) {
     HEAP32[(___errno_location() | 0) >> 2] = 75; //@line 7455
     $cnt$1 = -1; //@line 7456
     break;
    } else {
     $cnt$1 = $l$0 + $cnt$0 | 0; //@line 7460
     break;
    }
   } else {
    $cnt$1 = $cnt$0; //@line 7464
   }
  } while (0);
  $21 = HEAP8[$fmt41 >> 0] | 0; //@line 7467
  if (!($21 << 24 >> 24)) {
   $cnt$1$lcssa = $cnt$1; //@line 7470
   $l10n$0$lcssa = $l10n$0; //@line 7470
   label = 245; //@line 7471
   break;
  } else {
   $23 = $21; //@line 7474
   $fmt40 = $fmt41; //@line 7474
  }
  L9 : while (1) {
   switch ($23 << 24 >> 24) {
   case 37:
    {
     $fmt39101 = $fmt40; //@line 7479
     $z$0102 = $fmt40; //@line 7479
     label = 9; //@line 7480
     break L9;
     break;
    }
   case 0:
    {
     $fmt39$lcssa = $fmt40; //@line 7485
     $z$0$lcssa = $fmt40; //@line 7485
     break L9;
     break;
    }
   default:
    {}
   }
   $24 = $fmt40 + 1 | 0; //@line 7492
   $23 = HEAP8[$24 >> 0] | 0; //@line 7494
   $fmt40 = $24; //@line 7494
  }
  L12 : do {
   if ((label | 0) == 9) {
    while (1) {
     label = 0; //@line 7499
     if ((HEAP8[$fmt39101 + 1 >> 0] | 0) != 37) {
      $fmt39$lcssa = $fmt39101; //@line 7504
      $z$0$lcssa = $z$0102; //@line 7504
      break L12;
     }
     $28 = $z$0102 + 1 | 0; //@line 7507
     $29 = $fmt39101 + 2 | 0; //@line 7508
     if ((HEAP8[$29 >> 0] | 0) == 37) {
      $fmt39101 = $29; //@line 7512
      $z$0102 = $28; //@line 7512
      label = 9; //@line 7513
     } else {
      $fmt39$lcssa = $29; //@line 7515
      $z$0$lcssa = $28; //@line 7515
      break;
     }
    }
   }
  } while (0);
  $34 = $z$0$lcssa - $fmt41 | 0; //@line 7523
  if ($0) {
   if (!(HEAP32[$f >> 2] & 32)) {
    ___fwritex($fmt41, $34, $f) | 0; //@line 7529
   }
  }
  if (($z$0$lcssa | 0) != ($fmt41 | 0)) {
   $cnt$0 = $cnt$1; //@line 7534
   $fmt41 = $fmt39$lcssa; //@line 7534
   $l$0 = $34; //@line 7534
   continue;
  }
  $39 = $fmt39$lcssa + 1 | 0; //@line 7537
  $40 = HEAP8[$39 >> 0] | 0; //@line 7538
  $isdigittmp = ($40 << 24 >> 24) + -48 | 0; //@line 7540
  if ($isdigittmp >>> 0 < 10) {
   $44 = (HEAP8[$fmt39$lcssa + 2 >> 0] | 0) == 36; //@line 7545
   $$51 = $44 ? $fmt39$lcssa + 3 | 0 : $39; //@line 7547
   $47 = HEAP8[$$51 >> 0] | 0; //@line 7551
   $argpos$0 = $44 ? $isdigittmp : -1; //@line 7551
   $l10n$1 = $44 ? 1 : $l10n$0; //@line 7551
   $storemerge = $$51; //@line 7551
  } else {
   $47 = $40; //@line 7553
   $argpos$0 = -1; //@line 7553
   $l10n$1 = $l10n$0; //@line 7553
   $storemerge = $39; //@line 7553
  }
  $46 = $47 << 24 >> 24; //@line 7555
  L25 : do {
   if (($46 & -32 | 0) == 32) {
    $51 = $46; //@line 7560
    $56 = $47; //@line 7560
    $fl$0109 = 0; //@line 7560
    $storemerge8108 = $storemerge; //@line 7560
    while (1) {
     if (!(1 << $51 + -32 & 75913)) {
      $66 = $56; //@line 7567
      $fl$062 = $fl$0109; //@line 7567
      $storemerge860 = $storemerge8108; //@line 7567
      break L25;
     }
     $59 = 1 << ($56 << 24 >> 24) + -32 | $fl$0109; //@line 7573
     $60 = $storemerge8108 + 1 | 0; //@line 7574
     $61 = HEAP8[$60 >> 0] | 0; //@line 7575
     $51 = $61 << 24 >> 24; //@line 7576
     if (($51 & -32 | 0) != 32) {
      $66 = $61; //@line 7582
      $fl$062 = $59; //@line 7582
      $storemerge860 = $60; //@line 7582
      break;
     } else {
      $56 = $61; //@line 7580
      $fl$0109 = $59; //@line 7580
      $storemerge8108 = $60; //@line 7580
     }
    }
   } else {
    $66 = $47; //@line 7587
    $fl$062 = 0; //@line 7587
    $storemerge860 = $storemerge; //@line 7587
   }
  } while (0);
  do {
   if ($66 << 24 >> 24 == 42) {
    $67 = $storemerge860 + 1 | 0; //@line 7593
    $isdigittmp11 = (HEAP8[$67 >> 0] | 0) + -48 | 0; //@line 7596
    if ($isdigittmp11 >>> 0 < 10) {
     if ((HEAP8[$storemerge860 + 2 >> 0] | 0) == 36) {
      HEAP32[$nl_type + ($isdigittmp11 << 2) >> 2] = 10; //@line 7604
      $l10n$2 = 1; //@line 7616
      $storemerge13 = $storemerge860 + 3 | 0; //@line 7616
      $w$0 = HEAP32[$nl_arg + ((HEAP8[$67 >> 0] | 0) + -48 << 3) >> 2] | 0; //@line 7616
     } else {
      label = 24; //@line 7618
     }
    } else {
     label = 24; //@line 7621
    }
    if ((label | 0) == 24) {
     label = 0; //@line 7624
     if ($l10n$1) {
      $$0 = -1; //@line 7627
      break L1;
     }
     if (!$0) {
      $fl$1 = $fl$062; //@line 7631
      $fmt42 = $67; //@line 7631
      $l10n$3 = 0; //@line 7631
      $w$1 = 0; //@line 7631
      break;
     }
     $91 = (HEAP32[$ap >> 2] | 0) + (4 - 1) & ~(4 - 1); //@line 7645
     $92 = HEAP32[$91 >> 2] | 0; //@line 7646
     HEAP32[$ap >> 2] = $91 + 4; //@line 7648
     $l10n$2 = 0; //@line 7649
     $storemerge13 = $67; //@line 7649
     $w$0 = $92; //@line 7649
    }
    if (($w$0 | 0) < 0) {
     $fl$1 = $fl$062 | 8192; //@line 7655
     $fmt42 = $storemerge13; //@line 7655
     $l10n$3 = $l10n$2; //@line 7655
     $w$1 = 0 - $w$0 | 0; //@line 7655
    } else {
     $fl$1 = $fl$062; //@line 7657
     $fmt42 = $storemerge13; //@line 7657
     $l10n$3 = $l10n$2; //@line 7657
     $w$1 = $w$0; //@line 7657
    }
   } else {
    $isdigittmp1$i = ($66 << 24 >> 24) + -48 | 0; //@line 7661
    if ($isdigittmp1$i >>> 0 < 10) {
     $100 = $storemerge860; //@line 7664
     $i$03$i = 0; //@line 7664
     $isdigittmp4$i = $isdigittmp1$i; //@line 7664
     while (1) {
      $98 = ($i$03$i * 10 | 0) + $isdigittmp4$i | 0; //@line 7667
      $99 = $100 + 1 | 0; //@line 7668
      $isdigittmp4$i = (HEAP8[$99 >> 0] | 0) + -48 | 0; //@line 7671
      if ($isdigittmp4$i >>> 0 >= 10) {
       $$lcssa = $98; //@line 7676
       $$lcssa318 = $99; //@line 7676
       break;
      } else {
       $100 = $99; //@line 7674
       $i$03$i = $98; //@line 7674
      }
     }
     if (($$lcssa | 0) < 0) {
      $$0 = -1; //@line 7682
      break L1;
     } else {
      $fl$1 = $fl$062; //@line 7685
      $fmt42 = $$lcssa318; //@line 7685
      $l10n$3 = $l10n$1; //@line 7685
      $w$1 = $$lcssa; //@line 7685
     }
    } else {
     $fl$1 = $fl$062; //@line 7688
     $fmt42 = $storemerge860; //@line 7688
     $l10n$3 = $l10n$1; //@line 7688
     $w$1 = 0; //@line 7688
    }
   }
  } while (0);
  L46 : do {
   if ((HEAP8[$fmt42 >> 0] | 0) == 46) {
    $106 = $fmt42 + 1 | 0; //@line 7696
    $107 = HEAP8[$106 >> 0] | 0; //@line 7697
    if ($107 << 24 >> 24 != 42) {
     $isdigittmp1$i22 = ($107 << 24 >> 24) + -48 | 0; //@line 7701
     if ($isdigittmp1$i22 >>> 0 < 10) {
      $139 = $106; //@line 7704
      $i$03$i25 = 0; //@line 7704
      $isdigittmp4$i24 = $isdigittmp1$i22; //@line 7704
     } else {
      $fmt45 = $106; //@line 7706
      $p$0 = 0; //@line 7706
      break;
     }
     while (1) {
      $137 = ($i$03$i25 * 10 | 0) + $isdigittmp4$i24 | 0; //@line 7711
      $138 = $139 + 1 | 0; //@line 7712
      $isdigittmp4$i24 = (HEAP8[$138 >> 0] | 0) + -48 | 0; //@line 7715
      if ($isdigittmp4$i24 >>> 0 >= 10) {
       $fmt45 = $138; //@line 7720
       $p$0 = $137; //@line 7720
       break L46;
      } else {
       $139 = $138; //@line 7718
       $i$03$i25 = $137; //@line 7718
      }
     }
    }
    $109 = $fmt42 + 2 | 0; //@line 7725
    $isdigittmp9 = (HEAP8[$109 >> 0] | 0) + -48 | 0; //@line 7728
    if ($isdigittmp9 >>> 0 < 10) {
     if ((HEAP8[$fmt42 + 3 >> 0] | 0) == 36) {
      HEAP32[$nl_type + ($isdigittmp9 << 2) >> 2] = 10; //@line 7736
      $fmt45 = $fmt42 + 4 | 0; //@line 7748
      $p$0 = HEAP32[$nl_arg + ((HEAP8[$109 >> 0] | 0) + -48 << 3) >> 2] | 0; //@line 7748
      break;
     }
    }
    if ($l10n$3) {
     $$0 = -1; //@line 7754
     break L1;
    }
    if ($0) {
     $133 = (HEAP32[$ap >> 2] | 0) + (4 - 1) & ~(4 - 1); //@line 7769
     $134 = HEAP32[$133 >> 2] | 0; //@line 7770
     HEAP32[$ap >> 2] = $133 + 4; //@line 7772
     $fmt45 = $109; //@line 7773
     $p$0 = $134; //@line 7773
    } else {
     $fmt45 = $109; //@line 7775
     $p$0 = 0; //@line 7775
    }
   } else {
    $fmt45 = $fmt42; //@line 7778
    $p$0 = -1; //@line 7778
   }
  } while (0);
  $fmt44 = $fmt45; //@line 7781
  $st$0 = 0; //@line 7781
  while (1) {
   $144 = (HEAP8[$fmt44 >> 0] | 0) + -65 | 0; //@line 7785
   if ($144 >>> 0 > 57) {
    $$0 = -1; //@line 7788
    break L1;
   }
   $146 = $fmt44 + 1 | 0; //@line 7791
   $148 = HEAP8[5962 + ($st$0 * 58 | 0) + $144 >> 0] | 0; //@line 7793
   $149 = $148 & 255; //@line 7794
   if (($149 + -1 | 0) >>> 0 < 8) {
    $fmt44 = $146; //@line 7798
    $st$0 = $149; //@line 7798
   } else {
    $$lcssa323 = $146; //@line 7800
    $$lcssa324 = $148; //@line 7800
    $$lcssa325 = $149; //@line 7800
    $fmt44$lcssa321 = $fmt44; //@line 7800
    $st$0$lcssa322 = $st$0; //@line 7800
    break;
   }
  }
  if (!($$lcssa324 << 24 >> 24)) {
   $$0 = -1; //@line 7806
   break;
  }
  $154 = ($argpos$0 | 0) > -1; //@line 7810
  do {
   if ($$lcssa324 << 24 >> 24 == 19) {
    if ($154) {
     $$0 = -1; //@line 7814
     break L1;
    } else {
     label = 52; //@line 7817
    }
   } else {
    if ($154) {
     HEAP32[$nl_type + ($argpos$0 << 2) >> 2] = $$lcssa325; //@line 7822
     $157 = $nl_arg + ($argpos$0 << 3) | 0; //@line 7824
     $162 = HEAP32[$157 + 4 >> 2] | 0; //@line 7829
     $163 = $arg; //@line 7830
     HEAP32[$163 >> 2] = HEAP32[$157 >> 2]; //@line 7832
     HEAP32[$163 + 4 >> 2] = $162; //@line 7835
     label = 52; //@line 7836
     break;
    }
    if (!$0) {
     $$0 = 0; //@line 7840
     break L1;
    }
    _pop_arg($arg, $$lcssa325, $ap); //@line 7843
   }
  } while (0);
  if ((label | 0) == 52) {
   label = 0; //@line 7847
   if (!$0) {
    $cnt$0 = $cnt$1; //@line 7849
    $fmt41 = $$lcssa323; //@line 7849
    $l$0 = $34; //@line 7849
    $l10n$0 = $l10n$3; //@line 7849
    continue;
   }
  }
  $168 = HEAP8[$fmt44$lcssa321 >> 0] | 0; //@line 7854
  $t$0 = ($st$0$lcssa322 | 0) != 0 & ($168 & 15 | 0) == 3 ? $168 & -33 : $168; //@line 7860
  $175 = $fl$1 & -65537; //@line 7863
  $fl$1$ = ($fl$1 & 8192 | 0) == 0 ? $fl$1 : $175; //@line 7864
  L75 : do {
   switch ($t$0 | 0) {
   case 110:
    {
     switch ($st$0$lcssa322 | 0) {
     case 0:
      {
       HEAP32[HEAP32[$arg >> 2] >> 2] = $cnt$1; //@line 7871
       $cnt$0 = $cnt$1; //@line 7872
       $fmt41 = $$lcssa323; //@line 7872
       $l$0 = $34; //@line 7872
       $l10n$0 = $l10n$3; //@line 7872
       continue L1;
       break;
      }
     case 1:
      {
       HEAP32[HEAP32[$arg >> 2] >> 2] = $cnt$1; //@line 7878
       $cnt$0 = $cnt$1; //@line 7879
       $fmt41 = $$lcssa323; //@line 7879
       $l$0 = $34; //@line 7879
       $l10n$0 = $l10n$3; //@line 7879
       continue L1;
       break;
      }
     case 2:
      {
       $187 = HEAP32[$arg >> 2] | 0; //@line 7887
       HEAP32[$187 >> 2] = $cnt$1; //@line 7889
       HEAP32[$187 + 4 >> 2] = (($cnt$1 | 0) < 0) << 31 >> 31; //@line 7892
       $cnt$0 = $cnt$1; //@line 7893
       $fmt41 = $$lcssa323; //@line 7893
       $l$0 = $34; //@line 7893
       $l10n$0 = $l10n$3; //@line 7893
       continue L1;
       break;
      }
     case 3:
      {
       HEAP16[HEAP32[$arg >> 2] >> 1] = $cnt$1; //@line 7900
       $cnt$0 = $cnt$1; //@line 7901
       $fmt41 = $$lcssa323; //@line 7901
       $l$0 = $34; //@line 7901
       $l10n$0 = $l10n$3; //@line 7901
       continue L1;
       break;
      }
     case 4:
      {
       HEAP8[HEAP32[$arg >> 2] >> 0] = $cnt$1; //@line 7908
       $cnt$0 = $cnt$1; //@line 7909
       $fmt41 = $$lcssa323; //@line 7909
       $l$0 = $34; //@line 7909
       $l10n$0 = $l10n$3; //@line 7909
       continue L1;
       break;
      }
     case 6:
      {
       HEAP32[HEAP32[$arg >> 2] >> 2] = $cnt$1; //@line 7915
       $cnt$0 = $cnt$1; //@line 7916
       $fmt41 = $$lcssa323; //@line 7916
       $l$0 = $34; //@line 7916
       $l10n$0 = $l10n$3; //@line 7916
       continue L1;
       break;
      }
     case 7:
      {
       $199 = HEAP32[$arg >> 2] | 0; //@line 7924
       HEAP32[$199 >> 2] = $cnt$1; //@line 7926
       HEAP32[$199 + 4 >> 2] = (($cnt$1 | 0) < 0) << 31 >> 31; //@line 7929
       $cnt$0 = $cnt$1; //@line 7930
       $fmt41 = $$lcssa323; //@line 7930
       $l$0 = $34; //@line 7930
       $l10n$0 = $l10n$3; //@line 7930
       continue L1;
       break;
      }
     default:
      {
       $cnt$0 = $cnt$1; //@line 7935
       $fmt41 = $$lcssa323; //@line 7935
       $l$0 = $34; //@line 7935
       $l10n$0 = $l10n$3; //@line 7935
       continue L1;
      }
     }
     break;
    }
   case 112:
    {
     $fl$3 = $fl$1$ | 8; //@line 7945
     $p$1 = $p$0 >>> 0 > 8 ? $p$0 : 8; //@line 7945
     $t$1 = 120; //@line 7945
     label = 64; //@line 7946
     break;
    }
   case 88:
   case 120:
    {
     $fl$3 = $fl$1$; //@line 7950
     $p$1 = $p$0; //@line 7950
     $t$1 = $t$0; //@line 7950
     label = 64; //@line 7951
     break;
    }
   case 111:
    {
     $243 = $arg; //@line 7955
     $245 = HEAP32[$243 >> 2] | 0; //@line 7957
     $248 = HEAP32[$243 + 4 >> 2] | 0; //@line 7960
     if (($245 | 0) == 0 & ($248 | 0) == 0) {
      $$0$lcssa$i = $1; //@line 7965
     } else {
      $$03$i33 = $1; //@line 7967
      $253 = $245; //@line 7967
      $257 = $248; //@line 7967
      while (1) {
       $256 = $$03$i33 + -1 | 0; //@line 7972
       HEAP8[$256 >> 0] = $253 & 7 | 48; //@line 7973
       $253 = _bitshift64Lshr($253 | 0, $257 | 0, 3) | 0; //@line 7974
       $257 = tempRet0; //@line 7975
       if (($253 | 0) == 0 & ($257 | 0) == 0) {
        $$0$lcssa$i = $256; //@line 7980
        break;
       } else {
        $$03$i33 = $256; //@line 7983
       }
      }
     }
     if (!($fl$1$ & 8)) {
      $a$0 = $$0$lcssa$i; //@line 7990
      $fl$4 = $fl$1$; //@line 7990
      $p$2 = $p$0; //@line 7990
      $pl$1 = 0; //@line 7990
      $prefix$1 = 6442; //@line 7990
      label = 77; //@line 7991
     } else {
      $267 = $2 - $$0$lcssa$i + 1 | 0; //@line 7995
      $a$0 = $$0$lcssa$i; //@line 7998
      $fl$4 = $fl$1$; //@line 7998
      $p$2 = ($p$0 | 0) < ($267 | 0) ? $267 : $p$0; //@line 7998
      $pl$1 = 0; //@line 7998
      $prefix$1 = 6442; //@line 7998
      label = 77; //@line 7999
     }
     break;
    }
   case 105:
   case 100:
    {
     $269 = $arg; //@line 8004
     $271 = HEAP32[$269 >> 2] | 0; //@line 8006
     $274 = HEAP32[$269 + 4 >> 2] | 0; //@line 8009
     if (($274 | 0) < 0) {
      $276 = _i64Subtract(0, 0, $271 | 0, $274 | 0) | 0; //@line 8012
      $277 = tempRet0; //@line 8013
      $278 = $arg; //@line 8014
      HEAP32[$278 >> 2] = $276; //@line 8016
      HEAP32[$278 + 4 >> 2] = $277; //@line 8019
      $286 = $276; //@line 8020
      $287 = $277; //@line 8020
      $pl$0 = 1; //@line 8020
      $prefix$0 = 6442; //@line 8020
      label = 76; //@line 8021
      break L75;
     }
     if (!($fl$1$ & 2048)) {
      $284 = $fl$1$ & 1; //@line 8027
      $286 = $271; //@line 8030
      $287 = $274; //@line 8030
      $pl$0 = $284; //@line 8030
      $prefix$0 = ($284 | 0) == 0 ? 6442 : 6444; //@line 8030
      label = 76; //@line 8031
     } else {
      $286 = $271; //@line 8033
      $287 = $274; //@line 8033
      $pl$0 = 1; //@line 8033
      $prefix$0 = 6443; //@line 8033
      label = 76; //@line 8034
     }
     break;
    }
   case 117:
    {
     $176 = $arg; //@line 8039
     $286 = HEAP32[$176 >> 2] | 0; //@line 8045
     $287 = HEAP32[$176 + 4 >> 2] | 0; //@line 8045
     $pl$0 = 0; //@line 8045
     $prefix$0 = 6442; //@line 8045
     label = 76; //@line 8046
     break;
    }
   case 99:
    {
     HEAP8[$3 >> 0] = HEAP32[$arg >> 2]; //@line 8057
     $a$2 = $3; //@line 8058
     $fl$6 = $175; //@line 8058
     $p$5 = 1; //@line 8058
     $pl$2 = 0; //@line 8058
     $prefix$2 = 6442; //@line 8058
     $z$2 = $1; //@line 8058
     break;
    }
   case 109:
    {
     $a$1 = _strerror(HEAP32[(___errno_location() | 0) >> 2] | 0) | 0; //@line 8065
     label = 82; //@line 8066
     break;
    }
   case 115:
    {
     $317 = HEAP32[$arg >> 2] | 0; //@line 8070
     $a$1 = ($317 | 0) != 0 ? $317 : 6452; //@line 8073
     label = 82; //@line 8074
     break;
    }
   case 67:
    {
     HEAP32[$wc >> 2] = HEAP32[$arg >> 2]; //@line 8084
     HEAP32[$4 >> 2] = 0; //@line 8085
     HEAP32[$arg >> 2] = $wc; //@line 8086
     $p$4198 = -1; //@line 8087
     label = 86; //@line 8088
     break;
    }
   case 83:
    {
     if (!$p$0) {
      _pad($f, 32, $w$1, 0, $fl$1$); //@line 8094
      $i$0$lcssa200 = 0; //@line 8095
      label = 98; //@line 8096
     } else {
      $p$4198 = $p$0; //@line 8098
      label = 86; //@line 8099
     }
     break;
    }
   case 65:
   case 71:
   case 70:
   case 69:
   case 97:
   case 103:
   case 102:
   case 101:
    {
     $359 = +HEAPF64[$arg >> 3]; //@line 8104
     HEAP32[$e2$i >> 2] = 0; //@line 8105
     HEAPF64[tempDoublePtr >> 3] = $359; //@line 8106
     if ((HEAP32[tempDoublePtr + 4 >> 2] | 0) < 0) {
      $$07$i = -$359; //@line 8111
      $pl$0$i = 1; //@line 8111
      $prefix$0$i = 6459; //@line 8111
     } else {
      if (!($fl$1$ & 2048)) {
       $366 = $fl$1$ & 1; //@line 8116
       $$07$i = $359; //@line 8119
       $pl$0$i = $366; //@line 8119
       $prefix$0$i = ($366 | 0) == 0 ? 6460 : 6465; //@line 8119
      } else {
       $$07$i = $359; //@line 8121
       $pl$0$i = 1; //@line 8121
       $prefix$0$i = 6462; //@line 8121
      }
     }
     HEAPF64[tempDoublePtr >> 3] = $$07$i; //@line 8124
     $370 = HEAP32[tempDoublePtr + 4 >> 2] & 2146435072; //@line 8126
     do {
      if ($370 >>> 0 < 2146435072 | ($370 | 0) == 2146435072 & 0 < 0) {
       $392 = +_frexpl($$07$i, $e2$i) * 2.0; //@line 8135
       $393 = $392 != 0.0; //@line 8136
       if ($393) {
        HEAP32[$e2$i >> 2] = (HEAP32[$e2$i >> 2] | 0) + -1; //@line 8140
       }
       $396 = $t$0 | 32; //@line 8142
       if (($396 | 0) == 97) {
        $398 = $t$0 & 32; //@line 8145
        $prefix$0$$i = ($398 | 0) == 0 ? $prefix$0$i : $prefix$0$i + 9 | 0; //@line 8148
        $401 = $pl$0$i | 2; //@line 8149
        $403 = 12 - $p$0 | 0; //@line 8151
        do {
         if ($p$0 >>> 0 > 11 | ($403 | 0) == 0) {
          $$1$i = $392; //@line 8156
         } else {
          $re$169$i = $403; //@line 8158
          $round$068$i = 8.0; //@line 8158
          while (1) {
           $re$169$i = $re$169$i + -1 | 0; //@line 8160
           $407 = $round$068$i * 16.0; //@line 8161
           if (!$re$169$i) {
            $$lcssa342 = $407; //@line 8164
            break;
           } else {
            $round$068$i = $407; //@line 8167
           }
          }
          if ((HEAP8[$prefix$0$$i >> 0] | 0) == 45) {
           $$1$i = -($$lcssa342 + (-$392 - $$lcssa342)); //@line 8177
           break;
          } else {
           $$1$i = $392 + $$lcssa342 - $$lcssa342; //@line 8182
           break;
          }
         }
        } while (0);
        $417 = HEAP32[$e2$i >> 2] | 0; //@line 8187
        $420 = ($417 | 0) < 0 ? 0 - $417 | 0 : $417; //@line 8190
        $423 = _fmt_u($420, (($420 | 0) < 0) << 31 >> 31, $5) | 0; //@line 8193
        if (($423 | 0) == ($5 | 0)) {
         HEAP8[$6 >> 0] = 48; //@line 8196
         $estr$0$i = $6; //@line 8197
        } else {
         $estr$0$i = $423; //@line 8199
        }
        HEAP8[$estr$0$i + -1 >> 0] = ($417 >> 31 & 2) + 43; //@line 8206
        $432 = $estr$0$i + -2 | 0; //@line 8209
        HEAP8[$432 >> 0] = $t$0 + 15; //@line 8210
        $notrhs$i = ($p$0 | 0) < 1; //@line 8211
        $434 = ($fl$1$ & 8 | 0) == 0; //@line 8213
        $$2$i = $$1$i; //@line 8214
        $s$0$i = $buf$i; //@line 8214
        while (1) {
         $435 = ~~$$2$i; //@line 8216
         $441 = $s$0$i + 1 | 0; //@line 8222
         HEAP8[$s$0$i >> 0] = HEAPU8[6426 + $435 >> 0] | $398; //@line 8223
         $$2$i = ($$2$i - +($435 | 0)) * 16.0; //@line 8226
         do {
          if (($441 - $7 | 0) == 1) {
           if ($434 & ($notrhs$i & $$2$i == 0.0)) {
            $s$1$i = $441; //@line 8236
            break;
           }
           HEAP8[$441 >> 0] = 46; //@line 8240
           $s$1$i = $s$0$i + 2 | 0; //@line 8241
          } else {
           $s$1$i = $441; //@line 8243
          }
         } while (0);
         if (!($$2$i != 0.0)) {
          $s$1$i$lcssa = $s$1$i; //@line 8250
          break;
         } else {
          $s$0$i = $s$1$i; //@line 8248
         }
        }
        $$pre182$i = $s$1$i$lcssa; //@line 8255
        $l$0$i = ($p$0 | 0) != 0 & ($10 + $$pre182$i | 0) < ($p$0 | 0) ? $11 + $p$0 - $432 | 0 : $9 - $432 + $$pre182$i | 0; //@line 8265
        $459 = $l$0$i + $401 | 0; //@line 8266
        _pad($f, 32, $w$1, $459, $fl$1$); //@line 8267
        if (!(HEAP32[$f >> 2] & 32)) {
         ___fwritex($prefix$0$$i, $401, $f) | 0; //@line 8272
        }
        _pad($f, 48, $w$1, $459, $fl$1$ ^ 65536); //@line 8275
        $464 = $$pre182$i - $7 | 0; //@line 8276
        if (!(HEAP32[$f >> 2] & 32)) {
         ___fwritex($buf$i, $464, $f) | 0; //@line 8281
        }
        $469 = $8 - $432 | 0; //@line 8284
        _pad($f, 48, $l$0$i - ($464 + $469) | 0, 0, 0); //@line 8287
        if (!(HEAP32[$f >> 2] & 32)) {
         ___fwritex($432, $469, $f) | 0; //@line 8292
        }
        _pad($f, 32, $w$1, $459, $fl$1$ ^ 8192); //@line 8295
        $$0$i = ($459 | 0) < ($w$1 | 0) ? $w$1 : $459; //@line 8298
        break;
       }
       $$p$i = ($p$0 | 0) < 0 ? 6 : $p$0; //@line 8302
       if ($393) {
        $479 = (HEAP32[$e2$i >> 2] | 0) + -28 | 0; //@line 8306
        HEAP32[$e2$i >> 2] = $479; //@line 8307
        $$3$i = $392 * 268435456.0; //@line 8308
        $481 = $479; //@line 8308
       } else {
        $$3$i = $392; //@line 8311
        $481 = HEAP32[$e2$i >> 2] | 0; //@line 8311
       }
       $$31$i = ($481 | 0) < 0 ? $big$i : $12; //@line 8314
       $482 = $$31$i; //@line 8315
       $$4$i = $$3$i; //@line 8316
       $z$0$i = $$31$i; //@line 8316
       while (1) {
        $483 = ~~$$4$i >>> 0; //@line 8318
        HEAP32[$z$0$i >> 2] = $483; //@line 8319
        $484 = $z$0$i + 4 | 0; //@line 8320
        $$4$i = ($$4$i - +($483 >>> 0)) * 1.0e9; //@line 8323
        if (!($$4$i != 0.0)) {
         $$lcssa326 = $484; //@line 8328
         break;
        } else {
         $z$0$i = $484; //@line 8326
        }
       }
       $$pr$i = HEAP32[$e2$i >> 2] | 0; //@line 8332
       if (($$pr$i | 0) > 0) {
        $491 = $$pr$i; //@line 8335
        $a$1147$i = $$31$i; //@line 8335
        $z$1146$i = $$lcssa326; //@line 8335
        while (1) {
         $492 = ($491 | 0) > 29 ? 29 : $491; //@line 8338
         $d$0139$i = $z$1146$i + -4 | 0; //@line 8339
         do {
          if ($d$0139$i >>> 0 < $a$1147$i >>> 0) {
           $a$2$ph$i = $a$1147$i; //@line 8343
          } else {
           $carry$0140$i = 0; //@line 8345
           $d$0141$i = $d$0139$i; //@line 8345
           while (1) {
            $495 = _bitshift64Shl(HEAP32[$d$0141$i >> 2] | 0, 0, $492 | 0) | 0; //@line 8348
            $497 = _i64Add($495 | 0, tempRet0 | 0, $carry$0140$i | 0, 0) | 0; //@line 8350
            $498 = tempRet0; //@line 8351
            $499 = ___uremdi3($497 | 0, $498 | 0, 1e9, 0) | 0; //@line 8352
            HEAP32[$d$0141$i >> 2] = $499; //@line 8354
            $501 = ___udivdi3($497 | 0, $498 | 0, 1e9, 0) | 0; //@line 8355
            $d$0141$i = $d$0141$i + -4 | 0; //@line 8357
            if ($d$0141$i >>> 0 < $a$1147$i >>> 0) {
             $$lcssa327 = $501; //@line 8360
             break;
            } else {
             $carry$0140$i = $501; //@line 8363
            }
           }
           if (!$$lcssa327) {
            $a$2$ph$i = $a$1147$i; //@line 8368
            break;
           }
           $505 = $a$1147$i + -4 | 0; //@line 8371
           HEAP32[$505 >> 2] = $$lcssa327; //@line 8372
           $a$2$ph$i = $505; //@line 8373
          }
         } while (0);
         $z$2$i = $z$1146$i; //@line 8376
         while (1) {
          if ($z$2$i >>> 0 <= $a$2$ph$i >>> 0) {
           $z$2$i$lcssa = $z$2$i; //@line 8380
           break;
          }
          $507 = $z$2$i + -4 | 0; //@line 8383
          if (!(HEAP32[$507 >> 2] | 0)) {
           $z$2$i = $507; //@line 8387
          } else {
           $z$2$i$lcssa = $z$2$i; //@line 8389
           break;
          }
         }
         $511 = (HEAP32[$e2$i >> 2] | 0) - $492 | 0; //@line 8394
         HEAP32[$e2$i >> 2] = $511; //@line 8395
         if (($511 | 0) > 0) {
          $491 = $511; //@line 8398
          $a$1147$i = $a$2$ph$i; //@line 8398
          $z$1146$i = $z$2$i$lcssa; //@line 8398
         } else {
          $$pr47$i = $511; //@line 8400
          $a$1$lcssa$i = $a$2$ph$i; //@line 8400
          $z$1$lcssa$i = $z$2$i$lcssa; //@line 8400
          break;
         }
        }
       } else {
        $$pr47$i = $$pr$i; //@line 8405
        $a$1$lcssa$i = $$31$i; //@line 8405
        $z$1$lcssa$i = $$lcssa326; //@line 8405
       }
       if (($$pr47$i | 0) < 0) {
        $516 = (($$p$i + 25 | 0) / 9 | 0) + 1 | 0; //@line 8411
        $517 = ($396 | 0) == 102; //@line 8412
        $519 = $$pr47$i; //@line 8413
        $a$3134$i = $a$1$lcssa$i; //@line 8413
        $z$3133$i = $z$1$lcssa$i; //@line 8413
        while (1) {
         $518 = 0 - $519 | 0; //@line 8415
         $521 = ($518 | 0) > 9 ? 9 : $518; //@line 8417
         do {
          if ($a$3134$i >>> 0 < $z$3133$i >>> 0) {
           $527 = (1 << $521) + -1 | 0; //@line 8422
           $528 = 1e9 >>> $521; //@line 8423
           $carry3$0128$i = 0; //@line 8424
           $d$1127$i = $a$3134$i; //@line 8424
           while (1) {
            $529 = HEAP32[$d$1127$i >> 2] | 0; //@line 8426
            HEAP32[$d$1127$i >> 2] = ($529 >>> $521) + $carry3$0128$i; //@line 8430
            $533 = Math_imul($529 & $527, $528) | 0; //@line 8431
            $d$1127$i = $d$1127$i + 4 | 0; //@line 8432
            if ($d$1127$i >>> 0 >= $z$3133$i >>> 0) {
             $$lcssa329 = $533; //@line 8437
             break;
            } else {
             $carry3$0128$i = $533; //@line 8435
            }
           }
           $$a$3$i = (HEAP32[$a$3134$i >> 2] | 0) == 0 ? $a$3134$i + 4 | 0 : $a$3134$i; //@line 8444
           if (!$$lcssa329) {
            $$a$3186$i = $$a$3$i; //@line 8447
            $z$4$i = $z$3133$i; //@line 8447
            break;
           }
           HEAP32[$z$3133$i >> 2] = $$lcssa329; //@line 8451
           $$a$3186$i = $$a$3$i; //@line 8452
           $z$4$i = $z$3133$i + 4 | 0; //@line 8452
          } else {
           $$a$3186$i = (HEAP32[$a$3134$i >> 2] | 0) == 0 ? $a$3134$i + 4 | 0 : $a$3134$i; //@line 8458
           $z$4$i = $z$3133$i; //@line 8458
          }
         } while (0);
         $541 = $517 ? $$31$i : $$a$3186$i; //@line 8461
         $$z$4$i = ($z$4$i - $541 >> 2 | 0) > ($516 | 0) ? $541 + ($516 << 2) | 0 : $z$4$i; //@line 8468
         $519 = (HEAP32[$e2$i >> 2] | 0) + $521 | 0; //@line 8470
         HEAP32[$e2$i >> 2] = $519; //@line 8471
         if (($519 | 0) >= 0) {
          $a$3$lcssa$i = $$a$3186$i; //@line 8476
          $z$3$lcssa$i = $$z$4$i; //@line 8476
          break;
         } else {
          $a$3134$i = $$a$3186$i; //@line 8474
          $z$3133$i = $$z$4$i; //@line 8474
         }
        }
       } else {
        $a$3$lcssa$i = $a$1$lcssa$i; //@line 8481
        $z$3$lcssa$i = $z$1$lcssa$i; //@line 8481
       }
       do {
        if ($a$3$lcssa$i >>> 0 < $z$3$lcssa$i >>> 0) {
         $555 = ($482 - $a$3$lcssa$i >> 2) * 9 | 0; //@line 8489
         $556 = HEAP32[$a$3$lcssa$i >> 2] | 0; //@line 8490
         if ($556 >>> 0 < 10) {
          $e$1$i = $555; //@line 8493
          break;
         } else {
          $e$0123$i = $555; //@line 8496
          $i$0122$i = 10; //@line 8496
         }
         while (1) {
          $i$0122$i = $i$0122$i * 10 | 0; //@line 8499
          $559 = $e$0123$i + 1 | 0; //@line 8500
          if ($556 >>> 0 < $i$0122$i >>> 0) {
           $e$1$i = $559; //@line 8503
           break;
          } else {
           $e$0123$i = $559; //@line 8506
          }
         }
        } else {
         $e$1$i = 0; //@line 8510
        }
       } while (0);
       $564 = ($396 | 0) == 103; //@line 8516
       $565 = ($$p$i | 0) != 0; //@line 8517
       $567 = $$p$i - (($396 | 0) != 102 ? $e$1$i : 0) + (($565 & $564) << 31 >> 31) | 0; //@line 8520
       if (($567 | 0) < ((($z$3$lcssa$i - $482 >> 2) * 9 | 0) + -9 | 0)) {
        $574 = $567 + 9216 | 0; //@line 8528
        $575 = ($574 | 0) / 9 | 0; //@line 8529
        $576 = $$31$i + ($575 + -1023 << 2) | 0; //@line 8531
        $j$0115$i = (($574 | 0) % 9 | 0) + 1 | 0; //@line 8533
        if (($j$0115$i | 0) < 9) {
         $i$1116$i = 10; //@line 8536
         $j$0117$i = $j$0115$i; //@line 8536
         while (1) {
          $579 = $i$1116$i * 10 | 0; //@line 8538
          $j$0117$i = $j$0117$i + 1 | 0; //@line 8539
          if (($j$0117$i | 0) == 9) {
           $i$1$lcssa$i = $579; //@line 8542
           break;
          } else {
           $i$1116$i = $579; //@line 8545
          }
         }
        } else {
         $i$1$lcssa$i = 10; //@line 8549
        }
        $580 = HEAP32[$576 >> 2] | 0; //@line 8551
        $581 = ($580 >>> 0) % ($i$1$lcssa$i >>> 0) | 0; //@line 8552
        if (!$581) {
         if (($$31$i + ($575 + -1022 << 2) | 0) == ($z$3$lcssa$i | 0)) {
          $a$7$i = $a$3$lcssa$i; //@line 8559
          $d$3$i = $576; //@line 8559
          $e$3$i = $e$1$i; //@line 8559
         } else {
          label = 163; //@line 8561
         }
        } else {
         label = 163; //@line 8564
        }
        do {
         if ((label | 0) == 163) {
          label = 0; //@line 8568
          $$20$i = ((($580 >>> 0) / ($i$1$lcssa$i >>> 0) | 0) & 1 | 0) == 0 ? 9007199254740992.0 : 9007199254740994.0; //@line 8572
          $588 = ($i$1$lcssa$i | 0) / 2 | 0; //@line 8573
          do {
           if ($581 >>> 0 < $588 >>> 0) {
            $small$0$i = .5; //@line 8577
           } else {
            if (($581 | 0) == ($588 | 0)) {
             if (($$31$i + ($575 + -1022 << 2) | 0) == ($z$3$lcssa$i | 0)) {
              $small$0$i = 1.0; //@line 8585
              break;
             }
            }
            $small$0$i = 1.5; //@line 8589
           }
          } while (0);
          do {
           if (!$pl$0$i) {
            $round6$1$i = $$20$i; //@line 8595
            $small$1$i = $small$0$i; //@line 8595
           } else {
            if ((HEAP8[$prefix$0$i >> 0] | 0) != 45) {
             $round6$1$i = $$20$i; //@line 8600
             $small$1$i = $small$0$i; //@line 8600
             break;
            }
            $round6$1$i = -$$20$i; //@line 8605
            $small$1$i = -$small$0$i; //@line 8605
           }
          } while (0);
          $598 = $580 - $581 | 0; //@line 8608
          HEAP32[$576 >> 2] = $598; //@line 8609
          if (!($round6$1$i + $small$1$i != $round6$1$i)) {
           $a$7$i = $a$3$lcssa$i; //@line 8613
           $d$3$i = $576; //@line 8613
           $e$3$i = $e$1$i; //@line 8613
           break;
          }
          $601 = $598 + $i$1$lcssa$i | 0; //@line 8616
          HEAP32[$576 >> 2] = $601; //@line 8617
          if ($601 >>> 0 > 999999999) {
           $a$5109$i = $a$3$lcssa$i; //@line 8620
           $d$2108$i = $576; //@line 8620
           while (1) {
            $603 = $d$2108$i + -4 | 0; //@line 8622
            HEAP32[$d$2108$i >> 2] = 0; //@line 8623
            if ($603 >>> 0 < $a$5109$i >>> 0) {
             $605 = $a$5109$i + -4 | 0; //@line 8626
             HEAP32[$605 >> 2] = 0; //@line 8627
             $a$6$i = $605; //@line 8628
            } else {
             $a$6$i = $a$5109$i; //@line 8630
            }
            $607 = (HEAP32[$603 >> 2] | 0) + 1 | 0; //@line 8633
            HEAP32[$603 >> 2] = $607; //@line 8634
            if ($607 >>> 0 > 999999999) {
             $a$5109$i = $a$6$i; //@line 8637
             $d$2108$i = $603; //@line 8637
            } else {
             $a$5$lcssa$i = $a$6$i; //@line 8639
             $d$2$lcssa$i = $603; //@line 8639
             break;
            }
           }
          } else {
           $a$5$lcssa$i = $a$3$lcssa$i; //@line 8644
           $d$2$lcssa$i = $576; //@line 8644
          }
          $612 = ($482 - $a$5$lcssa$i >> 2) * 9 | 0; //@line 8649
          $613 = HEAP32[$a$5$lcssa$i >> 2] | 0; //@line 8650
          if ($613 >>> 0 < 10) {
           $a$7$i = $a$5$lcssa$i; //@line 8653
           $d$3$i = $d$2$lcssa$i; //@line 8653
           $e$3$i = $612; //@line 8653
           break;
          } else {
           $e$2104$i = $612; //@line 8656
           $i$2103$i = 10; //@line 8656
          }
          while (1) {
           $i$2103$i = $i$2103$i * 10 | 0; //@line 8659
           $616 = $e$2104$i + 1 | 0; //@line 8660
           if ($613 >>> 0 < $i$2103$i >>> 0) {
            $a$7$i = $a$5$lcssa$i; //@line 8663
            $d$3$i = $d$2$lcssa$i; //@line 8663
            $e$3$i = $616; //@line 8663
            break;
           } else {
            $e$2104$i = $616; //@line 8666
           }
          }
         }
        } while (0);
        $618 = $d$3$i + 4 | 0; //@line 8671
        $a$8$ph$i = $a$7$i; //@line 8674
        $e$4$ph$i = $e$3$i; //@line 8674
        $z$6$ph$i = $z$3$lcssa$i >>> 0 > $618 >>> 0 ? $618 : $z$3$lcssa$i; //@line 8674
       } else {
        $a$8$ph$i = $a$3$lcssa$i; //@line 8676
        $e$4$ph$i = $e$1$i; //@line 8676
        $z$6$ph$i = $z$3$lcssa$i; //@line 8676
       }
       $620 = 0 - $e$4$ph$i | 0; //@line 8678
       $z$6$i = $z$6$ph$i; //@line 8679
       while (1) {
        if ($z$6$i >>> 0 <= $a$8$ph$i >>> 0) {
         $$lcssa159$i = 0; //@line 8683
         $z$6$i$lcssa = $z$6$i; //@line 8683
         break;
        }
        $622 = $z$6$i + -4 | 0; //@line 8686
        if (!(HEAP32[$622 >> 2] | 0)) {
         $z$6$i = $622; //@line 8690
        } else {
         $$lcssa159$i = 1; //@line 8692
         $z$6$i$lcssa = $z$6$i; //@line 8692
         break;
        }
       }
       do {
        if ($564) {
         $$p$$i = ($565 & 1 ^ 1) + $$p$i | 0; //@line 8700
         if (($$p$$i | 0) > ($e$4$ph$i | 0) & ($e$4$ph$i | 0) > -5) {
          $$013$i = $t$0 + -1 | 0; //@line 8708
          $$210$i = $$p$$i + -1 - $e$4$ph$i | 0; //@line 8708
         } else {
          $$013$i = $t$0 + -2 | 0; //@line 8712
          $$210$i = $$p$$i + -1 | 0; //@line 8712
         }
         $633 = $fl$1$ & 8; //@line 8714
         if ($633) {
          $$114$i = $$013$i; //@line 8717
          $$311$i = $$210$i; //@line 8717
          $$pre$phi184$iZ2D = $633; //@line 8717
          break;
         }
         do {
          if ($$lcssa159$i) {
           $636 = HEAP32[$z$6$i$lcssa + -4 >> 2] | 0; //@line 8723
           if (!$636) {
            $j$2$i = 9; //@line 8726
            break;
           }
           if (!(($636 >>> 0) % 10 | 0)) {
            $i$399$i = 10; //@line 8732
            $j$1100$i = 0; //@line 8732
           } else {
            $j$2$i = 0; //@line 8734
            break;
           }
           while (1) {
            $i$399$i = $i$399$i * 10 | 0; //@line 8738
            $641 = $j$1100$i + 1 | 0; //@line 8739
            if (($636 >>> 0) % ($i$399$i >>> 0) | 0) {
             $j$2$i = $641; //@line 8745
             break;
            } else {
             $j$1100$i = $641; //@line 8743
            }
           }
          } else {
           $j$2$i = 9; //@line 8750
          }
         } while (0);
         $650 = (($z$6$i$lcssa - $482 >> 2) * 9 | 0) + -9 | 0; //@line 8759
         if (($$013$i | 32 | 0) == 102) {
          $651 = $650 - $j$2$i | 0; //@line 8761
          $$21$i = ($651 | 0) < 0 ? 0 : $651; //@line 8763
          $$114$i = $$013$i; //@line 8766
          $$311$i = ($$210$i | 0) < ($$21$i | 0) ? $$210$i : $$21$i; //@line 8766
          $$pre$phi184$iZ2D = 0; //@line 8766
          break;
         } else {
          $655 = $650 + $e$4$ph$i - $j$2$i | 0; //@line 8770
          $$23$i = ($655 | 0) < 0 ? 0 : $655; //@line 8772
          $$114$i = $$013$i; //@line 8775
          $$311$i = ($$210$i | 0) < ($$23$i | 0) ? $$210$i : $$23$i; //@line 8775
          $$pre$phi184$iZ2D = 0; //@line 8775
          break;
         }
        } else {
         $$114$i = $t$0; //@line 8780
         $$311$i = $$p$i; //@line 8780
         $$pre$phi184$iZ2D = $fl$1$ & 8; //@line 8780
        }
       } while (0);
       $658 = $$311$i | $$pre$phi184$iZ2D; //@line 8783
       $660 = ($658 | 0) != 0 & 1; //@line 8785
       $662 = ($$114$i | 32 | 0) == 102; //@line 8787
       if ($662) {
        $$pn$i = ($e$4$ph$i | 0) > 0 ? $e$4$ph$i : 0; //@line 8791
        $estr$2$i = 0; //@line 8791
       } else {
        $666 = ($e$4$ph$i | 0) < 0 ? $620 : $e$4$ph$i; //@line 8794
        $669 = _fmt_u($666, (($666 | 0) < 0) << 31 >> 31, $5) | 0; //@line 8797
        if (($8 - $669 | 0) < 2) {
         $estr$193$i = $669; //@line 8802
         while (1) {
          $673 = $estr$193$i + -1 | 0; //@line 8804
          HEAP8[$673 >> 0] = 48; //@line 8805
          if (($8 - $673 | 0) < 2) {
           $estr$193$i = $673; //@line 8810
          } else {
           $estr$1$lcssa$i = $673; //@line 8812
           break;
          }
         }
        } else {
         $estr$1$lcssa$i = $669; //@line 8817
        }
        HEAP8[$estr$1$lcssa$i + -1 >> 0] = ($e$4$ph$i >> 31 & 2) + 43; //@line 8824
        $683 = $estr$1$lcssa$i + -2 | 0; //@line 8826
        HEAP8[$683 >> 0] = $$114$i; //@line 8827
        $$pn$i = $8 - $683 | 0; //@line 8830
        $estr$2$i = $683; //@line 8830
       }
       $688 = $pl$0$i + 1 + $$311$i + $660 + $$pn$i | 0; //@line 8835
       _pad($f, 32, $w$1, $688, $fl$1$); //@line 8836
       if (!(HEAP32[$f >> 2] & 32)) {
        ___fwritex($prefix$0$i, $pl$0$i, $f) | 0; //@line 8841
       }
       _pad($f, 48, $w$1, $688, $fl$1$ ^ 65536); //@line 8844
       do {
        if ($662) {
         $r$0$a$8$i = $a$8$ph$i >>> 0 > $$31$i >>> 0 ? $$31$i : $a$8$ph$i; //@line 8848
         $d$482$i = $r$0$a$8$i; //@line 8849
         while (1) {
          $695 = _fmt_u(HEAP32[$d$482$i >> 2] | 0, 0, $13) | 0; //@line 8852
          do {
           if (($d$482$i | 0) == ($r$0$a$8$i | 0)) {
            if (($695 | 0) != ($13 | 0)) {
             $s7$1$i = $695; //@line 8858
             break;
            }
            HEAP8[$15 >> 0] = 48; //@line 8861
            $s7$1$i = $15; //@line 8862
           } else {
            if ($695 >>> 0 > $buf$i >>> 0) {
             $s7$079$i = $695; //@line 8866
            } else {
             $s7$1$i = $695; //@line 8868
             break;
            }
            while (1) {
             $698 = $s7$079$i + -1 | 0; //@line 8872
             HEAP8[$698 >> 0] = 48; //@line 8873
             if ($698 >>> 0 > $buf$i >>> 0) {
              $s7$079$i = $698; //@line 8876
             } else {
              $s7$1$i = $698; //@line 8878
              break;
             }
            }
           }
          } while (0);
          if (!(HEAP32[$f >> 2] & 32)) {
           ___fwritex($s7$1$i, $14 - $s7$1$i | 0, $f) | 0; //@line 8890
          }
          $706 = $d$482$i + 4 | 0; //@line 8892
          if ($706 >>> 0 > $$31$i >>> 0) {
           $$lcssa339 = $706; //@line 8895
           break;
          } else {
           $d$482$i = $706; //@line 8898
          }
         }
         do {
          if ($658) {
           if (HEAP32[$f >> 2] & 32) {
            break;
           }
           ___fwritex(6494, 1, $f) | 0; //@line 8910
          }
         } while (0);
         if (($$311$i | 0) > 0 & $$lcssa339 >>> 0 < $z$6$i$lcssa >>> 0) {
          $$41276$i = $$311$i; //@line 8917
          $d$575$i = $$lcssa339; //@line 8917
          while (1) {
           $716 = _fmt_u(HEAP32[$d$575$i >> 2] | 0, 0, $13) | 0; //@line 8920
           if ($716 >>> 0 > $buf$i >>> 0) {
            $s8$070$i = $716; //@line 8923
            while (1) {
             $718 = $s8$070$i + -1 | 0; //@line 8925
             HEAP8[$718 >> 0] = 48; //@line 8926
             if ($718 >>> 0 > $buf$i >>> 0) {
              $s8$070$i = $718; //@line 8929
             } else {
              $s8$0$lcssa$i = $718; //@line 8931
              break;
             }
            }
           } else {
            $s8$0$lcssa$i = $716; //@line 8936
           }
           if (!(HEAP32[$f >> 2] & 32)) {
            ___fwritex($s8$0$lcssa$i, ($$41276$i | 0) > 9 ? 9 : $$41276$i, $f) | 0; //@line 8944
           }
           $d$575$i = $d$575$i + 4 | 0; //@line 8946
           $726 = $$41276$i + -9 | 0; //@line 8947
           if (!(($$41276$i | 0) > 9 & $d$575$i >>> 0 < $z$6$i$lcssa >>> 0)) {
            $$412$lcssa$i = $726; //@line 8954
            break;
           } else {
            $$41276$i = $726; //@line 8952
           }
          }
         } else {
          $$412$lcssa$i = $$311$i; //@line 8959
         }
         _pad($f, 48, $$412$lcssa$i + 9 | 0, 9, 0); //@line 8962
        } else {
         $z$6$$i = $$lcssa159$i ? $z$6$i$lcssa : $a$8$ph$i + 4 | 0; //@line 8965
         if (($$311$i | 0) > -1) {
          $733 = ($$pre$phi184$iZ2D | 0) == 0; //@line 8968
          $$587$i = $$311$i; //@line 8969
          $d$686$i = $a$8$ph$i; //@line 8969
          while (1) {
           $735 = _fmt_u(HEAP32[$d$686$i >> 2] | 0, 0, $13) | 0; //@line 8972
           if (($735 | 0) == ($13 | 0)) {
            HEAP8[$15 >> 0] = 48; //@line 8975
            $s9$0$i = $15; //@line 8976
           } else {
            $s9$0$i = $735; //@line 8978
           }
           do {
            if (($d$686$i | 0) == ($a$8$ph$i | 0)) {
             $741 = $s9$0$i + 1 | 0; //@line 8983
             if (!(HEAP32[$f >> 2] & 32)) {
              ___fwritex($s9$0$i, 1, $f) | 0; //@line 8988
             }
             if ($733 & ($$587$i | 0) < 1) {
              $s9$2$i = $741; //@line 8993
              break;
             }
             if (HEAP32[$f >> 2] & 32) {
              $s9$2$i = $741; //@line 9000
              break;
             }
             ___fwritex(6494, 1, $f) | 0; //@line 9003
             $s9$2$i = $741; //@line 9004
            } else {
             if ($s9$0$i >>> 0 > $buf$i >>> 0) {
              $s9$183$i = $s9$0$i; //@line 9008
             } else {
              $s9$2$i = $s9$0$i; //@line 9010
              break;
             }
             while (1) {
              $739 = $s9$183$i + -1 | 0; //@line 9014
              HEAP8[$739 >> 0] = 48; //@line 9015
              if ($739 >>> 0 > $buf$i >>> 0) {
               $s9$183$i = $739; //@line 9018
              } else {
               $s9$2$i = $739; //@line 9020
               break;
              }
             }
            }
           } while (0);
           $750 = $14 - $s9$2$i | 0; //@line 9027
           if (!(HEAP32[$f >> 2] & 32)) {
            ___fwritex($s9$2$i, ($$587$i | 0) > ($750 | 0) ? $750 : $$587$i, $f) | 0; //@line 9034
           }
           $756 = $$587$i - $750 | 0; //@line 9036
           $d$686$i = $d$686$i + 4 | 0; //@line 9037
           if (!($d$686$i >>> 0 < $z$6$$i >>> 0 & ($756 | 0) > -1)) {
            $$5$lcssa$i = $756; //@line 9044
            break;
           } else {
            $$587$i = $756; //@line 9042
           }
          }
         } else {
          $$5$lcssa$i = $$311$i; //@line 9049
         }
         _pad($f, 48, $$5$lcssa$i + 18 | 0, 18, 0); //@line 9052
         if (HEAP32[$f >> 2] & 32) {
          break;
         }
         ___fwritex($estr$2$i, $8 - $estr$2$i | 0, $f) | 0; //@line 9061
        }
       } while (0);
       _pad($f, 32, $w$1, $688, $fl$1$ ^ 8192); //@line 9065
       $$0$i = ($688 | 0) < ($w$1 | 0) ? $w$1 : $688; //@line 9068
      } else {
       $377 = ($t$0 & 32 | 0) != 0; //@line 9071
       $379 = $$07$i != $$07$i | 0.0 != 0.0; //@line 9073
       $pl$1$i = $379 ? 0 : $pl$0$i; //@line 9075
       $381 = $pl$1$i + 3 | 0; //@line 9077
       _pad($f, 32, $w$1, $381, $175); //@line 9078
       $382 = HEAP32[$f >> 2] | 0; //@line 9079
       if (!($382 & 32)) {
        ___fwritex($prefix$0$i, $pl$1$i, $f) | 0; //@line 9083
        $386 = HEAP32[$f >> 2] | 0; //@line 9085
       } else {
        $386 = $382; //@line 9087
       }
       if (!($386 & 32)) {
        ___fwritex($379 ? $377 ? 6486 : 6490 : $377 ? 6478 : 6482, 3, $f) | 0; //@line 9092
       }
       _pad($f, 32, $w$1, $381, $fl$1$ ^ 8192); //@line 9095
       $$0$i = ($381 | 0) < ($w$1 | 0) ? $w$1 : $381; //@line 9098
      }
     } while (0);
     $cnt$0 = $cnt$1; //@line 9101
     $fmt41 = $$lcssa323; //@line 9101
     $l$0 = $$0$i; //@line 9101
     $l10n$0 = $l10n$3; //@line 9101
     continue L1;
     break;
    }
   default:
    {
     $a$2 = $fmt41; //@line 9106
     $fl$6 = $fl$1$; //@line 9106
     $p$5 = $p$0; //@line 9106
     $pl$2 = 0; //@line 9106
     $prefix$2 = 6442; //@line 9106
     $z$2 = $1; //@line 9106
    }
   }
  } while (0);
  L313 : do {
   if ((label | 0) == 64) {
    label = 0; //@line 9112
    $206 = $arg; //@line 9113
    $208 = HEAP32[$206 >> 2] | 0; //@line 9115
    $211 = HEAP32[$206 + 4 >> 2] | 0; //@line 9118
    $212 = $t$1 & 32; //@line 9119
    if (($208 | 0) == 0 & ($211 | 0) == 0) {
     $a$0 = $1; //@line 9124
     $fl$4 = $fl$3; //@line 9124
     $p$2 = $p$1; //@line 9124
     $pl$1 = 0; //@line 9124
     $prefix$1 = 6442; //@line 9124
     label = 77; //@line 9125
    } else {
     $$012$i = $1; //@line 9127
     $217 = $208; //@line 9127
     $224 = $211; //@line 9127
     while (1) {
      $223 = $$012$i + -1 | 0; //@line 9135
      HEAP8[$223 >> 0] = HEAPU8[6426 + ($217 & 15) >> 0] | $212; //@line 9136
      $217 = _bitshift64Lshr($217 | 0, $224 | 0, 4) | 0; //@line 9137
      $224 = tempRet0; //@line 9138
      if (($217 | 0) == 0 & ($224 | 0) == 0) {
       $$lcssa344 = $223; //@line 9143
       break;
      } else {
       $$012$i = $223; //@line 9146
      }
     }
     $230 = $arg; //@line 9149
     if (($fl$3 & 8 | 0) == 0 | (HEAP32[$230 >> 2] | 0) == 0 & (HEAP32[$230 + 4 >> 2] | 0) == 0) {
      $a$0 = $$lcssa344; //@line 9162
      $fl$4 = $fl$3; //@line 9162
      $p$2 = $p$1; //@line 9162
      $pl$1 = 0; //@line 9162
      $prefix$1 = 6442; //@line 9162
      label = 77; //@line 9163
     } else {
      $a$0 = $$lcssa344; //@line 9167
      $fl$4 = $fl$3; //@line 9167
      $p$2 = $p$1; //@line 9167
      $pl$1 = 2; //@line 9167
      $prefix$1 = 6442 + ($t$1 >> 4) | 0; //@line 9167
      label = 77; //@line 9168
     }
    }
   } else if ((label | 0) == 76) {
    label = 0; //@line 9173
    $a$0 = _fmt_u($286, $287, $1) | 0; //@line 9175
    $fl$4 = $fl$1$; //@line 9175
    $p$2 = $p$0; //@line 9175
    $pl$1 = $pl$0; //@line 9175
    $prefix$1 = $prefix$0; //@line 9175
    label = 77; //@line 9176
   } else if ((label | 0) == 82) {
    label = 0; //@line 9179
    $320 = _memchr($a$1, 0, $p$0) | 0; //@line 9180
    $321 = ($320 | 0) == 0; //@line 9181
    $a$2 = $a$1; //@line 9188
    $fl$6 = $175; //@line 9188
    $p$5 = $321 ? $p$0 : $320 - $a$1 | 0; //@line 9188
    $pl$2 = 0; //@line 9188
    $prefix$2 = 6442; //@line 9188
    $z$2 = $321 ? $a$1 + $p$0 | 0 : $320; //@line 9188
   } else if ((label | 0) == 86) {
    label = 0; //@line 9191
    $i$0114 = 0; //@line 9193
    $l$1113 = 0; //@line 9193
    $ws$0115 = HEAP32[$arg >> 2] | 0; //@line 9193
    while (1) {
     $334 = HEAP32[$ws$0115 >> 2] | 0; //@line 9195
     if (!$334) {
      $i$0$lcssa = $i$0114; //@line 9198
      $l$2 = $l$1113; //@line 9198
      break;
     }
     $336 = _wctomb($mb, $334) | 0; //@line 9201
     if (($336 | 0) < 0 | $336 >>> 0 > ($p$4198 - $i$0114 | 0) >>> 0) {
      $i$0$lcssa = $i$0114; //@line 9207
      $l$2 = $336; //@line 9207
      break;
     }
     $341 = $336 + $i$0114 | 0; //@line 9211
     if ($p$4198 >>> 0 > $341 >>> 0) {
      $i$0114 = $341; //@line 9214
      $l$1113 = $336; //@line 9214
      $ws$0115 = $ws$0115 + 4 | 0; //@line 9214
     } else {
      $i$0$lcssa = $341; //@line 9216
      $l$2 = $336; //@line 9216
      break;
     }
    }
    if (($l$2 | 0) < 0) {
     $$0 = -1; //@line 9222
     break L1;
    }
    _pad($f, 32, $w$1, $i$0$lcssa, $fl$1$); //@line 9225
    if (!$i$0$lcssa) {
     $i$0$lcssa200 = 0; //@line 9228
     label = 98; //@line 9229
    } else {
     $i$1125 = 0; //@line 9232
     $ws$1126 = HEAP32[$arg >> 2] | 0; //@line 9232
     while (1) {
      $346 = HEAP32[$ws$1126 >> 2] | 0; //@line 9234
      if (!$346) {
       $i$0$lcssa200 = $i$0$lcssa; //@line 9237
       label = 98; //@line 9238
       break L313;
      }
      $349 = _wctomb($mb, $346) | 0; //@line 9242
      $i$1125 = $349 + $i$1125 | 0; //@line 9243
      if (($i$1125 | 0) > ($i$0$lcssa | 0)) {
       $i$0$lcssa200 = $i$0$lcssa; //@line 9246
       label = 98; //@line 9247
       break L313;
      }
      if (!(HEAP32[$f >> 2] & 32)) {
       ___fwritex($mb, $349, $f) | 0; //@line 9254
      }
      if ($i$1125 >>> 0 >= $i$0$lcssa >>> 0) {
       $i$0$lcssa200 = $i$0$lcssa; //@line 9260
       label = 98; //@line 9261
       break;
      } else {
       $ws$1126 = $ws$1126 + 4 | 0; //@line 9258
      }
     }
    }
   }
  } while (0);
  if ((label | 0) == 98) {
   label = 0; //@line 9269
   _pad($f, 32, $w$1, $i$0$lcssa200, $fl$1$ ^ 8192); //@line 9271
   $cnt$0 = $cnt$1; //@line 9274
   $fmt41 = $$lcssa323; //@line 9274
   $l$0 = ($w$1 | 0) > ($i$0$lcssa200 | 0) ? $w$1 : $i$0$lcssa200; //@line 9274
   $l10n$0 = $l10n$3; //@line 9274
   continue;
  }
  if ((label | 0) == 77) {
   label = 0; //@line 9278
   $$fl$4 = ($p$2 | 0) > -1 ? $fl$4 & -65537 : $fl$4; //@line 9281
   $291 = $arg; //@line 9282
   $299 = (HEAP32[$291 >> 2] | 0) != 0 | (HEAP32[$291 + 4 >> 2] | 0) != 0; //@line 9290
   if (($p$2 | 0) != 0 | $299) {
    $305 = ($299 & 1 ^ 1) + ($2 - $a$0) | 0; //@line 9298
    $a$2 = $a$0; //@line 9301
    $fl$6 = $$fl$4; //@line 9301
    $p$5 = ($p$2 | 0) > ($305 | 0) ? $p$2 : $305; //@line 9301
    $pl$2 = $pl$1; //@line 9301
    $prefix$2 = $prefix$1; //@line 9301
    $z$2 = $1; //@line 9301
   } else {
    $a$2 = $1; //@line 9303
    $fl$6 = $$fl$4; //@line 9303
    $p$5 = 0; //@line 9303
    $pl$2 = $pl$1; //@line 9303
    $prefix$2 = $prefix$1; //@line 9303
    $z$2 = $1; //@line 9303
   }
  }
  $771 = $z$2 - $a$2 | 0; //@line 9308
  $$p$5 = ($p$5 | 0) < ($771 | 0) ? $771 : $p$5; //@line 9310
  $773 = $pl$2 + $$p$5 | 0; //@line 9311
  $w$2 = ($w$1 | 0) < ($773 | 0) ? $773 : $w$1; //@line 9313
  _pad($f, 32, $w$2, $773, $fl$6); //@line 9314
  if (!(HEAP32[$f >> 2] & 32)) {
   ___fwritex($prefix$2, $pl$2, $f) | 0; //@line 9319
  }
  _pad($f, 48, $w$2, $773, $fl$6 ^ 65536); //@line 9322
  _pad($f, 48, $$p$5, $771, 0); //@line 9323
  if (!(HEAP32[$f >> 2] & 32)) {
   ___fwritex($a$2, $771, $f) | 0; //@line 9328
  }
  _pad($f, 32, $w$2, $773, $fl$6 ^ 8192); //@line 9331
  $cnt$0 = $cnt$1; //@line 9332
  $fmt41 = $$lcssa323; //@line 9332
  $l$0 = $w$2; //@line 9332
  $l10n$0 = $l10n$3; //@line 9332
 }
 L348 : do {
  if ((label | 0) == 245) {
   if (!$f) {
    if (!$l10n$0$lcssa) {
     $$0 = 0; //@line 9340
    } else {
     $i$2100 = 1; //@line 9342
     while (1) {
      $786 = HEAP32[$nl_type + ($i$2100 << 2) >> 2] | 0; //@line 9345
      if (!$786) {
       $i$2100$lcssa = $i$2100; //@line 9348
       break;
      }
      _pop_arg($nl_arg + ($i$2100 << 3) | 0, $786, $ap); //@line 9352
      $i$2100 = $i$2100 + 1 | 0; //@line 9353
      if (($i$2100 | 0) >= 10) {
       $$0 = 1; //@line 9358
       break L348;
      }
     }
     if (($i$2100$lcssa | 0) < 10) {
      $i$398 = $i$2100$lcssa; //@line 9364
      while (1) {
       if (HEAP32[$nl_type + ($i$398 << 2) >> 2] | 0) {
        $$0 = -1; //@line 9371
        break L348;
       }
       $i$398 = $i$398 + 1 | 0; //@line 9369
       if (($i$398 | 0) >= 10) {
        $$0 = 1; //@line 9378
        break;
       }
      }
     } else {
      $$0 = 1; //@line 9383
     }
    }
   } else {
    $$0 = $cnt$1$lcssa; //@line 9387
   }
  }
 } while (0);
 STACKTOP = sp; //@line 9391
 return $$0 | 0; //@line 9391
}
function _vfscanf($f, $fmt, $ap) {
 $f = $f | 0;
 $fmt = $fmt | 0;
 $ap = $ap | 0;
 var $$ = 0, $$lcssa = 0, $$lcssa38 = 0, $$lcssa384 = 0, $$pre = 0, $$pre$phi182Z2D = 0, $$pre170 = 0, $$pre178 = 0, $$size$0 = 0, $0 = 0, $10 = 0, $104 = 0, $105 = 0, $107 = 0, $109 = 0, $11 = 0, $112 = 0, $115 = 0, $117 = 0, $12 = 0, $125 = 0, $129 = 0, $13 = 0, $136 = 0, $14 = 0, $141 = 0, $145 = 0, $15 = 0, $150 = 0, $151 = 0, $157 = 0, $160 = 0, $164 = 0, $166 = 0, $168 = 0, $17 = 0, $173 = 0, $176 = 0, $177 = 0, $178 = 0, $179 = 0, $181 = 0, $186 = 0, $190 = 0, $195 = 0, $196 = 0, $197 = 0, $199 = 0, $20 = 0, $201 = 0, $202 = 0, $210 = 0, $220 = 0, $222 = 0, $226 = 0, $228 = 0, $236 = 0, $244 = 0, $245 = 0, $248 = 0, $25 = 0, $250 = 0, $256 = 0, $263 = 0, $265 = 0, $271 = 0, $277 = 0, $281 = 0, $284 = 0, $291 = 0, $306 = 0, $310 = 0.0, $32 = 0, $334 = 0, $37 = 0, $41 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $51 = 0, $52 = 0, $62 = 0, $7 = 0, $8 = 0, $81 = 0, $82 = 0, $9 = 0, $90 = 0, $91 = 0, $92 = 0, $93 = 0, $96 = 0, $97 = 0, $98 = 0, $99 = 0, $alloc$0 = 0, $alloc$0400 = 0, $alloc$1 = 0, $alloc$2 = 0, $ap2$i = 0, $base$0 = 0, $c$0100 = 0, $dest$0 = 0, $i$0$i = 0, $i$0$ph = 0, $i$0$ph$phi = 0, $i$0$ph20 = 0, $i$0$ph20$lcssa = 0, $i$1 = 0, $i$2 = 0, $i$2$ph = 0, $i$2$ph$phi = 0, $i$3 = 0, $i$4 = 0, $invert$0 = 0, $isdigittmp = 0, $k$0$ph = 0, $k$1$ph = 0, $matches$0104 = 0, $matches$0104$lcssa = 0, $matches$0104376 = 0, $matches$1 = 0, $matches$2 = 0, $matches$3 = 0, $p$0109 = 0, $p$1 = 0, $p$1$lcssa = 0, $p$10 = 0, $p$11 = 0, $p$2 = 0, $p$3$lcssa = 0, $p$396 = 0, $p$4 = 0, $p$5 = 0, $p$6 = 0, $p$7 = 0, $p$7$ph = 0, $p$8 = 0, $p$9 = 0, $pos$0108 = 0, $pos$1 = 0, $pos$2 = 0, $s$0107 = 0, $s$0107$lcssa = 0, $s$1 = 0, $s$2$ph = 0, $s$3 = 0, $s$4 = 0, $s$5 = 0, $s$6 = 0, $s$7 = 0, $s$8 = 0, $scanset = 0, $size$0 = 0, $st = 0, $wc = 0, $wcs$0103 = 0, $wcs$0103$lcssa = 0, $wcs$1 = 0, $wcs$2 = 0, $wcs$3$ph = 0, $wcs$3$ph$lcssa = 0, $wcs$4 = 0, $wcs$5 = 0, $wcs$6 = 0, $wcs$7 = 0, $wcs$8 = 0, $wcs$9 = 0, $width$0$lcssa = 0, $width$097 = 0, $width$1 = 0, label = 0, sp = 0;
 sp = STACKTOP; //@line 5447
 STACKTOP = STACKTOP + 304 | 0; //@line 5448
 $ap2$i = sp + 16 | 0; //@line 5449
 $st = sp + 8 | 0; //@line 5450
 $scanset = sp + 33 | 0; //@line 5451
 $wc = sp; //@line 5452
 $0 = sp + 32 | 0; //@line 5453
 if ((HEAP32[$f + 76 >> 2] | 0) > -1) {
  $334 = ___lockfile($f) | 0; //@line 5459
 } else {
  $334 = 0; //@line 5461
 }
 $5 = HEAP8[$fmt >> 0] | 0; //@line 5463
 L4 : do {
  if (!($5 << 24 >> 24)) {
   $matches$3 = 0; //@line 5467
  } else {
   $7 = $f + 4 | 0; //@line 5469
   $8 = $f + 100 | 0; //@line 5470
   $9 = $f + 108 | 0; //@line 5471
   $10 = $f + 8 | 0; //@line 5472
   $11 = $scanset + 10 | 0; //@line 5473
   $12 = $scanset + 33 | 0; //@line 5474
   $13 = $st + 4 | 0; //@line 5475
   $14 = $scanset + 46 | 0; //@line 5476
   $15 = $scanset + 94 | 0; //@line 5477
   $17 = $5; //@line 5478
   $matches$0104 = 0; //@line 5478
   $p$0109 = $fmt; //@line 5478
   $pos$0108 = 0; //@line 5478
   $s$0107 = 0; //@line 5478
   $wcs$0103 = 0; //@line 5478
   L6 : while (1) {
    L8 : do {
     if (!(_isspace($17 & 255) | 0)) {
      $47 = (HEAP8[$p$0109 >> 0] | 0) == 37; //@line 5486
      L10 : do {
       if ($47) {
        $48 = $p$0109 + 1 | 0; //@line 5489
        $49 = HEAP8[$48 >> 0] | 0; //@line 5490
        L12 : do {
         switch ($49 << 24 >> 24) {
         case 37:
          {
           break L10;
           break;
          }
         case 42:
          {
           $dest$0 = 0; //@line 5499
           $p$2 = $p$0109 + 2 | 0; //@line 5499
           break;
          }
         default:
          {
           $isdigittmp = ($49 & 255) + -48 | 0; //@line 5504
           if ($isdigittmp >>> 0 < 10) {
            if ((HEAP8[$p$0109 + 2 >> 0] | 0) == 36) {
             HEAP32[$ap2$i >> 2] = HEAP32[$ap >> 2]; //@line 5512
             $i$0$i = $isdigittmp; //@line 5513
             while (1) {
              $81 = (HEAP32[$ap2$i >> 2] | 0) + (4 - 1) & ~(4 - 1); //@line 5527
              $82 = HEAP32[$81 >> 2] | 0; //@line 5528
              HEAP32[$ap2$i >> 2] = $81 + 4; //@line 5530
              if ($i$0$i >>> 0 > 1) {
               $i$0$i = $i$0$i + -1 | 0; //@line 5533
              } else {
               $$lcssa = $82; //@line 5535
               break;
              }
             }
             $dest$0 = $$lcssa; //@line 5540
             $p$2 = $p$0109 + 3 | 0; //@line 5540
             break L12;
            }
           }
           $90 = (HEAP32[$ap >> 2] | 0) + (4 - 1) & ~(4 - 1); //@line 5555
           $91 = HEAP32[$90 >> 2] | 0; //@line 5556
           HEAP32[$ap >> 2] = $90 + 4; //@line 5558
           $dest$0 = $91; //@line 5559
           $p$2 = $48; //@line 5559
          }
         }
        } while (0);
        $92 = HEAP8[$p$2 >> 0] | 0; //@line 5563
        $93 = $92 & 255; //@line 5564
        if (($93 + -48 | 0) >>> 0 < 10) {
         $97 = $93; //@line 5568
         $p$396 = $p$2; //@line 5568
         $width$097 = 0; //@line 5568
         while (1) {
          $96 = ($width$097 * 10 | 0) + -48 + $97 | 0; //@line 5572
          $98 = $p$396 + 1 | 0; //@line 5573
          $99 = HEAP8[$98 >> 0] | 0; //@line 5574
          $97 = $99 & 255; //@line 5575
          if (($97 + -48 | 0) >>> 0 >= 10) {
           $$lcssa38 = $99; //@line 5581
           $p$3$lcssa = $98; //@line 5581
           $width$0$lcssa = $96; //@line 5581
           break;
          } else {
           $p$396 = $98; //@line 5579
           $width$097 = $96; //@line 5579
          }
         }
        } else {
         $$lcssa38 = $92; //@line 5586
         $p$3$lcssa = $p$2; //@line 5586
         $width$0$lcssa = 0; //@line 5586
        }
        if ($$lcssa38 << 24 >> 24 == 109) {
         $104 = $p$3$lcssa + 1 | 0; //@line 5592
         $107 = HEAP8[$104 >> 0] | 0; //@line 5594
         $alloc$0 = ($dest$0 | 0) != 0 & 1; //@line 5594
         $p$4 = $104; //@line 5594
         $s$1 = 0; //@line 5594
         $wcs$1 = 0; //@line 5594
        } else {
         $107 = $$lcssa38; //@line 5596
         $alloc$0 = 0; //@line 5596
         $p$4 = $p$3$lcssa; //@line 5596
         $s$1 = $s$0107; //@line 5596
         $wcs$1 = $wcs$0103; //@line 5596
        }
        $105 = $p$4 + 1 | 0; //@line 5598
        switch ($107 & 255 | 0) {
        case 104:
         {
          $109 = (HEAP8[$105 >> 0] | 0) == 104; //@line 5603
          $p$5 = $109 ? $p$4 + 2 | 0 : $105; //@line 5607
          $size$0 = $109 ? -2 : -1; //@line 5607
          break;
         }
        case 108:
         {
          $112 = (HEAP8[$105 >> 0] | 0) == 108; //@line 5612
          $p$5 = $112 ? $p$4 + 2 | 0 : $105; //@line 5616
          $size$0 = $112 ? 3 : 1; //@line 5616
          break;
         }
        case 106:
         {
          $p$5 = $105; //@line 5620
          $size$0 = 3; //@line 5620
          break;
         }
        case 116:
        case 122:
         {
          $p$5 = $105; //@line 5624
          $size$0 = 1; //@line 5624
          break;
         }
        case 76:
         {
          $p$5 = $105; //@line 5628
          $size$0 = 2; //@line 5628
          break;
         }
        case 110:
        case 112:
        case 67:
        case 83:
        case 91:
        case 99:
        case 115:
        case 88:
        case 71:
        case 70:
        case 69:
        case 65:
        case 103:
        case 102:
        case 101:
        case 97:
        case 120:
        case 117:
        case 111:
        case 105:
        case 100:
         {
          $p$5 = $p$4; //@line 5632
          $size$0 = 0; //@line 5632
          break;
         }
        default:
         {
          $alloc$0400 = $alloc$0; //@line 5636
          $matches$0104376 = $matches$0104; //@line 5636
          $s$6 = $s$1; //@line 5636
          $wcs$7 = $wcs$1; //@line 5636
          label = 152; //@line 5637
          break L6;
         }
        }
        $115 = HEAPU8[$p$5 >> 0] | 0; //@line 5642
        $117 = ($115 & 47 | 0) == 3; //@line 5644
        $$ = $117 ? $115 | 32 : $115; //@line 5646
        $$size$0 = $117 ? 1 : $size$0; //@line 5647
        switch ($$ | 0) {
        case 99:
         {
          $pos$1 = $pos$0108; //@line 5652
          $width$1 = ($width$0$lcssa | 0) < 1 ? 1 : $width$0$lcssa; //@line 5652
          break;
         }
        case 91:
         {
          $pos$1 = $pos$0108; //@line 5656
          $width$1 = $width$0$lcssa; //@line 5656
          break;
         }
        case 110:
         {
          if (!$dest$0) {
           $matches$1 = $matches$0104; //@line 5664
           $p$11 = $p$5; //@line 5664
           $pos$2 = $pos$0108; //@line 5664
           $s$5 = $s$1; //@line 5664
           $wcs$6 = $wcs$1; //@line 5664
           break L8;
          }
          switch ($$size$0 | 0) {
          case -2:
           {
            HEAP8[$dest$0 >> 0] = $pos$0108; //@line 5670
            $matches$1 = $matches$0104; //@line 5671
            $p$11 = $p$5; //@line 5671
            $pos$2 = $pos$0108; //@line 5671
            $s$5 = $s$1; //@line 5671
            $wcs$6 = $wcs$1; //@line 5671
            break L8;
            break;
           }
          case -1:
           {
            HEAP16[$dest$0 >> 1] = $pos$0108; //@line 5677
            $matches$1 = $matches$0104; //@line 5678
            $p$11 = $p$5; //@line 5678
            $pos$2 = $pos$0108; //@line 5678
            $s$5 = $s$1; //@line 5678
            $wcs$6 = $wcs$1; //@line 5678
            break L8;
            break;
           }
          case 0:
           {
            HEAP32[$dest$0 >> 2] = $pos$0108; //@line 5683
            $matches$1 = $matches$0104; //@line 5684
            $p$11 = $p$5; //@line 5684
            $pos$2 = $pos$0108; //@line 5684
            $s$5 = $s$1; //@line 5684
            $wcs$6 = $wcs$1; //@line 5684
            break L8;
            break;
           }
          case 1:
           {
            HEAP32[$dest$0 >> 2] = $pos$0108; //@line 5689
            $matches$1 = $matches$0104; //@line 5690
            $p$11 = $p$5; //@line 5690
            $pos$2 = $pos$0108; //@line 5690
            $s$5 = $s$1; //@line 5690
            $wcs$6 = $wcs$1; //@line 5690
            break L8;
            break;
           }
          case 3:
           {
            $125 = $dest$0; //@line 5695
            HEAP32[$125 >> 2] = $pos$0108; //@line 5697
            HEAP32[$125 + 4 >> 2] = (($pos$0108 | 0) < 0) << 31 >> 31; //@line 5700
            $matches$1 = $matches$0104; //@line 5701
            $p$11 = $p$5; //@line 5701
            $pos$2 = $pos$0108; //@line 5701
            $s$5 = $s$1; //@line 5701
            $wcs$6 = $wcs$1; //@line 5701
            break L8;
            break;
           }
          default:
           {
            $matches$1 = $matches$0104; //@line 5706
            $p$11 = $p$5; //@line 5706
            $pos$2 = $pos$0108; //@line 5706
            $s$5 = $s$1; //@line 5706
            $wcs$6 = $wcs$1; //@line 5706
            break L8;
           }
          }
          break;
         }
        default:
         {
          ___shlim($f, 0); //@line 5713
          do {
           $129 = HEAP32[$7 >> 2] | 0; //@line 5715
           if ($129 >>> 0 < (HEAP32[$8 >> 2] | 0) >>> 0) {
            HEAP32[$7 >> 2] = $129 + 1; //@line 5720
            $136 = HEAPU8[$129 >> 0] | 0; //@line 5723
           } else {
            $136 = ___shgetc($f) | 0; //@line 5726
           }
          } while ((_isspace($136) | 0) != 0);
          $$pre170 = HEAP32[$7 >> 2] | 0; //@line 5736
          if (!(HEAP32[$8 >> 2] | 0)) {
           $145 = $$pre170; //@line 5738
          } else {
           $141 = $$pre170 + -1 | 0; //@line 5740
           HEAP32[$7 >> 2] = $141; //@line 5741
           $145 = $141; //@line 5742
          }
          $pos$1 = (HEAP32[$9 >> 2] | 0) + $pos$0108 + $145 - (HEAP32[$10 >> 2] | 0) | 0; //@line 5751
          $width$1 = $width$0$lcssa; //@line 5751
         }
        }
        ___shlim($f, $width$1); //@line 5754
        $150 = HEAP32[$7 >> 2] | 0; //@line 5755
        $151 = HEAP32[$8 >> 2] | 0; //@line 5756
        if ($150 >>> 0 < $151 >>> 0) {
         HEAP32[$7 >> 2] = $150 + 1; //@line 5760
         $157 = $151; //@line 5761
        } else {
         if ((___shgetc($f) | 0) < 0) {
          $alloc$0400 = $alloc$0; //@line 5766
          $matches$0104376 = $matches$0104; //@line 5766
          $s$6 = $s$1; //@line 5766
          $wcs$7 = $wcs$1; //@line 5766
          label = 152; //@line 5767
          break L6;
         }
         $157 = HEAP32[$8 >> 2] | 0; //@line 5771
        }
        if ($157) {
         HEAP32[$7 >> 2] = (HEAP32[$7 >> 2] | 0) + -1; //@line 5777
        }
        L67 : do {
         switch ($$ | 0) {
         case 91:
         case 99:
         case 115:
          {
           $160 = ($$ | 0) == 99; //@line 5782
           L69 : do {
            if (($$ & 239 | 0) == 99) {
             _memset($scanset | 0, -1, 257) | 0; //@line 5788
             HEAP8[$scanset >> 0] = 0; //@line 5789
             if (($$ | 0) == 115) {
              HEAP8[$12 >> 0] = 0; //@line 5791
              HEAP8[$11 >> 0] = 0; //@line 5792
              HEAP8[$11 + 1 >> 0] = 0; //@line 5792
              HEAP8[$11 + 2 >> 0] = 0; //@line 5792
              HEAP8[$11 + 3 >> 0] = 0; //@line 5792
              HEAP8[$11 + 4 >> 0] = 0; //@line 5792
              $p$9 = $p$5; //@line 5793
             } else {
              $p$9 = $p$5; //@line 5795
             }
            } else {
             $164 = $p$5 + 1 | 0; //@line 5798
             $166 = (HEAP8[$164 >> 0] | 0) == 94; //@line 5800
             $invert$0 = $166 & 1; //@line 5802
             $168 = $166 ? $164 : $p$5; //@line 5803
             $p$6 = $166 ? $p$5 + 2 | 0 : $164; //@line 5804
             _memset($scanset | 0, $166 & 1 | 0, 257) | 0; //@line 5806
             HEAP8[$scanset >> 0] = 0; //@line 5807
             switch (HEAP8[$p$6 >> 0] | 0) {
             case 45:
              {
               $173 = ($invert$0 ^ 1) & 255; //@line 5813
               HEAP8[$14 >> 0] = $173; //@line 5814
               $$pre$phi182Z2D = $173; //@line 5815
               $p$7$ph = $168 + 2 | 0; //@line 5815
               break;
              }
             case 93:
              {
               $176 = ($invert$0 ^ 1) & 255; //@line 5821
               HEAP8[$15 >> 0] = $176; //@line 5822
               $$pre$phi182Z2D = $176; //@line 5823
               $p$7$ph = $168 + 2 | 0; //@line 5823
               break;
              }
             default:
              {
               $$pre$phi182Z2D = ($invert$0 ^ 1) & 255; //@line 5829
               $p$7$ph = $p$6; //@line 5829
              }
             }
             $p$7 = $p$7$ph; //@line 5832
             while (1) {
              $177 = HEAP8[$p$7 >> 0] | 0; //@line 5834
              L80 : do {
               switch ($177 << 24 >> 24) {
               case 0:
                {
                 $alloc$0400 = $alloc$0; //@line 5838
                 $matches$0104376 = $matches$0104; //@line 5838
                 $s$6 = $s$1; //@line 5838
                 $wcs$7 = $wcs$1; //@line 5838
                 label = 152; //@line 5839
                 break L6;
                 break;
                }
               case 93:
                {
                 $p$9 = $p$7; //@line 5844
                 break L69;
                 break;
                }
               case 45:
                {
                 $178 = $p$7 + 1 | 0; //@line 5849
                 $179 = HEAP8[$178 >> 0] | 0; //@line 5850
                 switch ($179 << 24 >> 24) {
                 case 93:
                 case 0:
                  {
                   $190 = 45; //@line 5853
                   $p$8 = $p$7; //@line 5853
                   break L80;
                   break;
                  }
                 default:
                  {}
                 }
                 $181 = HEAP8[$p$7 + -1 >> 0] | 0; //@line 5861
                 if (($181 & 255) < ($179 & 255)) {
                  $c$0100 = $181 & 255; //@line 5865
                  do {
                   $c$0100 = $c$0100 + 1 | 0; //@line 5867
                   HEAP8[$scanset + $c$0100 >> 0] = $$pre$phi182Z2D; //@line 5869
                   $186 = HEAP8[$178 >> 0] | 0; //@line 5870
                  } while (($c$0100 | 0) < ($186 & 255 | 0));
                  $190 = $186; //@line 5876
                  $p$8 = $178; //@line 5876
                 } else {
                  $190 = $179; //@line 5881
                  $p$8 = $178; //@line 5881
                 }
                 break;
                }
               default:
                {
                 $190 = $177; //@line 5886
                 $p$8 = $p$7; //@line 5886
                }
               }
              } while (0);
              HEAP8[$scanset + (($190 & 255) + 1) >> 0] = $$pre$phi182Z2D; //@line 5893
              $p$7 = $p$8 + 1 | 0; //@line 5895
             }
            }
           } while (0);
           $195 = $160 ? $width$1 + 1 | 0 : 31; //@line 5900
           $196 = ($$size$0 | 0) == 1; //@line 5901
           $197 = ($alloc$0 | 0) != 0; //@line 5902
           L88 : do {
            if ($196) {
             if ($197) {
              $199 = _malloc($195 << 2) | 0; //@line 5907
              if (!$199) {
               $alloc$0400 = $alloc$0; //@line 5910
               $matches$0104376 = $matches$0104; //@line 5910
               $s$6 = 0; //@line 5910
               $wcs$7 = $199; //@line 5910
               label = 152; //@line 5911
               break L6;
              } else {
               $wcs$2 = $199; //@line 5914
              }
             } else {
              $wcs$2 = $dest$0; //@line 5917
             }
             HEAP32[$st >> 2] = 0; //@line 5919
             HEAP32[$13 >> 2] = 0; //@line 5920
             $i$0$ph = 0; //@line 5921
             $k$0$ph = $195; //@line 5921
             $wcs$3$ph = $wcs$2; //@line 5921
             L94 : while (1) {
              $201 = ($wcs$3$ph | 0) == 0; //@line 5923
              $i$0$ph20 = $i$0$ph; //@line 5924
              while (1) {
               L98 : while (1) {
                $202 = HEAP32[$7 >> 2] | 0; //@line 5927
                if ($202 >>> 0 < (HEAP32[$8 >> 2] | 0) >>> 0) {
                 HEAP32[$7 >> 2] = $202 + 1; //@line 5932
                 $210 = HEAPU8[$202 >> 0] | 0; //@line 5935
                } else {
                 $210 = ___shgetc($f) | 0; //@line 5938
                }
                if (!(HEAP8[$scanset + ($210 + 1) >> 0] | 0)) {
                 $i$0$ph20$lcssa = $i$0$ph20; //@line 5945
                 $wcs$3$ph$lcssa = $wcs$3$ph; //@line 5945
                 break L94;
                }
                HEAP8[$0 >> 0] = $210; //@line 5949
                switch (_mbrtowc($wc, $0, 1, $st) | 0) {
                case -1:
                 {
                  $alloc$0400 = $alloc$0; //@line 5953
                  $matches$0104376 = $matches$0104; //@line 5953
                  $s$6 = 0; //@line 5953
                  $wcs$7 = $wcs$3$ph; //@line 5953
                  label = 152; //@line 5954
                  break L6;
                  break;
                 }
                case -2:
                 {
                  break;
                 }
                default:
                 {
                  break L98;
                 }
                }
               }
               if ($201) {
                $i$1 = $i$0$ph20; //@line 5967
               } else {
                HEAP32[$wcs$3$ph + ($i$0$ph20 << 2) >> 2] = HEAP32[$wc >> 2]; //@line 5972
                $i$1 = $i$0$ph20 + 1 | 0; //@line 5973
               }
               if ($197 & ($i$1 | 0) == ($k$0$ph | 0)) {
                break;
               } else {
                $i$0$ph20 = $i$1; //@line 5980
               }
              }
              $220 = $k$0$ph << 1 | 1; //@line 5984
              $222 = _realloc($wcs$3$ph, $220 << 2) | 0; //@line 5986
              if (!$222) {
               $alloc$0400 = $alloc$0; //@line 5989
               $matches$0104376 = $matches$0104; //@line 5989
               $s$6 = 0; //@line 5989
               $wcs$7 = $wcs$3$ph; //@line 5989
               label = 152; //@line 5990
               break L6;
              }
              $i$0$ph$phi = $k$0$ph; //@line 5993
              $k$0$ph = $220; //@line 5993
              $wcs$3$ph = $222; //@line 5993
              $i$0$ph = $i$0$ph$phi; //@line 5993
             }
             if (!(_mbsinit($st) | 0)) {
              $alloc$0400 = $alloc$0; //@line 5998
              $matches$0104376 = $matches$0104; //@line 5998
              $s$6 = 0; //@line 5998
              $wcs$7 = $wcs$3$ph$lcssa; //@line 5998
              label = 152; //@line 5999
              break L6;
             } else {
              $i$4 = $i$0$ph20$lcssa; //@line 6002
              $s$3 = 0; //@line 6002
              $wcs$4 = $wcs$3$ph$lcssa; //@line 6002
             }
            } else {
             if ($197) {
              $226 = _malloc($195) | 0; //@line 6006
              if (!$226) {
               $alloc$0400 = $alloc$0; //@line 6009
               $matches$0104376 = $matches$0104; //@line 6009
               $s$6 = 0; //@line 6009
               $wcs$7 = 0; //@line 6009
               label = 152; //@line 6010
               break L6;
              } else {
               $i$2$ph = 0; //@line 6013
               $k$1$ph = $195; //@line 6013
               $s$2$ph = $226; //@line 6013
              }
              while (1) {
               $i$2 = $i$2$ph; //@line 6016
               do {
                $228 = HEAP32[$7 >> 2] | 0; //@line 6018
                if ($228 >>> 0 < (HEAP32[$8 >> 2] | 0) >>> 0) {
                 HEAP32[$7 >> 2] = $228 + 1; //@line 6023
                 $236 = HEAPU8[$228 >> 0] | 0; //@line 6026
                } else {
                 $236 = ___shgetc($f) | 0; //@line 6029
                }
                if (!(HEAP8[$scanset + ($236 + 1) >> 0] | 0)) {
                 $i$4 = $i$2; //@line 6036
                 $s$3 = $s$2$ph; //@line 6036
                 $wcs$4 = 0; //@line 6036
                 break L88;
                }
                HEAP8[$s$2$ph + $i$2 >> 0] = $236; //@line 6042
                $i$2 = $i$2 + 1 | 0; //@line 6040
               } while (($i$2 | 0) != ($k$1$ph | 0));
               $244 = $k$1$ph << 1 | 1; //@line 6051
               $245 = _realloc($s$2$ph, $244) | 0; //@line 6052
               if (!$245) {
                $alloc$0400 = $alloc$0; //@line 6055
                $matches$0104376 = $matches$0104; //@line 6055
                $s$6 = $s$2$ph; //@line 6055
                $wcs$7 = 0; //@line 6055
                label = 152; //@line 6056
                break L6;
               } else {
                $i$2$ph$phi = $k$1$ph; //@line 6059
                $k$1$ph = $244; //@line 6059
                $s$2$ph = $245; //@line 6059
                $i$2$ph = $i$2$ph$phi; //@line 6059
               }
              }
             }
             if (!$dest$0) {
              $265 = $157; //@line 6065
              while (1) {
               $263 = HEAP32[$7 >> 2] | 0; //@line 6067
               if ($263 >>> 0 < $265 >>> 0) {
                HEAP32[$7 >> 2] = $263 + 1; //@line 6071
                $271 = HEAPU8[$263 >> 0] | 0; //@line 6074
               } else {
                $271 = ___shgetc($f) | 0; //@line 6077
               }
               if (!(HEAP8[$scanset + ($271 + 1) >> 0] | 0)) {
                $i$4 = 0; //@line 6084
                $s$3 = 0; //@line 6084
                $wcs$4 = 0; //@line 6084
                break L88;
               }
               $265 = HEAP32[$8 >> 2] | 0; //@line 6088
              }
             } else {
              $250 = $157; //@line 6091
              $i$3 = 0; //@line 6091
              while (1) {
               $248 = HEAP32[$7 >> 2] | 0; //@line 6093
               if ($248 >>> 0 < $250 >>> 0) {
                HEAP32[$7 >> 2] = $248 + 1; //@line 6097
                $256 = HEAPU8[$248 >> 0] | 0; //@line 6100
               } else {
                $256 = ___shgetc($f) | 0; //@line 6103
               }
               if (!(HEAP8[$scanset + ($256 + 1) >> 0] | 0)) {
                $i$4 = $i$3; //@line 6110
                $s$3 = $dest$0; //@line 6110
                $wcs$4 = 0; //@line 6110
                break L88;
               }
               HEAP8[$dest$0 + $i$3 >> 0] = $256; //@line 6116
               $250 = HEAP32[$8 >> 2] | 0; //@line 6118
               $i$3 = $i$3 + 1 | 0; //@line 6118
              }
             }
            }
           } while (0);
           $$pre178 = HEAP32[$7 >> 2] | 0; //@line 6125
           if (!(HEAP32[$8 >> 2] | 0)) {
            $281 = $$pre178; //@line 6127
           } else {
            $277 = $$pre178 + -1 | 0; //@line 6129
            HEAP32[$7 >> 2] = $277; //@line 6130
            $281 = $277; //@line 6131
           }
           $284 = $281 - (HEAP32[$10 >> 2] | 0) + (HEAP32[$9 >> 2] | 0) | 0; //@line 6138
           if (!$284) {
            $alloc$2 = $alloc$0; //@line 6141
            $matches$2 = $matches$0104; //@line 6141
            $s$8 = $s$3; //@line 6141
            $wcs$9 = $wcs$4; //@line 6141
            break L6;
           }
           if (!(($284 | 0) == ($width$1 | 0) | $160 ^ 1)) {
            $alloc$2 = $alloc$0; //@line 6148
            $matches$2 = $matches$0104; //@line 6148
            $s$8 = $s$3; //@line 6148
            $wcs$9 = $wcs$4; //@line 6148
            break L6;
           }
           do {
            if ($197) {
             if ($196) {
              HEAP32[$dest$0 >> 2] = $wcs$4; //@line 6154
              break;
             } else {
              HEAP32[$dest$0 >> 2] = $s$3; //@line 6157
              break;
             }
            }
           } while (0);
           if ($160) {
            $p$10 = $p$9; //@line 6163
            $s$4 = $s$3; //@line 6163
            $wcs$5 = $wcs$4; //@line 6163
           } else {
            if ($wcs$4) {
             HEAP32[$wcs$4 + ($i$4 << 2) >> 2] = 0; //@line 6168
            }
            if (!$s$3) {
             $p$10 = $p$9; //@line 6172
             $s$4 = 0; //@line 6172
             $wcs$5 = $wcs$4; //@line 6172
             break L67;
            }
            HEAP8[$s$3 + $i$4 >> 0] = 0; //@line 6176
            $p$10 = $p$9; //@line 6177
            $s$4 = $s$3; //@line 6177
            $wcs$5 = $wcs$4; //@line 6177
           }
           break;
          }
         case 120:
         case 88:
         case 112:
          {
           $base$0 = 16; //@line 6182
           label = 134; //@line 6183
           break;
          }
         case 111:
          {
           $base$0 = 8; //@line 6187
           label = 134; //@line 6188
           break;
          }
         case 117:
         case 100:
          {
           $base$0 = 10; //@line 6192
           label = 134; //@line 6193
           break;
          }
         case 105:
          {
           $base$0 = 0; //@line 6197
           label = 134; //@line 6198
           break;
          }
         case 71:
         case 103:
         case 70:
         case 102:
         case 69:
         case 101:
         case 65:
         case 97:
          {
           $310 = +___floatscan($f, $$size$0, 0); //@line 6202
           if ((HEAP32[$9 >> 2] | 0) == ((HEAP32[$10 >> 2] | 0) - (HEAP32[$7 >> 2] | 0) | 0)) {
            $alloc$2 = $alloc$0; //@line 6211
            $matches$2 = $matches$0104; //@line 6211
            $s$8 = $s$1; //@line 6211
            $wcs$9 = $wcs$1; //@line 6211
            break L6;
           }
           if (!$dest$0) {
            $p$10 = $p$5; //@line 6216
            $s$4 = $s$1; //@line 6216
            $wcs$5 = $wcs$1; //@line 6216
           } else {
            switch ($$size$0 | 0) {
            case 0:
             {
              HEAPF32[$dest$0 >> 2] = $310; //@line 6221
              $p$10 = $p$5; //@line 6222
              $s$4 = $s$1; //@line 6222
              $wcs$5 = $wcs$1; //@line 6222
              break L67;
              break;
             }
            case 1:
             {
              HEAPF64[$dest$0 >> 3] = $310; //@line 6227
              $p$10 = $p$5; //@line 6228
              $s$4 = $s$1; //@line 6228
              $wcs$5 = $wcs$1; //@line 6228
              break L67;
              break;
             }
            case 2:
             {
              HEAPF64[$dest$0 >> 3] = $310; //@line 6233
              $p$10 = $p$5; //@line 6234
              $s$4 = $s$1; //@line 6234
              $wcs$5 = $wcs$1; //@line 6234
              break L67;
              break;
             }
            default:
             {
              $p$10 = $p$5; //@line 6239
              $s$4 = $s$1; //@line 6239
              $wcs$5 = $wcs$1; //@line 6239
              break L67;
             }
            }
           }
           break;
          }
         default:
          {
           $p$10 = $p$5; //@line 6247
           $s$4 = $s$1; //@line 6247
           $wcs$5 = $wcs$1; //@line 6247
          }
         }
        } while (0);
        L168 : do {
         if ((label | 0) == 134) {
          label = 0; //@line 6253
          $291 = ___intscan($f, $base$0, 0, -1, -1) | 0; //@line 6254
          if ((HEAP32[$9 >> 2] | 0) == ((HEAP32[$10 >> 2] | 0) - (HEAP32[$7 >> 2] | 0) | 0)) {
           $alloc$2 = $alloc$0; //@line 6264
           $matches$2 = $matches$0104; //@line 6264
           $s$8 = $s$1; //@line 6264
           $wcs$9 = $wcs$1; //@line 6264
           break L6;
          }
          if (($dest$0 | 0) != 0 & ($$ | 0) == 112) {
           HEAP32[$dest$0 >> 2] = $291; //@line 6272
           $p$10 = $p$5; //@line 6273
           $s$4 = $s$1; //@line 6273
           $wcs$5 = $wcs$1; //@line 6273
           break;
          }
          if (!$dest$0) {
           $p$10 = $p$5; //@line 6278
           $s$4 = $s$1; //@line 6278
           $wcs$5 = $wcs$1; //@line 6278
          } else {
           switch ($$size$0 | 0) {
           case -2:
            {
             HEAP8[$dest$0 >> 0] = $291; //@line 6283
             $p$10 = $p$5; //@line 6284
             $s$4 = $s$1; //@line 6284
             $wcs$5 = $wcs$1; //@line 6284
             break L168;
             break;
            }
           case -1:
            {
             HEAP16[$dest$0 >> 1] = $291; //@line 6290
             $p$10 = $p$5; //@line 6291
             $s$4 = $s$1; //@line 6291
             $wcs$5 = $wcs$1; //@line 6291
             break L168;
             break;
            }
           case 0:
            {
             HEAP32[$dest$0 >> 2] = $291; //@line 6296
             $p$10 = $p$5; //@line 6297
             $s$4 = $s$1; //@line 6297
             $wcs$5 = $wcs$1; //@line 6297
             break L168;
             break;
            }
           case 1:
            {
             HEAP32[$dest$0 >> 2] = $291; //@line 6302
             $p$10 = $p$5; //@line 6303
             $s$4 = $s$1; //@line 6303
             $wcs$5 = $wcs$1; //@line 6303
             break L168;
             break;
            }
           case 3:
            {
             $306 = $dest$0; //@line 6308
             HEAP32[$306 >> 2] = $291; //@line 6310
             HEAP32[$306 + 4 >> 2] = tempRet0; //@line 6313
             $p$10 = $p$5; //@line 6314
             $s$4 = $s$1; //@line 6314
             $wcs$5 = $wcs$1; //@line 6314
             break L168;
             break;
            }
           default:
            {
             $p$10 = $p$5; //@line 6319
             $s$4 = $s$1; //@line 6319
             $wcs$5 = $wcs$1; //@line 6319
             break L168;
            }
           }
          }
         }
        } while (0);
        $matches$1 = (($dest$0 | 0) != 0 & 1) + $matches$0104 | 0; //@line 6337
        $p$11 = $p$10; //@line 6337
        $pos$2 = (HEAP32[$9 >> 2] | 0) + $pos$1 + (HEAP32[$7 >> 2] | 0) - (HEAP32[$10 >> 2] | 0) | 0; //@line 6337
        $s$5 = $s$4; //@line 6337
        $wcs$6 = $wcs$5; //@line 6337
        break L8;
       }
      } while (0);
      $51 = $p$0109 + ($47 & 1) | 0; //@line 6342
      ___shlim($f, 0); //@line 6343
      $52 = HEAP32[$7 >> 2] | 0; //@line 6344
      if ($52 >>> 0 < (HEAP32[$8 >> 2] | 0) >>> 0) {
       HEAP32[$7 >> 2] = $52 + 1; //@line 6349
       $62 = HEAPU8[$52 >> 0] | 0; //@line 6352
      } else {
       $62 = ___shgetc($f) | 0; //@line 6355
      }
      if (($62 | 0) != (HEAPU8[$51 >> 0] | 0)) {
       $$lcssa384 = $62; //@line 6361
       $matches$0104$lcssa = $matches$0104; //@line 6361
       $s$0107$lcssa = $s$0107; //@line 6361
       $wcs$0103$lcssa = $wcs$0103; //@line 6361
       label = 21; //@line 6362
       break L6;
      }
      $matches$1 = $matches$0104; //@line 6366
      $p$11 = $51; //@line 6366
      $pos$2 = $pos$0108 + 1 | 0; //@line 6366
      $s$5 = $s$0107; //@line 6366
      $wcs$6 = $wcs$0103; //@line 6366
     } else {
      $p$1 = $p$0109; //@line 6368
      while (1) {
       $20 = $p$1 + 1 | 0; //@line 6370
       if (!(_isspace(HEAPU8[$20 >> 0] | 0) | 0)) {
        $p$1$lcssa = $p$1; //@line 6376
        break;
       } else {
        $p$1 = $20; //@line 6379
       }
      }
      ___shlim($f, 0); //@line 6382
      do {
       $25 = HEAP32[$7 >> 2] | 0; //@line 6384
       if ($25 >>> 0 < (HEAP32[$8 >> 2] | 0) >>> 0) {
        HEAP32[$7 >> 2] = $25 + 1; //@line 6389
        $32 = HEAPU8[$25 >> 0] | 0; //@line 6392
       } else {
        $32 = ___shgetc($f) | 0; //@line 6395
       }
      } while ((_isspace($32) | 0) != 0);
      $$pre = HEAP32[$7 >> 2] | 0; //@line 6405
      if (!(HEAP32[$8 >> 2] | 0)) {
       $41 = $$pre; //@line 6407
      } else {
       $37 = $$pre + -1 | 0; //@line 6409
       HEAP32[$7 >> 2] = $37; //@line 6410
       $41 = $37; //@line 6411
      }
      $matches$1 = $matches$0104; //@line 6420
      $p$11 = $p$1$lcssa; //@line 6420
      $pos$2 = (HEAP32[$9 >> 2] | 0) + $pos$0108 + $41 - (HEAP32[$10 >> 2] | 0) | 0; //@line 6420
      $s$5 = $s$0107; //@line 6420
      $wcs$6 = $wcs$0103; //@line 6420
     }
    } while (0);
    $p$0109 = $p$11 + 1 | 0; //@line 6423
    $17 = HEAP8[$p$0109 >> 0] | 0; //@line 6424
    if (!($17 << 24 >> 24)) {
     $matches$3 = $matches$1; //@line 6427
     break L4;
    } else {
     $matches$0104 = $matches$1; //@line 6430
     $pos$0108 = $pos$2; //@line 6430
     $s$0107 = $s$5; //@line 6430
     $wcs$0103 = $wcs$6; //@line 6430
    }
   }
   if ((label | 0) == 21) {
    if (HEAP32[$8 >> 2] | 0) {
     HEAP32[$7 >> 2] = (HEAP32[$7 >> 2] | 0) + -1; //@line 6439
    }
    if (($matches$0104$lcssa | 0) != 0 | ($$lcssa384 | 0) > -1) {
     $matches$3 = $matches$0104$lcssa; //@line 6445
     break;
    } else {
     $alloc$1 = 0; //@line 6448
     $s$7 = $s$0107$lcssa; //@line 6448
     $wcs$8 = $wcs$0103$lcssa; //@line 6448
     label = 153; //@line 6449
    }
   } else if ((label | 0) == 152) {
    if (!$matches$0104376) {
     $alloc$1 = $alloc$0400; //@line 6455
     $s$7 = $s$6; //@line 6455
     $wcs$8 = $wcs$7; //@line 6455
     label = 153; //@line 6456
    } else {
     $alloc$2 = $alloc$0400; //@line 6458
     $matches$2 = $matches$0104376; //@line 6458
     $s$8 = $s$6; //@line 6458
     $wcs$9 = $wcs$7; //@line 6458
    }
   }
   if ((label | 0) == 153) {
    $alloc$2 = $alloc$1; //@line 6462
    $matches$2 = -1; //@line 6462
    $s$8 = $s$7; //@line 6462
    $wcs$9 = $wcs$8; //@line 6462
   }
   if (!$alloc$2) {
    $matches$3 = $matches$2; //@line 6466
   } else {
    _free($s$8); //@line 6468
    _free($wcs$9); //@line 6469
    $matches$3 = $matches$2; //@line 6470
   }
  }
 } while (0);
 if ($334) {
  ___unlockfile($f); //@line 6476
 }
 STACKTOP = sp; //@line 6478
 return $matches$3 | 0; //@line 6478
}
function _free($mem) {
 $mem = $mem | 0;
 var $$lcssa = 0, $$pre$phi59Z2D = 0, $$pre$phi61Z2D = 0, $$pre$phiZ2D = 0, $$sum2 = 0, $1 = 0, $103 = 0, $104 = 0, $111 = 0, $112 = 0, $12 = 0, $120 = 0, $128 = 0, $133 = 0, $134 = 0, $137 = 0, $139 = 0, $14 = 0, $141 = 0, $15 = 0, $156 = 0, $161 = 0, $163 = 0, $166 = 0, $169 = 0, $172 = 0, $175 = 0, $176 = 0, $178 = 0, $179 = 0, $181 = 0, $182 = 0, $184 = 0, $185 = 0, $19 = 0, $191 = 0, $192 = 0, $2 = 0, $201 = 0, $206 = 0, $210 = 0, $216 = 0, $22 = 0, $231 = 0, $233 = 0, $234 = 0, $235 = 0, $236 = 0, $24 = 0, $240 = 0, $241 = 0, $247 = 0, $252 = 0, $253 = 0, $256 = 0, $258 = 0, $26 = 0, $261 = 0, $266 = 0, $272 = 0, $276 = 0, $277 = 0, $284 = 0, $296 = 0, $301 = 0, $308 = 0, $309 = 0, $310 = 0, $318 = 0, $39 = 0, $44 = 0, $46 = 0, $49 = 0, $5 = 0, $51 = 0, $54 = 0, $57 = 0, $58 = 0, $6 = 0, $60 = 0, $61 = 0, $63 = 0, $64 = 0, $66 = 0, $67 = 0, $72 = 0, $73 = 0, $8 = 0, $82 = 0, $87 = 0, $9 = 0, $91 = 0, $97 = 0, $F16$0 = 0, $I18$0 = 0, $K19$052 = 0, $R$0 = 0, $R$0$lcssa = 0, $R$1 = 0, $R7$0 = 0, $R7$0$lcssa = 0, $R7$1 = 0, $RP$0 = 0, $RP$0$lcssa = 0, $RP9$0 = 0, $RP9$0$lcssa = 0, $T$0$lcssa = 0, $T$051 = 0, $T$051$lcssa = 0, $p$0 = 0, $psize$0 = 0, $psize$1 = 0, $sp$0$i = 0, $sp$0$in$i = 0;
 if (!$mem) {
  return;
 }
 $1 = $mem + -8 | 0; //@line 12272
 $2 = HEAP32[195] | 0; //@line 12273
 if ($1 >>> 0 < $2 >>> 0) {
  _abort(); //@line 12276
 }
 $5 = HEAP32[$mem + -4 >> 2] | 0; //@line 12280
 $6 = $5 & 3; //@line 12281
 if (($6 | 0) == 1) {
  _abort(); //@line 12284
 }
 $8 = $5 & -8; //@line 12287
 $9 = $mem + ($8 + -8) | 0; //@line 12289
 do {
  if (!($5 & 1)) {
   $12 = HEAP32[$1 >> 2] | 0; //@line 12294
   if (!$6) {
    return;
   }
   $$sum2 = -8 - $12 | 0; //@line 12299
   $14 = $mem + $$sum2 | 0; //@line 12300
   $15 = $12 + $8 | 0; //@line 12301
   if ($14 >>> 0 < $2 >>> 0) {
    _abort(); //@line 12304
   }
   if (($14 | 0) == (HEAP32[196] | 0)) {
    $103 = $mem + ($8 + -4) | 0; //@line 12311
    $104 = HEAP32[$103 >> 2] | 0; //@line 12312
    if (($104 & 3 | 0) != 3) {
     $p$0 = $14; //@line 12316
     $psize$0 = $15; //@line 12316
     break;
    }
    HEAP32[193] = $15; //@line 12319
    HEAP32[$103 >> 2] = $104 & -2; //@line 12321
    HEAP32[$mem + ($$sum2 + 4) >> 2] = $15 | 1; //@line 12325
    HEAP32[$9 >> 2] = $15; //@line 12326
    return;
   }
   $19 = $12 >>> 3; //@line 12329
   if ($12 >>> 0 < 256) {
    $22 = HEAP32[$mem + ($$sum2 + 8) >> 2] | 0; //@line 12334
    $24 = HEAP32[$mem + ($$sum2 + 12) >> 2] | 0; //@line 12337
    $26 = 804 + ($19 << 1 << 2) | 0; //@line 12339
    if (($22 | 0) != ($26 | 0)) {
     if ($22 >>> 0 < $2 >>> 0) {
      _abort(); //@line 12344
     }
     if ((HEAP32[$22 + 12 >> 2] | 0) != ($14 | 0)) {
      _abort(); //@line 12351
     }
    }
    if (($24 | 0) == ($22 | 0)) {
     HEAP32[191] = HEAP32[191] & ~(1 << $19); //@line 12361
     $p$0 = $14; //@line 12362
     $psize$0 = $15; //@line 12362
     break;
    }
    if (($24 | 0) == ($26 | 0)) {
     $$pre$phi61Z2D = $24 + 8 | 0; //@line 12368
    } else {
     if ($24 >>> 0 < $2 >>> 0) {
      _abort(); //@line 12372
     }
     $39 = $24 + 8 | 0; //@line 12375
     if ((HEAP32[$39 >> 2] | 0) == ($14 | 0)) {
      $$pre$phi61Z2D = $39; //@line 12379
     } else {
      _abort(); //@line 12381
     }
    }
    HEAP32[$22 + 12 >> 2] = $24; //@line 12386
    HEAP32[$$pre$phi61Z2D >> 2] = $22; //@line 12387
    $p$0 = $14; //@line 12388
    $psize$0 = $15; //@line 12388
    break;
   }
   $44 = HEAP32[$mem + ($$sum2 + 24) >> 2] | 0; //@line 12393
   $46 = HEAP32[$mem + ($$sum2 + 12) >> 2] | 0; //@line 12396
   do {
    if (($46 | 0) == ($14 | 0)) {
     $57 = $mem + ($$sum2 + 20) | 0; //@line 12401
     $58 = HEAP32[$57 >> 2] | 0; //@line 12402
     if (!$58) {
      $60 = $mem + ($$sum2 + 16) | 0; //@line 12406
      $61 = HEAP32[$60 >> 2] | 0; //@line 12407
      if (!$61) {
       $R$1 = 0; //@line 12410
       break;
      } else {
       $R$0 = $61; //@line 12413
       $RP$0 = $60; //@line 12413
      }
     } else {
      $R$0 = $58; //@line 12416
      $RP$0 = $57; //@line 12416
     }
     while (1) {
      $63 = $R$0 + 20 | 0; //@line 12419
      $64 = HEAP32[$63 >> 2] | 0; //@line 12420
      if ($64) {
       $R$0 = $64; //@line 12423
       $RP$0 = $63; //@line 12423
       continue;
      }
      $66 = $R$0 + 16 | 0; //@line 12426
      $67 = HEAP32[$66 >> 2] | 0; //@line 12427
      if (!$67) {
       $R$0$lcssa = $R$0; //@line 12430
       $RP$0$lcssa = $RP$0; //@line 12430
       break;
      } else {
       $R$0 = $67; //@line 12433
       $RP$0 = $66; //@line 12433
      }
     }
     if ($RP$0$lcssa >>> 0 < $2 >>> 0) {
      _abort(); //@line 12438
     } else {
      HEAP32[$RP$0$lcssa >> 2] = 0; //@line 12441
      $R$1 = $R$0$lcssa; //@line 12442
      break;
     }
    } else {
     $49 = HEAP32[$mem + ($$sum2 + 8) >> 2] | 0; //@line 12448
     if ($49 >>> 0 < $2 >>> 0) {
      _abort(); //@line 12451
     }
     $51 = $49 + 12 | 0; //@line 12454
     if ((HEAP32[$51 >> 2] | 0) != ($14 | 0)) {
      _abort(); //@line 12458
     }
     $54 = $46 + 8 | 0; //@line 12461
     if ((HEAP32[$54 >> 2] | 0) == ($14 | 0)) {
      HEAP32[$51 >> 2] = $46; //@line 12465
      HEAP32[$54 >> 2] = $49; //@line 12466
      $R$1 = $46; //@line 12467
      break;
     } else {
      _abort(); //@line 12470
     }
    }
   } while (0);
   if (!$44) {
    $p$0 = $14; //@line 12477
    $psize$0 = $15; //@line 12477
   } else {
    $72 = HEAP32[$mem + ($$sum2 + 28) >> 2] | 0; //@line 12481
    $73 = 1068 + ($72 << 2) | 0; //@line 12482
    if (($14 | 0) == (HEAP32[$73 >> 2] | 0)) {
     HEAP32[$73 >> 2] = $R$1; //@line 12486
     if (!$R$1) {
      HEAP32[192] = HEAP32[192] & ~(1 << $72); //@line 12493
      $p$0 = $14; //@line 12494
      $psize$0 = $15; //@line 12494
      break;
     }
    } else {
     if ($44 >>> 0 < (HEAP32[195] | 0) >>> 0) {
      _abort(); //@line 12501
     }
     $82 = $44 + 16 | 0; //@line 12504
     if ((HEAP32[$82 >> 2] | 0) == ($14 | 0)) {
      HEAP32[$82 >> 2] = $R$1; //@line 12508
     } else {
      HEAP32[$44 + 20 >> 2] = $R$1; //@line 12511
     }
     if (!$R$1) {
      $p$0 = $14; //@line 12515
      $psize$0 = $15; //@line 12515
      break;
     }
    }
    $87 = HEAP32[195] | 0; //@line 12519
    if ($R$1 >>> 0 < $87 >>> 0) {
     _abort(); //@line 12522
    }
    HEAP32[$R$1 + 24 >> 2] = $44; //@line 12526
    $91 = HEAP32[$mem + ($$sum2 + 16) >> 2] | 0; //@line 12529
    do {
     if ($91) {
      if ($91 >>> 0 < $87 >>> 0) {
       _abort(); //@line 12535
      } else {
       HEAP32[$R$1 + 16 >> 2] = $91; //@line 12539
       HEAP32[$91 + 24 >> 2] = $R$1; //@line 12541
       break;
      }
     }
    } while (0);
    $97 = HEAP32[$mem + ($$sum2 + 20) >> 2] | 0; //@line 12548
    if (!$97) {
     $p$0 = $14; //@line 12551
     $psize$0 = $15; //@line 12551
    } else {
     if ($97 >>> 0 < (HEAP32[195] | 0) >>> 0) {
      _abort(); //@line 12556
     } else {
      HEAP32[$R$1 + 20 >> 2] = $97; //@line 12560
      HEAP32[$97 + 24 >> 2] = $R$1; //@line 12562
      $p$0 = $14; //@line 12563
      $psize$0 = $15; //@line 12563
      break;
     }
    }
   }
  } else {
   $p$0 = $1; //@line 12569
   $psize$0 = $8; //@line 12569
  }
 } while (0);
 if ($p$0 >>> 0 >= $9 >>> 0) {
  _abort(); //@line 12574
 }
 $111 = $mem + ($8 + -4) | 0; //@line 12578
 $112 = HEAP32[$111 >> 2] | 0; //@line 12579
 if (!($112 & 1)) {
  _abort(); //@line 12583
 }
 if (!($112 & 2)) {
  if (($9 | 0) == (HEAP32[197] | 0)) {
   $120 = (HEAP32[194] | 0) + $psize$0 | 0; //@line 12593
   HEAP32[194] = $120; //@line 12594
   HEAP32[197] = $p$0; //@line 12595
   HEAP32[$p$0 + 4 >> 2] = $120 | 1; //@line 12598
   if (($p$0 | 0) != (HEAP32[196] | 0)) {
    return;
   }
   HEAP32[196] = 0; //@line 12604
   HEAP32[193] = 0; //@line 12605
   return;
  }
  if (($9 | 0) == (HEAP32[196] | 0)) {
   $128 = (HEAP32[193] | 0) + $psize$0 | 0; //@line 12612
   HEAP32[193] = $128; //@line 12613
   HEAP32[196] = $p$0; //@line 12614
   HEAP32[$p$0 + 4 >> 2] = $128 | 1; //@line 12617
   HEAP32[$p$0 + $128 >> 2] = $128; //@line 12619
   return;
  }
  $133 = ($112 & -8) + $psize$0 | 0; //@line 12623
  $134 = $112 >>> 3; //@line 12624
  do {
   if ($112 >>> 0 < 256) {
    $137 = HEAP32[$mem + $8 >> 2] | 0; //@line 12629
    $139 = HEAP32[$mem + ($8 | 4) >> 2] | 0; //@line 12632
    $141 = 804 + ($134 << 1 << 2) | 0; //@line 12634
    if (($137 | 0) != ($141 | 0)) {
     if ($137 >>> 0 < (HEAP32[195] | 0) >>> 0) {
      _abort(); //@line 12640
     }
     if ((HEAP32[$137 + 12 >> 2] | 0) != ($9 | 0)) {
      _abort(); //@line 12647
     }
    }
    if (($139 | 0) == ($137 | 0)) {
     HEAP32[191] = HEAP32[191] & ~(1 << $134); //@line 12657
     break;
    }
    if (($139 | 0) == ($141 | 0)) {
     $$pre$phi59Z2D = $139 + 8 | 0; //@line 12663
    } else {
     if ($139 >>> 0 < (HEAP32[195] | 0) >>> 0) {
      _abort(); //@line 12668
     }
     $156 = $139 + 8 | 0; //@line 12671
     if ((HEAP32[$156 >> 2] | 0) == ($9 | 0)) {
      $$pre$phi59Z2D = $156; //@line 12675
     } else {
      _abort(); //@line 12677
     }
    }
    HEAP32[$137 + 12 >> 2] = $139; //@line 12682
    HEAP32[$$pre$phi59Z2D >> 2] = $137; //@line 12683
   } else {
    $161 = HEAP32[$mem + ($8 + 16) >> 2] | 0; //@line 12687
    $163 = HEAP32[$mem + ($8 | 4) >> 2] | 0; //@line 12690
    do {
     if (($163 | 0) == ($9 | 0)) {
      $175 = $mem + ($8 + 12) | 0; //@line 12695
      $176 = HEAP32[$175 >> 2] | 0; //@line 12696
      if (!$176) {
       $178 = $mem + ($8 + 8) | 0; //@line 12700
       $179 = HEAP32[$178 >> 2] | 0; //@line 12701
       if (!$179) {
        $R7$1 = 0; //@line 12704
        break;
       } else {
        $R7$0 = $179; //@line 12707
        $RP9$0 = $178; //@line 12707
       }
      } else {
       $R7$0 = $176; //@line 12710
       $RP9$0 = $175; //@line 12710
      }
      while (1) {
       $181 = $R7$0 + 20 | 0; //@line 12713
       $182 = HEAP32[$181 >> 2] | 0; //@line 12714
       if ($182) {
        $R7$0 = $182; //@line 12717
        $RP9$0 = $181; //@line 12717
        continue;
       }
       $184 = $R7$0 + 16 | 0; //@line 12720
       $185 = HEAP32[$184 >> 2] | 0; //@line 12721
       if (!$185) {
        $R7$0$lcssa = $R7$0; //@line 12724
        $RP9$0$lcssa = $RP9$0; //@line 12724
        break;
       } else {
        $R7$0 = $185; //@line 12727
        $RP9$0 = $184; //@line 12727
       }
      }
      if ($RP9$0$lcssa >>> 0 < (HEAP32[195] | 0) >>> 0) {
       _abort(); //@line 12733
      } else {
       HEAP32[$RP9$0$lcssa >> 2] = 0; //@line 12736
       $R7$1 = $R7$0$lcssa; //@line 12737
       break;
      }
     } else {
      $166 = HEAP32[$mem + $8 >> 2] | 0; //@line 12742
      if ($166 >>> 0 < (HEAP32[195] | 0) >>> 0) {
       _abort(); //@line 12746
      }
      $169 = $166 + 12 | 0; //@line 12749
      if ((HEAP32[$169 >> 2] | 0) != ($9 | 0)) {
       _abort(); //@line 12753
      }
      $172 = $163 + 8 | 0; //@line 12756
      if ((HEAP32[$172 >> 2] | 0) == ($9 | 0)) {
       HEAP32[$169 >> 2] = $163; //@line 12760
       HEAP32[$172 >> 2] = $166; //@line 12761
       $R7$1 = $163; //@line 12762
       break;
      } else {
       _abort(); //@line 12765
      }
     }
    } while (0);
    if ($161) {
     $191 = HEAP32[$mem + ($8 + 20) >> 2] | 0; //@line 12774
     $192 = 1068 + ($191 << 2) | 0; //@line 12775
     if (($9 | 0) == (HEAP32[$192 >> 2] | 0)) {
      HEAP32[$192 >> 2] = $R7$1; //@line 12779
      if (!$R7$1) {
       HEAP32[192] = HEAP32[192] & ~(1 << $191); //@line 12786
       break;
      }
     } else {
      if ($161 >>> 0 < (HEAP32[195] | 0) >>> 0) {
       _abort(); //@line 12793
      }
      $201 = $161 + 16 | 0; //@line 12796
      if ((HEAP32[$201 >> 2] | 0) == ($9 | 0)) {
       HEAP32[$201 >> 2] = $R7$1; //@line 12800
      } else {
       HEAP32[$161 + 20 >> 2] = $R7$1; //@line 12803
      }
      if (!$R7$1) {
       break;
      }
     }
     $206 = HEAP32[195] | 0; //@line 12810
     if ($R7$1 >>> 0 < $206 >>> 0) {
      _abort(); //@line 12813
     }
     HEAP32[$R7$1 + 24 >> 2] = $161; //@line 12817
     $210 = HEAP32[$mem + ($8 + 8) >> 2] | 0; //@line 12820
     do {
      if ($210) {
       if ($210 >>> 0 < $206 >>> 0) {
        _abort(); //@line 12826
       } else {
        HEAP32[$R7$1 + 16 >> 2] = $210; //@line 12830
        HEAP32[$210 + 24 >> 2] = $R7$1; //@line 12832
        break;
       }
      }
     } while (0);
     $216 = HEAP32[$mem + ($8 + 12) >> 2] | 0; //@line 12839
     if ($216) {
      if ($216 >>> 0 < (HEAP32[195] | 0) >>> 0) {
       _abort(); //@line 12845
      } else {
       HEAP32[$R7$1 + 20 >> 2] = $216; //@line 12849
       HEAP32[$216 + 24 >> 2] = $R7$1; //@line 12851
       break;
      }
     }
    }
   }
  } while (0);
  HEAP32[$p$0 + 4 >> 2] = $133 | 1; //@line 12860
  HEAP32[$p$0 + $133 >> 2] = $133; //@line 12862
  if (($p$0 | 0) == (HEAP32[196] | 0)) {
   HEAP32[193] = $133; //@line 12866
   return;
  } else {
   $psize$1 = $133; //@line 12869
  }
 } else {
  HEAP32[$111 >> 2] = $112 & -2; //@line 12873
  HEAP32[$p$0 + 4 >> 2] = $psize$0 | 1; //@line 12876
  HEAP32[$p$0 + $psize$0 >> 2] = $psize$0; //@line 12878
  $psize$1 = $psize$0; //@line 12879
 }
 $231 = $psize$1 >>> 3; //@line 12881
 if ($psize$1 >>> 0 < 256) {
  $233 = $231 << 1; //@line 12884
  $234 = 804 + ($233 << 2) | 0; //@line 12885
  $235 = HEAP32[191] | 0; //@line 12886
  $236 = 1 << $231; //@line 12887
  if (!($235 & $236)) {
   HEAP32[191] = $235 | $236; //@line 12892
   $$pre$phiZ2D = 804 + ($233 + 2 << 2) | 0; //@line 12895
   $F16$0 = $234; //@line 12895
  } else {
   $240 = 804 + ($233 + 2 << 2) | 0; //@line 12898
   $241 = HEAP32[$240 >> 2] | 0; //@line 12899
   if ($241 >>> 0 < (HEAP32[195] | 0) >>> 0) {
    _abort(); //@line 12903
   } else {
    $$pre$phiZ2D = $240; //@line 12906
    $F16$0 = $241; //@line 12906
   }
  }
  HEAP32[$$pre$phiZ2D >> 2] = $p$0; //@line 12909
  HEAP32[$F16$0 + 12 >> 2] = $p$0; //@line 12911
  HEAP32[$p$0 + 8 >> 2] = $F16$0; //@line 12913
  HEAP32[$p$0 + 12 >> 2] = $234; //@line 12915
  return;
 }
 $247 = $psize$1 >>> 8; //@line 12918
 if (!$247) {
  $I18$0 = 0; //@line 12921
 } else {
  if ($psize$1 >>> 0 > 16777215) {
   $I18$0 = 31; //@line 12925
  } else {
   $252 = ($247 + 1048320 | 0) >>> 16 & 8; //@line 12929
   $253 = $247 << $252; //@line 12930
   $256 = ($253 + 520192 | 0) >>> 16 & 4; //@line 12933
   $258 = $253 << $256; //@line 12935
   $261 = ($258 + 245760 | 0) >>> 16 & 2; //@line 12938
   $266 = 14 - ($256 | $252 | $261) + ($258 << $261 >>> 15) | 0; //@line 12943
   $I18$0 = $psize$1 >>> ($266 + 7 | 0) & 1 | $266 << 1; //@line 12949
  }
 }
 $272 = 1068 + ($I18$0 << 2) | 0; //@line 12952
 HEAP32[$p$0 + 28 >> 2] = $I18$0; //@line 12954
 HEAP32[$p$0 + 20 >> 2] = 0; //@line 12957
 HEAP32[$p$0 + 16 >> 2] = 0; //@line 12958
 $276 = HEAP32[192] | 0; //@line 12959
 $277 = 1 << $I18$0; //@line 12960
 L199 : do {
  if (!($276 & $277)) {
   HEAP32[192] = $276 | $277; //@line 12966
   HEAP32[$272 >> 2] = $p$0; //@line 12967
   HEAP32[$p$0 + 24 >> 2] = $272; //@line 12969
   HEAP32[$p$0 + 12 >> 2] = $p$0; //@line 12971
   HEAP32[$p$0 + 8 >> 2] = $p$0; //@line 12973
  } else {
   $284 = HEAP32[$272 >> 2] | 0; //@line 12975
   L202 : do {
    if ((HEAP32[$284 + 4 >> 2] & -8 | 0) == ($psize$1 | 0)) {
     $T$0$lcssa = $284; //@line 12982
    } else {
     $K19$052 = $psize$1 << (($I18$0 | 0) == 31 ? 0 : 25 - ($I18$0 >>> 1) | 0); //@line 12989
     $T$051 = $284; //@line 12989
     while (1) {
      $301 = $T$051 + 16 + ($K19$052 >>> 31 << 2) | 0; //@line 12992
      $296 = HEAP32[$301 >> 2] | 0; //@line 12993
      if (!$296) {
       $$lcssa = $301; //@line 12996
       $T$051$lcssa = $T$051; //@line 12996
       break;
      }
      if ((HEAP32[$296 + 4 >> 2] & -8 | 0) == ($psize$1 | 0)) {
       $T$0$lcssa = $296; //@line 13005
       break L202;
      } else {
       $K19$052 = $K19$052 << 1; //@line 13008
       $T$051 = $296; //@line 13008
      }
     }
     if ($$lcssa >>> 0 < (HEAP32[195] | 0) >>> 0) {
      _abort(); //@line 13014
     } else {
      HEAP32[$$lcssa >> 2] = $p$0; //@line 13017
      HEAP32[$p$0 + 24 >> 2] = $T$051$lcssa; //@line 13019
      HEAP32[$p$0 + 12 >> 2] = $p$0; //@line 13021
      HEAP32[$p$0 + 8 >> 2] = $p$0; //@line 13023
      break L199;
     }
    }
   } while (0);
   $308 = $T$0$lcssa + 8 | 0; //@line 13028
   $309 = HEAP32[$308 >> 2] | 0; //@line 13029
   $310 = HEAP32[195] | 0; //@line 13030
   if ($309 >>> 0 >= $310 >>> 0 & $T$0$lcssa >>> 0 >= $310 >>> 0) {
    HEAP32[$309 + 12 >> 2] = $p$0; //@line 13036
    HEAP32[$308 >> 2] = $p$0; //@line 13037
    HEAP32[$p$0 + 8 >> 2] = $309; //@line 13039
    HEAP32[$p$0 + 12 >> 2] = $T$0$lcssa; //@line 13041
    HEAP32[$p$0 + 24 >> 2] = 0; //@line 13043
    break;
   } else {
    _abort(); //@line 13046
   }
  }
 } while (0);
 $318 = (HEAP32[199] | 0) + -1 | 0; //@line 13052
 HEAP32[199] = $318; //@line 13053
 if (!$318) {
  $sp$0$in$i = 1220; //@line 13056
 } else {
  return;
 }
 while (1) {
  $sp$0$i = HEAP32[$sp$0$in$i >> 2] | 0; //@line 13061
  if (!$sp$0$i) {
   break;
  } else {
   $sp$0$in$i = $sp$0$i + 8 | 0; //@line 13067
  }
 }
 HEAP32[199] = -1; //@line 13070
 return;
}
function _dispose_chunk($p, $psize) {
 $p = $p | 0;
 $psize = $psize | 0;
 var $$0 = 0, $$02 = 0, $$1 = 0, $$lcssa = 0, $$pre$phi50Z2D = 0, $$pre$phi52Z2D = 0, $$pre$phiZ2D = 0, $$sum18 = 0, $$sum21 = 0, $0 = 0, $10 = 0, $100 = 0, $106 = 0, $108 = 0, $109 = 0, $11 = 0, $115 = 0, $123 = 0, $128 = 0, $129 = 0, $132 = 0, $134 = 0, $136 = 0, $149 = 0, $15 = 0, $154 = 0, $156 = 0, $159 = 0, $161 = 0, $164 = 0, $167 = 0, $168 = 0, $170 = 0, $171 = 0, $173 = 0, $174 = 0, $176 = 0, $177 = 0, $18 = 0, $182 = 0, $183 = 0, $192 = 0, $197 = 0, $2 = 0, $20 = 0, $201 = 0, $207 = 0, $22 = 0, $222 = 0, $224 = 0, $225 = 0, $226 = 0, $227 = 0, $231 = 0, $232 = 0, $238 = 0, $243 = 0, $244 = 0, $247 = 0, $249 = 0, $252 = 0, $257 = 0, $263 = 0, $267 = 0, $268 = 0, $275 = 0, $287 = 0, $292 = 0, $299 = 0, $300 = 0, $301 = 0, $35 = 0, $40 = 0, $42 = 0, $45 = 0, $47 = 0, $5 = 0, $50 = 0, $53 = 0, $54 = 0, $56 = 0, $57 = 0, $59 = 0, $60 = 0, $62 = 0, $63 = 0, $68 = 0, $69 = 0, $78 = 0, $83 = 0, $87 = 0, $9 = 0, $93 = 0, $99 = 0, $F16$0 = 0, $I19$0 = 0, $K20$043 = 0, $R$0 = 0, $R$0$lcssa = 0, $R$1 = 0, $R7$0 = 0, $R7$0$lcssa = 0, $R7$1 = 0, $RP$0 = 0, $RP$0$lcssa = 0, $RP9$0 = 0, $RP9$0$lcssa = 0, $T$0$lcssa = 0, $T$042 = 0, $T$042$lcssa = 0;
 $0 = $p + $psize | 0; //@line 13584
 $2 = HEAP32[$p + 4 >> 2] | 0; //@line 13586
 do {
  if (!($2 & 1)) {
   $5 = HEAP32[$p >> 2] | 0; //@line 13591
   if (!($2 & 3)) {
    return;
   }
   $9 = $p + (0 - $5) | 0; //@line 13598
   $10 = $5 + $psize | 0; //@line 13599
   $11 = HEAP32[195] | 0; //@line 13600
   if ($9 >>> 0 < $11 >>> 0) {
    _abort(); //@line 13603
   }
   if (($9 | 0) == (HEAP32[196] | 0)) {
    $99 = $p + ($psize + 4) | 0; //@line 13610
    $100 = HEAP32[$99 >> 2] | 0; //@line 13611
    if (($100 & 3 | 0) != 3) {
     $$0 = $9; //@line 13615
     $$02 = $10; //@line 13615
     break;
    }
    HEAP32[193] = $10; //@line 13618
    HEAP32[$99 >> 2] = $100 & -2; //@line 13620
    HEAP32[$p + (4 - $5) >> 2] = $10 | 1; //@line 13624
    HEAP32[$0 >> 2] = $10; //@line 13625
    return;
   }
   $15 = $5 >>> 3; //@line 13628
   if ($5 >>> 0 < 256) {
    $18 = HEAP32[$p + (8 - $5) >> 2] | 0; //@line 13633
    $20 = HEAP32[$p + (12 - $5) >> 2] | 0; //@line 13636
    $22 = 804 + ($15 << 1 << 2) | 0; //@line 13638
    if (($18 | 0) != ($22 | 0)) {
     if ($18 >>> 0 < $11 >>> 0) {
      _abort(); //@line 13643
     }
     if ((HEAP32[$18 + 12 >> 2] | 0) != ($9 | 0)) {
      _abort(); //@line 13650
     }
    }
    if (($20 | 0) == ($18 | 0)) {
     HEAP32[191] = HEAP32[191] & ~(1 << $15); //@line 13660
     $$0 = $9; //@line 13661
     $$02 = $10; //@line 13661
     break;
    }
    if (($20 | 0) == ($22 | 0)) {
     $$pre$phi52Z2D = $20 + 8 | 0; //@line 13667
    } else {
     if ($20 >>> 0 < $11 >>> 0) {
      _abort(); //@line 13671
     }
     $35 = $20 + 8 | 0; //@line 13674
     if ((HEAP32[$35 >> 2] | 0) == ($9 | 0)) {
      $$pre$phi52Z2D = $35; //@line 13678
     } else {
      _abort(); //@line 13680
     }
    }
    HEAP32[$18 + 12 >> 2] = $20; //@line 13685
    HEAP32[$$pre$phi52Z2D >> 2] = $18; //@line 13686
    $$0 = $9; //@line 13687
    $$02 = $10; //@line 13687
    break;
   }
   $40 = HEAP32[$p + (24 - $5) >> 2] | 0; //@line 13692
   $42 = HEAP32[$p + (12 - $5) >> 2] | 0; //@line 13695
   do {
    if (($42 | 0) == ($9 | 0)) {
     $$sum18 = 16 - $5 | 0; //@line 13699
     $53 = $p + ($$sum18 + 4) | 0; //@line 13701
     $54 = HEAP32[$53 >> 2] | 0; //@line 13702
     if (!$54) {
      $56 = $p + $$sum18 | 0; //@line 13705
      $57 = HEAP32[$56 >> 2] | 0; //@line 13706
      if (!$57) {
       $R$1 = 0; //@line 13709
       break;
      } else {
       $R$0 = $57; //@line 13712
       $RP$0 = $56; //@line 13712
      }
     } else {
      $R$0 = $54; //@line 13715
      $RP$0 = $53; //@line 13715
     }
     while (1) {
      $59 = $R$0 + 20 | 0; //@line 13718
      $60 = HEAP32[$59 >> 2] | 0; //@line 13719
      if ($60) {
       $R$0 = $60; //@line 13722
       $RP$0 = $59; //@line 13722
       continue;
      }
      $62 = $R$0 + 16 | 0; //@line 13725
      $63 = HEAP32[$62 >> 2] | 0; //@line 13726
      if (!$63) {
       $R$0$lcssa = $R$0; //@line 13729
       $RP$0$lcssa = $RP$0; //@line 13729
       break;
      } else {
       $R$0 = $63; //@line 13732
       $RP$0 = $62; //@line 13732
      }
     }
     if ($RP$0$lcssa >>> 0 < $11 >>> 0) {
      _abort(); //@line 13737
     } else {
      HEAP32[$RP$0$lcssa >> 2] = 0; //@line 13740
      $R$1 = $R$0$lcssa; //@line 13741
      break;
     }
    } else {
     $45 = HEAP32[$p + (8 - $5) >> 2] | 0; //@line 13747
     if ($45 >>> 0 < $11 >>> 0) {
      _abort(); //@line 13750
     }
     $47 = $45 + 12 | 0; //@line 13753
     if ((HEAP32[$47 >> 2] | 0) != ($9 | 0)) {
      _abort(); //@line 13757
     }
     $50 = $42 + 8 | 0; //@line 13760
     if ((HEAP32[$50 >> 2] | 0) == ($9 | 0)) {
      HEAP32[$47 >> 2] = $42; //@line 13764
      HEAP32[$50 >> 2] = $45; //@line 13765
      $R$1 = $42; //@line 13766
      break;
     } else {
      _abort(); //@line 13769
     }
    }
   } while (0);
   if (!$40) {
    $$0 = $9; //@line 13776
    $$02 = $10; //@line 13776
   } else {
    $68 = HEAP32[$p + (28 - $5) >> 2] | 0; //@line 13780
    $69 = 1068 + ($68 << 2) | 0; //@line 13781
    if (($9 | 0) == (HEAP32[$69 >> 2] | 0)) {
     HEAP32[$69 >> 2] = $R$1; //@line 13785
     if (!$R$1) {
      HEAP32[192] = HEAP32[192] & ~(1 << $68); //@line 13792
      $$0 = $9; //@line 13793
      $$02 = $10; //@line 13793
      break;
     }
    } else {
     if ($40 >>> 0 < (HEAP32[195] | 0) >>> 0) {
      _abort(); //@line 13800
     }
     $78 = $40 + 16 | 0; //@line 13803
     if ((HEAP32[$78 >> 2] | 0) == ($9 | 0)) {
      HEAP32[$78 >> 2] = $R$1; //@line 13807
     } else {
      HEAP32[$40 + 20 >> 2] = $R$1; //@line 13810
     }
     if (!$R$1) {
      $$0 = $9; //@line 13814
      $$02 = $10; //@line 13814
      break;
     }
    }
    $83 = HEAP32[195] | 0; //@line 13818
    if ($R$1 >>> 0 < $83 >>> 0) {
     _abort(); //@line 13821
    }
    HEAP32[$R$1 + 24 >> 2] = $40; //@line 13825
    $$sum21 = 16 - $5 | 0; //@line 13826
    $87 = HEAP32[$p + $$sum21 >> 2] | 0; //@line 13828
    do {
     if ($87) {
      if ($87 >>> 0 < $83 >>> 0) {
       _abort(); //@line 13834
      } else {
       HEAP32[$R$1 + 16 >> 2] = $87; //@line 13838
       HEAP32[$87 + 24 >> 2] = $R$1; //@line 13840
       break;
      }
     }
    } while (0);
    $93 = HEAP32[$p + ($$sum21 + 4) >> 2] | 0; //@line 13847
    if (!$93) {
     $$0 = $9; //@line 13850
     $$02 = $10; //@line 13850
    } else {
     if ($93 >>> 0 < (HEAP32[195] | 0) >>> 0) {
      _abort(); //@line 13855
     } else {
      HEAP32[$R$1 + 20 >> 2] = $93; //@line 13859
      HEAP32[$93 + 24 >> 2] = $R$1; //@line 13861
      $$0 = $9; //@line 13862
      $$02 = $10; //@line 13862
      break;
     }
    }
   }
  } else {
   $$0 = $p; //@line 13868
   $$02 = $psize; //@line 13868
  }
 } while (0);
 $106 = HEAP32[195] | 0; //@line 13871
 if ($0 >>> 0 < $106 >>> 0) {
  _abort(); //@line 13874
 }
 $108 = $p + ($psize + 4) | 0; //@line 13878
 $109 = HEAP32[$108 >> 2] | 0; //@line 13879
 if (!($109 & 2)) {
  if (($0 | 0) == (HEAP32[197] | 0)) {
   $115 = (HEAP32[194] | 0) + $$02 | 0; //@line 13887
   HEAP32[194] = $115; //@line 13888
   HEAP32[197] = $$0; //@line 13889
   HEAP32[$$0 + 4 >> 2] = $115 | 1; //@line 13892
   if (($$0 | 0) != (HEAP32[196] | 0)) {
    return;
   }
   HEAP32[196] = 0; //@line 13898
   HEAP32[193] = 0; //@line 13899
   return;
  }
  if (($0 | 0) == (HEAP32[196] | 0)) {
   $123 = (HEAP32[193] | 0) + $$02 | 0; //@line 13906
   HEAP32[193] = $123; //@line 13907
   HEAP32[196] = $$0; //@line 13908
   HEAP32[$$0 + 4 >> 2] = $123 | 1; //@line 13911
   HEAP32[$$0 + $123 >> 2] = $123; //@line 13913
   return;
  }
  $128 = ($109 & -8) + $$02 | 0; //@line 13917
  $129 = $109 >>> 3; //@line 13918
  do {
   if ($109 >>> 0 < 256) {
    $132 = HEAP32[$p + ($psize + 8) >> 2] | 0; //@line 13924
    $134 = HEAP32[$p + ($psize + 12) >> 2] | 0; //@line 13927
    $136 = 804 + ($129 << 1 << 2) | 0; //@line 13929
    if (($132 | 0) != ($136 | 0)) {
     if ($132 >>> 0 < $106 >>> 0) {
      _abort(); //@line 13934
     }
     if ((HEAP32[$132 + 12 >> 2] | 0) != ($0 | 0)) {
      _abort(); //@line 13941
     }
    }
    if (($134 | 0) == ($132 | 0)) {
     HEAP32[191] = HEAP32[191] & ~(1 << $129); //@line 13951
     break;
    }
    if (($134 | 0) == ($136 | 0)) {
     $$pre$phi50Z2D = $134 + 8 | 0; //@line 13957
    } else {
     if ($134 >>> 0 < $106 >>> 0) {
      _abort(); //@line 13961
     }
     $149 = $134 + 8 | 0; //@line 13964
     if ((HEAP32[$149 >> 2] | 0) == ($0 | 0)) {
      $$pre$phi50Z2D = $149; //@line 13968
     } else {
      _abort(); //@line 13970
     }
    }
    HEAP32[$132 + 12 >> 2] = $134; //@line 13975
    HEAP32[$$pre$phi50Z2D >> 2] = $132; //@line 13976
   } else {
    $154 = HEAP32[$p + ($psize + 24) >> 2] | 0; //@line 13980
    $156 = HEAP32[$p + ($psize + 12) >> 2] | 0; //@line 13983
    do {
     if (($156 | 0) == ($0 | 0)) {
      $167 = $p + ($psize + 20) | 0; //@line 13988
      $168 = HEAP32[$167 >> 2] | 0; //@line 13989
      if (!$168) {
       $170 = $p + ($psize + 16) | 0; //@line 13993
       $171 = HEAP32[$170 >> 2] | 0; //@line 13994
       if (!$171) {
        $R7$1 = 0; //@line 13997
        break;
       } else {
        $R7$0 = $171; //@line 14000
        $RP9$0 = $170; //@line 14000
       }
      } else {
       $R7$0 = $168; //@line 14003
       $RP9$0 = $167; //@line 14003
      }
      while (1) {
       $173 = $R7$0 + 20 | 0; //@line 14006
       $174 = HEAP32[$173 >> 2] | 0; //@line 14007
       if ($174) {
        $R7$0 = $174; //@line 14010
        $RP9$0 = $173; //@line 14010
        continue;
       }
       $176 = $R7$0 + 16 | 0; //@line 14013
       $177 = HEAP32[$176 >> 2] | 0; //@line 14014
       if (!$177) {
        $R7$0$lcssa = $R7$0; //@line 14017
        $RP9$0$lcssa = $RP9$0; //@line 14017
        break;
       } else {
        $R7$0 = $177; //@line 14020
        $RP9$0 = $176; //@line 14020
       }
      }
      if ($RP9$0$lcssa >>> 0 < $106 >>> 0) {
       _abort(); //@line 14025
      } else {
       HEAP32[$RP9$0$lcssa >> 2] = 0; //@line 14028
       $R7$1 = $R7$0$lcssa; //@line 14029
       break;
      }
     } else {
      $159 = HEAP32[$p + ($psize + 8) >> 2] | 0; //@line 14035
      if ($159 >>> 0 < $106 >>> 0) {
       _abort(); //@line 14038
      }
      $161 = $159 + 12 | 0; //@line 14041
      if ((HEAP32[$161 >> 2] | 0) != ($0 | 0)) {
       _abort(); //@line 14045
      }
      $164 = $156 + 8 | 0; //@line 14048
      if ((HEAP32[$164 >> 2] | 0) == ($0 | 0)) {
       HEAP32[$161 >> 2] = $156; //@line 14052
       HEAP32[$164 >> 2] = $159; //@line 14053
       $R7$1 = $156; //@line 14054
       break;
      } else {
       _abort(); //@line 14057
      }
     }
    } while (0);
    if ($154) {
     $182 = HEAP32[$p + ($psize + 28) >> 2] | 0; //@line 14066
     $183 = 1068 + ($182 << 2) | 0; //@line 14067
     if (($0 | 0) == (HEAP32[$183 >> 2] | 0)) {
      HEAP32[$183 >> 2] = $R7$1; //@line 14071
      if (!$R7$1) {
       HEAP32[192] = HEAP32[192] & ~(1 << $182); //@line 14078
       break;
      }
     } else {
      if ($154 >>> 0 < (HEAP32[195] | 0) >>> 0) {
       _abort(); //@line 14085
      }
      $192 = $154 + 16 | 0; //@line 14088
      if ((HEAP32[$192 >> 2] | 0) == ($0 | 0)) {
       HEAP32[$192 >> 2] = $R7$1; //@line 14092
      } else {
       HEAP32[$154 + 20 >> 2] = $R7$1; //@line 14095
      }
      if (!$R7$1) {
       break;
      }
     }
     $197 = HEAP32[195] | 0; //@line 14102
     if ($R7$1 >>> 0 < $197 >>> 0) {
      _abort(); //@line 14105
     }
     HEAP32[$R7$1 + 24 >> 2] = $154; //@line 14109
     $201 = HEAP32[$p + ($psize + 16) >> 2] | 0; //@line 14112
     do {
      if ($201) {
       if ($201 >>> 0 < $197 >>> 0) {
        _abort(); //@line 14118
       } else {
        HEAP32[$R7$1 + 16 >> 2] = $201; //@line 14122
        HEAP32[$201 + 24 >> 2] = $R7$1; //@line 14124
        break;
       }
      }
     } while (0);
     $207 = HEAP32[$p + ($psize + 20) >> 2] | 0; //@line 14131
     if ($207) {
      if ($207 >>> 0 < (HEAP32[195] | 0) >>> 0) {
       _abort(); //@line 14137
      } else {
       HEAP32[$R7$1 + 20 >> 2] = $207; //@line 14141
       HEAP32[$207 + 24 >> 2] = $R7$1; //@line 14143
       break;
      }
     }
    }
   }
  } while (0);
  HEAP32[$$0 + 4 >> 2] = $128 | 1; //@line 14152
  HEAP32[$$0 + $128 >> 2] = $128; //@line 14154
  if (($$0 | 0) == (HEAP32[196] | 0)) {
   HEAP32[193] = $128; //@line 14158
   return;
  } else {
   $$1 = $128; //@line 14161
  }
 } else {
  HEAP32[$108 >> 2] = $109 & -2; //@line 14165
  HEAP32[$$0 + 4 >> 2] = $$02 | 1; //@line 14168
  HEAP32[$$0 + $$02 >> 2] = $$02; //@line 14170
  $$1 = $$02; //@line 14171
 }
 $222 = $$1 >>> 3; //@line 14173
 if ($$1 >>> 0 < 256) {
  $224 = $222 << 1; //@line 14176
  $225 = 804 + ($224 << 2) | 0; //@line 14177
  $226 = HEAP32[191] | 0; //@line 14178
  $227 = 1 << $222; //@line 14179
  if (!($226 & $227)) {
   HEAP32[191] = $226 | $227; //@line 14184
   $$pre$phiZ2D = 804 + ($224 + 2 << 2) | 0; //@line 14187
   $F16$0 = $225; //@line 14187
  } else {
   $231 = 804 + ($224 + 2 << 2) | 0; //@line 14190
   $232 = HEAP32[$231 >> 2] | 0; //@line 14191
   if ($232 >>> 0 < (HEAP32[195] | 0) >>> 0) {
    _abort(); //@line 14195
   } else {
    $$pre$phiZ2D = $231; //@line 14198
    $F16$0 = $232; //@line 14198
   }
  }
  HEAP32[$$pre$phiZ2D >> 2] = $$0; //@line 14201
  HEAP32[$F16$0 + 12 >> 2] = $$0; //@line 14203
  HEAP32[$$0 + 8 >> 2] = $F16$0; //@line 14205
  HEAP32[$$0 + 12 >> 2] = $225; //@line 14207
  return;
 }
 $238 = $$1 >>> 8; //@line 14210
 if (!$238) {
  $I19$0 = 0; //@line 14213
 } else {
  if ($$1 >>> 0 > 16777215) {
   $I19$0 = 31; //@line 14217
  } else {
   $243 = ($238 + 1048320 | 0) >>> 16 & 8; //@line 14221
   $244 = $238 << $243; //@line 14222
   $247 = ($244 + 520192 | 0) >>> 16 & 4; //@line 14225
   $249 = $244 << $247; //@line 14227
   $252 = ($249 + 245760 | 0) >>> 16 & 2; //@line 14230
   $257 = 14 - ($247 | $243 | $252) + ($249 << $252 >>> 15) | 0; //@line 14235
   $I19$0 = $$1 >>> ($257 + 7 | 0) & 1 | $257 << 1; //@line 14241
  }
 }
 $263 = 1068 + ($I19$0 << 2) | 0; //@line 14244
 HEAP32[$$0 + 28 >> 2] = $I19$0; //@line 14246
 HEAP32[$$0 + 20 >> 2] = 0; //@line 14249
 HEAP32[$$0 + 16 >> 2] = 0; //@line 14250
 $267 = HEAP32[192] | 0; //@line 14251
 $268 = 1 << $I19$0; //@line 14252
 if (!($267 & $268)) {
  HEAP32[192] = $267 | $268; //@line 14257
  HEAP32[$263 >> 2] = $$0; //@line 14258
  HEAP32[$$0 + 24 >> 2] = $263; //@line 14260
  HEAP32[$$0 + 12 >> 2] = $$0; //@line 14262
  HEAP32[$$0 + 8 >> 2] = $$0; //@line 14264
  return;
 }
 $275 = HEAP32[$263 >> 2] | 0; //@line 14267
 L191 : do {
  if ((HEAP32[$275 + 4 >> 2] & -8 | 0) == ($$1 | 0)) {
   $T$0$lcssa = $275; //@line 14274
  } else {
   $K20$043 = $$1 << (($I19$0 | 0) == 31 ? 0 : 25 - ($I19$0 >>> 1) | 0); //@line 14281
   $T$042 = $275; //@line 14281
   while (1) {
    $292 = $T$042 + 16 + ($K20$043 >>> 31 << 2) | 0; //@line 14284
    $287 = HEAP32[$292 >> 2] | 0; //@line 14285
    if (!$287) {
     $$lcssa = $292; //@line 14288
     $T$042$lcssa = $T$042; //@line 14288
     break;
    }
    if ((HEAP32[$287 + 4 >> 2] & -8 | 0) == ($$1 | 0)) {
     $T$0$lcssa = $287; //@line 14297
     break L191;
    } else {
     $K20$043 = $K20$043 << 1; //@line 14300
     $T$042 = $287; //@line 14300
    }
   }
   if ($$lcssa >>> 0 < (HEAP32[195] | 0) >>> 0) {
    _abort(); //@line 14306
   }
   HEAP32[$$lcssa >> 2] = $$0; //@line 14309
   HEAP32[$$0 + 24 >> 2] = $T$042$lcssa; //@line 14311
   HEAP32[$$0 + 12 >> 2] = $$0; //@line 14313
   HEAP32[$$0 + 8 >> 2] = $$0; //@line 14315
   return;
  }
 } while (0);
 $299 = $T$0$lcssa + 8 | 0; //@line 14319
 $300 = HEAP32[$299 >> 2] | 0; //@line 14320
 $301 = HEAP32[195] | 0; //@line 14321
 if (!($300 >>> 0 >= $301 >>> 0 & $T$0$lcssa >>> 0 >= $301 >>> 0)) {
  _abort(); //@line 14326
 }
 HEAP32[$300 + 12 >> 2] = $$0; //@line 14330
 HEAP32[$299 >> 2] = $$0; //@line 14331
 HEAP32[$$0 + 8 >> 2] = $300; //@line 14333
 HEAP32[$$0 + 12 >> 2] = $T$0$lcssa; //@line 14335
 HEAP32[$$0 + 24 >> 2] = 0; //@line 14337
 return;
}
function ___intscan($f, $base, $pok, $0, $1) {
 $f = $f | 0;
 $base = $base | 0;
 $pok = $pok | 0;
 $0 = $0 | 0;
 $1 = $1 | 0;
 var $$1 = 0, $$122 = 0, $$123 = 0, $$base21 = 0, $$lcssa = 0, $$lcssa130 = 0, $$lcssa131 = 0, $$lcssa132 = 0, $$lcssa133 = 0, $$lcssa134 = 0, $$lcssa135 = 0, $100 = 0, $101 = 0, $108 = 0, $120 = 0, $121 = 0, $128 = 0, $13 = 0, $130 = 0, $131 = 0, $134 = 0, $135 = 0, $136 = 0, $144 = 0, $149 = 0, $150 = 0, $152 = 0, $155 = 0, $157 = 0, $161 = 0, $162 = 0, $163 = 0, $164 = 0, $166 = 0, $167 = 0, $168 = 0, $17 = 0, $18 = 0, $185 = 0, $186 = 0, $187 = 0, $195 = 0, $201 = 0, $203 = 0, $204 = 0, $206 = 0, $208 = 0, $212 = 0, $213 = 0, $214 = 0, $215 = 0, $222 = 0, $223 = 0, $224 = 0, $239 = 0, $25 = 0, $260 = 0, $262 = 0, $272 = 0, $281 = 0, $284 = 0, $286 = 0, $287 = 0, $288 = 0, $289 = 0, $29 = 0, $290 = 0, $291 = 0, $292 = 0, $293 = 0, $294 = 0, $295 = 0, $3 = 0, $37 = 0, $39 = 0, $4 = 0, $46 = 0, $51 = 0, $6 = 0, $67 = 0, $70 = 0, $71 = 0, $72 = 0, $83 = 0, $85 = 0, $86 = 0, $87 = 0, $88 = 0, $90 = 0, $91 = 0, $93 = 0, $99 = 0, $c$0 = 0, $c$1 = 0, $c$124 = 0, $c$2$be = 0, $c$2$be$lcssa = 0, $c$2$lcssa = 0, $c$3$be = 0, $c$3$lcssa = 0, $c$371 = 0, $c$4$be = 0, $c$4$be$lcssa = 0, $c$4$lcssa = 0, $c$5$be = 0, $c$6$be = 0, $c$6$be$lcssa = 0, $c$6$lcssa = 0, $c$7$be = 0, $c$753 = 0, $c$8 = 0, $c$9$be = 0, $neg$0 = 0, $neg$1 = 0, $x$082 = 0, $x$146 = 0, $x$266 = 0, label = 0;
 L1 : do {
  if ($base >>> 0 > 36) {
   HEAP32[(___errno_location() | 0) >> 2] = 22; //@line 2106
   $286 = 0; //@line 2107
   $287 = 0; //@line 2107
  } else {
   $3 = $f + 4 | 0; //@line 2109
   $4 = $f + 100 | 0; //@line 2110
   do {
    $6 = HEAP32[$3 >> 2] | 0; //@line 2112
    if ($6 >>> 0 < (HEAP32[$4 >> 2] | 0) >>> 0) {
     HEAP32[$3 >> 2] = $6 + 1; //@line 2117
     $13 = HEAPU8[$6 >> 0] | 0; //@line 2120
    } else {
     $13 = ___shgetc($f) | 0; //@line 2123
    }
   } while ((_isspace($13) | 0) != 0);
   $$lcssa135 = $13; //@line 2128
   L11 : do {
    switch ($$lcssa135 | 0) {
    case 43:
    case 45:
     {
      $17 = (($$lcssa135 | 0) == 45) << 31 >> 31; //@line 2136
      $18 = HEAP32[$3 >> 2] | 0; //@line 2137
      if ($18 >>> 0 < (HEAP32[$4 >> 2] | 0) >>> 0) {
       HEAP32[$3 >> 2] = $18 + 1; //@line 2142
       $c$0 = HEAPU8[$18 >> 0] | 0; //@line 2145
       $neg$0 = $17; //@line 2145
       break L11;
      } else {
       $c$0 = ___shgetc($f) | 0; //@line 2149
       $neg$0 = $17; //@line 2149
       break L11;
      }
      break;
     }
    default:
     {
      $c$0 = $$lcssa135; //@line 2155
      $neg$0 = 0; //@line 2155
     }
    }
   } while (0);
   $25 = ($base | 0) == 0; //@line 2159
   do {
    if (($base & -17 | 0) == 0 & ($c$0 | 0) == 48) {
     $29 = HEAP32[$3 >> 2] | 0; //@line 2166
     if ($29 >>> 0 < (HEAP32[$4 >> 2] | 0) >>> 0) {
      HEAP32[$3 >> 2] = $29 + 1; //@line 2171
      $37 = HEAPU8[$29 >> 0] | 0; //@line 2174
     } else {
      $37 = ___shgetc($f) | 0; //@line 2177
     }
     if (($37 | 32 | 0) != 120) {
      if ($25) {
       $$123 = 8; //@line 2183
       $c$124 = $37; //@line 2183
       label = 46; //@line 2184
       break;
      } else {
       $$1 = $base; //@line 2187
       $c$1 = $37; //@line 2187
       label = 32; //@line 2188
       break;
      }
     }
     $39 = HEAP32[$3 >> 2] | 0; //@line 2192
     if ($39 >>> 0 < (HEAP32[$4 >> 2] | 0) >>> 0) {
      HEAP32[$3 >> 2] = $39 + 1; //@line 2197
      $46 = HEAPU8[$39 >> 0] | 0; //@line 2200
     } else {
      $46 = ___shgetc($f) | 0; //@line 2203
     }
     if ((HEAPU8[3573 + ($46 + 1) >> 0] | 0) > 15) {
      $51 = (HEAP32[$4 >> 2] | 0) == 0; //@line 2211
      if (!$51) {
       HEAP32[$3 >> 2] = (HEAP32[$3 >> 2] | 0) + -1; //@line 2215
      }
      if (!$pok) {
       ___shlim($f, 0); //@line 2219
       $286 = 0; //@line 2220
       $287 = 0; //@line 2220
       break L1;
      }
      if ($51) {
       $286 = 0; //@line 2224
       $287 = 0; //@line 2224
       break L1;
      }
      HEAP32[$3 >> 2] = (HEAP32[$3 >> 2] | 0) + -1; //@line 2229
      $286 = 0; //@line 2230
      $287 = 0; //@line 2230
      break L1;
     } else {
      $$123 = 16; //@line 2233
      $c$124 = $46; //@line 2233
      label = 46; //@line 2234
     }
    } else {
     $$base21 = $25 ? 10 : $base; //@line 2237
     if ((HEAPU8[3573 + ($c$0 + 1) >> 0] | 0) >>> 0 < $$base21 >>> 0) {
      $$1 = $$base21; //@line 2244
      $c$1 = $c$0; //@line 2244
      label = 32; //@line 2245
     } else {
      if (HEAP32[$4 >> 2] | 0) {
       HEAP32[$3 >> 2] = (HEAP32[$3 >> 2] | 0) + -1; //@line 2252
      }
      ___shlim($f, 0); //@line 2254
      HEAP32[(___errno_location() | 0) >> 2] = 22; //@line 2256
      $286 = 0; //@line 2257
      $287 = 0; //@line 2257
      break L1;
     }
    }
   } while (0);
   if ((label | 0) == 32) {
    if (($$1 | 0) == 10) {
     $67 = $c$1 + -48 | 0; //@line 2265
     if ($67 >>> 0 < 10) {
      $71 = $67; //@line 2268
      $x$082 = 0; //@line 2268
      while (1) {
       $70 = ($x$082 * 10 | 0) + $71 | 0; //@line 2271
       $72 = HEAP32[$3 >> 2] | 0; //@line 2272
       if ($72 >>> 0 < (HEAP32[$4 >> 2] | 0) >>> 0) {
        HEAP32[$3 >> 2] = $72 + 1; //@line 2277
        $c$2$be = HEAPU8[$72 >> 0] | 0; //@line 2280
       } else {
        $c$2$be = ___shgetc($f) | 0; //@line 2283
       }
       $71 = $c$2$be + -48 | 0; //@line 2285
       if (!($71 >>> 0 < 10 & $70 >>> 0 < 429496729)) {
        $$lcssa134 = $70; //@line 2292
        $c$2$be$lcssa = $c$2$be; //@line 2292
        break;
       } else {
        $x$082 = $70; //@line 2290
       }
      }
      $288 = $$lcssa134; //@line 2296
      $289 = 0; //@line 2296
      $c$2$lcssa = $c$2$be$lcssa; //@line 2296
     } else {
      $288 = 0; //@line 2298
      $289 = 0; //@line 2298
      $c$2$lcssa = $c$1; //@line 2298
     }
     $83 = $c$2$lcssa + -48 | 0; //@line 2300
     if ($83 >>> 0 < 10) {
      $85 = $288; //@line 2303
      $86 = $289; //@line 2303
      $90 = $83; //@line 2303
      $c$371 = $c$2$lcssa; //@line 2303
      while (1) {
       $87 = ___muldi3($85 | 0, $86 | 0, 10, 0) | 0; //@line 2305
       $88 = tempRet0; //@line 2306
       $91 = (($90 | 0) < 0) << 31 >> 31; //@line 2308
       $93 = ~$91; //@line 2310
       if ($88 >>> 0 > $93 >>> 0 | ($88 | 0) == ($93 | 0) & $87 >>> 0 > ~$90 >>> 0) {
        $$lcssa = $90; //@line 2317
        $290 = $85; //@line 2317
        $291 = $86; //@line 2317
        $c$3$lcssa = $c$371; //@line 2317
        break;
       }
       $99 = _i64Add($87 | 0, $88 | 0, $90 | 0, $91 | 0) | 0; //@line 2320
       $100 = tempRet0; //@line 2321
       $101 = HEAP32[$3 >> 2] | 0; //@line 2322
       if ($101 >>> 0 < (HEAP32[$4 >> 2] | 0) >>> 0) {
        HEAP32[$3 >> 2] = $101 + 1; //@line 2327
        $c$3$be = HEAPU8[$101 >> 0] | 0; //@line 2330
       } else {
        $c$3$be = ___shgetc($f) | 0; //@line 2333
       }
       $108 = $c$3$be + -48 | 0; //@line 2335
       if ($108 >>> 0 < 10 & ($100 >>> 0 < 429496729 | ($100 | 0) == 429496729 & $99 >>> 0 < 2576980378)) {
        $85 = $99; //@line 2344
        $86 = $100; //@line 2344
        $90 = $108; //@line 2344
        $c$371 = $c$3$be; //@line 2344
       } else {
        $$lcssa = $108; //@line 2346
        $290 = $99; //@line 2346
        $291 = $100; //@line 2346
        $c$3$lcssa = $c$3$be; //@line 2346
        break;
       }
      }
      if ($$lcssa >>> 0 > 9) {
       $260 = $291; //@line 2352
       $262 = $290; //@line 2352
       $neg$1 = $neg$0; //@line 2352
      } else {
       $$122 = 10; //@line 2354
       $292 = $290; //@line 2354
       $293 = $291; //@line 2354
       $c$8 = $c$3$lcssa; //@line 2354
       label = 72; //@line 2355
      }
     } else {
      $260 = $289; //@line 2358
      $262 = $288; //@line 2358
      $neg$1 = $neg$0; //@line 2358
     }
    } else {
     $$123 = $$1; //@line 2361
     $c$124 = $c$1; //@line 2361
     label = 46; //@line 2362
    }
   }
   L63 : do {
    if ((label | 0) == 46) {
     if (!($$123 + -1 & $$123)) {
      $128 = HEAP8[3830 + (($$123 * 23 | 0) >>> 5 & 7) >> 0] | 0; //@line 2376
      $130 = HEAP8[3573 + ($c$124 + 1) >> 0] | 0; //@line 2379
      $131 = $130 & 255; //@line 2380
      if ($131 >>> 0 < $$123 >>> 0) {
       $135 = $131; //@line 2383
       $x$146 = 0; //@line 2383
       while (1) {
        $134 = $135 | $x$146 << $128; //@line 2386
        $136 = HEAP32[$3 >> 2] | 0; //@line 2387
        if ($136 >>> 0 < (HEAP32[$4 >> 2] | 0) >>> 0) {
         HEAP32[$3 >> 2] = $136 + 1; //@line 2392
         $c$4$be = HEAPU8[$136 >> 0] | 0; //@line 2395
        } else {
         $c$4$be = ___shgetc($f) | 0; //@line 2398
        }
        $144 = HEAP8[3573 + ($c$4$be + 1) >> 0] | 0; //@line 2402
        $135 = $144 & 255; //@line 2403
        if (!($134 >>> 0 < 134217728 & $135 >>> 0 < $$123 >>> 0)) {
         $$lcssa130 = $134; //@line 2410
         $$lcssa131 = $144; //@line 2410
         $c$4$be$lcssa = $c$4$be; //@line 2410
         break;
        } else {
         $x$146 = $134; //@line 2408
        }
       }
       $152 = $$lcssa131; //@line 2414
       $155 = 0; //@line 2414
       $157 = $$lcssa130; //@line 2414
       $c$4$lcssa = $c$4$be$lcssa; //@line 2414
      } else {
       $152 = $130; //@line 2416
       $155 = 0; //@line 2416
       $157 = 0; //@line 2416
       $c$4$lcssa = $c$124; //@line 2416
      }
      $149 = _bitshift64Lshr(-1, -1, $128 | 0) | 0; //@line 2418
      $150 = tempRet0; //@line 2419
      if (($152 & 255) >>> 0 >= $$123 >>> 0 | ($155 >>> 0 > $150 >>> 0 | ($155 | 0) == ($150 | 0) & $157 >>> 0 > $149 >>> 0)) {
       $$122 = $$123; //@line 2429
       $292 = $157; //@line 2429
       $293 = $155; //@line 2429
       $c$8 = $c$4$lcssa; //@line 2429
       label = 72; //@line 2430
       break;
      } else {
       $161 = $157; //@line 2433
       $162 = $155; //@line 2433
       $166 = $152; //@line 2433
      }
      while (1) {
       $163 = _bitshift64Shl($161 | 0, $162 | 0, $128 | 0) | 0; //@line 2436
       $164 = tempRet0; //@line 2437
       $167 = $166 & 255 | $163; //@line 2439
       $168 = HEAP32[$3 >> 2] | 0; //@line 2440
       if ($168 >>> 0 < (HEAP32[$4 >> 2] | 0) >>> 0) {
        HEAP32[$3 >> 2] = $168 + 1; //@line 2445
        $c$5$be = HEAPU8[$168 >> 0] | 0; //@line 2448
       } else {
        $c$5$be = ___shgetc($f) | 0; //@line 2451
       }
       $166 = HEAP8[3573 + ($c$5$be + 1) >> 0] | 0; //@line 2455
       if (($166 & 255) >>> 0 >= $$123 >>> 0 | ($164 >>> 0 > $150 >>> 0 | ($164 | 0) == ($150 | 0) & $167 >>> 0 > $149 >>> 0)) {
        $$122 = $$123; //@line 2465
        $292 = $167; //@line 2465
        $293 = $164; //@line 2465
        $c$8 = $c$5$be; //@line 2465
        label = 72; //@line 2466
        break L63;
       } else {
        $161 = $167; //@line 2469
        $162 = $164; //@line 2469
       }
      }
     }
     $120 = HEAP8[3573 + ($c$124 + 1) >> 0] | 0; //@line 2475
     $121 = $120 & 255; //@line 2476
     if ($121 >>> 0 < $$123 >>> 0) {
      $186 = $121; //@line 2479
      $x$266 = 0; //@line 2479
      while (1) {
       $185 = $186 + (Math_imul($x$266, $$123) | 0) | 0; //@line 2482
       $187 = HEAP32[$3 >> 2] | 0; //@line 2483
       if ($187 >>> 0 < (HEAP32[$4 >> 2] | 0) >>> 0) {
        HEAP32[$3 >> 2] = $187 + 1; //@line 2488
        $c$6$be = HEAPU8[$187 >> 0] | 0; //@line 2491
       } else {
        $c$6$be = ___shgetc($f) | 0; //@line 2494
       }
       $195 = HEAP8[3573 + ($c$6$be + 1) >> 0] | 0; //@line 2498
       $186 = $195 & 255; //@line 2499
       if (!($185 >>> 0 < 119304647 & $186 >>> 0 < $$123 >>> 0)) {
        $$lcssa132 = $185; //@line 2506
        $$lcssa133 = $195; //@line 2506
        $c$6$be$lcssa = $c$6$be; //@line 2506
        break;
       } else {
        $x$266 = $185; //@line 2504
       }
      }
      $201 = $$lcssa133; //@line 2510
      $294 = $$lcssa132; //@line 2510
      $295 = 0; //@line 2510
      $c$6$lcssa = $c$6$be$lcssa; //@line 2510
     } else {
      $201 = $120; //@line 2512
      $294 = 0; //@line 2512
      $295 = 0; //@line 2512
      $c$6$lcssa = $c$124; //@line 2512
     }
     if (($201 & 255) >>> 0 < $$123 >>> 0) {
      $203 = ___udivdi3(-1, -1, $$123 | 0, 0) | 0; //@line 2517
      $204 = tempRet0; //@line 2518
      $206 = $295; //@line 2519
      $208 = $294; //@line 2519
      $215 = $201; //@line 2519
      $c$753 = $c$6$lcssa; //@line 2519
      while (1) {
       if ($206 >>> 0 > $204 >>> 0 | ($206 | 0) == ($204 | 0) & $208 >>> 0 > $203 >>> 0) {
        $$122 = $$123; //@line 2527
        $292 = $208; //@line 2527
        $293 = $206; //@line 2527
        $c$8 = $c$753; //@line 2527
        label = 72; //@line 2528
        break L63;
       }
       $212 = ___muldi3($208 | 0, $206 | 0, $$123 | 0, 0) | 0; //@line 2531
       $213 = tempRet0; //@line 2532
       $214 = $215 & 255; //@line 2533
       if ($213 >>> 0 > 4294967295 | ($213 | 0) == -1 & $212 >>> 0 > ~$214 >>> 0) {
        $$122 = $$123; //@line 2541
        $292 = $208; //@line 2541
        $293 = $206; //@line 2541
        $c$8 = $c$753; //@line 2541
        label = 72; //@line 2542
        break L63;
       }
       $222 = _i64Add($214 | 0, 0, $212 | 0, $213 | 0) | 0; //@line 2545
       $223 = tempRet0; //@line 2546
       $224 = HEAP32[$3 >> 2] | 0; //@line 2547
       if ($224 >>> 0 < (HEAP32[$4 >> 2] | 0) >>> 0) {
        HEAP32[$3 >> 2] = $224 + 1; //@line 2552
        $c$7$be = HEAPU8[$224 >> 0] | 0; //@line 2555
       } else {
        $c$7$be = ___shgetc($f) | 0; //@line 2558
       }
       $215 = HEAP8[3573 + ($c$7$be + 1) >> 0] | 0; //@line 2562
       if (($215 & 255) >>> 0 >= $$123 >>> 0) {
        $$122 = $$123; //@line 2568
        $292 = $222; //@line 2568
        $293 = $223; //@line 2568
        $c$8 = $c$7$be; //@line 2568
        label = 72; //@line 2569
        break;
       } else {
        $206 = $223; //@line 2566
        $208 = $222; //@line 2566
        $c$753 = $c$7$be; //@line 2566
       }
      }
     } else {
      $$122 = $$123; //@line 2574
      $292 = $294; //@line 2574
      $293 = $295; //@line 2574
      $c$8 = $c$6$lcssa; //@line 2574
      label = 72; //@line 2575
     }
    }
   } while (0);
   if ((label | 0) == 72) {
    if ((HEAPU8[3573 + ($c$8 + 1) >> 0] | 0) >>> 0 < $$122 >>> 0) {
     do {
      $239 = HEAP32[$3 >> 2] | 0; //@line 2587
      if ($239 >>> 0 < (HEAP32[$4 >> 2] | 0) >>> 0) {
       HEAP32[$3 >> 2] = $239 + 1; //@line 2592
       $c$9$be = HEAPU8[$239 >> 0] | 0; //@line 2595
      } else {
       $c$9$be = ___shgetc($f) | 0; //@line 2598
      }
     } while ((HEAPU8[3573 + ($c$9$be + 1) >> 0] | 0) >>> 0 < $$122 >>> 0);
     HEAP32[(___errno_location() | 0) >> 2] = 34; //@line 2610
     $260 = $1; //@line 2616
     $262 = $0; //@line 2616
     $neg$1 = ($0 & 1 | 0) == 0 & 0 == 0 ? $neg$0 : 0; //@line 2616
    } else {
     $260 = $293; //@line 2618
     $262 = $292; //@line 2618
     $neg$1 = $neg$0; //@line 2618
    }
   }
   if (HEAP32[$4 >> 2] | 0) {
    HEAP32[$3 >> 2] = (HEAP32[$3 >> 2] | 0) + -1; //@line 2626
   }
   if (!($260 >>> 0 < $1 >>> 0 | ($260 | 0) == ($1 | 0) & $262 >>> 0 < $0 >>> 0)) {
    if (!(($0 & 1 | 0) != 0 | 0 != 0 | ($neg$1 | 0) != 0)) {
     HEAP32[(___errno_location() | 0) >> 2] = 34; //@line 2642
     $272 = _i64Add($0 | 0, $1 | 0, -1, -1) | 0; //@line 2643
     $286 = tempRet0; //@line 2645
     $287 = $272; //@line 2645
     break;
    }
    if ($260 >>> 0 > $1 >>> 0 | ($260 | 0) == ($1 | 0) & $262 >>> 0 > $0 >>> 0) {
     HEAP32[(___errno_location() | 0) >> 2] = 34; //@line 2655
     $286 = $1; //@line 2656
     $287 = $0; //@line 2656
     break;
    }
   }
   $281 = (($neg$1 | 0) < 0) << 31 >> 31; //@line 2661
   $284 = _i64Subtract($262 ^ $neg$1 | 0, $260 ^ $281 | 0, $neg$1 | 0, $281 | 0) | 0; //@line 2664
   $286 = tempRet0; //@line 2666
   $287 = $284; //@line 2666
  }
 } while (0);
 tempRet0 = $286; //@line 2669
 return $287 | 0; //@line 2670
}
function ___udivmoddi4($a$0, $a$1, $b$0, $b$1, $rem) {
 $a$0 = $a$0 | 0;
 $a$1 = $a$1 | 0;
 $b$0 = $b$0 | 0;
 $b$1 = $b$1 | 0;
 $rem = $rem | 0;
 var $n_sroa_0_0_extract_trunc = 0, $n_sroa_1_4_extract_shift$0 = 0, $n_sroa_1_4_extract_trunc = 0, $d_sroa_0_0_extract_trunc = 0, $d_sroa_1_4_extract_shift$0 = 0, $d_sroa_1_4_extract_trunc = 0, $4 = 0, $17 = 0, $37 = 0, $51 = 0, $57 = 0, $58 = 0, $66 = 0, $78 = 0, $88 = 0, $89 = 0, $91 = 0, $92 = 0, $95 = 0, $105 = 0, $119 = 0, $125 = 0, $126 = 0, $130 = 0, $q_sroa_1_1_ph = 0, $q_sroa_0_1_ph = 0, $r_sroa_1_1_ph = 0, $r_sroa_0_1_ph = 0, $sr_1_ph = 0, $d_sroa_0_0_insert_insert99$0 = 0, $d_sroa_0_0_insert_insert99$1 = 0, $137$0 = 0, $137$1 = 0, $carry_0203 = 0, $sr_1202 = 0, $r_sroa_0_1201 = 0, $r_sroa_1_1200 = 0, $q_sroa_0_1199 = 0, $q_sroa_1_1198 = 0, $r_sroa_0_0_insert_insert42$0 = 0, $r_sroa_0_0_insert_insert42$1 = 0, $150$1 = 0, $151$0 = 0, $carry_0_lcssa$0 = 0, $carry_0_lcssa$1 = 0, $r_sroa_0_1_lcssa = 0, $r_sroa_1_1_lcssa = 0, $q_sroa_0_1_lcssa = 0, $q_sroa_1_1_lcssa = 0, $q_sroa_0_0_insert_ext75$0 = 0, $q_sroa_0_0_insert_ext75$1 = 0, $_0$0 = 0, $_0$1 = 0, $q_sroa_1_1198$looptemp = 0;
 $n_sroa_0_0_extract_trunc = $a$0; //@line 14560
 $n_sroa_1_4_extract_shift$0 = $a$1; //@line 14561
 $n_sroa_1_4_extract_trunc = $n_sroa_1_4_extract_shift$0; //@line 14562
 $d_sroa_0_0_extract_trunc = $b$0; //@line 14563
 $d_sroa_1_4_extract_shift$0 = $b$1; //@line 14564
 $d_sroa_1_4_extract_trunc = $d_sroa_1_4_extract_shift$0; //@line 14565
 if (!$n_sroa_1_4_extract_trunc) {
  $4 = ($rem | 0) != 0; //@line 14567
  if (!$d_sroa_1_4_extract_trunc) {
   if ($4) {
    HEAP32[$rem >> 2] = ($n_sroa_0_0_extract_trunc >>> 0) % ($d_sroa_0_0_extract_trunc >>> 0); //@line 14570
    HEAP32[$rem + 4 >> 2] = 0; //@line 14571
   }
   $_0$1 = 0; //@line 14573
   $_0$0 = ($n_sroa_0_0_extract_trunc >>> 0) / ($d_sroa_0_0_extract_trunc >>> 0) >>> 0; //@line 14574
   return (tempRet0 = $_0$1, $_0$0) | 0; //@line 14575
  } else {
   if (!$4) {
    $_0$1 = 0; //@line 14578
    $_0$0 = 0; //@line 14579
    return (tempRet0 = $_0$1, $_0$0) | 0; //@line 14580
   }
   HEAP32[$rem >> 2] = $a$0 | 0; //@line 14582
   HEAP32[$rem + 4 >> 2] = $a$1 & 0; //@line 14583
   $_0$1 = 0; //@line 14584
   $_0$0 = 0; //@line 14585
   return (tempRet0 = $_0$1, $_0$0) | 0; //@line 14586
  }
 }
 $17 = ($d_sroa_1_4_extract_trunc | 0) == 0; //@line 14589
 do {
  if (!$d_sroa_0_0_extract_trunc) {
   if ($17) {
    if ($rem) {
     HEAP32[$rem >> 2] = ($n_sroa_1_4_extract_trunc >>> 0) % ($d_sroa_0_0_extract_trunc >>> 0); //@line 14594
     HEAP32[$rem + 4 >> 2] = 0; //@line 14595
    }
    $_0$1 = 0; //@line 14597
    $_0$0 = ($n_sroa_1_4_extract_trunc >>> 0) / ($d_sroa_0_0_extract_trunc >>> 0) >>> 0; //@line 14598
    return (tempRet0 = $_0$1, $_0$0) | 0; //@line 14599
   }
   if (!$n_sroa_0_0_extract_trunc) {
    if ($rem) {
     HEAP32[$rem >> 2] = 0; //@line 14603
     HEAP32[$rem + 4 >> 2] = ($n_sroa_1_4_extract_trunc >>> 0) % ($d_sroa_1_4_extract_trunc >>> 0); //@line 14604
    }
    $_0$1 = 0; //@line 14606
    $_0$0 = ($n_sroa_1_4_extract_trunc >>> 0) / ($d_sroa_1_4_extract_trunc >>> 0) >>> 0; //@line 14607
    return (tempRet0 = $_0$1, $_0$0) | 0; //@line 14608
   }
   $37 = $d_sroa_1_4_extract_trunc - 1 | 0; //@line 14610
   if (!($37 & $d_sroa_1_4_extract_trunc)) {
    if ($rem) {
     HEAP32[$rem >> 2] = $a$0 | 0; //@line 14613
     HEAP32[$rem + 4 >> 2] = $37 & $n_sroa_1_4_extract_trunc | $a$1 & 0; //@line 14614
    }
    $_0$1 = 0; //@line 14616
    $_0$0 = $n_sroa_1_4_extract_trunc >>> ((_llvm_cttz_i32($d_sroa_1_4_extract_trunc | 0) | 0) >>> 0); //@line 14617
    return (tempRet0 = $_0$1, $_0$0) | 0; //@line 14618
   }
   $51 = (Math_clz32($d_sroa_1_4_extract_trunc | 0) | 0) - (Math_clz32($n_sroa_1_4_extract_trunc | 0) | 0) | 0; //@line 14621
   if ($51 >>> 0 <= 30) {
    $57 = $51 + 1 | 0; //@line 14623
    $58 = 31 - $51 | 0; //@line 14624
    $sr_1_ph = $57; //@line 14625
    $r_sroa_0_1_ph = $n_sroa_1_4_extract_trunc << $58 | $n_sroa_0_0_extract_trunc >>> ($57 >>> 0); //@line 14626
    $r_sroa_1_1_ph = $n_sroa_1_4_extract_trunc >>> ($57 >>> 0); //@line 14627
    $q_sroa_0_1_ph = 0; //@line 14628
    $q_sroa_1_1_ph = $n_sroa_0_0_extract_trunc << $58; //@line 14629
    break;
   }
   if (!$rem) {
    $_0$1 = 0; //@line 14633
    $_0$0 = 0; //@line 14634
    return (tempRet0 = $_0$1, $_0$0) | 0; //@line 14635
   }
   HEAP32[$rem >> 2] = $a$0 | 0; //@line 14637
   HEAP32[$rem + 4 >> 2] = $n_sroa_1_4_extract_shift$0 | $a$1 & 0; //@line 14638
   $_0$1 = 0; //@line 14639
   $_0$0 = 0; //@line 14640
   return (tempRet0 = $_0$1, $_0$0) | 0; //@line 14641
  } else {
   if (!$17) {
    $119 = (Math_clz32($d_sroa_1_4_extract_trunc | 0) | 0) - (Math_clz32($n_sroa_1_4_extract_trunc | 0) | 0) | 0; //@line 14645
    if ($119 >>> 0 <= 31) {
     $125 = $119 + 1 | 0; //@line 14647
     $126 = 31 - $119 | 0; //@line 14648
     $130 = $119 - 31 >> 31; //@line 14649
     $sr_1_ph = $125; //@line 14650
     $r_sroa_0_1_ph = $n_sroa_0_0_extract_trunc >>> ($125 >>> 0) & $130 | $n_sroa_1_4_extract_trunc << $126; //@line 14651
     $r_sroa_1_1_ph = $n_sroa_1_4_extract_trunc >>> ($125 >>> 0) & $130; //@line 14652
     $q_sroa_0_1_ph = 0; //@line 14653
     $q_sroa_1_1_ph = $n_sroa_0_0_extract_trunc << $126; //@line 14654
     break;
    }
    if (!$rem) {
     $_0$1 = 0; //@line 14658
     $_0$0 = 0; //@line 14659
     return (tempRet0 = $_0$1, $_0$0) | 0; //@line 14660
    }
    HEAP32[$rem >> 2] = $a$0 | 0; //@line 14662
    HEAP32[$rem + 4 >> 2] = $n_sroa_1_4_extract_shift$0 | $a$1 & 0; //@line 14663
    $_0$1 = 0; //@line 14664
    $_0$0 = 0; //@line 14665
    return (tempRet0 = $_0$1, $_0$0) | 0; //@line 14666
   }
   $66 = $d_sroa_0_0_extract_trunc - 1 | 0; //@line 14668
   if ($66 & $d_sroa_0_0_extract_trunc) {
    $88 = (Math_clz32($d_sroa_0_0_extract_trunc | 0) | 0) + 33 - (Math_clz32($n_sroa_1_4_extract_trunc | 0) | 0) | 0; //@line 14671
    $89 = 64 - $88 | 0; //@line 14672
    $91 = 32 - $88 | 0; //@line 14673
    $92 = $91 >> 31; //@line 14674
    $95 = $88 - 32 | 0; //@line 14675
    $105 = $95 >> 31; //@line 14676
    $sr_1_ph = $88; //@line 14677
    $r_sroa_0_1_ph = $91 - 1 >> 31 & $n_sroa_1_4_extract_trunc >>> ($95 >>> 0) | ($n_sroa_1_4_extract_trunc << $91 | $n_sroa_0_0_extract_trunc >>> ($88 >>> 0)) & $105; //@line 14678
    $r_sroa_1_1_ph = $105 & $n_sroa_1_4_extract_trunc >>> ($88 >>> 0); //@line 14679
    $q_sroa_0_1_ph = $n_sroa_0_0_extract_trunc << $89 & $92; //@line 14680
    $q_sroa_1_1_ph = ($n_sroa_1_4_extract_trunc << $89 | $n_sroa_0_0_extract_trunc >>> ($95 >>> 0)) & $92 | $n_sroa_0_0_extract_trunc << $91 & $88 - 33 >> 31; //@line 14681
    break;
   }
   if ($rem) {
    HEAP32[$rem >> 2] = $66 & $n_sroa_0_0_extract_trunc; //@line 14685
    HEAP32[$rem + 4 >> 2] = 0; //@line 14686
   }
   if (($d_sroa_0_0_extract_trunc | 0) == 1) {
    $_0$1 = $n_sroa_1_4_extract_shift$0 | $a$1 & 0; //@line 14689
    $_0$0 = $a$0 | 0 | 0; //@line 14690
    return (tempRet0 = $_0$1, $_0$0) | 0; //@line 14691
   } else {
    $78 = _llvm_cttz_i32($d_sroa_0_0_extract_trunc | 0) | 0; //@line 14693
    $_0$1 = $n_sroa_1_4_extract_trunc >>> ($78 >>> 0) | 0; //@line 14694
    $_0$0 = $n_sroa_1_4_extract_trunc << 32 - $78 | $n_sroa_0_0_extract_trunc >>> ($78 >>> 0) | 0; //@line 14695
    return (tempRet0 = $_0$1, $_0$0) | 0; //@line 14696
   }
  }
 } while (0);
 if (!$sr_1_ph) {
  $q_sroa_1_1_lcssa = $q_sroa_1_1_ph; //@line 14701
  $q_sroa_0_1_lcssa = $q_sroa_0_1_ph; //@line 14702
  $r_sroa_1_1_lcssa = $r_sroa_1_1_ph; //@line 14703
  $r_sroa_0_1_lcssa = $r_sroa_0_1_ph; //@line 14704
  $carry_0_lcssa$1 = 0; //@line 14705
  $carry_0_lcssa$0 = 0; //@line 14706
 } else {
  $d_sroa_0_0_insert_insert99$0 = $b$0 | 0 | 0; //@line 14708
  $d_sroa_0_0_insert_insert99$1 = $d_sroa_1_4_extract_shift$0 | $b$1 & 0; //@line 14709
  $137$0 = _i64Add($d_sroa_0_0_insert_insert99$0 | 0, $d_sroa_0_0_insert_insert99$1 | 0, -1, -1) | 0; //@line 14710
  $137$1 = tempRet0; //@line 14711
  $q_sroa_1_1198 = $q_sroa_1_1_ph; //@line 14712
  $q_sroa_0_1199 = $q_sroa_0_1_ph; //@line 14713
  $r_sroa_1_1200 = $r_sroa_1_1_ph; //@line 14714
  $r_sroa_0_1201 = $r_sroa_0_1_ph; //@line 14715
  $sr_1202 = $sr_1_ph; //@line 14716
  $carry_0203 = 0; //@line 14717
  do {
   $q_sroa_1_1198$looptemp = $q_sroa_1_1198;
   $q_sroa_1_1198 = $q_sroa_0_1199 >>> 31 | $q_sroa_1_1198 << 1; //@line 14719
   $q_sroa_0_1199 = $carry_0203 | $q_sroa_0_1199 << 1; //@line 14720
   $r_sroa_0_0_insert_insert42$0 = $r_sroa_0_1201 << 1 | $q_sroa_1_1198$looptemp >>> 31 | 0; //@line 14721
   $r_sroa_0_0_insert_insert42$1 = $r_sroa_0_1201 >>> 31 | $r_sroa_1_1200 << 1 | 0; //@line 14722
   _i64Subtract($137$0, $137$1, $r_sroa_0_0_insert_insert42$0, $r_sroa_0_0_insert_insert42$1) | 0; //@line 14723
   $150$1 = tempRet0; //@line 14724
   $151$0 = $150$1 >> 31 | (($150$1 | 0) < 0 ? -1 : 0) << 1; //@line 14725
   $carry_0203 = $151$0 & 1; //@line 14726
   $r_sroa_0_1201 = _i64Subtract($r_sroa_0_0_insert_insert42$0, $r_sroa_0_0_insert_insert42$1, $151$0 & $d_sroa_0_0_insert_insert99$0, ((($150$1 | 0) < 0 ? -1 : 0) >> 31 | (($150$1 | 0) < 0 ? -1 : 0) << 1) & $d_sroa_0_0_insert_insert99$1) | 0; //@line 14728
   $r_sroa_1_1200 = tempRet0; //@line 14729
   $sr_1202 = $sr_1202 - 1 | 0; //@line 14730
  } while (($sr_1202 | 0) != 0);
  $q_sroa_1_1_lcssa = $q_sroa_1_1198; //@line 14742
  $q_sroa_0_1_lcssa = $q_sroa_0_1199; //@line 14743
  $r_sroa_1_1_lcssa = $r_sroa_1_1200; //@line 14744
  $r_sroa_0_1_lcssa = $r_sroa_0_1201; //@line 14745
  $carry_0_lcssa$1 = 0; //@line 14746
  $carry_0_lcssa$0 = $carry_0203; //@line 14747
 }
 $q_sroa_0_0_insert_ext75$0 = $q_sroa_0_1_lcssa; //@line 14749
 $q_sroa_0_0_insert_ext75$1 = 0; //@line 14750
 if ($rem) {
  HEAP32[$rem >> 2] = $r_sroa_0_1_lcssa; //@line 14753
  HEAP32[$rem + 4 >> 2] = $r_sroa_1_1_lcssa; //@line 14754
 }
 $_0$1 = ($q_sroa_0_0_insert_ext75$0 | 0) >>> 31 | ($q_sroa_1_1_lcssa | $q_sroa_0_0_insert_ext75$1) << 1 | ($q_sroa_0_0_insert_ext75$1 << 1 | $q_sroa_0_0_insert_ext75$0 >>> 31) & 0 | $carry_0_lcssa$1; //@line 14756
 $_0$0 = ($q_sroa_0_0_insert_ext75$0 << 1 | 0 >>> 31) & -2 | $carry_0_lcssa$0; //@line 14757
 return (tempRet0 = $_0$1, $_0$0) | 0; //@line 14758
}
function _try_realloc_chunk($p, $nb) {
 $p = $p | 0;
 $nb = $nb | 0;
 var $$pre$phiZ2D = 0, $0 = 0, $1 = 0, $101 = 0, $103 = 0, $106 = 0, $109 = 0, $110 = 0, $112 = 0, $113 = 0, $115 = 0, $116 = 0, $118 = 0, $119 = 0, $124 = 0, $125 = 0, $134 = 0, $139 = 0, $143 = 0, $149 = 0, $159 = 0, $168 = 0, $2 = 0, $20 = 0, $3 = 0, $33 = 0, $35 = 0, $4 = 0, $45 = 0, $47 = 0, $5 = 0, $56 = 0, $62 = 0, $68 = 0, $7 = 0, $70 = 0, $71 = 0, $74 = 0, $76 = 0, $78 = 0, $8 = 0, $91 = 0, $96 = 0, $98 = 0, $R$0 = 0, $R$0$lcssa = 0, $R$1 = 0, $RP$0 = 0, $RP$0$lcssa = 0, $newp$0 = 0, $storemerge = 0, $storemerge21 = 0;
 $0 = $p + 4 | 0; //@line 13139
 $1 = HEAP32[$0 >> 2] | 0; //@line 13140
 $2 = $1 & -8; //@line 13141
 $3 = $p + $2 | 0; //@line 13142
 $4 = HEAP32[195] | 0; //@line 13143
 $5 = $1 & 3; //@line 13144
 if (!(($5 | 0) != 1 & $p >>> 0 >= $4 >>> 0 & $p >>> 0 < $3 >>> 0)) {
  _abort(); //@line 13151
 }
 $7 = $p + ($2 | 4) | 0; //@line 13155
 $8 = HEAP32[$7 >> 2] | 0; //@line 13156
 if (!($8 & 1)) {
  _abort(); //@line 13160
 }
 if (!$5) {
  if ($nb >>> 0 < 256) {
   $newp$0 = 0; //@line 13167
   return $newp$0 | 0; //@line 13168
  }
  if ($2 >>> 0 >= ($nb + 4 | 0) >>> 0) {
   if (($2 - $nb | 0) >>> 0 <= HEAP32[311] << 1 >>> 0) {
    $newp$0 = $p; //@line 13178
    return $newp$0 | 0; //@line 13179
   }
  }
  $newp$0 = 0; //@line 13182
  return $newp$0 | 0; //@line 13183
 }
 if ($2 >>> 0 >= $nb >>> 0) {
  $20 = $2 - $nb | 0; //@line 13187
  if ($20 >>> 0 <= 15) {
   $newp$0 = $p; //@line 13190
   return $newp$0 | 0; //@line 13191
  }
  HEAP32[$0 >> 2] = $1 & 1 | $nb | 2; //@line 13197
  HEAP32[$p + ($nb + 4) >> 2] = $20 | 3; //@line 13201
  HEAP32[$7 >> 2] = HEAP32[$7 >> 2] | 1; //@line 13204
  _dispose_chunk($p + $nb | 0, $20); //@line 13205
  $newp$0 = $p; //@line 13206
  return $newp$0 | 0; //@line 13207
 }
 if (($3 | 0) == (HEAP32[197] | 0)) {
  $33 = (HEAP32[194] | 0) + $2 | 0; //@line 13213
  if ($33 >>> 0 <= $nb >>> 0) {
   $newp$0 = 0; //@line 13216
   return $newp$0 | 0; //@line 13217
  }
  $35 = $33 - $nb | 0; //@line 13219
  HEAP32[$0 >> 2] = $1 & 1 | $nb | 2; //@line 13224
  HEAP32[$p + ($nb + 4) >> 2] = $35 | 1; //@line 13228
  HEAP32[197] = $p + $nb; //@line 13229
  HEAP32[194] = $35; //@line 13230
  $newp$0 = $p; //@line 13231
  return $newp$0 | 0; //@line 13232
 }
 if (($3 | 0) == (HEAP32[196] | 0)) {
  $45 = (HEAP32[193] | 0) + $2 | 0; //@line 13238
  if ($45 >>> 0 < $nb >>> 0) {
   $newp$0 = 0; //@line 13241
   return $newp$0 | 0; //@line 13242
  }
  $47 = $45 - $nb | 0; //@line 13244
  if ($47 >>> 0 > 15) {
   HEAP32[$0 >> 2] = $1 & 1 | $nb | 2; //@line 13252
   HEAP32[$p + ($nb + 4) >> 2] = $47 | 1; //@line 13256
   HEAP32[$p + $45 >> 2] = $47; //@line 13257
   $56 = $p + ($45 + 4) | 0; //@line 13259
   HEAP32[$56 >> 2] = HEAP32[$56 >> 2] & -2; //@line 13262
   $storemerge = $p + $nb | 0; //@line 13263
   $storemerge21 = $47; //@line 13263
  } else {
   HEAP32[$0 >> 2] = $1 & 1 | $45 | 2; //@line 13268
   $62 = $p + ($45 + 4) | 0; //@line 13270
   HEAP32[$62 >> 2] = HEAP32[$62 >> 2] | 1; //@line 13273
   $storemerge = 0; //@line 13274
   $storemerge21 = 0; //@line 13274
  }
  HEAP32[193] = $storemerge21; //@line 13276
  HEAP32[196] = $storemerge; //@line 13277
  $newp$0 = $p; //@line 13278
  return $newp$0 | 0; //@line 13279
 }
 if ($8 & 2) {
  $newp$0 = 0; //@line 13284
  return $newp$0 | 0; //@line 13285
 }
 $68 = ($8 & -8) + $2 | 0; //@line 13288
 if ($68 >>> 0 < $nb >>> 0) {
  $newp$0 = 0; //@line 13291
  return $newp$0 | 0; //@line 13292
 }
 $70 = $68 - $nb | 0; //@line 13294
 $71 = $8 >>> 3; //@line 13295
 do {
  if ($8 >>> 0 < 256) {
   $74 = HEAP32[$p + ($2 + 8) >> 2] | 0; //@line 13301
   $76 = HEAP32[$p + ($2 + 12) >> 2] | 0; //@line 13304
   $78 = 804 + ($71 << 1 << 2) | 0; //@line 13306
   if (($74 | 0) != ($78 | 0)) {
    if ($74 >>> 0 < $4 >>> 0) {
     _abort(); //@line 13311
    }
    if ((HEAP32[$74 + 12 >> 2] | 0) != ($3 | 0)) {
     _abort(); //@line 13318
    }
   }
   if (($76 | 0) == ($74 | 0)) {
    HEAP32[191] = HEAP32[191] & ~(1 << $71); //@line 13328
    break;
   }
   if (($76 | 0) == ($78 | 0)) {
    $$pre$phiZ2D = $76 + 8 | 0; //@line 13334
   } else {
    if ($76 >>> 0 < $4 >>> 0) {
     _abort(); //@line 13338
    }
    $91 = $76 + 8 | 0; //@line 13341
    if ((HEAP32[$91 >> 2] | 0) == ($3 | 0)) {
     $$pre$phiZ2D = $91; //@line 13345
    } else {
     _abort(); //@line 13347
    }
   }
   HEAP32[$74 + 12 >> 2] = $76; //@line 13352
   HEAP32[$$pre$phiZ2D >> 2] = $74; //@line 13353
  } else {
   $96 = HEAP32[$p + ($2 + 24) >> 2] | 0; //@line 13357
   $98 = HEAP32[$p + ($2 + 12) >> 2] | 0; //@line 13360
   do {
    if (($98 | 0) == ($3 | 0)) {
     $109 = $p + ($2 + 20) | 0; //@line 13365
     $110 = HEAP32[$109 >> 2] | 0; //@line 13366
     if (!$110) {
      $112 = $p + ($2 + 16) | 0; //@line 13370
      $113 = HEAP32[$112 >> 2] | 0; //@line 13371
      if (!$113) {
       $R$1 = 0; //@line 13374
       break;
      } else {
       $R$0 = $113; //@line 13377
       $RP$0 = $112; //@line 13377
      }
     } else {
      $R$0 = $110; //@line 13380
      $RP$0 = $109; //@line 13380
     }
     while (1) {
      $115 = $R$0 + 20 | 0; //@line 13383
      $116 = HEAP32[$115 >> 2] | 0; //@line 13384
      if ($116) {
       $R$0 = $116; //@line 13387
       $RP$0 = $115; //@line 13387
       continue;
      }
      $118 = $R$0 + 16 | 0; //@line 13390
      $119 = HEAP32[$118 >> 2] | 0; //@line 13391
      if (!$119) {
       $R$0$lcssa = $R$0; //@line 13394
       $RP$0$lcssa = $RP$0; //@line 13394
       break;
      } else {
       $R$0 = $119; //@line 13397
       $RP$0 = $118; //@line 13397
      }
     }
     if ($RP$0$lcssa >>> 0 < $4 >>> 0) {
      _abort(); //@line 13402
     } else {
      HEAP32[$RP$0$lcssa >> 2] = 0; //@line 13405
      $R$1 = $R$0$lcssa; //@line 13406
      break;
     }
    } else {
     $101 = HEAP32[$p + ($2 + 8) >> 2] | 0; //@line 13412
     if ($101 >>> 0 < $4 >>> 0) {
      _abort(); //@line 13415
     }
     $103 = $101 + 12 | 0; //@line 13418
     if ((HEAP32[$103 >> 2] | 0) != ($3 | 0)) {
      _abort(); //@line 13422
     }
     $106 = $98 + 8 | 0; //@line 13425
     if ((HEAP32[$106 >> 2] | 0) == ($3 | 0)) {
      HEAP32[$103 >> 2] = $98; //@line 13429
      HEAP32[$106 >> 2] = $101; //@line 13430
      $R$1 = $98; //@line 13431
      break;
     } else {
      _abort(); //@line 13434
     }
    }
   } while (0);
   if ($96) {
    $124 = HEAP32[$p + ($2 + 28) >> 2] | 0; //@line 13443
    $125 = 1068 + ($124 << 2) | 0; //@line 13444
    if (($3 | 0) == (HEAP32[$125 >> 2] | 0)) {
     HEAP32[$125 >> 2] = $R$1; //@line 13448
     if (!$R$1) {
      HEAP32[192] = HEAP32[192] & ~(1 << $124); //@line 13455
      break;
     }
    } else {
     if ($96 >>> 0 < (HEAP32[195] | 0) >>> 0) {
      _abort(); //@line 13462
     }
     $134 = $96 + 16 | 0; //@line 13465
     if ((HEAP32[$134 >> 2] | 0) == ($3 | 0)) {
      HEAP32[$134 >> 2] = $R$1; //@line 13469
     } else {
      HEAP32[$96 + 20 >> 2] = $R$1; //@line 13472
     }
     if (!$R$1) {
      break;
     }
    }
    $139 = HEAP32[195] | 0; //@line 13479
    if ($R$1 >>> 0 < $139 >>> 0) {
     _abort(); //@line 13482
    }
    HEAP32[$R$1 + 24 >> 2] = $96; //@line 13486
    $143 = HEAP32[$p + ($2 + 16) >> 2] | 0; //@line 13489
    do {
     if ($143) {
      if ($143 >>> 0 < $139 >>> 0) {
       _abort(); //@line 13495
      } else {
       HEAP32[$R$1 + 16 >> 2] = $143; //@line 13499
       HEAP32[$143 + 24 >> 2] = $R$1; //@line 13501
       break;
      }
     }
    } while (0);
    $149 = HEAP32[$p + ($2 + 20) >> 2] | 0; //@line 13508
    if ($149) {
     if ($149 >>> 0 < (HEAP32[195] | 0) >>> 0) {
      _abort(); //@line 13514
     } else {
      HEAP32[$R$1 + 20 >> 2] = $149; //@line 13518
      HEAP32[$149 + 24 >> 2] = $R$1; //@line 13520
      break;
     }
    }
   }
  }
 } while (0);
 if ($70 >>> 0 < 16) {
  HEAP32[$0 >> 2] = $68 | $1 & 1 | 2; //@line 13532
  $159 = $p + ($68 | 4) | 0; //@line 13534
  HEAP32[$159 >> 2] = HEAP32[$159 >> 2] | 1; //@line 13537
  $newp$0 = $p; //@line 13538
  return $newp$0 | 0; //@line 13539
 } else {
  HEAP32[$0 >> 2] = $1 & 1 | $nb | 2; //@line 13545
  HEAP32[$p + ($nb + 4) >> 2] = $70 | 3; //@line 13549
  $168 = $p + ($68 | 4) | 0; //@line 13551
  HEAP32[$168 >> 2] = HEAP32[$168 >> 2] | 1; //@line 13554
  _dispose_chunk($p + $nb | 0, $70); //@line 13555
  $newp$0 = $p; //@line 13556
  return $newp$0 | 0; //@line 13557
 }
 return 0; //@line 13559
}
function _fmod($x, $y) {
 $x = +$x;
 $y = +$y;
 var $$0 = 0.0, $$lcssa7 = 0, $0 = 0, $1 = 0, $10 = 0, $100 = 0, $101 = 0, $102 = 0, $103 = 0, $104 = 0, $106 = 0, $107 = 0, $11 = 0, $112 = 0, $114 = 0, $116 = 0, $119 = 0, $12 = 0, $121 = 0, $126 = 0, $127 = 0, $128 = 0, $129 = 0, $130 = 0, $137 = 0, $138 = 0, $139 = 0, $140 = 0, $141 = 0, $146 = 0, $149 = 0, $150 = 0, $152 = 0, $153 = 0, $154 = 0, $155 = 0, $156 = 0, $16 = 0, $2 = 0, $23 = 0.0, $25 = 0, $26 = 0, $3 = 0, $37 = 0, $38 = 0, $4 = 0, $44 = 0, $45 = 0, $46 = 0, $55 = 0, $6 = 0, $60 = 0, $61 = 0, $67 = 0, $68 = 0, $69 = 0, $7 = 0, $78 = 0, $83 = 0, $84 = 0, $85 = 0, $86 = 0, $87 = 0, $88 = 0, $9 = 0, $93 = 0, $95 = 0, $97 = 0, $ex$0$lcssa = 0, $ex$026 = 0, $ex$1 = 0, $ex$2$lcssa = 0, $ex$212 = 0, $ex$3$lcssa = 0, $ex$39 = 0, $ey$0$lcssa = 0, $ey$020 = 0, $ey$1$ph = 0, label = 0;
 HEAPF64[tempDoublePtr >> 3] = $x; //@line 2847
 $0 = HEAP32[tempDoublePtr >> 2] | 0; //@line 2847
 $1 = HEAP32[tempDoublePtr + 4 >> 2] | 0; //@line 2848
 HEAPF64[tempDoublePtr >> 3] = $y; //@line 2849
 $2 = HEAP32[tempDoublePtr >> 2] | 0; //@line 2849
 $3 = HEAP32[tempDoublePtr + 4 >> 2] | 0; //@line 2850
 $4 = _bitshift64Lshr($0 | 0, $1 | 0, 52) | 0; //@line 2851
 $6 = $4 & 2047; //@line 2853
 $7 = _bitshift64Lshr($2 | 0, $3 | 0, 52) | 0; //@line 2854
 $9 = $7 & 2047; //@line 2856
 $10 = $1 & -2147483648; //@line 2857
 $11 = _bitshift64Shl($2 | 0, $3 | 0, 1) | 0; //@line 2858
 $12 = tempRet0; //@line 2859
 L1 : do {
  if (($11 | 0) == 0 & ($12 | 0) == 0) {
   label = 3; //@line 2865
  } else {
   $16 = $3 & 2147483647; //@line 2867
   if ($16 >>> 0 > 2146435072 | ($16 | 0) == 2146435072 & $2 >>> 0 > 0 | ($6 | 0) == 2047) {
    label = 3; //@line 2876
   } else {
    $25 = _bitshift64Shl($0 | 0, $1 | 0, 1) | 0; //@line 2878
    $26 = tempRet0; //@line 2879
    if (!($26 >>> 0 > $12 >>> 0 | ($26 | 0) == ($12 | 0) & $25 >>> 0 > $11 >>> 0)) {
     return +(($25 | 0) == ($11 | 0) & ($26 | 0) == ($12 | 0) ? $x * 0.0 : $x);
    }
    if (!$6) {
     $37 = _bitshift64Shl($0 | 0, $1 | 0, 12) | 0; //@line 2895
     $38 = tempRet0; //@line 2896
     if (($38 | 0) > -1 | ($38 | 0) == -1 & $37 >>> 0 > 4294967295) {
      $45 = $37; //@line 2903
      $46 = $38; //@line 2903
      $ex$026 = 0; //@line 2903
      while (1) {
       $44 = $ex$026 + -1 | 0; //@line 2905
       $45 = _bitshift64Shl($45 | 0, $46 | 0, 1) | 0; //@line 2906
       $46 = tempRet0; //@line 2907
       if (!(($46 | 0) > -1 | ($46 | 0) == -1 & $45 >>> 0 > 4294967295)) {
        $ex$0$lcssa = $44; //@line 2916
        break;
       } else {
        $ex$026 = $44; //@line 2914
       }
      }
     } else {
      $ex$0$lcssa = 0; //@line 2921
     }
     $55 = _bitshift64Shl($0 | 0, $1 | 0, 1 - $ex$0$lcssa | 0) | 0; //@line 2924
     $83 = $55; //@line 2926
     $84 = tempRet0; //@line 2926
     $ex$1 = $ex$0$lcssa; //@line 2926
    } else {
     $83 = $0; //@line 2930
     $84 = $1 & 1048575 | 1048576; //@line 2930
     $ex$1 = $6; //@line 2930
    }
    if (!$9) {
     $60 = _bitshift64Shl($2 | 0, $3 | 0, 12) | 0; //@line 2934
     $61 = tempRet0; //@line 2935
     if (($61 | 0) > -1 | ($61 | 0) == -1 & $60 >>> 0 > 4294967295) {
      $68 = $60; //@line 2942
      $69 = $61; //@line 2942
      $ey$020 = 0; //@line 2942
      while (1) {
       $67 = $ey$020 + -1 | 0; //@line 2944
       $68 = _bitshift64Shl($68 | 0, $69 | 0, 1) | 0; //@line 2945
       $69 = tempRet0; //@line 2946
       if (!(($69 | 0) > -1 | ($69 | 0) == -1 & $68 >>> 0 > 4294967295)) {
        $ey$0$lcssa = $67; //@line 2955
        break;
       } else {
        $ey$020 = $67; //@line 2953
       }
      }
     } else {
      $ey$0$lcssa = 0; //@line 2960
     }
     $78 = _bitshift64Shl($2 | 0, $3 | 0, 1 - $ey$0$lcssa | 0) | 0; //@line 2963
     $85 = $78; //@line 2965
     $86 = tempRet0; //@line 2965
     $ey$1$ph = $ey$0$lcssa; //@line 2965
    } else {
     $85 = $2; //@line 2969
     $86 = $3 & 1048575 | 1048576; //@line 2969
     $ey$1$ph = $9; //@line 2969
    }
    $87 = _i64Subtract($83 | 0, $84 | 0, $85 | 0, $86 | 0) | 0; //@line 2972
    $88 = tempRet0; //@line 2973
    $93 = ($88 | 0) > -1 | ($88 | 0) == -1 & $87 >>> 0 > 4294967295; //@line 2978
    L23 : do {
     if (($ex$1 | 0) > ($ey$1$ph | 0)) {
      $152 = $93; //@line 2981
      $153 = $87; //@line 2981
      $154 = $88; //@line 2981
      $95 = $83; //@line 2981
      $97 = $84; //@line 2981
      $ex$212 = $ex$1; //@line 2981
      while (1) {
       if ($152) {
        if (($95 | 0) == ($85 | 0) & ($97 | 0) == ($86 | 0)) {
         break;
        } else {
         $100 = $153; //@line 2990
         $101 = $154; //@line 2990
        }
       } else {
        $100 = $95; //@line 2993
        $101 = $97; //@line 2993
       }
       $102 = _bitshift64Shl($100 | 0, $101 | 0, 1) | 0; //@line 2995
       $103 = tempRet0; //@line 2996
       $104 = $ex$212 + -1 | 0; //@line 2997
       $106 = _i64Subtract($102 | 0, $103 | 0, $85 | 0, $86 | 0) | 0; //@line 2999
       $107 = tempRet0; //@line 3000
       $112 = ($107 | 0) > -1 | ($107 | 0) == -1 & $106 >>> 0 > 4294967295; //@line 3005
       if (($104 | 0) > ($ey$1$ph | 0)) {
        $152 = $112; //@line 3007
        $153 = $106; //@line 3007
        $154 = $107; //@line 3007
        $95 = $102; //@line 3007
        $97 = $103; //@line 3007
        $ex$212 = $104; //@line 3007
       } else {
        $$lcssa7 = $112; //@line 3009
        $114 = $102; //@line 3009
        $116 = $103; //@line 3009
        $155 = $106; //@line 3009
        $156 = $107; //@line 3009
        $ex$2$lcssa = $104; //@line 3009
        break L23;
       }
      }
      $$0 = $x * 0.0; //@line 3014
      break L1;
     } else {
      $$lcssa7 = $93; //@line 3017
      $114 = $83; //@line 3017
      $116 = $84; //@line 3017
      $155 = $87; //@line 3017
      $156 = $88; //@line 3017
      $ex$2$lcssa = $ex$1; //@line 3017
     }
    } while (0);
    if ($$lcssa7) {
     if (($114 | 0) == ($85 | 0) & ($116 | 0) == ($86 | 0)) {
      $$0 = $x * 0.0; //@line 3026
      break;
     } else {
      $119 = $156; //@line 3029
      $121 = $155; //@line 3029
     }
    } else {
     $119 = $116; //@line 3032
     $121 = $114; //@line 3032
    }
    if ($119 >>> 0 < 1048576 | ($119 | 0) == 1048576 & $121 >>> 0 < 0) {
     $126 = $121; //@line 3040
     $127 = $119; //@line 3040
     $ex$39 = $ex$2$lcssa; //@line 3040
     while (1) {
      $128 = _bitshift64Shl($126 | 0, $127 | 0, 1) | 0; //@line 3042
      $129 = tempRet0; //@line 3043
      $130 = $ex$39 + -1 | 0; //@line 3044
      if ($129 >>> 0 < 1048576 | ($129 | 0) == 1048576 & $128 >>> 0 < 0) {
       $126 = $128; //@line 3051
       $127 = $129; //@line 3051
       $ex$39 = $130; //@line 3051
      } else {
       $137 = $128; //@line 3053
       $138 = $129; //@line 3053
       $ex$3$lcssa = $130; //@line 3053
       break;
      }
     }
    } else {
     $137 = $121; //@line 3058
     $138 = $119; //@line 3058
     $ex$3$lcssa = $ex$2$lcssa; //@line 3058
    }
    if (($ex$3$lcssa | 0) > 0) {
     $139 = _i64Add($137 | 0, $138 | 0, 0, -1048576) | 0; //@line 3062
     $140 = tempRet0; //@line 3063
     $141 = _bitshift64Shl($ex$3$lcssa | 0, 0, 52) | 0; //@line 3064
     $149 = $140 | tempRet0; //@line 3068
     $150 = $139 | $141; //@line 3068
    } else {
     $146 = _bitshift64Lshr($137 | 0, $138 | 0, 1 - $ex$3$lcssa | 0) | 0; //@line 3071
     $149 = tempRet0; //@line 3073
     $150 = $146; //@line 3073
    }
    HEAP32[tempDoublePtr >> 2] = $150; //@line 3076
    HEAP32[tempDoublePtr + 4 >> 2] = $149 | $10; //@line 3076
    $$0 = +HEAPF64[tempDoublePtr >> 3]; //@line 3077
   }
  }
 } while (0);
 if ((label | 0) == 3) {
  $23 = $x * $y; //@line 3082
  $$0 = $23 / $23; //@line 3084
 }
 return +$$0;
}
function _main() {
 var $0 = 0, $14 = 0, $19 = 0, $2 = 0, $25 = 0, $27 = 0, $3 = 0, $30 = 0, $31 = 0, $33 = 0, $36 = 0, $39 = 0, $42 = 0, $45 = 0, $46 = 0, $47 = 0, $51 = 0, $63 = 0, $68 = 0, $data = 0, $data2 = 0, $i$02 = 0, $number = 0, $vararg_buffer = 0, $vararg_buffer1 = 0, $vararg_buffer12 = 0, $vararg_buffer15 = 0, $vararg_buffer23 = 0, $vararg_buffer27 = 0, $vararg_buffer31 = 0, $vararg_buffer4 = 0, $vararg_buffer7 = 0, $vararg_buffer9 = 0, dest = 0, sp = 0, src = 0, stop = 0;
 sp = STACKTOP; //@line 64
 STACKTOP = STACKTOP + 384 | 0; //@line 65
 $vararg_buffer31 = sp + 360 | 0; //@line 66
 $vararg_buffer27 = sp + 256 | 0; //@line 67
 $vararg_buffer23 = sp + 152 | 0; //@line 68
 $vararg_buffer15 = sp + 48 | 0; //@line 69
 $vararg_buffer12 = sp + 40 | 0; //@line 70
 $vararg_buffer9 = sp + 32 | 0; //@line 71
 $vararg_buffer7 = sp + 24 | 0; //@line 72
 $vararg_buffer4 = sp + 16 | 0; //@line 73
 $vararg_buffer1 = sp + 8 | 0; //@line 74
 $vararg_buffer = sp; //@line 75
 $data = sp + 378 | 0; //@line 76
 $data2 = sp + 368 | 0; //@line 77
 $number = sp + 364 | 0; //@line 78
 $0 = _fopen(1260, 1276) | 0; //@line 79
 if (!$0) {
  ___assert_fail(1279, 1284, 11, 1294); //@line 82
 }
 _fseek($0, 0, 2) | 0; //@line 85
 $2 = _ftell($0) | 0; //@line 86
 _rewind($0); //@line 87
 HEAP32[$vararg_buffer >> 2] = $2; //@line 88
 _printf(1299, $vararg_buffer) | 0; //@line 89
 $3 = _malloc($2) | 0; //@line 90
 if (!$3) {
  ___assert_fail(1309, 1284, 19, 1294); //@line 93
 }
 if ((_fread($3, 1, $2, $0) | 0) != ($2 | 0)) {
  ___assert_fail(1316, 1284, 22, 1294); //@line 99
 }
 HEAP32[$vararg_buffer1 >> 2] = HEAP8[$3 >> 0]; //@line 104
 _printf(1329, $vararg_buffer1) | 0; //@line 105
 if (($2 | 0) > 1) {
  $i$02 = 1; //@line 108
  do {
   HEAP32[$vararg_buffer4 >> 2] = HEAP8[$3 + $i$02 >> 0]; //@line 113
   _printf(1338, $vararg_buffer4) | 0; //@line 114
   $i$02 = $i$02 + 1 | 0; //@line 115
  } while (($i$02 | 0) != ($2 | 0));
 }
 _putchar(10) | 0; //@line 124
 _fclose($0) | 0; //@line 125
 _free($3); //@line 126
 _printf(1342, $vararg_buffer7) | 0; //@line 127
 $14 = _fopen(1260, 1276) | 0; //@line 128
 if (!$14) {
  ___assert_fail(1279, 1284, 36, 1294); //@line 131
 }
 if (!(_feof($14) | 0)) {
  do {
   $19 = (_fgetc($14) | 0) << 24 >> 24; //@line 140
   if (($19 | 0) != -1) {
    HEAP32[$vararg_buffer9 >> 2] = $19; //@line 143
    _printf(1349, $vararg_buffer9) | 0; //@line 144
   }
  } while ((_feof($14) | 0) == 0);
 }
 _fclose($14) | 0; //@line 153
 _putchar(10) | 0; //@line 154
 HEAP32[$vararg_buffer12 >> 2] = _gets(_malloc(1024) | 0) | 0; //@line 157
 _printf(1353, $vararg_buffer12) | 0; //@line 158
 $25 = HEAP32[66] | 0; //@line 159
 _fwrite(1363, 1, 6, $25) | 0; //@line 160
 _fwrite(1370, 1, 6, HEAP32[64] | 0) | 0; //@line 162
 _putchar(36) | 0; //@line 163
 _putc(10, $25) | 0; //@line 164
 HEAP8[$data >> 0] = HEAP8[1377] | 0; //@line 165
 HEAP8[$data + 1 >> 0] = HEAP8[1378] | 0; //@line 165
 HEAP8[$data + 2 >> 0] = HEAP8[1379] | 0; //@line 165
 HEAP8[$data + 3 >> 0] = HEAP8[1380] | 0; //@line 165
 HEAP8[$data + 4 >> 0] = HEAP8[1381] | 0; //@line 165
 $27 = _fopen(1382, 1389) | 0; //@line 166
 _fwrite($data, 1, 5, $27) | 0; //@line 167
 _fclose($27) | 0; //@line 168
 if (!(_fopen(1392, 1276) | 0)) {
  ___assert_fail(1402, 1284, 60, 1294); //@line 172
 }
 $30 = _fopen(1382, 1276) | 0; //@line 175
 $31 = _fread($data2, 1, 10, $30) | 0; //@line 176
 _fclose($30) | 0; //@line 177
 $33 = HEAP8[$data2 >> 0] | 0; //@line 179
 $36 = HEAP8[$data2 + 1 >> 0] | 0; //@line 182
 $39 = HEAP8[$data2 + 2 >> 0] | 0; //@line 185
 $42 = HEAP8[$data2 + 3 >> 0] | 0; //@line 188
 $45 = HEAP8[$data2 + 4 >> 0] | 0; //@line 191
 HEAP32[$vararg_buffer15 >> 2] = $31; //@line 192
 HEAP32[$vararg_buffer15 + 4 >> 2] = $33; //@line 194
 HEAP32[$vararg_buffer15 + 8 >> 2] = $36; //@line 196
 HEAP32[$vararg_buffer15 + 12 >> 2] = $39; //@line 198
 HEAP32[$vararg_buffer15 + 16 >> 2] = $42; //@line 200
 HEAP32[$vararg_buffer15 + 20 >> 2] = $45; //@line 202
 _printf(1410, $vararg_buffer15) | 0; //@line 203
 $46 = _fopen(1431, 1439) | 0; //@line 204
 _fwrite(1441, 8, 1, $46) | 0; //@line 205
 _fclose($46) | 0; //@line 206
 $47 = _fopen(1431, 1450) | 0; //@line 207
 HEAP32[$vararg_buffer23 >> 2] = $number; //@line 208
 HEAP32[$vararg_buffer23 + 4 >> 2] = $vararg_buffer15; //@line 210
 _fscanf($47, 1452, $vararg_buffer23) | 0; //@line 211
 _fclose($47) | 0; //@line 212
 HEAP32[$vararg_buffer27 >> 2] = HEAP32[$number >> 2]; //@line 214
 HEAP32[$vararg_buffer27 + 4 >> 2] = $vararg_buffer15; //@line 216
 _printf(1458, $vararg_buffer27) | 0; //@line 217
 dest = $vararg_buffer27; //@line 218
 src = 1477; //@line 218
 stop = dest + 12 | 0; //@line 218
 do {
  HEAP8[dest >> 0] = HEAP8[src >> 0] | 0; //@line 218
  dest = dest + 1 | 0; //@line 218
  src = src + 1 | 0; //@line 218
 } while ((dest | 0) < (stop | 0));
 dest = $vararg_buffer23; //@line 219
 src = 1477; //@line 219
 stop = dest + 12 | 0; //@line 219
 do {
  HEAP8[dest >> 0] = HEAP8[src >> 0] | 0; //@line 219
  dest = dest + 1 | 0; //@line 219
  src = src + 1 | 0; //@line 219
 } while ((dest | 0) < (stop | 0));
 if (_strcmp($vararg_buffer27, $vararg_buffer23) | 0) {
  ___assert_fail(1489, 1284, 116, 1294); //@line 223
 }
 $51 = _mkstemp($vararg_buffer27) | 0; //@line 226
 if (($51 | 0) == (_mkstemp($vararg_buffer23) | 0)) {
  ___assert_fail(1513, 1284, 119, 1294); //@line 230
 }
 if (!(_strcmp($vararg_buffer27, $vararg_buffer23) | 0)) {
  ___assert_fail(1522, 1284, 121, 1294); //@line 236
 }
 if (!(_fopen($vararg_buffer27, 1450) | 0)) {
  ___assert_fail(1545, 1284, 122, 1294); //@line 242
 }
 if (!(_fopen($vararg_buffer23, 1450) | 0)) {
  ___assert_fail(1564, 1284, 123, 1294); //@line 248
 }
 if (_fopen($vararg_buffer23 + 1 | 0, 1450) | 0) {
  ___assert_fail(1583, 1284, 124, 1294); //@line 255
 }
 $63 = _tmpfile() | 0; //@line 258
 if (!$63) {
  ___assert_fail(1605, 1284, 128, 1294); //@line 261
 }
 _fclose($63) | 0; //@line 264
 if (!(_strncmp(1607, _tmpnam(0) | 0, 5) | 0)) {
  $68 = _fopen(1392, 1439) | 0; //@line 269
  HEAP32[$vararg_buffer31 >> 2] = _fwrite($data, 1, 5, $68) | 0; //@line 271
  _printf(1643, $vararg_buffer31) | 0; //@line 272
  _fclose($68) | 0; //@line 273
  _puts(1668) | 0; //@line 274
  STACKTOP = sp; //@line 275
  return 0; //@line 275
 } else {
  ___assert_fail(1613, 1284, 133, 1294); //@line 277
 }
 return 0; //@line 280
}
function _scanexp($f, $pok) {
 $f = $f | 0;
 $pok = $pok | 0;
 var $$lcssa22 = 0, $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $2 = 0, $20 = 0, $35 = 0, $36 = 0, $48 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $59 = 0, $61 = 0, $62 = 0, $63 = 0, $78 = 0, $91 = 0, $92 = 0, $93 = 0, $94 = 0, $98 = 0, $99 = 0, $c$0 = 0, $c$1$be = 0, $c$1$be$lcssa = 0, $c$112 = 0, $c$2$be = 0, $c$2$lcssa = 0, $c$27 = 0, $c$3$be = 0, $neg$0 = 0, $x$013 = 0;
 $0 = $f + 4 | 0; //@line 7102
 $1 = HEAP32[$0 >> 2] | 0; //@line 7103
 $2 = $f + 100 | 0; //@line 7104
 if ($1 >>> 0 < (HEAP32[$2 >> 2] | 0) >>> 0) {
  HEAP32[$0 >> 2] = $1 + 1; //@line 7109
  $10 = HEAPU8[$1 >> 0] | 0; //@line 7112
 } else {
  $10 = ___shgetc($f) | 0; //@line 7115
 }
 switch ($10 | 0) {
 case 43:
 case 45:
  {
   $11 = ($10 | 0) == 45 & 1; //@line 7120
   $12 = HEAP32[$0 >> 2] | 0; //@line 7121
   if ($12 >>> 0 < (HEAP32[$2 >> 2] | 0) >>> 0) {
    HEAP32[$0 >> 2] = $12 + 1; //@line 7126
    $20 = HEAPU8[$12 >> 0] | 0; //@line 7129
   } else {
    $20 = ___shgetc($f) | 0; //@line 7132
   }
   if (($pok | 0) != 0 & ($20 + -48 | 0) >>> 0 > 9) {
    if (!(HEAP32[$2 >> 2] | 0)) {
     $c$0 = $20; //@line 7142
     $neg$0 = $11; //@line 7142
    } else {
     HEAP32[$0 >> 2] = (HEAP32[$0 >> 2] | 0) + -1; //@line 7146
     $c$0 = $20; //@line 7147
     $neg$0 = $11; //@line 7147
    }
   } else {
    $c$0 = $20; //@line 7150
    $neg$0 = $11; //@line 7150
   }
   break;
  }
 default:
  {
   $c$0 = $10; //@line 7155
   $neg$0 = 0; //@line 7155
  }
 }
 if (($c$0 + -48 | 0) >>> 0 > 9) {
  if (!(HEAP32[$2 >> 2] | 0)) {
   $98 = -2147483648; //@line 7164
   $99 = 0; //@line 7164
  } else {
   HEAP32[$0 >> 2] = (HEAP32[$0 >> 2] | 0) + -1; //@line 7168
   $98 = -2147483648; //@line 7169
   $99 = 0; //@line 7169
  }
 } else {
  $c$112 = $c$0; //@line 7172
  $x$013 = 0; //@line 7172
  while (1) {
   $35 = $c$112 + -48 + ($x$013 * 10 | 0) | 0; //@line 7176
   $36 = HEAP32[$0 >> 2] | 0; //@line 7177
   if ($36 >>> 0 < (HEAP32[$2 >> 2] | 0) >>> 0) {
    HEAP32[$0 >> 2] = $36 + 1; //@line 7182
    $c$1$be = HEAPU8[$36 >> 0] | 0; //@line 7185
   } else {
    $c$1$be = ___shgetc($f) | 0; //@line 7188
   }
   if (($c$1$be + -48 | 0) >>> 0 < 10 & ($35 | 0) < 214748364) {
    $c$112 = $c$1$be; //@line 7195
    $x$013 = $35; //@line 7195
   } else {
    $$lcssa22 = $35; //@line 7197
    $c$1$be$lcssa = $c$1$be; //@line 7197
    break;
   }
  }
  $48 = (($$lcssa22 | 0) < 0) << 31 >> 31; //@line 7202
  if (($c$1$be$lcssa + -48 | 0) >>> 0 < 10) {
   $53 = $$lcssa22; //@line 7206
   $54 = $48; //@line 7206
   $c$27 = $c$1$be$lcssa; //@line 7206
   while (1) {
    $55 = ___muldi3($53 | 0, $54 | 0, 10, 0) | 0; //@line 7208
    $56 = tempRet0; //@line 7209
    $59 = _i64Add($c$27 | 0, (($c$27 | 0) < 0) << 31 >> 31 | 0, -48, -1) | 0; //@line 7212
    $61 = _i64Add($59 | 0, tempRet0 | 0, $55 | 0, $56 | 0) | 0; //@line 7214
    $62 = tempRet0; //@line 7215
    $63 = HEAP32[$0 >> 2] | 0; //@line 7216
    if ($63 >>> 0 < (HEAP32[$2 >> 2] | 0) >>> 0) {
     HEAP32[$0 >> 2] = $63 + 1; //@line 7221
     $c$2$be = HEAPU8[$63 >> 0] | 0; //@line 7224
    } else {
     $c$2$be = ___shgetc($f) | 0; //@line 7227
    }
    if (($c$2$be + -48 | 0) >>> 0 < 10 & (($62 | 0) < 21474836 | ($62 | 0) == 21474836 & $61 >>> 0 < 2061584302)) {
     $53 = $61; //@line 7238
     $54 = $62; //@line 7238
     $c$27 = $c$2$be; //@line 7238
    } else {
     $92 = $61; //@line 7240
     $93 = $62; //@line 7240
     $c$2$lcssa = $c$2$be; //@line 7240
     break;
    }
   }
  } else {
   $92 = $$lcssa22; //@line 7245
   $93 = $48; //@line 7245
   $c$2$lcssa = $c$1$be$lcssa; //@line 7245
  }
  if (($c$2$lcssa + -48 | 0) >>> 0 < 10) {
   do {
    $78 = HEAP32[$0 >> 2] | 0; //@line 7251
    if ($78 >>> 0 < (HEAP32[$2 >> 2] | 0) >>> 0) {
     HEAP32[$0 >> 2] = $78 + 1; //@line 7256
     $c$3$be = HEAPU8[$78 >> 0] | 0; //@line 7259
    } else {
     $c$3$be = ___shgetc($f) | 0; //@line 7262
    }
   } while (($c$3$be + -48 | 0) >>> 0 < 10);
  }
  if (HEAP32[$2 >> 2] | 0) {
   HEAP32[$0 >> 2] = (HEAP32[$0 >> 2] | 0) + -1; //@line 7276
  }
  $91 = ($neg$0 | 0) != 0; //@line 7278
  $94 = _i64Subtract(0, 0, $92 | 0, $93 | 0) | 0; //@line 7279
  $98 = $91 ? tempRet0 : $93; //@line 7283
  $99 = $91 ? $94 : $92; //@line 7283
 }
 tempRet0 = $98; //@line 7285
 return $99 | 0; //@line 7286
}
function _pop_arg($arg, $type, $ap) {
 $arg = $arg | 0;
 $type = $type | 0;
 $ap = $ap | 0;
 var $105 = 0, $106 = 0.0, $112 = 0, $113 = 0.0, $13 = 0, $14 = 0, $17 = 0, $26 = 0, $27 = 0, $28 = 0, $37 = 0, $38 = 0, $40 = 0, $43 = 0, $44 = 0, $53 = 0, $54 = 0, $56 = 0, $59 = 0, $6 = 0, $68 = 0, $69 = 0, $7 = 0, $70 = 0, $79 = 0, $80 = 0, $82 = 0, $85 = 0, $94 = 0, $95 = 0, $96 = 0;
 L1 : do {
  if ($type >>> 0 <= 20) {
   do {
    switch ($type | 0) {
    case 9:
     {
      $6 = (HEAP32[$ap >> 2] | 0) + (4 - 1) & ~(4 - 1); //@line 9446
      $7 = HEAP32[$6 >> 2] | 0; //@line 9447
      HEAP32[$ap >> 2] = $6 + 4; //@line 9449
      HEAP32[$arg >> 2] = $7; //@line 9450
      break L1;
      break;
     }
    case 10:
     {
      $13 = (HEAP32[$ap >> 2] | 0) + (4 - 1) & ~(4 - 1); //@line 9466
      $14 = HEAP32[$13 >> 2] | 0; //@line 9467
      HEAP32[$ap >> 2] = $13 + 4; //@line 9469
      $17 = $arg; //@line 9472
      HEAP32[$17 >> 2] = $14; //@line 9474
      HEAP32[$17 + 4 >> 2] = (($14 | 0) < 0) << 31 >> 31; //@line 9477
      break L1;
      break;
     }
    case 11:
     {
      $26 = (HEAP32[$ap >> 2] | 0) + (4 - 1) & ~(4 - 1); //@line 9493
      $27 = HEAP32[$26 >> 2] | 0; //@line 9494
      HEAP32[$ap >> 2] = $26 + 4; //@line 9496
      $28 = $arg; //@line 9497
      HEAP32[$28 >> 2] = $27; //@line 9499
      HEAP32[$28 + 4 >> 2] = 0; //@line 9502
      break L1;
      break;
     }
    case 12:
     {
      $37 = (HEAP32[$ap >> 2] | 0) + (8 - 1) & ~(8 - 1); //@line 9518
      $38 = $37; //@line 9519
      $40 = HEAP32[$38 >> 2] | 0; //@line 9521
      $43 = HEAP32[$38 + 4 >> 2] | 0; //@line 9524
      HEAP32[$ap >> 2] = $37 + 8; //@line 9526
      $44 = $arg; //@line 9527
      HEAP32[$44 >> 2] = $40; //@line 9529
      HEAP32[$44 + 4 >> 2] = $43; //@line 9532
      break L1;
      break;
     }
    case 13:
     {
      $53 = (HEAP32[$ap >> 2] | 0) + (4 - 1) & ~(4 - 1); //@line 9548
      $54 = HEAP32[$53 >> 2] | 0; //@line 9549
      HEAP32[$ap >> 2] = $53 + 4; //@line 9551
      $56 = ($54 & 65535) << 16 >> 16; //@line 9553
      $59 = $arg; //@line 9556
      HEAP32[$59 >> 2] = $56; //@line 9558
      HEAP32[$59 + 4 >> 2] = (($56 | 0) < 0) << 31 >> 31; //@line 9561
      break L1;
      break;
     }
    case 14:
     {
      $68 = (HEAP32[$ap >> 2] | 0) + (4 - 1) & ~(4 - 1); //@line 9577
      $69 = HEAP32[$68 >> 2] | 0; //@line 9578
      HEAP32[$ap >> 2] = $68 + 4; //@line 9580
      $70 = $arg; //@line 9582
      HEAP32[$70 >> 2] = $69 & 65535; //@line 9584
      HEAP32[$70 + 4 >> 2] = 0; //@line 9587
      break L1;
      break;
     }
    case 15:
     {
      $79 = (HEAP32[$ap >> 2] | 0) + (4 - 1) & ~(4 - 1); //@line 9603
      $80 = HEAP32[$79 >> 2] | 0; //@line 9604
      HEAP32[$ap >> 2] = $79 + 4; //@line 9606
      $82 = ($80 & 255) << 24 >> 24; //@line 9608
      $85 = $arg; //@line 9611
      HEAP32[$85 >> 2] = $82; //@line 9613
      HEAP32[$85 + 4 >> 2] = (($82 | 0) < 0) << 31 >> 31; //@line 9616
      break L1;
      break;
     }
    case 16:
     {
      $94 = (HEAP32[$ap >> 2] | 0) + (4 - 1) & ~(4 - 1); //@line 9632
      $95 = HEAP32[$94 >> 2] | 0; //@line 9633
      HEAP32[$ap >> 2] = $94 + 4; //@line 9635
      $96 = $arg; //@line 9637
      HEAP32[$96 >> 2] = $95 & 255; //@line 9639
      HEAP32[$96 + 4 >> 2] = 0; //@line 9642
      break L1;
      break;
     }
    case 17:
     {
      $105 = (HEAP32[$ap >> 2] | 0) + (8 - 1) & ~(8 - 1); //@line 9658
      $106 = +HEAPF64[$105 >> 3]; //@line 9659
      HEAP32[$ap >> 2] = $105 + 8; //@line 9661
      HEAPF64[$arg >> 3] = $106; //@line 9662
      break L1;
      break;
     }
    case 18:
     {
      $112 = (HEAP32[$ap >> 2] | 0) + (8 - 1) & ~(8 - 1); //@line 9678
      $113 = +HEAPF64[$112 >> 3]; //@line 9679
      HEAP32[$ap >> 2] = $112 + 8; //@line 9681
      HEAPF64[$arg >> 3] = $113; //@line 9682
      break L1;
      break;
     }
    default:
     {
      break L1;
     }
    }
   } while (0);
  }
 } while (0);
 return;
}
function ___stdio_write($f, $buf, $len) {
 $f = $f | 0;
 $buf = $buf | 0;
 $len = $len | 0;
 var $$0 = 0, $0 = 0, $1 = 0, $10 = 0, $11 = 0, $16 = 0, $21 = 0, $26 = 0, $3 = 0, $35 = 0, $37 = 0, $39 = 0, $50 = 0, $6 = 0, $cnt$0 = 0, $cnt$1 = 0, $iov$0 = 0, $iov$0$lcssa11 = 0, $iov$1 = 0, $iovcnt$0 = 0, $iovcnt$0$lcssa12 = 0, $iovcnt$1 = 0, $iovs = 0, $rem$0 = 0, $vararg_buffer = 0, $vararg_buffer3 = 0, label = 0, sp = 0;
 sp = STACKTOP; //@line 3828
 STACKTOP = STACKTOP + 48 | 0; //@line 3829
 $vararg_buffer3 = sp + 16 | 0; //@line 3830
 $vararg_buffer = sp; //@line 3831
 $iovs = sp + 32 | 0; //@line 3832
 $0 = $f + 28 | 0; //@line 3833
 $1 = HEAP32[$0 >> 2] | 0; //@line 3834
 HEAP32[$iovs >> 2] = $1; //@line 3835
 $3 = $f + 20 | 0; //@line 3837
 $6 = (HEAP32[$3 >> 2] | 0) - $1 | 0; //@line 3840
 HEAP32[$iovs + 4 >> 2] = $6; //@line 3841
 HEAP32[$iovs + 8 >> 2] = $buf; //@line 3843
 HEAP32[$iovs + 12 >> 2] = $len; //@line 3845
 $10 = $f + 60 | 0; //@line 3847
 $11 = $f + 44 | 0; //@line 3848
 $iov$0 = $iovs; //@line 3849
 $iovcnt$0 = 2; //@line 3849
 $rem$0 = $6 + $len | 0; //@line 3849
 while (1) {
  if (!(HEAP32[2] | 0)) {
   HEAP32[$vararg_buffer3 >> 2] = HEAP32[$10 >> 2]; //@line 3855
   HEAP32[$vararg_buffer3 + 4 >> 2] = $iov$0; //@line 3857
   HEAP32[$vararg_buffer3 + 8 >> 2] = $iovcnt$0; //@line 3859
   $cnt$0 = ___syscall_ret(___syscall146(146, $vararg_buffer3 | 0) | 0) | 0; //@line 3862
  } else {
   _pthread_cleanup_push(2, $f | 0); //@line 3864
   HEAP32[$vararg_buffer >> 2] = HEAP32[$10 >> 2]; //@line 3866
   HEAP32[$vararg_buffer + 4 >> 2] = $iov$0; //@line 3868
   HEAP32[$vararg_buffer + 8 >> 2] = $iovcnt$0; //@line 3870
   $16 = ___syscall_ret(___syscall146(146, $vararg_buffer | 0) | 0) | 0; //@line 3872
   _pthread_cleanup_pop(0); //@line 3873
   $cnt$0 = $16; //@line 3874
  }
  if (($rem$0 | 0) == ($cnt$0 | 0)) {
   label = 6; //@line 3878
   break;
  }
  if (($cnt$0 | 0) < 0) {
   $iov$0$lcssa11 = $iov$0; //@line 3883
   $iovcnt$0$lcssa12 = $iovcnt$0; //@line 3883
   label = 8; //@line 3884
   break;
  }
  $35 = $rem$0 - $cnt$0 | 0; //@line 3887
  $37 = HEAP32[$iov$0 + 4 >> 2] | 0; //@line 3889
  if ($cnt$0 >>> 0 > $37 >>> 0) {
   $39 = HEAP32[$11 >> 2] | 0; //@line 3892
   HEAP32[$0 >> 2] = $39; //@line 3893
   HEAP32[$3 >> 2] = $39; //@line 3894
   $50 = HEAP32[$iov$0 + 12 >> 2] | 0; //@line 3900
   $cnt$1 = $cnt$0 - $37 | 0; //@line 3900
   $iov$1 = $iov$0 + 8 | 0; //@line 3900
   $iovcnt$1 = $iovcnt$0 + -1 | 0; //@line 3900
  } else {
   if (($iovcnt$0 | 0) == 2) {
    HEAP32[$0 >> 2] = (HEAP32[$0 >> 2] | 0) + $cnt$0; //@line 3906
    $50 = $37; //@line 3907
    $cnt$1 = $cnt$0; //@line 3907
    $iov$1 = $iov$0; //@line 3907
    $iovcnt$1 = 2; //@line 3907
   } else {
    $50 = $37; //@line 3909
    $cnt$1 = $cnt$0; //@line 3909
    $iov$1 = $iov$0; //@line 3909
    $iovcnt$1 = $iovcnt$0; //@line 3909
   }
  }
  HEAP32[$iov$1 >> 2] = (HEAP32[$iov$1 >> 2] | 0) + $cnt$1; //@line 3914
  HEAP32[$iov$1 + 4 >> 2] = $50 - $cnt$1; //@line 3917
  $iov$0 = $iov$1; //@line 3918
  $iovcnt$0 = $iovcnt$1; //@line 3918
  $rem$0 = $35; //@line 3918
 }
 if ((label | 0) == 6) {
  $21 = HEAP32[$11 >> 2] | 0; //@line 3921
  HEAP32[$f + 16 >> 2] = $21 + (HEAP32[$f + 48 >> 2] | 0); //@line 3926
  $26 = $21; //@line 3927
  HEAP32[$0 >> 2] = $26; //@line 3928
  HEAP32[$3 >> 2] = $26; //@line 3929
  $$0 = $len; //@line 3930
 } else if ((label | 0) == 8) {
  HEAP32[$f + 16 >> 2] = 0; //@line 3934
  HEAP32[$0 >> 2] = 0; //@line 3935
  HEAP32[$3 >> 2] = 0; //@line 3936
  HEAP32[$f >> 2] = HEAP32[$f >> 2] | 32; //@line 3939
  if (($iovcnt$0$lcssa12 | 0) == 2) {
   $$0 = 0; //@line 3942
  } else {
   $$0 = $len - (HEAP32[$iov$0$lcssa11 + 4 >> 2] | 0) | 0; //@line 3947
  }
 }
 STACKTOP = sp; //@line 3950
 return $$0 | 0; //@line 3950
}
function _memchr($src, $c, $n) {
 $src = $src | 0;
 $c = $c | 0;
 $n = $n | 0;
 var $$0$lcssa = 0, $$0$lcssa44 = 0, $$019 = 0, $$1$lcssa = 0, $$110 = 0, $$110$lcssa = 0, $$24 = 0, $$3 = 0, $$lcssa = 0, $0 = 0, $13 = 0, $15 = 0, $17 = 0, $20 = 0, $26 = 0, $27 = 0, $32 = 0, $4 = 0, $5 = 0, $8 = 0, $9 = 0, $s$0$lcssa = 0, $s$0$lcssa43 = 0, $s$020 = 0, $s$15 = 0, $s$2 = 0, $w$0$lcssa = 0, $w$011 = 0, $w$011$lcssa = 0, label = 0;
 $0 = $c & 255; //@line 6548
 $4 = ($n | 0) != 0; //@line 6552
 L1 : do {
  if ($4 & ($src & 3 | 0) != 0) {
   $5 = $c & 255; //@line 6556
   $$019 = $n; //@line 6557
   $s$020 = $src; //@line 6557
   while (1) {
    if ((HEAP8[$s$020 >> 0] | 0) == $5 << 24 >> 24) {
     $$0$lcssa44 = $$019; //@line 6562
     $s$0$lcssa43 = $s$020; //@line 6562
     label = 6; //@line 6563
     break L1;
    }
    $8 = $s$020 + 1 | 0; //@line 6566
    $9 = $$019 + -1 | 0; //@line 6567
    $13 = ($9 | 0) != 0; //@line 6571
    if ($13 & ($8 & 3 | 0) != 0) {
     $$019 = $9; //@line 6574
     $s$020 = $8; //@line 6574
    } else {
     $$0$lcssa = $9; //@line 6576
     $$lcssa = $13; //@line 6576
     $s$0$lcssa = $8; //@line 6576
     label = 5; //@line 6577
     break;
    }
   }
  } else {
   $$0$lcssa = $n; //@line 6582
   $$lcssa = $4; //@line 6582
   $s$0$lcssa = $src; //@line 6582
   label = 5; //@line 6583
  }
 } while (0);
 if ((label | 0) == 5) {
  if ($$lcssa) {
   $$0$lcssa44 = $$0$lcssa; //@line 6588
   $s$0$lcssa43 = $s$0$lcssa; //@line 6588
   label = 6; //@line 6589
  } else {
   $$3 = 0; //@line 6591
   $s$2 = $s$0$lcssa; //@line 6591
  }
 }
 L8 : do {
  if ((label | 0) == 6) {
   $15 = $c & 255; //@line 6597
   if ((HEAP8[$s$0$lcssa43 >> 0] | 0) == $15 << 24 >> 24) {
    $$3 = $$0$lcssa44; //@line 6600
    $s$2 = $s$0$lcssa43; //@line 6600
   } else {
    $17 = Math_imul($0, 16843009) | 0; //@line 6602
    L11 : do {
     if ($$0$lcssa44 >>> 0 > 3) {
      $$110 = $$0$lcssa44; //@line 6606
      $w$011 = $s$0$lcssa43; //@line 6606
      while (1) {
       $20 = HEAP32[$w$011 >> 2] ^ $17; //@line 6609
       if (($20 & -2139062144 ^ -2139062144) & $20 + -16843009) {
        $$110$lcssa = $$110; //@line 6616
        $w$011$lcssa = $w$011; //@line 6616
        break;
       }
       $26 = $w$011 + 4 | 0; //@line 6619
       $27 = $$110 + -4 | 0; //@line 6620
       if ($27 >>> 0 > 3) {
        $$110 = $27; //@line 6623
        $w$011 = $26; //@line 6623
       } else {
        $$1$lcssa = $27; //@line 6625
        $w$0$lcssa = $26; //@line 6625
        label = 11; //@line 6626
        break L11;
       }
      }
      $$24 = $$110$lcssa; //@line 6630
      $s$15 = $w$011$lcssa; //@line 6630
     } else {
      $$1$lcssa = $$0$lcssa44; //@line 6632
      $w$0$lcssa = $s$0$lcssa43; //@line 6632
      label = 11; //@line 6633
     }
    } while (0);
    if ((label | 0) == 11) {
     if (!$$1$lcssa) {
      $$3 = 0; //@line 6639
      $s$2 = $w$0$lcssa; //@line 6639
      break;
     } else {
      $$24 = $$1$lcssa; //@line 6642
      $s$15 = $w$0$lcssa; //@line 6642
     }
    }
    while (1) {
     if ((HEAP8[$s$15 >> 0] | 0) == $15 << 24 >> 24) {
      $$3 = $$24; //@line 6649
      $s$2 = $s$15; //@line 6649
      break L8;
     }
     $32 = $s$15 + 1 | 0; //@line 6652
     $$24 = $$24 + -1 | 0; //@line 6653
     if (!$$24) {
      $$3 = 0; //@line 6656
      $s$2 = $32; //@line 6656
      break;
     } else {
      $s$15 = $32; //@line 6659
     }
    }
   }
  }
 } while (0);
 return (($$3 | 0) != 0 ? $s$2 : 0) | 0; //@line 6667
}
function ___fdopen($fd, $mode) {
 $fd = $fd | 0;
 $mode = $mode | 0;
 var $$0 = 0, $0 = 0, $13 = 0, $14 = 0, $19 = 0, $24 = 0, $26 = 0, $37 = 0, $4 = 0, $tio = 0, $vararg_buffer = 0, $vararg_buffer12 = 0, $vararg_buffer3 = 0, $vararg_buffer7 = 0, dest = 0, sp = 0, stop = 0;
 sp = STACKTOP; //@line 3454
 STACKTOP = STACKTOP + 112 | 0; //@line 3455
 $vararg_buffer12 = sp + 40 | 0; //@line 3456
 $vararg_buffer7 = sp + 24 | 0; //@line 3457
 $vararg_buffer3 = sp + 16 | 0; //@line 3458
 $vararg_buffer = sp; //@line 3459
 $tio = sp + 52 | 0; //@line 3460
 $0 = HEAP8[$mode >> 0] | 0; //@line 3461
 if (!(_memchr(3839, $0 << 24 >> 24, 4) | 0)) {
  HEAP32[(___errno_location() | 0) >> 2] = 22; //@line 3467
  $$0 = 0; //@line 3468
 } else {
  $4 = _malloc(1144) | 0; //@line 3470
  if (!$4) {
   $$0 = 0; //@line 3473
  } else {
   dest = $4; //@line 3475
   stop = dest + 112 | 0; //@line 3475
   do {
    HEAP32[dest >> 2] = 0; //@line 3475
    dest = dest + 4 | 0; //@line 3475
   } while ((dest | 0) < (stop | 0));
   if (!(_strchr($mode, 43) | 0)) {
    HEAP32[$4 >> 2] = $0 << 24 >> 24 == 114 ? 8 : 4; //@line 3481
   }
   if (!(_strchr($mode, 101) | 0)) {
    $13 = $0; //@line 3486
   } else {
    HEAP32[$vararg_buffer >> 2] = $fd; //@line 3488
    HEAP32[$vararg_buffer + 4 >> 2] = 2; //@line 3490
    HEAP32[$vararg_buffer + 8 >> 2] = 1; //@line 3492
    ___syscall221(221, $vararg_buffer | 0) | 0; //@line 3493
    $13 = HEAP8[$mode >> 0] | 0; //@line 3495
   }
   if ($13 << 24 >> 24 == 97) {
    HEAP32[$vararg_buffer3 >> 2] = $fd; //@line 3499
    HEAP32[$vararg_buffer3 + 4 >> 2] = 3; //@line 3501
    $14 = ___syscall221(221, $vararg_buffer3 | 0) | 0; //@line 3502
    if (!($14 & 1024)) {
     HEAP32[$vararg_buffer7 >> 2] = $fd; //@line 3507
     HEAP32[$vararg_buffer7 + 4 >> 2] = 4; //@line 3509
     HEAP32[$vararg_buffer7 + 8 >> 2] = $14 | 1024; //@line 3511
     ___syscall221(221, $vararg_buffer7 | 0) | 0; //@line 3512
    }
    $19 = HEAP32[$4 >> 2] | 128; //@line 3515
    HEAP32[$4 >> 2] = $19; //@line 3516
    $26 = $19; //@line 3517
   } else {
    $26 = HEAP32[$4 >> 2] | 0; //@line 3520
   }
   HEAP32[$4 + 60 >> 2] = $fd; //@line 3523
   HEAP32[$4 + 44 >> 2] = $4 + 120; //@line 3526
   HEAP32[$4 + 48 >> 2] = 1024; //@line 3528
   $24 = $4 + 75 | 0; //@line 3529
   HEAP8[$24 >> 0] = -1; //@line 3530
   if (!($26 & 8)) {
    HEAP32[$vararg_buffer12 >> 2] = $fd; //@line 3534
    HEAP32[$vararg_buffer12 + 4 >> 2] = 21505; //@line 3536
    HEAP32[$vararg_buffer12 + 8 >> 2] = $tio; //@line 3538
    if (!(___syscall54(54, $vararg_buffer12 | 0) | 0)) {
     HEAP8[$24 >> 0] = 10; //@line 3542
    }
   }
   HEAP32[$4 + 32 >> 2] = 4; //@line 3546
   HEAP32[$4 + 36 >> 2] = 2; //@line 3548
   HEAP32[$4 + 40 >> 2] = 3; //@line 3550
   HEAP32[$4 + 12 >> 2] = 1; //@line 3552
   if (!(HEAP32[3] | 0)) {
    HEAP32[$4 + 76 >> 2] = -1; //@line 3557
   }
   ___lock(36); //@line 3559
   $37 = HEAP32[8] | 0; //@line 3560
   HEAP32[$4 + 56 >> 2] = $37; //@line 3562
   if ($37) {
    HEAP32[$37 + 52 >> 2] = $4; //@line 3567
   }
   HEAP32[8] = $4; //@line 3569
   ___unlock(36); //@line 3570
   $$0 = $4; //@line 3571
  }
 }
 STACKTOP = sp; //@line 3574
 return $$0 | 0; //@line 3574
}
function _fgets($s, $n, $f) {
 $s = $s | 0;
 $n = $n | 0;
 $f = $f | 0;
 var $$0 = 0, $$048 = 0, $$05 = 0, $$lcssa14 = 0, $$sum$pre$phiZZ2D = 0, $$sum6 = 0, $13 = 0, $15 = 0, $16 = 0, $17 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $27 = 0, $28 = 0, $29 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $39 = 0, $4 = 0, $47 = 0, $48 = 0, $6 = 0, $8 = 0, $p$0 = 0, $p$1 = 0, label = 0;
 if ((HEAP32[$f + 76 >> 2] | 0) > -1) {
  $13 = ___lockfile($f) | 0; //@line 4346
 } else {
  $13 = 0; //@line 4348
 }
 $4 = $n + -1 | 0; //@line 4350
 if (($n | 0) < 2) {
  $6 = $f + 74 | 0; //@line 4353
  $8 = HEAP8[$6 >> 0] | 0; //@line 4355
  HEAP8[$6 >> 0] = $8 + 255 | $8; //@line 4359
  if ($13) {
   ___unlockfile($f); //@line 4362
  }
  if (!$4) {
   HEAP8[$s >> 0] = 0; //@line 4366
   $$0 = $s; //@line 4367
  } else {
   $$0 = 0; //@line 4369
  }
 } else {
  L11 : do {
   if (!$4) {
    $p$1 = $s; //@line 4375
    label = 18; //@line 4376
   } else {
    $15 = $f + 4 | 0; //@line 4378
    $16 = $f + 8 | 0; //@line 4379
    $$05 = $4; //@line 4380
    $p$0 = $s; //@line 4380
    while (1) {
     $17 = HEAP32[$15 >> 2] | 0; //@line 4382
     $20 = $17; //@line 4385
     $21 = (HEAP32[$16 >> 2] | 0) - $20 | 0; //@line 4386
     $22 = _memchr($17, 10, $21) | 0; //@line 4387
     $23 = ($22 | 0) == 0; //@line 4388
     $27 = $23 ? $21 : 1 - $20 + $22 | 0; //@line 4392
     $28 = $27 >>> 0 < $$05 >>> 0; //@line 4393
     $29 = $28 ? $27 : $$05; //@line 4394
     _memcpy($p$0 | 0, $17 | 0, $29 | 0) | 0; //@line 4395
     $30 = HEAP32[$15 >> 2] | 0; //@line 4396
     $31 = $30 + $29 | 0; //@line 4397
     HEAP32[$15 >> 2] = $31; //@line 4398
     $32 = $p$0 + $29 | 0; //@line 4399
     $33 = $$05 - $29 | 0; //@line 4400
     if (!($23 & $28)) {
      $p$1 = $32; //@line 4403
      label = 18; //@line 4404
      break L11;
     }
     if ($31 >>> 0 < (HEAP32[$16 >> 2] | 0) >>> 0) {
      $$sum6 = $29 + 1 | 0; //@line 4410
      HEAP32[$15 >> 2] = $30 + $$sum6; //@line 4412
      $$sum$pre$phiZZ2D = $$sum6; //@line 4415
      $47 = HEAPU8[$31 >> 0] | 0; //@line 4415
     } else {
      $39 = ___uflow($f) | 0; //@line 4417
      if (($39 | 0) < 0) {
       $$lcssa14 = $32; //@line 4420
       break;
      }
      $$sum$pre$phiZZ2D = $29 + 1 | 0; //@line 4424
      $47 = $39; //@line 4424
     }
     $$05 = $33 + -1 | 0; //@line 4426
     $48 = $p$0 + $$sum$pre$phiZZ2D | 0; //@line 4428
     HEAP8[$32 >> 0] = $47; //@line 4429
     if (!(($$05 | 0) != 0 & ($47 & 255 | 0) != 10)) {
      $p$1 = $48; //@line 4437
      label = 18; //@line 4438
      break L11;
     } else {
      $p$0 = $48; //@line 4435
     }
    }
    if (($$lcssa14 | 0) == ($s | 0)) {
     $$048 = 0; //@line 4444
    } else {
     if (!(HEAP32[$f >> 2] & 16)) {
      $$048 = 0; //@line 4450
     } else {
      $p$1 = $$lcssa14; //@line 4452
      label = 18; //@line 4453
     }
    }
   }
  } while (0);
  if ((label | 0) == 18) {
   if (!$s) {
    $$048 = 0; //@line 4461
   } else {
    HEAP8[$p$1 >> 0] = 0; //@line 4463
    $$048 = $s; //@line 4464
   }
  }
  if (!$13) {
   $$0 = $$048; //@line 4469
  } else {
   ___unlockfile($f); //@line 4471
   $$0 = $$048; //@line 4472
  }
 }
 return $$0 | 0; //@line 4475
}
function _mbrtowc($wc, $src, $n, $st) {
 $wc = $wc | 0;
 $src = $src | 0;
 $n = $n | 0;
 $st = $st | 0;
 var $$0 = 0, $$024 = 0, $$1 = 0, $$lcssa = 0, $$lcssa35 = 0, $$st = 0, $1 = 0, $12 = 0, $16 = 0, $17 = 0, $19 = 0, $21 = 0, $30 = 0, $7 = 0, $8 = 0, $c$05 = 0, $c$1 = 0, $c$2 = 0, $dummy = 0, $dummy$wc = 0, $s$06 = 0, $s$1 = 0, label = 0, sp = 0;
 sp = STACKTOP; //@line 3207
 STACKTOP = STACKTOP + 16 | 0; //@line 3208
 $dummy = sp; //@line 3209
 $$st = ($st | 0) == 0 ? 308 : $st; //@line 3211
 $1 = HEAP32[$$st >> 2] | 0; //@line 3212
 L1 : do {
  if (!$src) {
   if (!$1) {
    $$0 = 0; //@line 3218
   } else {
    label = 15; //@line 3220
   }
  } else {
   $dummy$wc = ($wc | 0) == 0 ? $dummy : $wc; //@line 3224
   if (!$n) {
    $$0 = -2; //@line 3227
   } else {
    if (!$1) {
     $7 = HEAP8[$src >> 0] | 0; //@line 3231
     $8 = $7 & 255; //@line 3232
     if ($7 << 24 >> 24 > -1) {
      HEAP32[$dummy$wc >> 2] = $8; //@line 3235
      $$0 = $7 << 24 >> 24 != 0 & 1; //@line 3238
      break;
     }
     $12 = $8 + -194 | 0; //@line 3241
     if ($12 >>> 0 > 50) {
      label = 15; //@line 3244
      break;
     }
     $16 = HEAP32[52 + ($12 << 2) >> 2] | 0; //@line 3249
     $17 = $n + -1 | 0; //@line 3250
     if (!$17) {
      $c$2 = $16; //@line 3253
     } else {
      $$024 = $17; //@line 3255
      $c$05 = $16; //@line 3255
      $s$06 = $src + 1 | 0; //@line 3255
      label = 9; //@line 3256
     }
    } else {
     $$024 = $n; //@line 3259
     $c$05 = $1; //@line 3259
     $s$06 = $src; //@line 3259
     label = 9; //@line 3260
    }
    L11 : do {
     if ((label | 0) == 9) {
      $19 = HEAP8[$s$06 >> 0] | 0; //@line 3264
      $21 = ($19 & 255) >>> 3; //@line 3266
      if (($21 + -16 | $21 + ($c$05 >> 26)) >>> 0 > 7) {
       label = 15; //@line 3273
       break L1;
      } else {
       $$1 = $$024; //@line 3276
       $30 = $19; //@line 3276
       $c$1 = $c$05; //@line 3276
       $s$1 = $s$06; //@line 3276
      }
      while (1) {
       $s$1 = $s$1 + 1 | 0; //@line 3280
       $c$1 = ($30 & 255) + -128 | $c$1 << 6; //@line 3283
       $$1 = $$1 + -1 | 0; //@line 3284
       if (($c$1 | 0) >= 0) {
        $$lcssa = $c$1; //@line 3287
        $$lcssa35 = $$1; //@line 3287
        break;
       }
       if (!$$1) {
        $c$2 = $c$1; //@line 3292
        break L11;
       }
       $30 = HEAP8[$s$1 >> 0] | 0; //@line 3295
       if (($30 & -64) << 24 >> 24 != -128) {
        label = 15; //@line 3301
        break L1;
       }
      }
      HEAP32[$$st >> 2] = 0; //@line 3305
      HEAP32[$dummy$wc >> 2] = $$lcssa; //@line 3306
      $$0 = $n - $$lcssa35 | 0; //@line 3308
      break L1;
     }
    } while (0);
    HEAP32[$$st >> 2] = $c$2; //@line 3312
    $$0 = -2; //@line 3313
   }
  }
 } while (0);
 if ((label | 0) == 15) {
  HEAP32[$$st >> 2] = 0; //@line 3318
  HEAP32[(___errno_location() | 0) >> 2] = 84; //@line 3320
  $$0 = -1; //@line 3321
 }
 STACKTOP = sp; //@line 3323
 return $$0 | 0; //@line 3323
}
function _vfprintf($f, $fmt, $ap) {
 $f = $f | 0;
 $fmt = $fmt | 0;
 $ap = $ap | 0;
 var $$ = 0, $$0 = 0, $12 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $21 = 0, $22 = 0, $28 = 0, $33 = 0, $6 = 0, $7 = 0, $ap2 = 0, $internal_buf = 0, $nl_arg = 0, $nl_type = 0, $ret$1 = 0, dest = 0, sp = 0, stop = 0;
 sp = STACKTOP; //@line 5336
 STACKTOP = STACKTOP + 224 | 0; //@line 5337
 $ap2 = sp + 80 | 0; //@line 5338
 $nl_type = sp + 96 | 0; //@line 5339
 $nl_arg = sp; //@line 5340
 $internal_buf = sp + 136 | 0; //@line 5341
 dest = $nl_type; //@line 5342
 stop = dest + 40 | 0; //@line 5342
 do {
  HEAP32[dest >> 2] = 0; //@line 5342
  dest = dest + 4 | 0; //@line 5342
 } while ((dest | 0) < (stop | 0));
 HEAP32[$ap2 >> 2] = HEAP32[$ap >> 2]; //@line 5344
 if ((_printf_core(0, $fmt, $ap2, $nl_arg, $nl_type) | 0) < 0) {
  $$0 = -1; //@line 5348
 } else {
  if ((HEAP32[$f + 76 >> 2] | 0) > -1) {
   $33 = ___lockfile($f) | 0; //@line 5355
  } else {
   $33 = 0; //@line 5357
  }
  $6 = HEAP32[$f >> 2] | 0; //@line 5359
  $7 = $6 & 32; //@line 5360
  if ((HEAP8[$f + 74 >> 0] | 0) < 1) {
   HEAP32[$f >> 2] = $6 & -33; //@line 5366
  }
  $12 = $f + 48 | 0; //@line 5368
  if (!(HEAP32[$12 >> 2] | 0)) {
   $16 = $f + 44 | 0; //@line 5372
   $17 = HEAP32[$16 >> 2] | 0; //@line 5373
   HEAP32[$16 >> 2] = $internal_buf; //@line 5374
   $18 = $f + 28 | 0; //@line 5375
   HEAP32[$18 >> 2] = $internal_buf; //@line 5376
   $19 = $f + 20 | 0; //@line 5377
   HEAP32[$19 >> 2] = $internal_buf; //@line 5378
   HEAP32[$12 >> 2] = 80; //@line 5379
   $21 = $f + 16 | 0; //@line 5381
   HEAP32[$21 >> 2] = $internal_buf + 80; //@line 5382
   $22 = _printf_core($f, $fmt, $ap2, $nl_arg, $nl_type) | 0; //@line 5383
   if (!$17) {
    $ret$1 = $22; //@line 5386
   } else {
    FUNCTION_TABLE_iiii[HEAP32[$f + 36 >> 2] & 7]($f, 0, 0) | 0; //@line 5390
    $$ = (HEAP32[$19 >> 2] | 0) == 0 ? -1 : $22; //@line 5393
    HEAP32[$16 >> 2] = $17; //@line 5394
    HEAP32[$12 >> 2] = 0; //@line 5395
    HEAP32[$21 >> 2] = 0; //@line 5396
    HEAP32[$18 >> 2] = 0; //@line 5397
    HEAP32[$19 >> 2] = 0; //@line 5398
    $ret$1 = $$; //@line 5399
   }
  } else {
   $ret$1 = _printf_core($f, $fmt, $ap2, $nl_arg, $nl_type) | 0; //@line 5403
  }
  $28 = HEAP32[$f >> 2] | 0; //@line 5405
  HEAP32[$f >> 2] = $28 | $7; //@line 5410
  if ($33) {
   ___unlockfile($f); //@line 5413
  }
  $$0 = ($28 & 32 | 0) == 0 ? $ret$1 : -1; //@line 5415
 }
 STACKTOP = sp; //@line 5417
 return $$0 | 0; //@line 5417
}
function ___stdio_read($f, $buf, $len) {
 $f = $f | 0;
 $buf = $buf | 0;
 $len = $len | 0;
 var $$0 = 0, $0 = 0, $1 = 0, $15 = 0, $2 = 0, $27 = 0, $30 = 0, $31 = 0, $32 = 0, $7 = 0, $cnt$0 = 0, $iov = 0, $vararg_buffer = 0, $vararg_buffer3 = 0, sp = 0;
 sp = STACKTOP; //@line 3699
 STACKTOP = STACKTOP + 48 | 0; //@line 3700
 $vararg_buffer3 = sp + 16 | 0; //@line 3701
 $vararg_buffer = sp; //@line 3702
 $iov = sp + 32 | 0; //@line 3703
 HEAP32[$iov >> 2] = $buf; //@line 3704
 $0 = $iov + 4 | 0; //@line 3705
 $1 = $f + 48 | 0; //@line 3706
 $2 = HEAP32[$1 >> 2] | 0; //@line 3707
 HEAP32[$0 >> 2] = $len - (($2 | 0) != 0 & 1); //@line 3711
 $7 = $f + 44 | 0; //@line 3713
 HEAP32[$iov + 8 >> 2] = HEAP32[$7 >> 2]; //@line 3715
 HEAP32[$iov + 12 >> 2] = $2; //@line 3717
 if (!(HEAP32[2] | 0)) {
  HEAP32[$vararg_buffer3 >> 2] = HEAP32[$f + 60 >> 2]; //@line 3723
  HEAP32[$vararg_buffer3 + 4 >> 2] = $iov; //@line 3725
  HEAP32[$vararg_buffer3 + 8 >> 2] = 2; //@line 3727
  $cnt$0 = ___syscall_ret(___syscall145(145, $vararg_buffer3 | 0) | 0) | 0; //@line 3730
 } else {
  _pthread_cleanup_push(1, $f | 0); //@line 3732
  HEAP32[$vararg_buffer >> 2] = HEAP32[$f + 60 >> 2]; //@line 3735
  HEAP32[$vararg_buffer + 4 >> 2] = $iov; //@line 3737
  HEAP32[$vararg_buffer + 8 >> 2] = 2; //@line 3739
  $15 = ___syscall_ret(___syscall145(145, $vararg_buffer | 0) | 0) | 0; //@line 3741
  _pthread_cleanup_pop(0); //@line 3742
  $cnt$0 = $15; //@line 3743
 }
 if (($cnt$0 | 0) < 1) {
  HEAP32[$f >> 2] = HEAP32[$f >> 2] | $cnt$0 & 48 ^ 16; //@line 3751
  HEAP32[$f + 8 >> 2] = 0; //@line 3753
  HEAP32[$f + 4 >> 2] = 0; //@line 3755
  $$0 = $cnt$0; //@line 3756
 } else {
  $27 = HEAP32[$0 >> 2] | 0; //@line 3758
  if ($cnt$0 >>> 0 > $27 >>> 0) {
   $30 = HEAP32[$7 >> 2] | 0; //@line 3762
   $31 = $f + 4 | 0; //@line 3763
   HEAP32[$31 >> 2] = $30; //@line 3764
   $32 = $30; //@line 3765
   HEAP32[$f + 8 >> 2] = $32 + ($cnt$0 - $27); //@line 3768
   if (!(HEAP32[$1 >> 2] | 0)) {
    $$0 = $len; //@line 3772
   } else {
    HEAP32[$31 >> 2] = $32 + 1; //@line 3775
    HEAP8[$buf + ($len + -1) >> 0] = HEAP8[$32 >> 0] | 0; //@line 3779
    $$0 = $len; //@line 3780
   }
  } else {
   $$0 = $cnt$0; //@line 3783
  }
 }
 STACKTOP = sp; //@line 3786
 return $$0 | 0; //@line 3786
}
function _fread($destv, $size, $nmemb, $f) {
 $destv = $destv | 0;
 $size = $size | 0;
 $nmemb = $nmemb | 0;
 $f = $f | 0;
 var $$ = 0, $$0 = 0, $0 = 0, $13 = 0, $14 = 0, $17 = 0, $24 = 0, $28 = 0, $32 = 0, $5 = 0, $7 = 0, $dest$0$ph = 0, $dest$02 = 0, $l$0$ph = 0, $l$03 = 0, $l$03$lcssa = 0, label = 0;
 $0 = Math_imul($nmemb, $size) | 0; //@line 4615
 if ((HEAP32[$f + 76 >> 2] | 0) > -1) {
  $32 = ___lockfile($f) | 0; //@line 4621
 } else {
  $32 = 0; //@line 4623
 }
 $5 = $f + 74 | 0; //@line 4625
 $7 = HEAP8[$5 >> 0] | 0; //@line 4627
 HEAP8[$5 >> 0] = $7 + 255 | $7; //@line 4631
 $13 = $f + 4 | 0; //@line 4634
 $14 = HEAP32[$13 >> 2] | 0; //@line 4635
 $17 = (HEAP32[$f + 8 >> 2] | 0) - $14 | 0; //@line 4638
 if (($17 | 0) > 0) {
  $$ = $17 >>> 0 < $0 >>> 0 ? $17 : $0; //@line 4642
  _memcpy($destv | 0, $14 | 0, $$ | 0) | 0; //@line 4643
  HEAP32[$13 >> 2] = $14 + $$; //@line 4645
  $dest$0$ph = $destv + $$ | 0; //@line 4648
  $l$0$ph = $0 - $$ | 0; //@line 4648
 } else {
  $dest$0$ph = $destv; //@line 4650
  $l$0$ph = $0; //@line 4650
 }
 L7 : do {
  if (!$l$0$ph) {
   label = 13; //@line 4655
  } else {
   $24 = $f + 32 | 0; //@line 4657
   $dest$02 = $dest$0$ph; //@line 4658
   $l$03 = $l$0$ph; //@line 4658
   while (1) {
    if (___toread($f) | 0) {
     $l$03$lcssa = $l$03; //@line 4663
     break;
    }
    $28 = FUNCTION_TABLE_iiii[HEAP32[$24 >> 2] & 7]($f, $dest$02, $l$03) | 0; //@line 4667
    if (($28 + 1 | 0) >>> 0 < 2) {
     $l$03$lcssa = $l$03; //@line 4671
     break;
    }
    if (($l$03 | 0) == ($28 | 0)) {
     label = 13; //@line 4678
     break L7;
    } else {
     $dest$02 = $dest$02 + $28 | 0; //@line 4681
     $l$03 = $l$03 - $28 | 0; //@line 4681
    }
   }
   if ($32) {
    ___unlockfile($f); //@line 4686
   }
   $$0 = (($0 - $l$03$lcssa | 0) >>> 0) / ($size >>> 0) | 0; //@line 4690
  }
 } while (0);
 if ((label | 0) == 13) {
  if (!$32) {
   $$0 = $nmemb; //@line 4696
  } else {
   ___unlockfile($f); //@line 4698
   $$0 = $nmemb; //@line 4699
  }
 }
 return $$0 | 0; //@line 4702
}
function ___strchrnul($s, $c) {
 $s = $s | 0;
 $c = $c | 0;
 var $$0 = 0, $$02$lcssa = 0, $$0211 = 0, $$1 = 0, $0 = 0, $11 = 0, $15 = 0, $16 = 0, $22 = 0, $23 = 0, $29 = 0, $36 = 0, $37 = 0, $5 = 0, $8 = 0, $w$0$lcssa = 0, $w$08 = 0;
 $0 = $c & 255; //@line 6727
 L1 : do {
  if (!$0) {
   $$0 = $s + (_strlen($s) | 0) | 0; //@line 6733
  } else {
   if (!($s & 3)) {
    $$02$lcssa = $s; //@line 6739
   } else {
    $5 = $c & 255; //@line 6741
    $$0211 = $s; //@line 6742
    while (1) {
     $8 = HEAP8[$$0211 >> 0] | 0; //@line 6744
     if ($8 << 24 >> 24 == 0 ? 1 : $8 << 24 >> 24 == $5 << 24 >> 24) {
      $$0 = $$0211; //@line 6749
      break L1;
     }
     $11 = $$0211 + 1 | 0; //@line 6752
     if (!($11 & 3)) {
      $$02$lcssa = $11; //@line 6757
      break;
     } else {
      $$0211 = $11; //@line 6760
     }
    }
   }
   $15 = Math_imul($0, 16843009) | 0; //@line 6764
   $16 = HEAP32[$$02$lcssa >> 2] | 0; //@line 6765
   L10 : do {
    if (!(($16 & -2139062144 ^ -2139062144) & $16 + -16843009)) {
     $23 = $16; //@line 6773
     $w$08 = $$02$lcssa; //@line 6773
     while (1) {
      $22 = $23 ^ $15; //@line 6775
      if (($22 & -2139062144 ^ -2139062144) & $22 + -16843009) {
       $w$0$lcssa = $w$08; //@line 6782
       break L10;
      }
      $29 = $w$08 + 4 | 0; //@line 6785
      $23 = HEAP32[$29 >> 2] | 0; //@line 6786
      if (($23 & -2139062144 ^ -2139062144) & $23 + -16843009) {
       $w$0$lcssa = $29; //@line 6795
       break;
      } else {
       $w$08 = $29; //@line 6793
      }
     }
    } else {
     $w$0$lcssa = $$02$lcssa; //@line 6800
    }
   } while (0);
   $36 = $c & 255; //@line 6803
   $$1 = $w$0$lcssa; //@line 6804
   while (1) {
    $37 = HEAP8[$$1 >> 0] | 0; //@line 6806
    if ($37 << 24 >> 24 == 0 ? 1 : $37 << 24 >> 24 == $36 << 24 >> 24) {
     $$0 = $$1; //@line 6812
     break;
    } else {
     $$1 = $$1 + 1 | 0; //@line 6815
    }
   }
  }
 } while (0);
 return $$0 | 0; //@line 6820
}
function _tmpnam($s) {
 $s = $s | 0;
 var $$0 = 0, $0 = 0, $10 = 0, $11 = 0, $15 = 0, $4 = 0, $5 = 0, $8 = 0, $try$0 = 0, $try$1 = 0, $ts = 0, $vararg_buffer = 0, $vararg_buffer11 = 0, $vararg_buffer2 = 0, $vararg_buffer7 = 0, sp = 0;
 sp = STACKTOP; //@line 5264
 STACKTOP = STACKTOP + 64 | 0; //@line 5265
 $vararg_buffer11 = sp + 32 | 0; //@line 5266
 $vararg_buffer7 = sp + 24 | 0; //@line 5267
 $vararg_buffer2 = sp + 8 | 0; //@line 5268
 $vararg_buffer = sp; //@line 5269
 $0 = sp + 48 | 0; //@line 5270
 $ts = sp + 40 | 0; //@line 5271
 HEAP32[$0 >> 2] = ($s | 0) == 0 ? 3846 : $s; //@line 5274
 HEAP32[$vararg_buffer >> 2] = 3866; //@line 5275
 HEAP32[$vararg_buffer + 4 >> 2] = 7; //@line 5277
 if (!(___syscall33(33, $vararg_buffer | 0) | 0)) {
  $4 = $ts + 4 | 0; //@line 5281
  $5 = $0; //@line 5282
  $try$0 = 0; //@line 5283
  while (1) {
   HEAP32[$vararg_buffer2 >> 2] = 0; //@line 5285
   HEAP32[$vararg_buffer2 + 4 >> 2] = $ts; //@line 5287
   HEAP32[$vararg_buffer2 + 8 >> 2] = 0; //@line 5289
   ___syscall265(265, $vararg_buffer2 | 0) | 0; //@line 5290
   $8 = HEAP32[$0 >> 2] | 0; //@line 5293
   $10 = HEAP32[$4 >> 2] ^ $5 ^ $8; //@line 5295
   $11 = HEAP32[78] | 0; //@line 5296
   HEAP32[78] = $11 + 1; //@line 5296
   HEAP32[$vararg_buffer7 >> 2] = $11; //@line 5297
   HEAP32[$vararg_buffer7 + 4 >> 2] = $10; //@line 5299
   _snprintf($8, 20, 3871, $vararg_buffer7) | 0; //@line 5300
   HEAP32[$vararg_buffer11 >> 2] = HEAP32[$0 >> 2]; //@line 5302
   HEAP32[$vararg_buffer11 + 4 >> 2] = 0; //@line 5304
   if (___syscall33(33, $vararg_buffer11 | 0) | 0) {
    $try$1 = $try$0; //@line 5308
    break;
   }
   $15 = $try$0 + 1 | 0; //@line 5311
   if (($try$0 | 0) < 100) {
    $try$0 = $15; //@line 5314
   } else {
    $try$1 = $15; //@line 5316
    break;
   }
  }
  $$0 = ($try$1 | 0) > 99 ? 0 : HEAP32[$0 >> 2] | 0; //@line 5323
 } else {
  $$0 = 0; //@line 5325
 }
 STACKTOP = sp; //@line 5327
 return $$0 | 0; //@line 5327
}
function ___fwritex($s, $l, $f) {
 $s = $s | 0;
 $l = $l | 0;
 $f = $f | 0;
 var $$0 = 0, $$01 = 0, $$02 = 0, $0 = 0, $1 = 0, $19 = 0, $29 = 0, $5 = 0, $6 = 0, $8 = 0, $i$0 = 0, $i$0$lcssa10 = 0, $i$1 = 0, label = 0;
 $0 = $f + 16 | 0; //@line 4897
 $1 = HEAP32[$0 >> 2] | 0; //@line 4898
 if (!$1) {
  if (!(___towrite($f) | 0)) {
   $8 = HEAP32[$0 >> 2] | 0; //@line 4905
   label = 4; //@line 4906
  } else {
   $$0 = 0; //@line 4908
  }
 } else {
  $8 = $1; //@line 4911
  label = 4; //@line 4912
 }
 L4 : do {
  if ((label | 0) == 4) {
   $5 = $f + 20 | 0; //@line 4916
   $6 = HEAP32[$5 >> 2] | 0; //@line 4917
   if (($8 - $6 | 0) >>> 0 < $l >>> 0) {
    $$0 = FUNCTION_TABLE_iiii[HEAP32[$f + 36 >> 2] & 7]($f, $s, $l) | 0; //@line 4926
    break;
   }
   L9 : do {
    if ((HEAP8[$f + 75 >> 0] | 0) > -1) {
     $i$0 = $l; //@line 4934
     while (1) {
      if (!$i$0) {
       $$01 = $l; //@line 4938
       $$02 = $s; //@line 4938
       $29 = $6; //@line 4938
       $i$1 = 0; //@line 4938
       break L9;
      }
      $19 = $i$0 + -1 | 0; //@line 4941
      if ((HEAP8[$s + $19 >> 0] | 0) == 10) {
       $i$0$lcssa10 = $i$0; //@line 4946
       break;
      } else {
       $i$0 = $19; //@line 4949
      }
     }
     if ((FUNCTION_TABLE_iiii[HEAP32[$f + 36 >> 2] & 7]($f, $s, $i$0$lcssa10) | 0) >>> 0 < $i$0$lcssa10 >>> 0) {
      $$0 = $i$0$lcssa10; //@line 4957
      break L4;
     }
     $$01 = $l - $i$0$lcssa10 | 0; //@line 4963
     $$02 = $s + $i$0$lcssa10 | 0; //@line 4963
     $29 = HEAP32[$5 >> 2] | 0; //@line 4963
     $i$1 = $i$0$lcssa10; //@line 4963
    } else {
     $$01 = $l; //@line 4965
     $$02 = $s; //@line 4965
     $29 = $6; //@line 4965
     $i$1 = 0; //@line 4965
    }
   } while (0);
   _memcpy($29 | 0, $$02 | 0, $$01 | 0) | 0; //@line 4968
   HEAP32[$5 >> 2] = (HEAP32[$5 >> 2] | 0) + $$01; //@line 4971
   $$0 = $i$1 + $$01 | 0; //@line 4973
  }
 } while (0);
 return $$0 | 0; //@line 4976
}
function ___shgetc($f) {
 $f = $f | 0;
 var $$0 = 0, $$phi$trans$insert = 0, $$pre = 0, $$pre4 = 0, $0 = 0, $1 = 0, $12 = 0, $14 = 0, $15 = 0, $21 = 0, $26 = 0, $28 = 0, $31 = 0, $36 = 0, $41 = 0, $6 = 0, $9 = 0, label = 0;
 $0 = $f + 104 | 0; //@line 2707
 $1 = HEAP32[$0 >> 2] | 0; //@line 2708
 if (!$1) {
  label = 3; //@line 2711
 } else {
  if ((HEAP32[$f + 108 >> 2] | 0) < ($1 | 0)) {
   label = 3; //@line 2717
  } else {
   label = 4; //@line 2719
  }
 }
 if ((label | 0) == 3) {
  $6 = ___uflow($f) | 0; //@line 2723
  if (($6 | 0) < 0) {
   label = 4; //@line 2726
  } else {
   $9 = HEAP32[$0 >> 2] | 0; //@line 2728
   $$phi$trans$insert = $f + 8 | 0; //@line 2730
   if (!$9) {
    $$pre = HEAP32[$$phi$trans$insert >> 2] | 0; //@line 2732
    $26 = $$pre; //@line 2734
    $41 = $$pre; //@line 2734
    label = 9; //@line 2735
   } else {
    $12 = HEAP32[$$phi$trans$insert >> 2] | 0; //@line 2737
    $14 = HEAP32[$f + 4 >> 2] | 0; //@line 2739
    $15 = $12; //@line 2740
    $21 = $9 - (HEAP32[$f + 108 >> 2] | 0) + -1 | 0; //@line 2746
    if (($15 - $14 | 0) > ($21 | 0)) {
     HEAP32[$f + 100 >> 2] = $14 + $21; //@line 2751
     $28 = $12; //@line 2752
    } else {
     $26 = $15; //@line 2754
     $41 = $12; //@line 2754
     label = 9; //@line 2755
    }
   }
   if ((label | 0) == 9) {
    HEAP32[$f + 100 >> 2] = $26; //@line 2760
    $28 = $41; //@line 2761
   }
   $$pre4 = HEAP32[$f + 4 >> 2] | 0; //@line 2765
   if ($28) {
    $31 = $f + 108 | 0; //@line 2769
    HEAP32[$31 >> 2] = $28 + 1 - $$pre4 + (HEAP32[$31 >> 2] | 0); //@line 2774
   }
   $36 = $$pre4 + -1 | 0; //@line 2776
   if ((HEAPU8[$36 >> 0] | 0 | 0) == ($6 | 0)) {
    $$0 = $6; //@line 2781
   } else {
    HEAP8[$36 >> 0] = $6; //@line 2784
    $$0 = $6; //@line 2785
   }
  }
 }
 if ((label | 0) == 4) {
  HEAP32[$f + 100 >> 2] = 0; //@line 2791
  $$0 = -1; //@line 2792
 }
 return $$0 | 0; //@line 2794
}
function _vsnprintf($s, $n, $fmt, $ap) {
 $s = $s | 0;
 $n = $n | 0;
 $fmt = $fmt | 0;
 $ap = $ap | 0;
 var $$$02 = 0, $$0 = 0, $$01 = 0, $$02 = 0, $10 = 0, $11 = 0, $13 = 0, $15 = 0, $5 = 0, $8 = 0, $b = 0, $f = 0, dest = 0, label = 0, sp = 0, src = 0, stop = 0;
 sp = STACKTOP; //@line 6487
 STACKTOP = STACKTOP + 128 | 0; //@line 6488
 $b = sp + 112 | 0; //@line 6489
 $f = sp; //@line 6490
 dest = $f; //@line 6491
 src = 316; //@line 6491
 stop = dest + 112 | 0; //@line 6491
 do {
  HEAP32[dest >> 2] = HEAP32[src >> 2]; //@line 6491
  dest = dest + 4 | 0; //@line 6491
  src = src + 4 | 0; //@line 6491
 } while ((dest | 0) < (stop | 0));
 if (($n + -1 | 0) >>> 0 > 2147483646) {
  if (!$n) {
   $$01 = $b; //@line 6497
   $$02 = 1; //@line 6497
   label = 4; //@line 6498
  } else {
   HEAP32[(___errno_location() | 0) >> 2] = 75; //@line 6501
   $$0 = -1; //@line 6502
  }
 } else {
  $$01 = $s; //@line 6505
  $$02 = $n; //@line 6505
  label = 4; //@line 6506
 }
 if ((label | 0) == 4) {
  $5 = -2 - $$01 | 0; //@line 6510
  $$$02 = $$02 >>> 0 > $5 >>> 0 ? $5 : $$02; //@line 6512
  HEAP32[$f + 48 >> 2] = $$$02; //@line 6514
  $8 = $f + 20 | 0; //@line 6515
  HEAP32[$8 >> 2] = $$01; //@line 6516
  HEAP32[$f + 44 >> 2] = $$01; //@line 6518
  $10 = $$01 + $$$02 | 0; //@line 6519
  $11 = $f + 16 | 0; //@line 6520
  HEAP32[$11 >> 2] = $10; //@line 6521
  HEAP32[$f + 28 >> 2] = $10; //@line 6523
  $13 = _vfprintf($f, $fmt, $ap) | 0; //@line 6524
  if (!$$$02) {
   $$0 = $13; //@line 6527
  } else {
   $15 = HEAP32[$8 >> 2] | 0; //@line 6529
   HEAP8[$15 + ((($15 | 0) == (HEAP32[$11 >> 2] | 0)) << 31 >> 31) >> 0] = 0; //@line 6534
   $$0 = $13; //@line 6535
  }
 }
 STACKTOP = sp; //@line 6538
 return $$0 | 0; //@line 6538
}
function ___mkostemps($template, $len, $flags) {
 $template = $template | 0;
 $len = $len | 0;
 $flags = $flags | 0;
 var $$0 = 0, $0 = 0, $4 = 0, $7 = 0, $9 = 0, $retries$0 = 0, $vararg_buffer = 0, label = 0, sp = 0;
 sp = STACKTOP; //@line 7028
 STACKTOP = STACKTOP + 16 | 0; //@line 7029
 $vararg_buffer = sp; //@line 7030
 $0 = _strlen($template) | 0; //@line 7031
 L1 : do {
  if ($0 >>> 0 < 6 | ($0 + -6 | 0) >>> 0 < $len >>> 0) {
   label = 4; //@line 7038
  } else {
   $4 = $template + (-6 - $len + $0) | 0; //@line 7042
   if (!(_memcmp($4, 3883, 6) | 0)) {
    $7 = $flags | 194; //@line 7046
    $retries$0 = 100; //@line 7047
    do {
     ___randname($4) | 0; //@line 7049
     HEAP32[$vararg_buffer >> 2] = 384; //@line 7050
     $9 = _open($template, $7, $vararg_buffer) | 0; //@line 7051
     if (($9 | 0) > -1) {
      $$0 = $9; //@line 7054
      break L1;
     }
     $retries$0 = $retries$0 + -1 | 0; //@line 7057
     if (!$retries$0) {
      break;
     }
    } while ((HEAP32[(___errno_location() | 0) >> 2] | 0) == 17);
    HEAP8[$4 >> 0] = HEAP8[3883] | 0; //@line 7071
    HEAP8[$4 + 1 >> 0] = HEAP8[3884] | 0; //@line 7071
    HEAP8[$4 + 2 >> 0] = HEAP8[3885] | 0; //@line 7071
    HEAP8[$4 + 3 >> 0] = HEAP8[3886] | 0; //@line 7071
    HEAP8[$4 + 4 >> 0] = HEAP8[3887] | 0; //@line 7071
    HEAP8[$4 + 5 >> 0] = HEAP8[3888] | 0; //@line 7071
    $$0 = -1; //@line 7072
   } else {
    label = 4; //@line 7074
   }
  }
 } while (0);
 if ((label | 0) == 4) {
  HEAP32[(___errno_location() | 0) >> 2] = 22; //@line 7080
  $$0 = -1; //@line 7081
 }
 STACKTOP = sp; //@line 7083
 return $$0 | 0; //@line 7083
}
function _fflush($f) {
 $f = $f | 0;
 var $$0 = 0, $$012 = 0, $$014 = 0, $24 = 0, $27 = 0, $6 = 0, $phitmp = 0, $r$0$lcssa = 0, $r$03 = 0, $r$1 = 0;
 do {
  if (!$f) {
   if (!(HEAP32[67] | 0)) {
    $27 = 0; //@line 4201
   } else {
    $27 = _fflush(HEAP32[67] | 0) | 0; //@line 4205
   }
   ___lock(36); //@line 4207
   $$012 = HEAP32[8] | 0; //@line 4208
   if (!$$012) {
    $r$0$lcssa = $27; //@line 4211
   } else {
    $$014 = $$012; //@line 4213
    $r$03 = $27; //@line 4213
    while (1) {
     if ((HEAP32[$$014 + 76 >> 2] | 0) > -1) {
      $24 = ___lockfile($$014) | 0; //@line 4220
     } else {
      $24 = 0; //@line 4222
     }
     if ((HEAP32[$$014 + 20 >> 2] | 0) >>> 0 > (HEAP32[$$014 + 28 >> 2] | 0) >>> 0) {
      $r$1 = ___fflush_unlocked($$014) | 0 | $r$03; //@line 4232
     } else {
      $r$1 = $r$03; //@line 4234
     }
     if ($24) {
      ___unlockfile($$014); //@line 4238
     }
     $$014 = HEAP32[$$014 + 56 >> 2] | 0; //@line 4241
     if (!$$014) {
      $r$0$lcssa = $r$1; //@line 4244
      break;
     } else {
      $r$03 = $r$1; //@line 4247
     }
    }
   }
   ___unlock(36); //@line 4251
   $$0 = $r$0$lcssa; //@line 4252
  } else {
   if ((HEAP32[$f + 76 >> 2] | 0) <= -1) {
    $$0 = ___fflush_unlocked($f) | 0; //@line 4259
    break;
   }
   $phitmp = (___lockfile($f) | 0) == 0; //@line 4263
   $6 = ___fflush_unlocked($f) | 0; //@line 4264
   if ($phitmp) {
    $$0 = $6; //@line 4266
   } else {
    ___unlockfile($f); //@line 4268
    $$0 = $6; //@line 4269
   }
  }
 } while (0);
 return $$0 | 0; //@line 4273
}
function _fmt_u($0, $1, $s) {
 $0 = $0 | 0;
 $1 = $1 | 0;
 $s = $s | 0;
 var $$0$lcssa = 0, $$01$lcssa$off0 = 0, $$05 = 0, $$1$lcssa = 0, $$12 = 0, $$lcssa20 = 0, $13 = 0, $14 = 0, $25 = 0, $28 = 0, $7 = 0, $8 = 0, $9 = 0, $y$03 = 0;
 if ($1 >>> 0 > 0 | ($1 | 0) == 0 & $0 >>> 0 > 4294967295) {
  $$05 = $s; //@line 9708
  $7 = $0; //@line 9708
  $8 = $1; //@line 9708
  while (1) {
   $9 = ___uremdi3($7 | 0, $8 | 0, 10, 0) | 0; //@line 9710
   $13 = $$05 + -1 | 0; //@line 9714
   HEAP8[$13 >> 0] = $9 | 48; //@line 9715
   $14 = ___udivdi3($7 | 0, $8 | 0, 10, 0) | 0; //@line 9716
   if ($8 >>> 0 > 9 | ($8 | 0) == 9 & $7 >>> 0 > 4294967295) {
    $$05 = $13; //@line 9724
    $7 = $14; //@line 9724
    $8 = tempRet0; //@line 9724
   } else {
    $$lcssa20 = $13; //@line 9726
    $28 = $14; //@line 9726
    break;
   }
  }
  $$0$lcssa = $$lcssa20; //@line 9730
  $$01$lcssa$off0 = $28; //@line 9730
 } else {
  $$0$lcssa = $s; //@line 9732
  $$01$lcssa$off0 = $0; //@line 9732
 }
 if (!$$01$lcssa$off0) {
  $$1$lcssa = $$0$lcssa; //@line 9736
 } else {
  $$12 = $$0$lcssa; //@line 9738
  $y$03 = $$01$lcssa$off0; //@line 9738
  while (1) {
   $25 = $$12 + -1 | 0; //@line 9743
   HEAP8[$25 >> 0] = ($y$03 >>> 0) % 10 | 0 | 48; //@line 9744
   if ($y$03 >>> 0 < 10) {
    $$1$lcssa = $25; //@line 9748
    break;
   } else {
    $$12 = $25; //@line 9751
    $y$03 = ($y$03 >>> 0) / 10 | 0; //@line 9751
   }
  }
 }
 return $$1$lcssa | 0; //@line 9755
}
function _strlen($s) {
 $s = $s | 0;
 var $$01$lcssa = 0, $$014 = 0, $$1$lcssa = 0, $$lcssa20 = 0, $$pn = 0, $$pn15 = 0, $0 = 0, $18 = 0, $21 = 0, $5 = 0, $9 = 0, $w$0 = 0, $w$0$lcssa = 0, label = 0;
 $0 = $s; //@line 6863
 L1 : do {
  if (!($0 & 3)) {
   $$01$lcssa = $s; //@line 6868
   label = 4; //@line 6869
  } else {
   $$014 = $s; //@line 6871
   $21 = $0; //@line 6871
   while (1) {
    if (!(HEAP8[$$014 >> 0] | 0)) {
     $$pn = $21; //@line 6876
     break L1;
    }
    $5 = $$014 + 1 | 0; //@line 6879
    $21 = $5; //@line 6880
    if (!($21 & 3)) {
     $$01$lcssa = $5; //@line 6884
     label = 4; //@line 6885
     break;
    } else {
     $$014 = $5; //@line 6888
    }
   }
  }
 } while (0);
 if ((label | 0) == 4) {
  $w$0 = $$01$lcssa; //@line 6894
  while (1) {
   $9 = HEAP32[$w$0 >> 2] | 0; //@line 6896
   if (!(($9 & -2139062144 ^ -2139062144) & $9 + -16843009)) {
    $w$0 = $w$0 + 4 | 0; //@line 6904
   } else {
    $$lcssa20 = $9; //@line 6906
    $w$0$lcssa = $w$0; //@line 6906
    break;
   }
  }
  if (!(($$lcssa20 & 255) << 24 >> 24)) {
   $$1$lcssa = $w$0$lcssa; //@line 6913
  } else {
   $$pn15 = $w$0$lcssa; //@line 6915
   while (1) {
    $18 = $$pn15 + 1 | 0; //@line 6917
    if (!(HEAP8[$18 >> 0] | 0)) {
     $$1$lcssa = $18; //@line 6921
     break;
    } else {
     $$pn15 = $18; //@line 6924
    }
   }
  }
  $$pn = $$1$lcssa; //@line 6929
 }
 return $$pn - $0 | 0; //@line 6932
}
function _pad($f, $c, $w, $l, $fl) {
 $f = $f | 0;
 $c = $c | 0;
 $w = $w | 0;
 $l = $l | 0;
 $fl = $fl | 0;
 var $$0$lcssa6 = 0, $$02 = 0, $10 = 0, $14 = 0, $17 = 0, $18 = 0, $3 = 0, $7 = 0, $9 = 0, $pad = 0, sp = 0;
 sp = STACKTOP; //@line 9765
 STACKTOP = STACKTOP + 256 | 0; //@line 9766
 $pad = sp; //@line 9767
 do {
  if (($w | 0) > ($l | 0) & ($fl & 73728 | 0) == 0) {
   $3 = $w - $l | 0; //@line 9774
   _memset($pad | 0, $c | 0, ($3 >>> 0 > 256 ? 256 : $3) | 0) | 0; //@line 9777
   $7 = HEAP32[$f >> 2] | 0; //@line 9779
   $9 = ($7 & 32 | 0) == 0; //@line 9781
   if ($3 >>> 0 > 255) {
    $10 = $w - $l | 0; //@line 9783
    $$02 = $3; //@line 9784
    $17 = $7; //@line 9784
    $18 = $9; //@line 9784
    while (1) {
     if ($18) {
      ___fwritex($pad, 256, $f) | 0; //@line 9787
      $14 = HEAP32[$f >> 2] | 0; //@line 9789
     } else {
      $14 = $17; //@line 9791
     }
     $$02 = $$02 + -256 | 0; //@line 9793
     $18 = ($14 & 32 | 0) == 0; //@line 9796
     if ($$02 >>> 0 <= 255) {
      break;
     } else {
      $17 = $14; //@line 9798
     }
    }
    if ($18) {
     $$0$lcssa6 = $10 & 255; //@line 9805
    } else {
     break;
    }
   } else {
    if ($9) {
     $$0$lcssa6 = $3; //@line 9811
    } else {
     break;
    }
   }
   ___fwritex($pad, $$0$lcssa6, $f) | 0; //@line 9816
  }
 } while (0);
 STACKTOP = sp; //@line 9819
 return;
}
function _fputc($c, $f) {
 $c = $c | 0;
 $f = $f | 0;
 var $$0 = 0, $10 = 0, $22 = 0, $23 = 0, $31 = 0, $9 = 0, label = 0;
 if ((HEAP32[$f + 76 >> 2] | 0) < 0) {
  label = 3; //@line 4530
 } else {
  if (!(___lockfile($f) | 0)) {
   label = 3; //@line 4535
  } else {
   if ((HEAP8[$f + 75 >> 0] | 0) == ($c | 0)) {
    label = 10; //@line 4542
   } else {
    $22 = $f + 20 | 0; //@line 4544
    $23 = HEAP32[$22 >> 2] | 0; //@line 4545
    if ($23 >>> 0 < (HEAP32[$f + 16 >> 2] | 0) >>> 0) {
     HEAP32[$22 >> 2] = $23 + 1; //@line 4552
     HEAP8[$23 >> 0] = $c; //@line 4553
     $31 = $c & 255; //@line 4555
    } else {
     label = 10; //@line 4557
    }
   }
   if ((label | 0) == 10) {
    $31 = ___overflow($f, $c) | 0; //@line 4562
   }
   ___unlockfile($f); //@line 4564
   $$0 = $31; //@line 4565
  }
 }
 do {
  if ((label | 0) == 3) {
   if ((HEAP8[$f + 75 >> 0] | 0) != ($c | 0)) {
    $9 = $f + 20 | 0; //@line 4575
    $10 = HEAP32[$9 >> 2] | 0; //@line 4576
    if ($10 >>> 0 < (HEAP32[$f + 16 >> 2] | 0) >>> 0) {
     HEAP32[$9 >> 2] = $10 + 1; //@line 4583
     HEAP8[$10 >> 0] = $c; //@line 4584
     $$0 = $c & 255; //@line 4586
     break;
    }
   }
   $$0 = ___overflow($f, $c) | 0; //@line 4591
  }
 } while (0);
 return $$0 | 0; //@line 4594
}
function _putc($c, $f) {
 $c = $c | 0;
 $f = $f | 0;
 var $$0 = 0, $10 = 0, $22 = 0, $23 = 0, $31 = 0, $9 = 0, label = 0;
 if ((HEAP32[$f + 76 >> 2] | 0) < 0) {
  label = 3; //@line 5053
 } else {
  if (!(___lockfile($f) | 0)) {
   label = 3; //@line 5058
  } else {
   if ((HEAP8[$f + 75 >> 0] | 0) == ($c | 0)) {
    label = 10; //@line 5065
   } else {
    $22 = $f + 20 | 0; //@line 5067
    $23 = HEAP32[$22 >> 2] | 0; //@line 5068
    if ($23 >>> 0 < (HEAP32[$f + 16 >> 2] | 0) >>> 0) {
     HEAP32[$22 >> 2] = $23 + 1; //@line 5075
     HEAP8[$23 >> 0] = $c; //@line 5076
     $31 = $c & 255; //@line 5078
    } else {
     label = 10; //@line 5080
    }
   }
   if ((label | 0) == 10) {
    $31 = ___overflow($f, $c) | 0; //@line 5085
   }
   ___unlockfile($f); //@line 5087
   $$0 = $31; //@line 5088
  }
 }
 do {
  if ((label | 0) == 3) {
   if ((HEAP8[$f + 75 >> 0] | 0) != ($c | 0)) {
    $9 = $f + 20 | 0; //@line 5098
    $10 = HEAP32[$9 >> 2] | 0; //@line 5099
    if ($10 >>> 0 < (HEAP32[$f + 16 >> 2] | 0) >>> 0) {
     HEAP32[$9 >> 2] = $10 + 1; //@line 5106
     HEAP8[$10 >> 0] = $c; //@line 5107
     $$0 = $c & 255; //@line 5109
     break;
    }
   }
   $$0 = ___overflow($f, $c) | 0; //@line 5114
  }
 } while (0);
 return $$0 | 0; //@line 5117
}
function _tmpfile() {
 var $$0 = 0, $$lcssa = 0, $$lcssa7 = 0, $2 = 0, $5 = 0, $7 = 0, $buf = 0, $try$02 = 0, $vararg_buffer = 0, $vararg_buffer3 = 0, label = 0, sp = 0;
 sp = STACKTOP; //@line 5217
 STACKTOP = STACKTOP + 48 | 0; //@line 5218
 $vararg_buffer3 = sp + 16 | 0; //@line 5219
 $vararg_buffer = sp; //@line 5220
 $buf = sp + 20 | 0; //@line 5221
 $try$02 = 0; //@line 5222
 while (1) {
  $2 = _tmpnam($buf) | 0; //@line 5224
  if (!$2) {
   $$0 = 0; //@line 5227
   break;
  }
  HEAP32[$vararg_buffer >> 2] = $2; //@line 5230
  HEAP32[$vararg_buffer + 4 >> 2] = 32962; //@line 5232
  HEAP32[$vararg_buffer + 8 >> 2] = 384; //@line 5234
  $5 = ___syscall_ret(___syscall5(5, $vararg_buffer | 0) | 0) | 0; //@line 5236
  $try$02 = $try$02 + 1 | 0; //@line 5238
  if (($5 | 0) > -1) {
   $$lcssa = $5; //@line 5240
   $$lcssa7 = $2; //@line 5240
   label = 5; //@line 5241
   break;
  }
  if (($try$02 | 0) >= 100) {
   $$0 = 0; //@line 5248
   break;
  }
 }
 if ((label | 0) == 5) {
  $7 = ___fdopen($$lcssa, 3843) | 0; //@line 5253
  HEAP32[$vararg_buffer3 >> 2] = $$lcssa7; //@line 5254
  ___syscall10(10, $vararg_buffer3 | 0) | 0; //@line 5255
  $$0 = $7; //@line 5256
 }
 STACKTOP = sp; //@line 5258
 return $$0 | 0; //@line 5258
}
function _strncmp($_l, $_r, $n) {
 $_l = $_l | 0;
 $_r = $_r | 0;
 $n = $n | 0;
 var $$03 = 0, $$08$in = 0, $1 = 0, $13 = 0, $3 = 0, $7 = 0, $9 = 0, $l$06 = 0, $r$0$lcssa = 0, $r$07 = 0;
 if (!$n) {
  $$03 = 0; //@line 6943
 } else {
  $1 = HEAP8[$_l >> 0] | 0; //@line 6945
  L3 : do {
   if (!($1 << 24 >> 24)) {
    $13 = 0; //@line 6949
    $r$0$lcssa = $_r; //@line 6949
   } else {
    $$08$in = $n; //@line 6951
    $7 = $1; //@line 6951
    $l$06 = $_l; //@line 6951
    $r$07 = $_r; //@line 6951
    while (1) {
     $$08$in = $$08$in + -1 | 0; //@line 6953
     $3 = HEAP8[$r$07 >> 0] | 0; //@line 6954
     if (!($7 << 24 >> 24 == $3 << 24 >> 24 & (($$08$in | 0) != 0 & $3 << 24 >> 24 != 0))) {
      $13 = $7; //@line 6961
      $r$0$lcssa = $r$07; //@line 6961
      break L3;
     }
     $l$06 = $l$06 + 1 | 0; //@line 6964
     $9 = $r$07 + 1 | 0; //@line 6965
     $7 = HEAP8[$l$06 >> 0] | 0; //@line 6966
     if (!($7 << 24 >> 24)) {
      $13 = 0; //@line 6969
      $r$0$lcssa = $9; //@line 6969
      break;
     } else {
      $r$07 = $9; //@line 6972
     }
    }
   }
  } while (0);
  $$03 = ($13 & 255) - (HEAPU8[$r$0$lcssa >> 0] | 0) | 0; //@line 6981
 }
 return $$03 | 0; //@line 6983
}
function ___overflow($f, $_c) {
 $f = $f | 0;
 $_c = $_c | 0;
 var $$0 = 0, $0 = 0, $1 = 0, $10 = 0, $2 = 0, $6 = 0, $7 = 0, $9 = 0, $c = 0, label = 0, sp = 0;
 sp = STACKTOP; //@line 3623
 STACKTOP = STACKTOP + 16 | 0; //@line 3624
 $c = sp; //@line 3625
 $0 = $_c & 255; //@line 3626
 HEAP8[$c >> 0] = $0; //@line 3627
 $1 = $f + 16 | 0; //@line 3628
 $2 = HEAP32[$1 >> 2] | 0; //@line 3629
 if (!$2) {
  if (!(___towrite($f) | 0)) {
   $9 = HEAP32[$1 >> 2] | 0; //@line 3636
   label = 4; //@line 3637
  } else {
   $$0 = -1; //@line 3639
  }
 } else {
  $9 = $2; //@line 3642
  label = 4; //@line 3643
 }
 do {
  if ((label | 0) == 4) {
   $6 = $f + 20 | 0; //@line 3647
   $7 = HEAP32[$6 >> 2] | 0; //@line 3648
   if ($7 >>> 0 < $9 >>> 0) {
    $10 = $_c & 255; //@line 3651
    if (($10 | 0) != (HEAP8[$f + 75 >> 0] | 0)) {
     HEAP32[$6 >> 2] = $7 + 1; //@line 3658
     HEAP8[$7 >> 0] = $0; //@line 3659
     $$0 = $10; //@line 3660
     break;
    }
   }
   if ((FUNCTION_TABLE_iiii[HEAP32[$f + 36 >> 2] & 7]($f, $c, 1) | 0) == 1) {
    $$0 = HEAPU8[$c >> 0] | 0; //@line 3671
   } else {
    $$0 = -1; //@line 3673
   }
  }
 } while (0);
 STACKTOP = sp; //@line 3677
 return $$0 | 0; //@line 3677
}
function _scalbn($x, $n) {
 $x = +$x;
 $n = $n | 0;
 var $$0 = 0, $1 = 0.0, $12 = 0, $15 = 0, $16 = 0, $2 = 0, $5 = 0, $8 = 0.0, $9 = 0, $y$0 = 0.0;
 if (($n | 0) > 1023) {
  $1 = $x * 8.98846567431158e+307; //@line 3153
  $2 = $n + -1023 | 0; //@line 3154
  if (($2 | 0) > 1023) {
   $5 = $n + -2046 | 0; //@line 3158
   $$0 = ($5 | 0) > 1023 ? 1023 : $5; //@line 3161
   $y$0 = $1 * 8.98846567431158e+307; //@line 3161
  } else {
   $$0 = $2; //@line 3163
   $y$0 = $1; //@line 3163
  }
 } else {
  if (($n | 0) < -1022) {
   $8 = $x * 2.2250738585072014e-308; //@line 3168
   $9 = $n + 1022 | 0; //@line 3169
   if (($9 | 0) < -1022) {
    $12 = $n + 2044 | 0; //@line 3173
    $$0 = ($12 | 0) < -1022 ? -1022 : $12; //@line 3176
    $y$0 = $8 * 2.2250738585072014e-308; //@line 3176
   } else {
    $$0 = $9; //@line 3178
    $y$0 = $8; //@line 3178
   }
  } else {
   $$0 = $n; //@line 3181
   $y$0 = $x; //@line 3181
  }
 }
 $15 = _bitshift64Shl($$0 + 1023 | 0, 0, 52) | 0; //@line 3185
 $16 = tempRet0; //@line 3186
 HEAP32[tempDoublePtr >> 2] = $15; //@line 3187
 HEAP32[tempDoublePtr + 4 >> 2] = $16; //@line 3187
 return +($y$0 * +HEAPF64[tempDoublePtr >> 3]);
}
function _strerror($e) {
 $e = $e | 0;
 var $$lcssa = 0, $9 = 0, $i$03 = 0, $i$03$lcssa = 0, $i$12 = 0, $s$0$lcssa = 0, $s$01 = 0, $s$1 = 0, label = 0;
 $i$03 = 0; //@line 313
 while (1) {
  if ((HEAPU8[1672 + $i$03 >> 0] | 0) == ($e | 0)) {
   $i$03$lcssa = $i$03; //@line 320
   label = 2; //@line 321
   break;
  }
  $i$03 = $i$03 + 1 | 0; //@line 324
  if (($i$03 | 0) == 87) {
   $i$12 = 87; //@line 327
   $s$01 = 1760; //@line 327
   label = 5; //@line 328
   break;
  }
 }
 if ((label | 0) == 2) {
  if (!$i$03$lcssa) {
   $s$0$lcssa = 1760; //@line 337
  } else {
   $i$12 = $i$03$lcssa; //@line 339
   $s$01 = 1760; //@line 339
   label = 5; //@line 340
  }
 }
 if ((label | 0) == 5) {
  while (1) {
   label = 0; //@line 345
   $s$1 = $s$01; //@line 346
   while (1) {
    $9 = $s$1 + 1 | 0; //@line 350
    if (!(HEAP8[$s$1 >> 0] | 0)) {
     $$lcssa = $9; //@line 352
     break;
    } else {
     $s$1 = $9; //@line 355
    }
   }
   $i$12 = $i$12 + -1 | 0; //@line 358
   if (!$i$12) {
    $s$0$lcssa = $$lcssa; //@line 361
    break;
   } else {
    $s$01 = $$lcssa; //@line 364
    label = 5; //@line 365
   }
  }
 }
 return $s$0$lcssa | 0; //@line 369
}
function _wcrtomb($s, $wc, $st) {
 $s = $s | 0;
 $wc = $wc | 0;
 $st = $st | 0;
 var $$0 = 0;
 do {
  if (!$s) {
   $$0 = 1; //@line 3351
  } else {
   if ($wc >>> 0 < 128) {
    HEAP8[$s >> 0] = $wc; //@line 3356
    $$0 = 1; //@line 3357
    break;
   }
   if ($wc >>> 0 < 2048) {
    HEAP8[$s >> 0] = $wc >>> 6 | 192; //@line 3366
    HEAP8[$s + 1 >> 0] = $wc & 63 | 128; //@line 3370
    $$0 = 2; //@line 3371
    break;
   }
   if ($wc >>> 0 < 55296 | ($wc & -8192 | 0) == 57344) {
    HEAP8[$s >> 0] = $wc >>> 12 | 224; //@line 3383
    HEAP8[$s + 1 >> 0] = $wc >>> 6 & 63 | 128; //@line 3389
    HEAP8[$s + 2 >> 0] = $wc & 63 | 128; //@line 3393
    $$0 = 3; //@line 3394
    break;
   }
   if (($wc + -65536 | 0) >>> 0 < 1048576) {
    HEAP8[$s >> 0] = $wc >>> 18 | 240; //@line 3404
    HEAP8[$s + 1 >> 0] = $wc >>> 12 & 63 | 128; //@line 3410
    HEAP8[$s + 2 >> 0] = $wc >>> 6 & 63 | 128; //@line 3416
    HEAP8[$s + 3 >> 0] = $wc & 63 | 128; //@line 3420
    $$0 = 4; //@line 3421
    break;
   } else {
    HEAP32[(___errno_location() | 0) >> 2] = 84; //@line 3425
    $$0 = -1; //@line 3426
    break;
   }
  }
 } while (0);
 return $$0 | 0; //@line 3431
}
function _fopen($filename, $mode) {
 $filename = $filename | 0;
 $mode = $mode | 0;
 var $$0 = 0, $5 = 0, $7 = 0, $9 = 0, $vararg_buffer = 0, $vararg_buffer3 = 0, sp = 0;
 sp = STACKTOP; //@line 4481
 STACKTOP = STACKTOP + 32 | 0; //@line 4482
 $vararg_buffer3 = sp + 16 | 0; //@line 4483
 $vararg_buffer = sp; //@line 4484
 if (!(_memchr(3839, HEAP8[$mode >> 0] | 0, 4) | 0)) {
  HEAP32[(___errno_location() | 0) >> 2] = 22; //@line 4491
  $$0 = 0; //@line 4492
 } else {
  $5 = ___fmodeflags($mode) | 0 | 32768; //@line 4495
  HEAP32[$vararg_buffer >> 2] = $filename; //@line 4496
  HEAP32[$vararg_buffer + 4 >> 2] = $5; //@line 4498
  HEAP32[$vararg_buffer + 8 >> 2] = 438; //@line 4500
  $7 = ___syscall_ret(___syscall5(5, $vararg_buffer | 0) | 0) | 0; //@line 4502
  if (($7 | 0) < 0) {
   $$0 = 0; //@line 4505
  } else {
   $9 = ___fdopen($7, $mode) | 0; //@line 4507
   if (!$9) {
    HEAP32[$vararg_buffer3 >> 2] = $7; //@line 4510
    ___syscall6(6, $vararg_buffer3 | 0) | 0; //@line 4511
    $$0 = 0; //@line 4512
   } else {
    $$0 = $9; //@line 4514
   }
  }
 }
 STACKTOP = sp; //@line 4518
 return $$0 | 0; //@line 4518
}
function ___remdi3($a$0, $a$1, $b$0, $b$1) {
 $a$0 = $a$0 | 0;
 $a$1 = $a$1 | 0;
 $b$0 = $b$0 | 0;
 $b$1 = $b$1 | 0;
 var $rem = 0, $1$0 = 0, $1$1 = 0, $2$0 = 0, $2$1 = 0, $4$0 = 0, $4$1 = 0, $10$0 = 0, $10$1 = 0, __stackBase__ = 0;
 __stackBase__ = STACKTOP; //@line 14502
 STACKTOP = STACKTOP + 16 | 0; //@line 14503
 $rem = __stackBase__ | 0; //@line 14504
 $1$0 = $a$1 >> 31 | (($a$1 | 0) < 0 ? -1 : 0) << 1; //@line 14505
 $1$1 = (($a$1 | 0) < 0 ? -1 : 0) >> 31 | (($a$1 | 0) < 0 ? -1 : 0) << 1; //@line 14506
 $2$0 = $b$1 >> 31 | (($b$1 | 0) < 0 ? -1 : 0) << 1; //@line 14507
 $2$1 = (($b$1 | 0) < 0 ? -1 : 0) >> 31 | (($b$1 | 0) < 0 ? -1 : 0) << 1; //@line 14508
 $4$0 = _i64Subtract($1$0 ^ $a$0, $1$1 ^ $a$1, $1$0, $1$1) | 0; //@line 14509
 $4$1 = tempRet0; //@line 14510
 ___udivmoddi4($4$0, $4$1, _i64Subtract($2$0 ^ $b$0, $2$1 ^ $b$1, $2$0, $2$1) | 0, tempRet0, $rem) | 0; //@line 14512
 $10$0 = _i64Subtract(HEAP32[$rem >> 2] ^ $1$0, HEAP32[$rem + 4 >> 2] ^ $1$1, $1$0, $1$1) | 0; //@line 14513
 $10$1 = tempRet0; //@line 14514
 STACKTOP = __stackBase__; //@line 14515
 return (tempRet0 = $10$1, $10$0) | 0; //@line 14516
}
function ___fseeko_unlocked($f, $off, $whence) {
 $f = $f | 0;
 $off = $off | 0;
 $whence = $whence | 0;
 var $$0 = 0, $$01 = 0, $11 = 0, $9 = 0, label = 0;
 if (($whence | 0) == 1) {
  $$01 = $off - (HEAP32[$f + 8 >> 2] | 0) + (HEAP32[$f + 4 >> 2] | 0) | 0; //@line 4733
 } else {
  $$01 = $off; //@line 4735
 }
 $9 = $f + 20 | 0; //@line 4737
 $11 = $f + 28 | 0; //@line 4739
 if ((HEAP32[$9 >> 2] | 0) >>> 0 > (HEAP32[$11 >> 2] | 0) >>> 0) {
  FUNCTION_TABLE_iiii[HEAP32[$f + 36 >> 2] & 7]($f, 0, 0) | 0; //@line 4745
  if (!(HEAP32[$9 >> 2] | 0)) {
   $$0 = -1; //@line 4749
  } else {
   label = 5; //@line 4751
  }
 } else {
  label = 5; //@line 4754
 }
 if ((label | 0) == 5) {
  HEAP32[$f + 16 >> 2] = 0; //@line 4758
  HEAP32[$11 >> 2] = 0; //@line 4759
  HEAP32[$9 >> 2] = 0; //@line 4760
  if ((FUNCTION_TABLE_iiii[HEAP32[$f + 40 >> 2] & 7]($f, $$01, $whence) | 0) < 0) {
   $$0 = -1; //@line 4766
  } else {
   HEAP32[$f + 8 >> 2] = 0; //@line 4769
   HEAP32[$f + 4 >> 2] = 0; //@line 4771
   HEAP32[$f >> 2] = HEAP32[$f >> 2] & -17; //@line 4774
   $$0 = 0; //@line 4775
  }
 }
 return $$0 | 0; //@line 4778
}
function _frexp($x, $e) {
 $x = +$x;
 $e = $e | 0;
 var $$0 = 0.0, $$01 = 0.0, $0 = 0, $1 = 0, $2 = 0, $4 = 0, $7 = 0.0, $storemerge = 0;
 HEAPF64[tempDoublePtr >> 3] = $x; //@line 3101
 $0 = HEAP32[tempDoublePtr >> 2] | 0; //@line 3101
 $1 = HEAP32[tempDoublePtr + 4 >> 2] | 0; //@line 3102
 $2 = _bitshift64Lshr($0 | 0, $1 | 0, 52) | 0; //@line 3103
 $4 = $2 & 2047; //@line 3105
 switch ($4 | 0) {
 case 0:
  {
   if ($x != 0.0) {
    $7 = +_frexp($x * 18446744073709552000.0, $e); //@line 3111
    $$01 = $7; //@line 3114
    $storemerge = (HEAP32[$e >> 2] | 0) + -64 | 0; //@line 3114
   } else {
    $$01 = $x; //@line 3116
    $storemerge = 0; //@line 3116
   }
   HEAP32[$e >> 2] = $storemerge; //@line 3118
   $$0 = $$01; //@line 3119
   break;
  }
 case 2047:
  {
   $$0 = $x; //@line 3123
   break;
  }
 default:
  {
   HEAP32[$e >> 2] = $4 + -1022; //@line 3128
   HEAP32[tempDoublePtr >> 2] = $0; //@line 3131
   HEAP32[tempDoublePtr + 4 >> 2] = $1 & -2146435073 | 1071644672; //@line 3131
   $$0 = +HEAPF64[tempDoublePtr >> 3]; //@line 3132
  }
 }
 return +$$0;
}
function _realloc($oldmem, $bytes) {
 $oldmem = $oldmem | 0;
 $bytes = $bytes | 0;
 var $12 = 0, $15 = 0, $20 = 0, $9 = 0, $mem$0 = 0;
 if (!$oldmem) {
  $mem$0 = _malloc($bytes) | 0; //@line 13082
  return $mem$0 | 0; //@line 13083
 }
 if ($bytes >>> 0 > 4294967231) {
  HEAP32[(___errno_location() | 0) >> 2] = 12; //@line 13088
  $mem$0 = 0; //@line 13089
  return $mem$0 | 0; //@line 13090
 }
 $9 = _try_realloc_chunk($oldmem + -8 | 0, $bytes >>> 0 < 11 ? 16 : $bytes + 11 & -8) | 0; //@line 13097
 if ($9) {
  $mem$0 = $9 + 8 | 0; //@line 13101
  return $mem$0 | 0; //@line 13102
 }
 $12 = _malloc($bytes) | 0; //@line 13104
 if (!$12) {
  $mem$0 = 0; //@line 13107
  return $mem$0 | 0; //@line 13108
 }
 $15 = HEAP32[$oldmem + -4 >> 2] | 0; //@line 13111
 $20 = ($15 & -8) - (($15 & 3 | 0) == 0 ? 8 : 4) | 0; //@line 13116
 _memcpy($12 | 0, $oldmem | 0, ($20 >>> 0 < $bytes >>> 0 ? $20 : $bytes) | 0) | 0; //@line 13119
 _free($oldmem); //@line 13120
 $mem$0 = $12; //@line 13121
 return $mem$0 | 0; //@line 13122
}
function ___fflush_unlocked($f) {
 $f = $f | 0;
 var $$0 = 0, $0 = 0, $10 = 0, $11 = 0, $12 = 0, $2 = 0, $9 = 0, label = 0;
 $0 = $f + 20 | 0; //@line 7317
 $2 = $f + 28 | 0; //@line 7319
 if ((HEAP32[$0 >> 2] | 0) >>> 0 > (HEAP32[$2 >> 2] | 0) >>> 0) {
  FUNCTION_TABLE_iiii[HEAP32[$f + 36 >> 2] & 7]($f, 0, 0) | 0; //@line 7325
  if (!(HEAP32[$0 >> 2] | 0)) {
   $$0 = -1; //@line 7329
  } else {
   label = 3; //@line 7331
  }
 } else {
  label = 3; //@line 7334
 }
 if ((label | 0) == 3) {
  $9 = $f + 4 | 0; //@line 7337
  $10 = HEAP32[$9 >> 2] | 0; //@line 7338
  $11 = $f + 8 | 0; //@line 7339
  $12 = HEAP32[$11 >> 2] | 0; //@line 7340
  if ($10 >>> 0 < $12 >>> 0) {
   FUNCTION_TABLE_iiii[HEAP32[$f + 40 >> 2] & 7]($f, $10 - $12 | 0, 1) | 0; //@line 7348
  }
  HEAP32[$f + 16 >> 2] = 0; //@line 7351
  HEAP32[$2 >> 2] = 0; //@line 7352
  HEAP32[$0 >> 2] = 0; //@line 7353
  HEAP32[$11 >> 2] = 0; //@line 7354
  HEAP32[$9 >> 2] = 0; //@line 7355
  $$0 = 0; //@line 7356
 }
 return $$0 | 0; //@line 7358
}
function _fgetc($f) {
 $f = $f | 0;
 var $$0 = 0, $14 = 0, $15 = 0, $23 = 0, $5 = 0, $6 = 0, label = 0;
 if ((HEAP32[$f + 76 >> 2] | 0) < 0) {
  label = 3; //@line 4284
 } else {
  if (!(___lockfile($f) | 0)) {
   label = 3; //@line 4289
  } else {
   $14 = $f + 4 | 0; //@line 4291
   $15 = HEAP32[$14 >> 2] | 0; //@line 4292
   if ($15 >>> 0 < (HEAP32[$f + 8 >> 2] | 0) >>> 0) {
    HEAP32[$14 >> 2] = $15 + 1; //@line 4298
    $23 = HEAPU8[$15 >> 0] | 0; //@line 4301
   } else {
    $23 = ___uflow($f) | 0; //@line 4304
   }
   $$0 = $23; //@line 4306
  }
 }
 do {
  if ((label | 0) == 3) {
   $5 = $f + 4 | 0; //@line 4311
   $6 = HEAP32[$5 >> 2] | 0; //@line 4312
   if ($6 >>> 0 < (HEAP32[$f + 8 >> 2] | 0) >>> 0) {
    HEAP32[$5 >> 2] = $6 + 1; //@line 4318
    $$0 = HEAPU8[$6 >> 0] | 0; //@line 4321
    break;
   } else {
    $$0 = ___uflow($f) | 0; //@line 4325
    break;
   }
  }
 } while (0);
 return $$0 | 0; //@line 4330
}
function ___toread($f) {
 $f = $f | 0;
 var $$0 = 0, $0 = 0, $15 = 0, $2 = 0, $21 = 0, $6 = 0, $8 = 0;
 $0 = $f + 74 | 0; //@line 3989
 $2 = HEAP8[$0 >> 0] | 0; //@line 3991
 HEAP8[$0 >> 0] = $2 + 255 | $2; //@line 3995
 $6 = $f + 20 | 0; //@line 3996
 $8 = $f + 44 | 0; //@line 3998
 if ((HEAP32[$6 >> 2] | 0) >>> 0 > (HEAP32[$8 >> 2] | 0) >>> 0) {
  FUNCTION_TABLE_iiii[HEAP32[$f + 36 >> 2] & 7]($f, 0, 0) | 0; //@line 4004
 }
 HEAP32[$f + 16 >> 2] = 0; //@line 4007
 HEAP32[$f + 28 >> 2] = 0; //@line 4009
 HEAP32[$6 >> 2] = 0; //@line 4010
 $15 = HEAP32[$f >> 2] | 0; //@line 4011
 if (!($15 & 20)) {
  $21 = HEAP32[$8 >> 2] | 0; //@line 4015
  HEAP32[$f + 8 >> 2] = $21; //@line 4017
  HEAP32[$f + 4 >> 2] = $21; //@line 4019
  $$0 = 0; //@line 4020
 } else {
  if (!($15 & 4)) {
   $$0 = -1; //@line 4025
  } else {
   HEAP32[$f >> 2] = $15 | 32; //@line 4028
   $$0 = -1; //@line 4029
  }
 }
 return $$0 | 0; //@line 4032
}
function _memcpy(dest, src, num) {
 dest = dest | 0;
 src = src | 0;
 num = num | 0;
 var ret = 0;
 if ((num | 0) >= 4096) return _emscripten_memcpy_big(dest | 0, src | 0, num | 0) | 0; //@line 14415
 ret = dest | 0; //@line 14416
 if ((dest & 3) == (src & 3)) {
  while (dest & 3) {
   if (!num) return ret | 0; //@line 14419
   HEAP8[dest >> 0] = HEAP8[src >> 0] | 0; //@line 14420
   dest = dest + 1 | 0; //@line 14421
   src = src + 1 | 0; //@line 14422
   num = num - 1 | 0; //@line 14423
  }
  while ((num | 0) >= 4) {
   HEAP32[dest >> 2] = HEAP32[src >> 2]; //@line 14426
   dest = dest + 4 | 0; //@line 14427
   src = src + 4 | 0; //@line 14428
   num = num - 4 | 0; //@line 14429
  }
 }
 while ((num | 0) > 0) {
  HEAP8[dest >> 0] = HEAP8[src >> 0] | 0; //@line 14433
  dest = dest + 1 | 0; //@line 14434
  src = src + 1 | 0; //@line 14435
  num = num - 1 | 0; //@line 14436
 }
 return ret | 0; //@line 14438
}
function _fclose($f) {
 $f = $f | 0;
 var $$pre = 0, $12 = 0, $18 = 0, $22 = 0, $24 = 0, $5 = 0, $7 = 0;
 if ((HEAP32[$f + 76 >> 2] | 0) > -1) {}
 $5 = (HEAP32[$f >> 2] & 1 | 0) != 0; //@line 4121
 if (!$5) {
  ___lock(36); //@line 4123
  $7 = HEAP32[$f + 52 >> 2] | 0; //@line 4125
  $$pre = $f + 56 | 0; //@line 4128
  if ($7) {
   HEAP32[$7 + 56 >> 2] = HEAP32[$$pre >> 2]; //@line 4132
  }
  $12 = HEAP32[$$pre >> 2] | 0; //@line 4134
  if ($12) {
   HEAP32[$12 + 52 >> 2] = $7; //@line 4139
  }
  if ((HEAP32[8] | 0) == ($f | 0)) {
   HEAP32[8] = $12; //@line 4144
  }
  ___unlock(36); //@line 4146
 }
 $18 = _fflush($f) | 0; //@line 4148
 $22 = FUNCTION_TABLE_ii[HEAP32[$f + 12 >> 2] & 1]($f) | 0 | $18; //@line 4152
 $24 = HEAP32[$f + 92 >> 2] | 0; //@line 4154
 if ($24) {
  _free($24); //@line 4157
 }
 if (!$5) {
  _free($f); //@line 4160
 }
 return $22 | 0; //@line 4162
}
function ___divdi3($a$0, $a$1, $b$0, $b$1) {
 $a$0 = $a$0 | 0;
 $a$1 = $a$1 | 0;
 $b$0 = $b$0 | 0;
 $b$1 = $b$1 | 0;
 var $1$0 = 0, $1$1 = 0, $2$0 = 0, $2$1 = 0, $4$0 = 0, $4$1 = 0, $7$0 = 0, $7$1 = 0;
 $1$0 = $a$1 >> 31 | (($a$1 | 0) < 0 ? -1 : 0) << 1; //@line 14483
 $1$1 = (($a$1 | 0) < 0 ? -1 : 0) >> 31 | (($a$1 | 0) < 0 ? -1 : 0) << 1; //@line 14484
 $2$0 = $b$1 >> 31 | (($b$1 | 0) < 0 ? -1 : 0) << 1; //@line 14485
 $2$1 = (($b$1 | 0) < 0 ? -1 : 0) >> 31 | (($b$1 | 0) < 0 ? -1 : 0) << 1; //@line 14486
 $4$0 = _i64Subtract($1$0 ^ $a$0, $1$1 ^ $a$1, $1$0, $1$1) | 0; //@line 14487
 $4$1 = tempRet0; //@line 14488
 $7$0 = $2$0 ^ $1$0; //@line 14490
 $7$1 = $2$1 ^ $1$1; //@line 14491
 return _i64Subtract((___udivmoddi4($4$0, $4$1, _i64Subtract($2$0 ^ $b$0, $2$1 ^ $b$1, $2$0, $2$1) | 0, tempRet0, 0) | 0) ^ $7$0, tempRet0 ^ $7$1, $7$0, $7$1) | 0; //@line 14494
}
function _memcmp($vl, $vr, $n) {
 $vl = $vl | 0;
 $vr = $vr | 0;
 $n = $n | 0;
 var $$03 = 0, $$lcssa = 0, $$lcssa19 = 0, $1 = 0, $11 = 0, $2 = 0, $l$04 = 0, $r$05 = 0;
 L1 : do {
  if (!$n) {
   $11 = 0; //@line 6678
  } else {
   $$03 = $n; //@line 6680
   $l$04 = $vl; //@line 6680
   $r$05 = $vr; //@line 6680
   while (1) {
    $1 = HEAP8[$l$04 >> 0] | 0; //@line 6682
    $2 = HEAP8[$r$05 >> 0] | 0; //@line 6683
    if ($1 << 24 >> 24 != $2 << 24 >> 24) {
     $$lcssa = $1; //@line 6686
     $$lcssa19 = $2; //@line 6686
     break;
    }
    $$03 = $$03 + -1 | 0; //@line 6689
    if (!$$03) {
     $11 = 0; //@line 6694
     break L1;
    } else {
     $l$04 = $l$04 + 1 | 0; //@line 6697
     $r$05 = $r$05 + 1 | 0; //@line 6697
    }
   }
   $11 = ($$lcssa & 255) - ($$lcssa19 & 255) | 0; //@line 6703
  }
 } while (0);
 return $11 | 0; //@line 6706
}
function _memset(ptr, value, num) {
 ptr = ptr | 0;
 value = value | 0;
 num = num | 0;
 var stop = 0, value4 = 0, stop4 = 0, unaligned = 0;
 stop = ptr + num | 0; //@line 14353
 if ((num | 0) >= 20) {
  value = value & 255; //@line 14356
  unaligned = ptr & 3; //@line 14357
  value4 = value | value << 8 | value << 16 | value << 24; //@line 14358
  stop4 = stop & ~3; //@line 14359
  if (unaligned) {
   unaligned = ptr + 4 - unaligned | 0; //@line 14361
   while ((ptr | 0) < (unaligned | 0)) {
    HEAP8[ptr >> 0] = value; //@line 14363
    ptr = ptr + 1 | 0; //@line 14364
   }
  }
  while ((ptr | 0) < (stop4 | 0)) {
   HEAP32[ptr >> 2] = value4; //@line 14368
   ptr = ptr + 4 | 0; //@line 14369
  }
 }
 while ((ptr | 0) < (stop | 0)) {
  HEAP8[ptr >> 0] = value; //@line 14373
  ptr = ptr + 1 | 0; //@line 14374
 }
 return ptr - num | 0; //@line 14376
}
function ___stdio_seek($f, $off, $whence) {
 $f = $f | 0;
 $off = $off | 0;
 $whence = $whence | 0;
 var $5 = 0, $ret = 0, $vararg_buffer = 0, sp = 0;
 sp = STACKTOP; //@line 3793
 STACKTOP = STACKTOP + 32 | 0; //@line 3794
 $vararg_buffer = sp; //@line 3795
 $ret = sp + 20 | 0; //@line 3796
 HEAP32[$vararg_buffer >> 2] = HEAP32[$f + 60 >> 2]; //@line 3799
 HEAP32[$vararg_buffer + 4 >> 2] = 0; //@line 3801
 HEAP32[$vararg_buffer + 8 >> 2] = $off; //@line 3803
 HEAP32[$vararg_buffer + 12 >> 2] = $ret; //@line 3805
 HEAP32[$vararg_buffer + 16 >> 2] = $whence; //@line 3807
 if ((___syscall_ret(___syscall140(140, $vararg_buffer | 0) | 0) | 0) < 0) {
  HEAP32[$ret >> 2] = -1; //@line 3812
  $5 = -1; //@line 3813
 } else {
  $5 = HEAP32[$ret >> 2] | 0; //@line 3816
 }
 STACKTOP = sp; //@line 3818
 return $5 | 0; //@line 3818
}
function _open($filename, $flags, $varargs) {
 $filename = $filename | 0;
 $flags = $flags | 0;
 $varargs = $varargs | 0;
 var $5 = 0, $6 = 0, $9 = 0, $ap = 0, $vararg_buffer = 0, sp = 0;
 sp = STACKTOP; //@line 377
 STACKTOP = STACKTOP + 32 | 0; //@line 378
 $vararg_buffer = sp; //@line 379
 $ap = sp + 16 | 0; //@line 380
 HEAP32[$ap >> 2] = $varargs; //@line 381
 $5 = (HEAP32[$ap >> 2] | 0) + (4 - 1) & ~(4 - 1); //@line 393
 $6 = HEAP32[$5 >> 2] | 0; //@line 394
 HEAP32[$ap >> 2] = $5 + 4; //@line 396
 HEAP32[$vararg_buffer >> 2] = $filename; //@line 398
 HEAP32[$vararg_buffer + 4 >> 2] = $flags | 32768; //@line 400
 HEAP32[$vararg_buffer + 8 >> 2] = $6; //@line 402
 $9 = ___syscall_ret(___syscall5(5, $vararg_buffer | 0) | 0) | 0; //@line 404
 STACKTOP = sp; //@line 405
 return $9 | 0; //@line 405
}
function _puts($s) {
 $s = $s | 0;
 var $0 = 0, $10 = 0, $11 = 0, $18 = 0, $20 = 0;
 $0 = HEAP32[66] | 0; //@line 5132
 if ((HEAP32[$0 + 76 >> 2] | 0) > -1) {
  $20 = ___lockfile($0) | 0; //@line 5138
 } else {
  $20 = 0; //@line 5140
 }
 do {
  if ((_fputs($s, $0) | 0) < 0) {
   $18 = 1; //@line 5146
  } else {
   if ((HEAP8[$0 + 75 >> 0] | 0) != 10) {
    $10 = $0 + 20 | 0; //@line 5152
    $11 = HEAP32[$10 >> 2] | 0; //@line 5153
    if ($11 >>> 0 < (HEAP32[$0 + 16 >> 2] | 0) >>> 0) {
     HEAP32[$10 >> 2] = $11 + 1; //@line 5159
     HEAP8[$11 >> 0] = 10; //@line 5160
     $18 = 0; //@line 5161
     break;
    }
   }
   $18 = (___overflow($0, 10) | 0) < 0; //@line 5167
  }
 } while (0);
 if ($20) {
  ___unlockfile($0); //@line 5173
 }
 return $18 << 31 >> 31 | 0; //@line 5175
}
function _strcmp($l, $r) {
 $l = $l | 0;
 $r = $r | 0;
 var $$014 = 0, $$05 = 0, $$lcssa = 0, $$lcssa2 = 0, $0 = 0, $1 = 0, $6 = 0, $7 = 0;
 $0 = HEAP8[$l >> 0] | 0; //@line 6828
 $1 = HEAP8[$r >> 0] | 0; //@line 6829
 if ($0 << 24 >> 24 == 0 ? 1 : $0 << 24 >> 24 != $1 << 24 >> 24) {
  $$lcssa = $0; //@line 6834
  $$lcssa2 = $1; //@line 6834
 } else {
  $$014 = $l; //@line 6836
  $$05 = $r; //@line 6836
  do {
   $$014 = $$014 + 1 | 0; //@line 6838
   $$05 = $$05 + 1 | 0; //@line 6839
   $6 = HEAP8[$$014 >> 0] | 0; //@line 6840
   $7 = HEAP8[$$05 >> 0] | 0; //@line 6841
  } while (!($6 << 24 >> 24 == 0 ? 1 : $6 << 24 >> 24 != $7 << 24 >> 24));
  $$lcssa = $6; //@line 6846
  $$lcssa2 = $7; //@line 6846
 }
 return ($$lcssa & 255) - ($$lcssa2 & 255) | 0; //@line 6856
}
function ___fmodeflags($mode) {
 $mode = $mode | 0;
 var $1 = 0, $2 = 0, $4 = 0, $7 = 0, $flags$0 = 0, $flags$0$ = 0, $flags$2 = 0, $flags$2$ = 0, $flags$4 = 0;
 $1 = (_strchr($mode, 43) | 0) == 0; //@line 3582
 $2 = HEAP8[$mode >> 0] | 0; //@line 3583
 $flags$0 = $1 ? $2 << 24 >> 24 != 114 & 1 : 2; //@line 3586
 $4 = (_strchr($mode, 120) | 0) == 0; //@line 3588
 $flags$0$ = $4 ? $flags$0 : $flags$0 | 128; //@line 3590
 $7 = (_strchr($mode, 101) | 0) == 0; //@line 3592
 $flags$2 = $7 ? $flags$0$ : $flags$0$ | 524288; //@line 3594
 $flags$2$ = $2 << 24 >> 24 == 114 ? $flags$2 : $flags$2 | 64; //@line 3597
 $flags$4 = $2 << 24 >> 24 == 119 ? $flags$2$ | 512 : $flags$2$; //@line 3600
 return ($2 << 24 >> 24 == 97 ? $flags$4 | 1024 : $flags$4) | 0; //@line 3604
}
function ___stdout_write($f, $buf, $len) {
 $f = $f | 0;
 $buf = $buf | 0;
 $len = $len | 0;
 var $9 = 0, $vararg_buffer = 0, sp = 0;
 sp = STACKTOP; //@line 3957
 STACKTOP = STACKTOP + 80 | 0; //@line 3958
 $vararg_buffer = sp; //@line 3959
 HEAP32[$f + 36 >> 2] = 2; //@line 3962
 if (!(HEAP32[$f >> 2] & 64)) {
  HEAP32[$vararg_buffer >> 2] = HEAP32[$f + 60 >> 2]; //@line 3969
  HEAP32[$vararg_buffer + 4 >> 2] = 21505; //@line 3971
  HEAP32[$vararg_buffer + 8 >> 2] = sp + 12; //@line 3973
  if (___syscall54(54, $vararg_buffer | 0) | 0) {
   HEAP8[$f + 75 >> 0] = -1; //@line 3978
  }
 }
 $9 = ___stdio_write($f, $buf, $len) | 0; //@line 3981
 STACKTOP = sp; //@line 3982
 return $9 | 0; //@line 3982
}
function _fwrite($src, $size, $nmemb, $f) {
 $src = $src | 0;
 $size = $size | 0;
 $nmemb = $nmemb | 0;
 $f = $f | 0;
 var $0 = 0, $10 = 0, $6 = 0, $8 = 0, $phitmp = 0;
 $0 = Math_imul($nmemb, $size) | 0; //@line 4985
 if ((HEAP32[$f + 76 >> 2] | 0) > -1) {
  $phitmp = (___lockfile($f) | 0) == 0; //@line 4991
  $6 = ___fwritex($src, $0, $f) | 0; //@line 4992
  if ($phitmp) {
   $8 = $6; //@line 4994
  } else {
   ___unlockfile($f); //@line 4996
   $8 = $6; //@line 4997
  }
 } else {
  $8 = ___fwritex($src, $0, $f) | 0; //@line 5001
 }
 if (($8 | 0) == ($0 | 0)) {
  $10 = $nmemb; //@line 5005
 } else {
  $10 = ($8 >>> 0) / ($size >>> 0) | 0; //@line 5008
 }
 return $10 | 0; //@line 5010
}
function ___towrite($f) {
 $f = $f | 0;
 var $$0 = 0, $0 = 0, $13 = 0, $2 = 0, $6 = 0;
 $0 = $f + 74 | 0; //@line 4039
 $2 = HEAP8[$0 >> 0] | 0; //@line 4041
 HEAP8[$0 >> 0] = $2 + 255 | $2; //@line 4045
 $6 = HEAP32[$f >> 2] | 0; //@line 4046
 if (!($6 & 8)) {
  HEAP32[$f + 8 >> 2] = 0; //@line 4051
  HEAP32[$f + 4 >> 2] = 0; //@line 4053
  $13 = HEAP32[$f + 44 >> 2] | 0; //@line 4055
  HEAP32[$f + 28 >> 2] = $13; //@line 4057
  HEAP32[$f + 20 >> 2] = $13; //@line 4059
  HEAP32[$f + 16 >> 2] = $13 + (HEAP32[$f + 48 >> 2] | 0); //@line 4065
  $$0 = 0; //@line 4066
 } else {
  HEAP32[$f >> 2] = $6 | 32; //@line 4069
  $$0 = -1; //@line 4070
 }
 return $$0 | 0; //@line 4072
}
function ___randname($template) {
 $template = $template | 0;
 var $i$01 = 0, $r$02 = 0, $ts = 0, sp = 0;
 sp = STACKTOP; //@line 6989
 STACKTOP = STACKTOP + 16 | 0; //@line 6990
 $ts = sp; //@line 6991
 ___clock_gettime(0, $ts | 0) | 0; //@line 6992
 $i$01 = 0; //@line 7001
 $r$02 = (HEAP32[$ts + 4 >> 2] | 0) * 65537 ^ ($ts >>> 4) + $template; //@line 7001
 while (1) {
  HEAP8[$template + $i$01 >> 0] = ($r$02 & 15) + 65 | $r$02 << 1 & 32; //@line 7010
  $i$01 = $i$01 + 1 | 0; //@line 7011
  if (($i$01 | 0) == 6) {
   break;
  } else {
   $r$02 = $r$02 >>> 5; //@line 7017
  }
 }
 STACKTOP = sp; //@line 7020
 return $template | 0; //@line 7020
}
function ___muldi3($a$0, $a$1, $b$0, $b$1) {
 $a$0 = $a$0 | 0;
 $a$1 = $a$1 | 0;
 $b$0 = $b$0 | 0;
 $b$1 = $b$1 | 0;
 var $x_sroa_0_0_extract_trunc = 0, $y_sroa_0_0_extract_trunc = 0, $1$0 = 0, $1$1 = 0;
 $x_sroa_0_0_extract_trunc = $a$0; //@line 14524
 $y_sroa_0_0_extract_trunc = $b$0; //@line 14525
 $1$0 = ___muldsi3($x_sroa_0_0_extract_trunc, $y_sroa_0_0_extract_trunc) | 0; //@line 14526
 $1$1 = tempRet0; //@line 14527
 return (tempRet0 = (Math_imul($a$1, $y_sroa_0_0_extract_trunc) | 0) + (Math_imul($b$1, $x_sroa_0_0_extract_trunc) | 0) + $1$1 | $1$1 & 0, $1$0 | 0 | 0) | 0; //@line 14529
}
function ___uflow($f) {
 $f = $f | 0;
 var $$0 = 0, $c = 0, label = 0, sp = 0;
 sp = STACKTOP; //@line 4077
 STACKTOP = STACKTOP + 16 | 0; //@line 4078
 $c = sp; //@line 4079
 if (!(HEAP32[$f + 8 >> 2] | 0)) {
  if (!(___toread($f) | 0)) {
   label = 3; //@line 4087
  } else {
   $$0 = -1; //@line 4089
  }
 } else {
  label = 3; //@line 4092
 }
 if ((label | 0) == 3) {
  if ((FUNCTION_TABLE_iiii[HEAP32[$f + 32 >> 2] & 7]($f, $c, 1) | 0) == 1) {
   $$0 = HEAPU8[$c >> 0] | 0; //@line 4102
  } else {
   $$0 = -1; //@line 4104
  }
 }
 STACKTOP = sp; //@line 4107
 return $$0 | 0; //@line 4107
}
function ___ftello_unlocked($f) {
 $f = $f | 0;
 var $$0 = 0, $10 = 0, $11 = 0;
 if (!(HEAP32[$f >> 2] & 128)) {
  $10 = 1; //@line 4825
 } else {
  $10 = (HEAP32[$f + 20 >> 2] | 0) >>> 0 > (HEAP32[$f + 28 >> 2] | 0) >>> 0 ? 2 : 1; //@line 4833
 }
 $11 = FUNCTION_TABLE_iiii[HEAP32[$f + 40 >> 2] & 7]($f, 0, $10) | 0; //@line 4835
 if (($11 | 0) < 0) {
  $$0 = $11; //@line 4838
 } else {
  $$0 = $11 - (HEAP32[$f + 8 >> 2] | 0) + (HEAP32[$f + 4 >> 2] | 0) + (HEAP32[$f + 20 >> 2] | 0) - (HEAP32[$f + 28 >> 2] | 0) | 0; //@line 4856
 }
 return $$0 | 0; //@line 4858
}
function copyTempDouble(ptr) {
 ptr = ptr | 0;
 HEAP8[tempDoublePtr >> 0] = HEAP8[ptr >> 0]; //@line 40
 HEAP8[tempDoublePtr + 1 >> 0] = HEAP8[ptr + 1 >> 0]; //@line 41
 HEAP8[tempDoublePtr + 2 >> 0] = HEAP8[ptr + 2 >> 0]; //@line 42
 HEAP8[tempDoublePtr + 3 >> 0] = HEAP8[ptr + 3 >> 0]; //@line 43
 HEAP8[tempDoublePtr + 4 >> 0] = HEAP8[ptr + 4 >> 0]; //@line 44
 HEAP8[tempDoublePtr + 5 >> 0] = HEAP8[ptr + 5 >> 0]; //@line 45
 HEAP8[tempDoublePtr + 6 >> 0] = HEAP8[ptr + 6 >> 0]; //@line 46
 HEAP8[tempDoublePtr + 7 >> 0] = HEAP8[ptr + 7 >> 0]; //@line 47
}
function ___muldsi3($a, $b) {
 $a = $a | 0;
 $b = $b | 0;
 var $1 = 0, $2 = 0, $3 = 0, $6 = 0, $8 = 0, $11 = 0, $12 = 0;
 $1 = $a & 65535; //@line 14468
 $2 = $b & 65535; //@line 14469
 $3 = Math_imul($2, $1) | 0; //@line 14470
 $6 = $a >>> 16; //@line 14471
 $8 = ($3 >>> 16) + (Math_imul($2, $6) | 0) | 0; //@line 14472
 $11 = $b >>> 16; //@line 14473
 $12 = Math_imul($11, $1) | 0; //@line 14474
 return (tempRet0 = ($8 >>> 16) + (Math_imul($11, $6) | 0) + ((($8 & 65535) + $12 | 0) >>> 16) | 0, $8 + $12 << 16 | $3 & 65535 | 0) | 0; //@line 14475
}
function ___fseeko($f, $off, $whence) {
 $f = $f | 0;
 $off = $off | 0;
 $whence = $whence | 0;
 var $5 = 0, $6 = 0, $phitmp = 0;
 if ((HEAP32[$f + 76 >> 2] | 0) > -1) {
  $phitmp = (___lockfile($f) | 0) == 0; //@line 4791
  $5 = ___fseeko_unlocked($f, $off, $whence) | 0; //@line 4792
  if ($phitmp) {
   $6 = $5; //@line 4794
  } else {
   ___unlockfile($f); //@line 4796
   $6 = $5; //@line 4797
  }
 } else {
  $6 = ___fseeko_unlocked($f, $off, $whence) | 0; //@line 4801
 }
 return $6 | 0; //@line 4803
}
function _copysign($x, $y) {
 $x = +$x;
 $y = +$y;
 var $0 = 0, $1 = 0, $6 = 0;
 HEAPF64[tempDoublePtr >> 3] = $x; //@line 2816
 $0 = HEAP32[tempDoublePtr >> 2] | 0; //@line 2816
 $1 = HEAP32[tempDoublePtr + 4 >> 2] | 0; //@line 2817
 HEAPF64[tempDoublePtr >> 3] = $y; //@line 2818
 $6 = HEAP32[tempDoublePtr + 4 >> 2] & -2147483648 | $1 & 2147483647; //@line 2822
 HEAP32[tempDoublePtr >> 2] = $0; //@line 2823
 HEAP32[tempDoublePtr + 4 >> 2] = $6; //@line 2823
 return +(+HEAPF64[tempDoublePtr >> 3]);
}
function ___uremdi3($a$0, $a$1, $b$0, $b$1) {
 $a$0 = $a$0 | 0;
 $a$1 = $a$1 | 0;
 $b$0 = $b$0 | 0;
 $b$1 = $b$1 | 0;
 var $rem = 0, __stackBase__ = 0;
 __stackBase__ = STACKTOP; //@line 14546
 STACKTOP = STACKTOP + 16 | 0; //@line 14547
 $rem = __stackBase__ | 0; //@line 14548
 ___udivmoddi4($a$0, $a$1, $b$0, $b$1, $rem) | 0; //@line 14549
 STACKTOP = __stackBase__; //@line 14550
 return (tempRet0 = HEAP32[$rem + 4 >> 2] | 0, HEAP32[$rem >> 2] | 0) | 0; //@line 14551
}
function _llvm_cttz_i32(x) {
 x = x | 0;
 var ret = 0;
 ret = HEAP8[cttz_i8 + (x & 255) >> 0] | 0; //@line 14454
 if ((ret | 0) < 8) return ret | 0; //@line 14455
 ret = HEAP8[cttz_i8 + (x >> 8 & 255) >> 0] | 0; //@line 14456
 if ((ret | 0) < 8) return ret + 8 | 0; //@line 14457
 ret = HEAP8[cttz_i8 + (x >> 16 & 255) >> 0] | 0; //@line 14458
 if ((ret | 0) < 8) return ret + 16 | 0; //@line 14459
 return (HEAP8[cttz_i8 + (x >>> 24) >> 0] | 0) + 24 | 0; //@line 14460
}
function ___shlim($f, $lim) {
 $f = $f | 0;
 $lim = $lim | 0;
 var $4 = 0, $5 = 0, $7 = 0;
 HEAP32[$f + 104 >> 2] = $lim; //@line 2678
 $4 = HEAP32[$f + 4 >> 2] | 0; //@line 2682
 $5 = HEAP32[$f + 8 >> 2] | 0; //@line 2683
 $7 = $5 - $4 | 0; //@line 2685
 HEAP32[$f + 108 >> 2] = $7; //@line 2687
 if (($lim | 0) != 0 & ($7 | 0) > ($lim | 0)) {
  HEAP32[$f + 100 >> 2] = $4 + $lim; //@line 2694
 } else {
  HEAP32[$f + 100 >> 2] = $5; //@line 2697
 }
 return;
}
function _feof($f) {
 $f = $f | 0;
 var $$lobit = 0, $$lobit2 = 0, $phitmp = 0;
 if ((HEAP32[$f + 76 >> 2] | 0) > -1) {
  $phitmp = (___lockfile($f) | 0) == 0; //@line 4173
  $$lobit = (HEAP32[$f >> 2] | 0) >>> 4 & 1; //@line 4176
  if ($phitmp) {
   $$lobit2 = $$lobit; //@line 4178
  } else {
   $$lobit2 = $$lobit; //@line 4180
  }
 } else {
  $$lobit2 = (HEAP32[$f >> 2] | 0) >>> 4 & 1; //@line 4186
 }
 return $$lobit2 | 0; //@line 4188
}
function _rewind($f) {
 $f = $f | 0;
 var $phitmp = 0;
 if ((HEAP32[$f + 76 >> 2] | 0) > -1) {
  $phitmp = (___lockfile($f) | 0) == 0; //@line 5186
  ___fseeko_unlocked($f, 0, 0) | 0; //@line 5187
  HEAP32[$f >> 2] = HEAP32[$f >> 2] & -33; //@line 5190
  if (!$phitmp) {
   ___unlockfile($f); //@line 5192
  }
 } else {
  ___fseeko_unlocked($f, 0, 0) | 0; //@line 5195
  HEAP32[$f >> 2] = HEAP32[$f >> 2] & -33; //@line 5198
 }
 return;
}
function _sn_write($f, $s, $l) {
 $f = $f | 0;
 $s = $s | 0;
 $l = $l | 0;
 var $2 = 0, $3 = 0, $6 = 0, $l$ = 0;
 $2 = $f + 20 | 0; //@line 9401
 $3 = HEAP32[$2 >> 2] | 0; //@line 9402
 $6 = (HEAP32[$f + 16 >> 2] | 0) - $3 | 0; //@line 9405
 $l$ = $6 >>> 0 > $l >>> 0 ? $l : $6; //@line 9407
 _memcpy($3 | 0, $s | 0, $l$ | 0) | 0; //@line 9408
 HEAP32[$2 >> 2] = (HEAP32[$2 >> 2] | 0) + $l$; //@line 9411
 return $l | 0; //@line 9412
}
function _snprintf($s, $n, $fmt, $varargs) {
 $s = $s | 0;
 $n = $n | 0;
 $fmt = $fmt | 0;
 $varargs = $varargs | 0;
 var $0 = 0, $ap = 0, sp = 0;
 sp = STACKTOP; //@line 5208
 STACKTOP = STACKTOP + 16 | 0; //@line 5209
 $ap = sp; //@line 5210
 HEAP32[$ap >> 2] = $varargs; //@line 5211
 $0 = _vsnprintf($s, $n, $fmt, $ap) | 0; //@line 5212
 STACKTOP = sp; //@line 5213
 return $0 | 0; //@line 5213
}
function ___stdio_close($f) {
 $f = $f | 0;
 var $3 = 0, $vararg_buffer = 0, sp = 0;
 sp = STACKTOP; //@line 3682
 STACKTOP = STACKTOP + 16 | 0; //@line 3683
 $vararg_buffer = sp; //@line 3684
 HEAP32[$vararg_buffer >> 2] = HEAP32[$f + 60 >> 2]; //@line 3687
 $3 = ___syscall_ret(___syscall6(6, $vararg_buffer | 0) | 0) | 0; //@line 3689
 STACKTOP = sp; //@line 3690
 return $3 | 0; //@line 3690
}
function ___ftello($f) {
 $f = $f | 0;
 var $5 = 0, $6 = 0, $phitmp = 0;
 if ((HEAP32[$f + 76 >> 2] | 0) > -1) {
  $phitmp = (___lockfile($f) | 0) == 0; //@line 4869
  $5 = ___ftello_unlocked($f) | 0; //@line 4870
  if ($phitmp) {
   $6 = $5; //@line 4872
  } else {
   $6 = $5; //@line 4874
  }
 } else {
  $6 = ___ftello_unlocked($f) | 0; //@line 4878
 }
 return $6 | 0; //@line 4880
}
function _fscanf($f, $fmt, $varargs) {
 $f = $f | 0;
 $fmt = $fmt | 0;
 $varargs = $varargs | 0;
 var $0 = 0, $ap = 0, sp = 0;
 sp = STACKTOP; //@line 4709
 STACKTOP = STACKTOP + 16 | 0; //@line 4710
 $ap = sp; //@line 4711
 HEAP32[$ap >> 2] = $varargs; //@line 4712
 $0 = _vfscanf($f, $fmt, $ap) | 0; //@line 4713
 STACKTOP = sp; //@line 4714
 return $0 | 0; //@line 4714
}
function _printf($fmt, $varargs) {
 $fmt = $fmt | 0;
 $varargs = $varargs | 0;
 var $1 = 0, $ap = 0, sp = 0;
 sp = STACKTOP; //@line 5035
 STACKTOP = STACKTOP + 16 | 0; //@line 5036
 $ap = sp; //@line 5037
 HEAP32[$ap >> 2] = $varargs; //@line 5038
 $1 = _vfprintf(HEAP32[66] | 0, $fmt, $ap) | 0; //@line 5040
 STACKTOP = sp; //@line 5041
 return $1 | 0; //@line 5041
}
function _bitshift64Ashr(low, high, bits) {
 low = low | 0;
 high = high | 0;
 bits = bits | 0;
 if ((bits | 0) < 32) {
  tempRet0 = high >> bits; //@line 14445
  return low >>> bits | (high & (1 << bits) - 1) << 32 - bits; //@line 14446
 }
 tempRet0 = (high | 0) < 0 ? -1 : 0; //@line 14448
 return high >> bits - 32 | 0; //@line 14449
}
function _bitshift64Shl(low, high, bits) {
 low = low | 0;
 high = high | 0;
 bits = bits | 0;
 if ((bits | 0) < 32) {
  tempRet0 = high << bits | (low & (1 << bits) - 1 << 32 - bits) >>> 32 - bits; //@line 14383
  return low << bits; //@line 14384
 }
 tempRet0 = low << bits - 32; //@line 14386
 return 0; //@line 14387
}
function _bitshift64Lshr(low, high, bits) {
 low = low | 0;
 high = high | 0;
 bits = bits | 0;
 if ((bits | 0) < 32) {
  tempRet0 = high >>> bits; //@line 14406
  return low >>> bits | (high & (1 << bits) - 1) << 32 - bits; //@line 14407
 }
 tempRet0 = 0; //@line 14409
 return high >>> bits - 32 | 0; //@line 14410
}
function copyTempFloat(ptr) {
 ptr = ptr | 0;
 HEAP8[tempDoublePtr >> 0] = HEAP8[ptr >> 0]; //@line 33
 HEAP8[tempDoublePtr + 1 >> 0] = HEAP8[ptr + 1 >> 0]; //@line 34
 HEAP8[tempDoublePtr + 2 >> 0] = HEAP8[ptr + 2 >> 0]; //@line 35
 HEAP8[tempDoublePtr + 3 >> 0] = HEAP8[ptr + 3 >> 0]; //@line 36
}
function _gets($s) {
 $s = $s | 0;
 var $1 = 0, $5 = 0;
 $1 = _fgets($s, 2147483647, HEAP32[65] | 0) | 0; //@line 5017
 if ($1) {
  $5 = $s + ((_strlen($s) | 0) + -1) | 0; //@line 5022
  if ((HEAP8[$5 >> 0] | 0) == 10) {
   HEAP8[$5 >> 0] = 0; //@line 5026
  }
 }
 return $1 | 0; //@line 5029
}
function runPostSets() {}
function _i64Subtract(a, b, c, d) {
 a = a | 0;
 b = b | 0;
 c = c | 0;
 d = d | 0;
 var h = 0;
 h = b - d >>> 0; //@line 14346
 h = b - d - (c >>> 0 > a >>> 0 | 0) >>> 0; //@line 14347
 return (tempRet0 = h, a - c >>> 0 | 0) | 0; //@line 14348
}
function ___syscall_ret($r) {
 $r = $r | 0;
 var $$0 = 0;
 if ($r >>> 0 > 4294963200) {
  HEAP32[(___errno_location() | 0) >> 2] = 0 - $r; //@line 2804
  $$0 = -1; //@line 2805
 } else {
  $$0 = $r; //@line 2807
 }
 return $$0 | 0; //@line 2809
}
function _i64Add(a, b, c, d) {
 a = a | 0;
 b = b | 0;
 c = c | 0;
 d = d | 0;
 var l = 0;
 l = a + c >>> 0; //@line 14397
 return (tempRet0 = b + d + (l >>> 0 < a >>> 0 | 0) >>> 0, l | 0) | 0; //@line 14399
}
function ___errno_location() {
 var $$0 = 0;
 if (!(HEAP32[2] | 0)) {
  $$0 = 272; //@line 299
 } else {
  $$0 = HEAP32[(_pthread_self() | 0) + 60 >> 2] | 0; //@line 304
 }
 return $$0 | 0; //@line 306
}
function stackAlloc(size) {
 size = size | 0;
 var ret = 0;
 ret = STACKTOP; //@line 3
 STACKTOP = STACKTOP + size | 0; //@line 4
 STACKTOP = STACKTOP + 15 & -16; //@line 5
 return ret | 0; //@line 7
}
function _wctomb($s, $wc) {
 $s = $s | 0;
 $wc = $wc | 0;
 var $$0 = 0;
 if (!$s) {
  $$0 = 0; //@line 3440
 } else {
  $$0 = _wcrtomb($s, $wc, 0) | 0; //@line 3443
 }
 return $$0 | 0; //@line 3445
}
function _strchr($s, $c) {
 $s = $s | 0;
 $c = $c | 0;
 var $0 = 0;
 $0 = ___strchrnul($s, $c) | 0; //@line 6713
 return ((HEAP8[$0 >> 0] | 0) == ($c & 255) << 24 >> 24 ? $0 : 0) | 0; //@line 6718
}
function dynCall_iiii(index, a1, a2, a3) {
 index = index | 0;
 a1 = a1 | 0;
 a2 = a2 | 0;
 a3 = a3 | 0;
 return FUNCTION_TABLE_iiii[index & 7](a1 | 0, a2 | 0, a3 | 0) | 0; //@line 14775
}
function ___udivdi3($a$0, $a$1, $b$0, $b$1) {
 $a$0 = $a$0 | 0;
 $a$1 = $a$1 | 0;
 $b$0 = $b$0 | 0;
 $b$1 = $b$1 | 0;
 return ___udivmoddi4($a$0, $a$1, $b$0, $b$1, 0) | 0; //@line 14538
}
function _mbsinit($st) {
 $st = $st | 0;
 var $4 = 0;
 if (!$st) {
  $4 = 1; //@line 3331
 } else {
  $4 = (HEAP32[$st >> 2] | 0) == 0; //@line 3335
 }
 return $4 & 1 | 0; //@line 3338
}
function establishStackSpace(stackBase, stackMax) {
 stackBase = stackBase | 0;
 stackMax = stackMax | 0;
 STACKTOP = stackBase; //@line 19
 STACK_MAX = stackMax; //@line 20
}
function setThrew(threw, value) {
 threw = threw | 0;
 value = value | 0;
 if (!__THREW__) {
  __THREW__ = threw; //@line 27
  threwValue = value; //@line 28
 }
}
function _fseek($f, $off, $whence) {
 $f = $f | 0;
 $off = $off | 0;
 $whence = $whence | 0;
 return ___fseeko($f, $off, $whence) | 0; //@line 4812
}
function dynCall_ii(index, a1) {
 index = index | 0;
 a1 = a1 | 0;
 return FUNCTION_TABLE_ii[index & 1](a1 | 0) | 0; //@line 14768
}
function _fputs($s, $f) {
 $s = $s | 0;
 $f = $f | 0;
 return (_fwrite($s, _strlen($s) | 0, 1, $f) | 0) + -1 | 0; //@line 4604
}
function _cleanup392($p) {
 $p = $p | 0;
 if (!(HEAP32[$p + 68 >> 2] | 0)) {
  ___unlockfile($p); //@line 7308
 }
 return;
}
function _cleanup387($p) {
 $p = $p | 0;
 if (!(HEAP32[$p + 68 >> 2] | 0)) {
  ___unlockfile($p); //@line 7296
 }
 return;
}
function dynCall_vi(index, a1) {
 index = index | 0;
 a1 = a1 | 0;
 FUNCTION_TABLE_vi[index & 3](a1 | 0); //@line 14782
}
function b1(p0, p1, p2) {
 p0 = p0 | 0;
 p1 = p1 | 0;
 p2 = p2 | 0;
 abort(1); //@line 14789
 return 0; //@line 14789
}
function _mkstemp($template) {
 $template = $template | 0;
 return ___mkostemps($template, 0, 0) | 0; //@line 7090
}
function _isspace($c) {
 $c = $c | 0;
 return (($c | 0) == 32 | ($c + -9 | 0) >>> 0 < 5) & 1 | 0; //@line 291
}
function _putchar($c) {
 $c = $c | 0;
 return _fputc($c, HEAP32[66] | 0) | 0; //@line 5125
}
function _copysignl($x, $y) {
 $x = +$x;
 $y = +$y;
 return +(+_copysign($x, $y));
}
function b0(p0) {
 p0 = p0 | 0;
 abort(0); //@line 14786
 return 0; //@line 14786
}
function _scalbnl($x, $n) {
 $x = +$x;
 $n = $n | 0;
 return +(+_scalbn($x, $n));
}
function setTempRet0(value) {
 value = value | 0;
 tempRet0 = value; //@line 52
}
function _frexpl($x, $e) {
 $x = +$x;
 $e = $e | 0;
 return +(+_frexp($x, $e));
}
function _ftell($f) {
 $f = $f | 0;
 return ___ftello($f) | 0; //@line 4887
}
function _fmodl($x, $y) {
 $x = +$x;
 $y = +$y;
 return +(+_fmod($x, $y));
}
function stackRestore(top) {
 top = top | 0;
 STACKTOP = top; //@line 14
}
function ___lockfile($f) {
 $f = $f | 0;
 return 0; //@line 3610
}
function getTempRet0() {
 return tempRet0 | 0; //@line 55
}
function b2(p0) {
 p0 = p0 | 0;
 abort(2); //@line 14792
}
function stackSave() {
 return STACKTOP | 0; //@line 10
}
function ___unlockfile($f) {
 $f = $f | 0;
 return;
}

// EMSCRIPTEN_END_FUNCS
var FUNCTION_TABLE_ii = [b0,___stdio_close];
var FUNCTION_TABLE_iiii = [b1,_sn_write,___stdio_write,___stdio_seek,___stdio_read,___stdout_write,b1,b1];
var FUNCTION_TABLE_vi = [b2,_cleanup387,_cleanup392,b2];

  return { _i64Subtract: _i64Subtract, _free: _free, _main: _main, _i64Add: _i64Add, _memset: _memset, _malloc: _malloc, _memcpy: _memcpy, _bitshift64Lshr: _bitshift64Lshr, _fflush: _fflush, ___errno_location: ___errno_location, _bitshift64Shl: _bitshift64Shl, runPostSets: runPostSets, stackAlloc: stackAlloc, stackSave: stackSave, stackRestore: stackRestore, establishStackSpace: establishStackSpace, setThrew: setThrew, setTempRet0: setTempRet0, getTempRet0: getTempRet0, dynCall_ii: dynCall_ii, dynCall_iiii: dynCall_iiii, dynCall_vi: dynCall_vi };
})
// EMSCRIPTEN_END_ASM
(Module.asmGlobalArg, Module.asmLibraryArg, buffer);
var _i64Subtract = Module["_i64Subtract"] = asm["_i64Subtract"];
var _free = Module["_free"] = asm["_free"];
var _main = Module["_main"] = asm["_main"];
var _i64Add = Module["_i64Add"] = asm["_i64Add"];
var _memset = Module["_memset"] = asm["_memset"];
var runPostSets = Module["runPostSets"] = asm["runPostSets"];
var _malloc = Module["_malloc"] = asm["_malloc"];
var _memcpy = Module["_memcpy"] = asm["_memcpy"];
var _bitshift64Lshr = Module["_bitshift64Lshr"] = asm["_bitshift64Lshr"];
var _fflush = Module["_fflush"] = asm["_fflush"];
var ___errno_location = Module["___errno_location"] = asm["___errno_location"];
var _bitshift64Shl = Module["_bitshift64Shl"] = asm["_bitshift64Shl"];
var dynCall_ii = Module["dynCall_ii"] = asm["dynCall_ii"];
var dynCall_iiii = Module["dynCall_iiii"] = asm["dynCall_iiii"];
var dynCall_vi = Module["dynCall_vi"] = asm["dynCall_vi"];
;

Runtime.stackAlloc = asm['stackAlloc'];
Runtime.stackSave = asm['stackSave'];
Runtime.stackRestore = asm['stackRestore'];
Runtime.establishStackSpace = asm['establishStackSpace'];

Runtime.setTempRet0 = asm['setTempRet0'];
Runtime.getTempRet0 = asm['getTempRet0'];



// === Auto-generated postamble setup entry stuff ===

if (memoryInitializer) {
  if (typeof Module['locateFile'] === 'function') {
    memoryInitializer = Module['locateFile'](memoryInitializer);
  } else if (Module['memoryInitializerPrefixURL']) {
    memoryInitializer = Module['memoryInitializerPrefixURL'] + memoryInitializer;
  }
  if (ENVIRONMENT_IS_NODE || ENVIRONMENT_IS_SHELL) {
    var data = Module['readBinary'](memoryInitializer);
    HEAPU8.set(data, Runtime.GLOBAL_BASE);
  } else {
    addRunDependency('memory initializer');
    var applyMemoryInitializer = function(data) {
      if (data.byteLength) data = new Uint8Array(data);
      HEAPU8.set(data, Runtime.GLOBAL_BASE);
      removeRunDependency('memory initializer');
    }
    function doBrowserLoad() {
      Browser.asyncLoad(memoryInitializer, applyMemoryInitializer, function() {
        throw 'could not load memory initializer ' + memoryInitializer;
      });
    }
    var request = Module['memoryInitializerRequest'];
    if (request) {
      // a network request has already been created, just use that
      function useRequest() {
        if (request.status !== 200 && request.status !== 0) {
          // If you see this warning, the issue may be that you are using locateFile or memoryInitializerPrefixURL, and defining them in JS. That
          // means that the HTML file doesn't know about them, and when it tries to create the mem init request early, does it to the wrong place.
          // Look in your browser's devtools network console to see what's going on.
          console.warn('a problem seems to have happened with Module.memoryInitializerRequest, status: ' + request.status + ', retrying ' + memoryInitializer);
          doBrowserLoad();
          return;
        }
        applyMemoryInitializer(request.response);
      }
      if (request.response) {
        setTimeout(useRequest, 0); // it's already here; but, apply it asynchronously
      } else {
        request.addEventListener('load', useRequest); // wait for it
      }
    } else {
      // fetch it from the network ourselves
      doBrowserLoad();
    }
  }
}

function ExitStatus(status) {
  this.name = "ExitStatus";
  this.message = "Program terminated with exit(" + status + ")";
  this.status = status;
};
ExitStatus.prototype = new Error();
ExitStatus.prototype.constructor = ExitStatus;

var initialStackTop;
var preloadStartTime = null;
var calledMain = false;

dependenciesFulfilled = function runCaller() {
  // If run has never been called, and we should call run (INVOKE_RUN is true, and Module.noInitialRun is not false)
  if (!Module['calledRun']) run();
  if (!Module['calledRun']) dependenciesFulfilled = runCaller; // try this again later, after new deps are fulfilled
}

Module['callMain'] = Module.callMain = function callMain(args) {
  assert(runDependencies == 0, 'cannot call main when async dependencies remain! (listen on __ATMAIN__)');
  assert(__ATPRERUN__.length == 0, 'cannot call main when preRun functions remain to be called');

  args = args || [];

  ensureInitRuntime();

  var argc = args.length+1;
  function pad() {
    for (var i = 0; i < 4-1; i++) {
      argv.push(0);
    }
  }
  var argv = [allocate(intArrayFromString(Module['thisProgram']), 'i8', ALLOC_NORMAL) ];
  pad();
  for (var i = 0; i < argc-1; i = i + 1) {
    argv.push(allocate(intArrayFromString(args[i]), 'i8', ALLOC_NORMAL));
    pad();
  }
  argv.push(0);
  argv = allocate(argv, 'i32', ALLOC_NORMAL);


  try {

    var ret = Module['_main'](argc, argv, 0);


    // if we're not running an evented main loop, it's time to exit
    exit(ret, /* implicit = */ true);
  }
  catch(e) {
    if (e instanceof ExitStatus) {
      // exit() throws this once it's done to make sure execution
      // has been stopped completely
      return;
    } else if (e == 'SimulateInfiniteLoop') {
      // running an evented main loop, don't immediately exit
      Module['noExitRuntime'] = true;
      return;
    } else {
      if (e && typeof e === 'object' && e.stack) Module.printErr('exception thrown: ' + [e, e.stack]);
      throw e;
    }
  } finally {
    calledMain = true;
  }
}




function run(args) {
  args = args || Module['arguments'];

  if (preloadStartTime === null) preloadStartTime = Date.now();

  if (runDependencies > 0) {
    return;
  }

  preRun();

  if (runDependencies > 0) return; // a preRun added a dependency, run will be called later
  if (Module['calledRun']) return; // run may have just been called through dependencies being fulfilled just in this very frame

  function doRun() {
    if (Module['calledRun']) return; // run may have just been called while the async setStatus time below was happening
    Module['calledRun'] = true;

    if (ABORT) return; 

    ensureInitRuntime();

    preMain();


    if (Module['onRuntimeInitialized']) Module['onRuntimeInitialized']();

    if (Module['_main'] && shouldRunNow) Module['callMain'](args);

    postRun();
  }

  if (Module['setStatus']) {
    Module['setStatus']('Running...');
    setTimeout(function() {
      setTimeout(function() {
        Module['setStatus']('');
      }, 1);
      doRun();
    }, 1);
  } else {
    doRun();
  }
}
Module['run'] = Module.run = run;

function exit(status, implicit) {
  if (implicit && Module['noExitRuntime']) {
    return;
  }

  if (Module['noExitRuntime']) {
  } else {

    ABORT = true;
    EXITSTATUS = status;
    STACKTOP = initialStackTop;

    exitRuntime();

    if (Module['onExit']) Module['onExit'](status);
  }

  if (ENVIRONMENT_IS_NODE) {
    // Work around a node.js bug where stdout buffer is not flushed at process exit:
    // Instead of process.exit() directly, wait for stdout flush event.
    // See https://github.com/joyent/node/issues/1669 and https://github.com/kripken/emscripten/issues/2582
    // Workaround is based on https://github.com/RReverser/acorn/commit/50ab143cecc9ed71a2d66f78b4aec3bb2e9844f6
    process['stdout']['once']('drain', function () {
      process['exit'](status);
    });
    console.log(' '); // Make sure to print something to force the drain event to occur, in case the stdout buffer was empty.
    // Work around another node bug where sometimes 'drain' is never fired - make another effort
    // to emit the exit status, after a significant delay (if node hasn't fired drain by then, give up)
    setTimeout(function() {
      process['exit'](status);
    }, 500);
  } else
  if (ENVIRONMENT_IS_SHELL && typeof quit === 'function') {
    quit(status);
  }
  // if we reach here, we must throw an exception to halt the current execution
  throw new ExitStatus(status);
}
Module['exit'] = Module.exit = exit;

var abortDecorators = [];

function abort(what) {
  if (what !== undefined) {
    Module.print(what);
    Module.printErr(what);
    what = JSON.stringify(what)
  } else {
    what = '';
  }

  ABORT = true;
  EXITSTATUS = 1;

  var extra = '\nIf this abort() is unexpected, build with -s ASSERTIONS=1 which can give more information.';

  var output = 'abort(' + what + ') at ' + stackTrace() + extra;
  if (abortDecorators) {
    abortDecorators.forEach(function(decorator) {
      output = decorator(output, what);
    });
  }
  throw output;
}
Module['abort'] = Module.abort = abort;

// {{PRE_RUN_ADDITIONS}}

if (Module['preInit']) {
  if (typeof Module['preInit'] == 'function') Module['preInit'] = [Module['preInit']];
  while (Module['preInit'].length > 0) {
    Module['preInit'].pop()();
  }
}

// shouldRunNow refers to calling main(), not run().
var shouldRunNow = true;
if (Module['noInitialRun']) {
  shouldRunNow = false;
}


run();

// {{POST_RUN_ADDITIONS}}






// {{MODULE_ADDITIONS}}





// Appended to end of Emscripten output.
Module['FS'] = FS;
Module['PATH'] = PATH;
Module['ERRNO_CODES'] = ERRNO_CODES;
};


//# sourceMappingURL=files.js.map