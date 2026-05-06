import React from "react";
import { motion } from "framer-motion";
import { User, Briefcase, Shield } from "lucide-react";

const Navigation: React.FC = () => {
  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-3">
      <motion.a
        href="/admin"
        className="glass px-4 py-2 rounded-xl flex items-center gap-2 text-white hover:bg-white hover:bg-opacity-10 transition-all duration-300"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        <Shield className="w-4 h-4" />
        <span className="text-sm font-medium">Admin Workspace</span>
      </motion.a>

      <motion.a
        href="/worker"
        className="glass px-4 py-2 rounded-xl flex items-center gap-2 text-white hover:bg-white hover:bg-opacity-10 transition-all duration-300"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        <User className="w-4 h-4" />
        <span className="text-sm font-medium">Worker Workspace</span>
      </motion.a>

      <motion.a
        href="/manager/login"
        className="glass px-4 py-2 rounded-xl flex items-center gap-2 text-white hover:bg-white hover:bg-opacity-10 transition-all duration-300"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        <Briefcase className="w-4 h-4" />
        <span className="text-sm font-medium">Manager Workspace</span>
      </motion.a>
    </div>
  );
};

export default Navigation;
