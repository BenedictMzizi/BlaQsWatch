
import { useCallback, useEffect, useMemo, useState } from 'react';
import { NavLink } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  ArrowPathIcon,
  UserGroupIcon,
  MagnifyingGlassIcon,
  PlusIcon,
  XMarkIcon,
  BuildingOffice2Icon,
  EnvelopeIcon,
  UserPlusIcon,
  ShieldCheckIcon,
} from '@heroicons/react/24/outline';
import { supabase } from '../../lib/supabase';
import '../../styles/platform-management.css';

const EMPTY_INVITE = {
  businessId: '',
  fullName: '',
  email: '',
  role: 'staff',
};

const EMPTY_ASSIGNMENT = {
  businessId: '',
  userId: '',
  role: 'staff',
};

// Company Admin is managed through the dedicated platform admin process.
const EMPLOYEE_ROLES = ['manager', 'staff'];

function formatDate(value) {
  if (!value) return '—';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return '—';

  return date.toLocaleDateString('en-ZA', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function getErrorMessage(error) {
  return error?.message || 'Something went wrong. Please try again.';
}

function getRoleLabel(role) {
  if (!role) return 'Unknown';

  return role.charAt(0).toUpperCase() + role.slice(1);
}

export default function EmployeeManagement() {
  const [companies, setCompanies] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [invitations, setInvitations] = useState([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [search, setSearch] = useState('');
  const [companyFilter, setCompanyFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  const [modal, setModal] = useState(null);
  const [inviteForm, setInviteForm] = useState(EMPTY_INVITE);
  const [assignmentForm, setAssignmentForm] = useState(EMPTY_ASSIGNMENT);

  const [saving, setSaving] = useState(false);
  const [workingId, setWorkingId] = useState(null);

  const invoke = useCallback(async (body) => {
    const { data, error } = await supabase.functions.invoke(
      'platform-companies',
      { body }
    );

    if (error) {
      throw new Error(
        data?.error ||
        error.message ||
        'Unable to contact the platform service.'
      );
    }

    if (data?.error) {
      const functionError = new Error(data.error);
      functionError.code = data.code;
      functionError.userId = data.userId;
      throw functionError;
    }

    return data;
  }, []);

  const loadData = useCallback(async (showRefresh = false) => {
    if (showRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const [companyData, employeeData] = await Promise.all([
        invoke({ action: 'list' }),
        invoke({ action: 'list_employees' }),
      ]);

      setCompanies(companyData?.companies || []);
      setEmployees(employeeData?.employees || []);
      setInvitations(employeeData?.invitations || []);
    } catch (error) {
      console.error('Unable to load platform employees:', error);
      toast.error(getErrorMessage(error));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [invoke]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredEmployees = useMemo(() => {
    const term = search.trim().toLowerCase();

    return employees.filter((employee) => {
      const matchesSearch =
        !term ||
        employee.full_name?.toLowerCase().includes(term) ||
        employee.email?.toLowerCase().includes(term) ||
        employee.business_name?.toLowerCase().includes(term) ||
        employee.user_id?.toLowerCase().includes(term);

      const matchesCompany =
        companyFilter === 'all' ||
        employee.business_id === companyFilter;

      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'active' && employee.active) ||
        (statusFilter === 'inactive' && !employee.active);

      return matchesSearch && matchesCompany && matchesStatus;
    });
  }, [employees, search, companyFilter, statusFilter]);

  const activeMemberships = employees.filter(
    (employee) => employee.active
  ).length;

  const inactiveMemberships = employees.length - activeMemberships;

  function openInviteModal() {
    setInviteForm({
      ...EMPTY_INVITE,
      businessId: companies[0]?.id || '',
    });

    setModal('invite');
  }

  function openAssignmentModal() {
    setAssignmentForm({
      ...EMPTY_ASSIGNMENT,
      businessId: companies[0]?.id || '',
    });

    setModal('assign');
  }

  function closeModal() {
    if (saving) return;

    setModal(null);
  }

  async function inviteEmployee(event) {
    event.preventDefault();

    if (
      !inviteForm.businessId ||
      !inviteForm.fullName.trim() ||
      !inviteForm.email.trim()
    ) {
      toast.error('Complete all required fields.');
      return;
    }

    setSaving(true);

    try {
      await invoke({
        action: 'invite_employee',
        businessId: inviteForm.businessId,
        fullName: inviteForm.fullName.trim(),
        email: inviteForm.email.trim().toLowerCase(),
        role: inviteForm.role,
      });

      toast.success('Employee invitation created successfully.');

      setModal(null);
      setInviteForm(EMPTY_INVITE);

      await loadData(true);
    } catch (error) {
      console.error('Employee invitation failed:', error);

      if (error.code === 'EXISTING_USER') {
        toast.error(
          'This email already has an account. Use Assign existing employee and enter that user’s ID.'
        );
      } else {
        toast.error(getErrorMessage(error));
      }
    } finally {
      setSaving(false);
    }
  }

  async function assignExistingEmployee(event) {
    event.preventDefault();

    if (
      !assignmentForm.businessId ||
      !assignmentForm.userId.trim()
    ) {
      toast.error('Select a company and enter the employee user ID.');
      return;
    }

    const uuidPattern =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    if (!uuidPattern.test(assignmentForm.userId.trim())) {
      toast.error('Enter a valid user UUID.');
      return;
    }

    setSaving(true);

    try {
      await invoke({
        action: 'assign_existing_employee',
        businessId: assignmentForm.businessId,
        userId: assignmentForm.userId.trim(),
        role: assignmentForm.role,
      });

      toast.success('Employee assigned to the company.');

      setModal(null);
      setAssignmentForm(EMPTY_ASSIGNMENT);

      await loadData(true);
    } catch (error) {
      console.error('Employee assignment failed:', error);
      toast.error(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  async function updateEmployeeRole(employee, role) {
    if (employee.role === role) return;

    setWorkingId(employee.membership_id);

    try {
      await invoke({
        action: 'update_member',
        membershipId: employee.membership_id,
        role,
      });

      toast.success('Employee role updated.');
      await loadData(true);
    } catch (error) {
      console.error('Role update failed:', error);
      toast.error(getErrorMessage(error));
    } finally {
      setWorkingId(null);
    }
  }

  async function toggleMembership(employee) {
    const nextActive = !employee.active;

    const confirmed = window.confirm(
      nextActive
        ? `Reactivate ${employee.full_name || employee.email}'s membership in ${employee.business_name}?`
        : `Deactivate ${employee.full_name || employee.email}'s membership in ${employee.business_name}? This will not affect their access to other companies.`
    );

    if (!confirmed) return;

    setWorkingId(employee.membership_id);

    try {
      await invoke({
        action: 'update_member',
        membershipId: employee.membership_id,
        active: nextActive,
      });

      toast.success(
        nextActive
          ? 'Company membership activated.'
          : 'Company membership deactivated.'
      );

      await loadData(true);
    } catch (error) {
      console.error('Membership update failed:', error);
      toast.error(getErrorMessage(error));
    } finally {
      setWorkingId(null);
    }
  }

  async function revokeInvitation(invitation) {
    const confirmed = window.confirm(
      `Revoke the pending invitation for ${invitation.email}?`
    );

    if (!confirmed) return;

    setWorkingId(invitation.id);

    try {
      await invoke({
        action: 'revoke_invitation',
        invitationId: invitation.id,
      });

      toast.success('Invitation revoked.');
      await loadData(true);
    } catch (error) {
      console.error('Invitation revocation failed:', error);
      toast.error(getErrorMessage(error));
    } finally {
      setWorkingId(null);
    }
  }

  return (
    <div className="dashboard-page employee-management-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">BLAQSWATCH CONTROL CENTRE</p>
          <h1>Employee administration</h1>
          <p className="muted">
            Manage employee accounts, company memberships, roles and invitations.
          </p>
        </div>

        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => loadData(true)}
          disabled={loading || refreshing}
        >
          <ArrowPathIcon
            className={refreshing ? 'is-spinning' : ''}
          />
          {refreshing ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      <nav
        className="platform-section-tabs"
        aria-label="Platform management"
      >
        <NavLink
          to="/platform/companies"
          className={({ isActive }) =>
            `btn ${isActive ? 'btn-primary' : 'btn-secondary'}`
          }
        >
          <BuildingOffice2Icon />
          Companies
        </NavLink>

        <NavLink
          to="/platform/employees"
          className={({ isActive }) =>
            `btn ${isActive ? 'btn-primary' : 'btn-secondary'}`
          }
        >
          <UserGroupIcon />
          Employees
        </NavLink>
      </nav>

      <div className="company-stat-grid">
        <div className="stat-card">
          <div className="stat-card-icon">
            <UserGroupIcon />
          </div>
          <div>
            <span>Total memberships</span>
            <strong>{employees.length}</strong>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-card-icon">
            <ShieldCheckIcon />
          </div>
          <div>
            <span>Active memberships</span>
            <strong>{activeMemberships}</strong>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-card-icon">
            <EnvelopeIcon />
          </div>
          <div>
            <span>Pending invitations</span>
            <strong>{invitations.length}</strong>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-card-icon">
            <UserGroupIcon />
          </div>
          <div>
            <span>Inactive memberships</span>
            <strong>{inactiveMemberships}</strong>
          </div>
        </div>
      </div>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Global employee directory</h2>
            <p className="muted">
              Employees and their memberships across all registered companies.
            </p>
          </div>

          <div className="company-row-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={openAssignmentModal}
              disabled={!companies.length}
            >
              <UserPlusIcon />
              Assign existing
            </button>

            <button
              type="button"
              className="btn btn-primary"
              onClick={openInviteModal}
              disabled={!companies.length}
            >
              <PlusIcon />
              Invite employee
            </button>
          </div>
        </div>

        <div className="company-filter-toolbar">
          <label className="search-field">
            <MagnifyingGlassIcon />
            <input
              type="search"
              placeholder="Search employees, email, company or user ID..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>

          <select
            value={companyFilter}
            onChange={(event) => setCompanyFilter(event.target.value)}
            aria-label="Filter by company"
          >
            <option value="all">All companies</option>
            {companies.map((company) => (
              <option key={company.id} value={company.id}>
                {company.name}
              </option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            aria-label="Filter by membership status"
          >
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>

          <span className="result-count">
            {filteredEmployees.length} of {employees.length} memberships
          </span>
        </div>

        {loading ? (
          <div className="company-empty-state">
            Loading employee directory...
          </div>
        ) : filteredEmployees.length === 0 ? (
          <div className="company-empty-state">
            <UserGroupIcon />
            <h3>No employees found</h3>
            <p>
              {employees.length
                ? 'Try changing your search or filters.'
                : 'Invite an employee or assign an existing account to a company.'}
            </p>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="company-table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Company</th>
                  <th>Role</th>
                  <th>Membership</th>
                  <th>Joined</th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {filteredEmployees.map((employee) => (
                  <tr key={employee.membership_id}>
                    <td>
                      <strong>
                        {employee.full_name || 'Unnamed employee'}
                      </strong>
                      <small>
                        {employee.email || 'No email available'}
                      </small>
                      <small className="muted">
                        ID: {employee.user_id}
                      </small>
                    </td>

                    <td>
                      {employee.business_name || 'Unknown company'}
                    </td>

                    <td>
                      <select
                        value={employee.role}
                        onChange={(event) =>
                          updateEmployeeRole(employee, event.target.value)
                        }
                        disabled={workingId === employee.membership_id}
                        aria-label={`Change role for ${employee.full_name || employee.email}`}
                      >
                        <option value="admin">Company Admin</option>
                        {EMPLOYEE_ROLES.map((role) => (
                          <option key={role} value={role}>
                            {getRoleLabel(role)}
                          </option>
                        ))}
                      </select>
                    </td>

                    <td>
                      <span
                        className={`company-status ${
                          employee.active ? 'active' : 'suspended'
                        }`}
                      >
                        {employee.active ? 'Active' : 'Inactive'}
                      </span>
                    </td>

                    <td>{formatDate(employee.created_at)}</td>

                    <td>
                      <button
                        type="button"
                        className="btn btn-small btn-secondary"
                        onClick={() => toggleMembership(employee)}
                        disabled={workingId === employee.membership_id}
                      >
                        {workingId === employee.membership_id
                          ? 'Working...'
                          : employee.active
                            ? 'Deactivate'
                            : 'Activate'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Pending invitations</h2>
            <p className="muted">
              Invitations awaiting acceptance across all companies.
            </p>
          </div>

          <span className="result-count">
            {invitations.length} pending
          </span>
        </div>

        {loading ? (
          <div className="company-empty-state">
            Loading invitations...
          </div>
        ) : invitations.length === 0 ? (
          <div className="company-empty-state">
            <EnvelopeIcon />
            <h3>No pending invitations</h3>
            <p>New employee invitations will appear here.</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="company-table">
              <thead>
                <tr>
                  <th>Invitee</th>
                  <th>Company</th>
                  <th>Role</th>
                  <th>Expires</th>
                  <th>Invited</th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {invitations.map((invitation) => (
                  <tr key={invitation.id}>
                    <td>
                      <strong>
                        {invitation.full_name || 'Unnamed invitee'}
                      </strong>
                      <small>{invitation.email}</small>
                    </td>

                    <td>
                      {invitation.business_name || 'Unknown company'}
                    </td>

                    <td>{getRoleLabel(invitation.role)}</td>
                    <td>{formatDate(invitation.expires_at)}</td>
                    <td>{formatDate(invitation.created_at)}</td>

                    <td>
                      <button
                        type="button"
                        className="btn btn-small btn-secondary"
                        onClick={() => revokeInvitation(invitation)}
                        disabled={workingId === invitation.id}
                      >
                        {workingId === invitation.id
                          ? 'Working...'
                          : 'Revoke'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {modal === 'invite' && (
        <div
          className="modal-backdrop"
          onClick={closeModal}
        >
          <div
            className="modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="invite-employee-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-heading">
              <div>
                <p className="eyebrow">EMPLOYEE ONBOARDING</p>
                <h2 id="invite-employee-title">Invite employee</h2>
                <p className="muted">
                  Send an invitation and prepare a company membership.
                </p>
              </div>

              <button
                type="button"
                className="icon-button"
                onClick={closeModal}
                disabled={saving}
                aria-label="Close"
              >
                <XMarkIcon />
              </button>
            </div>

            <form onSubmit={inviteEmployee}>
              <div className="field">
                <label htmlFor="invite-company">Company</label>
                <select
                  id="invite-company"
                  value={inviteForm.businessId}
                  onChange={(event) =>
                    setInviteForm({
                      ...inviteForm,
                      businessId: event.target.value,
                    })
                  }
                  required
                >
                  <option value="">Select a company</option>
                  {companies.map((company) => (
                    <option key={company.id} value={company.id}>
                      {company.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="field">
                <label htmlFor="invite-name">Full name</label>
                <input
                  id="invite-name"
                  type="text"
                  value={inviteForm.fullName}
                  onChange={(event) =>
                    setInviteForm({
                      ...inviteForm,
                      fullName: event.target.value,
                    })
                  }
                  placeholder="Employee full name"
                  required
                />
              </div>

              <div className="field">
                <label htmlFor="invite-email">Email address</label>
                <input
                  id="invite-email"
                  type="email"
                  value={inviteForm.email}
                  onChange={(event) =>
                    setInviteForm({
                      ...inviteForm,
                      email: event.target.value,
                    })
                  }
                  placeholder="employee@example.com"
                  required
                />
              </div>

              <div className="field">
                <label htmlFor="invite-role">Company role</label>
                <select
                  id="invite-role"
                  value={inviteForm.role}
                  onChange={(event) =>
                    setInviteForm({
                      ...inviteForm,
                      role: event.target.value,
                    })
                  }
                >
                  {EMPLOYEE_ROLES.map((role) => (
                    <option key={role} value={role}>
                      {getRoleLabel(role)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="tip-box">
                Company Admin access is managed separately by the platform
                administrator. Standard employee invitations can be assigned
                Manager or Staff roles.
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={closeModal}
                  disabled={saving}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={saving}
                >
                  <EnvelopeIcon />
                  {saving ? 'Sending...' : 'Send invitation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {modal === 'assign' && (
        <div
          className="modal-backdrop"
          onClick={closeModal}
        >
          <div
            className="modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="assign-employee-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-heading">
              <div>
                <p className="eyebrow">COMPANY MEMBERSHIP</p>
                <h2 id="assign-employee-title">
                  Assign existing employee
                </h2>
                <p className="muted">
                  Add an existing BlaQsWatch account to another company.
                </p>
              </div>

              <button
                type="button"
                className="icon-button"
                onClick={closeModal}
                disabled={saving}
                aria-label="Close"
              >
                <XMarkIcon />
              </button>
            </div>

            <form onSubmit={assignExistingEmployee}>
              <div className="field">
                <label htmlFor="assign-company">Company</label>
                <select
                  id="assign-company"
                  value={assignmentForm.businessId}
                  onChange={(event) =>
                    setAssignmentForm({
                      ...assignmentForm,
                      businessId: event.target.value,
                    })
                  }
                  required
                >
                  <option value="">Select a company</option>
                  {companies.map((company) => (
                    <option key={company.id} value={company.id}>
                      {company.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="field">
                <label htmlFor="assign-user-id">Employee user ID</label>
                <input
                  id="assign-user-id"
                  type="text"
                  value={assignmentForm.userId}
                  onChange={(event) =>
                    setAssignmentForm({
                      ...assignmentForm,
                      userId: event.target.value,
                    })
                  }
                  placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                  required
                />
              </div>

              <div className="field">
                <label htmlFor="assign-role">Company role</label>
                <select
                  id="assign-role"
                  value={assignmentForm.role}
                  onChange={(event) =>
                    setAssignmentForm({
                      ...assignmentForm,
                      role: event.target.value,
                    })
                  }
                >
                  {EMPLOYEE_ROLES.map((role) => (
                    <option key={role} value={role}>
                      {getRoleLabel(role)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="tip-box">
                The employee must already have a BlaQsWatch profile. You can
                copy their user ID from the employee directory.
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={closeModal}
                  disabled={saving}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={saving}
                >
                  <UserPlusIcon />
                  {saving ? 'Assigning...' : 'Assign employee'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
