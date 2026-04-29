"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import {
  Doc,
  CreateDocPayload,
  UpdateDocPayload,
  docsService,
} from "@/services/docs.service";
import { useWorkspace } from "@/context/WorkspaceContext";

interface DocsContextValue {
  docs: Doc[];
  isLoading: boolean;
  createDoc: (payload: CreateDocPayload) => Promise<Doc>;
  updateDoc: (id: string, payload: UpdateDocPayload) => Promise<Doc>;
  deleteDoc: (id: string) => Promise<void>;
  refetch: () => Promise<void>;
  upsertLocal: (doc: Doc) => void;
}

const DocsContext = createContext<DocsContextValue | null>(null);

export function DocsProvider({ children }: { children: React.ReactNode }) {
  const { activeWorkspace } = useWorkspace();
  const [docs, setDocs] = useState<Doc[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchDocs = useCallback(async () => {
    if (!activeWorkspace) return;
    setIsLoading(true);
    try {
      const data = await docsService.list({ workspaceId: activeWorkspace.id });
      setDocs(data);
    } catch {
      setDocs([]);
    } finally {
      setIsLoading(false);
    }
  }, [activeWorkspace]);

  useEffect(() => {
    if (!activeWorkspace) {
      setDocs([]);
      return;
    }
    fetchDocs();
  }, [activeWorkspace, fetchDocs]);

  const createDoc = useCallback(async (payload: CreateDocPayload) => {
    const doc = await docsService.create(payload);
    setDocs((prev) => [doc, ...prev]);
    return doc;
  }, []);

  const updateDoc = useCallback(
    async (id: string, payload: UpdateDocPayload) => {
      const doc = await docsService.update(id, payload);
      setDocs((prev) => prev.map((d) => (d.id === id ? doc : d)));
      return doc;
    },
    []
  );

  const deleteDoc = useCallback(async (id: string) => {
    await docsService.delete(id);
    setDocs((prev) => prev.filter((d) => d.id !== id));
  }, []);

  const upsertLocal = useCallback((doc: Doc) => {
    setDocs((prev) => {
      const idx = prev.findIndex((d) => d.id === doc.id);
      if (idx === -1) return [doc, ...prev];
      const next = prev.slice();
      next[idx] = doc;
      return next;
    });
  }, []);

  return (
    <DocsContext.Provider
      value={{
        docs,
        isLoading,
        createDoc,
        updateDoc,
        deleteDoc,
        refetch: fetchDocs,
        upsertLocal,
      }}
    >
      {children}
    </DocsContext.Provider>
  );
}

export function useDocs(): DocsContextValue {
  const ctx = useContext(DocsContext);
  if (!ctx) throw new Error("useDocs must be used within <DocsProvider>");
  return ctx;
}
