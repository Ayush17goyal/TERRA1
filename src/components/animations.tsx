import { useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';

// Hook to check if we are on a mobile device
export function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  return isMobile;
}

// Hook to track normalized mouse coordinates (-1 to 1) for parallax
export function useMousePosition(enabled = true) {
  const [position, setPosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (!enabled) return;

    const handleMouseMove = (e: MouseEvent) => {
      const x = (e.clientX / window.innerWidth) * 2 - 1;
      const y = (e.clientY / window.innerHeight) * 2 - 1;
      setPosition({ x, y });
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [enabled]);

  return position;
}

interface ScrollRevealProps {
  children: React.ReactNode;
  delay?: number;
  duration?: number;
  y?: number;
  className?: string;
  style?: React.CSSProperties;
}

// Reusable Scroll Reveal component
export function ScrollReveal({
  children,
  delay = 0,
  duration = 0.65,
  y = 30,
  className = '',
  style = {},
  ...props
}: ScrollRevealProps) {
  const shouldReduceMotion = useReducedMotion();
  const isMobile = useIsMobile();

  // If reduced motion is active, remove translations entirely
  const activeY = shouldReduceMotion ? 0 : (isMobile ? y * 0.5 : y);

  return (
    <motion.div
      initial={{ opacity: 0, y: activeY }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{
        duration,
        delay,
        ease: [0.16, 1, 0.3, 1] as const, // premium cubic-bezier easeOutExpo
      }}
      className={className}
      style={style}
      {...props}
    >
      {children}
    </motion.div>
  );
}

interface StaggerContainerProps {
  children: React.ReactNode;
  delayChildren?: number;
  staggerChildren?: number;
  className?: string;
  style?: React.CSSProperties;
}

// Stagger Animation Container
export function StaggerContainer({
  children,
  delayChildren = 0,
  staggerChildren = 0.1,
  className = '',
  style = {},
  ...props
}: StaggerContainerProps) {
  const shouldReduceMotion = useReducedMotion();

  const containerVariants = {
    hidden: {},
    visible: {
      transition: {
        staggerChildren: shouldReduceMotion ? 0 : staggerChildren,
        delayChildren,
      },
    },
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-80px" }}
      className={className}
      style={style}
      {...props}
    >
      {children}
    </motion.div>
  );
}

interface StaggerItemProps {
  children: React.ReactNode;
  y?: number;
  duration?: number;
  className?: string;
  style?: React.CSSProperties;
}

// Stagger Animation Item
export function StaggerItem({
  children,
  y = 20,
  duration = 0.5,
  className = '',
  style = {},
  ...props
}: StaggerItemProps) {
  const shouldReduceMotion = useReducedMotion();
  const isMobile = useIsMobile();

  const activeY = shouldReduceMotion ? 0 : (isMobile ? y * 0.5 : y);

  const itemVariants = {
    hidden: {
      opacity: 0,
      y: activeY,
      scale: shouldReduceMotion ? 1 : 0.98,
    },
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: {
        duration,
        ease: [0.16, 1, 0.3, 1] as const,
      },
    },
  };

  return (
    <motion.div variants={itemVariants} className={className} style={style} {...props}>
      {children}
    </motion.div>
  );
}

interface FloatingElementProps {
  children: React.ReactNode;
  xRange?: [number, number];
  yRange?: [number, number];
  rotateRange?: [number, number];
  scaleRange?: [number, number];
  duration?: number;
  delay?: number;
  className?: string;
  style?: React.CSSProperties;
}

// Continuous Floating Animation Element
export function FloatingElement({
  children,
  xRange = [0, 0],
  yRange = [-5, 5],
  rotateRange = [-0.5, 0.5],
  scaleRange = [1, 1],
  duration = 6,
  delay = 0,
  className = '',
  style = {},
  ...props
}: FloatingElementProps) {
  const shouldReduceMotion = useReducedMotion();
  const isMobile = useIsMobile();

  if (shouldReduceMotion) {
    return (
      <div className={className} style={style} {...props}>
        {children}
      </div>
    );
  }

  // Reduce floating range on mobile devices
  const activeYRange = isMobile ? [yRange[0] * 0.4, yRange[1] * 0.4] : yRange;
  const activeXRange = isMobile ? [xRange[0] * 0.4, xRange[1] * 0.4] : xRange;
  const activeRotateRange = isMobile ? [rotateRange[0] * 0.3, rotateRange[1] * 0.3] : rotateRange;

  return (
    <motion.div
      animate={{
        x: [activeXRange[0], activeXRange[1], activeXRange[0]],
        y: [activeYRange[0], activeYRange[1], activeYRange[0]],
        rotate: [activeRotateRange[0], activeRotateRange[1], activeRotateRange[0]],
        scale: [scaleRange[0], scaleRange[1], scaleRange[0]],
      }}
      transition={{
        duration,
        repeat: Infinity,
        ease: 'easeInOut',
        delay,
      }}
      className={className}
      style={{ display: 'inline-block', width: '100%', height: '100%', ...style }}
      {...props}
    >
      {children}
    </motion.div>
  );
}

interface LineRevealProps {
  children: React.ReactNode;
  delay?: number;
  duration?: number;
  className?: string;
  style?: React.CSSProperties;
}

// Reveals text line-by-line using vertical clipping
export function LineReveal({
  children,
  delay = 0,
  duration = 0.65,
  className = '',
  style = {},
  ...props
}: LineRevealProps) {
  const shouldReduceMotion = useReducedMotion();

  if (shouldReduceMotion) {
    return (
      <div className={className} style={style} {...props}>
        {children}
      </div>
    );
  }

  return (
    <div className={className} style={{ overflow: 'hidden', ...style }} {...props}>
      <motion.div
        initial={{ y: '100%', opacity: 0 }}
        whileInView={{ y: 0, opacity: 1 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{
          duration,
          delay,
          ease: [0.16, 1, 0.3, 1] as const,
        }}
      >
        {children}
      </motion.div>
    </div>
  );
}
