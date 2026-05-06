import React from 'react';
import { motion } from 'framer-motion';
import { Users, Code, Palette, Monitor, Database } from 'lucide-react';

const TeamAndProcess: React.FC = () => {
  const teamMembers = [
    {
      name: "D.SAI NIKITHA",
      role: "Team Lead",
      description: "Leading vision and strategy for Bhima Astra's mission to protect gig workers",
      icon: Users,
      color: "text-[#FF5F1F]",
      bgColor: "bg-[#FF5F1F] bg-opacity-10",
      linkedinUrl: "https://www.linkedin.com/in/dorbala-sai-nikitha-25239a321/"
    },
    {
      name: "CH.LAXMI VARSHITHA",
      role: "Backend Developer",
      description: "Building robust systems that power real-time protection and instant claims",
      icon: Code,
      color: "text-blue-400",
      bgColor: "bg-blue-400 bg-opacity-10",
      linkedinUrl: "https://www.linkedin.com/in/laxmi-varshitha-chennupalli-a75b08313/"
    },
    {
      name: "D.SAI SUJITHA",
      role: "UI/UX Designer",
      description: "Creating intuitive experiences that make safety accessible to everyone",
      icon: Palette,
      color: "text-purple-400",
      bgColor: "bg-purple-400 bg-opacity-10",
      linkedinUrl: "https://www.linkedin.com/in/sai-sujitha-dorbala-51b414321/"
    },
    {
      name: "CH.NISSY",
      role: "Frontend Developer",
      description: "Crafting responsive interfaces that work seamlessly across all devices",
      icon: Monitor,
      color: "text-[#CCFF00]",
      bgColor: "bg-[#CCFF00] bg-opacity-10",
      linkedinUrl: "https://www.linkedin.com/in/nissy-chittelu-755784320/"
    },
    {
      name: "MD.ABDUL AHAD SHARIF",
      role: "Database Management",
      description: "Ensuring data integrity and performance for millions of protection records",
      icon: Database,
      color: "text-green-400",
      bgColor: "bg-green-400 bg-opacity-10",
      linkedinUrl: "https://www.linkedin.com/in/mohammad-abdul-ahad-sharif-726b04313/"
    }
  ];

  const steps = [
    {
      id: "01",
      title: "Worker Registration",
      description: "Gig workers join the platform by providing basic details and work history to create their digital safety profile."
    },
    {
      id: "02",
      title: "Risk Assessment",
      description: "Our AI-powered engine analyzes work patterns and potential hazards to design a custom parametric insurance blueprint."
    },
    {
      id: "03",
      title: "Instant Coverage",
      description: "Activation happens in seconds. Workers are protected against accidents and income loss with real-time policy triggers."
    },
    {
      id: "04",
      title: "Automated Claims",
      description: "When an event occurs, our smart systems validate data instantly—no manual paperwork or long wait times required."
    },
    {
      id: "05",
      title: "Rapid Payouts",
      description: "Funds are released immediately to the worker's account, ensuring they have financial support exactly when needed."
    }
  ];

  return (
    <div className="bg-black font-sans">
      {/* --- TEAM SECTION --- */}
      <section className="py-20 px-4">
        <div className="max-w-7xl mx-auto">
          <motion.div
            className="text-center mb-16"
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
          >
            <h2 className="text-4xl md:text-6xl font-bold mb-4">
              <span className="text-white">Meet the </span>
              <span className="text-[#CCFF00]">Team</span>
            </h2>
            <p className="text-xl text-gray-400 max-w-3xl mx-auto">
              Passionate people building innovative solutions for gig workers across India
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {teamMembers.map((member, index) => (
              <motion.div
                key={index}
                className="group relative"
                initial={{ opacity: 0, y: 50 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                whileHover={{ y: -10 }}
              >
                <div className="glass p-8 rounded-3xl h-full relative overflow-hidden border border-gray-800 bg-white/5 backdrop-blur-sm">
                  <div className="absolute inset-0 bg-gradient-to-br from-transparent to-white opacity-0 group-hover:opacity-5 transition-opacity duration-300" />
                  
                  <div className="relative z-10">
                    <div className="flex items-center mb-6">
                      <div className={`p-4 rounded-2xl mr-4 ${member.bgColor} group-hover:scale-105 transition-transform`}>
                        <member.icon className={`w-8 h-8 ${member.color}`} />
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-white mb-1">{member.name}</h3>
                        <p className="text-gray-400 text-sm">{member.role}</p>
                      </div>
                    </div>

                    <p className="text-gray-300 leading-relaxed mb-6">
                      {member.description}
                    </p>

                    <motion.a
                      href={member.linkedinUrl || '#'}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full py-3 block text-center glass text-white rounded-xl hover:bg-white/10 transition-all duration-300 border border-gray-700 group-hover:border-[#CCFF00]"
                      whileHover={{ scale: 1.02 }}
                    >
                      <span className="group-hover:text-[#CCFF00] transition-colors">
                        Connect with {member.name.split(' ').pop()}
                      </span>
                    </motion.a>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* --- HOW WE WORK SECTION --- */}
      <section className="py-24 px-6 bg-[#121212] border-t border-white/5">
        <div className="max-w-7xl mx-auto">
          <div className="mb-20">
            <span className="text-[#CCFF00] font-mono text-sm tracking-widest uppercase mb-4 block">
              004. process
            </span>
            <h2 className="text-5xl md:text-7xl font-bold tracking-tighter mb-6 text-white">
              How We <span className="text-[#FF5F1F]">Work</span>
            </h2>
            <p className="text-xl text-gray-400 max-w-2xl leading-relaxed">
              A proven process designed to transform gig worker security into a scalable, 
              AI-powered protection system—efficiently and strategically.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12">
            {steps.map((step, index) => (
              <motion.div 
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                viewport={{ once: true }}
                className="group"
              >
                <div className="border-t border-white/10 pt-8 flex flex-col h-full">
                  <span className="text-[#CCFF00] font-mono text-2xl mb-6 block group-hover:translate-x-2 transition-transform duration-300">
                    {step.id}.
                  </span>
                  <h3 className="text-2xl font-bold mb-4 text-white group-hover:text-[#FF5F1F] transition-colors">
                    {step.title}
                  </h3>
                  <p className="text-gray-400 leading-relaxed flex-grow">
                    {step.description}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>

                  </div>
      </section>
    </div>
  );
};

export default TeamAndProcess;