"use client";

import { useId, useState } from "react";
import { passwordChecks } from "@/lib/validators";

/** Campo de senha com “Mostrar/Ocultar” e, ao criar uma senha, a lista de regras que vai sendo cumprida. */
export function PasswordInput({
  label,
  value,
  onChange,
  name,
  autoComplete,
  showChecks = false,
  autoFocus,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  name?: string;
  autoComplete: "current-password" | "new-password";
  showChecks?: boolean;
  autoFocus?: boolean;
}) {
  const id = useId();
  const [visible, setVisible] = useState(false);
  const checks = passwordChecks(value);

  return (
    <div className="pw-field">
      <label htmlFor={id}>{label}</label>
      <span className="pw-input">
        <input
          id={id}
          name={name}
          type={visible ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          autoFocus={autoFocus}
          required
          aria-describedby={showChecks ? `${id}-rules` : undefined}
        />
        <button type="button" className="link-btn" onClick={() => setVisible((v) => !v)} aria-pressed={visible}>
          {visible ? "Ocultar" : "Mostrar"}
        </button>
      </span>
      {showChecks && (
        <ul className="pw-checks" id={`${id}-rules`}>
          {checks.map((c) => (
            <li key={c.label} className={c.ok ? "is-ok" : undefined}>
              <span aria-hidden="true">{c.ok ? "✓" : "•"}</span> {c.label}
              <span className="sr-only">{c.ok ? " (cumprido)" : " (falta)"}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
