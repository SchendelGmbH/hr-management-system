export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'DONE' | 'CANCELLED';
export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export interface Task {
  id: string;
  title: string;
  description?: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  assigneeId?: string | null;
  assignee?: {
    id: string;
    firstName: string;
    lastName: string;
    employeeNumber: string;
  } | null;
  createdById: string;
  createdBy?: {
    id: string;
    username: string;
  };
  dueDate?: string | null;
  completedAt?: string | null;
  sourceRoomId?: string | null;
  sourceMessageId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TaskAuditLog {
  id: string;
  taskId: string;
  action: string;
  oldValue?: string | null;
  newValue?: string | null;
  performedById: string;
  performedBy?: {
    id: string;
    username: string;
  };
  createdAt: string;
}

export interface CreateTaskInput {
  title: string;
  description?: string;
  assigneeId?: string | null;
  status?: TaskStatus;
  priority?: TaskPriority;
  dueDate?: string | null;
  sourceRoomId?: string;
  sourceMessageId?: string;
}

export interface UpdateTaskInput {
  title?: string;
  description?: string;
  assigneeId?: string | null;
  status?: TaskStatus;
  priority?: TaskPriority;
  dueDate?: string | null;
}
