"use client";

import { useState } from "react";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { makeQueryClient } from "@/lib/queryClient";
import { createIDBPersister, QUERY_CACHE_BUSTER } from "@/lib/queryPersister";

// Only task/list/board-related queries are persisted across a browser refresh.
// Everything else (auth, profile, university, etc.) stays in-memory only.
const PERSISTED_KEY_PREFIXES = new Set([
  "projects",
  "task-lists",
  "task-board",
  "task-board-infinite",
  "statuses",
  "workspace-members",
  "tags",
  "my-tasks",
]);

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [client] = useState(makeQueryClient);
  const [persister] = useState(() => createIDBPersister());

  return (
    <PersistQueryClientProvider
      client={client}
      persistOptions={{
        persister,
        maxAge: 1000 * 60 * 60 * 24, // 24h — evict older persisted cache
        buster: QUERY_CACHE_BUSTER,
        dehydrateOptions: {
          shouldDehydrateQuery: (query) => {
            const root = query.queryKey[0];
            return (
              query.state.status === "success" &&
              typeof root === "string" &&
              PERSISTED_KEY_PREFIXES.has(root)
            );
          },
        },
      }}
    >
      {children}
      {process.env.NODE_ENV === "development" && (
        <ReactQueryDevtools initialIsOpen={false} />
      )}
    </PersistQueryClientProvider>
  );
}
