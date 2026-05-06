import React from 'react';
import Hero from './components/Hero';
import WhatIsBhimaAstra from './components/WhatIsBhimaAstra';
import { ChaosVsProtection } from './components/ChaosVsProtection';
import Signal from './components/Signal';
import BehaviorML from './components/BehaviorML';
import NetworkGraph from './components/NetworkGraph';
import Decision from './components/Decision';
import PlatformCarousel from './components/PlatformCarousel';
import StateGrid from './components/StateGrid';
import Pricing from './components/Pricing';
import AstraImpact from './components/Astra Impact';
import Team from './components/Team';
import BentoGrid from './components/BentoGrid';
import Navigation from './components/Navigation';
import CustomerReviews from './components/CustomerReviews';
import FAQ from './components/FAQ';
import ScrollEffects from './components/ScrollEffects';

function App() {
  return (
    <div className="App">
      <Navigation />
      
      <ScrollEffects>
        <Hero />
        <ChaosVsProtection />
        <WhatIsBhimaAstra />
        <Signal />
        <BehaviorML />
        <NetworkGraph />
        <Decision />
        <PlatformCarousel />
        <StateGrid />
        <Pricing />
        <AstraImpact />
        <CustomerReviews />
        <FAQ />
        <Team />
        <BentoGrid />
      </ScrollEffects>
      
    </div>
  );
}

export default App;