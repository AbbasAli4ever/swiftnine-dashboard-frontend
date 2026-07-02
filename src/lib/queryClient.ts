import { QueryClient } from "@tanstack/react-query";
import axios from "axios";

function shouldRetry(failureCount: number, error: unknown): boolean {
  if (axios.isAxiosError(error) && error.response?.status === 401) {
    // src/lib/api.ts already owns single-flight refresh-and-retry for 401s.
    // Letting React Query retry too would race the redirect-to-login.
    return false;
  }
  return failureCount < 1;
}

export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        retry: shouldRetry,
        retryDelay: 1000,
        refetchOnWindowFocus: true,
        refetchOnReconnect: true,
      },
      mutations: {
        retry: 0,
      },
    },
  });
}
