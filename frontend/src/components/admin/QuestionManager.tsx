'use client';

/**
 * Question Manager Component
 * CRUD operations with drag-and-drop reordering
 * Following .cursorrules patterns
 */

import React, { useState, useEffect } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  GripVertical,
  MoreVertical,
  Edit,
  Trash2,
  Search,
  Plus,
  Download,
  RefreshCw,
  Check,
  X,
} from 'lucide-react';
import { useAdminStore } from '@/store/admin';
import type { Question, QuestionDomain } from '@/types';
import { cn } from '@/lib/utils';
import { QuestionDialog } from './QuestionDialog';

interface SortableQuestionRowProps {
  question: Question;
  onEdit: (question: Question) => void;
  onDelete: (question: Question) => void;
  onToggleActive: (question: Question) => void;
}

const SortableQuestionRow: React.FC<SortableQuestionRowProps> = ({
  question,
  onEdit,
  onDelete,
  onToggleActive,
}) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: question.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const getDomainColor = (domain: QuestionDomain) => {
    const colors: Record<QuestionDomain, string> = {
      childhood: 'bg-primary-500',
      family: 'bg-green-500',
      career: 'bg-purple-500',
      wisdom: 'bg-amber-500',
      challenges: 'bg-red-500',
      personality: 'bg-pink-500',
    };
    return colors[domain] || 'bg-gray-500';
  };

  return (
    <TableRow ref={setNodeRef} style={style} className={cn(isDragging && 'bg-muted')}>
      <TableCell className="w-12">
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing hover:bg-muted p-1 rounded"
        >
          <GripVertical className="h-5 w-5 text-muted-foreground" />
        </button>
      </TableCell>
      <TableCell className="font-medium">{question.order}</TableCell>
      <TableCell className="max-w-md">
        <p className="truncate">{question.question_text}</p>
        {question.tip && <p className="text-xs text-muted-foreground truncate mt-1">Tip: {question.tip}</p>}
      </TableCell>
      <TableCell>
        <Badge variant="secondary" className={getDomainColor(question.domain)}>
          {question.domain}
        </Badge>
      </TableCell>
      <TableCell>{question.suggested_duration_seconds}s</TableCell>
      <TableCell>
        <button
          onClick={() => onToggleActive(question)}
          className={cn(
            'flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors',
            question.is_active
              ? 'bg-green-100 text-green-700 hover:bg-green-200'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          )}
        >
          {question.is_active ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
          {question.is_active ? 'Active' : 'Inactive'}
        </button>
      </TableCell>
      <TableCell>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Actions</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => onEdit(question)}>
              <Edit className="mr-2 h-4 w-4" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onToggleActive(question)}>
              {question.is_active ? (
                <>
                  <X className="mr-2 h-4 w-4" />
                  Deactivate
                </>
              ) : (
                <>
                  <Check className="mr-2 h-4 w-4" />
                  Activate
                </>
              )}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive" onClick={() => onDelete(question)}>
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  );
};

