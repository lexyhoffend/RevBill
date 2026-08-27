"use client";

import { useState } from "react";

type Props = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  minLength?: number;
};

export default function PasswordInput({ value, onChange, placeholder, required, minLength }: Props) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        type={visible ? "text" : "password"}
        placeholder={placeholder}
        required={required}
        minLength={minLength}
        className="w-full border border-slate-300 dark:border-slate-600 rounded-lg pl-3 pr-14 py-2 bg-transparent text-sm"
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Hide password" : "Show password"}
        className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-emerald-700 dark:hover:text-emerald-400"
      >
        {visible ? "Hide" : "Show"}
      </button>
    </div>
  );
}
