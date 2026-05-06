import React from 'react';
import { motion } from 'framer-motion';
import { Heart, Shield, Clock, TrendingUp } from 'lucide-react';

const WhatIsBhimaAstra: React.FC = () => {
  const features = [
    {
      icon: Heart,
      title: "Designed with Care",
      description: "Every feature crafted with the real struggles of gig workers in mind"
    },
    {
      icon: Shield,
      title: "Complete Protection",
      description: "Comprehensive coverage that kicks in the moment you need it most"
    },
    {
      icon: Clock,
      title: "Instant Support",
      description: "No waiting periods or complicated paperwork when emergencies strike"
    },
    {
      icon: TrendingUp,
      title: "Growing with You",
      description: "Your safety net expands as your career and needs evolve"
    }
  ];

  return (
    <div className="py-20 px-4 bg-gradient-to-b from-charcoal to-black">
      <div className="max-w-6xl mx-auto">
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: 50 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
        >
          <h2 className="text-4xl md:text-6xl font-bold mb-6">
            <span className="text-white">What is </span>
            <span className="text-safety-orange">Bhima Astra</span>
          </h2>
          <div className="max-w-4xl mx-auto space-y-4">
            <p className="text-xl md:text-2xl text-gray-300 leading-relaxed">
              Bhima Astra is more than just insurance : it is a promise to every delivery rider,
              every driver, every person who earns their living on the move.
            </p>
            <p className="text-xl md:text-2xl text-gray-300 leading-relaxed">
              We believe that financial protection should not be a luxury, but a fundamental right
              for those who keep our cities running day and night.
            </p>
            <p className="text-xl md:text-2xl text-gray-300 leading-relaxed">
              This is our commitment to the invisible workforce that powers our digital world 
              protection that moves as fast as you do.
            </p>
          </div>
        </motion.div>

        <motion.div
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8"
          initial={{ opacity: 0, y: 50 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, delay: 0.3 }}
        >
          {features.map((feature, index) => (
            <motion.div
              key={index}
              className="glass p-6 rounded-2xl text-center hover:transform hover:scale-105 transition-all duration-300"
              whileHover={{ y: -10 }}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
            >
              <div className="mb-4 flex justify-center">
                <div className="p-3 bg-safety-orange bg-opacity-20 rounded-full">
                  <feature.icon className="w-8 h-8 text-safety-orange" />
                </div>
              </div>
              <h3 className="text-xl font-semibold text-white mb-3">{feature.title}</h3>
              <p className="text-gray-400 text-sm leading-relaxed">{feature.description}</p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </div>
  );
};

export default WhatIsBhimaAstra;
