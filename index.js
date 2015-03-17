var fs = require('fs')
var path = require('path')

var app = require('app')
var ipc = require('ipc')
var BrowserWindow = require('browser-window')

var createQueue = require('atomic-queue')
var debug = require('debug')('find-data')

module.exports = function (opts) {
  if (!opts) opts = {}
  if (!opts.workers) opts.workers = 1
  else opts.workers = +opts.workers // ensure int

  var windows = []
  var shouldQuit = false
  var clientJS = fs.readFileSync(__dirname + '/client.js').toString()
  
  app.on('will-quit', function(event) {
    if (!shouldQuit) event.preventDefault()
  })
  
  var visited = {}
  var workers = createWorkers()
  debug('creating pool with concurrency', opts.workers)
  var queue = createQueue(workers, {concurrency: opts.workers})

  app.on('ready', function appReady () {
    if (!opts.url) {
      console.error('Error: must specify URL')
      return app.terminate()
    }

    queue.on('ready', function queueReady (state) {
      // if first run then write seed url
      if (!state.since) queue.write(opts.url)
    })
    
    queue.on('error', function queueError (err) {
      console.error('queue error!', err)
    })
    
    queue.on('idle', function idle () {
      shouldQuit = true
      app.quit()
    }) 
    
    ipc.on('links', function (event, links) {
      var win = BrowserWindow.fromWebContents(event.sender)
      var currentUrl = event.sender.getUrl()
      visited[currentUrl] = true
      debug('links', {count: links.length, url: currentUrl})
      links.forEach(function each (link) {
        if (visited[link]) return
        if (opts.filter && !opts.filter(link)) return
        console.log(JSON.stringify({url: link}))
        queue.write(link)
      })
      win.close()
    })
  })
  
  return queue
  
  function createWorkers() {
    var workers = []
    var limit = opts.workers
    debug('create workers', {concurrency: limit})
    for (var i = 0; i < limit; i++) {
      workers.push(function worker (uri, done, change) {
        debug('create window', {change: change.change, uri: uri})
        var win = createWindow()
        windows.push(win)
        win.loadUrl(uri)
        visited[uri] = true
        var rendered = false
        
        // will only fire on urls that are renderable (text, html)
        win.webContents.on('did-finish-load', function finish (e, url) {
          rendered = true
          win.webContents.executeJavaScript(clientJS)
        })
        
        win.webContents.on('did-stop-loading', function stop () {
          if (!rendered) setTimeout(tryClose, 500) // give page 500ms to load

          function tryClose () {
            if (!rendered) {
              console.error('Window took too long to render, closing...')
              win.close()
            }
          }
        })
        
        win.on('closed', function closed () {
          setImmediate(done)
        })
      })
    }
    return workers
  }

  function createWindow() {
    return new BrowserWindow({
      width: 800,
      height: 600,
      show: true,
      preload: path.resolve(path.join(__dirname, 'preload.js')),
      "web-preferences": {
        "web-security": true
      }
    })
  }
}
