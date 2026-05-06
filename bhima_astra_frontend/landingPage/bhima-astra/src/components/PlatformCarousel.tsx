import React, { useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Package, ShoppingBag, Truck, Clock, Home, Zap, Box } from 'lucide-react';

const PlatformCarousel: React.FC = () => {
  const carouselRef = useRef<HTMLDivElement>(null);

  const platforms = [
    {
      name: "Swiggy Instamart",
      icon: Package,
      color: "#FF6B35",
      description: "Quick delivery essentials",
      website: "https://www.swiggy.com/instamart"
    },
    {
      name: "BigBasket Now",
      icon: ShoppingBag,
      color: "#00A652",
      description: "Fresh groceries in minutes",
      website: "https://www.bigbasket.com/now"
    },
    {
      name: "Flipkart Minutes",
      icon: Truck,
      color: "#047BD5",
      description: "Electronics and more",
      website: "https://www.flipkart.com/minutes"
    },
    {
      name: "Amazon Now",
      icon: Clock,
      color: "#FF9900",
      description: "Everything delivered fast",
      website: "https://www.amazon.in/now"
    },
    {
      name: "FreshToHome Express",
      icon: Home,
      color: "#00D4AA",
      description: "Fresh fish and meat",
      website: "https://www.freshtohome.com/express"
    },
    {
      name: "Zepto",
      icon: Zap,
      color: "#8B5CF6",
      description: "10-minute delivery",
      website: "https://www.zeptonow.com"
    },
    {
      name: "Blinkit",
      icon: Box,
      color: "#FF6B6B",
      description: "Instant delivery partner",
      website: "https://www.blinkit.com"
    }
  ];

  useEffect(() => {
    const carousel = carouselRef.current;
    if (!carousel) return;

    let scrollAmount = 0;
    const scrollSpeed = 1;

    const scroll = () => {
      if (carousel) {
        scrollAmount += scrollSpeed;
        carousel.scrollLeft = scrollAmount;

        if (scrollAmount >= carousel.scrollWidth - carousel.clientWidth) {
          scrollAmount = 0;
        }
      }
    };

    let interval = setInterval(scroll, 30);

    const handleMouseEnter = () => clearInterval(interval);
    const handleMouseLeave = () => {
      interval = setInterval(scroll, 30);
    };

    carousel.addEventListener('mouseenter', handleMouseEnter);
    carousel.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      clearInterval(interval);
      carousel.removeEventListener('mouseenter', handleMouseEnter);
      carousel.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, []);

  return (
    <div className="py-20 px-4 bg-black">
      <div className="max-w-7xl mx-auto">
        <motion.div
          className="text-center mb-12"
          initial={{ opacity: 0, y: 50 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
        >
          <h2 className="text-4xl md:text-6xl font-bold mb-4">
            <span className="text-white">Trusted by </span>
            <span className="text-hyper-lime">Leading Platforms</span>
          </h2>
          <p className="text-xl text-gray-400">
            Protecting workers across the biggest delivery networks in India
          </p>
        </motion.div>

        <div className="relative">
          <div className="absolute left-0 top-0 bottom-0 w-20 bg-gradient-to-r from-black to-transparent z-10 pointer-events-none" />
          <div className="absolute right-0 top-0 bottom-0 w-20 bg-gradient-to-l from-black to-transparent z-10 pointer-events-none" />
          
          <div
            ref={carouselRef}
            className="flex gap-6 overflow-x-hidden scrollbar-hide py-8"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            {[...platforms, ...platforms].map((platform, index) => (
              <motion.div
                key={`${platform.name}-${index}`}
                className="neumorphic flex-shrink-0 w-80 p-8 rounded-3xl group cursor-pointer"
                initial={{ opacity: 0, x: 50 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                whileHover={{
                  scale: 1.05,
                  boxShadow: '0 25px 50px rgba(255, 95, 31, 0.3)'
                }}
              >
                <div className="flex items-center mb-6">
                  <div
                    className="p-4 rounded-2xl mr-4"
                    style={{ backgroundColor: `${platform.color}20` }}
                  >
                    <platform.icon
                      className="w-8 h-8"
                      style={{ color: platform.color }}
                    />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-white group-hover:text-hyper-lime transition-colors">
                      {platform.name}
                    </h3>
                    <p className="text-gray-400 text-sm">{platform.description}</p>
                  </div>
                </div>
                
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Workers Protected</span>
                    <span className="text-white font-semibold">50K+</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Coverage Rate</span>
                    <span className="text-white font-semibold">100%</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Response Time</span>
                    <span className="text-hyper-lime font-semibold">&lt; 2min</span>
                  </div>
                </div>

                <motion.div
                  className="mt-6 pt-6 border-t border-gray-800"
                  initial={{ opacity: 0 }}
                  whileHover={{ opacity: 1 }}
                >
                  <motion.button
                    onClick={() => window.open(platform.website, '_blank')}
                    className="w-full py-3 bg-gradient-to-r from-safety-orange to-hyper-lime text-black font-semibold rounded-xl hover:shadow-lg transition-all duration-300"
                    style={{ background: `linear-gradient(135deg, ${platform.color}, ${platform.color}CC)` }}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    View Details
                  </motion.button>
                </motion.div>
              </motion.div>
            ))}
          </div>
        </div>

        <motion.div
          className="text-center mt-12"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, delay: 0.5 }}
        >
          <div className="inline-flex items-center gap-8 glass px-8 py-4 rounded-full">
            <div className="text-center">
              <div className="text-3xl font-bold text-hyper-lime">7+</div>
              <div className="text-sm text-gray-400">Platform Partners</div>
            </div>
            <div className="w-px h-12 bg-gray-700" />
            <div className="text-center">
              <div className="text-3xl font-bold text-safety-orange">500K+</div>
              <div className="text-sm text-gray-400">Workers Protected</div>
            </div>
            <div className="w-px h-12 bg-gray-700" />
            <div className="text-center">
              <div className="text-3xl font-bold text-white">24/7</div>
              <div className="text-sm text-gray-400">Support Available</div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default PlatformCarousel;
