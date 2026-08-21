import type { GroceryListItem } from "@basketmatch/domain";
import { optimizeBasket } from "@basketmatch/pricing-engine";
import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { DEMO_NOW, demoItems, demoOffers, demoProducts, demoStores } from "@/lib/demo";
import { basketmatchApi } from "@/lib/api";
import { useAuth } from "@/components/AuthProvider";

type BasketOutcome = ReturnType<typeof optimizeBasket>;

interface BasketContextValue {
  items: GroceryListItem[];
  includeRebates: boolean;
  verifiedOnly: boolean;
  maxStores: number;
  outcome: BasketOutcome;
  backendStatus: string;
  addItem: (name: string) => void;
  removeItem: (id: string) => void;
  togglePurchased: (id: string) => void;
  setIncludeRebates: (value: boolean) => void;
  setVerifiedOnly: (value: boolean) => void;
  setMaxStores: (value: number) => void;
  reset: () => void;
}

const BasketContext = createContext<BasketContextValue | null>(null);

function cloneDemoItems(): GroceryListItem[] {
  return demoItems.map((item) => ({ ...item }));
}

function itemId(): string {
  return `item-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function BasketProvider({ children }: PropsWithChildren) {
  const { session, user } = useAuth();
  const [items, setItems] = useState<GroceryListItem[]>(cloneDemoItems);
  const [includeRebates, setIncludeRebates] = useState(true);
  const [verifiedOnly, setVerifiedOnly] = useState(true);
  const [maxStores, setMaxStores] = useState(2);
  const [listId, setListId] = useState<string>();
  const [remoteOutcome, setRemoteOutcome] = useState<BasketOutcome>();
  const [backendReady, setBackendReady] = useState(false);
  const [backendStatus, setBackendStatus] = useState("Demo calculation");

  const localOutcome = useMemo(
    () =>
      optimizeBasket({
        items,
        products: demoProducts,
        offers: demoOffers,
        stores: demoStores,
        includeRebates,
        verifiedOnly,
        maxStores,
        now: DEMO_NOW,
      }),
    [includeRebates, items, maxStores, verifiedOnly],
  );
  const outcome = user && remoteOutcome ? remoteOutcome : localOutcome;

  useEffect(() => {
    const token = session?.access_token;
    if (!token) {
      setListId(undefined);
      setRemoteOutcome(undefined);
      setBackendReady(false);
      setBackendStatus("Demo calculation");
      return;
    }
    let cancelled = false;
    setBackendStatus("Loading saved list…");
    void basketmatchApi<{
      list: {
        id: string;
        items: GroceryListItem[];
        includeRebates: boolean;
        verifiedOffersOnly: boolean;
        maxStores: number;
      };
    }>("/lists", token).then(({ list }) => {
      if (cancelled) return;
      setListId(list.id);
      setItems(list.items);
      setIncludeRebates(list.includeRebates);
      setVerifiedOnly(list.verifiedOffersOnly);
      setMaxStores(list.maxStores);
      setBackendReady(true);
      setBackendStatus("Saved to your account");
    }).catch((error: unknown) => {
      if (!cancelled) setBackendStatus(error instanceof Error ? error.message : "Backend unavailable");
    });
    return () => { cancelled = true; };
  }, [session?.access_token]);

  useEffect(() => {
    const token = session?.access_token;
    if (!token || !listId || !backendReady) return;
    let cancelled = false;
    const timeout = setTimeout(() => {
      setBackendStatus("Saving and calculating on server…");
      void basketmatchApi("/lists", token, {
        method: "PUT",
        body: JSON.stringify({
          id: listId,
          title: "My grocery list",
          items,
          includeRebates,
          verifiedOffersOnly: verifiedOnly,
          maxStores,
        }),
      }).then(() => basketmatchApi<{ outcome: BasketOutcome }>("/recommendations/calculate", token, {
        method: "POST",
        body: JSON.stringify({
          groceryListId: listId,
          idempotencyKey: `mobile-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        }),
      })).then(({ outcome: serverOutcome }) => {
        if (!cancelled) {
          setRemoteOutcome(serverOutcome);
          setBackendStatus("Saved · server calculation stored");
        }
      }).catch((error: unknown) => {
        if (!cancelled) setBackendStatus(error instanceof Error ? error.message : "Backend unavailable");
      });
    }, 500);
    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [backendReady, includeRebates, items, listId, maxStores, session?.access_token, verifiedOnly]);

  const addItem = useCallback((name: string) => {
    const cleanName = name.trim();
    if (!cleanName) return;
    setItems((current) => [
      ...current,
      { id: itemId(), name: cleanName, quantity: 1, purchased: false },
    ]);
  }, []);

  const removeItem = useCallback((id: string) => {
    setItems((current) => current.filter((item) => item.id !== id));
  }, []);

  const togglePurchased = useCallback((id: string) => {
    setItems((current) =>
      current.map((item) =>
        item.id === id ? { ...item, purchased: !item.purchased } : item,
      ),
    );
  }, []);

  const reset = useCallback(() => {
    setItems(cloneDemoItems());
    setIncludeRebates(true);
    setVerifiedOnly(true);
    setMaxStores(2);
  }, []);

  const value = useMemo<BasketContextValue>(
    () => ({
      items,
      includeRebates,
      verifiedOnly,
      maxStores,
      outcome,
      backendStatus,
      addItem,
      removeItem,
      togglePurchased,
      setIncludeRebates,
      setVerifiedOnly,
      setMaxStores,
      reset,
    }),
    [
      addItem,
      backendStatus,
      includeRebates,
      items,
      maxStores,
      outcome,
      removeItem,
      reset,
      togglePurchased,
      verifiedOnly,
    ],
  );

  return <BasketContext.Provider value={value}>{children}</BasketContext.Provider>;
}

export function useBasket(): BasketContextValue {
  const context = useContext(BasketContext);
  if (!context) throw new Error("useBasket must be used inside BasketProvider");
  return context;
}
