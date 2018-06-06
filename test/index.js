var tape = require('tape')
var pull = require('pull-stream')
var stubborn = require('../')
var paramap = require('pull-paramap')
var debug = require('debug')
var log = debug('test/pull-stubborn')

function increasing (a, b) {
  return a - b
}

tape('Readme Example', function (t) {
  var expected = [0, 1, 2, 3].map(function (x) { return x * x })

  pull(
    pull.count(4),
    stubborn(
      pull.map(function (x) {
        log('processing ' + x)
        return {
          status: Math.random() * 10,
          input: x,
          result: x * x
        }
      }),
      function tester (x, cb) {
        var success = x.status >= 5 // 50% chance of success
        if (success) cb(true, x.result) // Return result
        else cb(false, x.input) // Resubmit input
      }
    ),
    pull.collect(function (err, observed) {
      if (err) return t.error(err)
      observed.sort(increasing)
      log(observed)
      t.deepEqual(observed, expected)
      t.end()
    })
  )
})

tape('concurrent version', function (t) {
  var setup = [
    { count: 1, repetitions: 1, concurrency: 1 },
    { count: 10, repetitions: 30, concurrency: 1 },
    { count: 10, repetitions: 30, concurrency: 2 },
    { count: 10, repetitions: 30, concurrency: 3 },
    { count: 10, repetitions: 30, concurrency: 4 },
    { count: 10, repetitions: 30, concurrency: 10 },
    { count: 10, repetitions: 30, concurrency: 20 }
  ]

  function test (options) {
    log('test(' + options + ')')
    var expected = []
    for (var i = 0; i <= options.count; ++i) {
      expected.push(i * i)
    }
    var observed = []

    pull(
      pull.count(options.count),
      stubborn(
        paramap(function (x, cb) {
          setTimeout(function () {
            cb(null, {
              status: Math.random() * 10,
              input: x,
              result: x * x
            })
          }, Math.random() * 20)
        }, options.concurrency),
        function tester (x, cb) {
          var success = x.status >= 5 // 50% chance of success
          if (success) cb(true, x.result) // Return result
          else cb(false, x.input) // Resubmit input
        }
      ),
      pull.drain(
        function (x) {
          log(x)
          observed.push(x)
        },
        function (err) {
          if (err) return t.error(err)
          observed.sort(increasing)
          t.deepEqual(observed, expected)
          options.repetitions--
          if (options.repetitions === 0) {
            if (setup.length > 0) {
              setImmediate(function () { test(setup.shift()) })
            } else t.end()
          } else setImmediate(function () { test(options) })
        }
      )
    )
  }
  test(setup.shift())
})
