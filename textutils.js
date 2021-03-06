'use strict'
const fs = require('fs')
const stream = require('stream')
const cprocess = require('child_process')
const split2 = require('split2')
const through2 = require('through2')
const Deque = require('denque')

// TODO: error handling
/**
 * An internal helper class to implement divide()
 * @access protected
 */
const LimitedStream = class extends stream.Readable {
  constructor (reader, opt) {
    super(opt)
    this._read = reader
  }
}

/**
 * Call rs.pipe(ws) with error propagation from rs to ws
 * @access protected
 * @param  {Stream.Readable} rs A readable stream piped from
 * @param  {Stream.Writable} ws A writable stream piped to
 * @return {Stream.Writable} passed ws itself
 */
const _pipe = (rs, ws) => {
  rs.on('error', (e) => ws.destroy(e))
  return rs.pipe(ws)
}

/**
 * @callback rejectCallback
 * @param {Error} Reason why the promise is rejected
 */

/**
 * @callback resolveCallback
 * @param {Error} Reason why the promise is rejected
 */

/**
 * @typedef {function} Executor
 * @param {resolveCallback} resolve
 * @aram {rejectCallback} reject
 */

/**
 * A helper function to transfer exception to reject promise
 * @access protected
 * @param  {resolveCallback|function} resolve A resolve callback or an executor of a promise
 * @param  {rejectCallback} [reject] A reject callback of a promise for 3-parameter call
 * @param  {Executor} [f] An executor for 3-parameter call
 * @return {Executor} Actual valid arguments of returned function depends on calling parameter.
 * @example <caption>Example for 3 parameter</caption>
 * // Throwing exeception in the callback causes calling reject(exception)
 * // Acutually, callback is called with cb(resolve, reject), however, resolve and reject are accessible for typical cases.
 * new Promise((resolve, reject) => {
 *   EventEmitter.on('event', _(resolve, reject, () => { ... })); }
 * @example <caption>Example for 1 parameter</caption>
 * // Throwing exeception in the callback causes calling reject(exception)
 * new Promise(_((resolve, reject) => { ... })));
 * }
 */
const _ = (resolve, reject, f) => {
  return ((f) => function (resolve, reject) { try { f(resolve, reject) } catch (e) { reject(e) } })(
    reject !== undefined ? () => f(resolve, reject)
                         : resolve
  )
}

/**
 * @callback transformCallbackCallback
 * @param {?Error} error
 * @param {Buffer|string|any} data
 */

/**
 * @callback transformCallback
 * @param {Buffer|string|any} chunk The chunk to be tranformed
 * @param {string} enc An encoding type or 'buffer'
 * @param {transformCallbackCallback} cb A callback to signal that the supplied chunk is consumed
 */

/**
 * @callback flushCallback
 * @param {transformCallbackCallback} cb A callback to signal that transform is completed
 */

/**
 * @classdesc Tiny text utilities.
 * Almost all methods acts on text content in line-by-line manner and returns textutils object to enable chaining.
 * @memberof module:textutils
 */
