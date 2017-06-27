'use strict'
/* eslint-env mocha */

const stream = require('stream')
const path = require('path')
const fs = require('fs')

const chai = require('chai')
const chaiFiles = require('chai-files')
const chaiAsPromised = require('chai-as-promised')
chai.use(chaiFiles)
chai.use(chaiAsPromised)
const expect = chai.expect
const file = chaiFiles.file

const textutils = require('../textutils')
const tu = textutils

const INPUT = path.join(__dirname, 'test.md')
const OUTPUT = path.join(__dirname, 'test.out')
const ERROR = path.join(__dirname, 'notexistent/test.out')
const GREP = path.join(__dirname, 'test_grep.md')
const SED = path.join(__dirname, 'test_sed.md')
const PRE = path.join(__dirname, 'test_pre.md')
const POST = path.join(__dirname, 'test_post.md')
const PREPOST = path.join(__dirname, 'test_prepost.md')

describe('textutils', function () {
  afterEach(function () {
    try {
      fs.unlinkSync(OUTPUT)
    } catch (e) {
    }
  })

  describe('cat', function () {
    it('should return textutils class object with stream property', function () {
      let c = tu.cat(INPUT)
      expect(c).to.be.an.instanceof(textutils)
      expect(c).to.have.property('stream')
      expect(c.stream).to.be.an.instanceof(stream)
    })
  })

  describe('out', function () {
    it('should make a file whose contents are the same as recieved', function () {
      return tu.cat(INPUT).out(OUTPUT).then(function () {
        expect(file(OUTPUT)).to.exist // eslint-disable-line no-unused-expressions
        expect(file(OUTPUT)).to.equal(file(INPUT))
      })
    })
    it('should make a file whose contents are the same as recieved, with specified prefix', function () {
      return tu.cat(INPUT).out(OUTPUT, { pre: 'pre\npre\npre\n' }).then(function () {
        expect(file(OUTPUT)).to.exist // eslint-disable-line no-unused-expressions
        expect(file(OUTPUT)).to.equal(file(PRE))
      })
    })
    it('should make a file whose contents are the same as recieved, with specified suffix', function () {
      return tu.cat(INPUT).out(OUTPUT, { post: 'post\npost\npost\n' }).then(function () {
        expect(file(OUTPUT)).to.exist // eslint-disable-line no-unused-expressions
        expect(file(OUTPUT)).to.equal(file(POST))
      })
    })
    it('should make a file whose contents are the same as recieved, with specified prefix and suffix', function () {
      return tu.cat(INPUT).out(OUTPUT, { pre: 'pre\npre\npre\n', post: 'post\npost\npost\n' }).then(function () {
        expect(file(OUTPUT)).to.exist // eslint-disable-line no-unused-expressions
        expect(file(OUTPUT)).to.equal(file(PREPOST))
      })
    })
    it('should make a promise to be rejected with invalid path name', function () {
      return expect(tu.cat(INPUT).out(ERROR)).to.be.rejectedWith(Error, 'ENOENT: no such file or directory')
    })
    it('should make a promise to be rejected with cat() by invalid path name', function () {
      return expect(tu.cat(ERROR).out(OUTPUT)).to.be.rejectedWith(Error, 'ENOENT: no such file or directory')
    })
  })

  describe('pipe', function () {
    it('should make a pipe to the specified Readable stream', function () {
      let ps = new stream.PassThrough()
      return tu.cat(INPUT).pipe(ps).out(OUTPUT).then(function () {
        expect(file(OUTPUT)).to.exist // eslint-disable-line no-unused-expressions
        expect(file(OUTPUT)).to.equal(file(INPUT))
      })
    })
    it('should make a pipe to the specified non Readable stream', function (done) {
      let os = fs.createWriteStream(OUTPUT)
      tu.cat(INPUT).pipe(os).on('close', function () {
        expect(file(OUTPUT)).to.exist // eslint-disable-line no-unused-expressions
        expect(file(OUTPUT)).to.equal(file(INPUT))
        done()
      })
    })
  })

// tee
// divide_from
// divide_to
// divide

// apply
// map

  describe('spawn', function () {
    it('should invoke external command', function () {
      return tu.cat(INPUT).spawn('node', ['-e', 'process.stdin.pipe(process.stdout)']).out(OUTPUT).then(function () {
        expect(file(OUTPUT)).to.exist // eslint-disable-line no-unused-expressions
        expect(file(OUTPUT)).to.equal(file(INPUT))
      })
    })
    it('should deliver error of invoking external command', function () {
      return expect(tu.cat(INPUT).spawn('_not_existent_').out(OUTPUT)).to.be.rejectedWith(Error, 'spawn _not_existent_ ENOENT')
    })
  })

  describe('grep', function () {
    it('should filter content by the specified regex object', function () {
      return tu.cat(INPUT).grep(/1/).out(OUTPUT).then(function () {
        expect(file(OUTPUT)).to.exist // eslint-disable-line no-unused-expressions
        expect(file(OUTPUT)).to.equal(file(GREP))
      })
    })
    it('should filter content by the specified regex string', function () {
      return tu.cat(INPUT).grep('1').out(OUTPUT).then(function () {
        expect(file(OUTPUT)).to.exist // eslint-disable-line no-unused-expressions
        expect(file(OUTPUT)).to.equal(file(GREP))
      })
    })
  })

  describe('sed', function () {
    it('should filter content by the specified old string and new string', function () {
      return tu.cat(INPUT).sed('1', 'i').out(OUTPUT).then(function () {
        expect(file(OUTPUT)).to.exist // eslint-disable-line no-unused-expressions
        expect(file(OUTPUT)).to.equal(file(SED))
      })
    })
    it('should filter content by the specified regex and function', function () {
      return tu.cat(INPUT).sed(/1/, () => 'i').out(OUTPUT).then(function () {
        expect(file(OUTPUT)).to.exist // eslint-disable-line no-unused-expressions
        expect(file(OUTPUT)).to.equal(file(SED))
      })
    })
  })

  describe('head', function () {
    it('should ouput the first specified number of lines', function () {
      return tu.cat(INPUT).head(5).out(OUTPUT).then(function () {
        expect(file(OUTPUT)).to.exist // eslint-disable-line no-unused-expressions
        expect(file(OUTPUT)).to.equal(file(HEAD))
      })
    })
    it('should ouput all content if the specified line number exceeds actual', function () {
      return tu.cat(INPUT).head(12).out(OUTPUT).then(function () {
        expect(file(OUTPUT)).to.exist // eslint-disable-line no-unused-expressions
        expect(file(OUTPUT)).to.equal(file(INPUT))
      })
    })
  })

  describe('tail', function () {
    it('should ouput the last specified number of lines', function () {
      return tu.cat(INPUT).tail(5).out(OUTPUT).then(function () {
        expect(file(OUTPUT)).to.exist // eslint-disable-line no-unused-expressions
        expect(file(OUTPUT)).to.equal(file(TAIL))
      })
    })
    it('should ouput all content if the specified line number exceeds actual', function () {
      return tu.cat(INPUT).tail(12).out(OUTPUT).then(function () {
        expect(file(OUTPUT)).to.exist // eslint-disable-line no-unused-expressions
        expect(file(OUTPUT)).to.equal(file(INPUT))
      })
    })
  })

  describe('prepost', function () {
    it('should make a file whose contents are the same as recieved without specifying pre/post', function () {
      return tu.cat(INPUT).prepost().out(OUTPUT).then(function () {
        expect(file(OUTPUT)).to.exist // eslint-disable-line no-unused-expressions
        expect(file(OUTPUT)).to.equal(file(INPUT))
      })
    })
    it('should make a file whose contents are the same as recieved, with specified prefix', function () {
      return tu.cat(INPUT).prepost('pre\npre\npre\n').out(OUTPUT).then(function () {
        expect(file(OUTPUT)).to.exist // eslint-disable-line no-unused-expressions
        expect(file(OUTPUT)).to.equal(file(PRE))
      })
    })
    it('should make a file whose contents are the same as recieved, with specified suffix', function () {
      return tu.cat(INPUT).prepost(undefined, 'post\npost\npost\n').out(OUTPUT).then(function () {
        expect(file(OUTPUT)).to.exist // eslint-disable-line no-unused-expressions
        expect(file(OUTPUT)).to.equal(file(POST))
      })
    })
    it('should make a file whose contents are the same as recieved, with specified prefix and suffix', function () {
      return tu.cat(INPUT).prepost('pre\npre\npre\n', 'post\npost\npost\n').out(OUTPUT).then(function () {
        expect(file(OUTPUT)).to.exist // eslint-disable-line no-unused-expressions
        expect(file(OUTPUT)).to.equal(file(PREPOST))
      })
    })
  })

  describe('pre', function () {
    it('should make a file whose contents are the same as recieved without specifying pre/post', function () {
      return tu.cat(INPUT).pre().out(OUTPUT).then(function () {
        expect(file(OUTPUT)).to.exist // eslint-disable-line no-unused-expressions
        expect(file(OUTPUT)).to.equal(file(INPUT))
      })
    })
    it('should make a file whose contents are the same as recieved, with specified prefix', function () {
      return tu.cat(INPUT).pre('pre\npre\npre\n').out(OUTPUT).then(function () {
        expect(file(OUTPUT)).to.exist // eslint-disable-line no-unused-expressions
        expect(file(OUTPUT)).to.equal(file(PRE))
      })
    })
  })

  describe('post', function () {
    it('should make a file whose contents are the same as recieved without specifying pre/post', function () {
      return tu.cat(INPUT).post().out(OUTPUT).then(function () {
        expect(file(OUTPUT)).to.exist // eslint-disable-line no-unused-expressions
        expect(file(OUTPUT)).to.equal(file(INPUT))
      })
    })
    it('should make a file whose contents are the same as recieved, with specified suffix', function () {
      return tu.cat(INPUT).post('post\npost\npost\n').out(OUTPUT).then(function () {
        expect(file(OUTPUT)).to.exist // eslint-disable-line no-unused-expressions
        expect(file(OUTPUT)).to.equal(file(POST))
      })
    })
  })

// sort
// uniq
})
