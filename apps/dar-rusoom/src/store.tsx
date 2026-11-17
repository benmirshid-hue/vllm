import { createContext, useContext, useEffect, useReducer, type Dispatch, type ReactNode } from "react";
import { initialState, reduce, type Action, type State } from "./domain.ts";

const KEY = "dar-rusoom-v1";

function load(): State {
  if (typeof localStorage === "undefined") {
    return initialState();
  }
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) {
      return initialState();
    }
    const parsed = JSON.parse(raw) as State;
    if (parsed.version !== 1 || !parsed.layers) {
      return initialState();
    }
    const base = initialState();
    return {
      ...base,
      ...parsed,
      series: Array.isArray(parsed.series) && parsed.series.length > 0 ? parsed.series : base.series,
      catalog: Array.isArray(parsed.catalog) ? parsed.catalog : [],
      layers: parsed.layers,
    };
  } catch {
    return initialState();
  }
}

const StoreContext = createContext<{ state: State; dispatch: Dispatch<Action> } | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reduce, undefined, load);
  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify(state));
  }, [state]);
  return <StoreContext.Provider value={{ state, dispatch }}>{children}</StoreContext.Provider>;
}

export function useStore(): { state: State; dispatch: Dispatch<Action> } {
  const value = useContext(StoreContext);
  if (!value) {
    throw new Error("المتجر خارج الشجرة");
  }
  return value;
}
