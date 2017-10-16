# js-pyformat

Python-style string formatting in Javascript.

## Install

With [npm](http://npmjs.org) do:

```sh
npm install js-pyformat
```

## API

### `pyformat(format, ...args)`

Interpolate the string format similarly to [Python's `str.format`](https://docs.python.org/2/library/stdtypes.html#str.format).

The pyformat function closely replicates much (all?) of Python's
[str.format() handling for numbers](https://docs.python.org/2/library/stdtypes.html#string-formatting-operations),
and adds [strftime-style](https://docs.python.org/2/library/datetime.html#strftime-and-strptime-behavior)
formatting for dates.

## Examples

```js
var pf = require('js-pyformat');

// Python-style string interpolation:
pf('{} x {} = {}', 2, 3, 6)  // "2 x 3 = 6"
pf('{greeting}, {name}', {greeting: "Hello", name: "Duncan"})  // "Hello, Duncan"

// Numeric formatting - add thousand separator commas:
pf('{:,}', 1000000) // "1,000,000"

// Numeric formatting - decimal precision:
pf('{:.3f}', 3.1415926) // "3.142"
pf('{:.3f}', 100) // "100.000"

// Date formatting (using strftime time format strings):
pf('{:%B %d, %Y}', new Date(2015, 11, 25)) // "December 25, 2015"
pf('{:%Y-%m-%dT%H:%M:%S}', new Date(2015, 11, 25))  // "2015-12-25T00:00:00"
```

## Custom Formatter Extensions

The API exposes is composed of multiple type-specific formatters along with a default
formatter. Customized pyformat functions can be created via the `makeFormatter(options)`
function.

The options provided to makeFormatter should be an object consisting of
`dateFormatter`, `numberFormatter`, or `stringFormatter` as functions to, respectively,
format either date, number, or string values. Each of these functions will be invoked with the
inner format string (i.e., the `"X"` within `"{:X}"`) as the first argument and the value to
format as the second argument.

An additional function for handling values which are neither dates nor numbers nor strings can be
provided as `defaultFormatter` and should have a similar call signature to the other formatters.

### Custom formatter example - boolean formatting.

```js
var pf = require('js-pyformat');

// Returns the quarter (1-4) the date falls in.
var boolFormatter = function(trueOrFalse) {
  return trueOrFalse ? "Yes" : "No";
};

var pfWithBooleanFormatting = pf.makeFormatter({
  defaultFormatter: function(format, value) {
    if (typeof value === 'boolean') {
      return boolFormatter(value);
    }
    // Fallback on the builtin default formatter for non-booleans.
    return pf.pyformat.defaultFormatter(format, value);
  }
});

pfWithBooleanFormatting("true -> {}, false -> {}", true, false)
// "true -> Yes, false -> "No"
```

### Custom formatter example - date formatting with quarters

```js
var pf = require('js-pyformat');

// Returns the quarter (1-4) the date falls in.
var getQuarter = function(date) {
  return 1 + Math.floor(date.getMonth() / 3);
};

// Customized Date formatter; same as builtin strftime formatter, but also accepts
// "%q" to specify the quarter.
var myDateFormatter = function(format, date) {
  // NOTE: uses strftime() utility function exposed by pyformat.
  return pf.strftime(format, date, void(0), {"q": getQuarter});
};

// Create customized formatter whose date formatting includes quarters ("q").
var newPf = pf.makeFormatter({
  dateFormatter: myDateFormatter
});

newPf("{:Q%q, %Y}", new Date(2015, 5, 1)) // "Q2, 2015"
```
