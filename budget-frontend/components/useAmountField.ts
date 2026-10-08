"use client";

import { useState } from "react";

/** Editable dollar amount for a line row. Saves on blur only when the number
 * actually changed (so tabbing through, or blurring on the way to a checkbox,
 * doesn't fire a redundant save), and picks up the server's latest value
 * whenever the field isn't being edited. Never touches paid/received state. */
export function useAmountField(serverAmount: number, save: (amount: number) => void | Promise<void>) {
  const [value, setValue] = useState(String(serverAmount));
  const [editing, setEditing] = useState(false);
  const [lastServer, setLastServer] = useState(serverAmount);

  if (!editing && serverAmount !== lastServer) {
    setLastServer(serverAmount);
    setValue(String(serverAmount));
  }

  const numeric = Number(value) || 0;

  return {
    numeric,
    set: (n: number) => setValue(String(n)),
    inputProps: {
      value,
      onFocus: () => setEditing(true),
      onChange: (e: React.ChangeEvent<HTMLInputElement>) => setValue(e.target.value),
      // Reads the box itself rather than `numeric`: if typing and leaving the
      // field land in the same tick, this render's `numeric` is still the old
      // value and the save would be skipped.
      onBlur: (e: React.FocusEvent<HTMLInputElement>) => {
        setEditing(false);
        const n = Number(e.target.value) || 0;
        if (n !== serverAmount) save(n);
      },
    },
  };
}
