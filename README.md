Keeps resubmitting inputs to transformer until the corresponding outputs test successfully. May not preserve the input order.

Expectation on Transformer:
* Outputs a single value per input

# Example Usage

````
var pull = require('pull-stream')
var stubborn = require('pull-stubborn')

pull(
  pull.count(3),
  stubborn(
    pull.map(function (x) { 
      return { 
        status: Math.random() * 10,
        input: x,
        result: x*x
      } 
    }),
    function tester (x, cb) {
      var success = x.status >= 5 // 50% chance of success
      if (success) 
        cb(true, x.result) // Return result
      else 
        cb(false, x.input) // Resubmit input
    }
  ),
  pull.collect(function (err, arr) {
    if (err) return console.error(err)
    arr.sort()       // Results may be out of order
    console.log(arr) // Prints 0,1,4,9
  })
)
````

# stubborn(transformer/duplex, tester(x, cb)) returns another transformer/duplex

````cb```` has the following signature ````cb(success, value)````. If
````success===true```` then ````value```` is passed downstream. Otherwise, 
````value```` is submitted to ````transformer/duplex````
again as input. Each case may use a different ````value````.

