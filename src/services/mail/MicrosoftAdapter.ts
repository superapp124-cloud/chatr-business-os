import { SyncProviderAdapter } from '../sync/MailSyncEngine';

export class MicrosoftAdapter implements SyncProviderAdapter {
  /**
   * Simulates fetching a page of 100 raw emails from Microsoft Graph API using Delta queries.
   * In production, this hits: GET https://graph.microsoft.com/v1.0/me/mailFolders/inbox/messages/delta
   */
  async fetchPage(accountId: string, accessToken: string, pageToken?: string) {
    try {
      let urlStr = 'https://graph.microsoft.com/v1.0/me/messages?$select=id,conversationId,sender,subject,bodyPreview,receivedDateTime&$top=20';
      if (pageToken) urlStr = pageToken; // Microsoft Graph uses full @odata.nextLink as pageToken

      const res = await fetch(urlStr, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });

      if (!res.ok) {
        console.error('Microsoft Graph API Error', await res.text());
        return { messages: [] };
      }

      const data = await res.json();
      return {
        messages: data.value || [],
        nextPageToken: data['@odata.nextLink']
      };
    } catch (e) {
      console.error('Failed to fetch Microsoft Graph page', e);
      return { messages: [] };
    }
  }

  /**
   * Parses the raw Microsoft Graph API payload into our unified schema.
   */
  parseMessage(raw: any) {
    return {
      id: raw.id,
      threadId: raw.conversationId,
      sender: raw.sender.emailAddress.address,
      subject: raw.subject,
      snippet: raw.bodyPreview,
      internalDate: new Date(raw.receivedDateTime).getTime()
    };
  }
}
