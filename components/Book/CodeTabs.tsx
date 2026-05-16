import React from "react";

const STORAGE_KEY = "codeTabPreference";

const createTabStore = () => {
  let state: string[] = [];
  if (typeof window !== "undefined") {
    try {
      state = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    } catch {
    }
  }

  const listeners = new Set<() => void>();
  return {
    subscribe(fn: () => void) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },

    getSnapshot() {
      return state;
    },

    bump(label: string) {
      state = [label, ...state.filter(x => x !== label)].slice(0, 20);
      if (typeof window !== "undefined") {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      }
      listeners.forEach(l => l());
    },
  };
}

let tabStore: ReturnType<typeof createTabStore> | null = null;

function getTabStore() {
  if (typeof window === "undefined") {
    // SSR safety: return a dummy store
    return {
      subscribe: () => () => {},
      getSnapshot: () => [],
      bump: () => {},
    };
  }
  if (!tabStore) {
    tabStore = createTabStore();
  }
  return tabStore;
}

export function useTabPrefs() {
  const store = getTabStore();
  const order = React.useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getSnapshot
  );
  return {
    order,
    bump: store.bump,
  };
}

type CodeTabElement = React.ReactElement<{
  label: string;
  id?: string;
  children: React.ReactNode;
}>;

export const CodeTabs = ({ children }: { children: React.ReactNode }) => {
  const tabs = React.Children
    .toArray(children)
    .filter(child => child && React.isValidElement(child) && child.type === CodeTab
    ) as CodeTabElement[];

  const { order, bump } = useTabPrefs();
  const active = React.useMemo(() => {
    const labels = tabs.map(t => t.props.id ?? t.props.label);
    for (const pref of order) {
      const idx = labels.indexOf(pref);
      if (idx !== -1) {
        return idx;
      }
    }
    return 0;
  }, [order, tabs]);

  return (
    <div className="my-4 border border-gray-300 rounded-lg overflow-hidden" style={{boxShadow: "0.1rem 0.1rem 0.2rem #00000028"}}>
      <div className="flex bg-gray-100 border-b border-gray-300">
        {tabs.map((tab, i) => (
          <button
            key={i}
            onClick={() => { bump(tab.props.id ?? tab.props.label); }}
            className={`px-3 py-2 text-sm ${
              i === active ? "bg-white border-b-2 border-blue-500" : ""
            }`}
          >
            {tab.props.label}
          </button>
        ))}
      </div>
      <div className="p-0">
        {tabs[active]}
      </div>
    </div>
  );
}


export const CodeTab = ({ children }: { children: React.ReactNode }) =>
  <div className="code-tab">{children}</div>;
