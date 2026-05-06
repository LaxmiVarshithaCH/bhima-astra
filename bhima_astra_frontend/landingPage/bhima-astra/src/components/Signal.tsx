import React from 'react';
import { motion } from 'framer-motion';

const Signal: React.FC = () => {
  return (
    <section className="relative py-20 px-4 bg-gradient-to-b from-black to-charcoal sticky-section">
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
              <span className="text-gray-500 text-sm">STAGE 01</span>
              <h2 className="text-white text-lg font-semibold">SIGNAL</h2>
            </div>
            
            {/* Large background number */}
            <div className="absolute inset-0 flex items-center justify-center opacity-10 pointer-events-none">
              <span className="text-9xl font-black text-white">01</span>
            </div>
            
            {/* Main content */}
            <div className="relative z-10">
              <h2 className="text-4xl md:text-6xl font-bold mb-6 text-center">
                <span className="text-white">SIGNAL</span>
              </h2>
              <p className="text-xl text-gray-300 mb-8 max-w-3xl mx-auto leading-relaxed">
                Real-time anomaly detection in transaction patterns. 
                Advanced algorithms identify suspicious activities instantly.
              </p>
              
              {/* Tags */}
              <div className="flex flex-wrap justify-center gap-4">
                <motion.div
                  className="px-6 py-3 bg-gray-900 rounded-full text-white font-semibold border border-gray-700"
                  whileHover={{ scale: 1.05, backgroundColor: "#2a2a2a" }}
                  whileTap={{ scale: 0.95 }}
                >
                  250MS
                </motion.div>
                <motion.div
                  className="px-6 py-3 bg-gray-900 rounded-full text-white font-semibold border border-gray-700"
                  whileHover={{ scale: 1.05, backgroundColor: "#2a2a2a" }}
                  whileTap={{ scale: 0.95 }}
                >
                  99.9% ACC
                </motion.div>
                <motion.div
                  className="px-6 py-3 bg-gray-900 rounded-full text-white font-semibold border border-gray-700"
                  whileHover={{ scale: 1.05, backgroundColor: "#2a2a2a" }}
                  whileTap={{ scale: 0.95 }}
                >
                  1.2M TX
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
                <div className="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-blue-500 to-blue-700 rounded-full flex items-center justify-center">
                  <div className="w-10 h-10 bg-white rounded-full"></div>
                </div>
                <h3 className="text-xl font-bold text-white mb-2">Pattern Recognition</h3>
                <p className="text-gray-400">Advanced anomaly detection</p>
              </div>
              <div className="text-center">
                <div className="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-green-500 to-green-700 rounded-full flex items-center justify-center">
                  <div className="w-10 h-10 bg-white rounded-full"></div>
                </div>
                <h3 className="text-xl font-bold text-white mb-2">Real-time Analysis</h3>
                <p className="text-gray-400">Instant threat identification</p>
              </div>
              <div className="text-center">
                <div className="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-purple-500 to-purple-700 rounded-full flex items-center justify-center">
                  <div className="w-10 h-10 bg-white rounded-full"></div>
                </div>
                <h3 className="text-xl font-bold text-white mb-2">Machine Learning</h3>
                <p className="text-gray-400">Continuous pattern learning</p>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default Signal;
