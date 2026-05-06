import React, { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

interface ScrollEffectsProps {
  children: React.ReactNode;
}

const ScrollEffects: React.FC<ScrollEffectsProps> = ({ children }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Parallax effect for background elements
    const parallaxElements = container.querySelectorAll('.parallax');
    
    parallaxElements.forEach((element: Element) => {
      gsap.to(element, {
        yPercent: -50,
        ease: "none",
        scrollTrigger: {
          trigger: element,
          start: "top bottom",
          end: "bottom top",
          scrub: true
        }
      });
    });

    // Float animations for elements
    const floatElements = container.querySelectorAll('.float-animation');
    
    floatElements.forEach((element: Element, index) => {
      gsap.to(element, {
        y: -20,
        rotation: 5,
        ease: "power1.inOut",
        scrollTrigger: {
          trigger: element,
          start: "top 80%",
          end: "bottom 20%",
          scrub: 1
        }
      });
    });

    // Scale animations - FIXED: Used gsap.fromTo instead of chaining
    const scaleElements = container.querySelectorAll('.scale-animation');
    
    scaleElements.forEach((element: Element, index) => {
      gsap.fromTo(element, 
        { scale: 0.8, opacity: 0 },
        {
          scale: 1,
          opacity: 1,
          duration: 0.5,
          scrollTrigger: {
            trigger: element,
            start: "top 90%",
            end: "bottom 10%",
            scrub: 1
          }
        }
      );
    });

    // Slide in animations - FIXED: Used gsap.fromTo instead of chaining
    const slideElements = container.querySelectorAll('.slide-animation');
    
    slideElements.forEach((element: Element, index) => {
      gsap.fromTo(element,
        { x: index % 2 === 0 ? -100 : 100, opacity: 0 },
        {
          x: 0,
          opacity: 1,
          duration: 0.8,
          ease: "power2.out",
          scrollTrigger: {
            trigger: element,
            start: "top 70%",
            end: "bottom 30%",
            scrub: 1
          }
        }
      );
    });

    return () => {
      ScrollTrigger.refresh();
    };
  }, [children]);

  useEffect(() => {
    const handleScroll = () => {
      const scrollPercentage = window.scrollY / (document.documentElement.scrollHeight - window.innerHeight);
      
      // Navigate to next page when scrolled 80%
      if (scrollPercentage > 0.8) {
        // You can customize this to navigate to any page
        console.log('Further scroll detected - navigate to next section');
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  return (
    <div ref={containerRef} className="scroll-effects-container">
      {children}
    </div>
  );
};

export default ScrollEffects;