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
const OUTPUT0 = path.join(__dirname, 'test0.out')
const OUTPUT1 = path.join(__dirname, 'test1.out')
const ERROR = path.join(__dirname, 'notexistent/test.out')
const refname = (suf) => path.join(__dirname, `test_${suf}.md`)
const DIV0 = refname('div0')
const DIV1 = refname('div1')
const MAP = refname('map')
const BLANK = refname('blank')
const GREP = refname('grep')
const SED = refname('sed')
const HEAD = refname('head')
const TAIL = refname('tail')
const PRE = refname('pre')
const POST = refname('post')
const PREPOST = refname('prepost')
const SORT = refname('sort')
const DUP = refname('dup')
const UNIQ = refname('uniq')

describe('textutils', function () {
  afterEach(function () {
    try { fs.unlinkSync(OUTPUT) } catch (e) {}
    try { fs.unlinkSync(OUTPUT0) } catch (e) {}
    try { fs.unlinkSync(OUTPUT1) } catch (e) {}
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

  describe('tee', function () {
    it('should split calling chain', function () {
      let promises = []
      promises.push(tu.cat(INPUT).tee(t => promises.push(t.out(OUTPUT0))).out(OUTPUT1))
      return Promise.all(promises).then(function () {
        expect(file(OUTPUT0)).to.exist // eslint-disable-line no-unused-expressions
        expect(file(OUTPUT0)).to.equal(file(INPUT))
        expect(file(OUTPUT1)).to.exist // eslint-disable-line no-unused-expressions
        expect(file(OUTPUT1)).to.equal(file(INPUT))
      })
    })
  })

  describe('divideFrom', function () {
    it('should ouput divided content, whose first line is the line matched to function matcher', function () {
      return tu.cat(INPUT).divideFrom(x => x.match(/6/), (t, count) => t.out(path.join(__dirname, `test${count}.out`))).then(function () {
        expect(file(OUTPUT0)).to.exist // eslint-disable-line no-unused-expressions
        expect(file(OUTPUT0)).to.equal(file(DIV0))
        expect(file(OUTPUT1)).to.exist // eslint-disable-line no-unused-expressions
        expect(file(OUTPUT1)).to.equal(file(DIV1))
      })
    })
    it('should ouput divided content, whose first line is the line matched to regexp matcher', function () {
      return tu.cat(INPUT).divideFrom(/6/, (t, count) => t.out(path.join(__dirname, `test${count}.out`))).then(function () {
        expect(file(OUTPUT0)).to.exist // eslint-disable-line no-unused-expressions
        expect(file(OUTPUT0)).to.equal(file(DIV0))
        expect(file(OUTPUT1)).to.exist // eslint-disable-line no-unused-expressions
        expect(file(OUTPUT1)).to.equal(file(DIV1))
      })
    })
    it('should ouput divided content, whose first line is the line matched to string matcher', function () {
      return tu.cat(INPUT).divideFrom('6', (t, count) => t.out(path.join(__dirname, `test${count}.out`))).then(function () {
        expect(file(OUTPUT0)).to.exist // eslint-disable-line no-unused-expressions
        expect(file(OUTPUT0)).to.equal(file(DIV0))
        expect(file(OUTPUT1)).to.exist // eslint-disable-line no-unused-expressions
        expect(file(OUTPUT1)).to.equal(file(DIV1))
      })
    })
    it('should ouput all content if the match does not occur', function () {
      return tu.cat(INPUT).divideFrom(() => false, (t, count) => t.out(path.join(__dirname, `test${count}.out`))).then(function () {
        expect(file(OUTPUT0)).to.exist // eslint-disable-line no-unused-expressions
        expect(file(OUTPUT0)).to.equal(file(INPUT))
      })
    })
  })

  describe('divideTo', function () {
    it('should ouput divided content, whose last line is the line matched to function matcher', function () {
      return tu.cat(INPUT).divideTo(x => x.match(/5/), (t, count) => t.out(path.join(__dirname, `test${count}.out`))).then(function () {
        expect(file(OUTPUT0)).to.exist // eslint-disable-line no-unused-expressions
        expect(file(OUTPUT0)).to.equal(file(DIV0))
        expect(file(OUTPUT1)).to.exist // eslint-disable-line no-unused-expressions
        expect(file(OUTPUT1)).to.equal(file(DIV1))
      })
    })
    it('should ouput divided content, whose last line is the line matched to regexp matcher', function () {
      return tu.cat(INPUT).divideTo(/5/, (t, count) => t.out(path.join(__dirname, `test${count}.out`))).then(function () {
        expect(file(OUTPUT0)).to.exist // eslint-disable-line no-unused-expressions
        expect(file(OUTPUT0)).to.equal(file(DIV0))
        expect(file(OUTPUT1)).to.exist // eslint-disable-line no-unused-expressions
        expect(file(OUTPUT1)).to.equal(file(DIV1))
      })
    })
    it('should ouput divided content, whose last line is the line matched to string matcher', function () {
      return tu.cat(INPUT).divideTo('5', (t, count) => t.out(path.join(__dirname, `test${count}.out`))).then(function () {
        expect(file(OUTPUT0)).to.exist // eslint-disable-line no-unused-expressions
        expect(file(OUTPUT0)).to.equal(file(DIV0))
        expect(file(OUTPUT1)).to.exist // eslint-disable-line no-unused-expressions
        expect(file(OUTPUT1)).to.equal(file(DIV1))
      })
    })
    it('should ouput all content if the match does not occur', function () {
      return tu.cat(INPUT).divideFrom(() => false, (t, count) => t.out(path.join(__dirname, `test${count}.out`))).then(function () {
        expect(file(OUTPUT0)).to.exist // eslint-disable-line no-unused-expressions
        expect(file(OUTPUT0)).to.equal(file(INPUT))
      })
    })
  })

  describe('divide', function () {
    it('should ouput divided content by the specified line number', function () {
      return tu.cat(INPUT).divide(5, (t, count) => t.out(path.join(__dirname, `test${count}.out`))).then(function () {
        expect(file(OUTPUT0)).to.exist // eslint-disable-line no-unused-expressions
        expect(file(OUTPUT0)).to.equal(file(DIV0))
        expect(file(OUTPUT1)).to.exist // eslint-disable-line no-unused-expressions
        expect(file(OUTPUT1)).to.equal(file(DIV1))
      })
    })
    it('should ouput all content if the match does not occur', function () {
      return tu.cat(INPUT).divide(100, (t, count) => t.out(path.join(__dirname, `test${count}.out`))).then(function () {
        expect(file(OUTPUT0)).to.exist // eslint-disable-line no-unused-expressions
        expect(file(OUTPUT0)).to.equal(file(INPUT))
      })
    })
  })

  describe('apply', function () {
    it('should call the specified function with the resultant stream', function (done) {
      let ws = fs.createWriteStream(OUTPUT)
      tu.cat(INPUT).map(x => ('x' + x).replace(/\n$/, 'x\n')).apply(st => st.pipe(ws))
      ws.on('close', function () {
        expect(file(OUTPUT)).to.exist // eslint-disable-line no-unused-expressions
        expect(file(OUTPUT)).to.equal(file(MAP))
        done()
      })
    })
  })

  describe('map', function () {
    it('should transform content by the specified function', function () {
      return tu.cat(INPUT).map(x => ('x' + x).replace(/\n$/, 'x\n')).out(OUTPUT).then(function () {
        expect(file(OUTPUT)).to.exist // eslint-disable-line no-unused-expressions
        expect(file(OUTPUT)).to.equal(file(MAP))
      })
    })
    it('should remove content if the specified function returns undefined', function () {
      return tu.cat(INPUT).map(x => undefined).out(OUTPUT).then(function () {
        expect(file(OUTPUT)).to.exist // eslint-disable-line no-unused-expressions
        expect(file(OUTPUT)).to.equal(file(BLANK))
      })
    })
    it('should remove content if the specified function returns null', function () {
      return tu.cat(INPUT).map(x => null).out(OUTPUT).then(function () {
        expect(file(OUTPUT)).to.exist // eslint-disable-line no-unused-expressions
        expect(file(OUTPUT)).to.equal(file(BLANK))
      })
    })
  })

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

  describe('sort', function () {
    it('should make sorted output', function () {
      return tu.cat(INPUT).sort().out(OUTPUT).then(function () {
        expect(file(OUTPUT)).to.exist // eslint-disable-line no-unused-expressions
        expect(file(OUTPUT)).to.equal(file(SORT))
      })
    })
  })

  describe('uniq', function () {
    it('should make unique output', function () {
      return tu.cat(DUP).sort().uniq().out(OUTPUT).then(function () {
        expect(file(OUTPUT)).to.exist // eslint-disable-line no-unused-expressions
        expect(file(OUTPUT)).to.equal(file(UNIQ))
      })
    })
  })
})
