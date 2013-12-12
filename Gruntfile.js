var fs = require('fs');
var path = require('path');

// Removes a directory if it exists.
// Throws an exception if deletion fails.
function removeDir(dir) {
  if (fs.existsSync(dir) && fs.statSync(dir).isDirectory()) {
    // Delete its contents, since you can't delete non-empty folders.
    // :(
    var files = fs.readdirSync(dir);
    for (var i = 0; i < files.length; i++) {
      var fname = dir + path.sep + files[i];
      if (fs.statSync(fname).isDirectory()) {
        removeDir(fname);
      } else {
        removeFile(fname);
      }
    }
    fs.rmdirSync(dir);
  }
}

// Removes a file if it exists.
// Throws an exception if deletion fails.
function removeFile(file) {
  if (fs.existsSync(file) && fs.statSync(file).isFile()) {
    fs.unlinkSync(file);
  }
}

module.exports = function(grunt) {
  grunt.initConfig({
    // Metadata.
    pkg: grunt.file.readJSON('package.json'),
    connect: {
      server: {
        options: {
          keepalive: false
        }
      }
    },
    karma: {
      unit: {
        configFile: 'build/karma.conf.js'
      }
    },
    ts: {
      options: {
        sourcemap: true,
        module: 'amd',
        comments: true
      },
      dev: {
        src: ["src/**/*.ts"],
        outDir: 'tmp'
      },
      watch: {
        // Performs a dev build and rebuilds when changes are made.
        src: ["src/**/*.ts"],
        outDir: 'tmp',
        watch: 'src'
      }
    },
    requirejs: {
      compile: {
        options: {
          // The output of the TypeScript compiler goes into this directory.
          baseUrl: 'tmp',
          // The main module that installs the BrowserFS global and needed polyfills.
          name: '../vendor/almond/almond',
          wrap: {
            startFile: ['build/intro.js', 'tmp/core/polyfills.js'],
            endFile: 'build/outro.js'
          },
          out: 'lib/browserfs.js',
          optimize: 'uglify2',
          generateSourceMaps: true,
          // Need to set to false for source maps to work.
          preserveLicenseComments: false,
          // List all of the backends you want in your build here.
          include: ['core/browserfs',
                    'backend/dropbox',
                    'backend/html5fs',
                    'backend/in_memory',
                    'backend/localStorage',
                    'backend/mountable_file_system',
                    'backend/XmlHttpRequest',
                    'backend/zipfs',
                    'generic/emscripten_fs'],
          shim: {
            'vendor/zlib.js/rawinflate.min': {
              exports: 'Zlib.RawInflate'
            }
          }
        }
      }
    },
    shell: {
      gen_cert: {
        command: [
          // Short circuit if the certificate exists.
          'test ! -e test/dropbox/cert.pem',
          'mkdir -p test/dropbox',
          'openssl req -new -x509 -days 365 -nodes -batch -out test/dropbox/cert.pem -keyout test/dropbox/cert.pem -subj /O=dropbox.js/OU=Testing/CN=localhost'
        ].join('&&')
      },
      gen_token: {
        command: './node_modules/.bin/coffee tools/get_db_credentials.coffee'
      },
      load_fixtures: {
        command: './node_modules/.bin/coffee tools/FixtureLoaderMaker.coffee'
      },
      gen_listings: {
        command: './node_modules/.bin/coffee tools/XHRIndexer.coffee',
        options: {
          callback: function(err, stdout, stderr, cb) {
            if (err) throw err;
            // Write listings to a file.
            fs.writeFileSync('./listings.json', stdout);
            cb();
          }
        }
      },
      gen_zipfs_fixtures: {
        command: './node_modules/.bin/coffee tools/ZipFixtureMaker.coffee'
      }
    }
  });

  grunt.loadNpmTasks('grunt-ts');
  grunt.loadNpmTasks('grunt-contrib-watch');
  grunt.loadNpmTasks('grunt-contrib-connect');
  grunt.loadNpmTasks('grunt-contrib-requirejs');
  grunt.loadNpmTasks('grunt-karma');
  grunt.loadNpmTasks('grunt-shell');

  grunt.registerTask('clean', 'Removes all built files.', function() {
    removeFile('./listings.json');
    removeFile('./lib/browserfs.js');
    removeFile('./lib/browserfs.js.map');
    removeFile('./lib/load_fixtures.js');
    removeDir('./tmp');
    removeDir('./test/dropbox');
  });

  // test
  grunt.registerTask('test', ['ts:dev', 'shell:gen_zipfs_fixtures', 'shell:gen_listings', 'shell:load_fixtures', 'connect', 'karma']);
  // testing dropbox
  grunt.registerTask('dropbox_test', ['ts:dev', 'shell:gen_zipfs_fixtures', 'shell:gen_listings', 'shell:load_fixtures', 'shell:gen_cert', 'shell:gen_token', 'connect', 'karma']);
  // dev build
  grunt.registerTask('dev', ['ts:dev']);
  // dev build + watch for changes.
  grunt.registerTask('watch', ['ts:watch']);
  // release build (default)
  grunt.registerTask('default', ['ts:dev', 'requirejs']);
  // testling
  grunt.registerTask('testling', ['default', 'shell:gen_listings', 'shell:gen_zipfs_fixtures', 'shell:load_fixtures']);
};
