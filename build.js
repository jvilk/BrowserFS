// Configuration file for RequireJS's optimizer.
({
    // The output of the TypeScript compiler goes into this directory.
    baseUrl: 'tmp',
    // The main module that installs the BrowserFS global and needed polyfills.
    name: 'core/install_globals',
    out: 'lib/browserfs.js',
    // List all of the backends you want in your build here.
    include: ['../vendor/setImmediate',
              '../vendor/typedarray',
              '../vendor/async/lib/async.js',
              'backend/dropbox',
              'backend/html5fs',
              'backend/in_memory',
              'backend/localStorage',
              'backend/mountable_file_system',
              'backend/XmlHttpRequest']
})
