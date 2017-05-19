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

/** Tiny text utilities */
const textutils = class {
  constructor(st) {
    this.stream = st;
  }
  static _toline(rs) {
    let left;
    return new this(rs
      .pipe(split2(/(\r?\n)/))
      .pipe(through2((chunk, enc, cb) => {
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
  _pipe(transform, flush) {
    return new this.constructor(this.stream.pipe(through2(transform, flush)));
  }
  grep(re) {
    return this._pipe((chunk, enc, cb) => chunk.toString().match(re) ? cb(null, chunk) : cb());
  }
  sed(re1, re2) {
    return this._pipe((chunk, enc, cb) => cb(null, Buffer.from(chunk.toString().replace(re1, re2))));
  }
  head(num) {
    return this._pipe((chunk, enc, cb) => num-->0?cb(null,chunk):cb());
  }
  tail(num) {
    let buf = new Deque();
    return this._pipe(
      (chunk, enc, cb) => { if(buf.length === num) buf.shift(); buf.push(chunk); cb(); },
      function(cb) { for(let val of buf) { this.push(val); } cb(); });
  }
  // TODO: skip line
  map(f) {
    return this._pipe((chunk, enc, cb) => { let ret = f(chunk.toString()); if(ret === undefined) cb(); else cb(null, Buffer.from(ret)) });
  }
  // FIXME: naive implementation
  // TODO: key extractor
  // TODO: comparator
  sort() {
    let data = [];
    return this._pipe((chunk, enc, cb) => { data.push(chunk); cb(); },
      function(cb) { data.sort(); for(let val of data) this.push(val); cb(); }
    );
  }
  // TODO: key extractor
  // TODO: comparator
  uniq() {
    let data;
    return this._pipe(function(chunk, enc, cb) {
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
    this.stream.pipe(ch.stdin);
    this.stream.on('end', () => this.stream.unpipe());
    this.stream.resume();
    // FIXME: error handling
    return this.constructor._toline(ch.stdout);
  }
  pipe(ws) {
    let out = this.stream.pipe(ws);
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
    return new Promise((resolve, reject) => {
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
    });
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
  out(path) {
    return new Promise((resolve, reject) =>
      this.stream.pipe(fs.createWriteStream(path)).on('close', () => setImmediate(resolve)));
  }
};

/**
 * Tiny text utilities
 * @module textutils
 */

/** textutils class */
module.exports = textutils;
