/**
 * Processing Complete Celebration Component
 * Beautiful success state with animation
 * Following .cursorrules and Framer Motion patterns
 */

'use client';

import { motion } from 'framer-motion';
import { Sparkles, MessageCircle, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Confetti from 'react-confetti';
import { useEffect, useState } from 'react';

interface ProcessingCompleteProps {
  userName: string;
  onChatNow?: () => void;
  onInviteFamily?: () => void;
}

export function ProcessingComplete({
  userName,
  onChatNow,
  onInviteFamily,
}: ProcessingCompleteProps) {
  const [showConfetti, setShowConfetti] = useState(true);
  const [windowSize, setWindowSize] = useState({ width: 0, height: 0 });
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    // Set window size for confetti (only on client)
    if (typeof window !== 'undefined') {
      setWindowSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    }

    // Stop confetti after 5 seconds
    const timer = setTimeout(() => {
      setShowConfetti(false);
    }, 5000);

    return () => clearTimeout(timer);
  }, []);

  // Prevent hydration mismatch - only render confetti on client
  if (!isMounted) {
    return null;
  }

  return (
    <>
      {/* Confetti Animation */}
      {showConfetti && windowSize.width > 0 && windowSize.height > 0 && (
        <Confetti
          width={windowSize.width}
          height={windowSize.height}
          recycle={false}
          numberOfPieces={500}
          gravity={0.3}
        />
      )}

      {/* Success Card */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="bg-gradient-to-br from-primary-500 to-primary-600 rounded-2xl p-12 text-white text-center shadow-2xl"
      >
        {/* Success Icon */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
          className="w-24 h-24 mx-auto mb-6 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm"
        >
          <Sparkles className="w-12 h-12 text-white animate-pulse" />
        </motion.div>

        {/* Title */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="text-4xl font-bold mb-4"
        >
          Your AI is Ready! 🎉
        </motion.h1>

        {/* Description */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="text-xl text-primary-100 mb-8 max-w-2xl mx-auto"
        >
          {userName}, your AI voice clone has been created successfully! Your loved ones can now
          chat with you anytime, anywhere.
        </motion.p>

        {/* Stats */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="grid md:grid-cols-3 gap-4 mb-8 max-w-2xl mx-auto"
        >
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 border border-white/20">
            <div className="text-3xl font-bold mb-1">✓</div>
            <div className="text-sm text-primary-100">Transcription</div>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 border border-white/20">
            <div className="text-3xl font-bold mb-1">✓</div>
            <div className="text-sm text-primary-100">Personality</div>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 border border-white/20">
            <div className="text-3xl font-bold mb-1">✓</div>
            <div className="text-sm text-primary-100">Voice Clone</div>
          </div>
        </motion.div>

        {/* Actions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="flex flex-col sm:flex-row gap-4 justify-center"
        >
          <Button
            onClick={onChatNow}
            size="lg"
            className="bg-white text-[#2c2a26] hover:bg-primary-50 shadow-lg border border-[#e8e4de]"
          >
            <MessageCircle className="w-5 h-5 mr-2 text-[#2c2a26]" />
            Try Chatting Now
          </Button>
          <Button
            onClick={onInviteFamily}
            size="lg"
            variant="outline"
            className="border-2 border-[#2c2a26] text-[#2c2a26] bg-white hover:bg-primary-50 shadow-lg"
          >
            <Users className="w-5 h-5 mr-2 text-[#2c2a26]" />
            Invite Family
          </Button>
        </motion.div>
      </motion.div>
    </>
  );
}

