var spawn = require('npm-execspawn')
var concat = require('concat-stream')
var ndjson = require('ndjson')
var test = require('tape')

var ipac = "http://irsa.ipac.caltech.edu/ibe/data/wise/allwise/p3am_cdd/00/0000/0000m016_ac51/"

test('parse links on ipac', function(t) {
  var c = spawn('atom-shell ./cli.js ' + ipac)
  
  c.stdout.pipe(ndjson.parse()).pipe(concat(function(out) {
    t.equal(out.length, 55, 'got 55 urls')
    t.end()
  }))  
})
