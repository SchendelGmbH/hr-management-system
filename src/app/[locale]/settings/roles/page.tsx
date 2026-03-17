'use client';

import { useState, useEffect } from 'react';
import { 
  Shield, 
  Plus, 
  Trash2, 
  Edit2, 
  Save,
  Users,
  Lock,
  Unlock,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Check,
  X
} from 'lucide-react';
import axios from 'axios';
import { clsx } from 'clsx';

interface Module {
  id: string;
  key: string;
  name: string;
  description?: string;
  icon?: string;
}

interface ModulePermission {
  moduleId: string;
  moduleKey: string;
  moduleName: string;
  canAccess: boolean;
}

interface FinePermission {
  id: string;
  key: string;
  name: string;
  description?: string;
  moduleId: string;
  moduleKey: string;
  moduleName: string;
  granted: boolean;
}

interface Role {
  id: string;
  name: string;
  description?: string;
  isSystem: boolean;
  isActive: boolean;
  permissions: ModulePermission[];
}

export default function RolesPermissionsPage() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [modules, setModules] = useState<Module[]>([]);
  const [finePermissions, setFinePermissions] = useState<FinePermission[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newRole, setNewRole] = useState({ name: '', description: '' });
  const [selectedModulePermissions, setSelectedModulePermissions] = useState<Record<string, boolean>>({});
  const [selectedFinePermissions, setSelectedFinePermissions] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set());

  // Fetch roles, modules and permissions
  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      
      // Fetch roles
      const rolesRes = await axios.get('/api/admin/roles');
      setRoles(rolesRes.data.roles || []);
      
      // Fetch active modules
      const modulesRes = await axios.get('/api/admin/modules');
      const activeModules = (modulesRes.data.modules || []).filter((m: Module) => m.isActive !== false);
      setModules(activeModules);
      
      // Fetch fine-grained permissions
      const permsRes = await axios.get('/api/admin/permissions');
      setFinePermissions(permsRes.data.permissions || []);
      
      setError(null);
    } catch (err) {
      console.error('Error fetching data:', err);
      setError('Fehler beim Laden der Daten');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchRoleFinePermissions = async (roleId: string) => {
    try {
      const res = await axios.get(`/api/admin/roles/permissions?roleId=${roleId}`);
      const perms = res.data.permissions || [];
      
      // Convert to record - initialize all permissions from API response
      const permsRecord: Record<string, boolean> = {};
      perms.forEach((p: FinePermission) => {
        permsRecord[p.id] = p.granted;
      });
      
      // Also initialize any permissions that weren't in the response (default to false)
      finePermissions.forEach((p) => {
        if (!(p.id in permsRecord)) {
          permsRecord[p.id] = false;
        }
      });
      
      setSelectedFinePermissions(permsRecord);
    } catch (err) {
      console.error('Error fetching role fine permissions:', err);
      // Initialize all to false on error
      const permsRecord: Record<string, boolean> = {};
      finePermissions.forEach((p) => {
        permsRecord[p.id] = false;
      });
      setSelectedFinePermissions(permsRecord);
    }
  };

  const handleCreateRole = async () => {
    if (!newRole.name.trim()) return;

    try {
      setSaving(true);
      
      // Prepare module permissions
      const permissions = modules.map(m => ({
        moduleId: m.id,
        canAccess: selectedModulePermissions[m.id] !== false
      }));

      const res = await axios.post('/api/admin/roles', {
        name: newRole.name,
        description: newRole.description,
        permissions
      });

      const createdRole = res.data.role;

      // Set fine-grained permissions for new role - send all permissions
      for (const [permId, granted] of Object.entries(selectedFinePermissions)) {
        await axios.post('/api/admin/roles/permissions', {
          roleId: createdRole.id,
          permissionId: permId,
          granted: granted === true
        });
      }

      setShowCreateModal(false);
      setNewRole({ name: '', description: '' });
      setSelectedModulePermissions({});
      setSelectedFinePermissions({});
      fetchData();
    } catch (err: any) {
      console.error('Error creating role:', err);
      alert(err.response?.data?.error || 'Fehler beim Erstellen der Rolle');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateRole = async () => {
    if (!editingRole) return;

    try {
      setSaving(true);
      
      // Prepare module permissions
      const permissions = modules.map(m => ({
        moduleId: m.id,
        canAccess: selectedModulePermissions[m.id] !== false
      }));

      await axios.patch('/api/admin/roles', {
        id: editingRole.id,
        name: editingRole.name,
        description: editingRole.description,
        permissions
      });

      // Update fine-grained permissions - send all permissions (both true and false)
      for (const [permId, granted] of Object.entries(selectedFinePermissions)) {
        await axios.post('/api/admin/roles/permissions', {
          roleId: editingRole.id,
          permissionId: permId,
          granted: granted === true
        });
      }

      setEditingRole(null);
      setSelectedModulePermissions({});
      setSelectedFinePermissions({});
      fetchData();
    } catch (err: any) {
      console.error('Error updating role:', err);
      alert(err.response?.data?.error || 'Fehler beim Aktualisieren der Rolle');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteRole = async (roleId: string) => {
    if (!confirm('Möchten Sie diese Rolle wirklich löschen?')) return;

    try {
      await axios.delete(`/api/admin/roles?id=${roleId}`);
      fetchData();
    } catch (err: any) {
      console.error('Error deleting role:', err);
      alert(err.response?.data?.error || 'Fehler beim Löschen der Rolle');
    }
  };

  const openEditModal = async (role: Role) => {
    setEditingRole(role);
    
    // Initialize module permissions from role
    const perms: Record<string, boolean> = {};
    modules.forEach(m => {
      const rolePerm = role.permissions.find(p => p.moduleId === m.id);
      perms[m.id] = rolePerm ? rolePerm.canAccess : true;
    });
    setSelectedModulePermissions(perms);
    
    // Fetch fine-grained permissions
    await fetchRoleFinePermissions(role.id);
  };

  const openCreateModal = () => {
    setShowCreateModal(true);
    
    // Initialize all module permissions to true
    const perms: Record<string, boolean> = {};
    modules.forEach(m => {
      perms[m.id] = true;
    });
    setSelectedModulePermissions(perms);
    
    // Initialize all fine permissions to false (default deny)
    const finePerms: Record<string, boolean> = {};
    finePermissions.forEach(p => {
      finePerms[p.id] = false;
    });
    setSelectedFinePermissions(finePerms);
  };

  const toggleModulePermission = (moduleId: string) => {
    setSelectedModulePermissions(prev => ({
      ...prev,
      [moduleId]: !prev[moduleId]
    }));
  };

  const toggleFinePermission = (permissionId: string) => {
    setSelectedFinePermissions(prev => ({
      ...prev,
      [permissionId]: !prev[permissionId]
    }));
  };

  const toggleModuleExpand = (moduleId: string) => {
    setExpandedModules(prev => {
      const newSet = new Set(prev);
      if (newSet.has(moduleId)) {
        newSet.delete(moduleId);
      } else {
        newSet.add(moduleId);
      }
      return newSet;
    });
  };

  // Get permissions for a specific module
  const getModulePermissions = (moduleId: string) => {
    return finePermissions.filter(p => p.moduleId === moduleId);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center text-white">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Rollen & Berechtigungen</h1>
            <p className="text-sm text-gray-600">Verwalten Sie Benutzerrollen und Modul-Zugriffe</p>
          </div>
        </div>
        <button
          onClick={openCreateModal}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Neue Rolle
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700">
          <AlertCircle className="h-5 w-5" />
          <span>{error}</span>
        </div>
      )}

      {/* Info */}
      <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg flex items-start gap-3">
        <AlertCircle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-blue-800">
          <p>
            <strong>Hinweis:</strong> Hier können Sie Benutzerrollen erstellen und festlegen, 
            welche Rollen Zugriff auf welche Module haben. Unter jedem Modul können Sie auch 
            spezifische Berechtigungen (z.B. "Mitarbeiter löschen") vergeben.
          </p>
          <p className="mt-2">
            <strong>Die ADMIN-Rolle</strong> hat immer vollständige Berechtigungen 
            und kann nicht bearbeitet werden. Die USER-Rolle und eigene Rollen (z.B. "Manager") 
            können bearbeitet werden.
          </p>
        </div>
      </div>

      {/* Roles List */}
      <div className="space-y-4">
        {roles.map((role) => (
          <div
            key={role.id}
            className={clsx(
              'p-6 rounded-lg border-2 transition-all',
              role.isSystem 
                ? 'border-gray-200 bg-gray-50' 
                : 'border-gray-200 bg-white hover:border-primary-300'
            )}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className={clsx(
                  'w-10 h-10 rounded-lg flex items-center justify-center',
                  role.isSystem ? 'bg-gray-200 text-gray-600' : 'bg-primary-100 text-primary-600'
                )}>
                  <Users className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-gray-900">{role.name}</h3>
                    {role.isSystem && (
                      <span className="px-2 py-0.5 bg-gray-200 text-gray-600 text-xs rounded-full">
                        System
                      </span>
                    )}
                    {!role.isActive && (
                      <span className="px-2 py-0.5 bg-red-100 text-red-600 text-xs rounded-full">
                        Inaktiv
                      </span>
                    )}
                  </div>
                  {role.description && (
                    <p className="text-sm text-gray-500">{role.description}</p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                {/* Only ADMIN role cannot be edited - USER and custom roles can be edited */}
                {role.name !== 'ADMIN' && (
                  <button
                    onClick={() => openEditModal(role)}
                    className="p-2 text-gray-500 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                    title="Berechtigungen bearbeiten"
                  >
                    <Edit2 className="h-4 w-4" />
                  </button>
                )}
                {/* Only non-system roles can be deleted */}
                {!role.isSystem && (
                  <button
                    onClick={() => handleDeleteRole(role.id)}
                    className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Rolle löschen"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Permissions Preview */}
            <div className="mt-4 pt-4 border-t border-gray-200">
              {role.name === 'ADMIN' ? (
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Unlock className="h-4 w-4 text-green-600" />
                  <span>System-Rolle mit vollständigen Berechtigungen</span>
                </div>
              ) : (
                <>
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Modul-Zugriffe:</h4>
                  <div className="flex flex-wrap gap-2">
                    {role.permissions.length > 0 ? (
                      role.permissions.map((perm) => (
                        <span
                          key={perm.moduleId}
                          className={clsx(
                            'inline-flex items-center gap-1 px-2 py-1 rounded text-xs',
                            perm.canAccess 
                              ? 'bg-green-100 text-green-700' 
                              : 'bg-gray-100 text-gray-500'
                          )}
                        >
                          {perm.canAccess ? (
                            <Unlock className="h-3 w-3" />
                          ) : (
                            <Lock className="h-3 w-3" />
                          )}
                          {perm.moduleName}
                        </span>
                      ))
                    ) : (
                      <span className="text-sm text-gray-400">Keine Berechtigungen</span>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Create/Edit Modal */}
      {(showCreateModal || editingRole) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div 
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => {
              setShowCreateModal(false);
              setEditingRole(null);
            }}
          />
          
          <div className="relative w-full max-w-3xl bg-white rounded-xl shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900">
                {editingRole ? 'Rolle bearbeiten' : 'Neue Rolle erstellen'}
              </h2>
            </div>

            <div className="p-6 space-y-6">
              {/* Role Info */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Name *
                  </label>
                  <input
                    type="text"
                    value={editingRole?.name || newRole.name}
                    onChange={(e) => editingRole 
                      ? setEditingRole({...editingRole, name: e.target.value})
                      : setNewRole({...newRole, name: e.target.value})
                    }
                    disabled={editingRole?.isSystem}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:bg-gray-100"
                    placeholder="z.B. Manager"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Beschreibung
                  </label>
                  <textarea
                    value={editingRole?.description || newRole.description}
                    onChange={(e) => editingRole
                      ? setEditingRole({...editingRole, description: e.target.value})
                      : setNewRole({...newRole, description: e.target.value})
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    rows={2}
                    placeholder="Beschreibung der Rolle..."
                  />
                </div>
              </div>

              {/* Module Permissions with Fine-grained permissions */}
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-3">Modul-Zugriffe & Berechtigungen</h3>
                <div className="space-y-2">
                  {modules.map((module) => {
                    const modulePerms = getModulePermissions(module.id);
                    const isExpanded = expandedModules.has(module.id);
                    const hasAccess = selectedModulePermissions[module.id] !== false;
                    
                    return (
                      <div key={module.id} className="border border-gray-200 rounded-lg overflow-hidden">
                        {/* Module Header */}
                        <div className="flex items-center justify-between p-3 bg-gray-50">
                          <div className="flex items-center gap-3">
                            <button
                              onClick={() => toggleModuleExpand(module.id)}
                              className="p-1 hover:bg-gray-200 rounded"
                            >
                              {isExpanded ? (
                                <ChevronDown className="h-4 w-4 text-gray-500" />
                              ) : (
                                <ChevronRight className="h-4 w-4 text-gray-500" />
                              )}
                            </button>
                            <div>
                              <p className="font-medium text-gray-900">{module.name}</p>
                              {module.description && (
                                <p className="text-sm text-gray-500">{module.description}</p>
                              )}
                            </div>
                          </div>
                          
                          <button
                            onClick={() => toggleModulePermission(module.id)}
                            className={clsx(
                              'flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                              hasAccess
                                ? 'bg-green-100 text-green-700 hover:bg-green-200'
                                : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                            )}
                          >
                            {hasAccess ? (
                              <>
                                <Unlock className="h-4 w-4" />
                                Zugriff erlaubt
                              </>
                            ) : (
                              <>
                                <Lock className="h-4 w-4" />
                                Kein Zugriff
                              </>
                            )}
                          </button>
                        </div>
                        
                        {/* Fine-grained Permissions */}
                        {isExpanded && hasAccess && modulePerms.length > 0 && (
                          <div className="p-3 bg-white border-t border-gray-200">
                            <p className="text-xs font-medium text-gray-500 mb-2">Spezifische Berechtigungen:</p>
                            <div className="space-y-2">
                              {modulePerms.map((perm) => (
                                <div
                                  key={perm.id}
                                  className="flex items-center justify-between p-2 hover:bg-gray-50 rounded"
                                >
                                  <div>
                                    <p className="text-sm font-medium text-gray-800">{perm.name}</p>
                                    {perm.description && (
                                      <p className="text-xs text-gray-500">{perm.description}</p>
                                    )}
                                  </div>
                                  
                                  <button
                                    onClick={() => toggleFinePermission(perm.id)}
                                    className={clsx(
                                      'flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors',
                                      selectedFinePermissions[perm.id]
                                        ? 'bg-green-100 text-green-700'
                                        : 'bg-gray-100 text-gray-500'
                                    )}
                                  >
                                    {selectedFinePermissions[perm.id] ? (
                                      <>
                                        <Check className="h-3 w-3" />
                                        Erlaubt
                                      </>
                                    ) : (
                                      <>
                                        <X className="h-3 w-3" />
                                        Verweigert
                                      </>
                                    )}
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        
                        {isExpanded && hasAccess && modulePerms.length === 0 && (
                          <div className="p-3 bg-white border-t border-gray-200">
                            <p className="text-sm text-gray-400 italic">Keine spezifischen Berechtigungen für dieses Modul</p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setEditingRole(null);
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Abbrechen
              </button>
              <button
                onClick={editingRole ? handleUpdateRole : handleCreateRole}
                disabled={saving || (!editingRole && !newRole.name.trim())}
                className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {saving ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Speichern...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    Speichern
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
