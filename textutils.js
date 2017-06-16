'use strict';
const fs = require('fs');
const stream = require('stream');
const child_process = require('child_process');
const split2 = require('split2');
const through2 = require('through2');
const Deque = require('denque');

// TODO: documentation
// TODO: error handling
/**
 * An internal helper class to implement divide()
 * @access protected
 */
const LimitedStream = class extends stream.Readable {
  constructor(reader, opt) {
    super(opt);
    this._read = reader;
  }
};

/**
 * Call rs.pipe(ws) with error propagation from rs to ws
 * @access protected
 * @param  {Stream.Readable} rs A readable stream piped from
 * @param  {Stream.Writable} ws A writable stream piped to
 * @return {Stream.Writable} passed ws itself
 */
const _pipe = (rs, ws) => {
  rs.on('error', (e) => ws.destroy(e));
  return rs.pipe(ws);
};

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
  return ((f) => function(resolve, reject){ try { f(resolve, reject); } catch(e) { reject(e); } })(
    reject !== undefined ? () => f(resolve, reject)
                         : resolve
  )
};

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
 * Almost all methods acts on content line-by-line manner and returns textutils object to enable chaining.
 * @memberof module:textutils
 */
const textutils = class {
  /**
   * @constructor
   * @param  {Stream.Readable} st A readable stream to be holded by the resultant textutils object
   */
  constructor(st) {
    this.stream = st;
  }
  /**
   * A helper method to create a textutils object having the specified stream wrapped by a line-by-line stream
   * @static
   * @param  {Stream.Readable} rs A readable stream to be wrapped
   * @return {textutils}
   */
  static _toline(rs) {
    let left;
    return new this(_pipe(_pipe(rs, split2(/(\r?\n)/)), through2((chunk, enc, cb) => {
      if(chunk.includes('\n')) {
        cb(null, Buffer.concat([left===undefined?new Buffer(0):left, chunk]));
        left = undefined;
      } else {
        cb();
        left = chunk;
      }
    }, function(cb) { if(left !== undefined) this.push(left); cb(); })));
  }
  // TODO: support multiple paths
  /**
   * output contents of the specified path
   * @param  {string} path target file path
   * @return {textutils}   textutils object
   */
  static cat(path) {
    return this._toline(fs.createReadStream(path, { encoding: 'utf8' }));
  }
  /**
   * A helper method to pipe streams, calling _pipe(this.stream, ws)
   * @access protected
   * @param  {Stream.Writable} ws A writable stream piped to
   * @return {Stream.Writable} passed ws itself
   */
  _pipe(ws) {
    return _pipe(this.stream, ws);
  }
  /**
   * A helper method to pipe to a transform stream
   * @access protected
   * @param  {transformCallback} transform A transform callback for transform stream
   * @param  {flushCallback} flush A flush callback for transform stream
   * @return {textutils} A textutils object holding the resultant transform stream
   */
  _tpipe(transform, flush) {
    return new this.constructor(this._pipe(through2(transform, flush)));
  }
  /**
   * A helper method to pipe to a transform stream with a line-by-line stream
   * @access protected
   * @param  {transformCallback} transform A transform callback for transform stream
   * @param  {flushCallback} flush A flush callback for transform stream
   * @return {textutils} A textutils object holding the resultant transform stream
   */
  _tpipe_toline(transform, flush) {
    return this.constructor._toline(this._pipe(through2(transform, flush)));
  }
  /**
   * Filter content by string.match()
   * @param  {RegExp} re passed to string.match()
   * @return {textutils}
   */
  grep(re) {
    return this._tpipe((chunk, enc, cb) => chunk.toString().match(re) ? cb(null, chunk) : cb());
  }
  /**
   * Replace content by string.replace()
   * @param  {RegExp|string} re1 passed as 1st parameter of string.replace()
   * @param  {string|function} re2 passed as 2nd parameter of string.replace()
   * @return {textutils}
   */
  sed(re1, re2) {
    return this._tpipe((chunk, enc, cb) => cb(null, Buffer.from(chunk.toString().replace(re1, re2))));
  }
  /**
   * Output the first specified number of lines
   * @param  {integer} num Number of lines
   * @return {textutils}
   */
  head(num) {
    return this._tpipe((chunk, enc, cb) => num-->0?cb(null,chunk):cb());
  }
  /**
   * Output the last specified number of lines
   * @param  {integer} num Number of lines
   * @return {textutils}
   */
  tail(num) {
    let buf = new Deque();
    return this._tpipe(
      (chunk, enc, cb) => { if(buf.length === num) buf.shift(); buf.push(chunk); cb(); },
      function(cb) { for(let val of buf) { this.push(val); } cb(); });
  }
  /**
   * Output the specified header and footer around content
   * @param  {Buffer|string} pre A header content
   * @param  {Buffer|string} post A footer content
   * @return {textutils}
   */
  prepost(pre, post) {
    let predone = false;
    return this._tpipe_toline(
      function(chunk, enc, cb) { if(!predone) { predone=true; if(pre!==undefined) { this.push(pre); } } cb(null, chunk); },
      function(cb) { if(post!==undefined) { this.push(post)} cb(); }
    );
  }
  /**
   * Output content with the specified header
   * @param  {Buffer|string} pre A header content
   * @return {textutils}
   */
  pre(pre) { return this.prepost(pre); }
  /**
   * Output content with the specified footer
   * @param  {Buffer|string} post A footer content
   * @return {textutils}
   */
  post(post) { return this.prepost(undefined, post); }
  // TODO: method to skip lines
  /**
   * @callback mapCallback
   * @param {string} s An input line
   * @return {?string} An output line
   */
  /**
   * Output content mapped by the specified filter function
   * @param {mapCallback} f A filter function called for each line. If it returns null or undefined, the line is ignored.
   */
  map(f) {
    return this._tpipe((chunk, enc, cb) => { let ret = f(chunk.toString()); if(ret === undefined || ret === null) cb(); else cb(null, Buffer.from(ret)) });
  }
  // FIXME: naive implementation
  // TODO: key extractor
  // TODO: comparator
  sort() {
    let data = [];
    return this._tpipe((chunk, enc, cb) => { data.push(chunk); cb(); },
      function(cb) { data.sort(); for(let val of data) this.push(val); cb(); }
    );
  }
  // TODO: key extractor
  // TODO: comparator
  uniq() {
    let data;
    return this._tpipe(function(chunk, enc, cb) {
        if(data === undefined) data = chunk
        else if (!data.equals(chunk)) { this.push(data); data = chunk; }
        cb();
      },
      function(cb) { if(data !== undefined) this.push(data); cb(); }
    );
  }
  spawn(command, args, options) {
    let ret;
    options = Object.assign({}, options);
    options.stdio = [ 'pipe', 'pipe', 'ignore' ]; // TODO: binding with stderr
    let ch = child_process.spawn(command, args, options);
    ch.on('error', (e) => ret.stream.destroy(e));
    this.stream.on('end', () => this.stream.unpipe());
    this._pipe(ch.stdin);
    return ret = this.constructor._toline(ch.stdout);
  }
  pipe(ws) {
    let out = this._pipe(ws);
    // stdout and stderr are Duplex streams
    if(ws !== process.stdout && ws !== process.stderr && ws instanceof stream.Readable)
      return this.constructor._toline(out);
     else
      return out;
  }
  apply(f) {
    return f(this.stream);
  }
  tee(f) {
    f(this); return this;
  }
  _divide(is_from, matcher_, f) {
// TODO: error handling check
    return new Promise(_((resolve, reject) => {
      let matcher = (typeof matcher_ === 'string' || matcher_ instanceof RegExp) ? s => s.match(matcher_) : matcher_;
      let lines = 0, count = 0, data = new Deque(), eos = false, stm, reader, first = true;
      let req = 0; // according to spec, should be 1 or 0
      let pusher = (val) => {
        if(val === null) {
          if(stm !== undefined) {
            stm.push(null); // signal stream end
          }
          resolve(); // signal end
        } else if(stm === undefined) {
          stm = new LimitedStream(reader); f(new this.constructor(stm), count++);
        } else if(is_from && matcher(val.toString(), lines)) {
          stm.push(null);
          stm = new LimitedStream(reader); f(new this.constructor(stm), count++);
        }
        stm.push(val); ++lines;
        if(!is_from && matcher(val.toString(), lines)) {
          stm.push(null);
          stm = new LimitedStream(reader); f(new this.constructor(stm), count++);
        }
      };
      reader = () => { if(data.length) pusher(data.shift()); else if(eos) pusher(null); else ++req; };

      this.stream.on('data', (chunk) => {
        if(first) { ++req; first = false; }
        data.push(chunk);
        while(data.length>0 && req>0) {
          pusher(data.shift()); --req;
        }
      })
      .on('end', () => {
        eos = true;
        if(req>0) pusher(null); // reader() already called
      });
    }));
  }
  divide_from(matcher, f) { return this._divide(true, matcher, f); }
  divide_to(matcher, f) { return this._divide(false, matcher, f); }
  divide(num, f) { return this._divide(true, (v,n) => n%num==0, f); }
  // TODO: output to stdout/stderr
  /**
   * write streamed input to the specified file
   * @param  {string} path target file path
   * @return {Promise}     a promise object to be resolved when completion
   */
  out(path, opt) {
    return new Promise(_((resolve, reject) => {
      let ws = fs.createWriteStream(path).on('error', reject).on('close', resolve);
      let { pre, post } = Object.assign({pre:undefined,post:undefined}, opt);
      if(pre !== undefined) ws.write(pre)
      this.stream
        .on('error', (e) => { ws.destroy(e); reject(e); })
        .on('end', _(resolve, reject, () => { if(post !== undefined) ws.end(post); else ws.end(); }))
        .pipe(ws, { end: false });
    }));
  }
};

/**
 * Tiny text utilities
 * @module textutils
 * @example
 * const tu = require('textutils');
 * tu.input('input.txt').grep(/foo/).sed(/bar/i, 'zot').out('output.txt')
 *   .then(()=>console.log('success'),(e)=>console.log(e));
 */

module.exports = textutils;
