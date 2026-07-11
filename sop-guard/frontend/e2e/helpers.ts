import { Page } from "@playwright/test"

/**
 * Logs in via the demo-user picker on /login. `name` must match a substring
 * of one demo user's name (e.g. "Sarah Mitchell").
 *
 * Pre-seeds the "onboarding tour seen" and "first-run demo seen" flags so
 * tests exercise the app itself rather than the one-time first-visit tour,
 * which is already covered by its own dismiss/skip UI.
 */
export async function loginAsDemoUser(page: Page, name: string) {
  await page.addInitScript(() => {
    localStorage.setItem("meridian-onboarding-seen", "true")
    localStorage.setItem("meridian-first-run-demo-seen", "true")
  })
  await page.goto("/login")
  await page.locator(`div:has-text("${name}")`).getByRole("button", { name: "Enter" }).last().click()
  await page.waitForURL("**/dashboard")
}
