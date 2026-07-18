import { useCallback, useState } from "react";
import {
  CartAuthRequiredError,
  addToCart,
  removeItem as removeCartItem,
  setItemQuantity,
  type CartItemRef,
} from "./cart";

export type CartMutationAction = "increase" | "decrease" | "remove" | "add";

function pendingKeyFor(ref: CartItemRef): string {
  return ref.skuId ?? ref.sku;
}

export function useCartMutation() {
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<CartMutationAction | null>(null);
  const [authRequired, setAuthRequired] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isPending = useCallback(
    (sku: string, skuId?: string) => pendingKey === (skuId ?? sku),
    [pendingKey]
  );

  const getAction = useCallback(
    (sku: string, skuId?: string) => (isPending(sku, skuId) ? pendingAction : null),
    [isPending, pendingAction]
  );

  const run = useCallback(
    async (ref: CartItemRef, action: CartMutationAction, fn: () => Promise<void>) => {
      if (pendingKey) return;
      setPendingKey(pendingKeyFor(ref));
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
        setPendingKey(null);
        setPendingAction(null);
      }
    },
    [pendingKey]
  );

  const increaseQuantity = useCallback(
    (sku: string, currentQuantity: number, skuId?: string) =>
      run({ sku, skuId }, "increase", () =>
        setItemQuantity({ sku, skuId }, currentQuantity + 1)
      ),
    [run]
  );

  const decreaseQuantity = useCallback(
    (sku: string, currentQuantity: number, skuId?: string) =>
      run({ sku, skuId }, "decrease", () =>
        setItemQuantity({ sku, skuId }, currentQuantity - 1)
      ),
    [run]
  );

  const removeItem = useCallback(
    (sku: string, skuId?: string) =>
      run({ sku, skuId }, "remove", () => removeCartItem({ sku, skuId })),
    [run]
  );

  const addItem = useCallback(
    (sku: string, quantity = 1, skuId?: string) =>
      run({ sku, skuId }, "add", () => addToCart({ sku, skuId }, quantity)),
    [run]
  );

  return {
    pendingKey,
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
