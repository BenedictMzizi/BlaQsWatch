import { useCallback, useEffect, useState } from 'react';
import {
  ArrowPathIcon,
  UserPlusIcon,
  UsersIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';

import toast from 'react-hot-toast';
import { supabase } from '../../lib/supabase';
import { useWorkspace } from '../../components/layout/DashboardLayout';
import '../../styles/company-management.css';


const ROLE_LABELS = {
  manager: 'Manager',
  staff: 'Staff'
};

function formatDate(value) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('en-ZA', {
    dateStyle: 'medium'
  }).format(new Date(value));
}

export default function EmployeeManagement() {
  const { selectedBusiness, selectedBusinessId, role } = useWorkspace();

  const [employees, setEmployees] = useState([]);
  const [invitations, setInvitations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    role: 'staff'
  });

  const isCompanyAdmin = role === 'admin';

  const invoke = useCallback(async (action, payload = {}) => {
    const { data, error } = await supabase.functions.invoke('company-employees', {
      body: { action, businessId: selectedBusinessId, ...payload }
    });

    if (error) {
      let message = error.message || 'The request could not be completed.';
      if (error.context && typeof error.context.json === 'function') {
        try {
          const body = await error.context.json();
          message = body.error || body.message || message;
        } catch {
          // Keep the original Functions error message.
        }
      }
      throw new Error(message);
    }

    if (data?.error) throw new Error(data.error);
    return data;
  }, []);

  const loadData = useCallback(async () => {
    if (!selectedBusinessId || !isCompanyAdmin) {
      setEmployees([]);
      setInvitations([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const data = await invoke('list');
      setEmployees(data.employees || []);
      setInvitations(data.invitations || []);
    } catch (error) {
      toast.error(error.message || 'Unable to load employees.');
    } finally {
      setLoading(false);
    }
  }, [invoke, isCompanyAdmin, selectedBusinessId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function handleInvite(event) {
    event.preventDefault();

    const fullName = form.fullName.trim();
    const email = form.email.trim().toLowerCase();

    if (!fullName || !email) {
      toast.error('Enter the employee name and email address.');
      return;
    }

    setSubmitting(true);
    try {
      await invoke('invite_employee', {
        fullName,
        email,
        role: form.role
      });
      toast.success('Invitation sent successfully.');
      setForm({ fullName: '', email: '', role: 'staff' });
      setShowInvite(false);
      await loadData();
    } catch (error) {
      toast.error(error.message || 'Unable to send invitation.');
    } finally {
      setSubmitting(false);
    }
  }

  async function updateEmployee(userId, changes) {
    try {
      await invoke('update_member', { userId, ...changes });
      toast.success('Employee access updated.');
      await loadData();
    } catch (error) {
      toast.error(error.message || 'Unable to update employee.');
    }
  }

  async function revokeInvitation(invitationId) {
    if (!window.confirm('Revoke this pending invitation?')) return;

    try {
      await invoke('revoke_invitation', { invitationId });
      toast.success('Invitation revoked.');
      await loadData();
    } catch (error) {
      toast.error(error.message || 'Unable to revoke invitation.');
    }
  }

  if (!isCompanyAdmin) {
    return (
      <section className="page-content employee-management-page">
        <div className="empty-state">
          <h2>Access restricted</h2>
          <p>Only this company's administrator can manage employees.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="page-content employee-management-page">
      <div className="page-header">
        <div>
          <p className="eyebrow">COMPANY WORKSPACE</p>
          <h1>Employee Management</h1>
          <p className="muted">
            Manage access for {selectedBusiness?.name || 'your company'}.
          </p>
        </div>

        <div className="page-actions">
          <button className="btn btn-secondary" type="button" onClick={loadData}>
            <ArrowPathIcon className="button-icon" />
            Refresh
          </button>
          <button
            className="btn btn-primary"
            type="button"
            onClick={() => setShowInvite(true)}
          >
            <UserPlusIcon className="button-icon" />
            Invite employee
          </button>
        </div>
      </div>

      <div className="stats-grid">
        <article className="stat-card">
          <div className="stat-icon"><UsersIcon /></div>
          <div>
            <span className="stat-label">Active employees</span>
            <strong>{employees.filter((employee) => employee.active).length}</strong>
          </div>
        </article>
        <article className="stat-card">
          <div className="stat-icon"><UserPlusIcon /></div>
          <div>
            <span className="stat-label">Pending invitations</span>
            <strong>{invitations.length}</strong>
          </div>
        </article>
      </div>

      <section className="content-card">
        <div className="section-heading">
          <div>
            <h2>Company employees</h2>
            <p className="muted">Only Manager and Staff roles can be assigned here.</p>
          </div>
        </div>

        {loading ? (
          <div className="loading-state">Loading employees...</div>
        ) : employees.length === 0 ? (
          <div className="empty-state">
            <UsersIcon className="empty-state-icon" />
            <h3>No employees yet</h3>
            <p>Invite your first Manager or Staff member to this company.</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Joined</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {employees.map((employee) => (
                  <tr key={employee.user_id}>
                    <td>
                      <strong>{employee.full_name || 'Unnamed employee'}</strong>
                      <span className="table-subtext">{employee.email || '—'}</span>
                    </td>
                    <td>
                      <select
                        className="form-control table-select"
                        value={employee.role}
                        onChange={(event) =>
                          updateEmployee(employee.user_id, { role: event.target.value })
                        }
                        aria-label={`Role for ${employee.full_name || employee.email}`}
                      >
                        <option value="manager">Manager</option>
                        <option value="staff">Staff</option>
                      </select>
                    </td>
                    <td>
                      <span className={`status-badge ${employee.active ? 'status-active' : 'status-inactive'}`}>
                        {employee.active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td>{formatDate(employee.created_at)}</td>
                    <td>
                      <button
                        className="btn btn-small btn-secondary"
                        type="button"
                        onClick={() =>
                          updateEmployee(employee.user_id, { active: !employee.active })
                        }
                      >
                        {employee.active ? 'Deactivate' : 'Activate'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="content-card">
        <div className="section-heading">
          <div>
            <h2>Pending invitations</h2>
            <p className="muted">Invited employees do not receive company access until they accept.</p>
          </div>
        </div>

        {loading ? (
          <div className="loading-state">Loading invitations...</div>
        ) : invitations.length === 0 ? (
          <p className="muted">There are no pending invitations.</p>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Expires</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {invitations.map((invitation) => (
                  <tr key={invitation.id}>
                    <td>{invitation.full_name}</td>
                    <td>{invitation.email}</td>
                    <td>{ROLE_LABELS[invitation.role] || invitation.role}</td>
                    <td>{formatDate(invitation.expires_at)}</td>
                    <td>
                      <button
                        className="btn btn-small btn-danger"
                        type="button"
                        onClick={() => revokeInvitation(invitation.id)}
                      >
                        Revoke
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {showInvite && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setShowInvite(false);
        }}>
          <section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="invite-title">
            <div className="modal-header">
              <div>
                <p className="eyebrow">NEW TEAM MEMBER</p>
                <h2 id="invite-title">Invite employee</h2>
              </div>
              <button className="icon-button" type="button" onClick={() => setShowInvite(false)} aria-label="Close">
                <XMarkIcon />
              </button>
            </div>

            <form onSubmit={handleInvite}>
              <label className="form-label" htmlFor="employee-name">Full name</label>
              <input
                id="employee-name"
                className="form-control"
                value={form.fullName}
                onChange={(event) => setForm((current) => ({ ...current, fullName: event.target.value }))}
                autoComplete="name"
                required
              />

              <label className="form-label" htmlFor="employee-email">Email address</label>
              <input
                id="employee-email"
                className="form-control"
                type="email"
                value={form.email}
                onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                autoComplete="email"
                required
              />

              <label className="form-label" htmlFor="employee-role">Company role</label>
              <select
                id="employee-role"
                className="form-control"
                value={form.role}
                onChange={(event) => setForm((current) => ({ ...current, role: event.target.value }))}
              >
                <option value="staff">Staff</option>
                <option value="manager">Manager</option>
              </select>

              <p className="form-hint">
                Company Admin privileges cannot be assigned from this page.
              </p>

              <div className="modal-actions">
                <button className="btn btn-secondary" type="button" onClick={() => setShowInvite(false)}>
                  Cancel
                </button>
                <button className="btn btn-primary" type="submit" disabled={submitting}>
                  {submitting ? 'Sending...' : 'Send invitation'}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </section>
  );
}
