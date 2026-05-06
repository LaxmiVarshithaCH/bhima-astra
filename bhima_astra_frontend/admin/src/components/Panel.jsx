import { motion } from 'framer-motion'

export default function Panel({
  title,
  subtitle,
  right,
  children,
  className = '',
  headerClassName = '',
  bodyClassName = '',
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -3, scale: 1.015 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className={
        'rounded-2xl border border-[#E5E5E5] bg-[#FFFFFF]/70 backdrop-blur-xl shadow-[0_1px_0_0_rgba(255,255,255,0.6),0_10px_30px_-20px_rgba(0,0,0,0.25)] transition-colors duration-300 hover:border-[#CCCCCC] ' +
        className
      }
    >
      {title || subtitle || right ? (
        <div
          className={
            'flex items-start justify-between gap-4 px-5 py-4 border-b border-[#E5E5E5] ' +
            headerClassName
          }
        >
          <div className="min-w-0">
            {title ? <div className="text-[12px] font-semibold text-current">{title}</div> : null}
            {subtitle ? <div className="mt-1 text-[11px] text-[color:inherit] opacity-70">{subtitle}</div> : null}
          </div>
          {right ? <div className="flex-shrink-0">{right}</div> : null}
        </div>
      ) : null}

      <div className={'px-5 py-5 ' + bodyClassName}>{children}</div>
    </motion.div>
  )
}
