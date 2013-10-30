/*global module:false*/
module.exports = function(grunt) {

  // Project configuration.
  grunt.initConfig({
    // Metadata.
    pkg: grunt.file.readJSON('package.json'),
    banner: '/*! <%= pkg.title || pkg.name %> - v<%= pkg.version %> - ' +
      '<%= grunt.template.today("yyyy-mm-dd") %>\n' +
      '<%= pkg.homepage ? "* " + pkg.homepage + "\\n" : "" %>' +
      '* Copyright (c) <%= grunt.template.today("yyyy") %> <%= pkg.author.name %>;' +
      ' Licensed <%= _.pluck(pkg.licenses, "type").join(", ") %> */\n',
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
        build: {
            src: ["src/**/*.ts"],
            watch: 'src',
            outDir: 'tmp',
            options: {
                sourcemap: true,
                module: 'amd',
                comments: true
            }
        },
    },
    watch: {
      files: 'src/**/*.ts',
      tasks: ['ts', 'karma:unit:run']
    }
  });

  grunt.loadNpmTasks('grunt-ts');
  grunt.loadNpmTasks('grunt-contrib-watch');
  grunt.loadNpmTasks('grunt-contrib-connect');
  grunt.loadNpmTasks('grunt-karma');

  // Default task.
  grunt.registerTask('default', ['connect', 'karma']);

};