export const QuestionManager: React.FC = () => {
  const {
    questions,
    isLoadingQuestions,
    loadQuestions,
    updateQuestion,
    deleteQuestion,
    reorderQuestions,
    seedQuestions,
    exportQuestions,
  } = useAdminStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [domainFilter, setDomainFilter] = useState<'all' | QuestionDomain>('all');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [deleteConfirmQuestion, setDeleteConfirmQuestion] = useState<Question | null>(null);
  const [localQuestions, setLocalQuestions] = useState<Question[]>([]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    loadQuestions();
  }, [loadQuestions]);

  useEffect(() => {
    setLocalQuestions(questions);
  }, [questions]);

  // Filter questions
  const filteredQuestions = localQuestions.filter((q) => {
    const matchesSearch =
      q.question_text.toLowerCase().includes(searchQuery.toLowerCase()) ||
      q.domain.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesDomain = domainFilter === 'all' || q.domain === domainFilter;

    return matchesSearch && matchesDomain;
  });

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) return;

    const oldIndex = localQuestions.findIndex((q) => q.id === active.id);
    const newIndex = localQuestions.findIndex((q) => q.id === over.id);

    // Update local state immediately for smooth UI
    const reordered = arrayMove(localQuestions, oldIndex, newIndex);
    setLocalQuestions(reordered);

    // Update orders and send to API
    const updates = reordered.map((q, i) => ({
      id: q.id,
      order: i + 1,
    }));

    try {
      await reorderQuestions(updates);
    } catch {
      // Revert on error
      setLocalQuestions(questions);
    }
  };

  const handleEdit = (question: Question) => {
    setEditingQuestion(question);
    setIsDialogOpen(true);
  };

  const handleDelete = (question: Question) => {
    setDeleteConfirmQuestion(question);
  };

  const confirmDelete = async () => {
    if (deleteConfirmQuestion) {
      try {
        await deleteQuestion(deleteConfirmQuestion.id);
        setDeleteConfirmQuestion(null);
      } catch {
        // Error handled in store
      }
    }
  };

  const handleToggleActive = async (question: Question) => {
    try {
      await updateQuestion(question.id, { is_active: !question.is_active });
    } catch {
      // Error handled in store
    }
  };

  const handleSeed = async () => {
    if (confirm('This will load 30 default questions. Continue?')) {
      try {
        await seedQuestions();
      } catch {
        // Error handled in store
      }
    }
  };

  const handleExport = async () => {
    try {
      await exportQuestions();
    } catch {
      // Error handled in store
    }
  };

  return (
    <div className="space-y-6">
      {/* Actions Bar */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search questions..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        <Select value={domainFilter} onValueChange={(val) => setDomainFilter(val as typeof domainFilter)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by domain" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Domains</SelectItem>
            <SelectItem value="childhood">Childhood</SelectItem>
            <SelectItem value="family">Family</SelectItem>
            <SelectItem value="career">Career</SelectItem>
            <SelectItem value="wisdom">Wisdom</SelectItem>
            <SelectItem value="challenges">Challenges</SelectItem>
            <SelectItem value="personality">Personality</SelectItem>
          </SelectContent>
        </Select>

        <div className="flex gap-2">
          <Button onClick={() => setIsDialogOpen(true)} size="sm">
            <Plus className="mr-2 h-4 w-4" />
            Add Question
          </Button>
          <Button onClick={handleSeed} variant="outline" size="sm">
            <RefreshCw className="mr-2 h-4 w-4" />
            Seed
          </Button>
          <Button onClick={handleExport} variant="outline" size="sm">
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
        </div>
      </div>

      {/* Questions Table */}
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12"></TableHead>
              <TableHead className="w-20">Order</TableHead>
              <TableHead>Question</TableHead>
              <TableHead>Domain</TableHead>
              <TableHead className="w-24">Duration</TableHead>
              <TableHead className="w-28">Status</TableHead>
              <TableHead className="w-20"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoadingQuestions ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                  Loading questions...
                </TableCell>
              </TableRow>
            ) : filteredQuestions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                  {searchQuery || domainFilter !== 'all' ? 'No questions match your filters' : 'No questions found'}
                </TableCell>
              </TableRow>
            ) : (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={filteredQuestions.map((q) => q.id)} strategy={verticalListSortingStrategy}>
                  {filteredQuestions.map((question) => (
                    <SortableQuestionRow
                      key={question.id}
                      question={question}
                      onEdit={handleEdit}
                      onDelete={handleDelete}
                      onToggleActive={handleToggleActive}
                    />
                  ))}
                </SortableContext>
              </DndContext>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Question Dialog */}
      <QuestionDialog
        open={isDialogOpen}
        onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) setEditingQuestion(null);
        }}
        question={editingQuestion}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteConfirmQuestion} onOpenChange={() => setDeleteConfirmQuestion(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Question?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this question? This action cannot be undone.
              {deleteConfirmQuestion && (
                <p className="mt-2 font-medium text-foreground">&quot;{deleteConfirmQuestion.question_text}&quot;</p>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

