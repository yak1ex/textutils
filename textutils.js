'use strict';
const fs = require('fs');
const stream = require('stream');
const child_process = require('child_process');
const split2 = require('split2');
const through2 = require('through2');
const Deque = require('denque');

// TODO: documentation
// TODO: error handling
/** Internal helper class */
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
 * @return {Stream.Writable}    ws
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
 * @param  {rejectCallback} [reject]  A reject callback of a promise for 3-parameter call
 * @param  {Executor} [f]       An executor for 3-parameter call
 * @return {Executor}         Actual valid arguments of returned function depends on calling parameter.
 * @example
 * // Throwing exeception in the callback causes calling reject(exception)
 * // Acutually, callback is called with cb(resolve, reject), however, resolve and reject are accessible for typical cases.
 * new Promise((resolve, reject) => {
 *   EventEmitter.on('event', _(resolve, reject, () => { ... })); }
 * @example
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

/** Tiny text utilities */
const textutils = class {
  constructor(st) {
    this.stream = st;
  }
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
  // TODO: multiple paths
  /**
   * output contents of the specified path
   * @param  {string} path target file path
   * @return {textutils}   textutils object
   */
  static cat(path) {
    return this._toline(fs.createReadStream(path, { encoding: 'utf8' }));
  }
  _pipe(ws) {
    return _pipe(this.stream, ws);
  }
  _tpipe(transform, flush) {
    return new this.constructor(this._pipe(through2(transform, flush)));
  }
  _tpipe_toline(transform, flush) {
    return this.constructor._toline(this._pipe(through2(transform, flush)));
  }
  grep(re) {
    return this._tpipe((chunk, enc, cb) => chunk.toString().match(re) ? cb(null, chunk) : cb());
  }
  sed(re1, re2) {
    return this._tpipe((chunk, enc, cb) => cb(null, Buffer.from(chunk.toString().replace(re1, re2))));
  }
  head(num) {
    return this._tpipe((chunk, enc, cb) => num-->0?cb(null,chunk):cb());
  }
  tail(num) {
    let buf = new Deque();
    return this._tpipe(
      (chunk, enc, cb) => { if(buf.length === num) buf.shift(); buf.push(chunk); cb(); },
      function(cb) { for(let val of buf) { this.push(val); } cb(); });
  }
  prepost(pre, post) {
    let predone = false;
    return this._tpipe_toline(
      function(chunk, enc, cb) { if(!predone) { predone=true; if(pre!==undefined) { this.push(pre); } } cb(null, chunk); },
      function(cb) { if(post!==undefined) { this.push(post)} cb(); }
    );
  }
  pre(pre) { return this.prepost(pre); }
  post(post) { return this.prepost(undefined, post); }
  // TODO: skip line
  map(f) {
    return this._tpipe((chunk, enc, cb) => { let ret = f(chunk.toString()); if(ret === undefined) cb(); else cb(null, Buffer.from(ret)) });
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
    options = Object.assign({}, options);
    options.stdio = [ 'pipe', 'pipe', 'ignore' ]; // TODO: binding with stderr
    let ch = child_process.spawn(command, args, options);
    this.stream.pause();
    this._pipe(ch.stdin);
    this.stream.on('end', () => this.stream.unpipe());
    this.stream.resume();
    // FIXME: error handling
    return this.constructor._toline(ch.stdout);
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
 */

/** textutils class */
module.exports = textutils;
