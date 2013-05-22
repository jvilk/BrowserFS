# All changes to the global namespace happen here.

# This file's name is set up in such a way that it will always show up last in
# the source directory. This makes coffee --join work as intended.
# Adapted from Dropbox-js's zzz-export.coffee.

if window?
  # We're in a browser, so add BrowserFS to the global namespace.
  if window.BrowserFS
    # Someone's stepping on our toes.
    window.BrowserFS[name] = value for own name, value of BrowserFS
  else
    window.BrowserFS = BrowserFS
else if self?
  self.BrowserFS = BrowserFS
else
  throw new Error 'This library only supports node.js and modern browsers.'
