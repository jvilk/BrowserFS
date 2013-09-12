# Contains miscellaneous small polyfills for browsers that do not support
# features that we make use of.

# IE < 9 does not define this function.
unless Date.now?
  Date.now = -> return new Date().getTime();

# IE < 9 does not define this function.
unless Array.isArray?
  Array.isArray = (arg) -> return Object.prototype.toString.call(arg) == "[object Array]"

# IE < 9 does not define this function.
# From https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/keys
unless Object.keys?
  Object.keys =( ->
    hasOwnProperty = Object.prototype.hasOwnProperty
    hasDontEnumBug = !({toString: null}).propertyIsEnumerable('toString')
    dontEnums = [
      'toString',
      'toLocaleString',
      'valueOf',
      'hasOwnProperty',
      'isPrototypeOf',
      'propertyIsEnumerable',
      'constructor'
    ]
    dontEnumsLength = dontEnums.length

    return (obj) ->
      if typeof obj != 'object' and (typeof obj != 'function' or obj is null)
        throw new TypeError('Object.keys called on non-object')

      result = []
      for prop of obj
        if hasOwnProperty.call(obj, prop) then result.push prop

      if hasDontEnumBug
        for i in [0...dontEnumsLength]
          if hasOwnProperty.call(obj, dontEnums[i])
            result.push(dontEnums[i])

      return result;
    )()

# IE substr does not support negative indices
unless 'ab'.substr(-1) is 'b'
  # Get the substring of a string
  # @param  {integer}  start   where to start the substring
  # @param  {integer}  length  how many characters to return
  # @return {string}
  String.prototype.substr = ((substr) ->
    return (start, length) ->
      # did we get a negative start, calculate how much it is from the beginning
      # of the string
      if start < 0 then start = this.length + start
      # call the original function
      return substr.call(this, start, length)
  )(String.prototype.substr)

# IE < 9 does not support forEach
unless Array.prototype.forEach?
  Array.prototype.forEach = (fn, scope) ->
    for i in [0...this.length]
      if i in this then fn.call(scope, this[i], i, this)
