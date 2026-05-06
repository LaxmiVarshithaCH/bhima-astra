import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, AlertTriangle, Thermometer, Cloud, Car, Users, Wind, Droplets, Zap } from 'lucide-react';

interface StateData {
  id: string;
  name: string;
  color: string;
  problems: string[];
  icon: any;
  stats: { label: string; value: string }[];
}

const StateGrid: React.FC = () => {
  const [selectedState, setSelectedState] = useState<string | null>(null);

  const states: StateData[] = [
    {
      id: 'andhra',
      name: 'Andhra Pradesh',
      color: 'clay-purple',
      problems: ['Cyclone risks during monsoon season', 'Heat waves affecting delivery workers', 'Poor road conditions in rural areas'],
      icon: Wind,
      stats: [
        { label: 'Workers Protected', value: '45K+' },
        { label: 'Emergency Response', value: '< 3min' },
        { label: 'Coverage Rate', value: '92%' }
      ]
    },
    {
      id: 'arunachal',
      name: 'Arunachal Pradesh',
      color: 'clay-mint',
      problems: ['Landslides blocking delivery routes', 'Extreme weather conditions', 'Limited emergency services'],
      icon: Cloud,
      stats: [
        { label: 'Workers Protected', value: '8K+' },
        { label: 'Emergency Response', value: '< 8min' },
        { label: 'Coverage Rate', value: '78%' }
      ]
    },
    {
      id: 'assam',
      name: 'Assam',
      color: 'clay-coral',
      problems: ['Severe flooding during monsoons', 'Poor infrastructure in remote areas', 'Wildlife hazards on delivery routes'],
      icon: Droplets,
      stats: [
        { label: 'Workers Protected', value: '32K+' },
        { label: 'Emergency Response', value: '< 5min' },
        { label: 'Coverage Rate', value: '85%' }
      ]
    },
    {
      id: 'bihar',
      name: 'Bihar',
      color: 'clay-purple',
      problems: ['Extreme heat waves in summer', 'Frequent power outages', 'Overcrowded urban delivery zones'],
      icon: Thermometer,
      stats: [
        { label: 'Workers Protected', value: '58K+' },
        { label: 'Emergency Response', value: '< 4min' },
        { label: 'Coverage Rate', value: '88%' }
      ]
    },
    {
      id: 'chhattisgarh',
      name: 'Chhattisgarh',
      color: 'clay-mint',
      problems: ['Naxalite affected areas', 'Mining region hazards', 'Poor road connectivity'],
      icon: AlertTriangle,
      stats: [
        { label: 'Workers Protected', value: '12K+' },
        { label: 'Emergency Response', value: '< 7min' },
        { label: 'Coverage Rate', value: '76%' }
      ]
    },
    {
      id: 'goa',
      name: 'Goa',
      color: 'clay-coral',
      problems: ['Heavy tourist traffic congestion', 'Monsoon flooding', 'Coastal weather risks'],
      icon: Cloud,
      stats: [
        { label: 'Workers Protected', value: '15K+' },
        { label: 'Emergency Response', value: '< 2min' },
        { label: 'Coverage Rate', value: '94%' }
      ]
    },
    {
      id: 'gujarat',
      name: 'Gujarat',
      color: 'clay-purple',
      problems: ['Extreme summer temperatures', 'Industrial zone accidents', 'Desert sand storms'],
      icon: Thermometer,
      stats: [
        { label: 'Workers Protected', value: '68K+' },
        { label: 'Emergency Response', value: '< 3min' },
        { label: 'Coverage Rate', value: '91%' }
      ]
    },
    {
      id: 'haryana',
      name: 'Haryana',
      color: 'clay-mint',
      problems: ['Severe fog conditions', 'Industrial accidents', 'Agricultural zone hazards'],
      icon: Cloud,
      stats: [
        { label: 'Workers Protected', value: '42K+' },
        { label: 'Emergency Response', value: '< 3min' },
        { label: 'Coverage Rate', value: '89%' }
      ]
    },
    {
      id: 'himachal',
      name: 'Himachal Pradesh',
      color: 'clay-coral',
      problems: ['Hilly terrain accidents', 'Snowfall blocking routes', 'Landslide risks'],
      icon: Wind,
      stats: [
        { label: 'Workers Protected', value: '18K+' },
        { label: 'Emergency Response', value: '< 10min' },
        { label: 'Coverage Rate', value: '72%' }
      ]
    },
    {
      id: 'jharkhand',
      name: 'Jharkhand',
      color: 'clay-purple',
      problems: ['Mining area hazards', 'Forest fires affecting routes', 'Tribal region access issues'],
      icon: AlertTriangle,
      stats: [
        { label: 'Workers Protected', value: '25K+' },
        { label: 'Emergency Response', value: '< 6min' },
        { label: 'Coverage Rate', value: '81%' }
      ]
    },
    {
      id: 'karnataka',
      name: 'Karnataka',
      color: 'clay-mint',
      problems: ['Bangalore traffic congestion', 'Air pollution affecting health', 'IT corridor delivery pressures'],
      icon: Car,
      stats: [
        { label: 'Workers Protected', value: '85K+' },
        { label: 'Emergency Response', value: '< 2min' },
        { label: 'Coverage Rate', value: '93%' }
      ]
    },
    {
      id: 'kerala',
      name: 'Kerala',
      color: 'clay-coral',
      problems: ['Heavy monsoon flooding', 'Coastal erosion', 'High humidity health issues'],
      icon: Droplets,
      stats: [
        { label: 'Workers Protected', value: '38K+' },
        { label: 'Emergency Response', value: '< 4min' },
        { label: 'Coverage Rate', value: '87%' }
      ]
    },
    {
      id: 'madhya',
      name: 'Madhya Pradesh',
      color: 'clay-purple',
      problems: ['Extreme temperature variations', 'Tribal area access', 'Wildlife corridor risks'],
      icon: Thermometer,
      stats: [
        { label: 'Workers Protected', value: '52K+' },
        { label: 'Emergency Response', value: '< 5min' },
        { label: 'Coverage Rate', value: '83%' }
      ]
    },
    {
      id: 'maharashtra',
      name: 'Maharashtra',
      color: 'clay-mint',
      problems: ['Mumbai monsoon flooding', 'Industrial zone accidents', 'High urban density risks'],
      icon: Cloud,
      stats: [
        { label: 'Workers Protected', value: '95K+' },
        { label: 'Emergency Response', value: '< 2min' },
        { label: 'Coverage Rate', value: '91%' }
      ]
    },
    {
      id: 'manipur',
      name: 'Manipur',
      color: 'clay-coral',
      problems: ['Hilly terrain challenges', 'Landslide prone areas', 'Limited emergency infrastructure'],
      icon: Wind,
      stats: [
        { label: 'Workers Protected', value: '8K+' },
        { label: 'Emergency Response', value: '< 12min' },
        { label: 'Coverage Rate', value: '68%' }
      ]
    },
    {
      id: 'meghalaya',
      name: 'Meghalaya',
      color: 'clay-purple',
      problems: ['Heavy rainfall flooding', 'Hilly delivery challenges', 'Limited road networks'],
      icon: Droplets,
      stats: [
        { label: 'Workers Protected', value: '6K+' },
        { label: 'Emergency Response', value: '< 15min' },
        { label: 'Coverage Rate', value: '71%' }
      ]
    },
    {
      id: 'mizoram',
      name: 'Mizoram',
      color: 'clay-mint',
      problems: ['Landslide zones', 'Heavy monsoon impact', 'Remote area access'],
      icon: AlertTriangle,
      stats: [
        { label: 'Workers Protected', value: '4K+' },
        { label: 'Emergency Response', value: '< 18min' },
        { label: 'Coverage Rate', value: '74%' }
      ]
    },
    {
      id: 'nagaland',
      name: 'Nagaland',
      color: 'clay-coral',
      problems: ['Hilly terrain accidents', 'Tribal region challenges', 'Limited healthcare access'],
      icon: Wind,
      stats: [
        { label: 'Workers Protected', value: '5K+' },
        { label: 'Emergency Response', value: '< 20min' },
        { label: 'Coverage Rate', value: '69%' }
      ]
    },
    {
      id: 'odisha',
      name: 'Odisha',
      color: 'clay-purple',
      problems: ['Cyclone prone areas', 'Coastal weather risks', 'Mining region hazards'],
      icon: Zap,
      stats: [
        { label: 'Workers Protected', value: '28K+' },
        { label: 'Emergency Response', value: '< 4min' },
        { label: 'Coverage Rate', value: '82%' }
      ]
    },
    {
      id: 'punjab',
      name: 'Punjab',
      color: 'clay-mint',
      problems: ['Extreme fog conditions', 'Agricultural zone accidents', 'Industrial pollution'],
      icon: Cloud,
      stats: [
        { label: 'Workers Protected', value: '48K+' },
        { label: 'Emergency Response', value: '< 3min' },
        { label: 'Coverage Rate', value: '90%' }
      ]
    },
    {
      id: 'rajasthan',
      name: 'Rajasthan',
      color: 'clay-coral',
      problems: ['Extreme desert heat waves', 'Sand storms affecting visibility', 'Water scarcity for workers'],
      icon: Thermometer,
      stats: [
        { label: 'Workers Protected', value: '35K+' },
        { label: 'Emergency Response', value: '< 6min' },
        { label: 'Coverage Rate', value: '78%' }
      ]
    },
    {
      id: 'sikkim',
      name: 'Sikkim',
      color: 'clay-purple',
      problems: ['Himalayan terrain risks', 'Landslide zones', 'Extreme weather variations'],
      icon: Wind,
      stats: [
        { label: 'Workers Protected', value: '3K+' },
        { label: 'Emergency Response', value: '< 25min' },
        { label: 'Coverage Rate', value: '65%' }
      ]
    },
    {
      id: 'tamil',
      name: 'Tamil Nadu',
      color: 'clay-mint',
      problems: ['Extreme heat conditions', 'Coastal cyclone risks', 'Urban traffic congestion'],
      icon: Car,
      stats: [
        { label: 'Workers Protected', value: '78K+' },
        { label: 'Emergency Response', value: '< 3min' },
        { label: 'Coverage Rate', value: '89%' }
      ]
    },
    {
      id: 'telangana',
      name: 'Telangana',
      color: 'clay-coral',
      problems: ['Hyderabad traffic congestion', 'Extreme summer temperatures', 'IT corridor pressures'],
      icon: Thermometer,
      stats: [
        { label: 'Workers Protected', value: '62K+' },
        { label: 'Emergency Response', value: '< 2min' },
        { label: 'Coverage Rate', value: '92%' }
      ]
    },
    {
      id: 'tripura',
      name: 'Tripura',
      color: 'clay-purple',
      problems: ['Hilly terrain challenges', 'Monsoon flooding', 'Limited infrastructure'],
      icon: Cloud,
      stats: [
        { label: 'Workers Protected', value: '7K+' },
        { label: 'Emergency Response', value: '< 12min' },
        { label: 'Coverage Rate', value: '73%' }
      ]
    },
    {
      id: 'uttar',
      name: 'Uttar Pradesh',
      color: 'clay-mint',
      problems: ['Extreme weather variations', 'High population density risks', 'Agricultural zone hazards'],
      icon: Users,
      stats: [
        { label: 'Workers Protected', value: '120K+' },
        { label: 'Emergency Response', value: '< 4min' },
        { label: 'Coverage Rate', value: '86%' }
      ]
    },
    {
      id: 'uttarakhand',
      name: 'Uttarakhand',
      color: 'clay-coral',
      problems: ['Himalayan terrain risks', 'Landslide prone areas', 'Limited emergency access'],
      icon: Wind,
      stats: [
        { label: 'Workers Protected', value: '15K+' },
        { label: 'Emergency Response', value: '< 8min' },
        { label: 'Coverage Rate', value: '77%' }
      ]
    },
    {
      id: 'westbengal',
      name: 'West Bengal',
      color: 'clay-purple',
      problems: ['Heavy monsoon flooding', 'Urban traffic congestion', 'Industrial zone accidents'],
      icon: Droplets,
      stats: [
        { label: 'Workers Protected', value: '88K+' },
        { label: 'Emergency Response', value: '< 3min' },
        { label: 'Coverage Rate', value: '84%' }
      ]
    }
  ];

  const selectedStateData = states.find(state => state.id === selectedState);

  return (
    <div className="py-20 px-4 bg-gradient-to-b from-black to-charcoal">
      <div className="max-w-7xl mx-auto">
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: 50 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
        >
          <h2 className="text-4xl md:text-6xl font-bold mb-4">
            <span className="text-white">28 </span>
            <span className="text-hyper-lime">states</span>
          </h2>
          <p className="text-xl text-gray-400 max-w-3xl mx-auto">
            Every delivery has a struggle. Click on any state to explore regional challenges
          </p>
        </motion.div>

        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 mb-12">
          {states.map((state, index) => (
            <motion.div
              key={state.id}
              className={`claymorphic ${state.color} p-4 cursor-pointer relative overflow-hidden glow-effect`}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.05 }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setSelectedState(state.id)}
            >
              <div className="text-center">
                <state.icon className="w-6 h-6 mx-auto mb-2 text-white opacity-80" />
                <h3 className="text-sm font-semibold text-white mb-1 line-clamp-2">
                  {state.name}
                </h3>
                <div className="text-xs text-white opacity-70">
                  {state.stats[0].value} workers
                </div>
              </div>
              
              {/* Pressed effect overlay */}
              <motion.div
                className="absolute inset-0 bg-black bg-opacity-20"
                initial={{ opacity: 0 }}
                animate={{ opacity: selectedState === state.id ? 1 : 0 }}
                transition={{ duration: 0.2 }}
              />
            </motion.div>
          ))}
        </div>

        {/* State Details Modal */}
        <AnimatePresence>
          {selectedStateData && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.3 }}
              className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 p-4"
              onClick={() => setSelectedState(null)}
            >
              <motion.div
                className="glass p-8 rounded-3xl max-w-2xl w-full max-h-[80vh] overflow-y-auto"
                initial={{ opacity: 0, y: 50 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 50 }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-start justify-between mb-6">
                  <div className="flex items-center">
                    <div className={`p-3 rounded-2xl mr-4 ${selectedStateData.color}`}>
                      <selectedStateData.icon className="w-8 h-8 text-white" />
                    </div>
                    <div>
                      <h3 className="text-2xl font-bold text-white mb-2">
                        {selectedStateData.name} - Regional Challenges
                      </h3>
                      <p className="text-gray-400">
                        Specific problems faced by gig workers in this region
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedState(null)}
                    className="text-gray-400 hover:text-white transition-colors"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <div className="space-y-3 mb-6">
                  {selectedStateData.problems.map((problem, index) => (
                    <div key={index} className="flex items-start">
                      <MapPin className="w-4 h-4 text-safety-orange mr-3 flex-shrink-0 mt-1" />
                      <p className="text-gray-300 text-sm leading-relaxed">{problem}</p>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-3 gap-4 pt-6 border-t border-gray-800">
                  {selectedStateData.stats.map((stat, index) => (
                    <div key={index} className="text-center">
                      <div className="text-xl font-bold text-hyper-lime mb-1">{stat.value}</div>
                      <div className="text-xs text-gray-400">{stat.label}</div>
                    </div>
                  ))}
                </div>

                <motion.button
                  className="w-full py-3 bg-gradient-to-r from-safety-orange to-hyper-lime text-black font-semibold rounded-xl hover:shadow-xl transition-all duration-300"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  Learn About Protection in {selectedStateData.name}
                </motion.button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Nationwide Stats */}
        <motion.div
          className="text-center"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, delay: 0.5 }}
        >
          <div className="glass p-8 rounded-3xl max-w-4xl mx-auto">
            <h3 className="text-2xl font-bold text-white mb-6">
              Nationwide Protection Impact
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div className="text-center">
                <div className="text-3xl font-bold text-safety-orange mb-2">28</div>
                <div className="text-sm text-gray-400">States Covered</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-hyper-lime mb-2">500K+</div>
                <div className="text-sm text-gray-400">Workers Protected</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-blue-400 mb-2">10K+</div>
                <div className="text-sm text-gray-400">Claims Processed</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-purple-400 mb-2">98%</div>
                <div className="text-sm text-gray-400">Satisfaction Rate</div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default StateGrid;
