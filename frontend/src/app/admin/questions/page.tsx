'use client';

/**
 * Admin Questions Management Page
 * CRUD operations with drag-and-drop reordering
 * Following .cursorrules patterns
 */

import React from 'react';
import { AdminRoute } from '@/components/admin/AdminRoute';
import { QuestionManager } from '@/components/admin/QuestionManager';

function AdminQuestionsContent() {
  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Question Management</h1>
        <p className="text-muted-foreground mt-1">
          Manage recording questions with drag-and-drop reordering
        </p>
      </div>

      <QuestionManager />
    </div>
  );
}

export default function AdminQuestionsPage() {
  return (
    <AdminRoute>
      <AdminQuestionsContent />
    </AdminRoute>
  );
}

