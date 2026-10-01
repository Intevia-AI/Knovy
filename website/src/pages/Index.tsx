import { lazy, Suspense } from 'react';
import { Header } from '@/components/landing/Header';
import { Hero } from '@/components/landing/Hero';

// Lazy load below-the-fold components to reduce initial bundle size and FID
const VideoDemo = lazy(() => import('@/components/landing/VideoDemo').then(m => ({ default: m.VideoDemo })));
const WhatIsKnovy = lazy(() => import('@/components/landing/WhatIsKnovy').then(m => ({ default: m.WhatIsKnovy })));
const Stats = lazy(() => import('@/components/landing/Stats').then(m => ({ default: m.Stats })));
const MarketGap = lazy(() => import('@/components/landing/MarketGap').then(m => ({ default: m.MarketGap })));
const Positioning = lazy(() => import('@/components/landing/Positioning').then(m => ({ default: m.Positioning })));
const Features = lazy(() => import('@/components/landing/Features').then(m => ({ default: m.Features })));
const Compatibility = lazy(() => import('@/components/landing/Compatibility').then(m => ({ default: m.Compatibility })));
const About = lazy(() => import('@/components/landing/About').then(m => ({ default: m.About })));
const CurrentProgress = lazy(() => import('@/components/landing/CurrentProgress').then(m => ({ default: m.CurrentProgress })));
const Footer = lazy(() => import('@/components/landing/Footer').then(m => ({ default: m.Footer })));

const Index = () => {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />
      <main>
        <Hero />
        <Suspense fallback={<div className="min-h-[50vh]" />}>
          <VideoDemo />
          <WhatIsKnovy />
          <Stats />
          <MarketGap />
          <Positioning />
          <Features />
          <Compatibility />
          <About />
          <CurrentProgress />
        </Suspense>
      </main>
      <Suspense fallback={null}>
        <Footer />
      </Suspense>
    </div>
  );
};

export default Index;