const textutils = class {
  /**
   * @constructor
   * @param  {Stream.Readable} st A readable stream to be holded by the resultant textutils object
   */
  constructor (st) {
    this.stream = st
  }
  /**
   * Create a textutils object having the specified stream wrapped by a line-by-line stream
   * @static
   * @param  {Stream.Readable} rs A readable stream to be wrapped
   * @return {textutils}
   */
  static attach (rs) {
    let left
    return new this(_pipe(_pipe(rs, split2(/(\r?\n)/)), through2((chunk, enc, cb) => {
      if (chunk.indexOf('\n') !== -1) { // No chunk.includes(), prior to Node v5.3
        cb(null, Buffer.concat([left === undefined ? Buffer.alloc(0) : left, chunk]))
        left = undefined
      } else {
        cb()
        left = chunk
      }
    }, function (cb) { if (left !== undefined) { this.push(left) } cb() })))
  }
  // TODO: support multiple paths
  /**
   * output contents of the specified path
   * @param  {string} path target file path
   * @return {textutils}   textutils object
   */
  static cat (path) {
    return this.attach(fs.createReadStream(path, { encoding: 'utf8' }))
  }
  /**
   * A helper method to pipe streams, calling _pipe(this.stream, ws)
   * @access protected
   * @param  {Stream.Writable} ws A writable stream piped to
   * @return {Stream.Writable} passed ws itself
   */
  _pipe (ws) {
    return _pipe(this.stream, ws)
  }
  /**
   * A helper method to pipe to a transform stream
   * @access protected
   * @param  {transformCallback} transform A transform callback for transform stream
   * @param  {flushCallback} flush A flush callback for transform stream
   * @return {textutils} A textutils object holding the resultant transform stream
   */
  _tpipe (transform, flush) {
    return new this.constructor(this._pipe(through2(transform, flush)))
  }
  /**
   * A helper method to pipe to a transform stream with a line-by-line stream
   * @access protected
   * @param  {transformCallback} transform A transform callback for transform stream
   * @param  {flushCallback} flush A flush callback for transform stream
   * @return {textutils} A textutils object holding the resultant transform stream
   */
  _tpipeToline (transform, flush) {
    return this.constructor.attach(this._pipe(through2(transform, flush)))
  }
  /**
   * Filter content by string.match()
   * @param  {RegExp} re passed to string.match()
   * @return {textutils}
   */
  grep (re) {
    return this._tpipe((chunk, enc, cb) => chunk.toString().match(re) ? cb(null, chunk) : cb())
  }
  /**
   * Replace content by string.replace()
   * @param  {RegExp|string} re1 passed as 1st parameter of string.replace()
   * @param  {string|function} re2 passed as 2nd parameter of string.replace()
   * @return {textutils}
   */
  sed (re1, re2) {
    return this._tpipe((chunk, enc, cb) => cb(null, Buffer.from(chunk.toString().replace(re1, re2))))
  }
  /**
   * Output the first specified number of lines
   * @param  {integer} num Number of lines
   * @return {textutils}
   */
  head (num) {
    return this._tpipe((chunk, enc, cb) => num-- > 0 ? cb(null, chunk) : cb())
  }
  /**
   * Output the last specified number of lines
   * @param  {integer} num Number of lines
   * @return {textutils}
   */
  tail (num) {
    let buf = new Deque()
    return this._tpipe(
      (chunk, enc, cb) => { if (buf.length === num) { buf.shift() } buf.push(chunk); cb() },
      function (cb) { for (let i = 0; i < buf.size(); ++i) { this.push(buf.get(i)) } cb() })
  }
  /**
   * Output the specified header and footer around content
   * @param  {Buffer|string} pre A header content
   * @param  {Buffer|string} post A footer content
   * @return {textutils}
   */
  prepost (pre, post) {
    let predone = false
    return this._tpipeToline(
      function (chunk, enc, cb) { if (!predone) { predone = true; if (pre !== undefined) { this.push(pre) } } cb(null, chunk) },
      function (cb) { if (post !== undefined) { this.push(post) } cb() }
    )
  }
  /**
   * Output content with the specified header
   * @param  {Buffer|string} pre A header content
   * @return {textutils}
   */
  pre (pre) { return this.prepost(pre) }
  /**
   * Output content with the specified footer
   * @param  {Buffer|string} post A footer content
   * @return {textutils}
   */
  post (post) { return this.prepost(undefined, post) }
  // TODO: method to skip lines
  /**
   * @callback mapCallback
   * @param {string} s An input line
   * @return {?string} An output line
   */
  /**
   * Output content mapped by the specified filter function
   * @param {mapCallback} f A filter function called for each line. If it returns null or undefined, the line is ignored.
   * @return {textutils}
   */
  map (f) {
    return this._tpipe((chunk, enc, cb) => { let ret = f(chunk.toString()); if (ret === undefined || ret === null) cb(); else cb(null, Buffer.from(ret)) })
  }
  // FIXME: naive implementation
  // TODO: key extractor
  // TODO: comparator
  /**
   * Sort, currently, by just calling array.sort()
   * @return {textutils}
   */
  sort () {
    let data = []
    return this._tpipe((chunk, enc, cb) => { data.push(chunk); cb() },
      function (cb) { data.sort(); for (let val of data) { this.push(val) } cb() }
    )
  }
  // TODO: key extractor
  // TODO: comparator
  /**
   * Remove duplicated consecutive lines
   * @return {textutils}
   */
  uniq () {
    let data
    return this._tpipe(
      function (chunk, enc, cb) {
        if (data === undefined) {
          data = chunk
        } else if (!data.equals(chunk)) {
          this.push(data); data = chunk
        }
        cb()
      },
      function (cb) { if (data !== undefined) { this.push(data) } cb() }
    )
  }
  /**
   * Execute an external command as a filter.
   * Arguments are passed to child_process.spawn(). options.stdio will be overridden as [ 'pipe', 'pipe', 'ignore' ].
   * If an error occurrs when executing the command, the error propagates through a call chain.
   * @param  {string} command The command to run
   * @param  {Array} args    List of string arguments
   * @param  {Object} options See child_process.spawn() in node.js
   * @return {textutils}
   */
  spawn (command, args, options) {
    let ret
    options = Object.assign({}, options)
    options.stdio = [ 'pipe', 'pipe', 'ignore' ] // TODO: binding with stderr
    let ch = cprocess.spawn(command, args, options)
    ch.on('error', (e) => ret.stream.destroy(e))
    this.stream.on('end', () => this.stream.unpipe())
    this._pipe(ch.stdin)
    ret = this.constructor.attach(ch.stdout)
    return ret
  }
  /**
   * Pipe to the specified stream.
   * If an error occurs on reader side, ws.destroy() is called.
   * @param  {Stream.Writable} ws A writable stream piped to
   * @return {textutils}
   */
  pipe (ws) {
    let out = this._pipe(ws)
    // stdout and stderr are Duplex streams
    if (ws !== process.stdout && ws !== process.stderr && ws instanceof stream.Readable) {
      return this.constructor.attach(out)
    } else {
      return out
    }
  }
  /**
   * @callback applyCallback
   * @param {stream.Readable}
   * @return {any}
   */
  /**
   * Apply the specified function to the stream
   * @param  {applyCallback} f Called as f(stream)
   * @return {any}   Return value of the specified f
   */
  apply (f) {
    return f(this.stream)
  }
  /**
   * @callback teeCallback
   * @param {textutils} tu
   */
  /**
   * Split call chain
   * @param  {teeCallback} f The passed textutils object is identical to return value of this method
   * @return {textutils}
   * @example
   * tu.cat('input.txt').tee(t=>t.out('output1.txt')).out('output2.txt');
   */
  tee (f) {
    f(this); return this
  }
  /**
   * @callback matcherCallback
   * @param {string}
   * @return {boolean}
   */
   /**
    * @callback divideCallback
    * @param {textutils} tu
    * @param {integer} count The sequence number in the divided sections
    * @return {Promise} A promise object to be resolved when completion
    */
  /**
   * An internal helper method to implement divide() variants.
   * @access protected
   * @param  {Boolean} isFrom  If true, the line that the match succeeds will be the first line of the divided sections. If false, the line that the match succeeds will be the last line of the divided sections.
   * @param  {string|RegExp|matcherCallback}  matcher_ A criteria for division
   * @param  {divideCallback}  f        A callback for each divided section
   * @return {Promise}     A promise object to be resolved when completion of all callback calls or rejection of any
   */
  _divide (isFrom, matcher_, f) {
// TODO: error handling check
    return new Promise(_((resolve, reject) => {
      let matcher = (typeof matcher_ === 'string' || matcher_ instanceof RegExp) ? s => s.match(matcher_) : matcher_
      let lines = 0
      let count = 0
      let data = new Deque()
      let eos = false
      let first = true
      let stm, reader
      let req = 0 // according to spec, should be 1 or 0
      let promises = []
      let pusher = (val) => {
        if (val === null) {
          if (stm !== undefined) {
            stm.push(null) // signal stream end
          }
          Promise.all(promises).then(resolve, reject)
          return
        } else if (stm === undefined) {
          stm = new LimitedStream(reader); promises.push(f(new this.constructor(stm), count++))
        } else if (isFrom && matcher(val.toString(), lines)) {
          stm.push(null)
          stm = new LimitedStream(reader); promises.push(f(new this.constructor(stm), count++))
        }
        stm.push(val); ++lines
        if (!isFrom && matcher(val.toString(), lines)) {
          stm.push(null)
          stm = new LimitedStream(reader); promises.push(f(new this.constructor(stm), count++))
        }
      }
      reader = () => { if (data.length) { pusher(data.shift()) } else if (eos) { pusher(null) } else { ++req } }

      this.stream.on('data', (chunk) => {
        if (first) { ++req; first = false }
        data.push(chunk)
        while (data.length > 0 && req > 0) {
          pusher(data.shift()); --req
        }
      })
      .on('end', () => {
        eos = true
        if (req > 0) pusher(null) // reader() already called
      })
    }))
  }
  /**
   * Divide content according to the specified criteria.
   * The line that the match succeeds will be the first line of the divided sections.
   * @param  {string|RegExp|matcherCallback}  matcher_ A criteria for division
   * @param  {divideCallback}  f        A callback for each divided section
   * @return {Promise}     A promise object to be resolved when completion of all callback calls or rejection of any
   */
  divideFrom (matcher, f) { return this._divide(true, matcher, f) }
  /**
   * Divide content according to the specified criteria.
   * The line that the match succeeds will be the last line of the divided sections.
   * @param  {string|RegExp|matcherCallback}  matcher_ A criteria for division
   * @param  {divideCallback}  f        A callback for each divided section
   * @return {Promise}     A promise object to be resolved when completion of all callback calls or rejection of any
   */
  divideTo (matcher, f) { return this._divide(false, matcher, f) }
  /**
   * Divide content by line numbers.
   * @param  {integer} num A number of lines for a divided section
   * @param  {divideCallback}  f        A callback for each divided section
   * @return {Promise}     A promise object to be resolved when completion of all callback calls or rejection of any
   */
  divide (num, f) { return this._divide(true, (v, n) => (n % num) === 0, f) }
  // TODO: output to stdout/stderr
  /**
   * Write streamed input to the specified file.
   * @param  {string} path target file path
   * @return {Promise}     a promise object to be resolved when completion
   */
  out (path, opt) {
    return new Promise(_((resolve, reject) => {
      let ws = fs.createWriteStream(path).on('error', reject).on('close', resolve)
      let myopt = Object.assign({ pre: undefined, post: undefined }, opt) // destructuring requires explicit option, prior to Node v6
      if (myopt.pre !== undefined) ws.write(myopt.pre)
      this.stream
        .on('error', (e) => { ws.destroy(e); reject(e) })
        .on('end', _(resolve, reject, () => { if (myopt.post !== undefined) { ws.end(myopt.post) } else { ws.end() } }))
        .pipe(ws, { end: false })
    }))
  }
}

/**
 * Tiny text utilities
 * @module textutils
 * @example
 * const tu = require('textutils')
 * tu.input('input.txt').grep(/foo/).sed(/bar/i, 'zot').out('output.txt')
 *   .then(()=>console.log('success'),(e)=>console.log(e))
 */

module.exports = textutils
