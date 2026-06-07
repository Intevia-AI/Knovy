'use client'

import { motion, Variants } from 'motion'

interface AnimatedTextProps {
  text: string
  className?: string
}

const containerVariants: Variants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.04
    }
  }
}

const wordVariants: Variants = {
  hidden: { opacity: 0, y: 10 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      type: 'spring',
      damping: 12,
      stiffness: 100
    }
  }
}

export function AnimatedText({ text, className }: AnimatedTextProps) {
  const words = text.split(' ')

  return (
    <motion.p
      className={className}
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      aria-label={text}
    >
      {words.map((word, index) => (
        <motion.span key={index} variants={wordVariants} style={{ marginRight: '0.25em' }}>
          {word}
        </motion.span>
      ))}
    </motion.p>
  )
}
