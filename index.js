var fs = require('fs')
var path = require('path')

var app = require('app')
var ipc = require('ipc')
var BrowserWindow = require('browser-window')

var createQueue = require('atomic-queue')
var uuid = require('hat')
var debug = require('debug')('find-data')

module.exports = function (opts) {
  if (!opts) opts = {}
  var clientJS = fs.readFileSync(__dirname + '/client.js').toString()
    
  app.on('will-quit', function(e) {
    e.preventDefault()
  })
  
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
    
    ipc.on('site-ready', function (event, dims) {
      console.error('got site ready!')
    })
    
    ipc.on('links', function (event, links) {
      links.forEach(function each (link) {
        if (visited[link]) return
        console.log(JSON.stringify({url: link}))
        queue.write(link)
      })
    })
    
    function createWorkers() {
      var workers = []
      var limit = opts.workers || 1
      for (var i = 0; i < limit; i++) {
        workers.push(function worker (uri, done) {
          debug('create window', uri)
          var win = createWindow()
          win.loadUrl(uri)
          visited[uri] = true
          var id = uuid() // hack for https://github.com/atom/atom-shell/issues/1231
          win.webContents.on('did-finish-load', function (e, url) {
            win.webContents.executeJavaScript(clientJS)
            win.webContents.send('win-id', id)
            ipc.once(id + '-done', function onDone () {
              debug('close window', uri)
              win.close()
              setTimeout(done, 1000)
            })
          })
  
          win.webContents.on('will-navigate', function (e, url) {
            console.error('will-navigate ' + url)
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
