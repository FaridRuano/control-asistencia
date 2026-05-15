"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

export default function TransitionLink({
  href,
  children,
  className = "",
  transitionMs = 150,
  onClick,
  ...props
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [isNavigating, setIsNavigating] = useState(false);

  function handleClick(event) {
    onClick?.(event);

    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }

    const targetHref = typeof href === "string" ? href : href?.toString?.() || "";

    if (!targetHref || targetHref === pathname) {
      return;
    }

    event.preventDefault();
    setIsNavigating(true);

    window.setTimeout(() => {
      router.push(targetHref);
    }, transitionMs);
  }

  return (
    <Link
      href={href}
      onClick={handleClick}
      data-navigating={isNavigating ? "true" : "false"}
      aria-busy={isNavigating ? "true" : "false"}
      className={className}
      {...props}
    >
      {children}
    </Link>
  );
}
