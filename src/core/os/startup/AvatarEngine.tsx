import React from 'react';
import { motion } from 'framer-motion';

export interface AvatarEngineProps {
 state: 'hidden' | 'idle' | 'speaking';
}

export const AvatarEngine = ({ state }: AvatarEngineProps) => {
 if (state === 'hidden') return null;

 return (
 <div className="flex items-center justify-center h-full w-full">
 <motion.div
 className="w-32 h-32 rounded-full bg-blue-500 shadow-[0_0_50px_rgba(59,130,246,0.6)]"
 animate={{
 scale: state === 'speaking' ? [1, 1.1, 1] : [1, 1.05, 1],
 opacity: state === 'speaking' ? [0.8, 1, 0.8] : [0.5, 0.8, 0.5],
 }}
 transition={{
 duration: state === 'speaking' ? 0.5 : 3,
 repeat: Infinity,
 ease: "easeInOut"
 }}
 />
 </div>
 );
};
