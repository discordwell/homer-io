import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../stores/auth.js';
import { CapabilityGridSection } from '../components/landing/CapabilityGridSection.js';
import { LandingFooter } from '../components/landing/LandingFooter.js';
import { LandingNav } from '../components/landing/LandingNav.js';
import { HeroSection } from '../components/landing/HeroSection.js';
import { MigrationReassuranceSection } from '../components/landing/MigrationReassuranceSection.js';
import { OperationsStorySection } from '../components/landing/OperationsStorySection.js';
import { PricingSnapshotSection } from '../components/landing/PricingSnapshotSection.js';
import { ProofStripSection } from '../components/landing/ProofStripSection.js';
import { LandingGlobalStyles, useLandingWidth, useScrolled } from '../components/landing/shared.js';

export function LandingPage() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const width = useLandingWidth();
  const scrolled = useScrolled();
  const compact = width < 820;

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <>
      <LandingGlobalStyles />
      <div className="landing-shell">
        <LandingNav compact={compact} scrolled={scrolled} />
        <HeroSection width={width} />
        <ProofStripSection />
        <OperationsStorySection width={width} />
        <CapabilityGridSection />
        <PricingSnapshotSection width={width} />
        <MigrationReassuranceSection width={width} />
        <LandingFooter compact={compact} />
      </div>
    </>
  );
}
