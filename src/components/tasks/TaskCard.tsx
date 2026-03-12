'use client';

import { useState } from 'react';
import { Task, TaskPriority } from '@/types/task';
import { cn } from '@/lib/utils';
import { 
  Calendar, 
  User, 
  AlertCircle,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Flame
} from 'lucide-react';
import { formatDistanceToNow, parseISO, isPast, isToday, isTomorrow } from 'date-fns';
import { de } from 'date-fns/locale';

interface TaskCardProps {
  task: Task;
  onEdit: () => void;
}

export function TaskCard({ task, onEdit }: TaskCardProps) {
  const [isDragging, setIsDragging] = useState(false);

  const handleDragStart = (e: React.DragEvent) => {
    setIsDragging(true);
    e.dataTransfer.setData('taskId', task.id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragEnd = () => {
    setIsDragging(false);
  };

  const getPriorityColor = (priority: TaskPriority) => {
    switch (priority) {
      case 'LOW':
        return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300';
      case 'MEDIUM':
        return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300';
      case 'HIGH':
        return 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300';
      case 'URGENT':
        return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const getPriorityIcon = (priority: TaskPriority) => {
    switch (priority) {
      case 'LOW':
        return <Clock className="h-3 w-3" />;
      case 'MEDIUM':
        return <AlertCircle className="h-3 w-3" />;
      case 'HIGH':
        return <AlertTriangle className="h-3 w-3" />;
      case 'URGENT':
        return <Flame className="h-3 w-3" />;
    }
  };

  const formatDueDate = (dateString?: string | null) => {
    if (!dateString) return null;
    const date = parseISO(dateString);
    
    if (isToday(date)) return { text: 'Heute', urgent: true };
    if (isTomorrow(date)) return { text: 'Morgen', urgent: false };
    if (isPast(date) && date < new Date(new Date().setHours(0,0,0,0))) {
      return { text: `${formatDistanceToNow(date, { locale: de, addSuffix: true })}`, urgent: true };
    }
    return { text: formatDistanceToNow(date, { locale: de, addSuffix: true }), urgent: false };
  };

  const dueDateInfo = formatDueDate(task.dueDate);

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onClick={onEdit}
      className={cn(
        'bg-white dark:bg-gray-800 rounded-lg p-4 cursor-pointer',
        'border border-gray-200 dark:border-gray-700',
        'shadow-sm hover:shadow-md hover:border-blue-300 dark:hover:border-blue-600',
        'transition-all duration-200',
        isDragging && 'opacity-50 rotate-2',
        task.status === 'DONE' && 'opacity-60'
      )}
    >
      {/* Priority Badge */}
      <div className="flex items-center justify-between mb-2">
        <span
          className={cn(
            'inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full',
            getPriorityColor(task.priority)
          )}
        >
          {getPriorityIcon(task.priority)}
          {task.priority}
        </span>
        
        {task.status === 'DONE' && (
          <CheckCircle2 className="h-4 w-4 text-green-500" />
        )}
      </div>

      {/* Title */}
      <h4 className={cn(
        'font-medium text-gray-900 dark:text-white mb-2 line-clamp-2',
        task.status === 'DONE' && 'line-through text-gray-500'
      )}>
        {task.title}
      </h4>

      {/* Description Preview */}
      {task.description && (
        <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2 mb-3">
          {task.description}
        </p>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between text-xs">
        {/* Assignee */}
        <div className="flex items-center gap-1 text-gray-500 dark:text-gray-400">
          <User className="h-3 w-3" />
          <span>
            {task.assignee 
              ? `${task.assignee.firstName} ${task.assignee.lastName}`
              : 'Nicht zugewiesen'
            }
          </span>
        </div>

        {/* Due Date */}
        {dueDateInfo && (
          <div className={cn(
            'flex items-center gap-1',
            dueDateInfo.urgent ? 'text-red-600 dark:text-red-400' : 'text-gray-500 dark:text-gray-400'
          )}>
            <Calendar className="h-3 w-3" />
            <span className={dueDateInfo.urgent ? 'font-medium' : ''}>
              {dueDateInfo.text}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
