#!/usr/bin/env atom-shell
var spider = require('./index.js')

var site = process.argv[2] || process.exit(1)

spider({url: site})