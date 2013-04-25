# Information about a failed call to the BrowserFS API.
# Special thanks to Dropbox FS for some of the error names/descriptions. :)
# https://raw.github.com/dropbox/dropbox-js/master/src/api_error.coffee
# TODO: Make this better / more informative.
class BrowserFS.ApiError
  # Status value indicating an error at the XMLHttpRequest layer.
  #
  # This indicates a network transmission error on modern browsers. Internet
  # Explorer might cause this code to be reported on some API server errors.
  @NETWORK_ERROR: 0

  # Status value indicating an invalid input parameter.
  @INVALID_PARAM: 400

  # Status value indicating an authentication error of some sort.
  @AUTH_ERROR: 403

  # Status value indicating that a file or path was not found in the filesystem.
  #
  # This happens when trying to read from a non-existing file, readdir a
  # non-existing directory, write a file into a non-existing directory, etc.
  @NOT_FOUND: 404

  # Status value indicating that the filesystem is full to capacity.
  @DRIVE_FULL: 507

  # Indicates that the given method is not supported on the current filesystem.
  @NOT_SUPPORTED: 406