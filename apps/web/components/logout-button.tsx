"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

export function LogoutButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const logout = () => {
    startTransition(async () => {
      await fetch("/api/auth/logout", {
        method: "POST",
      });
      router.replace("/login");
      router.refresh();
    });
  };

  return (
    <button
      className="mini-button"
      type="button"
      disabled={isPending}
      onClick={logout}
    >
      <LogOut aria-hidden="true" size={14} /> Sign Out
    </button>
  );
}
