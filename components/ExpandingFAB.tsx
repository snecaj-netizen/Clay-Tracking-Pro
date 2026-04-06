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
  title?: string;
}

const ExpandingFAB: React.FC<ExpandingFABProps> = ({
  label,
  onClick,
  icon,
  className = "",
  show = true,
  isClose = false,
  title
}) => {
  const [isExpanded, setIsExpanded] = useState(true);

  useEffect(() => {
    if (show) {
      setIsExpanded(true);
      const timer = setTimeout(() => {
        setIsExpanded(false);
      }, 4000); // Collapse after 4 seconds

      return () => clearTimeout(timer);
    }
  }, [label, show]); // Reset timer and expand when label or visibility changes

  if (!show) return null;

  return (
    <motion.button
      layout
      onClick={onClick}
      initial={{ scale: 0, opacity: 0 }}
      animate={{ 
        scale: 1, 
        opacity: 1,
        width: isExpanded ? 'auto' : '3.5rem',
        paddingLeft: isExpanded ? '1.25rem' : '0',
        paddingRight: isExpanded ? '1.25rem' : '0',
      }}
      exit={{ scale: 0, opacity: 0 }}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      transition={{ 
        type: 'spring', 
        stiffness: 400, 
        damping: 30,
        layout: { duration: 0.3 }
      }}
      className={`fixed bottom-28 sm:bottom-8 right-8 h-14 sm:h-16 flex items-center justify-center text-white shadow-2xl z-40 rounded-full group overflow-hidden ${
        isClose ? 'bg-orange-500 shadow-orange-500/40' : 'bg-orange-600 shadow-orange-600/40'
      } ${className}`}
      title={title || label}
      style={{
        minWidth: isExpanded ? 'auto' : '3.5rem',
      }}
    >
      <motion.div layout className="flex items-center gap-3">
        <AnimatePresence mode="popLayout">
          {isExpanded && (
            <motion.span
              key="label"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.2 }}
              className="whitespace-nowrap font-black uppercase tracking-tight text-xs sm:text-sm"
            >
              {label}
            </motion.span>
          )}
        </AnimatePresence>
        
        <motion.div layout className="flex items-center justify-center w-6 h-6 sm:w-8 sm:h-8">
          {icon || (isClose ? <X className="w-6 h-6 sm:w-8 sm:h-8" /> : <Plus className="w-6 h-6 sm:w-8 sm:h-8 group-hover:rotate-90 transition-transform duration-300" />)}
        </motion.div>
      </motion.div>
    </motion.button>
  );
};

export default ExpandingFAB;
