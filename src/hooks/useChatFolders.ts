import { useState } from 'react';

export function useChatFolders(userId: string | null) {
  const [folders, setFolders] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const createFolder = async (name: string, icon: string) => {};
  const deleteFolder = async (id: string) => {};

  return { folders, createFolder, deleteFolder, loading };
}
