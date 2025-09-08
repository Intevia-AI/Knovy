'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

export const PageTransition = ({ children }: { children: React.ReactNode }) => {
  const pathname = usePathname();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const variants = {
    initial: {
      opacity: 0,
      y: 10,
    },
    animate: {
      opacity: 1,
      y: 0,
    },
    exit: {
      opacity: 0,
      y: -10,
    },
  };

  const isHomePage = pathname === '/';

  // On the home page, we don't want any transition, to avoid conflict with its own animations.
  if (isHomePage) {
    return <>{children}</>;
  }

  // For other pages, use the transition, but keep it invisible until the component has mounted.
  return (
    <div style={{ opacity: !isMounted ? 0 : 1 }}>
      <AnimatePresence mode="wait">
        <motion.div
          key={pathname}
          variants={variants}
          initial="initial"
          animate="animate"
          exit="exit"
          transition={{ duration: 0.3, ease: 'easeInOut' }}
        >
          {children}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};
