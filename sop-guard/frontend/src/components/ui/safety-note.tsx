import { cn } from "@/lib/utils"

/**
 * One quiet, reusable disclaimer line. Replaces the dozens of repeated
 * "Research Prototype - Not for Clinical Use - For demonstration only"
 * banners that used to appear on nearly every page - a single line said
 * once per page reads as a professional compliance notice; the same
 * sentence in a bright banner on every card reads as alert fatigue and
 * undermines trust in the product rather than protecting the user.
 *
 * `variant="external"` is for the one place repetition is actually
 * informative: directly under content sourced from outside the hospital's
 * approved SOPs, where the reader needs a fresh reminder that this
 * specific passage isn't institutional policy.
 */
export function SafetyNote({
  variant = "default",
  className,
}: {
  variant?: "default" | "external"
  className?: string
}) {
  const text =
    variant === "external"
      ? "External reference only, not institutional policy. Verify against your department's current SOP."
      : "Clinical decision support. Verify against approved institutional policy."

  return (
    <p className={cn("text-xs text-muted-foreground", className)}>
      {text}
    </p>
  )
}
