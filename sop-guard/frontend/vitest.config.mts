import { defineConfig } from "vitest/config"
import react from "@vitejs/plugin-react"
import path from "path"
import { fileURLToPath } from "url"

const dirname = path.dirname(fileURLToPath(import.meta.url))

// Unit tests for pure logic (e.g. sop-full-text.tsx's resolveHighlight
// honesty ladder) that don't need a real browser - separate from the
// Playwright e2e suite (test:e2e), which drives the actual running app.
// react() is needed only because importing a .tsx file pulls in every
// export in the module, including JSX-bearing React components, even when
// a test only exercises a plain function from that file.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(dirname, "./src"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.{ts,tsx}"],
  },
})
