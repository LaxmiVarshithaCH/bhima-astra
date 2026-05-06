import React from 'react';
import { motion } from 'framer-motion';

const BehaviorML: React.FC = () => {
  return (
    <div className="py-20 px-4 bg-gradient-to-b from-charcoal to-black">
      <div className="max-w-7xl mx-auto">
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: 50 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
        >
          <div className="relative">
            {/* Stage indicator */}
            <div className="text-left mb-4">
              <span className="text-gray-500 text-sm">STAGE 02</span>
              <h2 className="text-white text-lg font-semibold">BEHAVIOR ML</h2>
            </div>
            
            {/* Large background number */}
            <div className="absolute inset-0 flex items-center justify-center opacity-10 pointer-events-none">
              <span className="text-9xl font-black text-white">2</span>
            </div>
            
            {/* Main content */}
            <div className="relative z-10">
              <h2 className="text-4xl md:text-6xl font-bold mb-6">
                <span className="text-white">BEHAVIOR </span>
                <span className="text-white">ML</span>
              </h2>
              <p className="text-xl text-gray-300 mb-8 max-w-3xl mx-auto leading-relaxed">
                Deep learning models analyze user behavior patterns. Keystroke dynamics, 
                navigation flows, session biometrics.
              </p>
              
              {/* Tags */}
              <div className="flex flex-wrap justify-center gap-4">
                <motion.div
                  className="px-6 py-3 bg-gray-900 rounded-full text-white font-semibold border border-gray-700"
                  whileHover={{ scale: 1.05, backgroundColor: "#2a2a2a" }}
                  whileTap={{ scale: 0.95 }}
                >
                  15MS
                </motion.div>
                <motion.div
                  className="px-6 py-3 bg-gray-900 rounded-full text-white font-semibold border border-gray-700"
                  whileHover={{ scale: 1.05, backgroundColor: "#2a2a2a" }}
                  whileTap={{ scale: 0.95 }}
                >
                  NEURAL NET
                </motion.div>
                <motion.div
                  className="px-6 py-3 bg-gray-900 rounded-full text-white font-semibold border border-gray-700"
                  whileHover={{ scale: 1.05, backgroundColor: "#2a2a2a" }}
                  whileTap={{ scale: 0.95 }}
                >
                  97.8% RECALL
                </motion.div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Visual representation */}
        <motion.div
          className="mt-16"
          initial={{ opacity: 0, scale: 0.8 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, delay: 0.3 }}
        >
          <div className="glass p-8 rounded-3xl">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="text-center">
                <div className="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-orange-500 to-orange-700 rounded-full flex items-center justify-center">
                  <div className="w-10 h-10 bg-white rounded-full"></div>
                </div>
                <h3 className="text-xl font-bold text-white mb-2">Keystroke Analysis</h3>
                <p className="text-gray-400">Unique typing patterns identification</p>
              </div>
              <div className="text-center">
                <div className="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-red-500 to-red-700 rounded-full flex items-center justify-center">
                  <div className="w-10 h-10 bg-white rounded-full"></div>
                </div>
                <h3 className="text-xl font-bold text-white mb-2">Navigation Patterns</h3>
                <p className="text-gray-400">Behavioral flow mapping and analysis</p>
              </div>
              <div className="text-center">
                <div className="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-purple-500 to-purple-700 rounded-full flex items-center justify-center">
                  <div className="w-10 h-10 bg-white rounded-full"></div>
                </div>
                <h3 className="text-xl font-bold text-white mb-2">Session Biometrics</h3>
                <p className="text-gray-400">Real-time behavioral verification</p>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default BehaviorML;
