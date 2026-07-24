import { SyncProviderAdapter } from '../sync/MailSyncEngine';

export class GoogleAdapter implements SyncProviderAdapter {
  /**
   * Simulates fetching a page of 100 raw emails from Gmail API.
   * In production, this hits: GET https://gmail.googleapis.com/gmail/v1/users/me/messages?pageToken=...
   */
  async fetchPage(accountId: string, accessToken: string, pageToken?: string) {
    try {
      const url = new URL('https://gmail.googleapis.com/gmail/v1/users/me/messages');
      url.searchParams.append('maxResults', '20');
      if (pageToken) url.searchParams.append('pageToken', pageToken);

      const listRes = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      
      if (!listRes.ok) {
        const errorText = await listRes.text();
        console.error('Gmail API Error', errorText);
        throw new Error(`Gmail API Error: ${listRes.status} ${errorText}`);
      }

      const listData = await listRes.json();
      if (!listData.messages) return { messages: [], nextPageToken: undefined };

      const messagePromises = listData.messages.map(async (msg: any) => {
        const msgRes = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject`, {
          headers: { Authorization: `Bearer ${accessToken}` }
        });
        if (!msgRes.ok) return null;
        return msgRes.json();
      });

      const fullMessages = (await Promise.all(messagePromises)).filter(Boolean);

      return {
        messages: fullMessages,
        nextPageToken: listData.nextPageToken
      };
    } catch (e) {
      console.error('Failed to fetch Gmail page', e);
      throw e;
    }
  }

  /**
   * Parses the raw Google API payload into our unified schema.
   */
  parseMessage(raw: any) {
    const getHeader = (name: string) => raw.payload.headers.find((h: any) => h.name === name)?.value || '';
    
    return {
      id: raw.id,
      threadId: raw.threadId,
      sender: getHeader('From'),
      subject: getHeader('Subject'),
      snippet: raw.payload.snippet,
      internalDate: raw.internalDate
    };
  }
}
