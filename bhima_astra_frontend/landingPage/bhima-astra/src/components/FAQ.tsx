import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Zap, Shield } from 'lucide-react';

const FAQ: React.FC = () => {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const faqData = [
    {
      question: "How does the BHIMA ASTRA 'Parametric Shield' differ from regular insurance?",
      answer: "Unlike traditional claims, our shield is data-triggered. It activates instantly when weather or civic data crosses risk thresholds."
    },
    {
      question: "What 'Civic Disruptions' does the platform monitor?",
      answer: "Real-time monitoring of road blockages, protests, and administrative lockdowns that prevent gig worker access."
    },
    {
      question: "How are payouts handled for hyper-local monsoons?",
      answer: "We identify grid-coordinates with extreme rainfall and automatically credit wallets of workers logged into those 'Red Zones'."
    },
    {
      question: "Does the platform integrate with Swiggy, Zepto, and Blinkit?",
      answer: "Yes, we track disruptions across all major quick-commerce platforms to ensure seamless coverage for partners."
    }
  ];

  const toggleAccordion = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <div className="py-20 px-4 bg-[#080808] min-h-screen">
      <div className="max-w-6xl mx-auto">
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
        >
          <h2 className="text-4xl md:text-7xl font-black mb-4">
            Frequently Asked <span className="text-[#CCFF00]">Questions</span>
          </h2>
          <p className="text-xl text-[#9CA3AF] max-w-3xl mx-auto">
            Everything you need to know about Bhima Astra
          </p>
        </motion.div>

        <div className="space-y-6 max-w-5xl mx-auto">
          {faqData.map((item, index) => (
            <motion.div
              key={index}
              className="rounded-2xl overflow-hidden border border-white/10"
              style={{
                backgroundColor: '#080808',
                boxShadow: '0px 8px 32px rgba(0,0,0,0.4)',
                border: '1px solid rgba(204,255,0,0.1)'
              }}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
            >
              <motion.button
                className="w-full p-8 text-left flex items-center justify-between"
                onClick={() => toggleAccordion(index)}
                whileHover={{ backgroundColor: 'rgba(204,255,0,0.05)' }}
                transition={{ duration: 0.3 }}
              >
                <div className="flex items-center space-x-4">
                  <div className="flex items-center space-x-3">
                    {openIndex === index ? (
                      <Zap className="w-6 h-6 text-[#CCFF00] fill-[#CCFF00]" />
                    ) : (
                      <Shield className="w-6 h-6 text-gray-400" />
                    )}
                  </div>
                  <h3 
                    className="text-xl font-black"
                  >
                    {item.question}
                  </h3>
                </div>
                <motion.div
                  className="flex-shrink-0"
                  animate={{ rotate: openIndex === index ? 180 : 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <ChevronDown 
                    size={24} 
                    className={openIndex === index ? "text-[#CCFF00]" : "text-gray-400"}
                  />
                </motion.div>
              </motion.button>

              <AnimatePresence>
                {openIndex === index && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.5, ease: 'easeInOut' }}
                    style={{ overflow: 'hidden' }}
                  >
                    <div 
                      className="px-8 pb-8"
                    >
                      <p className="text-lg leading-relaxed text-[#9CA3AF]">
                        {item.answer}
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>

        {/* Contact Support CTA */}
        <motion.div
          className="mt-20 text-center"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
        >
          <div 
            className="inline-block p-8 rounded-2xl border-2"
            style={{
              background: 'linear-gradient(135deg, #CCFF00, transparent)',
              borderImage: 'linear-gradient(90deg, #CCFF00, #CCFF00 1px, transparent 1px, #CCFF00 2px, transparent 2px)'
            }}
          >
            <a 
              href="mailto:2300032732cseird@gmail.com"
              className="text-black font-bold text-lg hover:underline"
            >
              Contact Support
            </a>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default FAQ;