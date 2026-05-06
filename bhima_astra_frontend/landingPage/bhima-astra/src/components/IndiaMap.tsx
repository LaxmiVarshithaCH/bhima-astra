import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, AlertTriangle, Thermometer, Cloud, Car } from 'lucide-react';

const IndiaMap: React.FC = () => {
  const [selectedState, setSelectedState] = useState<string | null>(null);

  const stateData: { [key: string]: { 
    title: string; 
    challenges: string[]; 
    icon: any; 
    color: string;
    stats: { label: string; value: string }[];
  }} = {
    rajasthan: {
      title: "Rajasthan - Extreme Heat Challenges",
      challenges: [
        "Temperatures soar above 45°C during summer months",
        "Dehydration and heatstroke risks for delivery workers",
        "Vehicle breakdowns due to extreme heat",
        "Limited shade and rest areas in desert regions"
      ],
      icon: Thermometer,
      color: "#FF6B35",
      stats: [
        { label: "Workers Affected", value: "25K+" },
        { label: "Heat Incidents", value: "1.2K/year" },
        { label: "Coverage Uptake", value: "78%" }
      ]
    },
    karnataka: {
      title: "Karnataka - Urban Traffic Hazards",
      challenges: [
        "Bangalore's notorious traffic congestion",
        "Air pollution affecting respiratory health",
        "Accident hotspots in tech corridors",
        "Parking challenges for delivery vehicles"
      ],
      icon: Car,
      color: "#8B5CF6",
      stats: [
        { label: "Active Workers", value: "45K+" },
        { label: "Traffic Incidents", value: "3.5K/year" },
        { label: "Response Time", value: "< 3min" }
      ]
    },
    maharashtra: {
      title: "Maharashtra - Monsoon Flooding",
      challenges: [
        "Mumbai's annual monsoon flooding",
        "Waterlogged roads causing accidents",
        "Visibility issues during heavy rains",
        "Electrical hazards during floods"
      ],
      icon: Cloud,
      color: "#06B6D4",
      stats: [
        { label: "Workers Protected", value: "60K+" },
        { label: "Monsoon Claims", value: "2.8K/year" },
        { label: "Emergency Response", value: "24/7" }
      ]
    },
    delhi: {
      title: "Delhi - Air Quality Crisis",
      challenges: [
        "Severe air pollution in winter months",
        "Respiratory issues for outdoor workers",
        "Reduced visibility causing accidents",
        "Health complications from prolonged exposure"
      ],
      icon: AlertTriangle,
      color: "#F59E0B",
      stats: [
        { label: "At Risk Workers", value: "35K+" },
        { label: "Health Claims", value: "1.8K/year" },
        { label: "Protection Rate", value: "82%" }
      ]
    }
  };

  const states = [
    { id: 'rajasthan', path: 'M 250 100 L 400 100 L 400 200 L 350 250 L 250 200 Z', name: 'Rajasthan' },
    { id: 'karnataka', path: 'M 200 350 L 300 350 L 300 450 L 200 450 Z', name: 'Karnataka' },
    { id: 'maharashtra', path: 'M 150 280 L 250 280 L 250 380 L 150 380 Z', name: 'Maharashtra' },
    { id: 'delhi', path: 'M 380 180 L 420 180 L 420 220 L 380 220 Z', name: 'Delhi' }
  ];

  const selectedStateData = selectedState ? stateData[selectedState] : null;

  return (
    <div className="py-20 px-4 bg-gradient-to-b from-black to-[#121212]">
      <div className="max-w-7xl mx-auto">

        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: 50 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
        >
          <h2 className="text-4xl md:text-6xl font-bold mb-4">
            <span className="text-white">Interactive </span>
            <span className="text-[#FF5F1F]">India Map</span>
          </h2>
          <p className="text-xl text-gray-400 max-w-3xl mx-auto">
            Click on highlighted states to explore real-world challenges faced by gig workers
          </p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          {/* Map Side */}
          <motion.div
            className="relative"
            initial={{ opacity: 0, x: -50 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8 }}
          >
            <div className="glass p-8 rounded-3xl bg-white/5 backdrop-blur-md border border-white/10">
              <svg viewBox="0 0 500 500" className="w-full h-auto">
                {/* Background India Shape Representation */}
                <path
                  d="M 250 50 L 400 80 L 450 150 L 430 250 L 400 350 L 350 420 L 250 450 L 150 420 L 100 350 L 70 250 L 50 150 L 100 80 Z"
                  fill="#1a1a1a"
                  stroke="#333"
                  strokeWidth="2"
                />

                {states.map((state) => (
                  <motion.path
                    key={state.id}
                    d={state.path}
                    fill={selectedState === state.id ? stateData[state.id]?.color : '#2a2a2a'}
                    stroke={selectedState === state.id ? '#fff' : '#444'}
                    strokeWidth={selectedState === state.id ? "3" : "1"}
                    className="cursor-pointer"
                    whileHover={{ scale: 1.05, fillOpacity: 0.8 }}
                    onClick={() => setSelectedState(state.id)}
                  />
                ))}
              </svg>
            </div>
          </motion.div>

          {/* Info Side */}
          <div className="min-h-[400px] flex items-center">
            <AnimatePresence mode="wait">
              {selectedStateData ? (
                <motion.div
                  key={selectedState}
                  className="glass p-8 rounded-3xl w-full bg-white/5 backdrop-blur-md border border-white/10"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.4 }}
                >
                  <div className="flex items-center gap-4 mb-6">
                    <div className="p-3 rounded-xl bg-white/10">
                      <selectedStateData.icon className="w-8 h-8" style={{ color: selectedStateData.color }} />
                    </div>
                    <h3 className="text-2xl font-bold text-white">
                      {selectedStateData.title}
                    </h3>
                  </div>

                  <div className="space-y-4 mb-8">
                    {selectedStateData.challenges.map((c, i) => (
                      <div key={i} className="flex items-start gap-3">
                        <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[#CCFF00]" />
                        <p className="text-gray-300">{c}</p>
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-3 gap-4 pt-6 border-t border-white/10">
                    {selectedStateData.stats.map((s, i) => (
                      <div key={i} className="text-center">
                        <div className="text-xl font-bold text-white">{s.value}</div>
                        <div className="text-gray-400 text-xs uppercase tracking-wider">{s.label}</div>
                      </div>
                    ))}
                  </div>
                </motion.div>
              ) : (
                <motion.div 
                  className="text-center w-full p-12 border-2 border-dashed border-white/10 rounded-3xl"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                >
                  <MapPin className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                  <p className="text-gray-500 text-lg">Select a highlighted state to see local impact data</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
};

export default IndiaMap;