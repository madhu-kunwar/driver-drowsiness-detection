"use client";

import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { cn } from "@/lib/utils";

interface TextRevealProps {
  children: string;
  className?: string;
  delay?: number;
  as?: "h1" | "h2" | "h3" | "p" | "span";
  splitBy?: "word" | "char";
}

export function TextReveal({
  children,
  className,
  delay = 0,
  as: Tag = "h2",
  splitBy = "word",
}: TextRevealProps) {
  const ref = useRef<HTMLElement>(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });

  const parts =
    splitBy === "word"
      ? children.split(" ")
      : children.split("");

  const containerVariants = {
    hidden: {},
    visible: {
      transition: { staggerChildren: splitBy === "word" ? 0.08 : 0.03, delayChildren: delay },
    },
  };

  const partVariants = {
    hidden: { y: "110%", opacity: 0, rotateX: -20 },
    visible: {
      y: "0%",
      opacity: 1,
      rotateX: 0,
      transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
    },
  };

  return (
    <Tag ref={ref as React.RefObject<never>} className={cn("overflow-hidden", className)}>
      <motion.span
        variants={containerVariants}
        initial="hidden"
        animate={inView ? "visible" : "hidden"}
        className="inline"
        style={{ display: "block", perspective: "800px" }}
      >
        {parts.map((part, i) => (
          <span key={i} style={{ display: "inline-block", overflow: "hidden" }}>
            <motion.span
              variants={partVariants}
              style={{ display: "inline-block" }}
            >
              {part}
              {splitBy === "word" && i < parts.length - 1 ? " " : ""}
            </motion.span>
          </span>
        ))}
      </motion.span>
    </Tag>
  );
}
