var fs = require('fs')
var path = require('path')

var app = require('app')
var ipc = require('ipc')
var BrowserWindow = require('browser-window')

var createQueue = require('atomic-queue')
var debug = require('debug')('find-data')

module.exports = function (opts) {
  if (!opts) opts = {}
  var windows = []
  var clientJS = fs.readFileSync(__dirname + '/client.js').toString()
  
  app.on('ready', function appReady () {
    var visited = {}
    var workers = createWorkers()
    var queue = createQueue(workers)
    
    queue.on('ready', function queueReady (state) {
      // if first run then write seed url
      if (!state.since) queue.write(opts.url)
    })
    
    queue.on('error', function queueError (err) {
      console.error('queue error!', err)
    })
    
    queue.on('idle', function idle () { }) 
    
    ipc.on('links', function (event, links) {
      links.forEach(function each (link) {
        if (visited[link]) return
        console.log(JSON.stringify({url: link}))
        queue.write(link)
      })
      var win = BrowserWindow.fromWebContents(event.sender)
      win.close()
    })
    
    function createWorkers() {
      var workers = []
      var limit = opts.workers || 1
      for (var i = 0; i < limit; i++) {
        workers.push(function worker (uri, done) {
          debug('create window', uri)
          var win = createWindow()
          windows.push(win)
          win.loadUrl(uri)
          visited[uri] = true
          win.webContents.on('did-finish-load', function (e, url) {
            win.webContents.executeJavaScript(clientJS)
          })
          win.on('close', function closed () {
            done()
          })
        })
      }
      return workers
    }
  
    function createWindow() {
      return new BrowserWindow({
        width: 800,
        height: 600,
        show: false,
        preload: path.resolve(path.join(__dirname, 'preload.js')),
        "web-preferences": {
          "web-security": true
        }
      })
    }
  })
}
