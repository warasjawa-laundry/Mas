"use client";

import { useFormStatus } from "react-dom";

export default function OwnerLoginSubmit() {
  const { pending } = useFormStatus();
  return <button type="submit" className="admin-primary" disabled={pending} aria-busy={pending}>
    {pending ? "Memeriksa akun…" : "Masuk"}
  </button>;
}
