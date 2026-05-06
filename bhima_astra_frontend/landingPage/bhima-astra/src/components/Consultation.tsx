import React from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Users, Shield, Clock } from 'lucide-react';

const Consultation: React.FC = () => {
  const teamLeader = {
    name: 'Dr. Rajesh Kumar',
    role: 'CEO & Founder',
    linkedin: 'https://www.linkedin.com/in/rajesh-kumar-bhima-astra',
    image: '/team-leader.jpg',
    expertise: ['20+ years in insurance', 'Gig economy pioneer', 'Digital transformation expert']
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-charcoal via-gray-900 to-black text-white py-20 px-4">
      <div className="max-w-6xl mx-auto">
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
            Free <span className="text-hyper-lime">Consultation</span>
          </h1>
          <p className="text-xl text-gray-300 mb-12">
            Schedule a free consultation with our team leader to discuss your protection needs
          </p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* Team Leader Profile */}
          <motion.div
            className="glass p-8 rounded-3xl"
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
          >
            <div className="flex items-center mb-6">
              <img
                src={teamLeader.image}
                alt={teamLeader.name}
                className="w-32 h-32 rounded-full object-cover border-4 border-safety-orange"
              />
              <div className="ml-6">
                <h2 className="text-2xl font-bold text-white mb-2">{teamLeader.name}</h2>
                <p className="text-gray-400 mb-4">{teamLeader.role}</p>
                <motion.a
                  href={teamLeader.linkedin}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center px-4 py-2 bg-safety-orange text-white rounded-lg hover:bg-hyper-lime transition-colors"
                  whileHover={{ scale: 1.05 }}
                >
                  <Users className="w-4 h-4 mr-2" />
                  Connect on LinkedIn
                </motion.a>
              </div>
            </div>

            <div className="space-y-4">
              {teamLeader.expertise.map((skill, index) => (
                <motion.div
                  key={index}
                  className="flex items-center"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.5, delay: 0.4 + index * 0.1 }}
                >
                  <Shield className="w-5 h-5 text-safety-orange mr-3" />
                  <span className="text-gray-300">{skill}</span>
                </motion.div>
              ))}
            </div>

            <motion.button
              className="w-full py-3 bg-gradient-to-r from-safety-orange to-hyper-lime text-black font-semibold rounded-xl hover:shadow-xl transition-all duration-300"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              Schedule Free Consultation
            </motion.button>
          </motion.div>

          {/* Consultation Form */}
          <motion.div
            className="glass p-8 rounded-3xl"
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
          >
            <h3 className="text-2xl font-bold text-white mb-6">Book Your Consultation</h3>
            
            <form className="space-y-6">
              <div>
                <label className="block text-gray-400 mb-2">Full Name</label>
                <input
                  type="text"
                  className="w-full px-4 py-3 bg-gray-800 text-white rounded-lg border border-gray-700 focus:border-hyper-lime focus:outline-none"
                  placeholder="Enter your full name"
                />
              </div>

              <div>
                <label className="block text-gray-400 mb-2">Email Address</label>
                <input
                  type="email"
                  className="w-full px-4 py-3 bg-gray-800 text-white rounded-lg border border-gray-700 focus:border-hyper-lime focus:outline-none"
                  placeholder="your.email@example.com"
                />
              </div>

              <div>
                <label className="block text-gray-400 mb-2">Phone Number</label>
                <input
                  type="tel"
                  className="w-full px-4 py-3 bg-gray-800 text-white rounded-lg border border-gray-700 focus:border-hyper-lime focus:outline-none"
                  placeholder="+91 98765 43210"
                />
              </div>

              <div>
                <label className="block text-gray-400 mb-2">Preferred Date</label>
                <input
                  type="datetime-local"
                  className="w-full px-4 py-3 bg-gray-800 text-white rounded-lg border border-gray-700 focus:border-hyper-lime focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-gray-400 mb-2">Message</label>
                <textarea
                  rows={4}
                  className="w-full px-4 py-3 bg-gray-800 text-white rounded-lg border border-gray-700 focus:border-hyper-lime focus:outline-none"
                  placeholder="Tell us about your protection needs..."
                ></textarea>
              </div>

              <motion.button
                type="submit"
                className="w-full py-4 bg-gradient-to-r from-safety-orange to-hyper-lime text-black font-semibold rounded-xl hover:shadow-xl transition-all duration-300"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                Submit Consultation Request
              </motion.button>
            </form>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default Consultation;
