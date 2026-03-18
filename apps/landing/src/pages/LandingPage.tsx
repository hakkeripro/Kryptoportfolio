import HeroSection from '../components/HeroSection';
import ZkExplainerSection from '../components/ZkExplainerSection';
import DashboardMockup from '../components/DashboardMockup';
import FeatureCards from '../components/FeatureCards';
import PricingSection from '../components/PricingSection';
import Footer from '../components/Footer';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#111111] text-white">
      <HeroSection />
      <DashboardMockup />
      <ZkExplainerSection />
      <FeatureCards />
      <PricingSection />
      <Footer />
    </div>
  );
}
