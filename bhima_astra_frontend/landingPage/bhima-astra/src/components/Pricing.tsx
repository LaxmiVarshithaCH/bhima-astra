import React from 'react';
import { motion } from 'framer-motion';
import { Check, Star, Shield, Zap } from 'lucide-react';

const Pricing: React.FC = () => {
  const plans = [
    {
      price: "49",
      title: "Starter",
      description: "Perfect for individual gig workers",
      features: [
        "Accident coverage up to ₹1,00,000",
        "24/7 emergency support",
        "Instant claim processing",
        "Basic health checkups",
        "Monthly safety reports"
      ],
      highlighted: false,
      icon: Shield
    },
    {
      price: "79",
      title: "Professional",
      description: "Ideal for full-time delivery partners",
      features: [
        "Accident coverage up to ₹2,50,000",
        "Priority emergency response",
        "Instant claim processing",
        "Comprehensive health checkups",
        "Weekly safety insights",
        "Family coverage add-on",
        "Vehicle protection"
      ],
      highlighted: true,
      icon: Star
    },
    {
      price: "119",
      title: "Premium",
      description: "Maximum protection for top performers",
      features: [
        "Accident coverage up to ₹5,00,000",
        "VIP emergency response",
        "Instant claim processing",
        "Premium health checkups",
        "Real-time safety analytics",
        "Full family coverage",
        "Complete vehicle protection",
        "Income protection benefits",
        "Legal assistance"
      ],
      highlighted: false,
      icon: Zap
    }
  ];

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
          <h2 className="text-4xl md:text-6xl font-bold mb-4">
            <span className="text-white">Simple </span>
            <span className="text-safety-orange">Transparent Pricing</span>
          </h2>
          <p className="text-xl text-gray-400 max-w-3xl mx-auto">
            No hidden fees, no complex terms. Just straightforward protection that works when you need it most.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {plans.map((plan, index) => (
            <motion.div
              key={index}
              className={`relative ${
                plan.highlighted 
                  ? 'ring-2 ring-safety-orange ring-offset-4 ring-offset-charcoal scale-105' 
                  : ''
              }`}
              initial={{ opacity: 0, y: 50 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              whileHover={{ y: -10 }}
            >
              {plan.highlighted && (
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                  <div className="bg-safety-orange text-black px-4 py-1 rounded-full text-sm font-semibold">
                    MOST POPULAR
                  </div>
                </div>
              )}

              <div className={`glass p-8 rounded-3xl h-full ${
                plan.highlighted ? 'bg-gradient-to-b from-safety-orange from-opacity-5 to-transparent' : ''
              }`}>
                <div className="text-center mb-8">
                  <div className={`inline-flex p-3 rounded-full mb-4 ${
                    plan.highlighted ? 'bg-safety-orange bg-opacity-20' : 'bg-gray-800'
                  }`}>
                    <plan.icon className={`w-8 h-8 ${
                      plan.highlighted ? 'text-safety-orange' : 'text-gray-400'
                    }`} />
                  </div>
                  
                  <h3 className="text-2xl font-bold text-white mb-2">{plan.title}</h3>
                  <p className="text-gray-400 mb-6">{plan.description}</p>
                  
                  <div className="mb-6">
                    <div className="text-5xl font-black text-white mb-2">
                      ₹{plan.price}
                      <span className="text-lg font-normal text-gray-400">/month</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-4 mb-8">
                  {plan.features.map((feature, featureIndex) => (
                    <div key={featureIndex} className="flex items-start">
                      <Check className="w-5 h-5 text-hyper-lime mr-3 flex-shrink-0 mt-0.5" />
                      <span className="text-gray-300 text-sm">{feature}</span>
                    </div>
                  ))}
                </div>

                <motion.button
                  className={`w-full py-4 rounded-xl font-semibold transition-all duration-300 ${
                    plan.highlighted
                      ? 'bg-gradient-to-r from-safety-orange to-hyper-lime text-black hover:shadow-xl'
                      : 'glass text-white hover:bg-white hover:bg-opacity-10 border border-gray-700'
                  }`}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  {plan.highlighted ? 'Get Started Now' : 'Choose Plan'}
                </motion.button>
              </div>
            </motion.div>
          ))}
        </div>

        <motion.div
          className="mt-16 text-center"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, delay: 0.5 }}
        >
          <div className="glass p-8 rounded-3xl max-w-4xl mx-auto">
            <h3 className="text-2xl font-bold text-white mb-4">
              Not sure which plan is right for you?
            </h3>
            <p className="text-gray-400 mb-6">
              Our team is here to help you choose the perfect coverage for your needs.
            </p>
            <div className="flex flex-col md:flex-row gap-4 justify-center">
              <motion.button
                className="px-6 py-3 bg-safety-orange text-black font-semibold rounded-xl hover:bg-hyper-lime transition-colors"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                Get Free Consultation
              </motion.button>
              <motion.button
                className="px-6 py-3 glass text-white font-semibold rounded-xl hover:bg-white hover:bg-opacity-10 transition-colors"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                Compare All Plans
              </motion.button>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default Pricing;
