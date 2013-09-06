#! /usr/bin/env coffee

fs = require 'fs'
{exec} = require 'child_process'
dropbox = require 'dropbox'

client = new dropbox.Client({
  key: 'c6oex2qavccb2l3'
  secret: 'cb0sxc9e09itvrn'
})


# Represents the SSL certificate used to authenticate with Dropbox
# Singleton class - only instantiate once
class Certificate
  constructor: ->
    @path = 'test/ssl/cert.pem'
    @cmd = "openssl req -new -x509 -days 365 -nodes -batch -out #{@path} -keyout #{@path} -subj /O=dropbox.js/OU=Testing/CN=localhost"

    fs.mkdir('test/ssl') unless fs.existsSync('test/ssl')

  create: (cb) ->
    exec(@cmd, (err) ->
      console.error(err) if err
      cb()
    )

  read: ->
    fs.readFileSync(@path)

# Create a new SSL certificate for the server that handles the auth callback
cert = new Certificate()
cert.create ->
  client.authDriver(new dropbox.AuthDriver.NodeServer({tls: cert.read()}))

  # Check if there are some credentials already stored
  tokenPath = 'test/token.json'
  token = null
  if fs.existsSync(tokenPath)
    tokenData = fs.readFileSync(tokenPath, 'utf8')
    try
      token = JSON.parse(tokenData)
    catch

  # Use them to authenticate if there are
  if token isnt null
    client.setCredentials(token)

  # Authenticate the client using the credentials
  client.authenticate((error, authed_client) ->
    if error
      console.error('Failed to authenticate')
      process.exit(1)
    else
      if client.isAuthenticated()
        # Save the credentials for future use
        fs.writeFileSync(tokenPath, JSON.stringify(authed_client.credentials()))
        console.log 'Done'
        process.exit(0)
      else
        console.error('Failed to authenticate')
        process.exit(1)
  )
