// Configuration file for RequireJS's optimizer.
({
    // The output of the TypeScript compiler goes into this directory.
    baseUrl: 'tmp',
    // The main module that installs the BrowserFS global and needed polyfills.
    name: '../vendor/almond/almond',
    wrap: {
      startFile: ['build/intro.js', 'tmp/core/polyfills.js', 'vendor/typedarray.js'],
      endFile: 'build/outro.js'
    },
    out: 'lib/browserfs.js',
    optimize: 'uglify2',
    generateSourceMaps: true,
    preserveLicenseComments: false,
    // List all of the backends you want in your build here.
    include: ['core/browserfs',
              'backend/dropbox',
              'backend/html5fs',
              'backend/in_memory',
              'backend/localStorage',
              'backend/mountable_file_system',
              'backend/XmlHttpRequest']
})
