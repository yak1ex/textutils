# textutils

A node module for tiny line-oriented text utilities having shell script flavor

Not yet published

## Usage

```js
const tu = require('textutils')

tu.cat('input.txt')
  .grep(/foo/)
  .sed(/bar/g,'BAR')
  .map(x => 'ZOT'+x)
  .head(5)
  .out('output.txt')
```

## Author

Yasutaka ATARASHI <yak_ex@mx.scn.tv>

## License

BSD-2-Clause
