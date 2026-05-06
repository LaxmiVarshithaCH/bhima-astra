import React from 'react';
import { motion } from 'framer-motion';
import { Package, ShoppingBag, Truck, Clock, Home, Zap, Shield } from 'lucide-react';

const projects = [
  { name: "Blinkit", workers: 5, logo: Zap, description: "Instant protection during high-demand 10-minute delivery surges.", color: "#F7CB45" },
  { name: "Amazon Now", workers: 8, logo: Package, description: "Parametric coverage for grocery fleet during urban disruptions.", color: "#FF9900" },
  { name: "Swiggy Instamart", workers: 18, logo: ShoppingBag, description: "Shielding delivery partners across most volatile weather zones.", color: "#FC8019" },
  { name: "BigBasket", workers: 9, logo: Home, description: "Automated payouts for morning-slot logistics disruptions.", color: "#84C225" },
  { name: "Zepto", workers: 11, logo: Truck, description: "Real-time risk mitigation for hyper-local rapid delivery.", color: "#5E33BF" },
  { name: "Flipkart Minutes", workers: 11, logo: Clock, description: "Proactive protection for fast-moving delivery ecosystems.", color: "#8a68db" },
  { name: "FreshtoHome", workers: 11, logo: Zap, description: "Immediate safety response for hyperlocal logistics.", color: "#FF6B6B" }
];

const ImpactSection = () => {
  return (
    <section className="bg-[#0A0A0A] py-24 px-6 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <div className="mb-20">
          <motion.h2 
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            className="text-6xl font-black text-white mb-6 tracking-tighter"
          >
            SHIELDED <span className="text-[#CCFF00]">GIG-WORKERS</span>
          </motion.h2>
          <p className="text-gray-500 text-xl max-w-2xl font-medium">
            Real-time parametric protection delivered through a soft-touch, 
            intelligent interface.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12">
          {projects.map((item, index) => (
            <motion.div
              key={item.name}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              whileHover={{ y: -5 }}
              /* NEUMORPHIC CONTAINER */
              className="group relative bg-[#0A0A0A] rounded-[40px] p-10 flex flex-col justify-between h-[450px] transition-all duration-500"
              style={{
                boxShadow: '12px 12px 24px #040404, -8px -8px 24px rgba(255,255,255,0.02)'
              }}
            >
              {/* Top Row: Logo & Payout Stats */}
              <div className="flex justify-between items-start">
                <div 
                  className="w-20 h-20 rounded-3xl flex items-center justify-center transition-all duration-500"
                  style={{
                    background: '#0A0A0A',
                    boxShadow: 'inset 6px 6px 12px #040404, inset -6px -6px 12px rgba(255,255,255,0.01)'
                  }}
                >
                  {React.createElement(item.logo, {
                    className: "transition-colors duration-500",
                    style: { color: item.color },
                    size: 32
                  })}
                </div>
                
                <div className="text-right">
                  <span className="text-5xl font-black text-white block tracking-tighter">
                    {item.workers}
                  </span>
                  <span className="text-[10px] uppercase tracking-[0.2em] text-gray-500 font-bold">
                    Active Shields
                  </span>
                </div>
              </div>

              {/* Content Area */}
              <div className="z-10">
                <h3 className="text-3xl font-bold text-white mb-4 group-hover:text-[#CCFF00] transition-colors">
                  {item.name}
                </h3>
                <p className="text-gray-500 leading-relaxed text-base font-medium">
                  {item.description}
                </p>
              </div>

              {/* Neumorphic Hover Action */}
              <motion.button
                whileTap={{ scale: 0.95 }}
                className="mt-6 w-full py-4 rounded-2xl text-xs font-bold uppercase tracking-widest text-gray-400 transition-all"
                style={{
                  background: '#0A0A0A',
                  boxShadow: '6px 6px 12px #040404, -4px -4px 12px rgba(255,255,255,0.01)'
                }}
              >
                View Live Metrics
              </motion.button>

              {/* Subtle Ambient Glow on Hover */}
              <div 
                className="absolute inset-0 rounded-[40px] opacity-0 group-hover:opacity-10 transition-opacity duration-700 pointer-events-none"
                style={{
                  boxShadow: `0 0 50px ${item.color}`
                }}
              />

              {/* Background Watermark Shield */}
              <Shield 
                className="absolute right-6 bottom-20 opacity-[0.02] group-hover:opacity-[0.05] transition-opacity"
                size={180}
                strokeWidth={1}
                color="white"
              />
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default ImpactSection;