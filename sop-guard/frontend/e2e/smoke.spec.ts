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
    // Suggested-query buttons submit immediately on click (see the O-N-B
    // small-fixes chat work), so there's no separate composer/Enter step
    // here anymore - this test previously targeted a placeholder string
    // ("ask a clinical sop question") the composer hasn't used since the
    // J-A composer rebuild, so it was failing before this fix.
    await page.getByRole("button", { name: "What is the maximum norepinephrine dose?" }).click()
    await expect(page.getByText(/sources/i).first()).toBeVisible({ timeout: 15_000 })
  })
})

test.describe("upload flow", () => {
  test("uploading a file completes and links to the library", async ({ page, request }) => {
    // Give this run's junk SOP a unique, greppable title so cleanup can
    // never accidentally delete a real SOP even if this test crashes
    // mid-run and leaves a stray row behind.
    const uniqueTitle = `smoke-test-sop-${Date.now()}`

    await loginAsDemoUser(page, "Tariq Farooq")
    await page.goto("/upload")
    await page.setInputFiles('input[type="file"]', {
      name: `${uniqueTitle}.txt`,
      mimeType: "text/plain",
      buffer: Buffer.from("Sample SOP content for smoke testing."),
    })
    await page.getByRole("button", { name: /upload & process/i }).click()
    await expect(page.getByText("Processing Complete")).toBeVisible({ timeout: 15_000 })

    // Capture the sop_id the backend assigned so it can be deleted after
    // the assertions below - without this, every CI/local run leaves a
    // permanent junk row in the shared dev database, polluting retrieval,
    // the corpus vocabulary abstention signal, and every SOP-count display
    // in the app. Read it from the result card's data-sop-id attribute
    // (not page text) since the site header also contains text starting
    // with "SOP-" ("Meridian").
    const sopId = await page.locator("[data-sop-id]").getAttribute("data-sop-id")

    const libraryLink = page.getByRole("link", { name: /view in library/i })
    await expect(libraryLink).toBeVisible()
    await libraryLink.click()
    await page.waitForURL("**/library")

    if (sopId) {
      const cleanup = await request.delete(`http://localhost:8000/api/sops/${sopId.trim()}?permanent=true`, {
        headers: { "X-User-Role": "admin" },
      })
      expect(cleanup.ok()).toBeTruthy()
    }
  })
})

test.describe("proposal flow", () => {
  test("proposals list links to a detail page", async ({ page, request }) => {
    // The real governance API starts empty - create one real proposal so
    // there's something to click into, then delete it afterward so this
    // test doesn't leave permanent junk rows in the shared dev database.
    const created = await request.post("http://localhost:8000/api/governance/proposals", {
      data: { title: `smoke-test-proposal-${Date.now()}`, department: "Quality", priority: "low" },
    })
    expect(created.ok()).toBeTruthy()
    const { id } = await created.json()

    try {
      await loginAsDemoUser(page, "Tariq Farooq")
      await page.goto("/proposals")
      await page.locator('a[href*="/proposals/"]').first().click()
      await page.waitForURL(/\/proposals\/.+/, { timeout: 15_000 })
    } finally {
      const cleanup = await request.delete(`http://localhost:8000/api/governance/proposals/${id}`)
      expect(cleanup.ok()).toBeTruthy()
    }
  })
})

test.describe("learning redirect", () => {
  test("old /learning link redirects to /training", async ({ page }) => {
    await loginAsDemoUser(page, "Sarah Mitchell")
    await page.goto("/learning")
    await page.waitForURL("**/training", { timeout: 15_000 })
  })
})

const STATIC_ROUTES = [
  "/dashboard", "/admin", "/adversarial", "/alert-stewardship", "/architecture", "/audit", "/bedside",
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
