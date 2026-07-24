import type { ChatrAIToolDefinition, ChatrAIToolSurface } from './types';

export class ChatrAIToolRegistry {
  private tools = new Map<string, ChatrAIToolDefinition>();

  register(tool: ChatrAIToolDefinition): void {
    this.tools.set(tool.id, tool);
  }

  registerMany(tools: ChatrAIToolDefinition[]): void {
    tools.forEach((tool) => this.register(tool));
  }

  get(toolId: string): ChatrAIToolDefinition | undefined {
    return this.tools.get(toolId);
  }

  list(): ChatrAIToolDefinition[] {
    return Array.from(this.tools.values()).sort((a, b) => a.name.localeCompare(b.name));
  }

  listForSurface(surface: ChatrAIToolSurface): ChatrAIToolDefinition[] {
    return this.list().filter((tool) => tool.surfaces.includes(surface) || tool.surfaces.includes('system'));
  }

  listRequiringApproval(): ChatrAIToolDefinition[] {
    return this.list().filter((tool) => tool.requiresApproval);
  }
}

export const chatrAIToolRegistry = new ChatrAIToolRegistry();
