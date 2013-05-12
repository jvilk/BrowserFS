# Polyfill for setImmediate.
if typeof setImmediate is 'undefined'
  # Using postMessage is *much* faster than using setTimeout(fn, 0).
  # Credit for idea and example implementation goes to:
  # http://dbaron.org/log/20100309-faster-timeouts
  timeouts = []
  messageName = "zero-timeout-message"

  window.__numWaiting = -> timeouts.length

  # IE8 has postMessage, but it is synchronous. This function detects whether or
  # not we can use postMessage as a means to reset the stack.
  canUsePostMessage = ->
    return false unless window.postMessage
    postMessageIsAsync = true
    oldOnMessage = window.onmessage
    window.onmessage = ->
      postMessageIsAsync = false
    window.postMessage '', '*'
    window.onmessage = oldOnMessage
    return postMessageIsAsync

  if canUsePostMessage()
    window.setImmediate = (fn) ->
      timeouts.push(fn)
      window.postMessage(messageName, "*")

    handleMessage = (event) ->
      if (event.source == self && event.data == messageName)
        if event.stopPropagation
          event.stopPropagation()
        else
          event.cancelBubble = true
        if (timeouts.length > 0)
          fn = timeouts.shift()
          fn()

    if window.addEventListener
      # IE10 and all modern browsers
      window.addEventListener('message', handleMessage, true)
    else
      # IE9???
      window.attachEvent('onmessage', handleMessage)
  else
    # Thanks to https://github.com/NobleJS/setImmediate for this hacky solution
    # to IE8.
    window.setImmediate = (fn) ->
      return setTimeout(fn, 0)
      # Create a <script> element; its readystatechange event will be fired asynchronously once it is inserted
      # into the document. Do so, thus queuing up the task. Remember to clean up once it's been called.
      scriptEl = window.document.createElement("script")
      scriptEl.onreadystatechange = () ->
          fn()
          scriptEl.onreadystatechange = null
          scriptEl.parentNode.removeChild(scriptEl)
          scriptEl = null

      window.document.documentElement.appendChild(scriptEl)
      return
