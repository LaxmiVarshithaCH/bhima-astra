import React from 'react';
import { motion } from 'framer-motion';

const Plans: React.FC = () => {
  const [selectedPlan, setSelectedPlan] = React.useState<string>('');
  const plans = [
    {
      id: 'starter',
      name: 'Starter',
      price: 49,
      emotional: 'Protection for every journey',
      features: [
        'Basic accident coverage',
        'Emergency response',
        'Mobile app access'
      ],
      color: 'bg-white'
    },
    {
      id: 'professional',
      name: 'Professional',
      price: 79,
      emotional: 'Peace of mind on the road',
      features: [
        'Everything in Starter',
        'Priority support',
        'Advanced analytics'
      ],
      color: 'bg-white'
    },
    {
      id: 'premium',
      name: 'Premium',
      price: 119,
      emotional: 'Complete safety net',
      features: [
        'Everything in Professional',
        'Custom coverage options',
        'Dedicated account manager'
      ],
      color: 'bg-white'
    }
  ];

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg-primary)' }}>
      <div className="max-w-6xl mx-auto py-20 px-4">
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
        >
          <h1 className="text-4xl md:text-6xl font-bold mb-4" style={{ color: 'var(--text-primary)' }}>
            Choose Your <span style={{ color: 'var(--primary-accent)' }}>Protection</span>
          </h1>
          <p className="text-xl" style={{ color: 'var(--text-secondary)' }}>
            Transparent pricing, instant protection
          </p>
        </motion.div>

        <div className="flex flex-col lg:flex-row gap-8 justify-center items-start">
          {plans.map((plan, index) => (
            <motion.div
              key={plan.id}
              className="relative p-8 rounded-2xl cursor-pointer transition-all duration-400"
              style={{ 
                backgroundColor: 'var(--bg-card)',
                boxShadow: 'var(--shadow-light) 0px 4px 12px',
                border: '1px solid rgba(0,0,0,0.05)'
              }}
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              onClick={() => setSelectedPlan(plan.id)}
              whileHover={{ 
                y: -10,
                scale: 1.05,
                backgroundColor: 'var(--bg-hover)',
                boxShadow: 'var(--shadow-medium) 0px 8px 24px'
              }}
              whileTap={{ scale: 0.98 }}
            >
              <div className="text-center mb-6">
                <h3 className="text-2xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>{plan.name}</h3>
                <div className="text-4xl md:text-5xl font-black mb-2" style={{ color: 'var(--primary-accent)' }}>
                  §{plan.price}
                  <span className="text-lg" style={{ color: 'var(--text-tertiary)' }}>/month</span>
                </div>
                <p className="text-sm italic" style={{ color: 'var(--text-tertiary)' }}>{plan.emotional}</p>
              </div>

              <ul className="space-y-3 mb-6">
                {plan.features.map((feature, featureIndex) => (
                  <motion.li
                    key={featureIndex}
                    className="flex items-center"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3, delay: index * 0.1 + featureIndex * 0.05 }}
                  >
                    <div 
                      className="w-2 h-2 rounded-full mr-3" 
                      style={{ backgroundColor: 'var(--primary-accent)' }}
                    />
                    <span style={{ color: 'var(--text-secondary)' }}>{feature}</span>
                  </motion.li>
                ))}
              </ul>

              <motion.button
                onClick={() => setSelectedPlan(plan.id)}
                className="w-full py-3 rounded-xl font-semibold transition-all duration-400"
                style={{
                  backgroundColor: selectedPlan === plan.id ? 'var(--primary-accent)' : 'var(--secondary-accent)',
                  color: 'white'
                }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                {selectedPlan === plan.id ? 'Selected' : `Choose ${plan.name}`}
              </motion.button>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Plans;
