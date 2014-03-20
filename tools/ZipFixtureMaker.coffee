#! /usr/bin/env coffee
# Generates test fixtures for Zip FS.
fs = require 'fs'
path = require 'path'
archiver = require 'archiver'

baseFolder = "#{__dirname}/.."
srcFolder = "#{baseFolder}/test/fixtures/files"
outputFolder = "#{baseFolder}/test/fixtures/zipfs"

# Create a zip file of the fixture data using the given zlib compression level.
createZip = (level) ->
  output = fs.createWriteStream "#{outputFolder}/zipfs_fixtures_l#{level}.zip"
  options = zlib: level: level
  archive = archiver 'zip', options
  archive.on 'error', (err) -> throw err
  archive.pipe output
  addFolder archive, srcFolder
  archive.finalize (err, bytes) -> if err then throw err
  return

# Recursively add folders and their files to the zip file.
addFolder = (archive, folder) ->
  files = fs.readdirSync folder
  for file in files
    fullpath = path.join folder, file
    if fs.statSync(fullpath).isDirectory()
      addFolder archive, fullpath
    else
      addFile archive, fullpath
  return

# Add the given file to the zip file.
addFile = (archive, fileName) ->
  fileNameRelative = path.relative baseFolder, fileName
  archive.append(fs.createReadStream(fileName), {name: fileNameRelative})
  return

# Ensure output folder exists
unless fs.existsSync outputFolder
  fs.mkdirSync outputFolder

# Store
createZip 0
# Middle-of-the-road compression
createZip 4
# Maximum compression
createZip 9
