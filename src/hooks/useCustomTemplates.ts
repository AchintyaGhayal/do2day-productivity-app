import { useState, useEffect, useCallback } from 'react';

export interface CustomTemplate {
  id: string;
  name: string;
  iconEmoji: string;
  content: string;
  createdAt: number;
}

const STORAGE_KEY = 'flowday_custom_templates';

function loadTemplates(): CustomTemplate[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveTemplates(templates: CustomTemplate[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(templates));
}

export function useCustomTemplates() {
  const [templates, setTemplates] = useState<CustomTemplate[]>(loadTemplates);

  // Sync to localStorage whenever templates change, but also save synchronously
  // in mutators to avoid race conditions with component unmounting
  useEffect(() => {
    saveTemplates(templates);
  }, [templates]);

  const addTemplate = useCallback((name: string, content: string, iconEmoji = '📄') => {
    const newTemplate: CustomTemplate = {
      id: crypto.randomUUID(),
      name: name.trim() || 'Untitled Template',
      iconEmoji,
      content,
      createdAt: Date.now(),
    };
    setTemplates(prev => {
      const updated = [...prev, newTemplate];
      saveTemplates(updated); // Save synchronously before potential unmount
      return updated;
    });
    return newTemplate;
  }, []);

  const deleteTemplate = useCallback((id: string) => {
    setTemplates(prev => {
      const updated = prev.filter(t => t.id !== id);
      saveTemplates(updated);
      return updated;
    });
  }, []);

  const updateTemplate = useCallback((id: string, updates: Partial<Pick<CustomTemplate, 'name' | 'content' | 'iconEmoji'>>) => {
    setTemplates(prev => {
      const updated = prev.map(t => t.id === id ? { ...t, ...updates } : t);
      saveTemplates(updated);
      return updated;
    });
  }, []);

  return { templates, addTemplate, deleteTemplate, updateTemplate };
}
