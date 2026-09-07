"use client";

import { useRouter } from "next/navigation";
import { Button, type ButtonProps } from "@/components/ui/Button";

/**
 * A Button that navigates. Used where a call-to-action needs button styling
 * but goes somewhere — nesting a <button> inside a <Link> would announce two
 * controls to assistive tech.
 */
export function NavButton({ href, onClick, ...rest }: ButtonProps & { href: string }) {
  const router = useRouter();
  return (
    <Button
      {...rest}
      onClick={(e) => {
        onClick?.(e);
        if (!e.defaultPrevented) router.push(href);
      }}
    />
  );
}
