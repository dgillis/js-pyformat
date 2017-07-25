(function(root, factory) {
    if (typeof module === 'object' && typeof module.exports === 'object') {
        module.exports = factory(root);
    } else {
        root.pyformat = factory(root);
    }
})(typeof window !== 'undefined' && window, function(window) {
    /**
     *
     */
    var makeFormatter = function(options) {
        if (isFunction(options)) {
            options = {formatter: options};
        }

        // Clone options and fill defaults. This object will be accessible via
        // the "pyformat" property of the returned format func.
        var pyformatObject = extend({
            dateFormatter: dateFormatter,
            numberFormatter: numberFormatter,
            stringFormatter: stringFormatter,
            defaultFormatter: defaultFormatter
        }, options || {});


        // This is the format implementation that will be used, an override was
        // provided via the "formatter" option. In any case, this function will
        // be accessible via the pyformat object's "baseFormatter" property.
        var baseFormatter = function(format, value) {
            if (value && typeof value === 'object' && value.__pyformat__) {
                return value.__pyformat__.call(value, format);
            }

            if (isDate(value)) {
                return pyformatObject.dateFormatter(format, value);
            }

            if (isNumber(value)) {
                return pyformatObject.numberFormatter(format, value);
            }

            if (isString(value)) {
                return pyformatObject.stringFormatter(format, value);
            }

            return pyformatObject.defaultFormatter(format, value);
        };


        var formatter = pyformatObject.formatter || baseFormatter;


        pyformatObject.baseFormatter = baseFormatter;
        pyformatObject.formatter = formatter;


        // Bind the formatter func to the pyformat object so that "this" refers
        // to the pyformat object when it is invoked.
        var boundFormatter = bind(formatter, pyformatObject);


        var pyformatFunc = function(formatString, context) {
            var positionalContext = Array.prototype.slice.call(arguments, 1),
                keywordContext = isPlainObject(context) ? context : {};
            context = extend({}, positionalContext, keywordContext);
            return format(formatString, context, boundFormatter);
        };


        pyformatFunc.pyformat = pyformatObject;


        return pyformatFunc;
    };


    var format = function(formatString, context, callback) {
        if (typeof formatString !== 'string') {
            throw new Error('pyformat() got a non-string format template: ' +
                            formatString);
        }

        var splitter = '{',
            isInside = false,
            seenExplicit = false,
            seenImplicit = false,
            implicitCount = 0,
            format,
            key,
            keyAndFormat,
            formatted,
            segment,
            valueAndFormat,
            path,
            i,
            len,
            ret = [],
            val,
            index;

        while ((index = formatString.indexOf(splitter)) !== -1) {
            segment = formatString.slice(0, index);

            if (isInside) { // we're on the closing bracket looking back
                if (segment.indexOf(':') > -1) {
                    keyAndFormat = segment.split(':');
                    key = keyAndFormat.shift();
                    format = keyAndFormat.join(':');
                } else {
                    format = '';
                    key = segment;
                }

                if (key) {
                    if (seenImplicit) {
                        throw new Error(
                            'cannot switch from automatic field numbering ' +
                            'to manual field specification'
                        );
                    }
                    seenExplicit = true;
                } else {
                    if (seenExplicit) {
                        throw new Error(
                            'cannot switch from automatic field numbering ' +
                            'to manual field specification'
                        );
                    }
                    seenImplicit = true;
                    key = implicitCount++;
                }

                val = context[key];
                if (val === undefined && key.indexOf('.') > -1) {
                    // Check if the key is a valid path to a nested value. In
                    // this case, we use the value found at that path. Note
                    // that if they path string was defined, that value would
                    // have taken precedent over the path.
                    var keyParts = key.split('.'),
                        keyPartsLen = keyParts.length,
                        currContext = context,
                        keyIdx, currKey;

                    for (keyIdx = 0; keyIdx < keyPartsLen; keyIdx++) {
                        currKey = keyParts[keyIdx];
                        if (currKey in currContext) {
                            currContext = val = currContext[currKey];
                        } else {
                            val = undefined;
                            break;
                        }
                    }

                }

                if (val === undefined) {
                    // If there is no value for this format, leave the format
                    // param in the string, as Python does (this is also useful
                    // for chaining format operations).
                    formatted = '{' + segment + '}';
                } else {
                    formatted = callback(format, val);
                }

                ret.push(formatted);
            } else {
                ret.push(segment);
            }

            formatString = formatString.slice(index + 1); // the rest
            isInside = !isInside; // toggle
            splitter = isInside ? '}' : '{'; // now look for next matching bracket
        }

        ret.push(formatString); // remainder of the format string.

        return ret.join('');
    };

    var dateFormatter = function(format, value) {
        return strftime(format, value);
    };


    var stringFormatter = function(format, value) {
        return value;
    };


    var numberFormatter = (function() {
        var parseFormatSpec = (function() {
            var alignChars = [ '>', '<', '=', '^' ];

            var signChars = [ '+', '-', ' ' ];

            var numChars = '01234567890'.split('');

            var typeChars = ['b', 'c', 'd', 'e', 'E', 'f', 'F', 'g', 'G',
                             'n', 'o', 's', 'x', 'X', '%'];

            return function parseFormatSpec(spec) {
                var tokens = spec.split(''),
                    lastIndex = tokens.length - 1,
                    index = 0,
                    numParts, result;

                result = {
                    fill: '',
                    align: '',
                    sign: '',
                    '#': '',
                    '0': '',
                    'width': '',
                    ',': '',
                    precision: '',
                    type: ''
                };

                if (alignChars.indexOf(tokens[index + 1]) > -1) {
                    result['fill'] = tokens[index];
                    result['align'] = tokens[index + 1];
                    index += 2;
                }

                if (signChars.indexOf(tokens[index]) > -1) {
                    result['sign'] = tokens[index];
                    index++;
                }

                if (tokens[index] === '#') {
                    result['#'] = '#';
                    index++;
                }

                if (tokens[index] === '0') {
                    result['0'] = 0;
                    index++;
                }

                numParts = [];
                while (numChars.indexOf(tokens[index]) > -1) {
                    numParts.push(tokens[index++]);
                }
                if (numParts.length > 0) {
                    result['width'] = numParts.join('');
                }

                if (tokens[index] === ',') {
                    result[','] = ',';
                    index++;
                }

                if (tokens[index] === '.') {
                    index++;

                    numParts = [];
                    while (numChars.indexOf(tokens[index]) > -1) {
                        numParts.push(tokens[index++]);
                    }

                    if (numParts.length > 0) {
                        result['precision'] = numParts.join('');
                    }
                }


                if (typeChars.indexOf(tokens[index]) > -1) {
                    result['type'] = tokens[index];
                    index++;
                }

                if (index < lastIndex) {
                    throw new Error("Invalid format specification string: " +
                                    spec);
                }

                return result;
            };
        }).call();


        var applySpec = function(spec, num) {
            var printfStr = [
                '%',

                /*An optional "+" sign that forces to preceed the result with a plus or minus sign on numeric values. By default, only the "-" sign is used on negative numbers.*/
                spec.sign,

                /*An optional padding specifier that says what character to use for padding (if specified). Possible values are 0 or any other character precedeed by a '. The default is to pad with spaces.*/
                spec.fill,

                /*An optional "-" sign, that causes sprintf to left-align the result of this placeholder. The default is to right-align the result.*/
                spec.align,

                /*An optional number, that says how many characters the result should have. If the value to be returned is shorter than this number, the result will be padded.*/
                spec.width,

                /*An optional precision modifier, consisting of a "." (dot) followed by a number, that says how many digits should be displayed for floating point numbers. When used on a string, it causes the result to be truncated.*/
                (spec.precision == '') ? '' : ('.' + spec.precision),

                spec.type
            ].join('');

            var formatted = sprintf.sprintf(printfStr, num);

            if (spec[',']) {
                formatted = addCommas(formatted);
            }

            return formatted;
        };


        var applyGeneralFormatSpec = function(spec, num) {
            var p, eFormat, expStr, exp, formatted;

            if (spec.precision == '') {
                p = 6;
            } else if (spec.precision == '0') {
                p = 1;
            }

            eFormat = pyformat('{:e}', num);
            expStr = eFormat.match(/e([+-]\d+)/)[1];
            exp = parseInt(expStr);

            if (isNaN(expStr)) {
                // This should not happen
                spec.type = isInteger(num) ? 'd' : 'f';
                console.log('Warning: unable to determine general spec for ' +
                            num + '(the exp format was ' + expStr + ') falling ' +
                            'back on %' + spec.type);
                return applySpec(spec, num);
            }

            if (-4 <= exp && exp < p) {
                spec.type = 'f';
                spec.precision = '' + (p - 1 - exp);
            } else {
                spec.type = 'e';
                spec.precision = '' + (p - 1);
            }

            formatted = applySpec(spec, num);

            if (spec.type == 'f') {
                formatted = stripTrailingZeros(formatted);
            }

            return formatted;
        };


        // Removes trailing zeroes after the decimal point. The decimal point
        // is also removed if there are no remaining digits following it.
        var stripTrailingZeros = function(numString) {
            var decIndex = numString.indexOf('.');
            if (decIndex === -1) { return numString; }
            return numString.replace(/0+$/, '').replace(/\.$/, '');
        };


        return function numFormatter(formatString, arg) {
            var num = Number(arg),
                isInt = isInteger(arg),
                spec, type, printfStr, formatted;

            if (num == Infinity) { return 'inf'; }

            if (num == -Infinity) { return '-inf'; }

            if (isNaN(num)) { return 'nan'; }

            spec = parseFormatSpec(formatString);

            if (!isFiniteNumber(num)) {
                throw new Error(
                    "Invalid argument for the given specification: " + arg);
            }

            if (!spec.type) {
                spec.type = isInt ? 'd' : 'g';
            }

            if (spec.type == 'g') {
                // "General" format.
                if (num == 0) { return '0'; }

                if (num == -0) { return '-0'; }

                return applyGeneralFormatSpec(spec, num);
            }

            // convert to sprintf form...
            if (spec.align === '>') {
                spec.align = '-';
            } else if (spec.align === '<') {
                spec.align = '';
            } else if (spec.align) {
                throw new Error("Unsupported align component: " + spec.align);
            }

            return applySpec(spec, num);
        };
    }).call();


    var defaultFormatter = function(format, value) {
        return '' + value;
    };

    // Default padding is '0' and default length is 2, both are optional.
    function pad(n, padding, length) {
        // pad(n, <length>)
        if (typeof padding === 'number') {
            length = padding;
            padding = '0';
        }

        // Defaults handle pad(n) and pad(n, <padding>)
        if (padding == null) {
            padding = '0';
        }
        length = length || 2;

        var s = String(n);
        // padding may be an empty string, don't loop forever if it is
        if (padding) {
            while (s.length < length) s = padding + s;
        }
        return s;
    }


    // https://github.com/alexei/sprintf.js
    var sprintf = (function() {
        var re = {
            not_string: /[^s]/,
            number: /[dief]/,
            text: /^[^\x25]+/,
            modulo: /^\x25{2}/,
            placeholder: /^\x25(?:([1-9]\d*)\$|\(([^\)]+)\))?(\+)?(0|'[^$])?(-)?(\d+)?(?:\.(\d+))?([b-fiosuxX])/,
            key: /^([a-z_][a-z_\d]*)/i,
            key_access: /^\.([a-z_][a-z_\d]*)/i,
            index_access: /^\[(\d+)\]/,
            sign: /^[\+\-]/
        }

        function sprintf() {
            var key = arguments[0], cache = sprintf.cache
            if (!(cache[key] && cache.hasOwnProperty(key))) {
                cache[key] = sprintf.parse(key)
            }
            return sprintf.format.call(null, cache[key], arguments)
        }

        sprintf.format = function(parse_tree, argv) {
            var cursor = 1, tree_length = parse_tree.length, node_type = "", arg, output = [], i, k, match, pad, pad_character, pad_length, is_positive = true, sign = ""
            for (i = 0; i < tree_length; i++) {
                node_type = get_type(parse_tree[i])
                if (node_type === "string") {
                    output[output.length] = parse_tree[i]
                }
                else if (node_type === "array") {
                    match = parse_tree[i] // convenience purposes only
                    if (match[2]) { // keyword argument
                        arg = argv[cursor]
                        for (k = 0; k < match[2].length; k++) {
                            if (!arg.hasOwnProperty(match[2][k])) {
                                throw new Error(sprintf("[sprintf] property '%s' does not exist", match[2][k]))
                            }
                            arg = arg[match[2][k]]
                        }
                    }
                    else if (match[1]) { // positional argument (explicit)
                        arg = argv[match[1]]
                    }
                    else { // positional argument (implicit)
                        arg = argv[cursor++]
                    }

                    if (get_type(arg) == "function") {
                        arg = arg()
                    }

                    if (re.not_string.test(match[8]) && (get_type(arg) != "number" && isNaN(arg))) {
                        throw new TypeError(sprintf("[sprintf] expecting number but found %s", get_type(arg)))
                    }

                    if (re.number.test(match[8])) {
                        is_positive = arg >= 0
                    }

                    switch (match[8]) {
                        case "b":
                            arg = arg.toString(2)
                        break
                        case "c":
                            arg = String.fromCharCode(arg)
                        break
                        case "d":
                        case "i":
                            arg = parseInt(arg, 10)
                        break
                        case "e":
                            arg = match[7] ? arg.toExponential(match[7]) : arg.toExponential()
                        break
                        case "f":
                            arg = match[7] ? parseFloat(arg).toFixed(match[7]) : parseFloat(arg)
                        break
                        case "o":
                            arg = arg.toString(8)
                        break
                        case "s":
                            arg = ((arg = String(arg)) && match[7] ? arg.substring(0, match[7]) : arg)
                        break
                        case "u":
                            arg = arg >>> 0
                        break
                        case "x":
                            arg = arg.toString(16)
                        break
                        case "X":
                            arg = arg.toString(16).toUpperCase()
                        break
                    }
                    if (!is_positive || (re.number.test(match[8]) && match[3])) {
                        sign = is_positive ? "+" : "-"
                        arg = arg.toString().replace(re.sign, "")
                    }
                    else {
                        sign = ""
                    }
                    pad_character = match[4] ? match[4] === "0" ? "0" : match[4].charAt(1) : " "
                    pad_length = match[6] - (sign + arg).length
                    pad = match[6] ? str_repeat(pad_character, pad_length) : ""
                    output[output.length] = match[5] ? sign + arg + pad : (pad_character === "0" ? sign + pad + arg : pad + sign + arg)
                }
            }
            return output.join("")
        }

        sprintf.cache = {}

        sprintf.parse = function(fmt) {
            var _fmt = fmt, match = [], parse_tree = [], arg_names = 0
            while (_fmt) {
                if ((match = re.text.exec(_fmt)) !== null) {
                    parse_tree[parse_tree.length] = match[0]
                }
                else if ((match = re.modulo.exec(_fmt)) !== null) {
                    parse_tree[parse_tree.length] = "%"
                }
                else if ((match = re.placeholder.exec(_fmt)) !== null) {
                    if (match[2]) {
                        arg_names |= 1
                        var field_list = [], replacement_field = match[2], field_match = []
                        if ((field_match = re.key.exec(replacement_field)) !== null) {
                            field_list[field_list.length] = field_match[1]
                            while ((replacement_field = replacement_field.substring(field_match[0].length)) !== "") {
                                if ((field_match = re.key_access.exec(replacement_field)) !== null) {
                                    field_list[field_list.length] = field_match[1]
                                }
                                else if ((field_match = re.index_access.exec(replacement_field)) !== null) {
                                    field_list[field_list.length] = field_match[1]
                                }
                                else {
                                    throw new SyntaxError("[sprintf] failed to parse named argument key")
                                }
                            }
                        }
                        else {
                            throw new SyntaxError("[sprintf] failed to parse named argument key")
                        }
                        match[2] = field_list
                    }
                    else {
                        arg_names |= 2
                    }
                    if (arg_names === 3) {
                        throw new Error("[sprintf] mixing positional and named placeholders is not (yet) supported")
                    }
                    parse_tree[parse_tree.length] = match
                }
                else {
                    throw new SyntaxError("[sprintf] unexpected placeholder")
                }
                _fmt = _fmt.substring(match[0].length)
            }
            return parse_tree
        }

        var vsprintf = function(fmt, argv, _argv) {
            _argv = (argv || []).slice(0)
            _argv.splice(0, 0, fmt)
            return sprintf.apply(null, _argv)
        }

        /**
         * helpers
         */
        function get_type(variable) {
            return Object.prototype.toString.call(variable).slice(8, -1).toLowerCase()
        }

        function str_repeat(input, multiplier) {
            return Array(multiplier + 1).join(input)
        }

        return {
            sprintf: sprintf,
            vsprintf: vsprintf
        };

    }).call();


    // https://github.com/samsonjs/strftime
    var strftimeBase = (function() {
        var namespace = {};

        function words(s) { return (s || '').split(' '); }

        var DefaultLocale =
        { days: words('Sunday Monday Tuesday Wednesday Thursday Friday Saturday')
        , shortDays: words('Sun Mon Tue Wed Thu Fri Sat')
        , months: words('January February March April May June July August September October November December')
        , shortMonths: words('Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec')
        , AM: 'AM'
        , PM: 'PM'
        , am: 'am'
        , pm: 'pm'
        };

        namespace.strftime = strftime;
        function strftime(fmt, d, locale) {
          return _strftime(fmt, d, locale);
        }

        // locale is optional
        namespace.strftimeTZ = strftime.strftimeTZ = strftimeTZ;
        function strftimeTZ(fmt, d, locale, timezone) {
          if ((typeof locale == 'number' || typeof locale == 'string') && timezone == null) {
            timezone = locale;
            locale = undefined;
          }
          return _strftime(fmt, d, locale, { timezone: timezone });
        }

        namespace.strftimeUTC = strftime.strftimeUTC = strftimeUTC;
        function strftimeUTC(fmt, d, locale) {
          return _strftime(fmt, d, locale, { utc: true });
        }

        namespace.localizedStrftime = strftime.localizedStrftime = localizedStrftime;
        function localizedStrftime(locale) {
          return function(fmt, d, options) {
            return strftime(fmt, d, locale, options);
          };
        }

        // d, locale, and options are optional, but you can't leave
        // holes in the argument list. If you pass options you have to pass
        // in all the preceding args as well.
        //
        // options:
        //   - locale   [object] an object with the same structure as DefaultLocale
        //   - timezone [number] timezone offset in minutes from GMT
        function _strftime(fmt, d, locale, options) {
          options = options || {};

          // d and locale are optional so check if d is really the locale
          if (d && !quacksLikeDate(d)) {
            locale = d;
            d = undefined;
          }
          d = d || new Date();

          locale = locale || DefaultLocale;
          locale.formats = locale.formats || {};

          // Hang on to this Unix timestamp because we might mess with it directly below.
          var timestamp = d.getTime();

          var tz = options.timezone;
          var tzType = typeof tz;

          if (options.utc || tzType == 'number' || tzType == 'string') {
            d = dateToUTC(d);
          }

          if (tz) {
            // ISO 8601 format timezone string, [-+]HHMM
            //
            // Convert to the number of minutes and it'll be applied to the date below.
            if (tzType == 'string') {
              var sign = tz[0] == '-' ? -1 : 1;
              var hours = parseInt(tz.slice(1, 3), 10);
              var mins = parseInt(tz.slice(3, 5), 10);
              tz = sign * ((60 * hours) + mins);
            }

            if (tzType) {
              d = new Date(d.getTime() + (tz * 60000));
            }
          }

          // Most of the specifiers supported by C's strftime, and some from Ruby.
          // Some other syntax extensions from Ruby are supported: %-, %_, and %0
          // to pad with nothing, space, or zero (respectively).
          return fmt.replace(/%([-_0]?.)/g, function(_, c) {
            var mod, padding;

            if (c.length == 2) {
              mod = c[0];
              // omit padding
              if (mod == '-') {
                padding = '';
              }
              // pad with space
              else if (mod == '_') {
                padding = ' ';
              }
              // pad with zero
              else if (mod == '0') {
                padding = '0';
              }
              else {
                // unrecognized, return the format
                return _;
              }
              c = c[1];
            }

            switch (c) {

              // Examples for new Date(0) in GMT

              // 'Thursday'
              case 'A': return locale.days[d.getDay()];

              // 'Thu'
              case 'a': return locale.shortDays[d.getDay()];

              // 'January'
              case 'B': return locale.months[d.getMonth()];

              // 'Jan'
              case 'b': return locale.shortMonths[d.getMonth()];

              // '19'
              case 'C': return pad(Math.floor(d.getFullYear() / 100), padding);

              // '01/01/70'
              case 'D': return _strftime(locale.formats.D || '%m/%d/%y', d, locale);

              // '01'
              case 'd': return pad(d.getDate(), padding);

              // '01'
              case 'e': return pad(d.getDate(), padding == null ? ' ' : padding);

              // '1970-01-01'
              case 'F': return _strftime(locale.formats.F || '%Y-%m-%d', d, locale);

              // microseconds padded with zeros on left.
              case 'f': return microsecondsString(d);

              // '00'
              case 'H': return pad(d.getHours(), padding);

              // 'Jan'
              case 'h': return locale.shortMonths[d.getMonth()];

              // '12'
              case 'I': return pad(hours12(d), padding);

              // '000'
              case 'j':
                var y = new Date(d.getFullYear(), 0, 1);
                var day = Math.ceil((d.getTime() - y.getTime()) / (1000 * 60 * 60 * 24));
                return pad(day, 3);

              // ' 0'
              case 'k': return pad(d.getHours(), padding == null ? ' ' : padding);

              // '000'
              case 'L': return pad(Math.floor(timestamp % 1000), 3);

              // '12'
              case 'l': return pad(hours12(d), padding == null ? ' ' : padding);

              // '00'
              case 'M': return pad(d.getMinutes(), padding);

              // '01'
              case 'm': return pad(d.getMonth() + 1, padding);

              // '\n'
              case 'n': return '\n';

              // '1st'
              case 'o': return String(d.getDate()) + ordinal(d.getDate());

              // 'am'
              case 'P': return d.getHours() < 12 ? locale.am : locale.pm;

              // 'AM'
              case 'p': return d.getHours() < 12 ? locale.AM : locale.PM;

              // '00:00'
              case 'R': return _strftime(locale.formats.R || '%H:%M', d, locale);

              // '12:00:00 AM'
              case 'r': return _strftime(locale.formats.r || '%I:%M:%S %p', d, locale);

              // '00'
              case 'S': return pad(d.getSeconds(), padding);

              // '0'
              case 's': return Math.floor(timestamp / 1000);

              // '00:00:00'
              case 'T': return _strftime(locale.formats.T || '%H:%M:%S', d, locale);

              // '\t'
              case 't': return '\t';

              // '00'
              case 'U': return pad(weekNumber(d, 'sunday'), padding);

              // '4'
              case 'u':
                var day = d.getDay();
                return day == 0 ? 7 : day; // 1 - 7, Monday is first day of the week

              // ' 1-Jan-1970'
              case 'v': return _strftime(locale.formats.v || '%e-%b-%Y', d, locale);

              // '00'
              case 'W': return pad(weekNumber(d, 'monday'), padding);

              // '4'
              case 'w': return d.getDay(); // 0 - 6, Sunday is first day of the week

              // '1970'
              case 'Y': return d.getFullYear();

              // '70'
              case 'y':
                var y = String(d.getFullYear());
                return y.slice(y.length - 2);

              // 'GMT'
              case 'Z':
                if (options.utc) {
                  return "GMT";
                }
                else {
                  var tzString = d.toString().match(/\(([\w\s]+)\)/);
                  return tzString && tzString[1] || '';
                }

              // '+0000'
              case 'z':
                if (options.utc) {
                  return "+0000";
                }
                else {
                  var off = typeof tz == 'number' ? tz : -d.getTimezoneOffset();
                  return (off < 0 ? '-' : '+') + pad(Math.floor(Math.abs(off) / 60)) + pad(Math.abs(off) % 60);
                }

              default: return c;
            }
          });
        }

        function dateToUTC(d) {
          var msDelta = (d.getTimezoneOffset() || 0) * 60000;
          return new Date(d.getTime() + msDelta);
        }

        var RequiredDateMethods = ['getTime', 'getTimezoneOffset', 'getDay', 'getDate', 'getMonth', 'getFullYear', 'getYear', 'getHours', 'getMinutes', 'getSeconds'];
        function quacksLikeDate(x) {
          var i = 0
            , n = RequiredDateMethods.length
            ;
          for (i = 0; i < n; ++i) {
            if (typeof x[RequiredDateMethods[i]] != 'function') {
              return false;
            }
          }
          return true;
        }

        function microsecondsString(d) {
            var milliseconds = d.getMilliseconds(),
                microseconds = milliseconds * 1000;
            return pad(microseconds, '0', 6);
        };

        function hours12(d) {
          var hour = d.getHours();
          if (hour == 0) hour = 12;
          else if (hour > 12) hour -= 12;
          return hour;
        }

        // Get the ordinal suffix for a number: st, nd, rd, or th
        function ordinal(n) {
          var i = n % 10
            , ii = n % 100
            ;
          if ((ii >= 11 && ii <= 13) || i === 0 || i >= 4) {
            return 'th';
          }
          switch (i) {
            case 1: return 'st';
            case 2: return 'nd';
            case 3: return 'rd';
          }
        }

        // firstWeekday: 'sunday' or 'monday', default is 'sunday'
        //
        // Pilfered & ported from Ruby's strftime implementation.
        function weekNumber(d, firstWeekday) {
          firstWeekday = firstWeekday || 'sunday';

          // This works by shifting the weekday back by one day if we
          // are treating Monday as the first day of the week.
          var wday = d.getDay();
          if (firstWeekday == 'monday') {
            if (wday == 0) // Sunday
              wday = 6;
            else
              wday--;
          }
          var firstDayOfYear = new Date(d.getFullYear(), 0, 1)
            , yday = (d - firstDayOfYear) / 86400000
            , weekNum = (yday + 7 - wday) / 7
            ;
          return Math.floor(weekNum);
        }

        return namespace;
    }).call();


    var strftime = (function() {
        var isoDate = function (date) {
            return date.getUTCFullYear()
                + '-' + pad(date.getUTCMonth() + 1)
                + '-' + pad(date.getUTCDate())
                + 'T' + pad(date.getUTCHours())
                + ':' + pad(date.getUTCMinutes())
                + ':' + pad(date.getUTCSeconds())
                + '.' + String((date.getUTCMilliseconds()/1000).toFixed(3)).slice(2, 5)
                + 'Z';
        };


        var strftime = function(fmt, date, locale, custom) {
            if (!fmt) { return isoDate(date); }
            fmt = custom ? applyCustom(fmt, date, custom, true) : fmt;
            return strftimeBase.strftime(fmt, date, locale);
        };


        /**
         * Returns a number in [0, 1, 2, 3] representing the quarter.
         */
        var getQuarter = function(date) {
            return Math.floor(date.getMonth() / 3);
        };


        /**
         * Given a format string "fmt", apply the functions in the hash custom
         * such that each string of the form %"name" in fmt will be replaced with
         * the output of custom."name" or left unchanged if there is no such
         * function. If escape is True, any "%" returned by the custom callbacks
         * will be escaped.
         */
        var applyCustom = function(fmt, date, custom, escape) {
            if (custom) {
                fmt = fmt.replace(customRgx, function(match, prefix, name) {
                    var callback = custom[name],
                        replacement;

                    if (!callback) { return match; }

                    replacement = '' + callback(date);

                    if (escape) {
                        replacement = replacement.replace('%', '%%');
                    }

                    return prefix + replacement;
                });
            }

            return fmt;
        };


        var customRgx = /(^|[^%])%([a-zA-Z0-9_]+)/g;


        return strftime;
    }).call();



    var mathAbs = Math.abs;

    var mathRound = Math.round;

    var addCommas = function(num) {
        var parts = num.toString().split(".");
        parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
        return parts.join(".");
    };

    var isFunction = function(obj) {
        return typeof obj === 'function';
    };

    var isDate = function(obj) {
        return (obj instanceof Date);
    };

    var isString = function(obj) {
        return typeof obj == 'string';
    };

    var isNumber = function(obj) {
        return Object.prototype.toString.call(obj) === "[object Number]";
    };

    var isNaN = function (obj) {
        return isNumber(obj) && obj != +obj;
    };

    var isFiniteNumber = function(obj) {
        return isNumber(obj) && isFinite(obj) &&
            !isNaN(obj);
    };

    var isInteger = function(obj) {
        return isFiniteNumber(obj) && obj % 1 === 0;
    };

    var isPlainObject = function(obj) {
        return !!(obj && typeof obj === 'object' &&
                  obj.constructor === Object.prototype.constructor);
    };

    var toArray = function(arrayLike) {
        return Array.prototype.slice.call(arrayLike, 0);
    };

    var extend = function(obj) {
        var source, prop;
        for (var i = 1, length = arguments.length; i < length; i++) {
            source = arguments[i];
            for (prop in source) {
                if (Object.hasOwnProperty.call(source, prop)) {
                    obj[prop] = source[prop];
                }
            }
        }
        return obj;
    };


    var bind = function(fn, ctx) {
        if (fn.bind) { return fn.bind(ctx); }
        return function() { return fn.apply(ctx, arguments); };
    };


    var pyformat = makeFormatter({});


    // Expose the makeFormatter function to enable the creation of specialized
    // formatters.
    pyformat.makeFormatter = makeFormatter;

    // Expose the sprintf and strftime functions so they can be used as
    // building blocks for custom formatters.
    pyformat.sprintf = sprintf;
    pyformat.strftime = strftime;


    if (typeof define === 'function' && define.amd) {
        define('pyformat', [], function() {
            return pyformat;
        });
    }


    return pyformat;
});
