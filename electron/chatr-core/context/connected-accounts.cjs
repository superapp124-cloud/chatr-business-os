'use strict';

const { identityManager } = require('../identity/IdentityManager.cjs');

class ConnectedAccounts {
  getConnectedAccounts() {
    return identityManager.getAllIdentities();
  }
}

module.exports = new ConnectedAccounts();
