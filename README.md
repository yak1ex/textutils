[![JavaScript Style Guide](https://img.shields.io/badge/code_style-standard-brightgreen.svg)](https://standardjs.com)
[![Build Status](https://api.travis-ci.org/yak1ex/textutils.svg?branch=master)](https://travis-ci.org/yak1ex/textutils)
[![Coverage Status](https://img.shields.io/coveralls/yak1ex/textutils.svg)](https://coveralls.io/github/yak1ex/textutils)

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
