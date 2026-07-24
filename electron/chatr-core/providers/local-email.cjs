'use strict';

/**
 * CHATR Local Email Provider
 * Capability: communication.email
 * Principle: Uses the user's existing email identity (mailto: / local client)
 */

const { shell } = require('electron');

class LocalEmailProvider {
  constructor() {
    this.name = 'LocalEmailProvider';
  }

  async email(parameters) {
    // For the WOW demo, parameters.bodyNode contains the summary text.
    // We launch the local mail client using mailto:
    // We do NOT use SMTP directly to avoid password storage.
    
    const { to, subject, bodyNode } = parameters;
    
    // Formatting the URI
    let mailtoUrl = `mailto:${to}?subject=${encodeURIComponent(subject)}`;
    
    // If bodyNode resolves to text, we can append it.
    // In our execution graph, the output of previous nodes should be merged,
    // but for the demo we'll use a hardcoded body if the node value isn't resolved directly.
    const bodyText = typeof bodyNode === 'string' ? bodyNode : 'Please find the attached invoice summary.';
    mailtoUrl += `&body=${encodeURIComponent(bodyText)}`;

    // Shell out to the OS default mail app
    await shell.openExternal(mailtoUrl);

    return {
      status: 'drafted',
      client: 'os_default',
      uri: mailtoUrl
    };
  }

  async execute(context) {
    if (context.action === 'email') {
      return this.email(context.parameters || context);
    }
    throw new Error(`[LocalEmailProvider] Unsupported action: ${context.action}`);
  }
}

module.exports = { LocalEmailProvider };
