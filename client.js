// ATOM_SHELL_REQUIRE is node's require, but changed in preload.js
// to hopefully not conflict with page globals on the 'net
var ipc = ATOM_SHELL_REQUIRE('ipc')
var url = ATOM_SHELL_REQUIRE('url')

if (document.readyState === 'complete') parse()
else document.addEventListener("DOMContentLoaded", parse)

function parse() {
  var anchors = [].slice.call(document.querySelectorAll('a'))
  var uris = {}
  var pageUrl = url.parse(window.location.href)
  anchors.forEach(function(anchor) {
    var href = anchor.attributes.href.value
    if (!href) return
    uris[normalizeLink(pageUrl, href)] = true
  })
  ipc.send('links', Object.keys(uris))
}

// from https://github.com/jprichardson/node-linkscrape/blob/master/lib/linkscrape.js
function normalizeLink(parsedUrl, scrapedHref) {
  if (!scrapedHref || !parsedUrl) return null
  if (scrapedHref.indexOf('javascript:') === 0) return null
  if (scrapedHref.indexOf('#') === 0) return null
  
  var scrapedUrl = url.parse(scrapedHref)
  if (scrapedUrl.host != null) return scrapedHref
  if (scrapedHref.indexOf('/') === 0) return parsedUrl.protocol + '//' + parsedUrl.host + scrapedHref
  if (scrapedHref.indexOf('(') > 0 && scrapedHref.indexOf(')') > 0) return null
      
  var pos = parsedUrl.href.lastIndexOf("/")
  if (pos >= 0) {
    var surl = parsedUrl.href.substring(0, pos + 1)
    return surl + scrapedHref
  } else {
    return parsedUrl.href + "/" + scrapedHref
  }
}
