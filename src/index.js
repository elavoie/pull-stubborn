var pull = require('pull-stream')
var log = require('debug')('pull-stubborn')

module.exports = function (transformer, tester) {
  var inputDone = false
  var done = false
  var pendingCb = null
  var resubmitted = []
  var pending = 0

  return function sink (read) {
    return pull(
      function source (abort, cb) {
        if (done) {
          log('source:cb(true)')
          return cb(done)
        } else if (abort) {
          if (pendingCb) {
            var _pendingCb = pendingCb
            pendingCb = null
            _pendingCb(true)
          }
          done = abort
          log('source:read(true)')
          return read(abort, cb)
        } else if (resubmitted.length > 0) {
          log('source:cb(null, resubmitted.shift()')
          return cb(false, resubmitted.shift())
        } else if (inputDone) {
          log('source:inputDone')
          if (pending > 0) {
            if (pendingCb !== null) {
              throw new Error('Concurrent requests are invalid according to the Pull-stream protocol')
            }
            log('source:pendingCb')
            pendingCb = cb
          } else {
            log('source:cb(true)')
            done = true
            return cb(done)
          }
        } else {
          log('source:read(' + abort + ',cb)')
          return read(abort, function (_done, x) {
            log('source:read:cb(' + _done + ',' + x + ')')
            if (_done) {
              inputDone = true
              if (pending === 0) {
                done = true
                log('source:cb(' + _done + ')')
                return cb(done) // No more values
              } else {
                if (resubmitted.length > 0) {
                  log('source:cb(false, resubmitted.shift())')
                  return cb(false, resubmitted.shift())
                } else {
                  log('source:pendingCb')
                  pendingCb = cb // Wait until there are no more values
                }
              }
            } else {
              log('source:cb(false, ' + x + ')')
              pending++
              return cb(_done, x) // Return current value
            }
          })
        }
      },
      transformer,
      pull.asyncMap(function (x, cb) {
        tester(x, function (success, x) {
          cb(null, { success: success, value: x })
        })
      }),
      pull.filter(function (res) {
        log('tester(' + res.success + ',' + res.value + ')')
        if (res.success) {
          return true
        } else {
          resubmitted.push(res.value)
          if (pendingCb !== null) {
            var cb = pendingCb
            pendingCb = null
            cb(null, resubmitted.shift())
          }
          return false
        }
      }),
      pull.map(function (res) {
        pending--
        if (pendingCb !== null) {
          var cb = pendingCb
          pendingCb = null
          if (pending === 0) cb(true)
          else if (resubmitted.length > 0) cb(false, resubmitted.shift())
          else pendingCb = cb
        }
        return res.value
      })
    )
  }
}
