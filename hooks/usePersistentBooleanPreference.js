"use client";

import { useCallback, useSyncExternalStore } from "react";

function buildEventName(storageKey) {
  return `${storageKey}:change`;
}

export default function usePersistentBooleanPreference(storageKey, defaultValue = true) {
  const subscribe = useCallback((callback) => {
    const eventName = buildEventName(storageKey);

    window.addEventListener("storage", callback);
    window.addEventListener(eventName, callback);

    return () => {
      window.removeEventListener("storage", callback);
      window.removeEventListener(eventName, callback);
    };
  }, [storageKey]);

  const getSnapshot = useCallback(() => {
    const storedValue = window.localStorage.getItem(storageKey);

    if (storedValue === null) {
      return defaultValue;
    }

    return storedValue === "true";
  }, [defaultValue, storageKey]);

  const value = useSyncExternalStore(
    subscribe,
    getSnapshot,
    () => defaultValue,
  );

  const setValue = useCallback((nextValue) => {
    window.localStorage.setItem(storageKey, String(nextValue));
    window.dispatchEvent(new Event(buildEventName(storageKey)));
  }, [storageKey]);

  return [value, setValue];
}
