import HeroSection from '../components/HeroSection';
import ZkExplainerSection from '../components/ZkExplainerSection';
import DashboardMockup from '../components/DashboardMockup';
import FeatureCards from '../components/FeatureCards';
import PricingSection from '../components/PricingSection';
import Footer from '../components/Footer';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#111111] text-white">
      {/* Beta banner */}
      <div className="flex items-center justify-center h-8 bg-[#FF8400]/[0.12] border-b border-[#FF8400]/[0.2] text-[11px] font-mono tracking-wide text-[#FF8400]/90">
        PrivateLedger is currently in beta. Features and data formats may change.
      </div>
      <HeroSection />
      <DashboardMockup />
      <ZkExplainerSection />
      <FeatureCards />
      <PricingSection />
      <Footer />
    </div>
  );
}
