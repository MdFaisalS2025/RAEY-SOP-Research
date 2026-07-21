import { HeroSection } from "@/components/landing/hero-section"

// Single-viewport cinematic hero replaces the old 8-section scroll (see
// hero-section.tsx for why: measured ~1,500px of pure section padding plus
// content hidden behind whileInView animations in a full-page capture).
// The real backend-connected demo lives at /login -> the app itself, one
// click from the CTA - this page's job is a fast, honest first impression,
// not a feature tour.
export default function LandingPage() {
  return <HeroSection />
}
