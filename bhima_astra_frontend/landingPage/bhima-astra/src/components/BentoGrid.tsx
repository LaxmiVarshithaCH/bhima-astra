import React from 'react';
import { motion, Variants } from 'framer-motion';
import { Code, Users, Mail, Play, ExternalLink, MapPin, MessageCircle } from 'lucide-react';

const BentoGrid: React.FC = () => {
  const socialLinks = [
    {
      icon: Code,
      label: "GitHub",
      url: "https://github.com/32732Nikitha",
      description: "View our code",
      color: "hover:text-white",
      bgColor: "bg-gray-800",
    },
    {
      icon: Users,
      label: "LinkedIn",
      url: "https://www.linkedin.com/in/dorbala-sai-nikitha-25239a321/",
      description: "Connect with us",
      color: "hover:text-blue-400",
      bgColor: "bg-blue-900",
    },
    {
      icon: Mail,
      label: "Email",
      url: "mailto:2300032732cseird@gmail.com",
      description: "Get in touch",
      color: "hover:text-[#CCFF00]",
      bgColor: "bg-gray-800",
    },
    {
      icon: Play,
      label: "YouTube",
      url: "https://youtu.be/J9ANawCDIyg",
      description: "Watch our story",
      color: "hover:text-red-500",
      bgColor: "bg-red-900",
    },
    {
      icon: MessageCircle,
      label: "Live Chat",
      url: "#",
      description: "24/7 Support",
      color: "hover:text-[#FF5F1F]",
      bgColor: "bg-gray-800",
    },
  ];

  const contactInfo = {
    title: "Get Protected Today",
    description: "Join thousands of gig workers who trust Bhima Astra for their safety",
    cta: "Start Your Coverage",
    address: "PAN India Coverage",
    stats: [
      { label: "Active Users", value: "500K+" },
      { label: "Claims Processed", value: "10K+" },
      { label: "Response Time", value: "< 2min" }
    ]
  };

  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  const itemVariants: Variants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 }
  };

  return (
    <div className="py-20 px-4 bg-[#121212]">
      <div className="max-w-7xl mx-auto">
        <motion.div 
          className="text-center mb-12"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
        >
          <h2 className="text-4xl md:text-6xl font-bold mb-4 text-white">
            Connect With <span className="text-[#FF5F1F]">Bhima Astra</span>
          </h2>
        </motion.div>

        <motion.div
          className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6 auto-rows-[220px]"
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
        >
          {/* VIDEO BACKGROUND CARD */}
          <motion.div
            className="col-span-1 md:col-span-2 row-span-2 rounded-3xl relative overflow-hidden group shadow-2xl border border-white/10"
            variants={itemVariants}
          >
            {/* The Video Element */}
            <video
              autoPlay
              loop
              muted
              playsInline
              className="absolute inset-0 w-full h-full object-cover z-0 brightness-[0.4] group-hover:brightness-[0.5] transition-all duration-500"
            >
              <source src="/insurance-bg-video.mp4" type="video/mp4" />
              {/* Fallback Image if video fails */}
              <img src="/fallback-image.png" alt="Protection" className="object-cover w-full h-full" />
            </video>

            {/* Content Overlay */}
            <div className="relative z-10 p-8 h-full flex flex-col justify-between">
              <div>
                <h3 className="text-4xl font-bold text-white mb-4 leading-tight">
                  {contactInfo.title}
                </h3>
                <p className="text-gray-200 max-w-md text-lg">
                  {contactInfo.description}
                </p>
              </div>

              <div className="space-y-6">
                <motion.button
                  className="px-8 py-4 bg-[#CCFF00] text-black font-bold rounded-2xl"
                  whileHover={{ scale: 1.05 }}
                >
                  {contactInfo.cta}
                </motion.button>

                <div className="grid grid-cols-3 gap-4 border-t border-white/20 pt-6">
                  {contactInfo.stats.map((stat, index) => (
                    <div key={index}>
                      <div className="text-2xl font-bold text-[#CCFF00]">{stat.value}</div>
                      <div className="text-xs text-gray-300 uppercase tracking-wider font-semibold">{stat.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>

          {/* Social Links */}
          {socialLinks.map((social, index) => (
            <motion.a
              key={index}
              href={social.url}
              target="_blank"
              className={`${social.bgColor} p-6 rounded-3xl flex flex-col justify-between items-center group border border-white/5`}
              variants={itemVariants}
              whileHover={{ y: -5, borderColor: 'rgba(255,255,255,0.2)' }}
            >
              <social.icon className={`w-10 h-10 ${social.color} transition-colors`} />
              <div className="text-center">
                <h4 className="text-white font-bold">{social.label}</h4>
                <p className="text-gray-400 text-xs">{social.description}</p>
              </div>
            </motion.a>
          ))}

          {/* Bottom Coverage Card */}
          <motion.div
            className="col-span-1 md:col-span-2 bg-[#1A1A1A] p-6 rounded-3xl flex items-center gap-6 border border-white/5"
            variants={itemVariants}
          >
            <div className="bg-[#FF5F1F]/20 p-4 rounded-2xl">
              <MapPin className="w-8 h-8 text-[#FF5F1F]" />
            </div>
            <div>
              <h4 className="text-white font-bold">{contactInfo.address}</h4>
              <p className="text-gray-400 text-sm">Protecting gig workers across all 28 states and 8 union territories.</p>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
};

export default BentoGrid;