'use client';

import { useState, useRef } from 'react';
import { Task, TaskStatus } from '@/types/task';
import { TaskCard } from './TaskCard';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

interface KanbanColumnProps {
  status: TaskStatus;
  title: string;
  tasks: Task[];
  onDragEnd: (taskId: string, newStatus: TaskStatus) => void;
  onEditTask: (task: Task) => void;
  isLoading?: boolean;
}

export function KanbanColumn({
  status,
  title,
  tasks,
  onDragEnd,
  onEditTask,
  isLoading,
}: KanbanColumnProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const columnRef = useRef<HTMLDivElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const taskId = e.dataTransfer.getData('taskId');
    if (taskId) {
      onDragEnd(taskId, status);
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'TODO':
        return 'bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-600';
      case 'IN_PROGRESS':
        return 'bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-600';
      case 'DONE':
        return 'bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-600';
      default:
        return 'bg-gray-100 dark:bg-gray-800';
    }
  };

  return (
    <div
      ref={columnRef}
      className={cn(
        'flex flex-col w-80 min-w-80 rounded-lg border-2 transition-colors',
        getStatusColor(),
        isDragOver && 'border-dashed border-blue-500 bg-blue-50/50 dark:bg-blue-900/20'
      )}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Column Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <h3 className="font-semibold text-gray-900 dark:text-white">
          {title}
        </h3>
        <span className="px-2 py-1 text-xs font-medium bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-full">
          {isLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : tasks.length}
        </span>
      </div>

      {/* Tasks Container */}
      <div className="flex-1 p-3 space-y-3 overflow-y-auto min-h-[200px]">
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        ) : tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-gray-400">
            <p className="text-sm">Keine Aufgaben</p>
          </div>
        ) : (
          tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              onEdit={() => onEditTask(task)}
            />
          ))
        )}
      </div>
    </div>
  );
}
