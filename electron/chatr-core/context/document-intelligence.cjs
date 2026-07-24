'use strict';

const log = (() => {
  try { return require('electron-log'); } catch { return console; }
})();

class DocumentIntelligence {
  initialize() {
    log.info('[DocumentIntelligence] Initializing lightweight watcher for recent documents...');
    // Real implementation would attach an OS-level file watcher (e.g. chokidar)
    // to the 'Recent Files' MRU lists or actively focused folders.
  }

  getRecentDocuments() {
    return [
      { name: 'Invoice_ABC.pdf', path: 'C:\\Users\\Arshid.Wani\\Documents\\Invoice_ABC.pdf', lastAccessed: Date.now() },
      { name: 'Arshid_Resume.docx', path: 'C:\\Users\\Arshid.Wani\\Documents\\Arshid_Resume.docx', lastAccessed: Date.now() - 3600000 }
    ];
  }
}

module.exports = new DocumentIntelligence();
