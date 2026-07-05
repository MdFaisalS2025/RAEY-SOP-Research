import { test, expect } from "@playwright/test"
import { loginAsDemoUser } from "./helpers"

test.describe("auth", () => {
  test("unauthenticated user is redirected to /login", async ({ page }) => {
    await page.goto("/dashboard")
    await page.waitForURL("**/login")
  })

  test("demo login reaches the dashboard with no console errors", async ({ page }) => {
    const errors: string[] = []
    page.on("console", (msg) => { if (msg.type() === "error") errors.push(msg.text()) })
    await loginAsDemoUser(page, "Sarah Mitchell")
    await expect(page.getByRole("heading", { name: /good (morning|afternoon|evening)/i })).toBeVisible()
    expect(errors, `console errors: ${errors.join("\n")}`).toHaveLength(0)
  })
})

test.describe("core query flow", () => {
  test("asking a question returns a sourced answer", async ({ page }) => {
    await loginAsDemoUser(page, "Sarah Mitchell")
    await page.goto("/query")
    await page.getByRole("button", { name: "What is the maximum norepinephrine dose?" }).click()
    await page.getByPlaceholder(/ask a clinical sop question/i).press("Enter")
    await expect(page.getByText(/sources/i).first()).toBeVisible({ timeout: 15_000 })
  })
})

test.describe("upload flow", () => {
  test("uploading a file completes and links to the library", async ({ page }) => {
    await loginAsDemoUser(page, "Tariq Farooq")
    await page.goto("/upload")
    await page.setInputFiles('input[type="file"]', {
      name: "smoke-test-sop.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("Sample SOP content for smoke testing."),
    })
    await page.getByRole("button", { name: /upload & process/i }).click()
    await expect(page.getByText("Processing Complete")).toBeVisible({ timeout: 15_000 })
    const libraryLink = page.getByRole("link", { name: /view in library/i })
    await expect(libraryLink).toBeVisible()
    await libraryLink.click()
    await page.waitForURL("**/library")
  })
})

test.describe("proposal flow", () => {
  test("proposals list links to a detail page", async ({ page }) => {
    await loginAsDemoUser(page, "Tariq Farooq")
    await page.goto("/proposals")
    await page.locator('a[href*="/proposals/"]').first().click()
    await page.waitForURL(/\/proposals\/.+/, { timeout: 15_000 })
  })
})

test.describe("learning / credits", () => {
  test("learning page loads leaderboard and credit totals from the API", async ({ page }) => {
    await loginAsDemoUser(page, "Sarah Mitchell")
    await page.goto("/learning")
    await expect(page.getByText("Total Credits Earned")).toBeVisible()
    await expect(page.getByText(/leaderboard/i)).toBeVisible()
  })
})

const STATIC_ROUTES = [
  "/dashboard", "/admin", "/adversarial", "/architecture", "/audit", "/bedside",
  "/cds-demo", "/committee", "/compliance", "/conflict-resolution", "/effectiveness",
  "/evaluation", "/evidence-watch", "/exceptions", "/expiry", "/feedback",
  "/human-eval", "/impact-map", "/incidents", "/leadership", "/legal", "/library",
  "/proposals", "/query", "/quick-ref", "/regulatory", "/scenarios", "/settings",
  "/survey-prep", "/training", "/updates", "/upload",
]

test.describe("full route sweep", () => {
  for (const route of STATIC_ROUTES) {
    test(`${route} renders with no console errors`, async ({ page }) => {
      const errors: string[] = []
      page.on("console", (msg) => { if (msg.type() === "error") errors.push(msg.text()) })
      await loginAsDemoUser(page, "Tariq Farooq")
      await page.goto(route)
      await page.waitForLoadState("networkidle")
      expect(errors, `console errors on ${route}: ${errors.join("\n")}`).toHaveLength(0)
    })
  }
})
