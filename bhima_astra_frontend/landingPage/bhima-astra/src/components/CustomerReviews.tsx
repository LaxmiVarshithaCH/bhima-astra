import React from 'react';
import { motion } from 'framer-motion';

const avatarImages = [
  "https://i.pravatar.cc/150?u=a042581f4e29026704d", 
  "https://i.pravatar.cc/150?u=a042581f4e29026704e", 
  "https://i.pravatar.cc/150?u=a042581f4e29026704f", 
  "https://i.pravatar.cc/150?u=a04258114e29026702d", 
  "https://i.pravatar.cc/150?u=a042581f4e29026704g", 
  "https://i.pravatar.cc/150?u=a042581f4e29026704h", 
];

const reviews = [
  { name: "Rajesh Kumar", title: "Gig Worker", avatar: avatarImages[0], text: "Bhima Astra makes managing project risks feel simple and stress-free." },
  { name: "Priya Sharma", title: "Gig Worker", avatar: avatarImages[1], text: "Transfers are fast, clear, and exactly what I expect from modern insurance technology." },
  { name: "Vijay Bonsle", title: "Gig Worker", avatar: avatarImages[2], text: "Transactions feel transparent. I always know what's happening with my project's protection." },
  { name: "Anil Kumar", title: "Gig Worker", avatar: avatarImages[3], text: "I always know where my project is protected and what's happening with it." },
  { name: "Anjali Mehta", title: "Gig Worker", avatar: avatarImages[4], text: "I don't have to think while using it. That's the best part." },
  { name: "Rahul Singh", title: "Gig Worker", avatar: avatarImages[5], text: "It's rare to see an insurance app this focused on clarity." },
];

const StarRating = () => (
  <div className="flex gap-1 my-3 text-[#CCFF00]"> {/* Hyper-lime stars for dark mode */}
    {[...Array(5)].map((_, i) => (
      <svg key={i} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
        <path fillRule="evenodd" d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.007 5.404.433c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.433 2.082-5.006z" clipRule="evenodd" />
      </svg>
    ))}
  </div>
);

const Column = (items: typeof reviews, duration: number, reverse = false) => (
  <div className="overflow-hidden h-[700px] flex-1">
    <motion.div
      className="flex flex-col gap-6 p-4"
      animate={{
        y: reverse ? ['-50%', '0%'] : ['0%', '-50%'],
      }}
      transition={{
        duration,
        repeat: Infinity,
        ease: 'linear',
      }}
    >
      {[...items, ...items].map((review, index) => (
        <div
          key={index}
          className="p-8 rounded-3xl border shadow-2xl flex flex-col items-start bg-[#1A1A1A]"
          style={{
            borderColor: 'rgba(255, 255, 255, 0.1)', 
            minWidth: '360px',
          }}
        >
          <div className="flex items-center gap-4 mb-4">
            <img 
                src={review.avatar} 
                alt={`${review.name} avatar`} 
                className="w-16 h-16 rounded-full object-cover border-2 border-[#333]"
            />
            <div>
              <h4 className="font-semibold text-lg text-white">{review.name}</h4>
              <p className="text-sm text-gray-400">{review.title}</p>
            </div>
          </div>
          <StarRating />
          <p className="text-base text-gray-300 leading-relaxed font-normal">{review.text}</p>
        </div>
      ))}
    </motion.div>
  </div>
);

const CustomerReviews: React.FC = () => {
  const col1 = [reviews[3], reviews[5], reviews[1]]; 
  const col2 = [reviews[0], reviews[4], reviews[2]]; 
  const col3 = [reviews[1], reviews[3], reviews[5]]; 

  return (
    <div className="py-24 px-6 bg-[#121212] font-sans">
      <div className="max-w-7xl mx-auto">
        
        {/* Trusted By Tag */}
        <div className="flex justify-center mb-6">
            <div className="px-5 py-2.5 bg-[#222] text-[#CCFF00] text-sm font-medium rounded-full border border-white/10 shadow-inner">
                Trusted by 50,000+ workers
            </div>
        </div>

        {/* Heading */}
        <h2 className="text-5xl md:text-7xl font-bold text-center text-white tracking-tighter mb-4 max-w-4xl mx-auto">
          People trust Bhima Astra with their security
        </h2>
        
        {/* Subtitle */}
        <p className="text-xl text-gray-400 text-center mb-16 max-w-xl mx-auto font-normal">
          Designed for simplicity, speed, and 24/7 protection.
        </p>

        {/* 3 COLUMN LAYOUT */}
        <div className="relative flex justify-center gap-10 items-start overflow-hidden px-4">
          {/* Fading gradient at top and bottom to make the infinite scroll look smooth */}
          <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-[#121212] to-transparent z-10 pointer-events-none"></div>
          <div className="absolute bottom-0 left-0 w-full h-32 bg-gradient-to-t from-[#121212] to-transparent z-10 pointer-events-none"></div>
          
          {Column(col1, 25)}
          {Column(col2, 30, true)}
          {Column(col3, 22)}
        </div>
      </div>
    </div>
  );
};

export default CustomerReviews;