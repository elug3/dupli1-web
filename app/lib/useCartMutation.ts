import { useCallback, useState } from "react";
import {
  CartAuthRequiredError,
  addToCart,
  removeItem as removeCartItem,
  setItemQuantity,
} from "./cart";

export type CartMutationAction = "increase" | "decrease" | "remove" | "add";

export function useCartMutation() {
  const [pendingSku, setPendingSku] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<CartMutationAction | null>(null);
  const [authRequired, setAuthRequired] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isPending = useCallback((sku: string) => pendingSku === sku, [pendingSku]);

  const getAction = useCallback(
    (sku: string) => (isPending(sku) ? pendingAction : null),
    [isPending, pendingAction]
  );

  const run = useCallback(
    async (sku: string, action: CartMutationAction, fn: () => Promise<void>) => {
      if (pendingSku) return;
      setPendingSku(sku);
      setPendingAction(action);
      setError(null);
      try {
        await fn();
      } catch (err) {
        if (err instanceof CartAuthRequiredError) {
          setAuthRequired(true);
        } else {
          setError(err instanceof Error ? err.message : "Something went wrong");
        }
      } finally {
        setPendingSku(null);
        setPendingAction(null);
      }
    },
    [pendingSku]
  );

  const increaseQuantity = useCallback(
    (sku: string, currentQuantity: number) =>
      run(sku, "increase", () => setItemQuantity(sku, currentQuantity + 1)),
    [run]
  );

  const decreaseQuantity = useCallback(
    (sku: string, currentQuantity: number) =>
      run(sku, "decrease", () => setItemQuantity(sku, currentQuantity - 1)),
    [run]
  );

  const removeItem = useCallback((sku: string) => run(sku, "remove", () => removeCartItem(sku)), [run]);

  const addItem = useCallback(
    (sku: string, quantity = 1) => run(sku, "add", () => addToCart(sku, quantity)),
    [run]
  );

  return {
    pendingKey: pendingSku,
    pendingAction,
    isPending,
    getAction,
    increaseQuantity,
    decreaseQuantity,
    removeItem,
    addItem,
    authRequired,
    error,
  };
}
