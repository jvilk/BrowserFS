#! /usr/bin/env coffee

fs = require 'fs'
{exec} = require 'child_process'
dropbox = require 'dropbox'

client = new dropbox.Client({
  key: 'c6oex2qavccb2l3'
  secret: 'cb0sxc9e09itvrn'
})

root = 'test/fixtures/dropbox/'
certPath = "#{root}cert.pem"
tokenPath = "#{root}token.json"

fs.mkdir(root) unless fs.existsSync(root)

cert = fs.readFileSync(certPath)
client.authDriver(new dropbox.AuthDriver.NodeServer(tls: cert))

# Check if there are some credentials already stored
token = null
if fs.existsSync(tokenPath)
  tokenData = fs.readFileSync(tokenPath, 'utf8')
  try
    token = JSON.parse(tokenData)
  catch e
    # Do nothing.

# Use them to authenticate if there are
if token isnt null
  client.setCredentials(token)

fail = ->
  console.error 'Failed to authenticate'
  process.exit 1

# Authenticate the client using the credentials
# If credentials do not exist OR if existing credentials are not valid,
# this method will pop up a browser window with the Dropbox login prompt.
client.authenticate (error, authed_client) ->
  if error
    fail()
  else
    if client.isAuthenticated()
      # Save the credentials for future use
      fs.writeFileSync(tokenPath, JSON.stringify(authed_client.credentials()))
      console.log 'Done'
      process.exit 0
    else
      fail()
