if (typeof setImmediate === 'undefined') {
  var timeouts = [];
  var messageName = "zero-timeout-message";
  var canUsePostMessage = function() {
    if (!window.postMessage) {
      return false;
    }
    var postMessageIsAsync = true;
    var oldOnMessage = window.onmessage;
    window.onmessage = function() {
      postMessageIsAsync = false;
    };
    window.postMessage('', '*');
    window.onmessage = oldOnMessage;
    return postMessageIsAsync;
  };
  if (canUsePostMessage()) {
    window['set'+'Immediate'] = function(fn) {
      timeouts.push(fn);
      window.postMessage(messageName, "*");
    };
    var handleMessage = function(event) {
      if (event.source === self && event.data === messageName) {
        if (event.stopPropagation) {
          event.stopPropagation();
        } else {
          event.cancelBubble = true;
        }
        if (timeouts.length > 0) {
          var fn = timeouts.shift();
          return fn();
        }
      }
    };
    if (window.addEventListener) {
      window.addEventListener('message', handleMessage, true);
    } else {
      window.attachEvent('onmessage', handleMessage);
    }
  } else {
    window['set'+'Immediate'] = function(fn) {
      return setTimeout(fn, 0);
      var scriptEl = window.document.createElement("script");
      scriptEl.onreadystatechange = function() {
        fn();
        scriptEl.onreadystatechange = null;
        scriptEl.parentNode.removeChild(scriptEl);
        return scriptEl = null;
      };
      window.document.documentElement.appendChild(scriptEl);
    };
  }
}
