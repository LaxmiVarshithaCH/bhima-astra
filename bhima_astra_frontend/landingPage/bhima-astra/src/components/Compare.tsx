import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, TrendingUp, Shield, Clock, Users, CheckCircle } from 'lucide-react';

const Compare: React.FC = () => {
  const [selectedPlan, setSelectedPlan] = useState<string>('starter');

  const plans = [
    {
      id: 'starter',
      name: 'Starter',
      price: 49,
      period: 'month',
      features: [
        'Basic accident coverage',
        'Emergency response',
        'Mobile app access',
        'Email support',
        'Up to ₹50,000 coverage'
      ],
      notIncluded: ['Phone support', 'Priority assistance', 'Advanced analytics'],
      recommended: false
    },
    {
      id: 'professional',
      name: 'Professional',
      price: 89,
      period: 'month',
      features: [
        'Everything in Starter',
        'Priority support',
        'Advanced analytics',
        'Phone support',
        'Up to ₹200,000 coverage',
        'Custom coverage options'
      ],
      notIncluded: ['Dedicated account manager', '24/7 phone support'],
      recommended: true
    },
    {
      id: 'premium',
      name: 'Premium',
      price: 112,
      period: 'month',
      features: [
        'Everything in Professional',
        'Custom coverage options',
        'Dedicated account manager',
        '24/7 phone support',
        'Up to ₹500,000 coverage',
        'White glove service'
      ],
      notIncluded: [],
      recommended: false
    }
  ];

  const weeklyEarnings = {
    starter: 1250,
    professional: 2225,
    premium: 2800
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-charcoal via-gray-900 to-black text-white py-20 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Back Button */}
        <motion.button
          onClick={() => window.history.back()}
          className="mb-8 flex items-center text-gray-400 hover:text-white transition-colors"
          whileHover={{ scale: 1.05 }}
        >
          <ArrowLeft className="w-5 h-5 mr-2" />
          Back to Home
        </motion.button>

        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
        >
          <h1 className="text-4xl md:text-6xl font-bold mb-4">
            Compare All <span className="text-hyper-lime">Plans</span>
          </h1>
          <p className="text-xl text-gray-300 mb-12">
            Find the perfect protection plan for your needs
          </p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
          {plans.map((plan, index) => (
            <motion.div
              key={plan.id}
              className={`relative p-8 rounded-3xl cursor-pointer transition-all duration-300 ${
                selectedPlan === plan.id 
                  ? 'bg-gradient-to-br from-safety-orange to-hyper-lime text-black scale-105' 
                  : 'glass hover:scale-105'
              }`}
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              onClick={() => setSelectedPlan(plan.id)}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              {plan.recommended && (
                <div className="absolute -top-4 -right-4 bg-hyper-lime text-black px-3 py-1 rounded-full text-sm font-bold">
                  RECOMMENDED
                </div>
              )}

              <div className="text-center mb-6">
                <h3 className="text-2xl font-bold text-white mb-2">{plan.name}</h3>
                <div className="text-4xl md:text-5xl font-black mb-4">
                  ₹{plan.price}
                  <span className="text-lg text-gray-400">/{plan.period}</span>
                </div>
                <p className="text-gray-400 mb-6">
                  Weekly earning potential: <span className="text-hyper-lime font-bold">₹{weeklyEarnings[plan.id as keyof typeof weeklyEarnings]}</span>
                </p>
              </div>

              <div className="space-y-3 mb-6">
                {plan.features.map((feature, featureIndex) => (
                  <motion.div
                    key={featureIndex}
                    className="flex items-center"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3, delay: featureIndex * 0.05 }}
                  >
                    <CheckCircle className="w-5 h-5 text-green-400 mr-3" />
                    <span className="text-gray-300">{feature}</span>
                  </motion.div>
                ))}
              </div>

              <div className="border-t border-gray-700 pt-6">
                <p className="text-sm text-gray-400 mb-3">Not included:</p>
                <div className="space-y-2">
                  {plan.notIncluded.map((item, itemIndex) => (
                    <motion.div
                      key={itemIndex}
                      className="flex items-center"
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.3, delay: itemIndex * 0.05 }}
                    >
                      <div className="w-2 h-2 bg-gray-600 rounded-full mr-3"></div>
                      <span className="text-gray-500 line-through">{item}</span>
                    </motion.div>
                  ))}
                </div>
              </div>

              <motion.button
                className={`w-full py-3 rounded-xl font-semibold transition-all duration-300 ${
                  selectedPlan === plan.id
                    ? 'bg-gradient-to-r from-safety-orange to-hyper-lime text-black'
                    : 'bg-safety-orange text-white hover:bg-hyper-lime hover:text-black'
                }`}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                {selectedPlan === plan.id ? 'Selected' : `Choose ${plan.name}`}
              </motion.button>
            </motion.div>
          ))}
        </div>

        {/* Dynamic Earnings Visualization */}
        <motion.div
          className="glass p-8 rounded-3xl"
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.6 }}
        >
          <h3 className="text-2xl font-bold text-white mb-6">Weekly Earning Potential</h3>
          
          <div className="space-y-4">
            {Object.entries(weeklyEarnings).map(([planId, earnings], index) => (
              <motion.div
                key={planId}
                className="flex items-center justify-between"
                initial={{ opacity: 0, x: -50 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
              >
                <div className="flex items-center">
                  <div className={`w-4 h-4 rounded-full mr-3 ${
                    planId === 'starter' ? 'bg-blue-500' :
                    planId === 'professional' ? 'bg-purple-500' :
                    'bg-green-500'
                  }`}></div>
                  <span className="text-white font-medium capitalize">{planId}</span>
                </div>
                
                <div className="text-right">
                  <div className="text-3xl font-bold text-white">&#8377;{earnings}</div>
                  <div className="text-sm text-gray-400">per week</div>
                </div>

                <motion.div
                  className="flex-1 h-2 bg-gray-700 rounded-full overflow-hidden"
                  initial={{ width: '0%' }}
                  animate={{ width: selectedPlan === planId ? '100%' : '0%' }}
                  transition={{ duration: 1, ease: 'easeOut' }}
                />
              </motion.div>
            ))}
          </div>

          <div className="grid grid-cols-3 gap-4 text-center text-sm text-gray-400">
            <div className="flex items-center">
              <TrendingUp className="w-4 h-4 mr-2 text-green-400" />
              <span>Based on 5 deliveries/day</span>
            </div>
            <div className="flex items-center">
              <Shield className="w-4 h-4 mr-2 text-blue-400" />
              <span>With 100% coverage rate</span>
            </div>
            <div className="flex items-center">
              <Clock className="w-4 h-4 mr-2 text-purple-400" />
              <span>Avg. 2 hours delivery time</span>
            </div>
          </div>
        </motion.div>

        {/* Action Buttons */}
        <div className="flex flex-col md:flex-row gap-4 justify-center">
          <motion.button
            onClick={() => window.history.back()}
            className="px-8 py-3 glass text-white rounded-xl font-semibold hover:bg-white hover:bg-opacity-10 transition-all duration-300 border border-white border-opacity-20"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            Back to Plans
          </motion.button>
          
          {selectedPlan && (
            <motion.button
              onClick={() => alert('Proceeding to payment...')}
              className="px-8 py-4 bg-gradient-to-r from-safety-orange to-hyper-lime text-black font-semibold rounded-xl hover:shadow-xl transition-all duration-300"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              Proceed with {plans.find(p => p.id === selectedPlan)?.name}
            </motion.button>
          )}
        </div>
      </div>
    </div>
  );
};

export default Compare;
