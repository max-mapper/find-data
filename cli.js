#!/usr/bin/env node

var ndjson = require('ndjson')
var findData = require('./')

findData({url: process.argv[2]})
  .pipe(ndjson.serialize())
  .pipe(process.stdout)
