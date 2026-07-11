import { HeroSection } from "@/components/landing/hero-section"
import { ProblemSection } from "@/components/landing/problem-section"
import { HowItWorksSection } from "@/components/landing/how-it-works-section"
import { FeaturesGrid } from "@/components/landing/features-grid"
import { ProductShowcase } from "@/components/landing/product-showcase"
import { LiveDemoSection } from "@/components/landing/live-demo-section"
import { ResearchStatsSection } from "@/components/landing/research-stats-section"
import { LandingFooter } from "@/components/landing/landing-footer"

// The marketing homepage is dark-first by design, independent of the
// app's own light/dark toggle (which only applies once a visitor signs in
// and reaches the actual product). Scoping the "dark" class to this root
// - rather than toggling <html> - keeps every dark: variant and CSS
// custom property in globals.css correctly scoped to just this page.
export default function LandingPage() {
  return (
    <div className="dark bg-[#0A0C10] min-h-screen">
      <HeroSection />
      <ProblemSection />
      <HowItWorksSection />
      <FeaturesGrid />
      <ProductShowcase />
      <LiveDemoSection />
      <ResearchStatsSection />
      <LandingFooter />
    </div>
  )
}
