import React, { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

const Hero: React.FC = () => {
  const heroContainerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLHeadingElement>(null);
  const letterARef = useRef<HTMLSpanElement>(null);
  const illustrationRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      // Timeline for zooming into the 'A' and revealing the illustration
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: heroContainerRef.current,
          start: "top top",
          end: "+=150%", // Pins the section for a bit while scrolling
          pin: true,
          scrub: 1,
        }
      });

      // Scale up the letter 'A' dramatically
      tl.to(letterARef.current, {
        scale: 50,
        opacity: 0,
        transformOrigin: "center center",
        duration: 2,
        ease: "power2.inOut"
      }, 0);

      // Fade out the rest of the text
      tl.to(textRef.current, {
        opacity: 0,
        duration: 1,
      }, 0);

      // Fade in the gig worker illustration and emotional text
      tl.fromTo(illustrationRef.current, 
        { opacity: 0, scale: 0.8 },
        { opacity: 1, scale: 1, duration: 1.5, ease: "power2.out" },
        1 // Starts halfway through the zoom
      );
    }, heroContainerRef);

    return () => ctx.revert(); // Cleanup GSAP context on unmount
  }, []);

  return (
    <section ref={heroContainerRef} className="relative min-h-screen bg-[#121212] text-white flex flex-col items-center justify-center overflow-hidden">
      
      {/* Main Title */}
      <div className="absolute z-10 flex flex-col items-center justify-center w-full h-full">
        <h1 ref={textRef} className="text-6xl md:text-9xl font-black tracking-tighter">
          BHIM<span ref={letterARef} className="text-[#FF5F1F] inline-block mx-1">A</span> ASTRA
        </h1>
      </div>

      {/* Hidden Illustration & Caption (Revealed on Scroll) */}
      <div 
        ref={illustrationRef} 
        className="absolute z-20 flex flex-col items-center justify-center w-full max-w-4xl px-6 text-center opacity-0 pointer-events-none"
      >
        {/* AI Illustration: Gig Worker Protected by Shield */}
        <div className="relative w-64 h-64 md:w-96 md:h-96 mx-auto mb-8">
          {/* Glowing Shield Background */}
          <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-[#6C63FF] via-[#FF5F1F] to-[#CCFF00] opacity-60 blur-xl animate-pulse"></div>
          
          {/* Shield Icon */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="relative">
              {/* Outer Shield */}
              <div className="w-32 h-40 md:w-48 md:h-60 bg-gradient-to-br from-[#6C63FF] to-[#CCFF00] rounded-t-full rounded-b-3xl shadow-2xl transform rotate-12"></div>
              
              {/* Inner Shield */}
              <div className="absolute inset-4 w-24 h-32 md:w-36 md:h-48 bg-gradient-to-br from-[#FF5F1F] to-[#CCFF00] rounded-t-full rounded-b-3xl transform rotate-12"></div>
              
              {/* Gig Worker Silhouette */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-16 h-20 md:w-24 md:h-28 bg-black rounded-full opacity-80"></div>
              </div>
            </div>
          </div>
          
          {/* Protective Aura */}
          <div className="absolute inset-0 rounded-full border-4 border-[#CCFF00] opacity-40 animate-spin-slow"></div>
          
          {/* Energy Particles */}
          <div className="absolute top-4 left-4 w-8 h-8 bg-[#CCFF00] rounded-full opacity-60 animate-float"></div>
          <div className="absolute top-8 right-8 w-6 h-6 bg-[#FF5F1F] rounded-full opacity-60 animate-float-delayed"></div>
          <div className="absolute bottom-4 left-8 w-4 h-4 bg-[#6C63FF] rounded-full opacity-60 animate-float"></div>
          <div className="absolute bottom-8 right-4 w-6 h-6 bg-[#CCFF00] rounded-full opacity-60 animate-float-delayed"></div>
        </div>
        
        <p className="text-2xl md:text-4xl font-medium text-white leading-tight">
          A digital shield for the unsung heroes who keep our world moving, ensuring no accident stalls a dream.
        </p>

              </div>

    </section>
  );
};

export default Hero;