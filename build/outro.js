window['BrowserFS'] = require('./core/browserfs');
require('./backend/localStorage');
require('./backend/dropbox');
require('./backend/html5fs');
require('./backend/in_memory');
require('./backend/mountable_file_system');
require('./backend/XmlHttpRequest');
})();