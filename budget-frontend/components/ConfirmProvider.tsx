"use client";

import { createContext, useCallback, useContext, useState } from "react";

type ConfirmOptions = {
  title?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
};

type DialogState = {
  message: string;
  options: ConfirmOptions;
  mode: "confirm" | "alert";
  resolve: (value: boolean) => void;
};

type ConfirmContextValue = {
  confirm: (message: string, options?: ConfirmOptions) => Promise<boolean>;
  notify: (message: string, options?: ConfirmOptions) => Promise<void>;
};

const ConfirmContext = createContext<ConfirmContextValue | null>(null);

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<DialogState | null>(null);

  const confirm = useCallback((message: string, options: ConfirmOptions = {}) => {
    return new Promise<boolean>((resolve) => {
      setState({ message, options, mode: "confirm", resolve });
    });
  }, []);

  const notify = useCallback((message: string, options: ConfirmOptions = {}) => {
    return new Promise<void>((resolve) => {
      setState({ message, options, mode: "alert", resolve: () => resolve() });
    }) as Promise<void>;
  }, []);

  function close(result: boolean) {
    state?.resolve(result);
    setState(null);
  }

  return (
    <ConfirmContext.Provider value={{ confirm, notify }}>
      {children}
      {state && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => close(false)}
        >
          <div
            className="w-full max-w-sm rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-5 space-y-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            {state.options.title && <h3 className="font-semibold">{state.options.title}</h3>}
            <p className="text-sm text-slate-600 dark:text-slate-300 whitespace-pre-line">{state.message}</p>
            <div className="flex justify-end gap-2">
              {state.mode === "confirm" && (
                <button
                  onClick={() => close(false)}
                  className="px-3 py-2 rounded-lg text-sm text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  {state.options.cancelLabel ?? "Cancel"}
                </button>
              )}
              <button
                autoFocus
                onClick={() => close(true)}
                className={`px-3 py-2 rounded-lg text-sm font-medium text-white ${
                  state.mode === "confirm" && state.options.destructive
                    ? "bg-red-700 hover:bg-red-800"
                    : "bg-sky-700 hover:bg-sky-800"
                }`}
              >
                {state.mode === "alert" ? "OK" : state.options.confirmLabel ?? "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm must be used within ConfirmProvider");
  return ctx;
}
