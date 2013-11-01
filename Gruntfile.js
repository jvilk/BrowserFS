var fs = require('fs');
var coffee_commands = require('coffee-script/lib/coffee-script/command');
var run_coffeescript = function(script) {
  var argv = process.argv;
  process.argv = ['coffee', script];
  // ASSUMPTION: Synchronous execution.
  coffee_commands.run();
  process.argv = argv;
};

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
            startFile: ['build/intro.js', 'tmp/core/polyfills.js', 'vendor/typedarray.js'],
            endFile: 'build/outro.js'
          },
          out: 'lib/browserfs.js',
          optimize: 'none',
          // generateSourceMaps: true,
          // Need to set to false for source maps to work.
          // preserveLicenseComments: false,
          // List all of the backends you want in your build here.
          include: ['core/browserfs',
                    'backend/dropbox',
                    'backend/html5fs',
                    'backend/in_memory',
                    'backend/localStorage',
                    'backend/mountable_file_system',
                    'backend/XmlHttpRequest']
        }
      }
    }
  });

  grunt.loadNpmTasks('grunt-ts');
  grunt.loadNpmTasks('grunt-contrib-watch');
  grunt.loadNpmTasks('grunt-contrib-connect');
  grunt.loadNpmTasks('grunt-contrib-requirejs');
  grunt.loadNpmTasks('grunt-karma');

  grunt.registerTask('listings', 'Generates listings.json for XmlHttpRequest unit tests.', function() {
    run_coffeescript('tools/XHRIndexer.coffee');
  });

  grunt.registerTask('load_fixtures', 'Generates load_fixtures.js for unit tests.', function() {
    run_coffeescript('tools/FixtureLoaderMaker.coffee');
  });

  grunt.registerTask('cert', 'Generates an SSL certificate, which is required to generate login tokens.', function() {
    // Do not run if the certificate exists.
    if (!fs.existsSync('test/dropbox/cert.pem')) {
      // TODO: Fix.
      // mkdir -p test/dropbox
      // openssl req -new -x509 -days 365 -nodes -batch -out test/dropbox/cert.pem -keyout test/dropbox/cert.pem -subj /O=dropbox.js/OU=Testing/CN=localhost
    }
  });

  grunt.registerTask('tokens', 'Generates a dropbox token for dropboxfs unit tests.', function() {
    var done = this.async();
    // TODO: Fix.
    done();
  });

  // test
  grunt.registerTask('test', ['listings', 'load_fixtures', 'connect', 'karma']);
  // testing dropbox
  grunt.registerTask('dropbox_test', ['listings', 'load_fixtures', 'cert', 'tokens', 'connect', 'karma']);
  // dev build
  grunt.registerTask('dev', ['ts:dev']);
  // dev build + watch for changes.
  grunt.registerTask('watch', ['ts:watch']);
  // release build (default)
  grunt.registerTask('default', ['ts:dev', 'requirejs']);
};
