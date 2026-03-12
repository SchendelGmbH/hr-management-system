'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { Task, TaskStatus, TaskPriority, CreateTaskInput } from '@/types/task';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Select } from '@/components/ui/Select';
import { X, Trash2, Save } from 'lucide-react';

interface TaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  task: Task | null;
}

export function TaskModal({ isOpen, onClose, task }: TaskModalProps) {
  const t = useTranslations('tasks');
  const queryClient = useQueryClient();
  const isEditing = !!task;

  // Form state
  const [formData, setFormData] = useState<CreateTaskInput>({
    title: '',
    description: '',
    status: 'TODO',
    priority: 'MEDIUM',
    assigneeId: null,
    dueDate: null,
  });

  // Reset form when task changes or modal opens/closes
  useEffect(() => {
    if (task) {
      setFormData({
        title: task.title,
        description: task.description || '',
        status: task.status,
        priority: task.priority,
        assigneeId: task.assigneeId || null,
        dueDate: task.dueDate ? task.dueDate.split('T')[0] : null,
      });
    } else {
      setFormData({
        title: '',
        description: '',
        status: 'TODO',
        priority: 'MEDIUM',
        assigneeId: null,
        dueDate: null,
      });
    }
  }, [task, isOpen]);

  // Fetch employees for assignee dropdown
  const { data: employees = [] } = useQuery({
    queryKey: ['employees', 'dropdown'],
    queryFn: async () => {
      const res = await fetch('/api/employees?limit=1000');
      if (!res.ok) throw new Error('Failed to fetch employees');
      return res.json();
    },
    enabled: isOpen,
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (data: CreateTaskInput) => {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to create task');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      onClose();
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async (data: Partial<CreateTaskInput>) => {
      const res = await fetch(`/api/tasks/${task!.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to update task');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      onClose();
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/tasks/${task!.id}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to delete task');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      onClose();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) return;

    const submitData = {
      ...formData,
      dueDate: formData.dueDate ? new Date(formData.dueDate).toISOString() : null,
    };

    if (isEditing) {
      updateMutation.mutate(submitData);
    } else {
      createMutation.mutate(submitData as CreateTaskInput);
    }
  };

  const handleDelete = () => {
    if (confirm(t('confirmDelete'))) {
      deleteMutation.mutate();
    }
  };

  const isLoading = createMutation.isPending || updateMutation.isPending || deleteMutation.isPending;

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {isEditing ? t('editTask') : t('newTask')}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-500"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Title */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            {t('title')} *
          </label>
          <Input
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            placeholder="Aufgabentitel"
            required
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            {t('description')}
          </label>
          <Textarea
            value={formData.description || ''}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="Beschreibung der Aufgabe..."
            rows={3}
          />
        </div>

        {/* Status and Priority */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('status')}
            </label>
            <Select
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value as TaskStatus })}
            >
              <option value="TODO">{t('statuses.todo')}</option>
              <option value="IN_PROGRESS">{t('statuses.inProgress')}</option>
              <option value="DONE">{t('statuses.done')}</option>
              <option value="CANCELLED">{t('statuses.cancelled')}</option>
            </Select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('priority')}
            </label>
            <Select
              value={formData.priority}
              onChange={(e) => setFormData({ ...formData, priority: e.target.value as TaskPriority })}
            >
              <option value="LOW">{t('priorities.low')}</option>
              <option value="MEDIUM">{t('priorities.medium')}</option>
              <option value="HIGH">{t('priorities.high')}</option>
              <option value="URGENT">{t('priorities.urgent')}</option>
            </Select>
          </div>
        </div>

        {/* Assignee and Due Date */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('assignee')}
            </label>
            <Select
              value={formData.assigneeId || ''}
              onChange={(e) => setFormData({ ...formData, assigneeId: e.target.value || null })}
            >
              <option value="">-- Nicht zugewiesen --</option>
              {employees.map((emp: any) => (
                <option key={emp.id} value={emp.id}>
                  {emp.firstName} {emp.lastName} ({emp.employeeNumber})
                </option>
              ))}
            </Select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('dueDate')}
            </label>
            <Input
              type="date"
              value={formData.dueDate || ''}
              onChange={(e) => setFormData({ ...formData, dueDate: e.target.value || null })}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-gray-700">
          {isEditing ? (
            <Button
              type="button"
              variant="danger"
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
              className="flex items-center gap-2"
            >
              <Trash2 className="h-4 w-4" />
              {t('delete')}
            </Button>
          ) : (
            <div />
          )}
          
          <div className="flex items-center gap-3">
            <Button type="button" variant="secondary" onClick={onClose}>
              {t('cancel')}
            </Button>
            <Button
              type="submit"
              disabled={isLoading || !formData.title.trim()}
              className="flex items-center gap-2"
            >
              <Save className="h-4 w-4" />
              {isLoading ? '...' : t('save')}
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
