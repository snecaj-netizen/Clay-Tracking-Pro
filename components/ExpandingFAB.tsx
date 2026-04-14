import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, X } from 'lucide-react';

interface ExpandingFABProps {
  label: string;
  onClick: () => void;
  icon?: React.ReactNode;
  className?: string;
  show?: boolean;
  isClose?: boolean;
}

const ExpandingFAB: React.FC<ExpandingFABProps> = ({
  label,
  onClick,
  icon,
  className = "",
  show = true,
  isClose = false,
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  if (!show) return null;

  const shouldExpand = isHovered;

  return (
    <motion.button
      layout
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      initial={isMobile ? false : { scale: 0, opacity: 0 }}
      animate={isMobile ? { scale: 1, opacity: 1 } : { 
        scale: 1, 
        opacity: 1,
      }}
      exit={{ scale: 0, opacity: 0 }}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.95 }}
      transition={{ 
        type: 'spring', 
        stiffness: 500, 
        damping: 35,
        layout: { duration: 0.3, type: 'spring', stiffness: 500, damping: 35 }
      }}
      className={`fixed bottom-28 sm:bottom-8 right-8 h-14 w-14 sm:h-16 sm:w-16 flex items-center justify-center text-white shadow-2xl z-40 rounded-full group overflow-hidden transition-colors duration-300 ${
        shouldExpand ? '!w-auto px-5 sm:px-6' : ''
      } ${
        isClose ? 'bg-orange-500 shadow-orange-500/40' : 'bg-orange-600 shadow-orange-600/40'
      } ${className}`}
    >
      <div className="flex items-center justify-center gap-3 relative">
        <AnimatePresence mode="popLayout" initial={false}>
          {shouldExpand && (
            <motion.span
              key="label"
              initial={{ opacity: 0, width: 0, x: -10 }}
              animate={{ opacity: 1, width: 'auto', x: 0 }}
              exit={{ opacity: 0, width: 0, x: -10 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              className="whitespace-nowrap font-black uppercase tracking-tight text-xs sm:text-sm overflow-hidden"
            >
              {label}
            </motion.span>
          )}
        </AnimatePresence>
        
        <div className="flex items-center justify-center w-6 h-6 sm:w-8 sm:h-8 shrink-0">
          {icon || (isClose ? <X className="w-6 h-6 sm:w-8 sm:h-8" /> : <Plus className="w-6 h-6 sm:w-8 sm:h-8 group-hover:rotate-90 transition-transform duration-300" />)}
        </div>
      </div>
    </motion.button>
  );
};

export default ExpandingFAB;
