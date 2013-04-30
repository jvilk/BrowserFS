# Information about a failed call to the BrowserFS API.
#
# Special thanks to Dropbox-JS for some of the error names/descriptions.
# @see https://raw.github.com/dropbox/dropbox-js/master/src/api_error.coffee
# @todo Am I too tightly binding to the Dropbox API?
class BrowserFS.ApiError
  # XHR ERROR STATUSES
  # These error messages correspond to xhr.status, as in Dropbox-JS. They should
  # be used even for filesystems that do not use XHR (note that many of the
  # names have been changed to be more generic to the filesystem abstraction)

  # Status value indicating an error at the XMLHttpRequest layer.
  #
  # This indicates a network transmission error on modern browsers. Internet
  # Explorer might cause this code to be reported on some API server errors.
  @NETWORK_ERROR: 0

  # Status value indicating an invalid input parameter.
  @INVALID_PARAM: 400

  # Status value indicating an expired or invalid OAuth token.
  #
  # The OAuth token used for the request will never become valid again, so the
  # user should be re-authenticated.
  @INVALID_TOKEN: 401

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
  @NOT_SUPPORTED: 405

  # BROWSERFS ERROR STATUSES
  # The numbers here have no real meaning; they are just unique identifiers.
  # @todo Add any needed error types.

  # @param [Number] type The type of error. Use one of the static fields of this class as the type.
  # @param [String?] msg A descriptive error message.
  constructor: (@type, @msg="") ->
