import { createContext, useContext, useState, useCallback, useRef } from "react";

interface ChatSearchState {
  query: string;
  currentMatchIndex: number;
  totalMatches: number;
  setQuery: (q: string) => void;
  goToNext: () => void;
  goToPrevious: () => void;
  registerMatches: (id: string, count: number) => void;
  unregisterMatches: (id: string) => void;
  getGlobalIndex: (id: string, localIndex: number) => number;
}

const ChatSearchContext = createContext<ChatSearchState | null>(null);

export function useChatSearch() {
  const ctx = useContext(ChatSearchContext);
  if (!ctx) throw new Error("useChatSearch must be used within ChatSearchProvider");
  return ctx;
}

export function useChatSearchOptional() {
  return useContext(ChatSearchContext);
}

export function ChatSearchProvider({ children }: { children: React.ReactNode }) {
  const [query, setQuery] = useState("");
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);
  // Track match counts per component instance, ordered by registration
  const matchRegistry = useRef(new Map<string, number>());
  const [totalMatches, setTotalMatches] = useState(0);

  const recalcTotal = useCallback(() => {
    let total = 0;
    for (const count of matchRegistry.current.values()) {
      total += count;
    }
    setTotalMatches(total);
  }, []);

  const registerMatches = useCallback(
    (id: string, count: number) => {
      matchRegistry.current.set(id, count);
      recalcTotal();
    },
    [recalcTotal]
  );

  const unregisterMatches = useCallback(
    (id: string) => {
      matchRegistry.current.delete(id);
      recalcTotal();
    },
    [recalcTotal]
  );

  const getGlobalIndex = useCallback((id: string, localIndex: number): number => {
    let offset = 0;
    for (const [key, count] of matchRegistry.current.entries()) {
      if (key === id) return offset + localIndex;
      offset += count;
    }
    return -1;
  }, []);

  const goToNext = useCallback(() => {
    setCurrentMatchIndex((prev) => {
      if (totalMatches === 0) return 0;
      return (prev + 1) % totalMatches;
    });
  }, [totalMatches]);

  const goToPrevious = useCallback(() => {
    setCurrentMatchIndex((prev) => {
      if (totalMatches === 0) return 0;
      return (prev - 1 + totalMatches) % totalMatches;
    });
  }, [totalMatches]);

  const handleSetQuery = useCallback((q: string) => {
    setQuery(q);
    setCurrentMatchIndex(0);
  }, []);

  return (
    <ChatSearchContext.Provider
      value={{
        query,
        currentMatchIndex,
        totalMatches,
        setQuery: handleSetQuery,
        goToNext,
        goToPrevious,
        registerMatches,
        unregisterMatches,
        getGlobalIndex,
      }}
    >
      {children}
    </ChatSearchContext.Provider>
  );
}
