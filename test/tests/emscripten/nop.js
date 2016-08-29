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

STATICTOP = STATIC_BASE + 1696;
  /* global initializers */  __ATINIT__.push();
  

memoryInitializer = "nop.js.mem";





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


  
  function ___setErrNo(value) {
      if (Module['___errno_location']) HEAP32[((Module['___errno_location']())>>2)]=value;
      return value;
    }
  
  var ERRNO_CODES={EPERM:1,ENOENT:2,ESRCH:3,EINTR:4,EIO:5,ENXIO:6,E2BIG:7,ENOEXEC:8,EBADF:9,ECHILD:10,EAGAIN:11,EWOULDBLOCK:11,ENOMEM:12,EACCES:13,EFAULT:14,ENOTBLK:15,EBUSY:16,EEXIST:17,EXDEV:18,ENODEV:19,ENOTDIR:20,EISDIR:21,EINVAL:22,ENFILE:23,EMFILE:24,ENOTTY:25,ETXTBSY:26,EFBIG:27,ENOSPC:28,ESPIPE:29,EROFS:30,EMLINK:31,EPIPE:32,EDOM:33,ERANGE:34,ENOMSG:42,EIDRM:43,ECHRNG:44,EL2NSYNC:45,EL3HLT:46,EL3RST:47,ELNRNG:48,EUNATCH:49,ENOCSI:50,EL2HLT:51,EDEADLK:35,ENOLCK:37,EBADE:52,EBADR:53,EXFULL:54,ENOANO:55,EBADRQC:56,EBADSLT:57,EDEADLOCK:35,EBFONT:59,ENOSTR:60,ENODATA:61,ETIME:62,ENOSR:63,ENONET:64,ENOPKG:65,EREMOTE:66,ENOLINK:67,EADV:68,ESRMNT:69,ECOMM:70,EPROTO:71,EMULTIHOP:72,EDOTDOT:73,EBADMSG:74,ENOTUNIQ:76,EBADFD:77,EREMCHG:78,ELIBACC:79,ELIBBAD:80,ELIBSCN:81,ELIBMAX:82,ELIBEXEC:83,ENOSYS:38,ENOTEMPTY:39,ENAMETOOLONG:36,ELOOP:40,EOPNOTSUPP:95,EPFNOSUPPORT:96,ECONNRESET:104,ENOBUFS:105,EAFNOSUPPORT:97,EPROTOTYPE:91,ENOTSOCK:88,ENOPROTOOPT:92,ESHUTDOWN:108,ECONNREFUSED:111,EADDRINUSE:98,ECONNABORTED:103,ENETUNREACH:101,ENETDOWN:100,ETIMEDOUT:110,EHOSTDOWN:112,EHOSTUNREACH:113,EINPROGRESS:115,EALREADY:114,EDESTADDRREQ:89,EMSGSIZE:90,EPROTONOSUPPORT:93,ESOCKTNOSUPPORT:94,EADDRNOTAVAIL:99,ENETRESET:102,EISCONN:106,ENOTCONN:107,ETOOMANYREFS:109,EUSERS:87,EDQUOT:122,ESTALE:116,ENOTSUP:95,ENOMEDIUM:123,EILSEQ:84,EOVERFLOW:75,ECANCELED:125,ENOTRECOVERABLE:131,EOWNERDEAD:130,ESTRPIPE:86};function _sysconf(name) {
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

   
  Module["_memset"] = _memset;

  function _pthread_cleanup_push(routine, arg) {
      __ATEXIT__.push(function() { Runtime.dynCall('vi', routine, [arg]) })
      _pthread_cleanup_push.level = __ATEXIT__.length;
    }

  function _pthread_cleanup_pop() {
      assert(_pthread_cleanup_push.level == __ATEXIT__.length, 'cannot pop if something else added meanwhile!');
      __ATEXIT__.pop();
      _pthread_cleanup_push.level = __ATEXIT__.length;
    }

  function _abort() {
      Module['abort']();
    }

  function ___lock() {}

  function ___unlock() {}

  
  
  
  var ERRNO_MESSAGES={0:"Success",1:"Not super-user",2:"No such file or directory",3:"No such process",4:"Interrupted system call",5:"I/O error",6:"No such device or address",7:"Arg list too long",8:"Exec format error",9:"Bad file number",10:"No children",11:"No more processes",12:"Not enough core",13:"Permission denied",14:"Bad address",15:"Block device required",16:"Mount device busy",17:"File exists",18:"Cross-device link",19:"No such device",20:"Not a directory",21:"Is a directory",22:"Invalid argument",23:"Too many open files in system",24:"Too many open files",25:"Not a typewriter",26:"Text file busy",27:"File too large",28:"No space left on device",29:"Illegal seek",30:"Read only file system",31:"Too many links",32:"Broken pipe",33:"Math arg out of domain of func",34:"Math result not representable",35:"File locking deadlock error",36:"File or path name too long",37:"No record locks available",38:"Function not implemented",39:"Directory not empty",40:"Too many symbolic links",42:"No message of desired type",43:"Identifier removed",44:"Channel number out of range",45:"Level 2 not synchronized",46:"Level 3 halted",47:"Level 3 reset",48:"Link number out of range",49:"Protocol driver not attached",50:"No CSI structure available",51:"Level 2 halted",52:"Invalid exchange",53:"Invalid request descriptor",54:"Exchange full",55:"No anode",56:"Invalid request code",57:"Invalid slot",59:"Bad font file fmt",60:"Device not a stream",61:"No data (for no delay io)",62:"Timer expired",63:"Out of streams resources",64:"Machine is not on the network",65:"Package not installed",66:"The object is remote",67:"The link has been severed",68:"Advertise error",69:"Srmount error",70:"Communication error on send",71:"Protocol error",72:"Multihop attempted",73:"Cross mount point (not really error)",74:"Trying to read unreadable message",75:"Value too large for defined data type",76:"Given log. name not unique",77:"f.d. invalid for this operation",78:"Remote address changed",79:"Can   access a needed shared lib",80:"Accessing a corrupted shared lib",81:".lib section in a.out corrupted",82:"Attempting to link in too many libs",83:"Attempting to exec a shared library",84:"Illegal byte sequence",86:"Streams pipe error",87:"Too many users",88:"Socket operation on non-socket",89:"Destination address required",90:"Message too long",91:"Protocol wrong type for socket",92:"Protocol not available",93:"Unknown protocol",94:"Socket type not supported",95:"Not supported",96:"Protocol family not supported",97:"Address family not supported by protocol family",98:"Address already in use",99:"Address not available",100:"Network interface is not configured",101:"Network is unreachable",102:"Connection reset by network",103:"Connection aborted",104:"Connection reset by peer",105:"No buffer space available",106:"Socket is already connected",107:"Socket is not connected",108:"Can't send after socket shutdown",109:"Too many references",110:"Connection timed out",111:"Connection refused",112:"Host is down",113:"Host is unreachable",114:"Socket already connected",115:"Connection already in progress",116:"Stale file handle",122:"Quota exceeded",123:"No medium (in tape drive)",125:"Operation canceled",130:"Previous owner died",131:"State not recoverable"};
  
  var PATH={splitPath:function (filename) {
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
      }};var SYSCALLS={DEFAULT_POLLMASK:5,mappings:{},umask:511,calculateAt:function (dirfd, path) {
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
      }};function ___syscall6(which, varargs) {SYSCALLS.varargs = varargs;
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

  
  function _emscripten_memcpy_big(dest, src, num) {
      HEAPU8.set(HEAPU8.subarray(src, src+num), dest);
      return dest;
    } 
  Module["_memcpy"] = _memcpy;

  
  
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

  function ___syscall54(which, varargs) {SYSCALLS.varargs = varargs;
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
FS.staticInit();__ATINIT__.unshift(function() { if (!Module["noFSInit"] && !FS.init.initialized) FS.init() });__ATMAIN__.push(function() { FS.ignorePermissions = false });__ATEXIT__.push(function() { FS.quit() });Module["FS_createFolder"] = FS.createFolder;Module["FS_createPath"] = FS.createPath;Module["FS_createDataFile"] = FS.createDataFile;Module["FS_createPreloadedFile"] = FS.createPreloadedFile;Module["FS_createLazyFile"] = FS.createLazyFile;Module["FS_createLink"] = FS.createLink;Module["FS_createDevice"] = FS.createDevice;Module["FS_unlink"] = FS.unlink;
__ATINIT__.unshift(function() { TTY.init() });__ATEXIT__.push(function() { TTY.shutdown() });
if (ENVIRONMENT_IS_NODE) { var fs = require("fs"); var NODEJS_PATH = require("path"); NODEFS.staticInit(); }
Module["requestFullScreen"] = function Module_requestFullScreen(lockPointer, resizeCanvas, vrDevice) { Browser.requestFullScreen(lockPointer, resizeCanvas, vrDevice) };
  Module["requestAnimationFrame"] = function Module_requestAnimationFrame(func) { Browser.requestAnimationFrame(func) };
  Module["setCanvasSize"] = function Module_setCanvasSize(width, height, noUpdates) { Browser.setCanvasSize(width, height, noUpdates) };
  Module["pauseMainLoop"] = function Module_pauseMainLoop() { Browser.mainLoop.pause() };
  Module["resumeMainLoop"] = function Module_resumeMainLoop() { Browser.mainLoop.resume() };
  Module["getUserMedia"] = function Module_getUserMedia() { Browser.getUserMedia() }
  Module["createContext"] = function Module_createContext(canvas, useWebGL, setInModule, webGLContextAttributes) { return Browser.createContext(canvas, useWebGL, setInModule, webGLContextAttributes) }
STACK_BASE = STACKTOP = Runtime.alignMemory(STATICTOP);

staticSealed = true; // seal the static portion of memory

STACK_MAX = STACK_BASE + TOTAL_STACK;

DYNAMIC_BASE = DYNAMICTOP = Runtime.alignMemory(STACK_MAX);

assert(DYNAMIC_BASE < TOTAL_MEMORY, "TOTAL_MEMORY not big enough for stack");



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

Module.asmLibraryArg = { "abort": abort, "assert": assert, "invoke_ii": invoke_ii, "invoke_iiii": invoke_iiii, "invoke_vi": invoke_vi, "_pthread_cleanup_pop": _pthread_cleanup_pop, "_pthread_self": _pthread_self, "_sysconf": _sysconf, "___lock": ___lock, "___syscall6": ___syscall6, "___setErrNo": ___setErrNo, "_abort": _abort, "_sbrk": _sbrk, "_time": _time, "_pthread_cleanup_push": _pthread_cleanup_push, "_emscripten_memcpy_big": _emscripten_memcpy_big, "___syscall54": ___syscall54, "___unlock": ___unlock, "___syscall140": ___syscall140, "_emscripten_set_main_loop_timing": _emscripten_set_main_loop_timing, "_emscripten_set_main_loop": _emscripten_set_main_loop, "___syscall146": ___syscall146, "STACKTOP": STACKTOP, "STACK_MAX": STACK_MAX, "tempDoublePtr": tempDoublePtr, "ABORT": ABORT };
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
  var _pthread_cleanup_pop=env._pthread_cleanup_pop;
  var _pthread_self=env._pthread_self;
  var _sysconf=env._sysconf;
  var ___lock=env.___lock;
  var ___syscall6=env.___syscall6;
  var ___setErrNo=env.___setErrNo;
  var _abort=env._abort;
  var _sbrk=env._sbrk;
  var _time=env._time;
  var _pthread_cleanup_push=env._pthread_cleanup_push;
  var _emscripten_memcpy_big=env._emscripten_memcpy_big;
  var ___syscall54=env.___syscall54;
  var ___unlock=env.___unlock;
  var ___syscall140=env.___syscall140;
  var _emscripten_set_main_loop_timing=env._emscripten_set_main_loop_timing;
  var _emscripten_set_main_loop=env._emscripten_set_main_loop;
  var ___syscall146=env.___syscall146;
  var tempFloat = 0.0;

// EMSCRIPTEN_START_FUNCS
function _malloc($bytes) {
 $bytes = $bytes | 0;
 var $$3$i = 0, $$lcssa = 0, $$lcssa211 = 0, $$lcssa215 = 0, $$lcssa216 = 0, $$lcssa217 = 0, $$lcssa219 = 0, $$lcssa222 = 0, $$lcssa224 = 0, $$lcssa226 = 0, $$lcssa228 = 0, $$lcssa230 = 0, $$lcssa232 = 0, $$pre$phi$i$iZ2D = 0, $$pre$phi$i23$iZ2D = 0, $$pre$phi$i26Z2D = 0, $$pre$phi$iZ2D = 0, $$pre$phi58$i$iZ2D = 0, $$pre$phiZ2D = 0, $$rsize$3$i = 0, $$sum$i19$i = 0, $$sum2$i21$i = 0, $$sum3132$i$i = 0, $$sum67$i$i = 0, $100 = 0, $1000 = 0, $1002 = 0, $1005 = 0, $1010 = 0, $1016 = 0, $1019 = 0, $1020 = 0, $1027 = 0, $1039 = 0, $1044 = 0, $1051 = 0, $1052 = 0, $1053 = 0, $106 = 0, $1060 = 0, $1062 = 0, $1063 = 0, $110 = 0, $112 = 0, $113 = 0, $115 = 0, $117 = 0, $119 = 0, $12 = 0, $121 = 0, $123 = 0, $125 = 0, $127 = 0, $13 = 0, $132 = 0, $138 = 0, $14 = 0, $141 = 0, $144 = 0, $147 = 0, $148 = 0, $149 = 0, $15 = 0, $151 = 0, $154 = 0, $156 = 0, $159 = 0, $16 = 0, $161 = 0, $164 = 0, $167 = 0, $168 = 0, $17 = 0, $170 = 0, $171 = 0, $173 = 0, $174 = 0, $176 = 0, $177 = 0, $18 = 0, $182 = 0, $183 = 0, $192 = 0, $197 = 0, $201 = 0, $207 = 0, $214 = 0, $217 = 0, $225 = 0, $227 = 0, $228 = 0, $229 = 0, $230 = 0, $231 = 0, $232 = 0, $236 = 0, $237 = 0, $245 = 0, $246 = 0, $247 = 0, $249 = 0, $25 = 0, $250 = 0, $255 = 0, $256 = 0, $259 = 0, $261 = 0, $264 = 0, $269 = 0, $276 = 0, $28 = 0, $285 = 0, $286 = 0, $290 = 0, $300 = 0, $303 = 0, $307 = 0, $309 = 0, $31 = 0, $310 = 0, $312 = 0, $314 = 0, $316 = 0, $318 = 0, $320 = 0, $322 = 0, $324 = 0, $334 = 0, $335 = 0, $337 = 0, $34 = 0, $346 = 0, $348 = 0, $351 = 0, $353 = 0, $356 = 0, $358 = 0, $361 = 0, $364 = 0, $365 = 0, $367 = 0, $368 = 0, $370 = 0, $371 = 0, $373 = 0, $374 = 0, $379 = 0, $38 = 0, $380 = 0, $389 = 0, $394 = 0, $398 = 0, $4 = 0, $404 = 0, $41 = 0, $411 = 0, $414 = 0, $422 = 0, $424 = 0, $425 = 0, $426 = 0, $427 = 0, $431 = 0, $432 = 0, $438 = 0, $44 = 0, $443 = 0, $444 = 0, $447 = 0, $449 = 0, $452 = 0, $457 = 0, $46 = 0, $463 = 0, $467 = 0, $468 = 0, $47 = 0, $475 = 0, $487 = 0, $49 = 0, $492 = 0, $499 = 0, $5 = 0, $500 = 0, $501 = 0, $509 = 0, $51 = 0, $511 = 0, $512 = 0, $522 = 0, $526 = 0, $528 = 0, $529 = 0, $53 = 0, $538 = 0, $545 = 0, $546 = 0, $547 = 0, $548 = 0, $549 = 0, $55 = 0, $550 = 0, $552 = 0, $554 = 0, $555 = 0, $561 = 0, $563 = 0, $565 = 0, $57 = 0, $572 = 0, $574 = 0, $575 = 0, $576 = 0, $584 = 0, $585 = 0, $588 = 0, $59 = 0, $592 = 0, $593 = 0, $596 = 0, $598 = 0, $6 = 0, $602 = 0, $604 = 0, $608 = 0, $61 = 0, $612 = 0, $621 = 0, $622 = 0, $628 = 0, $630 = 0, $632 = 0, $635 = 0, $637 = 0, $64 = 0, $641 = 0, $642 = 0, $648 = 0, $65 = 0, $653 = 0, $655 = 0, $66 = 0, $660 = 0, $661 = 0, $662 = 0, $67 = 0, $676 = 0, $678 = 0, $68 = 0, $683 = 0, $685 = 0, $69 = 0, $690 = 0, $692 = 0, $7 = 0, $70 = 0, $702 = 0, $706 = 0, $711 = 0, $714 = 0, $719 = 0, $720 = 0, $724 = 0, $725 = 0, $730 = 0, $736 = 0, $741 = 0, $744 = 0, $745 = 0, $748 = 0, $750 = 0, $752 = 0, $755 = 0, $766 = 0, $77 = 0, $771 = 0, $773 = 0, $776 = 0, $778 = 0, $781 = 0, $784 = 0, $785 = 0, $787 = 0, $788 = 0, $790 = 0, $791 = 0, $793 = 0, $794 = 0, $799 = 0, $80 = 0, $800 = 0, $809 = 0, $81 = 0, $814 = 0, $818 = 0, $824 = 0, $832 = 0, $838 = 0, $84 = 0, $840 = 0, $841 = 0, $842 = 0, $843 = 0, $847 = 0, $848 = 0, $854 = 0, $859 = 0, $860 = 0, $863 = 0, $865 = 0, $868 = 0, $873 = 0, $879 = 0, $883 = 0, $884 = 0, $89 = 0, $891 = 0, $90 = 0, $903 = 0, $908 = 0, $91 = 0, $915 = 0, $916 = 0, $917 = 0, $92 = 0, $925 = 0, $928 = 0, $929 = 0, $93 = 0, $934 = 0, $94 = 0, $940 = 0, $941 = 0, $943 = 0, $944 = 0, $947 = 0, $95 = 0, $952 = 0, $954 = 0, $959 = 0, $960 = 0, $964 = 0, $970 = 0, $975 = 0, $977 = 0, $978 = 0, $979 = 0, $980 = 0, $984 = 0, $985 = 0, $99 = 0, $991 = 0, $996 = 0, $997 = 0, $F$0$i$i = 0, $F1$0$i = 0, $F4$0 = 0, $F4$0$i$i = 0, $F5$0$i = 0, $I1$0$i$i = 0, $I7$0$i = 0, $I7$0$i$i = 0, $K12$029$i = 0, $K2$07$i$i = 0, $K8$051$i$i = 0, $R$0$i = 0, $R$0$i$i = 0, $R$0$i$i$lcssa = 0, $R$0$i$lcssa = 0, $R$0$i18 = 0, $R$0$i18$lcssa = 0, $R$1$i = 0, $R$1$i$i = 0, $R$1$i20 = 0, $RP$0$i = 0, $RP$0$i$i = 0, $RP$0$i$i$lcssa = 0, $RP$0$i$lcssa = 0, $RP$0$i17 = 0, $RP$0$i17$lcssa = 0, $T$0$lcssa$i = 0, $T$0$lcssa$i$i = 0, $T$0$lcssa$i25$i = 0, $T$028$i = 0, $T$028$i$lcssa = 0, $T$050$i$i = 0, $T$050$i$i$lcssa = 0, $T$06$i$i = 0, $T$06$i$i$lcssa = 0, $br$0$ph$i = 0, $i$02$i$i = 0, $idx$0$i = 0, $mem$0 = 0, $nb$0 = 0, $oldfirst$0$i$i = 0, $qsize$0$i$i = 0, $rsize$0$i = 0, $rsize$0$i$lcssa = 0, $rsize$0$i15 = 0, $rsize$1$i = 0, $rsize$2$i = 0, $rsize$3$lcssa$i = 0, $rsize$331$i = 0, $rst$0$i = 0, $rst$1$i = 0, $sizebits$0$i = 0, $sp$0$i$i = 0, $sp$0$i$i$i = 0, $sp$084$i = 0, $sp$084$i$lcssa = 0, $sp$183$i = 0, $sp$183$i$lcssa = 0, $ssize$0$$i = 0, $ssize$0$i = 0, $ssize$1$ph$i = 0, $ssize$2$i = 0, $t$0$i = 0, $t$0$i14 = 0, $t$1$i = 0, $t$2$ph$i = 0, $t$2$v$3$i = 0, $t$230$i = 0, $tbase$255$i = 0, $tsize$0$ph$i = 0, $tsize$0323944$i = 0, $tsize$1$i = 0, $tsize$254$i = 0, $v$0$i = 0, $v$0$i$lcssa = 0, $v$0$i16 = 0, $v$1$i = 0, $v$2$i = 0, $v$3$lcssa$i = 0, $v$3$ph$i = 0, $v$332$i = 0, label = 0, $964$looptemp = 0;
 do {
  if ($bytes >>> 0 < 245) {
   $4 = $bytes >>> 0 < 11 ? 16 : $bytes + 11 & -8; //@line 533
   $5 = $4 >>> 3; //@line 534
   $6 = HEAP32[43] | 0; //@line 535
   $7 = $6 >>> $5; //@line 536
   if ($7 & 3) {
    $12 = ($7 & 1 ^ 1) + $5 | 0; //@line 542
    $13 = $12 << 1; //@line 543
    $14 = 212 + ($13 << 2) | 0; //@line 544
    $15 = 212 + ($13 + 2 << 2) | 0; //@line 546
    $16 = HEAP32[$15 >> 2] | 0; //@line 547
    $17 = $16 + 8 | 0; //@line 548
    $18 = HEAP32[$17 >> 2] | 0; //@line 549
    do {
     if (($14 | 0) == ($18 | 0)) {
      HEAP32[43] = $6 & ~(1 << $12); //@line 556
     } else {
      if ($18 >>> 0 < (HEAP32[47] | 0) >>> 0) {
       _abort(); //@line 561
      }
      $25 = $18 + 12 | 0; //@line 564
      if ((HEAP32[$25 >> 2] | 0) == ($16 | 0)) {
       HEAP32[$25 >> 2] = $14; //@line 568
       HEAP32[$15 >> 2] = $18; //@line 569
       break;
      } else {
       _abort(); //@line 572
      }
     }
    } while (0);
    $28 = $12 << 3; //@line 577
    HEAP32[$16 + 4 >> 2] = $28 | 3; //@line 580
    $31 = $16 + ($28 | 4) | 0; //@line 582
    HEAP32[$31 >> 2] = HEAP32[$31 >> 2] | 1; //@line 585
    $mem$0 = $17; //@line 586
    return $mem$0 | 0; //@line 587
   }
   $34 = HEAP32[45] | 0; //@line 589
   if ($4 >>> 0 > $34 >>> 0) {
    if ($7) {
     $38 = 2 << $5; //@line 595
     $41 = $7 << $5 & ($38 | 0 - $38); //@line 598
     $44 = ($41 & 0 - $41) + -1 | 0; //@line 601
     $46 = $44 >>> 12 & 16; //@line 603
     $47 = $44 >>> $46; //@line 604
     $49 = $47 >>> 5 & 8; //@line 606
     $51 = $47 >>> $49; //@line 608
     $53 = $51 >>> 2 & 4; //@line 610
     $55 = $51 >>> $53; //@line 612
     $57 = $55 >>> 1 & 2; //@line 614
     $59 = $55 >>> $57; //@line 616
     $61 = $59 >>> 1 & 1; //@line 618
     $64 = ($49 | $46 | $53 | $57 | $61) + ($59 >>> $61) | 0; //@line 621
     $65 = $64 << 1; //@line 622
     $66 = 212 + ($65 << 2) | 0; //@line 623
     $67 = 212 + ($65 + 2 << 2) | 0; //@line 625
     $68 = HEAP32[$67 >> 2] | 0; //@line 626
     $69 = $68 + 8 | 0; //@line 627
     $70 = HEAP32[$69 >> 2] | 0; //@line 628
     do {
      if (($66 | 0) == ($70 | 0)) {
       HEAP32[43] = $6 & ~(1 << $64); //@line 635
       $89 = $34; //@line 636
      } else {
       if ($70 >>> 0 < (HEAP32[47] | 0) >>> 0) {
        _abort(); //@line 641
       }
       $77 = $70 + 12 | 0; //@line 644
       if ((HEAP32[$77 >> 2] | 0) == ($68 | 0)) {
        HEAP32[$77 >> 2] = $66; //@line 648
        HEAP32[$67 >> 2] = $70; //@line 649
        $89 = HEAP32[45] | 0; //@line 651
        break;
       } else {
        _abort(); //@line 654
       }
      }
     } while (0);
     $80 = $64 << 3; //@line 659
     $81 = $80 - $4 | 0; //@line 660
     HEAP32[$68 + 4 >> 2] = $4 | 3; //@line 663
     $84 = $68 + $4 | 0; //@line 664
     HEAP32[$68 + ($4 | 4) >> 2] = $81 | 1; //@line 668
     HEAP32[$68 + $80 >> 2] = $81; //@line 670
     if ($89) {
      $90 = HEAP32[48] | 0; //@line 673
      $91 = $89 >>> 3; //@line 674
      $92 = $91 << 1; //@line 675
      $93 = 212 + ($92 << 2) | 0; //@line 676
      $94 = HEAP32[43] | 0; //@line 677
      $95 = 1 << $91; //@line 678
      if (!($94 & $95)) {
       HEAP32[43] = $94 | $95; //@line 683
       $$pre$phiZ2D = 212 + ($92 + 2 << 2) | 0; //@line 686
       $F4$0 = $93; //@line 686
      } else {
       $99 = 212 + ($92 + 2 << 2) | 0; //@line 689
       $100 = HEAP32[$99 >> 2] | 0; //@line 690
       if ($100 >>> 0 < (HEAP32[47] | 0) >>> 0) {
        _abort(); //@line 694
       } else {
        $$pre$phiZ2D = $99; //@line 697
        $F4$0 = $100; //@line 697
       }
      }
      HEAP32[$$pre$phiZ2D >> 2] = $90; //@line 700
      HEAP32[$F4$0 + 12 >> 2] = $90; //@line 702
      HEAP32[$90 + 8 >> 2] = $F4$0; //@line 704
      HEAP32[$90 + 12 >> 2] = $93; //@line 706
     }
     HEAP32[45] = $81; //@line 708
     HEAP32[48] = $84; //@line 709
     $mem$0 = $69; //@line 710
     return $mem$0 | 0; //@line 711
    }
    $106 = HEAP32[44] | 0; //@line 713
    if (!$106) {
     $nb$0 = $4; //@line 716
    } else {
     $110 = ($106 & 0 - $106) + -1 | 0; //@line 720
     $112 = $110 >>> 12 & 16; //@line 722
     $113 = $110 >>> $112; //@line 723
     $115 = $113 >>> 5 & 8; //@line 725
     $117 = $113 >>> $115; //@line 727
     $119 = $117 >>> 2 & 4; //@line 729
     $121 = $117 >>> $119; //@line 731
     $123 = $121 >>> 1 & 2; //@line 733
     $125 = $121 >>> $123; //@line 735
     $127 = $125 >>> 1 & 1; //@line 737
     $132 = HEAP32[476 + (($115 | $112 | $119 | $123 | $127) + ($125 >>> $127) << 2) >> 2] | 0; //@line 742
     $rsize$0$i = (HEAP32[$132 + 4 >> 2] & -8) - $4 | 0; //@line 747
     $t$0$i = $132; //@line 747
     $v$0$i = $132; //@line 747
     while (1) {
      $138 = HEAP32[$t$0$i + 16 >> 2] | 0; //@line 750
      if (!$138) {
       $141 = HEAP32[$t$0$i + 20 >> 2] | 0; //@line 754
       if (!$141) {
        $rsize$0$i$lcssa = $rsize$0$i; //@line 757
        $v$0$i$lcssa = $v$0$i; //@line 757
        break;
       } else {
        $144 = $141; //@line 760
       }
      } else {
       $144 = $138; //@line 763
      }
      $147 = (HEAP32[$144 + 4 >> 2] & -8) - $4 | 0; //@line 768
      $148 = $147 >>> 0 < $rsize$0$i >>> 0; //@line 769
      $rsize$0$i = $148 ? $147 : $rsize$0$i; //@line 772
      $t$0$i = $144; //@line 772
      $v$0$i = $148 ? $144 : $v$0$i; //@line 772
     }
     $149 = HEAP32[47] | 0; //@line 774
     if ($v$0$i$lcssa >>> 0 < $149 >>> 0) {
      _abort(); //@line 777
     }
     $151 = $v$0$i$lcssa + $4 | 0; //@line 780
     if ($v$0$i$lcssa >>> 0 >= $151 >>> 0) {
      _abort(); //@line 783
     }
     $154 = HEAP32[$v$0$i$lcssa + 24 >> 2] | 0; //@line 787
     $156 = HEAP32[$v$0$i$lcssa + 12 >> 2] | 0; //@line 789
     do {
      if (($156 | 0) == ($v$0$i$lcssa | 0)) {
       $167 = $v$0$i$lcssa + 20 | 0; //@line 793
       $168 = HEAP32[$167 >> 2] | 0; //@line 794
       if (!$168) {
        $170 = $v$0$i$lcssa + 16 | 0; //@line 797
        $171 = HEAP32[$170 >> 2] | 0; //@line 798
        if (!$171) {
         $R$1$i = 0; //@line 801
         break;
        } else {
         $R$0$i = $171; //@line 804
         $RP$0$i = $170; //@line 804
        }
       } else {
        $R$0$i = $168; //@line 807
        $RP$0$i = $167; //@line 807
       }
       while (1) {
        $173 = $R$0$i + 20 | 0; //@line 810
        $174 = HEAP32[$173 >> 2] | 0; //@line 811
        if ($174) {
         $R$0$i = $174; //@line 814
         $RP$0$i = $173; //@line 814
         continue;
        }
        $176 = $R$0$i + 16 | 0; //@line 817
        $177 = HEAP32[$176 >> 2] | 0; //@line 818
        if (!$177) {
         $R$0$i$lcssa = $R$0$i; //@line 821
         $RP$0$i$lcssa = $RP$0$i; //@line 821
         break;
        } else {
         $R$0$i = $177; //@line 824
         $RP$0$i = $176; //@line 824
        }
       }
       if ($RP$0$i$lcssa >>> 0 < $149 >>> 0) {
        _abort(); //@line 829
       } else {
        HEAP32[$RP$0$i$lcssa >> 2] = 0; //@line 832
        $R$1$i = $R$0$i$lcssa; //@line 833
        break;
       }
      } else {
       $159 = HEAP32[$v$0$i$lcssa + 8 >> 2] | 0; //@line 838
       if ($159 >>> 0 < $149 >>> 0) {
        _abort(); //@line 841
       }
       $161 = $159 + 12 | 0; //@line 844
       if ((HEAP32[$161 >> 2] | 0) != ($v$0$i$lcssa | 0)) {
        _abort(); //@line 848
       }
       $164 = $156 + 8 | 0; //@line 851
       if ((HEAP32[$164 >> 2] | 0) == ($v$0$i$lcssa | 0)) {
        HEAP32[$161 >> 2] = $156; //@line 855
        HEAP32[$164 >> 2] = $159; //@line 856
        $R$1$i = $156; //@line 857
        break;
       } else {
        _abort(); //@line 860
       }
      }
     } while (0);
     do {
      if ($154) {
       $182 = HEAP32[$v$0$i$lcssa + 28 >> 2] | 0; //@line 869
       $183 = 476 + ($182 << 2) | 0; //@line 870
       if (($v$0$i$lcssa | 0) == (HEAP32[$183 >> 2] | 0)) {
        HEAP32[$183 >> 2] = $R$1$i; //@line 874
        if (!$R$1$i) {
         HEAP32[44] = HEAP32[44] & ~(1 << $182); //@line 881
         break;
        }
       } else {
        if ($154 >>> 0 < (HEAP32[47] | 0) >>> 0) {
         _abort(); //@line 888
        }
        $192 = $154 + 16 | 0; //@line 891
        if ((HEAP32[$192 >> 2] | 0) == ($v$0$i$lcssa | 0)) {
         HEAP32[$192 >> 2] = $R$1$i; //@line 895
        } else {
         HEAP32[$154 + 20 >> 2] = $R$1$i; //@line 898
        }
        if (!$R$1$i) {
         break;
        }
       }
       $197 = HEAP32[47] | 0; //@line 905
       if ($R$1$i >>> 0 < $197 >>> 0) {
        _abort(); //@line 908
       }
       HEAP32[$R$1$i + 24 >> 2] = $154; //@line 912
       $201 = HEAP32[$v$0$i$lcssa + 16 >> 2] | 0; //@line 914
       do {
        if ($201) {
         if ($201 >>> 0 < $197 >>> 0) {
          _abort(); //@line 920
         } else {
          HEAP32[$R$1$i + 16 >> 2] = $201; //@line 924
          HEAP32[$201 + 24 >> 2] = $R$1$i; //@line 926
          break;
         }
        }
       } while (0);
       $207 = HEAP32[$v$0$i$lcssa + 20 >> 2] | 0; //@line 932
       if ($207) {
        if ($207 >>> 0 < (HEAP32[47] | 0) >>> 0) {
         _abort(); //@line 938
        } else {
         HEAP32[$R$1$i + 20 >> 2] = $207; //@line 942
         HEAP32[$207 + 24 >> 2] = $R$1$i; //@line 944
         break;
        }
       }
      }
     } while (0);
     if ($rsize$0$i$lcssa >>> 0 < 16) {
      $214 = $rsize$0$i$lcssa + $4 | 0; //@line 952
      HEAP32[$v$0$i$lcssa + 4 >> 2] = $214 | 3; //@line 955
      $217 = $v$0$i$lcssa + ($214 + 4) | 0; //@line 957
      HEAP32[$217 >> 2] = HEAP32[$217 >> 2] | 1; //@line 960
     } else {
      HEAP32[$v$0$i$lcssa + 4 >> 2] = $4 | 3; //@line 964
      HEAP32[$v$0$i$lcssa + ($4 | 4) >> 2] = $rsize$0$i$lcssa | 1; //@line 968
      HEAP32[$v$0$i$lcssa + ($rsize$0$i$lcssa + $4) >> 2] = $rsize$0$i$lcssa; //@line 971
      $225 = HEAP32[45] | 0; //@line 972
      if ($225) {
       $227 = HEAP32[48] | 0; //@line 975
       $228 = $225 >>> 3; //@line 976
       $229 = $228 << 1; //@line 977
       $230 = 212 + ($229 << 2) | 0; //@line 978
       $231 = HEAP32[43] | 0; //@line 979
       $232 = 1 << $228; //@line 980
       if (!($231 & $232)) {
        HEAP32[43] = $231 | $232; //@line 985
        $$pre$phi$iZ2D = 212 + ($229 + 2 << 2) | 0; //@line 988
        $F1$0$i = $230; //@line 988
       } else {
        $236 = 212 + ($229 + 2 << 2) | 0; //@line 991
        $237 = HEAP32[$236 >> 2] | 0; //@line 992
        if ($237 >>> 0 < (HEAP32[47] | 0) >>> 0) {
         _abort(); //@line 996
        } else {
         $$pre$phi$iZ2D = $236; //@line 999
         $F1$0$i = $237; //@line 999
        }
       }
       HEAP32[$$pre$phi$iZ2D >> 2] = $227; //@line 1002
       HEAP32[$F1$0$i + 12 >> 2] = $227; //@line 1004
       HEAP32[$227 + 8 >> 2] = $F1$0$i; //@line 1006
       HEAP32[$227 + 12 >> 2] = $230; //@line 1008
      }
      HEAP32[45] = $rsize$0$i$lcssa; //@line 1010
      HEAP32[48] = $151; //@line 1011
     }
     $mem$0 = $v$0$i$lcssa + 8 | 0; //@line 1014
     return $mem$0 | 0; //@line 1015
    }
   } else {
    $nb$0 = $4; //@line 1018
   }
  } else {
   if ($bytes >>> 0 > 4294967231) {
    $nb$0 = -1; //@line 1023
   } else {
    $245 = $bytes + 11 | 0; //@line 1025
    $246 = $245 & -8; //@line 1026
    $247 = HEAP32[44] | 0; //@line 1027
    if (!$247) {
     $nb$0 = $246; //@line 1030
    } else {
     $249 = 0 - $246 | 0; //@line 1032
     $250 = $245 >>> 8; //@line 1033
     if (!$250) {
      $idx$0$i = 0; //@line 1036
     } else {
      if ($246 >>> 0 > 16777215) {
       $idx$0$i = 31; //@line 1040
      } else {
       $255 = ($250 + 1048320 | 0) >>> 16 & 8; //@line 1044
       $256 = $250 << $255; //@line 1045
       $259 = ($256 + 520192 | 0) >>> 16 & 4; //@line 1048
       $261 = $256 << $259; //@line 1050
       $264 = ($261 + 245760 | 0) >>> 16 & 2; //@line 1053
       $269 = 14 - ($259 | $255 | $264) + ($261 << $264 >>> 15) | 0; //@line 1058
       $idx$0$i = $246 >>> ($269 + 7 | 0) & 1 | $269 << 1; //@line 1064
      }
     }
     $276 = HEAP32[476 + ($idx$0$i << 2) >> 2] | 0; //@line 1068
     L123 : do {
      if (!$276) {
       $rsize$2$i = $249; //@line 1072
       $t$1$i = 0; //@line 1072
       $v$2$i = 0; //@line 1072
       label = 86; //@line 1073
      } else {
       $rsize$0$i15 = $249; //@line 1080
       $rst$0$i = 0; //@line 1080
       $sizebits$0$i = $246 << (($idx$0$i | 0) == 31 ? 0 : 25 - ($idx$0$i >>> 1) | 0); //@line 1080
       $t$0$i14 = $276; //@line 1080
       $v$0$i16 = 0; //@line 1080
       while (1) {
        $285 = HEAP32[$t$0$i14 + 4 >> 2] & -8; //@line 1084
        $286 = $285 - $246 | 0; //@line 1085
        if ($286 >>> 0 < $rsize$0$i15 >>> 0) {
         if (($285 | 0) == ($246 | 0)) {
          $rsize$331$i = $286; //@line 1090
          $t$230$i = $t$0$i14; //@line 1090
          $v$332$i = $t$0$i14; //@line 1090
          label = 90; //@line 1091
          break L123;
         } else {
          $rsize$1$i = $286; //@line 1094
          $v$1$i = $t$0$i14; //@line 1094
         }
        } else {
         $rsize$1$i = $rsize$0$i15; //@line 1097
         $v$1$i = $v$0$i16; //@line 1097
        }
        $290 = HEAP32[$t$0$i14 + 20 >> 2] | 0; //@line 1100
        $t$0$i14 = HEAP32[$t$0$i14 + 16 + ($sizebits$0$i >>> 31 << 2) >> 2] | 0; //@line 1103
        $rst$1$i = ($290 | 0) == 0 | ($290 | 0) == ($t$0$i14 | 0) ? $rst$0$i : $290; //@line 1107
        if (!$t$0$i14) {
         $rsize$2$i = $rsize$1$i; //@line 1111
         $t$1$i = $rst$1$i; //@line 1111
         $v$2$i = $v$1$i; //@line 1111
         label = 86; //@line 1112
         break;
        } else {
         $rsize$0$i15 = $rsize$1$i; //@line 1115
         $rst$0$i = $rst$1$i; //@line 1115
         $sizebits$0$i = $sizebits$0$i << 1; //@line 1115
         $v$0$i16 = $v$1$i; //@line 1115
        }
       }
      }
     } while (0);
     if ((label | 0) == 86) {
      if (($t$1$i | 0) == 0 & ($v$2$i | 0) == 0) {
       $300 = 2 << $idx$0$i; //@line 1125
       $303 = $247 & ($300 | 0 - $300); //@line 1128
       if (!$303) {
        $nb$0 = $246; //@line 1131
        break;
       }
       $307 = ($303 & 0 - $303) + -1 | 0; //@line 1136
       $309 = $307 >>> 12 & 16; //@line 1138
       $310 = $307 >>> $309; //@line 1139
       $312 = $310 >>> 5 & 8; //@line 1141
       $314 = $310 >>> $312; //@line 1143
       $316 = $314 >>> 2 & 4; //@line 1145
       $318 = $314 >>> $316; //@line 1147
       $320 = $318 >>> 1 & 2; //@line 1149
       $322 = $318 >>> $320; //@line 1151
       $324 = $322 >>> 1 & 1; //@line 1153
       $t$2$ph$i = HEAP32[476 + (($312 | $309 | $316 | $320 | $324) + ($322 >>> $324) << 2) >> 2] | 0; //@line 1159
       $v$3$ph$i = 0; //@line 1159
      } else {
       $t$2$ph$i = $t$1$i; //@line 1161
       $v$3$ph$i = $v$2$i; //@line 1161
      }
      if (!$t$2$ph$i) {
       $rsize$3$lcssa$i = $rsize$2$i; //@line 1165
       $v$3$lcssa$i = $v$3$ph$i; //@line 1165
      } else {
       $rsize$331$i = $rsize$2$i; //@line 1167
       $t$230$i = $t$2$ph$i; //@line 1167
       $v$332$i = $v$3$ph$i; //@line 1167
       label = 90; //@line 1168
      }
     }
     if ((label | 0) == 90) {
      while (1) {
       label = 0; //@line 1173
       $334 = (HEAP32[$t$230$i + 4 >> 2] & -8) - $246 | 0; //@line 1177
       $335 = $334 >>> 0 < $rsize$331$i >>> 0; //@line 1178
       $$rsize$3$i = $335 ? $334 : $rsize$331$i; //@line 1179
       $t$2$v$3$i = $335 ? $t$230$i : $v$332$i; //@line 1180
       $337 = HEAP32[$t$230$i + 16 >> 2] | 0; //@line 1182
       if ($337) {
        $rsize$331$i = $$rsize$3$i; //@line 1185
        $t$230$i = $337; //@line 1185
        $v$332$i = $t$2$v$3$i; //@line 1185
        label = 90; //@line 1186
        continue;
       }
       $t$230$i = HEAP32[$t$230$i + 20 >> 2] | 0; //@line 1190
       if (!$t$230$i) {
        $rsize$3$lcssa$i = $$rsize$3$i; //@line 1193
        $v$3$lcssa$i = $t$2$v$3$i; //@line 1193
        break;
       } else {
        $rsize$331$i = $$rsize$3$i; //@line 1196
        $v$332$i = $t$2$v$3$i; //@line 1196
        label = 90; //@line 1197
       }
      }
     }
     if (!$v$3$lcssa$i) {
      $nb$0 = $246; //@line 1203
     } else {
      if ($rsize$3$lcssa$i >>> 0 < ((HEAP32[45] | 0) - $246 | 0) >>> 0) {
       $346 = HEAP32[47] | 0; //@line 1209
       if ($v$3$lcssa$i >>> 0 < $346 >>> 0) {
        _abort(); //@line 1212
       }
       $348 = $v$3$lcssa$i + $246 | 0; //@line 1215
       if ($v$3$lcssa$i >>> 0 >= $348 >>> 0) {
        _abort(); //@line 1218
       }
       $351 = HEAP32[$v$3$lcssa$i + 24 >> 2] | 0; //@line 1222
       $353 = HEAP32[$v$3$lcssa$i + 12 >> 2] | 0; //@line 1224
       do {
        if (($353 | 0) == ($v$3$lcssa$i | 0)) {
         $364 = $v$3$lcssa$i + 20 | 0; //@line 1228
         $365 = HEAP32[$364 >> 2] | 0; //@line 1229
         if (!$365) {
          $367 = $v$3$lcssa$i + 16 | 0; //@line 1232
          $368 = HEAP32[$367 >> 2] | 0; //@line 1233
          if (!$368) {
           $R$1$i20 = 0; //@line 1236
           break;
          } else {
           $R$0$i18 = $368; //@line 1239
           $RP$0$i17 = $367; //@line 1239
          }
         } else {
          $R$0$i18 = $365; //@line 1242
          $RP$0$i17 = $364; //@line 1242
         }
         while (1) {
          $370 = $R$0$i18 + 20 | 0; //@line 1245
          $371 = HEAP32[$370 >> 2] | 0; //@line 1246
          if ($371) {
           $R$0$i18 = $371; //@line 1249
           $RP$0$i17 = $370; //@line 1249
           continue;
          }
          $373 = $R$0$i18 + 16 | 0; //@line 1252
          $374 = HEAP32[$373 >> 2] | 0; //@line 1253
          if (!$374) {
           $R$0$i18$lcssa = $R$0$i18; //@line 1256
           $RP$0$i17$lcssa = $RP$0$i17; //@line 1256
           break;
          } else {
           $R$0$i18 = $374; //@line 1259
           $RP$0$i17 = $373; //@line 1259
          }
         }
         if ($RP$0$i17$lcssa >>> 0 < $346 >>> 0) {
          _abort(); //@line 1264
         } else {
          HEAP32[$RP$0$i17$lcssa >> 2] = 0; //@line 1267
          $R$1$i20 = $R$0$i18$lcssa; //@line 1268
          break;
         }
        } else {
         $356 = HEAP32[$v$3$lcssa$i + 8 >> 2] | 0; //@line 1273
         if ($356 >>> 0 < $346 >>> 0) {
          _abort(); //@line 1276
         }
         $358 = $356 + 12 | 0; //@line 1279
         if ((HEAP32[$358 >> 2] | 0) != ($v$3$lcssa$i | 0)) {
          _abort(); //@line 1283
         }
         $361 = $353 + 8 | 0; //@line 1286
         if ((HEAP32[$361 >> 2] | 0) == ($v$3$lcssa$i | 0)) {
          HEAP32[$358 >> 2] = $353; //@line 1290
          HEAP32[$361 >> 2] = $356; //@line 1291
          $R$1$i20 = $353; //@line 1292
          break;
         } else {
          _abort(); //@line 1295
         }
        }
       } while (0);
       do {
        if ($351) {
         $379 = HEAP32[$v$3$lcssa$i + 28 >> 2] | 0; //@line 1304
         $380 = 476 + ($379 << 2) | 0; //@line 1305
         if (($v$3$lcssa$i | 0) == (HEAP32[$380 >> 2] | 0)) {
          HEAP32[$380 >> 2] = $R$1$i20; //@line 1309
          if (!$R$1$i20) {
           HEAP32[44] = HEAP32[44] & ~(1 << $379); //@line 1316
           break;
          }
         } else {
          if ($351 >>> 0 < (HEAP32[47] | 0) >>> 0) {
           _abort(); //@line 1323
          }
          $389 = $351 + 16 | 0; //@line 1326
          if ((HEAP32[$389 >> 2] | 0) == ($v$3$lcssa$i | 0)) {
           HEAP32[$389 >> 2] = $R$1$i20; //@line 1330
          } else {
           HEAP32[$351 + 20 >> 2] = $R$1$i20; //@line 1333
          }
          if (!$R$1$i20) {
           break;
          }
         }
         $394 = HEAP32[47] | 0; //@line 1340
         if ($R$1$i20 >>> 0 < $394 >>> 0) {
          _abort(); //@line 1343
         }
         HEAP32[$R$1$i20 + 24 >> 2] = $351; //@line 1347
         $398 = HEAP32[$v$3$lcssa$i + 16 >> 2] | 0; //@line 1349
         do {
          if ($398) {
           if ($398 >>> 0 < $394 >>> 0) {
            _abort(); //@line 1355
           } else {
            HEAP32[$R$1$i20 + 16 >> 2] = $398; //@line 1359
            HEAP32[$398 + 24 >> 2] = $R$1$i20; //@line 1361
            break;
           }
          }
         } while (0);
         $404 = HEAP32[$v$3$lcssa$i + 20 >> 2] | 0; //@line 1367
         if ($404) {
          if ($404 >>> 0 < (HEAP32[47] | 0) >>> 0) {
           _abort(); //@line 1373
          } else {
           HEAP32[$R$1$i20 + 20 >> 2] = $404; //@line 1377
           HEAP32[$404 + 24 >> 2] = $R$1$i20; //@line 1379
           break;
          }
         }
        }
       } while (0);
       L199 : do {
        if ($rsize$3$lcssa$i >>> 0 < 16) {
         $411 = $rsize$3$lcssa$i + $246 | 0; //@line 1388
         HEAP32[$v$3$lcssa$i + 4 >> 2] = $411 | 3; //@line 1391
         $414 = $v$3$lcssa$i + ($411 + 4) | 0; //@line 1393
         HEAP32[$414 >> 2] = HEAP32[$414 >> 2] | 1; //@line 1396
        } else {
         HEAP32[$v$3$lcssa$i + 4 >> 2] = $246 | 3; //@line 1400
         HEAP32[$v$3$lcssa$i + ($246 | 4) >> 2] = $rsize$3$lcssa$i | 1; //@line 1404
         HEAP32[$v$3$lcssa$i + ($rsize$3$lcssa$i + $246) >> 2] = $rsize$3$lcssa$i; //@line 1407
         $422 = $rsize$3$lcssa$i >>> 3; //@line 1408
         if ($rsize$3$lcssa$i >>> 0 < 256) {
          $424 = $422 << 1; //@line 1411
          $425 = 212 + ($424 << 2) | 0; //@line 1412
          $426 = HEAP32[43] | 0; //@line 1413
          $427 = 1 << $422; //@line 1414
          if (!($426 & $427)) {
           HEAP32[43] = $426 | $427; //@line 1419
           $$pre$phi$i26Z2D = 212 + ($424 + 2 << 2) | 0; //@line 1422
           $F5$0$i = $425; //@line 1422
          } else {
           $431 = 212 + ($424 + 2 << 2) | 0; //@line 1425
           $432 = HEAP32[$431 >> 2] | 0; //@line 1426
           if ($432 >>> 0 < (HEAP32[47] | 0) >>> 0) {
            _abort(); //@line 1430
           } else {
            $$pre$phi$i26Z2D = $431; //@line 1433
            $F5$0$i = $432; //@line 1433
           }
          }
          HEAP32[$$pre$phi$i26Z2D >> 2] = $348; //@line 1436
          HEAP32[$F5$0$i + 12 >> 2] = $348; //@line 1438
          HEAP32[$v$3$lcssa$i + ($246 + 8) >> 2] = $F5$0$i; //@line 1441
          HEAP32[$v$3$lcssa$i + ($246 + 12) >> 2] = $425; //@line 1444
          break;
         }
         $438 = $rsize$3$lcssa$i >>> 8; //@line 1447
         if (!$438) {
          $I7$0$i = 0; //@line 1450
         } else {
          if ($rsize$3$lcssa$i >>> 0 > 16777215) {
           $I7$0$i = 31; //@line 1454
          } else {
           $443 = ($438 + 1048320 | 0) >>> 16 & 8; //@line 1458
           $444 = $438 << $443; //@line 1459
           $447 = ($444 + 520192 | 0) >>> 16 & 4; //@line 1462
           $449 = $444 << $447; //@line 1464
           $452 = ($449 + 245760 | 0) >>> 16 & 2; //@line 1467
           $457 = 14 - ($447 | $443 | $452) + ($449 << $452 >>> 15) | 0; //@line 1472
           $I7$0$i = $rsize$3$lcssa$i >>> ($457 + 7 | 0) & 1 | $457 << 1; //@line 1478
          }
         }
         $463 = 476 + ($I7$0$i << 2) | 0; //@line 1481
         HEAP32[$v$3$lcssa$i + ($246 + 28) >> 2] = $I7$0$i; //@line 1484
         HEAP32[$v$3$lcssa$i + ($246 + 20) >> 2] = 0; //@line 1489
         HEAP32[$v$3$lcssa$i + ($246 + 16) >> 2] = 0; //@line 1490
         $467 = HEAP32[44] | 0; //@line 1491
         $468 = 1 << $I7$0$i; //@line 1492
         if (!($467 & $468)) {
          HEAP32[44] = $467 | $468; //@line 1497
          HEAP32[$463 >> 2] = $348; //@line 1498
          HEAP32[$v$3$lcssa$i + ($246 + 24) >> 2] = $463; //@line 1501
          HEAP32[$v$3$lcssa$i + ($246 + 12) >> 2] = $348; //@line 1504
          HEAP32[$v$3$lcssa$i + ($246 + 8) >> 2] = $348; //@line 1507
          break;
         }
         $475 = HEAP32[$463 >> 2] | 0; //@line 1510
         L217 : do {
          if ((HEAP32[$475 + 4 >> 2] & -8 | 0) == ($rsize$3$lcssa$i | 0)) {
           $T$0$lcssa$i = $475; //@line 1517
          } else {
           $K12$029$i = $rsize$3$lcssa$i << (($I7$0$i | 0) == 31 ? 0 : 25 - ($I7$0$i >>> 1) | 0); //@line 1524
           $T$028$i = $475; //@line 1524
           while (1) {
            $492 = $T$028$i + 16 + ($K12$029$i >>> 31 << 2) | 0; //@line 1527
            $487 = HEAP32[$492 >> 2] | 0; //@line 1528
            if (!$487) {
             $$lcssa232 = $492; //@line 1531
             $T$028$i$lcssa = $T$028$i; //@line 1531
             break;
            }
            if ((HEAP32[$487 + 4 >> 2] & -8 | 0) == ($rsize$3$lcssa$i | 0)) {
             $T$0$lcssa$i = $487; //@line 1540
             break L217;
            } else {
             $K12$029$i = $K12$029$i << 1; //@line 1543
             $T$028$i = $487; //@line 1543
            }
           }
           if ($$lcssa232 >>> 0 < (HEAP32[47] | 0) >>> 0) {
            _abort(); //@line 1549
           } else {
            HEAP32[$$lcssa232 >> 2] = $348; //@line 1552
            HEAP32[$v$3$lcssa$i + ($246 + 24) >> 2] = $T$028$i$lcssa; //@line 1555
            HEAP32[$v$3$lcssa$i + ($246 + 12) >> 2] = $348; //@line 1558
            HEAP32[$v$3$lcssa$i + ($246 + 8) >> 2] = $348; //@line 1561
            break L199;
           }
          }
         } while (0);
         $499 = $T$0$lcssa$i + 8 | 0; //@line 1566
         $500 = HEAP32[$499 >> 2] | 0; //@line 1567
         $501 = HEAP32[47] | 0; //@line 1568
         if ($500 >>> 0 >= $501 >>> 0 & $T$0$lcssa$i >>> 0 >= $501 >>> 0) {
          HEAP32[$500 + 12 >> 2] = $348; //@line 1574
          HEAP32[$499 >> 2] = $348; //@line 1575
          HEAP32[$v$3$lcssa$i + ($246 + 8) >> 2] = $500; //@line 1578
          HEAP32[$v$3$lcssa$i + ($246 + 12) >> 2] = $T$0$lcssa$i; //@line 1581
          HEAP32[$v$3$lcssa$i + ($246 + 24) >> 2] = 0; //@line 1584
          break;
         } else {
          _abort(); //@line 1587
         }
        }
       } while (0);
       $mem$0 = $v$3$lcssa$i + 8 | 0; //@line 1593
       return $mem$0 | 0; //@line 1594
      } else {
       $nb$0 = $246; //@line 1596
      }
     }
    }
   }
  }
 } while (0);
 $509 = HEAP32[45] | 0; //@line 1603
 if ($509 >>> 0 >= $nb$0 >>> 0) {
  $511 = $509 - $nb$0 | 0; //@line 1606
  $512 = HEAP32[48] | 0; //@line 1607
  if ($511 >>> 0 > 15) {
   HEAP32[48] = $512 + $nb$0; //@line 1611
   HEAP32[45] = $511; //@line 1612
   HEAP32[$512 + ($nb$0 + 4) >> 2] = $511 | 1; //@line 1616
   HEAP32[$512 + $509 >> 2] = $511; //@line 1618
   HEAP32[$512 + 4 >> 2] = $nb$0 | 3; //@line 1621
  } else {
   HEAP32[45] = 0; //@line 1623
   HEAP32[48] = 0; //@line 1624
   HEAP32[$512 + 4 >> 2] = $509 | 3; //@line 1627
   $522 = $512 + ($509 + 4) | 0; //@line 1629
   HEAP32[$522 >> 2] = HEAP32[$522 >> 2] | 1; //@line 1632
  }
  $mem$0 = $512 + 8 | 0; //@line 1635
  return $mem$0 | 0; //@line 1636
 }
 $526 = HEAP32[46] | 0; //@line 1638
 if ($526 >>> 0 > $nb$0 >>> 0) {
  $528 = $526 - $nb$0 | 0; //@line 1641
  HEAP32[46] = $528; //@line 1642
  $529 = HEAP32[49] | 0; //@line 1643
  HEAP32[49] = $529 + $nb$0; //@line 1645
  HEAP32[$529 + ($nb$0 + 4) >> 2] = $528 | 1; //@line 1649
  HEAP32[$529 + 4 >> 2] = $nb$0 | 3; //@line 1652
  $mem$0 = $529 + 8 | 0; //@line 1654
  return $mem$0 | 0; //@line 1655
 }
 do {
  if (!(HEAP32[161] | 0)) {
   $538 = _sysconf(30) | 0; //@line 1661
   if (!($538 + -1 & $538)) {
    HEAP32[163] = $538; //@line 1666
    HEAP32[162] = $538; //@line 1667
    HEAP32[164] = -1; //@line 1668
    HEAP32[165] = -1; //@line 1669
    HEAP32[166] = 0; //@line 1670
    HEAP32[154] = 0; //@line 1671
    HEAP32[161] = (_time(0) | 0) & -16 ^ 1431655768; //@line 1675
    break;
   } else {
    _abort(); //@line 1678
   }
  }
 } while (0);
 $545 = $nb$0 + 48 | 0; //@line 1683
 $546 = HEAP32[163] | 0; //@line 1684
 $547 = $nb$0 + 47 | 0; //@line 1685
 $548 = $546 + $547 | 0; //@line 1686
 $549 = 0 - $546 | 0; //@line 1687
 $550 = $548 & $549; //@line 1688
 if ($550 >>> 0 <= $nb$0 >>> 0) {
  $mem$0 = 0; //@line 1691
  return $mem$0 | 0; //@line 1692
 }
 $552 = HEAP32[153] | 0; //@line 1694
 if ($552) {
  $554 = HEAP32[151] | 0; //@line 1697
  $555 = $554 + $550 | 0; //@line 1698
  if ($555 >>> 0 <= $554 >>> 0 | $555 >>> 0 > $552 >>> 0) {
   $mem$0 = 0; //@line 1703
   return $mem$0 | 0; //@line 1704
  }
 }
 L258 : do {
  if (!(HEAP32[154] & 4)) {
   $561 = HEAP32[49] | 0; //@line 1712
   L260 : do {
    if (!$561) {
     label = 174; //@line 1716
    } else {
     $sp$0$i$i = 620; //@line 1718
     while (1) {
      $563 = HEAP32[$sp$0$i$i >> 2] | 0; //@line 1720
      if ($563 >>> 0 <= $561 >>> 0) {
       $565 = $sp$0$i$i + 4 | 0; //@line 1723
       if (($563 + (HEAP32[$565 >> 2] | 0) | 0) >>> 0 > $561 >>> 0) {
        $$lcssa228 = $sp$0$i$i; //@line 1728
        $$lcssa230 = $565; //@line 1728
        break;
       }
      }
      $sp$0$i$i = HEAP32[$sp$0$i$i + 8 >> 2] | 0; //@line 1733
      if (!$sp$0$i$i) {
       label = 174; //@line 1736
       break L260;
      }
     }
     $596 = $548 - (HEAP32[46] | 0) & $549; //@line 1744
     if ($596 >>> 0 < 2147483647) {
      $598 = _sbrk($596 | 0) | 0; //@line 1747
      $602 = ($598 | 0) == ((HEAP32[$$lcssa228 >> 2] | 0) + (HEAP32[$$lcssa230 >> 2] | 0) | 0); //@line 1751
      $$3$i = $602 ? $596 : 0; //@line 1752
      if ($602) {
       if (($598 | 0) == (-1 | 0)) {
        $tsize$0323944$i = $$3$i; //@line 1756
       } else {
        $tbase$255$i = $598; //@line 1758
        $tsize$254$i = $$3$i; //@line 1758
        label = 194; //@line 1759
        break L258;
       }
      } else {
       $br$0$ph$i = $598; //@line 1763
       $ssize$1$ph$i = $596; //@line 1763
       $tsize$0$ph$i = $$3$i; //@line 1763
       label = 184; //@line 1764
      }
     } else {
      $tsize$0323944$i = 0; //@line 1767
     }
    }
   } while (0);
   do {
    if ((label | 0) == 174) {
     $572 = _sbrk(0) | 0; //@line 1773
     if (($572 | 0) == (-1 | 0)) {
      $tsize$0323944$i = 0; //@line 1776
     } else {
      $574 = $572; //@line 1778
      $575 = HEAP32[162] | 0; //@line 1779
      $576 = $575 + -1 | 0; //@line 1780
      if (!($576 & $574)) {
       $ssize$0$i = $550; //@line 1784
      } else {
       $ssize$0$i = $550 - $574 + ($576 + $574 & 0 - $575) | 0; //@line 1791
      }
      $584 = HEAP32[151] | 0; //@line 1793
      $585 = $584 + $ssize$0$i | 0; //@line 1794
      if ($ssize$0$i >>> 0 > $nb$0 >>> 0 & $ssize$0$i >>> 0 < 2147483647) {
       $588 = HEAP32[153] | 0; //@line 1799
       if ($588) {
        if ($585 >>> 0 <= $584 >>> 0 | $585 >>> 0 > $588 >>> 0) {
         $tsize$0323944$i = 0; //@line 1806
         break;
        }
       }
       $592 = _sbrk($ssize$0$i | 0) | 0; //@line 1810
       $593 = ($592 | 0) == ($572 | 0); //@line 1811
       $ssize$0$$i = $593 ? $ssize$0$i : 0; //@line 1812
       if ($593) {
        $tbase$255$i = $572; //@line 1814
        $tsize$254$i = $ssize$0$$i; //@line 1814
        label = 194; //@line 1815
        break L258;
       } else {
        $br$0$ph$i = $592; //@line 1818
        $ssize$1$ph$i = $ssize$0$i; //@line 1818
        $tsize$0$ph$i = $ssize$0$$i; //@line 1818
        label = 184; //@line 1819
       }
      } else {
       $tsize$0323944$i = 0; //@line 1822
      }
     }
    }
   } while (0);
   L280 : do {
    if ((label | 0) == 184) {
     $604 = 0 - $ssize$1$ph$i | 0; //@line 1829
     do {
      if ($545 >>> 0 > $ssize$1$ph$i >>> 0 & ($ssize$1$ph$i >>> 0 < 2147483647 & ($br$0$ph$i | 0) != (-1 | 0))) {
       $608 = HEAP32[163] | 0; //@line 1837
       $612 = $547 - $ssize$1$ph$i + $608 & 0 - $608; //@line 1841
       if ($612 >>> 0 < 2147483647) {
        if ((_sbrk($612 | 0) | 0) == (-1 | 0)) {
         _sbrk($604 | 0) | 0; //@line 1847
         $tsize$0323944$i = $tsize$0$ph$i; //@line 1848
         break L280;
        } else {
         $ssize$2$i = $612 + $ssize$1$ph$i | 0; //@line 1852
         break;
        }
       } else {
        $ssize$2$i = $ssize$1$ph$i; //@line 1856
       }
      } else {
       $ssize$2$i = $ssize$1$ph$i; //@line 1859
      }
     } while (0);
     if (($br$0$ph$i | 0) == (-1 | 0)) {
      $tsize$0323944$i = $tsize$0$ph$i; //@line 1864
     } else {
      $tbase$255$i = $br$0$ph$i; //@line 1866
      $tsize$254$i = $ssize$2$i; //@line 1866
      label = 194; //@line 1867
      break L258;
     }
    }
   } while (0);
   HEAP32[154] = HEAP32[154] | 4; //@line 1874
   $tsize$1$i = $tsize$0323944$i; //@line 1875
   label = 191; //@line 1876
  } else {
   $tsize$1$i = 0; //@line 1878
   label = 191; //@line 1879
  }
 } while (0);
 if ((label | 0) == 191) {
  if ($550 >>> 0 < 2147483647) {
   $621 = _sbrk($550 | 0) | 0; //@line 1885
   $622 = _sbrk(0) | 0; //@line 1886
   if ($621 >>> 0 < $622 >>> 0 & (($621 | 0) != (-1 | 0) & ($622 | 0) != (-1 | 0))) {
    $628 = $622 - $621 | 0; //@line 1895
    $630 = $628 >>> 0 > ($nb$0 + 40 | 0) >>> 0; //@line 1897
    if ($630) {
     $tbase$255$i = $621; //@line 1900
     $tsize$254$i = $630 ? $628 : $tsize$1$i; //@line 1900
     label = 194; //@line 1901
    }
   }
  }
 }
 if ((label | 0) == 194) {
  $632 = (HEAP32[151] | 0) + $tsize$254$i | 0; //@line 1908
  HEAP32[151] = $632; //@line 1909
  if ($632 >>> 0 > (HEAP32[152] | 0) >>> 0) {
   HEAP32[152] = $632; //@line 1913
  }
  $635 = HEAP32[49] | 0; //@line 1915
  L299 : do {
   if (!$635) {
    $637 = HEAP32[47] | 0; //@line 1919
    if (($637 | 0) == 0 | $tbase$255$i >>> 0 < $637 >>> 0) {
     HEAP32[47] = $tbase$255$i; //@line 1924
    }
    HEAP32[155] = $tbase$255$i; //@line 1926
    HEAP32[156] = $tsize$254$i; //@line 1927
    HEAP32[158] = 0; //@line 1928
    HEAP32[52] = HEAP32[161]; //@line 1930
    HEAP32[51] = -1; //@line 1931
    $i$02$i$i = 0; //@line 1932
    do {
     $641 = $i$02$i$i << 1; //@line 1934
     $642 = 212 + ($641 << 2) | 0; //@line 1935
     HEAP32[212 + ($641 + 3 << 2) >> 2] = $642; //@line 1938
     HEAP32[212 + ($641 + 2 << 2) >> 2] = $642; //@line 1941
     $i$02$i$i = $i$02$i$i + 1 | 0; //@line 1942
    } while (($i$02$i$i | 0) != 32);
    $648 = $tbase$255$i + 8 | 0; //@line 1952
    $653 = ($648 & 7 | 0) == 0 ? 0 : 0 - $648 & 7; //@line 1957
    $655 = $tsize$254$i + -40 - $653 | 0; //@line 1959
    HEAP32[49] = $tbase$255$i + $653; //@line 1960
    HEAP32[46] = $655; //@line 1961
    HEAP32[$tbase$255$i + ($653 + 4) >> 2] = $655 | 1; //@line 1965
    HEAP32[$tbase$255$i + ($tsize$254$i + -36) >> 2] = 40; //@line 1968
    HEAP32[50] = HEAP32[165]; //@line 1970
   } else {
    $sp$084$i = 620; //@line 1972
    do {
     $660 = HEAP32[$sp$084$i >> 2] | 0; //@line 1974
     $661 = $sp$084$i + 4 | 0; //@line 1975
     $662 = HEAP32[$661 >> 2] | 0; //@line 1976
     if (($tbase$255$i | 0) == ($660 + $662 | 0)) {
      $$lcssa222 = $660; //@line 1980
      $$lcssa224 = $661; //@line 1980
      $$lcssa226 = $662; //@line 1980
      $sp$084$i$lcssa = $sp$084$i; //@line 1980
      label = 204; //@line 1981
      break;
     }
     $sp$084$i = HEAP32[$sp$084$i + 8 >> 2] | 0; //@line 1985
    } while (($sp$084$i | 0) != 0);
    if ((label | 0) == 204) {
     if (!(HEAP32[$sp$084$i$lcssa + 12 >> 2] & 8)) {
      if ($635 >>> 0 < $tbase$255$i >>> 0 & $635 >>> 0 >= $$lcssa222 >>> 0) {
       HEAP32[$$lcssa224 >> 2] = $$lcssa226 + $tsize$254$i; //@line 2004
       $676 = (HEAP32[46] | 0) + $tsize$254$i | 0; //@line 2006
       $678 = $635 + 8 | 0; //@line 2008
       $683 = ($678 & 7 | 0) == 0 ? 0 : 0 - $678 & 7; //@line 2013
       $685 = $676 - $683 | 0; //@line 2015
       HEAP32[49] = $635 + $683; //@line 2016
       HEAP32[46] = $685; //@line 2017
       HEAP32[$635 + ($683 + 4) >> 2] = $685 | 1; //@line 2021
       HEAP32[$635 + ($676 + 4) >> 2] = 40; //@line 2024
       HEAP32[50] = HEAP32[165]; //@line 2026
       break;
      }
     }
    }
    $690 = HEAP32[47] | 0; //@line 2031
    if ($tbase$255$i >>> 0 < $690 >>> 0) {
     HEAP32[47] = $tbase$255$i; //@line 2034
     $755 = $tbase$255$i; //@line 2035
    } else {
     $755 = $690; //@line 2037
    }
    $692 = $tbase$255$i + $tsize$254$i | 0; //@line 2039
    $sp$183$i = 620; //@line 2040
    while (1) {
     if ((HEAP32[$sp$183$i >> 2] | 0) == ($692 | 0)) {
      $$lcssa219 = $sp$183$i; //@line 2045
      $sp$183$i$lcssa = $sp$183$i; //@line 2045
      label = 212; //@line 2046
      break;
     }
     $sp$183$i = HEAP32[$sp$183$i + 8 >> 2] | 0; //@line 2050
     if (!$sp$183$i) {
      $sp$0$i$i$i = 620; //@line 2053
      break;
     }
    }
    if ((label | 0) == 212) {
     if (!(HEAP32[$sp$183$i$lcssa + 12 >> 2] & 8)) {
      HEAP32[$$lcssa219 >> 2] = $tbase$255$i; //@line 2065
      $702 = $sp$183$i$lcssa + 4 | 0; //@line 2066
      HEAP32[$702 >> 2] = (HEAP32[$702 >> 2] | 0) + $tsize$254$i; //@line 2069
      $706 = $tbase$255$i + 8 | 0; //@line 2071
      $711 = ($706 & 7 | 0) == 0 ? 0 : 0 - $706 & 7; //@line 2076
      $714 = $tbase$255$i + ($tsize$254$i + 8) | 0; //@line 2080
      $719 = ($714 & 7 | 0) == 0 ? 0 : 0 - $714 & 7; //@line 2085
      $720 = $tbase$255$i + ($719 + $tsize$254$i) | 0; //@line 2087
      $$sum$i19$i = $711 + $nb$0 | 0; //@line 2091
      $724 = $tbase$255$i + $$sum$i19$i | 0; //@line 2092
      $725 = $720 - ($tbase$255$i + $711) - $nb$0 | 0; //@line 2093
      HEAP32[$tbase$255$i + ($711 + 4) >> 2] = $nb$0 | 3; //@line 2097
      L324 : do {
       if (($720 | 0) == ($635 | 0)) {
        $730 = (HEAP32[46] | 0) + $725 | 0; //@line 2102
        HEAP32[46] = $730; //@line 2103
        HEAP32[49] = $724; //@line 2104
        HEAP32[$tbase$255$i + ($$sum$i19$i + 4) >> 2] = $730 | 1; //@line 2108
       } else {
        if (($720 | 0) == (HEAP32[48] | 0)) {
         $736 = (HEAP32[45] | 0) + $725 | 0; //@line 2114
         HEAP32[45] = $736; //@line 2115
         HEAP32[48] = $724; //@line 2116
         HEAP32[$tbase$255$i + ($$sum$i19$i + 4) >> 2] = $736 | 1; //@line 2120
         HEAP32[$tbase$255$i + ($736 + $$sum$i19$i) >> 2] = $736; //@line 2123
         break;
        }
        $$sum2$i21$i = $tsize$254$i + 4 | 0; //@line 2126
        $741 = HEAP32[$tbase$255$i + ($$sum2$i21$i + $719) >> 2] | 0; //@line 2129
        if (($741 & 3 | 0) == 1) {
         $744 = $741 & -8; //@line 2133
         $745 = $741 >>> 3; //@line 2134
         L332 : do {
          if ($741 >>> 0 < 256) {
           $748 = HEAP32[$tbase$255$i + (($719 | 8) + $tsize$254$i) >> 2] | 0; //@line 2141
           $750 = HEAP32[$tbase$255$i + ($tsize$254$i + 12 + $719) >> 2] | 0; //@line 2145
           $752 = 212 + ($745 << 1 << 2) | 0; //@line 2147
           do {
            if (($748 | 0) != ($752 | 0)) {
             if ($748 >>> 0 < $755 >>> 0) {
              _abort(); //@line 2153
             }
             if ((HEAP32[$748 + 12 >> 2] | 0) == ($720 | 0)) {
              break;
             }
             _abort(); //@line 2162
            }
           } while (0);
           if (($750 | 0) == ($748 | 0)) {
            HEAP32[43] = HEAP32[43] & ~(1 << $745); //@line 2172
            break;
           }
           do {
            if (($750 | 0) == ($752 | 0)) {
             $$pre$phi58$i$iZ2D = $750 + 8 | 0; //@line 2179
            } else {
             if ($750 >>> 0 < $755 >>> 0) {
              _abort(); //@line 2183
             }
             $766 = $750 + 8 | 0; //@line 2186
             if ((HEAP32[$766 >> 2] | 0) == ($720 | 0)) {
              $$pre$phi58$i$iZ2D = $766; //@line 2190
              break;
             }
             _abort(); //@line 2193
            }
           } while (0);
           HEAP32[$748 + 12 >> 2] = $750; //@line 2198
           HEAP32[$$pre$phi58$i$iZ2D >> 2] = $748; //@line 2199
          } else {
           $771 = HEAP32[$tbase$255$i + (($719 | 24) + $tsize$254$i) >> 2] | 0; //@line 2204
           $773 = HEAP32[$tbase$255$i + ($tsize$254$i + 12 + $719) >> 2] | 0; //@line 2208
           do {
            if (($773 | 0) == ($720 | 0)) {
             $$sum67$i$i = $719 | 16; //@line 2212
             $784 = $tbase$255$i + ($$sum2$i21$i + $$sum67$i$i) | 0; //@line 2214
             $785 = HEAP32[$784 >> 2] | 0; //@line 2215
             if (!$785) {
              $787 = $tbase$255$i + ($$sum67$i$i + $tsize$254$i) | 0; //@line 2219
              $788 = HEAP32[$787 >> 2] | 0; //@line 2220
              if (!$788) {
               $R$1$i$i = 0; //@line 2223
               break;
              } else {
               $R$0$i$i = $788; //@line 2226
               $RP$0$i$i = $787; //@line 2226
              }
             } else {
              $R$0$i$i = $785; //@line 2229
              $RP$0$i$i = $784; //@line 2229
             }
             while (1) {
              $790 = $R$0$i$i + 20 | 0; //@line 2232
              $791 = HEAP32[$790 >> 2] | 0; //@line 2233
              if ($791) {
               $R$0$i$i = $791; //@line 2236
               $RP$0$i$i = $790; //@line 2236
               continue;
              }
              $793 = $R$0$i$i + 16 | 0; //@line 2239
              $794 = HEAP32[$793 >> 2] | 0; //@line 2240
              if (!$794) {
               $R$0$i$i$lcssa = $R$0$i$i; //@line 2243
               $RP$0$i$i$lcssa = $RP$0$i$i; //@line 2243
               break;
              } else {
               $R$0$i$i = $794; //@line 2246
               $RP$0$i$i = $793; //@line 2246
              }
             }
             if ($RP$0$i$i$lcssa >>> 0 < $755 >>> 0) {
              _abort(); //@line 2251
             } else {
              HEAP32[$RP$0$i$i$lcssa >> 2] = 0; //@line 2254
              $R$1$i$i = $R$0$i$i$lcssa; //@line 2255
              break;
             }
            } else {
             $776 = HEAP32[$tbase$255$i + (($719 | 8) + $tsize$254$i) >> 2] | 0; //@line 2262
             if ($776 >>> 0 < $755 >>> 0) {
              _abort(); //@line 2265
             }
             $778 = $776 + 12 | 0; //@line 2268
             if ((HEAP32[$778 >> 2] | 0) != ($720 | 0)) {
              _abort(); //@line 2272
             }
             $781 = $773 + 8 | 0; //@line 2275
             if ((HEAP32[$781 >> 2] | 0) == ($720 | 0)) {
              HEAP32[$778 >> 2] = $773; //@line 2279
              HEAP32[$781 >> 2] = $776; //@line 2280
              $R$1$i$i = $773; //@line 2281
              break;
             } else {
              _abort(); //@line 2284
             }
            }
           } while (0);
           if (!$771) {
            break;
           }
           $799 = HEAP32[$tbase$255$i + ($tsize$254$i + 28 + $719) >> 2] | 0; //@line 2296
           $800 = 476 + ($799 << 2) | 0; //@line 2297
           do {
            if (($720 | 0) == (HEAP32[$800 >> 2] | 0)) {
             HEAP32[$800 >> 2] = $R$1$i$i; //@line 2302
             if ($R$1$i$i) {
              break;
             }
             HEAP32[44] = HEAP32[44] & ~(1 << $799); //@line 2311
             break L332;
            } else {
             if ($771 >>> 0 < (HEAP32[47] | 0) >>> 0) {
              _abort(); //@line 2317
             }
             $809 = $771 + 16 | 0; //@line 2320
             if ((HEAP32[$809 >> 2] | 0) == ($720 | 0)) {
              HEAP32[$809 >> 2] = $R$1$i$i; //@line 2324
             } else {
              HEAP32[$771 + 20 >> 2] = $R$1$i$i; //@line 2327
             }
             if (!$R$1$i$i) {
              break L332;
             }
            }
           } while (0);
           $814 = HEAP32[47] | 0; //@line 2335
           if ($R$1$i$i >>> 0 < $814 >>> 0) {
            _abort(); //@line 2338
           }
           HEAP32[$R$1$i$i + 24 >> 2] = $771; //@line 2342
           $$sum3132$i$i = $719 | 16; //@line 2343
           $818 = HEAP32[$tbase$255$i + ($$sum3132$i$i + $tsize$254$i) >> 2] | 0; //@line 2346
           do {
            if ($818) {
             if ($818 >>> 0 < $814 >>> 0) {
              _abort(); //@line 2352
             } else {
              HEAP32[$R$1$i$i + 16 >> 2] = $818; //@line 2356
              HEAP32[$818 + 24 >> 2] = $R$1$i$i; //@line 2358
              break;
             }
            }
           } while (0);
           $824 = HEAP32[$tbase$255$i + ($$sum2$i21$i + $$sum3132$i$i) >> 2] | 0; //@line 2365
           if (!$824) {
            break;
           }
           if ($824 >>> 0 < (HEAP32[47] | 0) >>> 0) {
            _abort(); //@line 2373
           } else {
            HEAP32[$R$1$i$i + 20 >> 2] = $824; //@line 2377
            HEAP32[$824 + 24 >> 2] = $R$1$i$i; //@line 2379
            break;
           }
          }
         } while (0);
         $oldfirst$0$i$i = $tbase$255$i + (($744 | $719) + $tsize$254$i) | 0; //@line 2388
         $qsize$0$i$i = $744 + $725 | 0; //@line 2388
        } else {
         $oldfirst$0$i$i = $720; //@line 2390
         $qsize$0$i$i = $725; //@line 2390
        }
        $832 = $oldfirst$0$i$i + 4 | 0; //@line 2392
        HEAP32[$832 >> 2] = HEAP32[$832 >> 2] & -2; //@line 2395
        HEAP32[$tbase$255$i + ($$sum$i19$i + 4) >> 2] = $qsize$0$i$i | 1; //@line 2399
        HEAP32[$tbase$255$i + ($qsize$0$i$i + $$sum$i19$i) >> 2] = $qsize$0$i$i; //@line 2402
        $838 = $qsize$0$i$i >>> 3; //@line 2403
        if ($qsize$0$i$i >>> 0 < 256) {
         $840 = $838 << 1; //@line 2406
         $841 = 212 + ($840 << 2) | 0; //@line 2407
         $842 = HEAP32[43] | 0; //@line 2408
         $843 = 1 << $838; //@line 2409
         do {
          if (!($842 & $843)) {
           HEAP32[43] = $842 | $843; //@line 2415
           $$pre$phi$i23$iZ2D = 212 + ($840 + 2 << 2) | 0; //@line 2418
           $F4$0$i$i = $841; //@line 2418
          } else {
           $847 = 212 + ($840 + 2 << 2) | 0; //@line 2421
           $848 = HEAP32[$847 >> 2] | 0; //@line 2422
           if ($848 >>> 0 >= (HEAP32[47] | 0) >>> 0) {
            $$pre$phi$i23$iZ2D = $847; //@line 2426
            $F4$0$i$i = $848; //@line 2426
            break;
           }
           _abort(); //@line 2429
          }
         } while (0);
         HEAP32[$$pre$phi$i23$iZ2D >> 2] = $724; //@line 2433
         HEAP32[$F4$0$i$i + 12 >> 2] = $724; //@line 2435
         HEAP32[$tbase$255$i + ($$sum$i19$i + 8) >> 2] = $F4$0$i$i; //@line 2438
         HEAP32[$tbase$255$i + ($$sum$i19$i + 12) >> 2] = $841; //@line 2441
         break;
        }
        $854 = $qsize$0$i$i >>> 8; //@line 2444
        do {
         if (!$854) {
          $I7$0$i$i = 0; //@line 2448
         } else {
          if ($qsize$0$i$i >>> 0 > 16777215) {
           $I7$0$i$i = 31; //@line 2452
           break;
          }
          $859 = ($854 + 1048320 | 0) >>> 16 & 8; //@line 2457
          $860 = $854 << $859; //@line 2458
          $863 = ($860 + 520192 | 0) >>> 16 & 4; //@line 2461
          $865 = $860 << $863; //@line 2463
          $868 = ($865 + 245760 | 0) >>> 16 & 2; //@line 2466
          $873 = 14 - ($863 | $859 | $868) + ($865 << $868 >>> 15) | 0; //@line 2471
          $I7$0$i$i = $qsize$0$i$i >>> ($873 + 7 | 0) & 1 | $873 << 1; //@line 2477
         }
        } while (0);
        $879 = 476 + ($I7$0$i$i << 2) | 0; //@line 2480
        HEAP32[$tbase$255$i + ($$sum$i19$i + 28) >> 2] = $I7$0$i$i; //@line 2483
        HEAP32[$tbase$255$i + ($$sum$i19$i + 20) >> 2] = 0; //@line 2488
        HEAP32[$tbase$255$i + ($$sum$i19$i + 16) >> 2] = 0; //@line 2489
        $883 = HEAP32[44] | 0; //@line 2490
        $884 = 1 << $I7$0$i$i; //@line 2491
        if (!($883 & $884)) {
         HEAP32[44] = $883 | $884; //@line 2496
         HEAP32[$879 >> 2] = $724; //@line 2497
         HEAP32[$tbase$255$i + ($$sum$i19$i + 24) >> 2] = $879; //@line 2500
         HEAP32[$tbase$255$i + ($$sum$i19$i + 12) >> 2] = $724; //@line 2503
         HEAP32[$tbase$255$i + ($$sum$i19$i + 8) >> 2] = $724; //@line 2506
         break;
        }
        $891 = HEAP32[$879 >> 2] | 0; //@line 2509
        L418 : do {
         if ((HEAP32[$891 + 4 >> 2] & -8 | 0) == ($qsize$0$i$i | 0)) {
          $T$0$lcssa$i25$i = $891; //@line 2516
         } else {
          $K8$051$i$i = $qsize$0$i$i << (($I7$0$i$i | 0) == 31 ? 0 : 25 - ($I7$0$i$i >>> 1) | 0); //@line 2523
          $T$050$i$i = $891; //@line 2523
          while (1) {
           $908 = $T$050$i$i + 16 + ($K8$051$i$i >>> 31 << 2) | 0; //@line 2526
           $903 = HEAP32[$908 >> 2] | 0; //@line 2527
           if (!$903) {
            $$lcssa = $908; //@line 2530
            $T$050$i$i$lcssa = $T$050$i$i; //@line 2530
            break;
           }
           if ((HEAP32[$903 + 4 >> 2] & -8 | 0) == ($qsize$0$i$i | 0)) {
            $T$0$lcssa$i25$i = $903; //@line 2539
            break L418;
           } else {
            $K8$051$i$i = $K8$051$i$i << 1; //@line 2542
            $T$050$i$i = $903; //@line 2542
           }
          }
          if ($$lcssa >>> 0 < (HEAP32[47] | 0) >>> 0) {
           _abort(); //@line 2548
          } else {
           HEAP32[$$lcssa >> 2] = $724; //@line 2551
           HEAP32[$tbase$255$i + ($$sum$i19$i + 24) >> 2] = $T$050$i$i$lcssa; //@line 2554
           HEAP32[$tbase$255$i + ($$sum$i19$i + 12) >> 2] = $724; //@line 2557
           HEAP32[$tbase$255$i + ($$sum$i19$i + 8) >> 2] = $724; //@line 2560
           break L324;
          }
         }
        } while (0);
        $915 = $T$0$lcssa$i25$i + 8 | 0; //@line 2565
        $916 = HEAP32[$915 >> 2] | 0; //@line 2566
        $917 = HEAP32[47] | 0; //@line 2567
        if ($916 >>> 0 >= $917 >>> 0 & $T$0$lcssa$i25$i >>> 0 >= $917 >>> 0) {
         HEAP32[$916 + 12 >> 2] = $724; //@line 2573
         HEAP32[$915 >> 2] = $724; //@line 2574
         HEAP32[$tbase$255$i + ($$sum$i19$i + 8) >> 2] = $916; //@line 2577
         HEAP32[$tbase$255$i + ($$sum$i19$i + 12) >> 2] = $T$0$lcssa$i25$i; //@line 2580
         HEAP32[$tbase$255$i + ($$sum$i19$i + 24) >> 2] = 0; //@line 2583
         break;
        } else {
         _abort(); //@line 2586
        }
       }
      } while (0);
      $mem$0 = $tbase$255$i + ($711 | 8) | 0; //@line 2593
      return $mem$0 | 0; //@line 2594
     } else {
      $sp$0$i$i$i = 620; //@line 2596
     }
    }
    while (1) {
     $925 = HEAP32[$sp$0$i$i$i >> 2] | 0; //@line 2600
     if ($925 >>> 0 <= $635 >>> 0) {
      $928 = HEAP32[$sp$0$i$i$i + 4 >> 2] | 0; //@line 2604
      $929 = $925 + $928 | 0; //@line 2605
      if ($929 >>> 0 > $635 >>> 0) {
       $$lcssa215 = $925; //@line 2608
       $$lcssa216 = $928; //@line 2608
       $$lcssa217 = $929; //@line 2608
       break;
      }
     }
     $sp$0$i$i$i = HEAP32[$sp$0$i$i$i + 8 >> 2] | 0; //@line 2614
    }
    $934 = $$lcssa215 + ($$lcssa216 + -39) | 0; //@line 2619
    $940 = $$lcssa215 + ($$lcssa216 + -47 + (($934 & 7 | 0) == 0 ? 0 : 0 - $934 & 7)) | 0; //@line 2626
    $941 = $635 + 16 | 0; //@line 2627
    $943 = $940 >>> 0 < $941 >>> 0 ? $635 : $940; //@line 2629
    $944 = $943 + 8 | 0; //@line 2630
    $947 = $tbase$255$i + 8 | 0; //@line 2633
    $952 = ($947 & 7 | 0) == 0 ? 0 : 0 - $947 & 7; //@line 2638
    $954 = $tsize$254$i + -40 - $952 | 0; //@line 2640
    HEAP32[49] = $tbase$255$i + $952; //@line 2641
    HEAP32[46] = $954; //@line 2642
    HEAP32[$tbase$255$i + ($952 + 4) >> 2] = $954 | 1; //@line 2646
    HEAP32[$tbase$255$i + ($tsize$254$i + -36) >> 2] = 40; //@line 2649
    HEAP32[50] = HEAP32[165]; //@line 2651
    $959 = $943 + 4 | 0; //@line 2652
    HEAP32[$959 >> 2] = 27; //@line 2653
    HEAP32[$944 >> 2] = HEAP32[155]; //@line 2654
    HEAP32[$944 + 4 >> 2] = HEAP32[156]; //@line 2654
    HEAP32[$944 + 8 >> 2] = HEAP32[157]; //@line 2654
    HEAP32[$944 + 12 >> 2] = HEAP32[158]; //@line 2654
    HEAP32[155] = $tbase$255$i; //@line 2655
    HEAP32[156] = $tsize$254$i; //@line 2656
    HEAP32[158] = 0; //@line 2657
    HEAP32[157] = $944; //@line 2658
    $960 = $943 + 28 | 0; //@line 2659
    HEAP32[$960 >> 2] = 7; //@line 2660
    if (($943 + 32 | 0) >>> 0 < $$lcssa217 >>> 0) {
     $964 = $960; //@line 2664
     do {
      $964$looptemp = $964;
      $964 = $964 + 4 | 0; //@line 2666
      HEAP32[$964 >> 2] = 7; //@line 2667
     } while (($964$looptemp + 8 | 0) >>> 0 < $$lcssa217 >>> 0);
    }
    if (($943 | 0) != ($635 | 0)) {
     $970 = $943 - $635 | 0; //@line 2681
     HEAP32[$959 >> 2] = HEAP32[$959 >> 2] & -2; //@line 2684
     HEAP32[$635 + 4 >> 2] = $970 | 1; //@line 2687
     HEAP32[$943 >> 2] = $970; //@line 2688
     $975 = $970 >>> 3; //@line 2689
     if ($970 >>> 0 < 256) {
      $977 = $975 << 1; //@line 2692
      $978 = 212 + ($977 << 2) | 0; //@line 2693
      $979 = HEAP32[43] | 0; //@line 2694
      $980 = 1 << $975; //@line 2695
      if (!($979 & $980)) {
       HEAP32[43] = $979 | $980; //@line 2700
       $$pre$phi$i$iZ2D = 212 + ($977 + 2 << 2) | 0; //@line 2703
       $F$0$i$i = $978; //@line 2703
      } else {
       $984 = 212 + ($977 + 2 << 2) | 0; //@line 2706
       $985 = HEAP32[$984 >> 2] | 0; //@line 2707
       if ($985 >>> 0 < (HEAP32[47] | 0) >>> 0) {
        _abort(); //@line 2711
       } else {
        $$pre$phi$i$iZ2D = $984; //@line 2714
        $F$0$i$i = $985; //@line 2714
       }
      }
      HEAP32[$$pre$phi$i$iZ2D >> 2] = $635; //@line 2717
      HEAP32[$F$0$i$i + 12 >> 2] = $635; //@line 2719
      HEAP32[$635 + 8 >> 2] = $F$0$i$i; //@line 2721
      HEAP32[$635 + 12 >> 2] = $978; //@line 2723
      break;
     }
     $991 = $970 >>> 8; //@line 2726
     if (!$991) {
      $I1$0$i$i = 0; //@line 2729
     } else {
      if ($970 >>> 0 > 16777215) {
       $I1$0$i$i = 31; //@line 2733
      } else {
       $996 = ($991 + 1048320 | 0) >>> 16 & 8; //@line 2737
       $997 = $991 << $996; //@line 2738
       $1000 = ($997 + 520192 | 0) >>> 16 & 4; //@line 2741
       $1002 = $997 << $1000; //@line 2743
       $1005 = ($1002 + 245760 | 0) >>> 16 & 2; //@line 2746
       $1010 = 14 - ($1000 | $996 | $1005) + ($1002 << $1005 >>> 15) | 0; //@line 2751
       $I1$0$i$i = $970 >>> ($1010 + 7 | 0) & 1 | $1010 << 1; //@line 2757
      }
     }
     $1016 = 476 + ($I1$0$i$i << 2) | 0; //@line 2760
     HEAP32[$635 + 28 >> 2] = $I1$0$i$i; //@line 2762
     HEAP32[$635 + 20 >> 2] = 0; //@line 2764
     HEAP32[$941 >> 2] = 0; //@line 2765
     $1019 = HEAP32[44] | 0; //@line 2766
     $1020 = 1 << $I1$0$i$i; //@line 2767
     if (!($1019 & $1020)) {
      HEAP32[44] = $1019 | $1020; //@line 2772
      HEAP32[$1016 >> 2] = $635; //@line 2773
      HEAP32[$635 + 24 >> 2] = $1016; //@line 2775
      HEAP32[$635 + 12 >> 2] = $635; //@line 2777
      HEAP32[$635 + 8 >> 2] = $635; //@line 2779
      break;
     }
     $1027 = HEAP32[$1016 >> 2] | 0; //@line 2782
     L459 : do {
      if ((HEAP32[$1027 + 4 >> 2] & -8 | 0) == ($970 | 0)) {
       $T$0$lcssa$i$i = $1027; //@line 2789
      } else {
       $K2$07$i$i = $970 << (($I1$0$i$i | 0) == 31 ? 0 : 25 - ($I1$0$i$i >>> 1) | 0); //@line 2796
       $T$06$i$i = $1027; //@line 2796
       while (1) {
        $1044 = $T$06$i$i + 16 + ($K2$07$i$i >>> 31 << 2) | 0; //@line 2799
        $1039 = HEAP32[$1044 >> 2] | 0; //@line 2800
        if (!$1039) {
         $$lcssa211 = $1044; //@line 2803
         $T$06$i$i$lcssa = $T$06$i$i; //@line 2803
         break;
        }
        if ((HEAP32[$1039 + 4 >> 2] & -8 | 0) == ($970 | 0)) {
         $T$0$lcssa$i$i = $1039; //@line 2812
         break L459;
        } else {
         $K2$07$i$i = $K2$07$i$i << 1; //@line 2815
         $T$06$i$i = $1039; //@line 2815
        }
       }
       if ($$lcssa211 >>> 0 < (HEAP32[47] | 0) >>> 0) {
        _abort(); //@line 2821
       } else {
        HEAP32[$$lcssa211 >> 2] = $635; //@line 2824
        HEAP32[$635 + 24 >> 2] = $T$06$i$i$lcssa; //@line 2826
        HEAP32[$635 + 12 >> 2] = $635; //@line 2828
        HEAP32[$635 + 8 >> 2] = $635; //@line 2830
        break L299;
       }
      }
     } while (0);
     $1051 = $T$0$lcssa$i$i + 8 | 0; //@line 2835
     $1052 = HEAP32[$1051 >> 2] | 0; //@line 2836
     $1053 = HEAP32[47] | 0; //@line 2837
     if ($1052 >>> 0 >= $1053 >>> 0 & $T$0$lcssa$i$i >>> 0 >= $1053 >>> 0) {
      HEAP32[$1052 + 12 >> 2] = $635; //@line 2843
      HEAP32[$1051 >> 2] = $635; //@line 2844
      HEAP32[$635 + 8 >> 2] = $1052; //@line 2846
      HEAP32[$635 + 12 >> 2] = $T$0$lcssa$i$i; //@line 2848
      HEAP32[$635 + 24 >> 2] = 0; //@line 2850
      break;
     } else {
      _abort(); //@line 2853
     }
    }
   }
  } while (0);
  $1060 = HEAP32[46] | 0; //@line 2859
  if ($1060 >>> 0 > $nb$0 >>> 0) {
   $1062 = $1060 - $nb$0 | 0; //@line 2862
   HEAP32[46] = $1062; //@line 2863
   $1063 = HEAP32[49] | 0; //@line 2864
   HEAP32[49] = $1063 + $nb$0; //@line 2866
   HEAP32[$1063 + ($nb$0 + 4) >> 2] = $1062 | 1; //@line 2870
   HEAP32[$1063 + 4 >> 2] = $nb$0 | 3; //@line 2873
   $mem$0 = $1063 + 8 | 0; //@line 2875
   return $mem$0 | 0; //@line 2876
  }
 }
 HEAP32[(___errno_location() | 0) >> 2] = 12; //@line 2880
 $mem$0 = 0; //@line 2881
 return $mem$0 | 0; //@line 2882
}
function _free($mem) {
 $mem = $mem | 0;
 var $$lcssa = 0, $$pre$phi59Z2D = 0, $$pre$phi61Z2D = 0, $$pre$phiZ2D = 0, $$sum2 = 0, $1 = 0, $103 = 0, $104 = 0, $111 = 0, $112 = 0, $12 = 0, $120 = 0, $128 = 0, $133 = 0, $134 = 0, $137 = 0, $139 = 0, $14 = 0, $141 = 0, $15 = 0, $156 = 0, $161 = 0, $163 = 0, $166 = 0, $169 = 0, $172 = 0, $175 = 0, $176 = 0, $178 = 0, $179 = 0, $181 = 0, $182 = 0, $184 = 0, $185 = 0, $19 = 0, $191 = 0, $192 = 0, $2 = 0, $201 = 0, $206 = 0, $210 = 0, $216 = 0, $22 = 0, $231 = 0, $233 = 0, $234 = 0, $235 = 0, $236 = 0, $24 = 0, $240 = 0, $241 = 0, $247 = 0, $252 = 0, $253 = 0, $256 = 0, $258 = 0, $26 = 0, $261 = 0, $266 = 0, $272 = 0, $276 = 0, $277 = 0, $284 = 0, $296 = 0, $301 = 0, $308 = 0, $309 = 0, $310 = 0, $318 = 0, $39 = 0, $44 = 0, $46 = 0, $49 = 0, $5 = 0, $51 = 0, $54 = 0, $57 = 0, $58 = 0, $6 = 0, $60 = 0, $61 = 0, $63 = 0, $64 = 0, $66 = 0, $67 = 0, $72 = 0, $73 = 0, $8 = 0, $82 = 0, $87 = 0, $9 = 0, $91 = 0, $97 = 0, $F16$0 = 0, $I18$0 = 0, $K19$052 = 0, $R$0 = 0, $R$0$lcssa = 0, $R$1 = 0, $R7$0 = 0, $R7$0$lcssa = 0, $R7$1 = 0, $RP$0 = 0, $RP$0$lcssa = 0, $RP9$0 = 0, $RP9$0$lcssa = 0, $T$0$lcssa = 0, $T$051 = 0, $T$051$lcssa = 0, $p$0 = 0, $psize$0 = 0, $psize$1 = 0, $sp$0$i = 0, $sp$0$in$i = 0;
 if (!$mem) {
  return;
 }
 $1 = $mem + -8 | 0; //@line 2910
 $2 = HEAP32[47] | 0; //@line 2911
 if ($1 >>> 0 < $2 >>> 0) {
  _abort(); //@line 2914
 }
 $5 = HEAP32[$mem + -4 >> 2] | 0; //@line 2918
 $6 = $5 & 3; //@line 2919
 if (($6 | 0) == 1) {
  _abort(); //@line 2922
 }
 $8 = $5 & -8; //@line 2925
 $9 = $mem + ($8 + -8) | 0; //@line 2927
 do {
  if (!($5 & 1)) {
   $12 = HEAP32[$1 >> 2] | 0; //@line 2932
   if (!$6) {
    return;
   }
   $$sum2 = -8 - $12 | 0; //@line 2937
   $14 = $mem + $$sum2 | 0; //@line 2938
   $15 = $12 + $8 | 0; //@line 2939
   if ($14 >>> 0 < $2 >>> 0) {
    _abort(); //@line 2942
   }
   if (($14 | 0) == (HEAP32[48] | 0)) {
    $103 = $mem + ($8 + -4) | 0; //@line 2949
    $104 = HEAP32[$103 >> 2] | 0; //@line 2950
    if (($104 & 3 | 0) != 3) {
     $p$0 = $14; //@line 2954
     $psize$0 = $15; //@line 2954
     break;
    }
    HEAP32[45] = $15; //@line 2957
    HEAP32[$103 >> 2] = $104 & -2; //@line 2959
    HEAP32[$mem + ($$sum2 + 4) >> 2] = $15 | 1; //@line 2963
    HEAP32[$9 >> 2] = $15; //@line 2964
    return;
   }
   $19 = $12 >>> 3; //@line 2967
   if ($12 >>> 0 < 256) {
    $22 = HEAP32[$mem + ($$sum2 + 8) >> 2] | 0; //@line 2972
    $24 = HEAP32[$mem + ($$sum2 + 12) >> 2] | 0; //@line 2975
    $26 = 212 + ($19 << 1 << 2) | 0; //@line 2977
    if (($22 | 0) != ($26 | 0)) {
     if ($22 >>> 0 < $2 >>> 0) {
      _abort(); //@line 2982
     }
     if ((HEAP32[$22 + 12 >> 2] | 0) != ($14 | 0)) {
      _abort(); //@line 2989
     }
    }
    if (($24 | 0) == ($22 | 0)) {
     HEAP32[43] = HEAP32[43] & ~(1 << $19); //@line 2999
     $p$0 = $14; //@line 3000
     $psize$0 = $15; //@line 3000
     break;
    }
    if (($24 | 0) == ($26 | 0)) {
     $$pre$phi61Z2D = $24 + 8 | 0; //@line 3006
    } else {
     if ($24 >>> 0 < $2 >>> 0) {
      _abort(); //@line 3010
     }
     $39 = $24 + 8 | 0; //@line 3013
     if ((HEAP32[$39 >> 2] | 0) == ($14 | 0)) {
      $$pre$phi61Z2D = $39; //@line 3017
     } else {
      _abort(); //@line 3019
     }
    }
    HEAP32[$22 + 12 >> 2] = $24; //@line 3024
    HEAP32[$$pre$phi61Z2D >> 2] = $22; //@line 3025
    $p$0 = $14; //@line 3026
    $psize$0 = $15; //@line 3026
    break;
   }
   $44 = HEAP32[$mem + ($$sum2 + 24) >> 2] | 0; //@line 3031
   $46 = HEAP32[$mem + ($$sum2 + 12) >> 2] | 0; //@line 3034
   do {
    if (($46 | 0) == ($14 | 0)) {
     $57 = $mem + ($$sum2 + 20) | 0; //@line 3039
     $58 = HEAP32[$57 >> 2] | 0; //@line 3040
     if (!$58) {
      $60 = $mem + ($$sum2 + 16) | 0; //@line 3044
      $61 = HEAP32[$60 >> 2] | 0; //@line 3045
      if (!$61) {
       $R$1 = 0; //@line 3048
       break;
      } else {
       $R$0 = $61; //@line 3051
       $RP$0 = $60; //@line 3051
      }
     } else {
      $R$0 = $58; //@line 3054
      $RP$0 = $57; //@line 3054
     }
     while (1) {
      $63 = $R$0 + 20 | 0; //@line 3057
      $64 = HEAP32[$63 >> 2] | 0; //@line 3058
      if ($64) {
       $R$0 = $64; //@line 3061
       $RP$0 = $63; //@line 3061
       continue;
      }
      $66 = $R$0 + 16 | 0; //@line 3064
      $67 = HEAP32[$66 >> 2] | 0; //@line 3065
      if (!$67) {
       $R$0$lcssa = $R$0; //@line 3068
       $RP$0$lcssa = $RP$0; //@line 3068
       break;
      } else {
       $R$0 = $67; //@line 3071
       $RP$0 = $66; //@line 3071
      }
     }
     if ($RP$0$lcssa >>> 0 < $2 >>> 0) {
      _abort(); //@line 3076
     } else {
      HEAP32[$RP$0$lcssa >> 2] = 0; //@line 3079
      $R$1 = $R$0$lcssa; //@line 3080
      break;
     }
    } else {
     $49 = HEAP32[$mem + ($$sum2 + 8) >> 2] | 0; //@line 3086
     if ($49 >>> 0 < $2 >>> 0) {
      _abort(); //@line 3089
     }
     $51 = $49 + 12 | 0; //@line 3092
     if ((HEAP32[$51 >> 2] | 0) != ($14 | 0)) {
      _abort(); //@line 3096
     }
     $54 = $46 + 8 | 0; //@line 3099
     if ((HEAP32[$54 >> 2] | 0) == ($14 | 0)) {
      HEAP32[$51 >> 2] = $46; //@line 3103
      HEAP32[$54 >> 2] = $49; //@line 3104
      $R$1 = $46; //@line 3105
      break;
     } else {
      _abort(); //@line 3108
     }
    }
   } while (0);
   if (!$44) {
    $p$0 = $14; //@line 3115
    $psize$0 = $15; //@line 3115
   } else {
    $72 = HEAP32[$mem + ($$sum2 + 28) >> 2] | 0; //@line 3119
    $73 = 476 + ($72 << 2) | 0; //@line 3120
    if (($14 | 0) == (HEAP32[$73 >> 2] | 0)) {
     HEAP32[$73 >> 2] = $R$1; //@line 3124
     if (!$R$1) {
      HEAP32[44] = HEAP32[44] & ~(1 << $72); //@line 3131
      $p$0 = $14; //@line 3132
      $psize$0 = $15; //@line 3132
      break;
     }
    } else {
     if ($44 >>> 0 < (HEAP32[47] | 0) >>> 0) {
      _abort(); //@line 3139
     }
     $82 = $44 + 16 | 0; //@line 3142
     if ((HEAP32[$82 >> 2] | 0) == ($14 | 0)) {
      HEAP32[$82 >> 2] = $R$1; //@line 3146
     } else {
      HEAP32[$44 + 20 >> 2] = $R$1; //@line 3149
     }
     if (!$R$1) {
      $p$0 = $14; //@line 3153
      $psize$0 = $15; //@line 3153
      break;
     }
    }
    $87 = HEAP32[47] | 0; //@line 3157
    if ($R$1 >>> 0 < $87 >>> 0) {
     _abort(); //@line 3160
    }
    HEAP32[$R$1 + 24 >> 2] = $44; //@line 3164
    $91 = HEAP32[$mem + ($$sum2 + 16) >> 2] | 0; //@line 3167
    do {
     if ($91) {
      if ($91 >>> 0 < $87 >>> 0) {
       _abort(); //@line 3173
      } else {
       HEAP32[$R$1 + 16 >> 2] = $91; //@line 3177
       HEAP32[$91 + 24 >> 2] = $R$1; //@line 3179
       break;
      }
     }
    } while (0);
    $97 = HEAP32[$mem + ($$sum2 + 20) >> 2] | 0; //@line 3186
    if (!$97) {
     $p$0 = $14; //@line 3189
     $psize$0 = $15; //@line 3189
    } else {
     if ($97 >>> 0 < (HEAP32[47] | 0) >>> 0) {
      _abort(); //@line 3194
     } else {
      HEAP32[$R$1 + 20 >> 2] = $97; //@line 3198
      HEAP32[$97 + 24 >> 2] = $R$1; //@line 3200
      $p$0 = $14; //@line 3201
      $psize$0 = $15; //@line 3201
      break;
     }
    }
   }
  } else {
   $p$0 = $1; //@line 3207
   $psize$0 = $8; //@line 3207
  }
 } while (0);
 if ($p$0 >>> 0 >= $9 >>> 0) {
  _abort(); //@line 3212
 }
 $111 = $mem + ($8 + -4) | 0; //@line 3216
 $112 = HEAP32[$111 >> 2] | 0; //@line 3217
 if (!($112 & 1)) {
  _abort(); //@line 3221
 }
 if (!($112 & 2)) {
  if (($9 | 0) == (HEAP32[49] | 0)) {
   $120 = (HEAP32[46] | 0) + $psize$0 | 0; //@line 3231
   HEAP32[46] = $120; //@line 3232
   HEAP32[49] = $p$0; //@line 3233
   HEAP32[$p$0 + 4 >> 2] = $120 | 1; //@line 3236
   if (($p$0 | 0) != (HEAP32[48] | 0)) {
    return;
   }
   HEAP32[48] = 0; //@line 3242
   HEAP32[45] = 0; //@line 3243
   return;
  }
  if (($9 | 0) == (HEAP32[48] | 0)) {
   $128 = (HEAP32[45] | 0) + $psize$0 | 0; //@line 3250
   HEAP32[45] = $128; //@line 3251
   HEAP32[48] = $p$0; //@line 3252
   HEAP32[$p$0 + 4 >> 2] = $128 | 1; //@line 3255
   HEAP32[$p$0 + $128 >> 2] = $128; //@line 3257
   return;
  }
  $133 = ($112 & -8) + $psize$0 | 0; //@line 3261
  $134 = $112 >>> 3; //@line 3262
  do {
   if ($112 >>> 0 < 256) {
    $137 = HEAP32[$mem + $8 >> 2] | 0; //@line 3267
    $139 = HEAP32[$mem + ($8 | 4) >> 2] | 0; //@line 3270
    $141 = 212 + ($134 << 1 << 2) | 0; //@line 3272
    if (($137 | 0) != ($141 | 0)) {
     if ($137 >>> 0 < (HEAP32[47] | 0) >>> 0) {
      _abort(); //@line 3278
     }
     if ((HEAP32[$137 + 12 >> 2] | 0) != ($9 | 0)) {
      _abort(); //@line 3285
     }
    }
    if (($139 | 0) == ($137 | 0)) {
     HEAP32[43] = HEAP32[43] & ~(1 << $134); //@line 3295
     break;
    }
    if (($139 | 0) == ($141 | 0)) {
     $$pre$phi59Z2D = $139 + 8 | 0; //@line 3301
    } else {
     if ($139 >>> 0 < (HEAP32[47] | 0) >>> 0) {
      _abort(); //@line 3306
     }
     $156 = $139 + 8 | 0; //@line 3309
     if ((HEAP32[$156 >> 2] | 0) == ($9 | 0)) {
      $$pre$phi59Z2D = $156; //@line 3313
     } else {
      _abort(); //@line 3315
     }
    }
    HEAP32[$137 + 12 >> 2] = $139; //@line 3320
    HEAP32[$$pre$phi59Z2D >> 2] = $137; //@line 3321
   } else {
    $161 = HEAP32[$mem + ($8 + 16) >> 2] | 0; //@line 3325
    $163 = HEAP32[$mem + ($8 | 4) >> 2] | 0; //@line 3328
    do {
     if (($163 | 0) == ($9 | 0)) {
      $175 = $mem + ($8 + 12) | 0; //@line 3333
      $176 = HEAP32[$175 >> 2] | 0; //@line 3334
      if (!$176) {
       $178 = $mem + ($8 + 8) | 0; //@line 3338
       $179 = HEAP32[$178 >> 2] | 0; //@line 3339
       if (!$179) {
        $R7$1 = 0; //@line 3342
        break;
       } else {
        $R7$0 = $179; //@line 3345
        $RP9$0 = $178; //@line 3345
       }
      } else {
       $R7$0 = $176; //@line 3348
       $RP9$0 = $175; //@line 3348
      }
      while (1) {
       $181 = $R7$0 + 20 | 0; //@line 3351
       $182 = HEAP32[$181 >> 2] | 0; //@line 3352
       if ($182) {
        $R7$0 = $182; //@line 3355
        $RP9$0 = $181; //@line 3355
        continue;
       }
       $184 = $R7$0 + 16 | 0; //@line 3358
       $185 = HEAP32[$184 >> 2] | 0; //@line 3359
       if (!$185) {
        $R7$0$lcssa = $R7$0; //@line 3362
        $RP9$0$lcssa = $RP9$0; //@line 3362
        break;
       } else {
        $R7$0 = $185; //@line 3365
        $RP9$0 = $184; //@line 3365
       }
      }
      if ($RP9$0$lcssa >>> 0 < (HEAP32[47] | 0) >>> 0) {
       _abort(); //@line 3371
      } else {
       HEAP32[$RP9$0$lcssa >> 2] = 0; //@line 3374
       $R7$1 = $R7$0$lcssa; //@line 3375
       break;
      }
     } else {
      $166 = HEAP32[$mem + $8 >> 2] | 0; //@line 3380
      if ($166 >>> 0 < (HEAP32[47] | 0) >>> 0) {
       _abort(); //@line 3384
      }
      $169 = $166 + 12 | 0; //@line 3387
      if ((HEAP32[$169 >> 2] | 0) != ($9 | 0)) {
       _abort(); //@line 3391
      }
      $172 = $163 + 8 | 0; //@line 3394
      if ((HEAP32[$172 >> 2] | 0) == ($9 | 0)) {
       HEAP32[$169 >> 2] = $163; //@line 3398
       HEAP32[$172 >> 2] = $166; //@line 3399
       $R7$1 = $163; //@line 3400
       break;
      } else {
       _abort(); //@line 3403
      }
     }
    } while (0);
    if ($161) {
     $191 = HEAP32[$mem + ($8 + 20) >> 2] | 0; //@line 3412
     $192 = 476 + ($191 << 2) | 0; //@line 3413
     if (($9 | 0) == (HEAP32[$192 >> 2] | 0)) {
      HEAP32[$192 >> 2] = $R7$1; //@line 3417
      if (!$R7$1) {
       HEAP32[44] = HEAP32[44] & ~(1 << $191); //@line 3424
       break;
      }
     } else {
      if ($161 >>> 0 < (HEAP32[47] | 0) >>> 0) {
       _abort(); //@line 3431
      }
      $201 = $161 + 16 | 0; //@line 3434
      if ((HEAP32[$201 >> 2] | 0) == ($9 | 0)) {
       HEAP32[$201 >> 2] = $R7$1; //@line 3438
      } else {
       HEAP32[$161 + 20 >> 2] = $R7$1; //@line 3441
      }
      if (!$R7$1) {
       break;
      }
     }
     $206 = HEAP32[47] | 0; //@line 3448
     if ($R7$1 >>> 0 < $206 >>> 0) {
      _abort(); //@line 3451
     }
     HEAP32[$R7$1 + 24 >> 2] = $161; //@line 3455
     $210 = HEAP32[$mem + ($8 + 8) >> 2] | 0; //@line 3458
     do {
      if ($210) {
       if ($210 >>> 0 < $206 >>> 0) {
        _abort(); //@line 3464
       } else {
        HEAP32[$R7$1 + 16 >> 2] = $210; //@line 3468
        HEAP32[$210 + 24 >> 2] = $R7$1; //@line 3470
        break;
       }
      }
     } while (0);
     $216 = HEAP32[$mem + ($8 + 12) >> 2] | 0; //@line 3477
     if ($216) {
      if ($216 >>> 0 < (HEAP32[47] | 0) >>> 0) {
       _abort(); //@line 3483
      } else {
       HEAP32[$R7$1 + 20 >> 2] = $216; //@line 3487
       HEAP32[$216 + 24 >> 2] = $R7$1; //@line 3489
       break;
      }
     }
    }
   }
  } while (0);
  HEAP32[$p$0 + 4 >> 2] = $133 | 1; //@line 3498
  HEAP32[$p$0 + $133 >> 2] = $133; //@line 3500
  if (($p$0 | 0) == (HEAP32[48] | 0)) {
   HEAP32[45] = $133; //@line 3504
   return;
  } else {
   $psize$1 = $133; //@line 3507
  }
 } else {
  HEAP32[$111 >> 2] = $112 & -2; //@line 3511
  HEAP32[$p$0 + 4 >> 2] = $psize$0 | 1; //@line 3514
  HEAP32[$p$0 + $psize$0 >> 2] = $psize$0; //@line 3516
  $psize$1 = $psize$0; //@line 3517
 }
 $231 = $psize$1 >>> 3; //@line 3519
 if ($psize$1 >>> 0 < 256) {
  $233 = $231 << 1; //@line 3522
  $234 = 212 + ($233 << 2) | 0; //@line 3523
  $235 = HEAP32[43] | 0; //@line 3524
  $236 = 1 << $231; //@line 3525
  if (!($235 & $236)) {
   HEAP32[43] = $235 | $236; //@line 3530
   $$pre$phiZ2D = 212 + ($233 + 2 << 2) | 0; //@line 3533
   $F16$0 = $234; //@line 3533
  } else {
   $240 = 212 + ($233 + 2 << 2) | 0; //@line 3536
   $241 = HEAP32[$240 >> 2] | 0; //@line 3537
   if ($241 >>> 0 < (HEAP32[47] | 0) >>> 0) {
    _abort(); //@line 3541
   } else {
    $$pre$phiZ2D = $240; //@line 3544
    $F16$0 = $241; //@line 3544
   }
  }
  HEAP32[$$pre$phiZ2D >> 2] = $p$0; //@line 3547
  HEAP32[$F16$0 + 12 >> 2] = $p$0; //@line 3549
  HEAP32[$p$0 + 8 >> 2] = $F16$0; //@line 3551
  HEAP32[$p$0 + 12 >> 2] = $234; //@line 3553
  return;
 }
 $247 = $psize$1 >>> 8; //@line 3556
 if (!$247) {
  $I18$0 = 0; //@line 3559
 } else {
  if ($psize$1 >>> 0 > 16777215) {
   $I18$0 = 31; //@line 3563
  } else {
   $252 = ($247 + 1048320 | 0) >>> 16 & 8; //@line 3567
   $253 = $247 << $252; //@line 3568
   $256 = ($253 + 520192 | 0) >>> 16 & 4; //@line 3571
   $258 = $253 << $256; //@line 3573
   $261 = ($258 + 245760 | 0) >>> 16 & 2; //@line 3576
   $266 = 14 - ($256 | $252 | $261) + ($258 << $261 >>> 15) | 0; //@line 3581
   $I18$0 = $psize$1 >>> ($266 + 7 | 0) & 1 | $266 << 1; //@line 3587
  }
 }
 $272 = 476 + ($I18$0 << 2) | 0; //@line 3590
 HEAP32[$p$0 + 28 >> 2] = $I18$0; //@line 3592
 HEAP32[$p$0 + 20 >> 2] = 0; //@line 3595
 HEAP32[$p$0 + 16 >> 2] = 0; //@line 3596
 $276 = HEAP32[44] | 0; //@line 3597
 $277 = 1 << $I18$0; //@line 3598
 L199 : do {
  if (!($276 & $277)) {
   HEAP32[44] = $276 | $277; //@line 3604
   HEAP32[$272 >> 2] = $p$0; //@line 3605
   HEAP32[$p$0 + 24 >> 2] = $272; //@line 3607
   HEAP32[$p$0 + 12 >> 2] = $p$0; //@line 3609
   HEAP32[$p$0 + 8 >> 2] = $p$0; //@line 3611
  } else {
   $284 = HEAP32[$272 >> 2] | 0; //@line 3613
   L202 : do {
    if ((HEAP32[$284 + 4 >> 2] & -8 | 0) == ($psize$1 | 0)) {
     $T$0$lcssa = $284; //@line 3620
    } else {
     $K19$052 = $psize$1 << (($I18$0 | 0) == 31 ? 0 : 25 - ($I18$0 >>> 1) | 0); //@line 3627
     $T$051 = $284; //@line 3627
     while (1) {
      $301 = $T$051 + 16 + ($K19$052 >>> 31 << 2) | 0; //@line 3630
      $296 = HEAP32[$301 >> 2] | 0; //@line 3631
      if (!$296) {
       $$lcssa = $301; //@line 3634
       $T$051$lcssa = $T$051; //@line 3634
       break;
      }
      if ((HEAP32[$296 + 4 >> 2] & -8 | 0) == ($psize$1 | 0)) {
       $T$0$lcssa = $296; //@line 3643
       break L202;
      } else {
       $K19$052 = $K19$052 << 1; //@line 3646
       $T$051 = $296; //@line 3646
      }
     }
     if ($$lcssa >>> 0 < (HEAP32[47] | 0) >>> 0) {
      _abort(); //@line 3652
     } else {
      HEAP32[$$lcssa >> 2] = $p$0; //@line 3655
      HEAP32[$p$0 + 24 >> 2] = $T$051$lcssa; //@line 3657
      HEAP32[$p$0 + 12 >> 2] = $p$0; //@line 3659
      HEAP32[$p$0 + 8 >> 2] = $p$0; //@line 3661
      break L199;
     }
    }
   } while (0);
   $308 = $T$0$lcssa + 8 | 0; //@line 3666
   $309 = HEAP32[$308 >> 2] | 0; //@line 3667
   $310 = HEAP32[47] | 0; //@line 3668
   if ($309 >>> 0 >= $310 >>> 0 & $T$0$lcssa >>> 0 >= $310 >>> 0) {
    HEAP32[$309 + 12 >> 2] = $p$0; //@line 3674
    HEAP32[$308 >> 2] = $p$0; //@line 3675
    HEAP32[$p$0 + 8 >> 2] = $309; //@line 3677
    HEAP32[$p$0 + 12 >> 2] = $T$0$lcssa; //@line 3679
    HEAP32[$p$0 + 24 >> 2] = 0; //@line 3681
    break;
   } else {
    _abort(); //@line 3684
   }
  }
 } while (0);
 $318 = (HEAP32[51] | 0) + -1 | 0; //@line 3690
 HEAP32[51] = $318; //@line 3691
 if (!$318) {
  $sp$0$in$i = 628; //@line 3694
 } else {
  return;
 }
 while (1) {
  $sp$0$i = HEAP32[$sp$0$in$i >> 2] | 0; //@line 3699
  if (!$sp$0$i) {
   break;
  } else {
   $sp$0$in$i = $sp$0$i + 8 | 0; //@line 3705
  }
 }
 HEAP32[51] = -1; //@line 3708
 return;
}
function ___stdio_write($f, $buf, $len) {
 $f = $f | 0;
 $buf = $buf | 0;
 $len = $len | 0;
 var $$0 = 0, $0 = 0, $1 = 0, $10 = 0, $11 = 0, $16 = 0, $21 = 0, $26 = 0, $3 = 0, $35 = 0, $37 = 0, $39 = 0, $50 = 0, $6 = 0, $cnt$0 = 0, $cnt$1 = 0, $iov$0 = 0, $iov$0$lcssa11 = 0, $iov$1 = 0, $iovcnt$0 = 0, $iovcnt$0$lcssa12 = 0, $iovcnt$1 = 0, $iovs = 0, $rem$0 = 0, $vararg_buffer = 0, $vararg_buffer3 = 0, label = 0, sp = 0;
 sp = STACKTOP; //@line 158
 STACKTOP = STACKTOP + 48 | 0; //@line 159
 $vararg_buffer3 = sp + 16 | 0; //@line 160
 $vararg_buffer = sp; //@line 161
 $iovs = sp + 32 | 0; //@line 162
 $0 = $f + 28 | 0; //@line 163
 $1 = HEAP32[$0 >> 2] | 0; //@line 164
 HEAP32[$iovs >> 2] = $1; //@line 165
 $3 = $f + 20 | 0; //@line 167
 $6 = (HEAP32[$3 >> 2] | 0) - $1 | 0; //@line 170
 HEAP32[$iovs + 4 >> 2] = $6; //@line 171
 HEAP32[$iovs + 8 >> 2] = $buf; //@line 173
 HEAP32[$iovs + 12 >> 2] = $len; //@line 175
 $10 = $f + 60 | 0; //@line 177
 $11 = $f + 44 | 0; //@line 178
 $iov$0 = $iovs; //@line 179
 $iovcnt$0 = 2; //@line 179
 $rem$0 = $6 + $len | 0; //@line 179
 while (1) {
  if (!(HEAP32[2] | 0)) {
   HEAP32[$vararg_buffer3 >> 2] = HEAP32[$10 >> 2]; //@line 185
   HEAP32[$vararg_buffer3 + 4 >> 2] = $iov$0; //@line 187
   HEAP32[$vararg_buffer3 + 8 >> 2] = $iovcnt$0; //@line 189
   $cnt$0 = ___syscall_ret(___syscall146(146, $vararg_buffer3 | 0) | 0) | 0; //@line 192
  } else {
   _pthread_cleanup_push(1, $f | 0); //@line 194
   HEAP32[$vararg_buffer >> 2] = HEAP32[$10 >> 2]; //@line 196
   HEAP32[$vararg_buffer + 4 >> 2] = $iov$0; //@line 198
   HEAP32[$vararg_buffer + 8 >> 2] = $iovcnt$0; //@line 200
   $16 = ___syscall_ret(___syscall146(146, $vararg_buffer | 0) | 0) | 0; //@line 202
   _pthread_cleanup_pop(0); //@line 203
   $cnt$0 = $16; //@line 204
  }
  if (($rem$0 | 0) == ($cnt$0 | 0)) {
   label = 6; //@line 208
   break;
  }
  if (($cnt$0 | 0) < 0) {
   $iov$0$lcssa11 = $iov$0; //@line 213
   $iovcnt$0$lcssa12 = $iovcnt$0; //@line 213
   label = 8; //@line 214
   break;
  }
  $35 = $rem$0 - $cnt$0 | 0; //@line 217
  $37 = HEAP32[$iov$0 + 4 >> 2] | 0; //@line 219
  if ($cnt$0 >>> 0 > $37 >>> 0) {
   $39 = HEAP32[$11 >> 2] | 0; //@line 222
   HEAP32[$0 >> 2] = $39; //@line 223
   HEAP32[$3 >> 2] = $39; //@line 224
   $50 = HEAP32[$iov$0 + 12 >> 2] | 0; //@line 230
   $cnt$1 = $cnt$0 - $37 | 0; //@line 230
   $iov$1 = $iov$0 + 8 | 0; //@line 230
   $iovcnt$1 = $iovcnt$0 + -1 | 0; //@line 230
  } else {
   if (($iovcnt$0 | 0) == 2) {
    HEAP32[$0 >> 2] = (HEAP32[$0 >> 2] | 0) + $cnt$0; //@line 236
    $50 = $37; //@line 237
    $cnt$1 = $cnt$0; //@line 237
    $iov$1 = $iov$0; //@line 237
    $iovcnt$1 = 2; //@line 237
   } else {
    $50 = $37; //@line 239
    $cnt$1 = $cnt$0; //@line 239
    $iov$1 = $iov$0; //@line 239
    $iovcnt$1 = $iovcnt$0; //@line 239
   }
  }
  HEAP32[$iov$1 >> 2] = (HEAP32[$iov$1 >> 2] | 0) + $cnt$1; //@line 244
  HEAP32[$iov$1 + 4 >> 2] = $50 - $cnt$1; //@line 247
  $iov$0 = $iov$1; //@line 248
  $iovcnt$0 = $iovcnt$1; //@line 248
  $rem$0 = $35; //@line 248
 }
 if ((label | 0) == 6) {
  $21 = HEAP32[$11 >> 2] | 0; //@line 251
  HEAP32[$f + 16 >> 2] = $21 + (HEAP32[$f + 48 >> 2] | 0); //@line 256
  $26 = $21; //@line 257
  HEAP32[$0 >> 2] = $26; //@line 258
  HEAP32[$3 >> 2] = $26; //@line 259
  $$0 = $len; //@line 260
 } else if ((label | 0) == 8) {
  HEAP32[$f + 16 >> 2] = 0; //@line 264
  HEAP32[$0 >> 2] = 0; //@line 265
  HEAP32[$3 >> 2] = 0; //@line 266
  HEAP32[$f >> 2] = HEAP32[$f >> 2] | 32; //@line 269
  if (($iovcnt$0$lcssa12 | 0) == 2) {
   $$0 = 0; //@line 272
  } else {
   $$0 = $len - (HEAP32[$iov$0$lcssa11 + 4 >> 2] | 0) | 0; //@line 277
  }
 }
 STACKTOP = sp; //@line 280
 return $$0 | 0; //@line 280
}
function _fflush($f) {
 $f = $f | 0;
 var $$0 = 0, $$012 = 0, $$014 = 0, $24 = 0, $27 = 0, $6 = 0, $phitmp = 0, $r$0$lcssa = 0, $r$03 = 0, $r$1 = 0;
 do {
  if (!$f) {
   if (!(HEAP32[13] | 0)) {
    $27 = 0; //@line 325
   } else {
    $27 = _fflush(HEAP32[13] | 0) | 0; //@line 329
   }
   ___lock(36); //@line 331
   $$012 = HEAP32[8] | 0; //@line 332
   if (!$$012) {
    $r$0$lcssa = $27; //@line 335
   } else {
    $$014 = $$012; //@line 337
    $r$03 = $27; //@line 337
    while (1) {
     if ((HEAP32[$$014 + 76 >> 2] | 0) > -1) {
      $24 = ___lockfile($$014) | 0; //@line 344
     } else {
      $24 = 0; //@line 346
     }
     if ((HEAP32[$$014 + 20 >> 2] | 0) >>> 0 > (HEAP32[$$014 + 28 >> 2] | 0) >>> 0) {
      $r$1 = ___fflush_unlocked($$014) | 0 | $r$03; //@line 356
     } else {
      $r$1 = $r$03; //@line 358
     }
     if ($24) {
      ___unlockfile($$014); //@line 362
     }
     $$014 = HEAP32[$$014 + 56 >> 2] | 0; //@line 365
     if (!$$014) {
      $r$0$lcssa = $r$1; //@line 368
      break;
     } else {
      $r$03 = $r$1; //@line 371
     }
    }
   }
   ___unlock(36); //@line 375
   $$0 = $r$0$lcssa; //@line 376
  } else {
   if ((HEAP32[$f + 76 >> 2] | 0) <= -1) {
    $$0 = ___fflush_unlocked($f) | 0; //@line 383
    break;
   }
   $phitmp = (___lockfile($f) | 0) == 0; //@line 387
   $6 = ___fflush_unlocked($f) | 0; //@line 388
   if ($phitmp) {
    $$0 = $6; //@line 390
   } else {
    ___unlockfile($f); //@line 392
    $$0 = $6; //@line 393
   }
  }
 } while (0);
 return $$0 | 0; //@line 397
}
function ___fflush_unlocked($f) {
 $f = $f | 0;
 var $$0 = 0, $0 = 0, $10 = 0, $11 = 0, $12 = 0, $2 = 0, $9 = 0, label = 0;
 $0 = $f + 20 | 0; //@line 416
 $2 = $f + 28 | 0; //@line 418
 if ((HEAP32[$0 >> 2] | 0) >>> 0 > (HEAP32[$2 >> 2] | 0) >>> 0) {
  FUNCTION_TABLE_iiii[HEAP32[$f + 36 >> 2] & 3]($f, 0, 0) | 0; //@line 424
  if (!(HEAP32[$0 >> 2] | 0)) {
   $$0 = -1; //@line 428
  } else {
   label = 3; //@line 430
  }
 } else {
  label = 3; //@line 433
 }
 if ((label | 0) == 3) {
  $9 = $f + 4 | 0; //@line 436
  $10 = HEAP32[$9 >> 2] | 0; //@line 437
  $11 = $f + 8 | 0; //@line 438
  $12 = HEAP32[$11 >> 2] | 0; //@line 439
  if ($10 >>> 0 < $12 >>> 0) {
   FUNCTION_TABLE_iiii[HEAP32[$f + 40 >> 2] & 3]($f, $10 - $12 | 0, 1) | 0; //@line 447
  }
  HEAP32[$f + 16 >> 2] = 0; //@line 450
  HEAP32[$2 >> 2] = 0; //@line 451
  HEAP32[$0 >> 2] = 0; //@line 452
  HEAP32[$11 >> 2] = 0; //@line 453
  HEAP32[$9 >> 2] = 0; //@line 454
  $$0 = 0; //@line 455
 }
 return $$0 | 0; //@line 457
}
function _memcpy(dest, src, num) {
 dest = dest | 0;
 src = src | 0;
 num = num | 0;
 var ret = 0;
 if ((num | 0) >= 4096) return _emscripten_memcpy_big(dest | 0, src | 0, num | 0) | 0; //@line 3744
 ret = dest | 0; //@line 3745
 if ((dest & 3) == (src & 3)) {
  while (dest & 3) {
   if (!num) return ret | 0; //@line 3748
   HEAP8[dest >> 0] = HEAP8[src >> 0] | 0; //@line 3749
   dest = dest + 1 | 0; //@line 3750
   src = src + 1 | 0; //@line 3751
   num = num - 1 | 0; //@line 3752
  }
  while ((num | 0) >= 4) {
   HEAP32[dest >> 2] = HEAP32[src >> 2]; //@line 3755
   dest = dest + 4 | 0; //@line 3756
   src = src + 4 | 0; //@line 3757
   num = num - 4 | 0; //@line 3758
  }
 }
 while ((num | 0) > 0) {
  HEAP8[dest >> 0] = HEAP8[src >> 0] | 0; //@line 3762
  dest = dest + 1 | 0; //@line 3763
  src = src + 1 | 0; //@line 3764
  num = num - 1 | 0; //@line 3765
 }
 return ret | 0; //@line 3767
}
function runPostSets() {}
function _memset(ptr, value, num) {
 ptr = ptr | 0;
 value = value | 0;
 num = num | 0;
 var stop = 0, value4 = 0, stop4 = 0, unaligned = 0;
 stop = ptr + num | 0; //@line 3716
 if ((num | 0) >= 20) {
  value = value & 255; //@line 3719
  unaligned = ptr & 3; //@line 3720
  value4 = value | value << 8 | value << 16 | value << 24; //@line 3721
  stop4 = stop & ~3; //@line 3722
  if (unaligned) {
   unaligned = ptr + 4 - unaligned | 0; //@line 3724
   while ((ptr | 0) < (unaligned | 0)) {
    HEAP8[ptr >> 0] = value; //@line 3726
    ptr = ptr + 1 | 0; //@line 3727
   }
  }
  while ((ptr | 0) < (stop4 | 0)) {
   HEAP32[ptr >> 2] = value4; //@line 3731
   ptr = ptr + 4 | 0; //@line 3732
  }
 }
 while ((ptr | 0) < (stop | 0)) {
  HEAP8[ptr >> 0] = value; //@line 3736
  ptr = ptr + 1 | 0; //@line 3737
 }
 return ptr - num | 0; //@line 3739
}
function ___stdio_seek($f, $off, $whence) {
 $f = $f | 0;
 $off = $off | 0;
 $whence = $whence | 0;
 var $5 = 0, $ret = 0, $vararg_buffer = 0, sp = 0;
 sp = STACKTOP; //@line 123
 STACKTOP = STACKTOP + 32 | 0; //@line 124
 $vararg_buffer = sp; //@line 125
 $ret = sp + 20 | 0; //@line 126
 HEAP32[$vararg_buffer >> 2] = HEAP32[$f + 60 >> 2]; //@line 129
 HEAP32[$vararg_buffer + 4 >> 2] = 0; //@line 131
 HEAP32[$vararg_buffer + 8 >> 2] = $off; //@line 133
 HEAP32[$vararg_buffer + 12 >> 2] = $ret; //@line 135
 HEAP32[$vararg_buffer + 16 >> 2] = $whence; //@line 137
 if ((___syscall_ret(___syscall140(140, $vararg_buffer | 0) | 0) | 0) < 0) {
  HEAP32[$ret >> 2] = -1; //@line 142
  $5 = -1; //@line 143
 } else {
  $5 = HEAP32[$ret >> 2] | 0; //@line 146
 }
 STACKTOP = sp; //@line 148
 return $5 | 0; //@line 148
}
function ___stdout_write($f, $buf, $len) {
 $f = $f | 0;
 $buf = $buf | 0;
 $len = $len | 0;
 var $9 = 0, $vararg_buffer = 0, sp = 0;
 sp = STACKTOP; //@line 287
 STACKTOP = STACKTOP + 80 | 0; //@line 288
 $vararg_buffer = sp; //@line 289
 HEAP32[$f + 36 >> 2] = 3; //@line 292
 if (!(HEAP32[$f >> 2] & 64)) {
  HEAP32[$vararg_buffer >> 2] = HEAP32[$f + 60 >> 2]; //@line 299
  HEAP32[$vararg_buffer + 4 >> 2] = 21505; //@line 301
  HEAP32[$vararg_buffer + 8 >> 2] = sp + 12; //@line 303
  if (___syscall54(54, $vararg_buffer | 0) | 0) {
   HEAP8[$f + 75 >> 0] = -1; //@line 308
  }
 }
 $9 = ___stdio_write($f, $buf, $len) | 0; //@line 311
 STACKTOP = sp; //@line 312
 return $9 | 0; //@line 312
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
function ___stdio_close($f) {
 $f = $f | 0;
 var $3 = 0, $vararg_buffer = 0, sp = 0;
 sp = STACKTOP; //@line 108
 STACKTOP = STACKTOP + 16 | 0; //@line 109
 $vararg_buffer = sp; //@line 110
 HEAP32[$vararg_buffer >> 2] = HEAP32[$f + 60 >> 2]; //@line 113
 $3 = ___syscall_ret(___syscall6(6, $vararg_buffer | 0) | 0) | 0; //@line 115
 STACKTOP = sp; //@line 116
 return $3 | 0; //@line 116
}
function copyTempFloat(ptr) {
 ptr = ptr | 0;
 HEAP8[tempDoublePtr >> 0] = HEAP8[ptr >> 0]; //@line 33
 HEAP8[tempDoublePtr + 1 >> 0] = HEAP8[ptr + 1 >> 0]; //@line 34
 HEAP8[tempDoublePtr + 2 >> 0] = HEAP8[ptr + 2 >> 0]; //@line 35
 HEAP8[tempDoublePtr + 3 >> 0] = HEAP8[ptr + 3 >> 0]; //@line 36
}
function ___syscall_ret($r) {
 $r = $r | 0;
 var $$0 = 0;
 if ($r >>> 0 > 4294963200) {
  HEAP32[(___errno_location() | 0) >> 2] = 0 - $r; //@line 86
  $$0 = -1; //@line 87
 } else {
  $$0 = $r; //@line 89
 }
 return $$0 | 0; //@line 91
}
function stackAlloc(size) {
 size = size | 0;
 var ret = 0;
 ret = STACKTOP; //@line 3
 STACKTOP = STACKTOP + size | 0; //@line 4
 STACKTOP = STACKTOP + 15 & -16; //@line 5
 return ret | 0; //@line 7
}
function ___errno_location() {
 var $$0 = 0;
 if (!(HEAP32[2] | 0)) {
  $$0 = 56; //@line 69
 } else {
  $$0 = HEAP32[(_pthread_self() | 0) + 60 >> 2] | 0; //@line 74
 }
 return $$0 | 0; //@line 76
}
function dynCall_iiii(index, a1, a2, a3) {
 index = index | 0;
 a1 = a1 | 0;
 a2 = a2 | 0;
 a3 = a3 | 0;
 return FUNCTION_TABLE_iiii[index & 3](a1 | 0, a2 | 0, a3 | 0) | 0; //@line 3781
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
function dynCall_ii(index, a1) {
 index = index | 0;
 a1 = a1 | 0;
 return FUNCTION_TABLE_ii[index & 1](a1 | 0) | 0; //@line 3774
}
function _cleanup392($p) {
 $p = $p | 0;
 if (!(HEAP32[$p + 68 >> 2] | 0)) {
  ___unlockfile($p); //@line 407
 }
 return;
}
function dynCall_vi(index, a1) {
 index = index | 0;
 a1 = a1 | 0;
 FUNCTION_TABLE_vi[index & 1](a1 | 0); //@line 3788
}
function b1(p0, p1, p2) {
 p0 = p0 | 0;
 p1 = p1 | 0;
 p2 = p2 | 0;
 abort(1); //@line 3795
 return 0; //@line 3795
}
function setTempRet0(value) {
 value = value | 0;
 tempRet0 = value; //@line 52
}
function b0(p0) {
 p0 = p0 | 0;
 abort(0); //@line 3792
 return 0; //@line 3792
}
function stackRestore(top) {
 top = top | 0;
 STACKTOP = top; //@line 14
}
function ___lockfile($f) {
 $f = $f | 0;
 return 0; //@line 97
}
function getTempRet0() {
 return tempRet0 | 0; //@line 55
}
function stackSave() {
 return STACKTOP | 0; //@line 10
}
function b2(p0) {
 p0 = p0 | 0;
 abort(2); //@line 3798
}
function ___unlockfile($f) {
 $f = $f | 0;
 return;
}
function _main() {
 return 0; //@line 61
}

// EMSCRIPTEN_END_FUNCS
var FUNCTION_TABLE_ii = [b0,___stdio_close];
var FUNCTION_TABLE_iiii = [b1,___stdout_write,___stdio_seek,___stdio_write];
var FUNCTION_TABLE_vi = [b2,_cleanup392];

  return { _free: _free, _main: _main, _memset: _memset, _malloc: _malloc, _memcpy: _memcpy, _fflush: _fflush, ___errno_location: ___errno_location, runPostSets: runPostSets, stackAlloc: stackAlloc, stackSave: stackSave, stackRestore: stackRestore, establishStackSpace: establishStackSpace, setThrew: setThrew, setTempRet0: setTempRet0, getTempRet0: getTempRet0, dynCall_ii: dynCall_ii, dynCall_iiii: dynCall_iiii, dynCall_vi: dynCall_vi };
})
// EMSCRIPTEN_END_ASM
(Module.asmGlobalArg, Module.asmLibraryArg, buffer);
var _fflush = Module["_fflush"] = asm["_fflush"];
var _main = Module["_main"] = asm["_main"];
var _memset = Module["_memset"] = asm["_memset"];
var _malloc = Module["_malloc"] = asm["_malloc"];
var _memcpy = Module["_memcpy"] = asm["_memcpy"];
var _free = Module["_free"] = asm["_free"];
var ___errno_location = Module["___errno_location"] = asm["___errno_location"];
var runPostSets = Module["runPostSets"] = asm["runPostSets"];
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
Module['IDBFS'] = IDBFS;
Module['PATH'] = PATH;
Module['ERRNO_CODES'] = ERRNO_CODES;
};


//# sourceMappingURL=nop.js.map