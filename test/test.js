'use strict';

const stream = require('stream'), path = require('path'), fs = require('fs');

const chai = require('chai'), chaiFiles = require('chai-files');
chai.use(chaiFiles);
const expect = chai.expect;
const file = chaiFiles.file;

const textutils = require('../textutils'), tu = textutils;

const INPUT = path.join(__dirname, 'test.md');
const OUTPUT = path.join(__dirname, 'test.out');
const GREP = path.join(__dirname, 'test_grep.md');

describe('textutils', function() {
  afterEach(function() {
    try {
      fs.unlinkSync(OUTPUT);
    } catch(e) {
    }
  });

  describe('cat', function() {
    it('should return textutils class object with stream property', function() {
      let c = tu.cat(INPUT);
      expect(c).to.be.an.instanceof(textutils);
      expect(c).to.have.property('stream');
      expect(c.stream).to.be.an.instanceof(stream);
    });
  });

  describe('out', function() {
    it('should make a file whose contents are the same as recieved', function() {
      return tu.cat(INPUT).out(OUTPUT).then(function() {
        expect(file(OUTPUT)).to.exist;
        expect(file(OUTPUT)).to.equal(file(INPUT));
      });
    });
  });

  describe('pipe', function() {
    it('should make a pipe to the specified Readable stream', function() {
      let ps = new stream.PassThrough();
      return tu.cat(INPUT).pipe(ps).out(OUTPUT).then(function() {
        expect(file(OUTPUT)).to.exist;
        expect(file(OUTPUT)).to.equal(file(INPUT));
      });
    });
    it('should make a pipe to the specified non Readable stream', function(done) {
      let os = fs.createWriteStream(OUTPUT);
      tu.cat(INPUT).pipe(os).on('close', function() {
        expect(file(OUTPUT)).to.exist;
        expect(file(OUTPUT)).to.equal(file(INPUT));
        done();
      });
    });
  });

// tee
// divide_from
// divide_to
// divide

// apply
// map
// spawn

  describe('grep', function() {
    it('should filter content by the specified regex object', function() {
      return tu.cat(INPUT).grep(/1/).out(OUTPUT).then(function() {
        expect(file(OUTPUT)).to.exist;
        expect(file(OUTPUT)).to.equal(file(GREP));
      });
    });
    it('should filter content by the specified regex string', function() {
      return tu.cat(INPUT).grep('1').out(OUTPUT).then(function() {
        expect(file(OUTPUT)).to.exist;
        expect(file(OUTPUT)).to.equal(file(GREP));
      });
    });
  });

// sed
// head
// tail
// sort
// uniq

});
