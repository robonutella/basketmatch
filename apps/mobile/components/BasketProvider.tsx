import type { GroceryListItem } from "@basketmatch/domain";
import { optimizeBasket } from "@basketmatch/pricing-engine";
import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";

import { DEMO_NOW, demoItems, demoOffers, demoProducts, demoStores } from "@/lib/demo";

type BasketOutcome = ReturnType<typeof optimizeBasket>;

interface BasketContextValue {
  items: GroceryListItem[];
  includeRebates: boolean;
  verifiedOnly: boolean;
  maxStores: number;
  outcome: BasketOutcome;
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
  const [items, setItems] = useState<GroceryListItem[]>(cloneDemoItems);
  const [includeRebates, setIncludeRebates] = useState(true);
  const [verifiedOnly, setVerifiedOnly] = useState(true);
  const [maxStores, setMaxStores] = useState(2);

  const outcome = useMemo(
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
