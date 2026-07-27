import { Page } from "@playwright/test"

/**
 * Logs in via the demo-user picker on /login. `name` must match a substring
 * of one demo user's name (e.g. "Sarah Mitchell").
 */
export async function loginAsDemoUser(page: Page, name: string) {
  await page.goto("/login")
  await page.locator(`div:has-text("${name}")`).getByRole("button", { name: "Enter" }).last().click()
  await page.waitForURL("**/dashboard")
}
