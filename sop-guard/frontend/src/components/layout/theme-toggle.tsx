"use client"

import { useState, useEffect } from "react"
import { Moon, Sun } from "lucide-react"

// Extracted out of topnav.tsx (O2.3) so FocusBar (the slim /query chrome)
// can reuse the exact same theme-persistence logic instead of duplicating
// it - see focus-bar.tsx.
export function ThemeToggle() {
  const [isDark, setIsDark] = useState(true)

  useEffect(() => {
    const html = document.documentElement
    setIsDark(html.classList.contains("dark"))
  }, [])

  const toggleTheme = () => {
    const html = document.documentElement
    if (html.classList.contains("dark")) {
      html.classList.remove("dark")
      setIsDark(false)
      localStorage.setItem("meridian-theme", "light")
    } else {
      html.classList.add("dark")
      setIsDark(true)
      localStorage.setItem("meridian-theme", "dark")
    }
  }

  return (
    <button
      onClick={toggleTheme}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted dark:hover:bg-white/[0.05] transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/50 dark:focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
    >
      {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
    </button>
  )
}
