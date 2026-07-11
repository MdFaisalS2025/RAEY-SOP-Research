import { HeroSection } from "@/components/landing/hero-section"
import { ProblemSection } from "@/components/landing/problem-section"
import { HowItWorksSection } from "@/components/landing/how-it-works-section"
import { FeaturesGrid } from "@/components/landing/features-grid"
import { ProductShowcase } from "@/components/landing/product-showcase"
import { LiveDemoSection } from "@/components/landing/live-demo-section"
import { ResearchSection } from "@/components/landing/research-stats-section"
import { LandingFooter } from "@/components/landing/landing-footer"

// Light-primary by design: research on enterprise/healthcare buyer trust
// perception (see homepage design notes) points at light mode reading as
// more trustworthy for this audience than the dark-developer-tool
// aesthetic (Linear/Vercel) this page used previously - and it matches
// what OpenEvidence and Abridge actually ship. This page now follows the
// app's normal theme (respects the visitor's light/dark preference like
// every other route) instead of forcing dark unconditionally.
export default function LandingPage() {
  return (
    <div className="bg-background min-h-screen">
      <HeroSection />
      <ProblemSection />
      <HowItWorksSection />
      <FeaturesGrid />
      <ProductShowcase />
      <LiveDemoSection />
      <ResearchSection />
      <LandingFooter />
    </div>
  )
}
