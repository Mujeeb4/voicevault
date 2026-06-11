/**
 * Upload Step Component
 * Display upload progress
 * Following .cursorrules and best UX practices
 */

'use client';

import { motion } from 'framer-motion';
import { useRecordingStore } from '@/store/recording';
import { UploadProgress } from './UploadProgress';

export function UploadStep() {
  const { uploadProgress, status } = useRecordingStore();

  // Map recording status to upload status
  const uploadStatus =
    status === 'uploading'
      ? uploadProgress < 30
        ? 'combining'
        : uploadProgress < 60
        ? 'compressing'
        : 'uploading'
      : status === 'complete'
      ? 'complete'
      : 'idle';

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="max-w-2xl mx-auto"
    >
      <UploadProgress
        progress={uploadProgress}
        status={uploadStatus}
      />
    </motion.div>
  );
}

