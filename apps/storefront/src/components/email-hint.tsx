"use client"

import { suggestEmail } from "@/lib/email-typo"

/** «Возможно, вы имели в виду …@gmail.com?» под полем email — по клику адрес исправляется. */
export function EmailHint({ value, onFix, className = "" }: { value: string; onFix: (email: string) => void; className?: string }) {
  const fix = suggestEmail(value)
  if (!fix) return null
  return (
    <p className={`mt-1.5 text-[12px] text-muted ${className}`} role="status">
      Возможно, вы имели в виду{" "}
      <button type="button" onClick={() => onFix(fix)} className="text-foreground underline underline-offset-2">{fix}</button>?
    </p>
  )
}
