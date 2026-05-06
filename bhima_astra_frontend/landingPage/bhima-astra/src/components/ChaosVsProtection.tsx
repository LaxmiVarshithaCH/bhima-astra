"use client"

import { useEffect, useRef, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { ShieldCheck, CloudRain, AlertTriangle, TrendingUp, Zap } from "lucide-react"

// Team/Worker Marquee Data
const workerFaces = [
  "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100",
  "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100",
  "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100",
  "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100",
  "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100",
]

function VerticalMarquee() {
  const doubled = [...workerFaces, ...workerFaces]
  return (
    <div className="overflow-hidden h-full py-4">
      <motion.div
        animate={{ y: [0, -400] }}
        transition={{ repeat: Infinity, duration: 20, ease: "linear" }}
        className="flex flex-col gap-4 items-center"
      >
        {doubled.map((face, i) => (
          <div key={i} className="w-12 h-12 rounded-full border-2 border-white/10 overflow-hidden grayscale hover:grayscale-0 transition-all">
            <img src={face} alt="Worker" className="w-full h-full object-cover" />
          </div>
        ))}
      </motion.div>
    </div>
  )
}

export function ChaosVsProtection() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [intensity, setIntensity] = useState(50)

  // Rain Particle Logic
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    let particles: any[] = []
    const resize = () => {
      canvas.width = window.innerWidth
      canvas.height = 700
    }
    resize()

    const createParticles = () => {
      particles = []
      for (let i = 0; i < 150; i++) {
        particles.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          length: Math.random() * 20,
          speed: 10 + Math.random() * 10
        })
      }
    }
    createParticles()

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.strokeStyle = "rgba(255, 255, 255, 0.15)"
      ctx.lineWidth = 1
      
      particles.forEach(p => {
        p.y += p.speed * (intensity / 50)
        if (p.y > canvas.height) p.y = -20
        ctx.beginPath()
        ctx.moveTo(p.x, p.y)
        ctx.lineTo(p.x, p.y + p.length)
        ctx.stroke()
      })
      requestAnimationFrame(animate)
    }
    animate()
    window.addEventListener('resize', resize)
    return () => window.removeEventListener('resize', resize)
  }, [intensity])

  return (
    <section className="relative min-h-screen bg-[#0A0A0A] text-white overflow-hidden flex flex-col items-center justify-center py-20">
      <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none" />

      {/* Narrative Header */}
      <div className="relative z-20 text-center mb-16 px-4">
        <h2 className="text-6xl font-black tracking-tighter mb-4">
          CHAOS <span className="text-gray-500">VS</span> <span className="text-[#CCFF00]">ASTRA</span>
        </h2>
        <p className="text-gray-400 max-w-xl mx-auto text-lg">
          Drag the intensity to see how <span className="text-[#CCFF00] font-bold">Parametric Protection</span> stabilizes income during crisis.
        </p>
        
        {/* Cinematic Intensity Slider */}
        <div className="mt-8 max-w-md mx-auto relative px-10">
          <input
            type="range"
            min="10"
            max="100"
            value={intensity}
            onChange={(e) => setIntensity(Number(e.target.value))}
            className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-[#CCFF00]"
          />
          <div className="flex justify-between mt-2 text-[10px] uppercase tracking-widest font-bold text-gray-500">
            <span>Normal Traffic</span>
            <span className="text-red-500">Extreme Monsoon</span>
          </div>
        </div>
      </div>

      <div className="relative z-20 w-full max-w-7xl grid grid-cols-1 lg:grid-cols-12 gap-4 px-6">
        
        {/* LEFT: THE CHAOS (Worker A) */}
        <div className="lg:col-span-5 relative group">
          <div className="absolute inset-0 bg-red-600/5 blur-3xl rounded-full" />
          <div className="relative border border-white/10 bg-white/[0.02] backdrop-blur-xl rounded-[40px] p-10 h-full flex flex-col items-center text-center">
            <div className="mb-6 p-4 rounded-full bg-red-500/10 text-red-500">
              <CloudRain size={40} />
            </div>
            <h3 className="text-2xl font-bold mb-2 uppercase tracking-tight">Unprotected Partner</h3>
            <p className="text-gray-500 text-sm mb-8">Manual claims, zero visibility, heavy losses.</p>
            
            <div className="text-6xl font-black text-red-500 mb-2">
              ₹{Math.max(0, 1800 - intensity * 15)}
            </div>
            <div className="text-xs uppercase tracking-widest text-gray-500 font-bold mb-10">Estimated Shift Earnings</div>

            <div className="w-full space-y-3 mt-auto">
              <div className="flex justify-between text-sm py-2 border-b border-white/5">
                <span className="text-gray-500">Risk Factor</span>
                <span className="text-red-400 font-bold">High</span>
              </div>
              <div className="flex justify-between text-sm py-2">
                <span className="text-gray-500">Support Delay</span>
                <span className="text-red-400">4-5 Days</span>
              </div>
            </div>
          </div>
        </div>

        {/* MIDDLE: THE DATA FEED (Marquee) */}
        <div className="lg:col-span-2 flex flex-col items-center">
            <div className="h-full border-x border-white/5 px-4 hidden lg:block">
               <VerticalMarquee />
            </div>
        </div>

        {/* RIGHT: THE ASTRA (Worker B) */}
        <div className="lg:col-span-5 relative">
          <div className="absolute inset-0 bg-[#CCFF00]/5 blur-3xl rounded-full" />
          <div className="relative border-2 border-[#CCFF00]/30 bg-[#CCFF00]/[0.03] backdrop-blur-2xl rounded-[40px] p-10 h-full flex flex-col items-center text-center">
            <div className="mb-6 p-4 rounded-full bg-[#CCFF00]/10 text-[#CCFF00]">
              <ShieldCheck size={40} />
            </div>
            <h3 className="text-2xl font-bold mb-2 uppercase tracking-tight text-[#CCFF00]">Astra Shielded</h3>
            <p className="text-gray-400 text-sm mb-8 font-medium">Automatic verification. Instant Payout.</p>
            
            <div className="text-6xl font-black text-white mb-2">
              ₹{1800 + (intensity > 70 ? 400 : 0)}
            </div>
            <div className="text-xs uppercase tracking-widest text-[#CCFF00] font-bold mb-10">Guaranteed Protection</div>

            <div className="w-full space-y-3 mt-auto">
              <div className="flex justify-between text-sm py-3 px-4 rounded-xl bg-[#CCFF00]/10 border border-[#CCFF00]/20">
                <span className="text-[#CCFF00] font-bold">Parametric Trigger Active</span>
                <Zap size={16} className="text-[#CCFF00] animate-pulse" />
              </div>
              <div className="flex justify-between text-sm py-2 border-b border-white/5">
                <span className="text-gray-500">Verification</span>
                <span className="text-[#CCFF00]">AI-Automated</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}