#!/usr/bin/env atom-shell
var spider = require('./index.js')
var args = require('minimist')(process.argv.slice(2))

if (!args._[0]) {
  console.error('Usage: find-data <url> [--workers=N]')
} else {
  args.url = args._[0]
  spider(args)
}
