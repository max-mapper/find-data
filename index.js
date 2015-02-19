var filetypes = require('./filetypes.js')
var request = require('request')
var async = require('async')
var cheerio = require('cheerio')
var through = require('through2')
var path = require('path')

module.exports = function(opts) {
  var stream = through.obj()
  if (!opts.url) stream.destroy(new Error('must specify url'))
  var queue = async.queue(function(item, done) {
    getFiles(item, function(err, files) {
      files.forEach(function(file) {
        stream.push(file)
      })
      done()
    })
  }, 10)
  if (opts.url) queue.push(opts.url)
  queue.drain = function() {
    stream.end()
  }
  return stream
  
  function getFiles(page, cb) {
    request(page, function(err, resp, buff) {
      if (err) return cb(err)
      var $ = cheerio.load(buff)
      var files = []
      $('a').map(function(i, a) {
        var href = $(a).attr('href')
        if (!href) return
        if (opts.filter) {
          var ext = path.extname(href).slice(1)
          if (filetypes.indexOf(ext) > -1) files.push(href)
        } else {
          files.push(href)
        }
      })
      cb(null, files)
    })
  }
}
