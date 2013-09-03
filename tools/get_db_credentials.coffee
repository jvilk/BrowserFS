#! /usr/bin/env coffee

# Modified from dropbox-js
fs = require 'fs'
{exec} = require 'child_process'

# Stashes Dropbox access credentials.
class TokenStash
  # @param {Object} options one or more of the options below
  # @option options {Object} tls tls.createServer() options for the node.js
  #   HTTPS server that intercepts the OAuth 2 authorization redirect
  constructor: (options) ->
    @_tlsOptions = options?.tls or {}
    @_fs = require 'fs'
    # Node 0.6 hack.
    unless @_fs.existsSync
      path = require 'path'
      @_fs.existsSync = (filePath) -> path.existsSync filePath
    @_getCache = null
    @setupFs()

  # Calls the supplied method with the Dropbox access credentials.
  #
  # @param {function(Object<String, Object>)} callback called with an object
  #   whose 'full' and 'sandbox' properties point to two set of Oauth
  #   credentials
  # @return null
  get: (callback) ->
    @_getCache or= @readStash()
    if @_getCache
      callback @_getCache
      return null

    @liveLogin (fullCredentials, sandboxCredentials) =>
      unless fullCredentials and sandboxCredentials
        throw new Error('Dropbox API authorization failed')

      @writeStash fullCredentials, sandboxCredentials
      @_getCache = @readStash()
      callback @_getCache
    null

  # Obtains credentials by doing a login on the live site.
  #
  # @private
  # Used internally by get.
  #
  # @param {function(Object, Object)} callback called with two sets of
  #   crendentials; the first set has Full Dropbox access, the second set has
  #   App folder access
  # @return null
  liveLogin: (callback) ->
    Dropbox = require 'dropbox'
    sandboxClient = new Dropbox.Client @clientOptions().sandbox
    fullClient = new Dropbox.Client @clientOptions().full
    @setupAuth()
    sandboxClient.authDriver @_authDriver
    sandboxClient.authenticate (error, data) =>
      if error
        @killAuth()
        console.error error
        callback null
        return
      fullClient.authDriver @_authDriver
      fullClient.authenticate (error, data) =>
        @killAuth()
        if error
          console.error error
          callback null
          return
        credentials = @clientOptions()
        callback fullClient.credentials(), sandboxClient.credentials()
    null

  # Returns the options used to create a Dropbox Client.
  clientOptions: ->
    if process.env['API_CONFIG']
      JSON.parse @_fs.readFileSync(process.env['API_CONFIG'])
    else
      sandbox:
        key: 'c6oex2qavccb2l3'
        secret: 'cb0sxc9e09itvrn'
      full:
        key: 'c6oex2qavccb2l3'
        secret: 'cb0sxc9e09itvrn'


  # Reads the file containing the access credentials, if it is available.
  #
  # @return {Object?} parsed access credentials, or null if they haven't been
  #   stashed
  readStash: ->
    unless @_fs.existsSync @_jsonPath
      return null
    JSON.parse @_fs.readFileSync @_jsonPath

  # Stashes the access credentials for future test use.
  #
  # @return null
  writeStash: (fullCredentials, sandboxCredentials) ->
    json = JSON.stringify full: fullCredentials, sandbox: sandboxCredentials
    @_fs.writeFileSync @_jsonPath, json

    browserJs = "window.testKeys = #{JSON.stringify sandboxCredentials};" +
        "window.testFullDropboxKeys = #{JSON.stringify fullCredentials};"
    @_fs.writeFileSync @_browserJsPath, browserJs
    workerJs = "self.testKeys = #{JSON.stringify sandboxCredentials};" +
        "self.testFullDropboxKeys = #{JSON.stringify fullCredentials};"
    @_fs.writeFileSync @_workerJsPath, workerJs
    null

  # Sets up a node.js server-based authentication driver.
  setupAuth: ->
    return if @_authDriver

    Dropbox = require 'dropbox'
    @_authDriver = new Dropbox.AuthDriver.NodeServer tls: @_tlsOptions

  # Shuts down the node.js server behind the authentication server.
  killAuth: ->
    return unless @_authDriver

    @_authDriver.closeServer()
    @_authDriver = null

  # Sets up the directory structure for the credential stash.
  setupFs: ->
    @_dirPath = 'test/token'
    @_jsonPath = 'test/token/token.json'
    @_browserJsPath = 'test/token/token.browser.js'
    @_workerJsPath = 'test/token/token.worker.js'

    unless @_fs.existsSync @_dirPath
      @_fs.mkdirSync @_dirPath

# Represents the SSL certificate used to authenticate with Dropbox
# Singleton class - only instantiate once
class Certificate
  constructor: ->
    @path = 'test/ssl/cert.pem'
    @cmd = "openssl req -new -x509 -days 365 -nodes -batch -out #{@path} -keyout #{@path} -subj /O=dropbox.js/OU=Testing/CN=localhost"

    fs.mkdir('test/ssl') unless fs.existsSync('test/ssl')

  exists: ->
    fs.existsSync(@path)

  valid: (cb) ->
    cb(false) unless @exists()

    dropbox = require('dropbox')
    client = new dropbox.Client({
      key: 'c6oex2qavccb2l3'
      secret: 'cb0sxc9e09itvrn'
    })
    client.authDriver(new dropbox.AuthDriver.NodeServer())
    client.authenticate((error, authed_client) ->
      if error
        console.error('Failed to authenticate with current credentials')
        cb(false)
      else
        authed_client.readdir('/', (error, files) ->
          if error
            cb(false)
          else
            cb(true)
        )
    )

  create: (cb) ->
    @valid((result) =>
      exec(@cmd, (err) ->
        console.error(err) if err
        cb()
      )
    )

  read: ->
    fs.readFileSync(@path)

module.exports = TokenStash

cert = new Certificate()
cert.create ->
  ts = new TokenStash tls: cert.read()
  ts.get ->
    console.log "Done"
    process.exit(0)
