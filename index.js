var fs = require('fs')
var path = require('path')
var url = require('url')

var app = require('app')
var ipc = require('ipc')
var BrowserWindow = require('browser-window')

var createQueue = require('atomic-queue')
var debug = require('debug')('find-data')

module.exports = function (opts) {
  if (!opts) opts = {}
  if (!opts.workers) opts.workers = 5
  else opts.workers = +opts.workers // ensure int

  if (!opts.maxDepth) opts.maxDepth = 3
  else opts.maxDepth = +opts.maxDepth // ensure int
    
  opts.hostname = 'localhost'

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
  
  function filter(link) {
    if (link.url in visited) return false
    if (opts.filter && !opts.filter(link)) return false
    var depth = visited[link.referrer] || 0
    if (depth + 1 > opts.maxDepth) {
      debug('maxDepth exceeded, skipping', link.url)
      return false
    }
    
    if (opts.hostname) {
      var parsed = url.parse(link.url)
      if (parsed.hostname !== opts.hostname) {
        debug('hostname doesnt match domain, skipping', link.url)
        return false
      }
    }

    return true
  }

  app.on('ready', function appReady () {
    if (!opts.url) {
      console.error('Error: must specify URL')
      return app.terminate()
    }

    queue.on('ready', function queueReady (state) {
      // if first run then write seed url
      if (!state.since) queue.write({url: opts.url})
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
      var uri = event.sender.getUrl()
      uri = normalizeUri(uri)
      debug('links', {count: links.length, url: uri})
      links.forEach(function each (link) {
        var page = {url: normalizeUri(link), referrer: uri}
        if (!filter(page)) return
        console.log(JSON.stringify(page))
        queue.write(page)
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
      workers.push(function worker (page, done, change) {
        page.url = normalizeUri(page.url)
        debug('create window', {change: change.change, uri: page.url})
        
        var win = createWindow()
        windows.push(win)
        win.loadUrl(page.url)

        var depth
        if (page.referrer in visited) depth = visited[page.referrer]
        else depth = -1
        visited[page.url] = depth + 1

        var rendered = false

        // will only fire on urls that are renderable (text, html)
        win.webContents.on('did-finish-load', function finish (e) {
          rendered = true
          win.webContents.executeJavaScript(clientJS)
        })

        win.webContents.on('did-stop-loading', function stop () {
          if (!rendered) setTimeout(tryClose, 1000) // give page 1s to load

          function tryClose () {
            if (!rendered) {
              debug('Window took too long to render, closing ' + page.url)
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

function normalizeUri(uri) {
  if (uri[uri.length - 1] === '/') uri = uri.slice(0, uri.length - 1) // slice off trailing /
  return uri
}
