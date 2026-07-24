import { activityStore, ActivityEntity } from '../storage/stores/ActivityStore';
import { contactStore, ContactEntity } from '../storage/stores/ContactStore';
import { knowledgeGraph } from '../memory/KnowledgeGraph';

export class DataNormalizer {

  public async normalizeGmailMessage(rawMessage: any, accountId: string, providerId: string): Promise<void> {
    // 1. Extract Domain Entities
    const senderEmail = this.extractHeader(rawMessage.payload.headers, 'From');
    const senderName = senderEmail.split('<')[0].trim();
    const cleanEmail = senderEmail.match(/<([^>]+)>/)?.[1] || senderEmail;
    
    const subject = this.extractHeader(rawMessage.payload.headers, 'Subject');
    
    // 2. Normalize to Contact
    const contact: ContactEntity = {
      id: `contact_${cleanEmail}`,
      version: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      providerId,
      name: senderName || cleanEmail,
      email: cleanEmail
    };

    // 3. Normalize to Activity (Email)
    const activity: ActivityEntity = {
      id: `email_${rawMessage.id}`,
      version: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      providerId,
      type: 'email',
      title: subject,
      preview: rawMessage.snippet,
      authorId: contact.id,
      timestamp: parseInt(rawMessage.internalDate),
      metadata: { threadId: rawMessage.threadId, accountId }
    };

    // 4. Persist to Stores (which appends to EventStore internally)
    await contactStore.upsert(contact, providerId);
    await activityStore.upsert(activity, providerId);

    // 5. Build Knowledge Graph Relationships
    await knowledgeGraph.addNode({
      id: contact.id,
      type: 'Person',
      label: contact.name,
      attributes: { email: contact.email }
    });

    await knowledgeGraph.addNode({
      id: activity.id,
      type: 'Email',
      label: activity.title,
      attributes: { preview: activity.preview }
    });

    await knowledgeGraph.addEdge({
      sourceId: contact.id,
      targetId: activity.id,
      relationship: 'SENT'
    });
  }

  private extractHeader(headers: any[], name: string): string {
    const header = headers.find((h: any) => h.name.toLowerCase() === name.toLowerCase());
    return header ? header.value : '';
  }
}

export const dataNormalizer = new DataNormalizer();
