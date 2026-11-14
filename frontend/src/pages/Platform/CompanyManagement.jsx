
import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import {
  ArrowPathIcon,
  BuildingOffice2Icon,
  MagnifyingGlassIcon,
  PlusIcon,
  XMarkIcon,
  UsersIcon,
  EnvelopeIcon,
  UserPlusIcon,
} from '@heroicons/react/24/outline';
import { supabase } from '../../lib/supabase';
import '../../styles/platform-management.css';

const EMPTY_FORM = {
  companyName: '',
  administratorName: '',
  administratorEmail: '',
};

const EMPTY_EMPLOYEE_FORM = {
  businessId: '',
  fullName: '',
  email: '',
  role: 'staff',
};

const EMPTY_ASSIGN_FORM = {
  businessId: '',
  userId: '',
  role: 'staff',
};

const EMPLOYEE_ROLES = ['admin', 'manager', 'staff'];

function formatDate(value) {
  if (!value) return '—';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return '—';

  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date);
}

function displayRole(role) {
  if (!role) return '—';

  return role
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

export default function CompanyManagement() {
  // --------------------------------------------------
  // COMPANY STATE
  // --------------------------------------------------

  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [workingId, setWorkingId] = useState(null);

  const [selectedCompany, setSelectedCompany] = useState(null);
  const [members, setMembers] = useState([]);
  const [detailsLoading, setDetailsLoading] = useState(false);

  // --------------------------------------------------
  // EMPLOYEE STATE
  // --------------------------------------------------

  const [employees, setEmployees] = useState([]);
  const [invitations, setInvitations] = useState([]);
  const [employeesLoading, setEmployeesLoading] = useState(true);
  const [employeeRefreshing, setEmployeeRefreshing] = useState(false);

  const [employeeSearch, setEmployeeSearch] = useState('');
  const [employeeCompanyFilter, setEmployeeCompanyFilter] = useState('all');
  const [employeeRoleFilter, setEmployeeRoleFilter] = useState('all');

  const [showInvite, setShowInvite] = useState(false);
  const [employeeForm, setEmployeeForm] = useState(EMPTY_EMPLOYEE_FORM);
  const [inviting, setInviting] = useState(false);

  const [showAssign, setShowAssign] = useState(false);
  const [assignForm, setAssignForm] = useState(EMPTY_ASSIGN_FORM);
  const [assigning, setAssigning] = useState(false);

  const [employeeWorkingId, setEmployeeWorkingId] = useState(null);
  const [invitationWorkingId, setInvitationWorkingId] = useState(null);

  const [activeTab, setActiveTab] = useState('companies');

  // --------------------------------------------------
  // EDGE FUNCTION
  // --------------------------------------------------

  const invoke = useCallback(async (body) => {
    const { data, error } = await supabase.functions.invoke(
      'platform-companies',
      { body },
    );

    if (error) {
      throw error;
    }

    if (data?.error) {
      throw new Error(data.error);
    }

    return data;
  }, []);

  // --------------------------------------------------
  // LOAD COMPANIES
  // --------------------------------------------------

  const loadCompanies = useCallback(async (quiet = false) => {
    if (quiet) setRefreshing(true);
    else setLoading(true);

    try {
      const data = await invoke({ action: 'list' });
      setCompanies(data.companies || []);
    } catch (error) {
      console.error('Company list failed:', error);
      toast.error(error.message || 'Unable to load companies.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [invoke]);

  // --------------------------------------------------
  // LOAD GLOBAL EMPLOYEE DIRECTORY
  // --------------------------------------------------

  const loadEmployees = useCallback(async (quiet = false) => {
    if (quiet) setEmployeeRefreshing(true);
    else setEmployeesLoading(true);

    try {
      const data = await invoke({ action: 'list_employees' });

      setEmployees(data.employees || []);
      setInvitations(data.invitations || []);
    } catch (error) {
      console.error('Employee directory failed:', error);
      toast.error(error.message || 'Unable to load employees.');
    } finally {
      setEmployeesLoading(false);
      setEmployeeRefreshing(false);
    }
  }, [invoke]);

  const refreshAll = useCallback(async () => {
    await Promise.all([
      loadCompanies(true),
      loadEmployees(true),
    ]);
  }, [loadCompanies, loadEmployees]);

  useEffect(() => {
    loadCompanies();
    loadEmployees();
  }, [loadCompanies, loadEmployees]);

  // --------------------------------------------------
  // COMPANY FILTERS AND COUNTS
  // --------------------------------------------------

  const filteredCompanies = useMemo(() => {
    const term = search.trim().toLowerCase();

    return companies.filter((company) => {
      const matchesSearch =
        !term || company.name.toLowerCase().includes(term);

      const matchesStatus =
        statusFilter === 'all'
        || (statusFilter === 'active'
          ? company.active
          : !company.active);

      return matchesSearch && matchesStatus;
    });
  }, [companies, search, statusFilter]);

  const counts = useMemo(() => ({
    total: companies.length,
    active: companies.filter((item) => item.active).length,
    suspended: companies.filter((item) => !item.active).length,
  }), [companies]);

  // --------------------------------------------------
  // EMPLOYEE FILTERS AND COUNTS
  // --------------------------------------------------

  const filteredEmployees = useMemo(() => {
    const term = employeeSearch.trim().toLowerCase();

    return employees.filter((employee) => {
      const matchesSearch =
        !term
        || employee.full_name?.toLowerCase().includes(term)
        || employee.email?.toLowerCase().includes(term)
        || employee.business_name?.toLowerCase().includes(term)
        || employee.user_id?.toLowerCase().includes(term);

      const matchesCompany =
        employeeCompanyFilter === 'all'
        || employee.business_id === employeeCompanyFilter;

      const matchesRole =
        employeeRoleFilter === 'all'
        || employee.role === employeeRoleFilter;

      return matchesSearch && matchesCompany && matchesRole;
    });
  }, [
    employees,
    employeeSearch,
    employeeCompanyFilter,
    employeeRoleFilter,
  ]);

  const employeeCounts = useMemo(() => ({
    total: employees.length,
    active: employees.filter((employee) => employee.active).length,
    inactive: employees.filter((employee) => !employee.active).length,
    invitations: invitations.length,
  }), [employees, invitations]);

  // --------------------------------------------------
  // COMPANY CREATION
  // --------------------------------------------------

  async function createCompany(event) {
    event.preventDefault();

    if (saving) return;

    setSaving(true);

    try {
      await invoke({
        action: 'create',
        companyName: form.companyName.trim(),
        administratorName: form.administratorName.trim(),
        administratorEmail: form.administratorEmail.trim().toLowerCase(),
      });

      toast.success('Company created and administrator invitation sent.');

      setForm(EMPTY_FORM);
      setShowCreate(false);

      await refreshAll();
    } catch (error) {
      console.error('Company creation failed:', error);
      toast.error(error.message || 'Unable to create company.');
    } finally {
      setSaving(false);
    }
  }

  // --------------------------------------------------
  // COMPANY STATUS
  // --------------------------------------------------

  async function toggleCompany(company) {
    const nextActive = !company.active;

    const confirmed = window.confirm(
      nextActive
        ? `Activate ${company.name}? Its members will regain workspace access.`
        : `Suspend ${company.name}? Its members will lose workspace access, but company records will be retained.`,
    );

    if (!confirmed) return;

    setWorkingId(company.id);

    try {
      await invoke({
        action: 'set_status',
        businessId: company.id,
        active: nextActive,
      });

      toast.success(
        nextActive ? 'Company activated.' : 'Company suspended.',
      );

      await loadCompanies(true);

      if (selectedCompany?.id === company.id) {
        setSelectedCompany((current) => (
          current ? { ...current, active: nextActive } : current
        ));
      }
    } catch (error) {
      console.error('Company status update failed:', error);
      toast.error(error.message || 'Unable to update company status.');
    } finally {
      setWorkingId(null);
    }
  }

  // --------------------------------------------------
  // COMPANY DETAILS
  // --------------------------------------------------

  async function openDetails(company) {
    setSelectedCompany(company);
    setMembers([]);
    setDetailsLoading(true);

    try {
      const data = await invoke({
        action: 'details',
        businessId: company.id,
      });

      setMembers(data.members || []);
    } catch (error) {
      console.error('Company details failed:', error);
      toast.error(error.message || 'Unable to load company members.');
    } finally {
      setDetailsLoading(false);
    }
  }

  // --------------------------------------------------
  // INVITE NEW EMPLOYEE
  // --------------------------------------------------

  async function inviteEmployee(event) {
    event.preventDefault();

    if (inviting) return;

    if (!employeeForm.businessId) {
      toast.error('Select a company.');
      return;
    }

    setInviting(true);

    try {
      await invoke({
        action: 'invite_employee',
        businessId: employeeForm.businessId,
        fullName: employeeForm.fullName.trim(),
        email: employeeForm.email.trim().toLowerCase(),
        role: employeeForm.role,
      });

      toast.success('Employee invitation sent successfully.');

      setEmployeeForm(EMPTY_EMPLOYEE_FORM);
      setShowInvite(false);

      await loadEmployees(true);
      await loadCompanies(true);
    } catch (error) {
      console.error('Employee invitation failed:', error);
      toast.error(error.message || 'Unable to invite employee.');
    } finally {
      setInviting(false);
    }
  }

  // --------------------------------------------------
  // ASSIGN EXISTING EMPLOYEE
  // --------------------------------------------------

  async function assignExistingEmployee(event) {
    event.preventDefault();

    if (assigning) return;

    if (!assignForm.businessId || !assignForm.userId.trim()) {
      toast.error('Select a company and enter the employee user ID.');
      return;
    }

    setAssigning(true);

    try {
      await invoke({
        action: 'assign_existing_employee',
        businessId: assignForm.businessId,
        userId: assignForm.userId.trim(),
        role: assignForm.role,
      });

      toast.success('Existing employee assigned to the company.');

      setAssignForm(EMPTY_ASSIGN_FORM);
      setShowAssign(false);

      await loadEmployees(true);
      await loadCompanies(true);
    } catch (error) {
      console.error('Employee assignment failed:', error);
      toast.error(error.message || 'Unable to assign employee.');
    } finally {
      setAssigning(false);
    }
  }

  // --------------------------------------------------
  // UPDATE MEMBERSHIP ROLE
  // --------------------------------------------------

  async function updateEmployeeRole(employee, role) {
    if (role === employee.role) return;

    setEmployeeWorkingId(employee.membership_id);

    try {
      await invoke({
        action: 'update_member',
        membershipId: employee.membership_id,
        role,
      });

      toast.success('Company membership role updated.');
      await loadEmployees(true);
    } catch (error) {
      console.error('Employee role update failed:', error);
      toast.error(error.message || 'Unable to update employee role.');
    } finally {
      setEmployeeWorkingId(null);
    }
  }

  // --------------------------------------------------
  // UPDATE MEMBERSHIP STATUS
  // --------------------------------------------------

  async function toggleEmployee(employee) {
    const nextActive = !employee.active;

    const confirmed = window.confirm(
      nextActive
        ? `Reactivate ${employee.full_name || employee.email} in ${employee.business_name}?`
        : `Deactivate ${employee.full_name || employee.email} in ${employee.business_name}? This will not affect their memberships in other companies.`,
    );

    if (!confirmed) return;

    setEmployeeWorkingId(employee.membership_id);

    try {
      await invoke({
        action: 'update_member',
        membershipId: employee.membership_id,
        active: nextActive,
      });

      toast.success(
        nextActive
          ? 'Company membership activated.'
          : 'Company membership deactivated.',
      );

      await loadEmployees(true);
      await loadCompanies(true);
    } catch (error) {
      console.error('Employee status update failed:', error);
      toast.error(error.message || 'Unable to update employee status.');
    } finally {
      setEmployeeWorkingId(null);
    }
  }

  // --------------------------------------------------
  // REVOKE INVITATION
  // --------------------------------------------------

  async function revokeInvitation(invitation) {
    const confirmed = window.confirm(
      `Revoke the pending invitation for ${invitation.email} at ${invitation.business_name}?`,
    );

    if (!confirmed) return;

    setInvitationWorkingId(invitation.id);

    try {
      await invoke({
        action: 'revoke_invitation',
        invitationId: invitation.id,
      });

      toast.success('Invitation revoked.');
      await loadEmployees(true);
    } catch (error) {
      console.error('Invitation revocation failed:', error);
      toast.error(error.message || 'Unable to revoke invitation.');
    } finally {
      setInvitationWorkingId(null);
    }
  }

  // --------------------------------------------------
  // RENDER
  // --------------------------------------------------

  return (
    <div className="dashboard-page company-management-page">

      {/* PAGE HEADING */}

      <div className="page-heading">
        <div>
          <p className="eyebrow">PLATFORM CONTROL CENTRE</p>
          <h1>Company management</h1>
          <p className="muted">
            Manage companies, employee onboarding and platform access.
          </p>
        </div>

        <button
          className="btn btn-primary"
          onClick={() => setShowCreate(true)}
        >
          <PlusIcon /> Register company
        </button>
      </div>

      {/* NAVIGATION TABS */}

      <div className="filter-toolbar company-filter-toolbar">
        <button
          type="button"
          className={`btn btn-small ${activeTab === 'companies' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('companies')}
        >
          <BuildingOffice2Icon />
          Companies
        </button>

        <button
          type="button"
          className={`btn btn-small ${activeTab === 'employees' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('employees')}
        >
          <UsersIcon />
          Employees
        </button>
      </div>

      {/* ==================================================
          COMPANIES TAB
      ================================================== */}

      {activeTab === 'companies' && (
        <>
          <div className="company-stat-grid">
            <div className="stat-card">
              <span className="stat-label">Registered companies</span>
              <div className="stat-value">{counts.total}</div>
              <span className="stat-detail">All companies on BlaQsWatch</span>
            </div>

            <div className="stat-card">
              <span className="stat-label">Active companies</span>
              <div className="stat-value">{counts.active}</div>
              <span className="stat-detail">Workspace access enabled</span>
            </div>

            <div className="stat-card">
              <span className="stat-label">Suspended companies</span>
              <div className="stat-value">{counts.suspended}</div>
              <span className="stat-detail">Workspace access disabled</span>
            </div>
          </div>

          <section className="panel list-panel">
            <div className="panel-heading">
              <div>
                <h2>Registered companies</h2>
                <p>Company access and administrator onboarding</p>
              </div>

              <button
                className="btn btn-secondary btn-small"
                onClick={() => loadCompanies(true)}
                disabled={refreshing}
              >
                <ArrowPathIcon className={refreshing ? 'is-spinning' : ''} />
                Refresh
              </button>
            </div>

            <div className="filter-toolbar company-filter-toolbar">
              <label className="search-field">
                <MagnifyingGlassIcon />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search companies..."
                />
              </label>

              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                aria-label="Filter by company status"
              >
                <option value="all">All statuses</option>
                <option value="active">Active</option>
                <option value="suspended">Suspended</option>
              </select>

              <span className="result-count">
                {filteredCompanies.length} result(s)
              </span>
            </div>

            {loading ? (
              <div className="company-empty-state">
                Loading registered companies...
              </div>
            ) : filteredCompanies.length === 0 ? (
              <div className="company-empty-state">
                <BuildingOffice2Icon />
                <strong>
                  {companies.length
                    ? 'No matching companies'
                    : 'No companies registered yet'}
                </strong>
                <span>
                  {companies.length
                    ? 'Try changing your search or status filter.'
                    : 'Register your first company to begin onboarding.'}
                </span>
              </div>
            ) : (
              <div className="table-wrap">
                <table className="company-table">
                  <thead>
                    <tr>
                      <th>COMPANY</th>
                      <th>STATUS</th>
                      <th>CREATED</th>
                      <th>MEMBERS</th>
                      <th className="company-actions-heading">ACTIONS</th>
                    </tr>
                  </thead>

                  <tbody>
                    {filteredCompanies.map((company) => (
                      <tr key={company.id}>
                        <td>
                          <strong>{company.name}</strong>
                          <span className="cell-sub">ID: {company.id}</span>
                        </td>

                        <td>
                          <span className={`company-status ${company.active ? 'active' : 'suspended'}`}>
                            {company.active ? 'Active' : 'Suspended'}
                          </span>
                        </td>

                        <td>{formatDate(company.created_at)}</td>
                        <td>{company.member_count ?? 0}</td>

                        <td>
                          <div className="company-row-actions">
                            <button
                              className="btn btn-secondary btn-small"
                              onClick={() => openDetails(company)}
                            >
                              Details
                            </button>

                            <button
                              className={`btn btn-small ${company.active ? 'btn-danger-outline' : 'btn-primary'}`}
                              onClick={() => toggleCompany(company)}
                              disabled={workingId === company.id}
                            >
                              {workingId === company.id
                                ? 'Updating...'
                                : company.active
                                  ? 'Suspend'
                                  : 'Activate'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}

      {/* ==================================================
          EMPLOYEES TAB
      ================================================== */}

      {activeTab === 'employees' && (
        <>
          <div className="company-stat-grid">
            <div className="stat-card">
              <span className="stat-label">Company memberships</span>
              <div className="stat-value">{employeeCounts.total}</div>
              <span className="stat-detail">Across all registered companies</span>
            </div>

            <div className="stat-card">
              <span className="stat-label">Active memberships</span>
              <div className="stat-value">{employeeCounts.active}</div>
              <span className="stat-detail">Currently enabled memberships</span>
            </div>

            <div className="stat-card">
              <span className="stat-label">Pending invitations</span>
              <div className="stat-value">{employeeCounts.invitations}</div>
              <span className="stat-detail">Awaiting invitation acceptance</span>
            </div>
          </div>

          <section className="panel list-panel">
            <div className="panel-heading">
              <div>
                <h2>Global employee directory</h2>
                <p>
                  Each row represents an employee's membership in a company.
                  One person may appear more than once if they belong to
                  multiple companies.
                </p>
              </div>

              <button
                className="btn btn-secondary btn-small"
                onClick={() => loadEmployees(true)}
                disabled={employeeRefreshing}
              >
                <ArrowPathIcon className={employeeRefreshing ? 'is-spinning' : ''} />
                Refresh
              </button>
            </div>

            <div className="company-row-actions">
              <button
                className="btn btn-primary"
                onClick={() => setShowInvite(true)}
              >
                <EnvelopeIcon />
                Invite employee
              </button>

              <button
                className="btn btn-secondary"
                onClick={() => setShowAssign(true)}
              >
                <UserPlusIcon />
                Assign existing account
              </button>
            </div>

            <div className="filter-toolbar company-filter-toolbar">
              <label className="search-field">
                <MagnifyingGlassIcon />
                <input
                  value={employeeSearch}
                  onChange={(event) => setEmployeeSearch(event.target.value)}
                  placeholder="Search name, email, company or user ID..."
                />
              </label>

              <select
                value={employeeCompanyFilter}
                onChange={(event) => setEmployeeCompanyFilter(event.target.value)}
                aria-label="Filter employees by company"
              >
                <option value="all">All companies</option>
                {companies.map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.name}
                  </option>
                ))}
              </select>

              <select
                value={employeeRoleFilter}
                onChange={(event) => setEmployeeRoleFilter(event.target.value)}
                aria-label="Filter employees by role"
              >
                <option value="all">All roles</option>
                {EMPLOYEE_ROLES.map((role) => (
                  <option key={role} value={role}>
                    {displayRole(role)}
                  </option>
                ))}
              </select>

              <span className="result-count">
                {filteredEmployees.length} result(s)
              </span>
            </div>

            {employeesLoading ? (
              <div className="company-empty-state">
                Loading global employee directory...
              </div>
            ) : filteredEmployees.length === 0 ? (
              <div className="company-empty-state">
                <UsersIcon />
                <strong>
                  {employees.length
                    ? 'No matching employees'
                    : 'No employee memberships yet'}
                </strong>
                <span>
                  {employees.length
                    ? 'Try changing your search or filters.'
                    : 'Invite an employee or assign an existing account to a company.'}
                </span>
              </div>
            ) : (
              <div className="table-wrap">
                <table className="company-table">
                  <thead>
                    <tr>
                      <th>EMPLOYEE</th>
                      <th>COMPANY</th>
                      <th>ROLE</th>
                      <th>STATUS</th>
                      <th>JOINED</th>
                      <th>ACTIONS</th>
                    </tr>
                  </thead>

                  <tbody>
                    {filteredEmployees.map((employee) => {
                      const isWorking =
                        employeeWorkingId === employee.membership_id;

                      return (
                        <tr key={employee.membership_id}>
                          <td>
                            <strong>{employee.full_name || 'Unnamed employee'}</strong>
                            <span className="cell-sub">{employee.email || 'No email'}</span>
                            <span className="cell-sub">ID: {employee.user_id}</span>
                          </td>

                          <td>
                            <strong>{employee.business_name || 'Unknown company'}</strong>
                          </td>

                          <td>
                            <select
                              value={employee.role}
                              disabled={isWorking}
                              aria-label={`Change role for ${employee.email}`}
                              onChange={(event) => updateEmployeeRole(
                                employee,
                                event.target.value,
                              )}
                            >
                              {EMPLOYEE_ROLES.map((role) => (
                                <option key={role} value={role}>
                                  {displayRole(role)}
                                </option>
                              ))}
                            </select>
                          </td>

                          <td>
                            <span className={`company-status ${employee.active ? 'active' : 'suspended'}`}>
                              {employee.active ? 'Active' : 'Inactive'}
                            </span>
                          </td>

                          <td>{formatDate(employee.created_at)}</td>

                          <td>
                            <button
                              className={`btn btn-small ${employee.active ? 'btn-danger-outline' : 'btn-primary'}`}
                              onClick={() => toggleEmployee(employee)}
                              disabled={isWorking}
                            >
                              {isWorking
                                ? 'Updating...'
                                : employee.active
                                  ? 'Deactivate'
                                  : 'Activate'}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* PENDING INVITATIONS */}

          <section className="panel list-panel">
            <div className="panel-heading">
              <div>
                <h2>Pending invitations</h2>
                <p>Employee and company administrator invitations</p>
              </div>

              <span className="result-count">
                {invitations.length} pending
              </span>
            </div>

            {employeesLoading ? (
              <div className="company-empty-state">
                Loading invitations...
              </div>
            ) : invitations.length === 0 ? (
              <div className="company-empty-state">
                <EnvelopeIcon />
                <strong>No pending invitations</strong>
                <span>New invitations will appear here.</span>
              </div>
            ) : (
              <div className="table-wrap">
                <table className="company-table">
                  <thead>
                    <tr>
                      <th>INVITEE</th>
                      <th>COMPANY</th>
                      <th>ROLE</th>
                      <th>INVITED</th>
                      <th>EXPIRES</th>
                      <th>ACTIONS</th>
                    </tr>
                  </thead>

                  <tbody>
                    {invitations.map((invitation) => (
                      <tr key={invitation.id}>
                        <td>
                          <strong>{invitation.full_name || 'Unnamed invitee'}</strong>
                          <span className="cell-sub">{invitation.email}</span>
                        </td>

                        <td>{invitation.business_name || 'Unknown company'}</td>
                        <td>{displayRole(invitation.role)}</td>
                        <td>{formatDate(invitation.created_at)}</td>
                        <td>{formatDate(invitation.expires_at)}</td>

                        <td>
                          <button
                            className="btn btn-danger-outline btn-small"
                            onClick={() => revokeInvitation(invitation)}
                            disabled={invitationWorkingId === invitation.id}
                          >
                            {invitationWorkingId === invitation.id
                              ? 'Revoking...'
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
        </>
      )}

      {/* ==================================================
          CREATE COMPANY MODAL
      ================================================== */}

      {showCreate && (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !saving) {
              setShowCreate(false);
            }
          }}
        >
          <section
            className="modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-company-title"
          >
            <div className="modal-heading">
              <div>
                <p className="eyebrow">COMPANY ONBOARDING</p>
                <h2 id="create-company-title">Register a company</h2>
              </div>

              <button
                className="icon-button"
                onClick={() => setShowCreate(false)}
                disabled={saving}
                aria-label="Close"
              >
                <XMarkIcon />
              </button>
            </div>

            <p className="muted company-modal-intro">
              Create the company workspace and send an invitation to its
              first administrator.
            </p>

            <form onSubmit={createCompany}>
              <label className="field">
                Company name <em>*</em>
                <input
                  required
                  maxLength={120}
                  value={form.companyName}
                  onChange={(event) => setForm({
                    ...form,
                    companyName: event.target.value,
                  })}
                  placeholder="e.g. Amigos Workshop"
                />
              </label>

              <div className="form-section-title">
                FIRST COMPANY ADMINISTRATOR
              </div>

              <label className="field">
                Administrator full name <em>*</em>
                <input
                  required
                  maxLength={120}
                  value={form.administratorName}
                  onChange={(event) => setForm({
                    ...form,
                    administratorName: event.target.value,
                  })}
                  placeholder="Full name"
                />
              </label>

              <label className="field">
                Administrator email <em>*</em>
                <input
                  required
                  type="email"
                  maxLength={254}
                  value={form.administratorEmail}
                  onChange={(event) => setForm({
                    ...form,
                    administratorEmail: event.target.value,
                  })}
                  placeholder="name@company.com"
                />
              </label>

              <div className="tip-box">
                <strong>What happens next?</strong>
                <p>
                  The company is created as active. An administrator
                  invitation is sent by Supabase Auth. The invitee receives
                  company administrator access after accepting the invitation.
                </p>
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowCreate(false)}
                  disabled={saving}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={saving}
                >
                  {saving ? 'Creating...' : 'Create company & invite admin'}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {/* ==================================================
          INVITE EMPLOYEE MODAL
      ================================================== */}

      {showInvite && (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !inviting) {
              setShowInvite(false);
            }
          }}
        >
          <section
            className="modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="invite-employee-title"
          >
            <div className="modal-heading">
              <div>
                <p className="eyebrow">EMPLOYEE ONBOARDING</p>
                <h2 id="invite-employee-title">Invite an employee</h2>
              </div>

              <button
                className="icon-button"
                onClick={() => setShowInvite(false)}
                disabled={inviting}
                aria-label="Close"
              >
                <XMarkIcon />
              </button>
            </div>

            <p className="muted company-modal-intro">
              Send an invitation to a new BlaQsWatch employee and assign
              their company role.
            </p>

            <form onSubmit={inviteEmployee}>
              <label className="field">
                Company <em>*</em>
                <select
                  required
                  value={employeeForm.businessId}
                  onChange={(event) => setEmployeeForm({
                    ...employeeForm,
                    businessId: event.target.value,
                  })}
                >
                  <option value="">Select a company</option>
                  {companies
                    .filter((company) => company.active)
                    .map((company) => (
                      <option key={company.id} value={company.id}>
                        {company.name}
                      </option>
                    ))}
                </select>
              </label>

              <label className="field">
                Employee full name <em>*</em>
                <input
                  required
                  maxLength={120}
                  value={employeeForm.fullName}
                  onChange={(event) => setEmployeeForm({
                    ...employeeForm,
                    fullName: event.target.value,
                  })}
                  placeholder="Full name"
                />
              </label>

              <label className="field">
                Employee email <em>*</em>
                <input
                  required
                  type="email"
                  maxLength={254}
                  value={employeeForm.email}
                  onChange={(event) => setEmployeeForm({
                    ...employeeForm,
                    email: event.target.value,
                  })}
                  placeholder="employee@company.com"
                />
              </label>

              <label className="field">
                Company role <em>*</em>
                <select
                  value={employeeForm.role}
                  onChange={(event) => setEmployeeForm({
                    ...employeeForm,
                    role: event.target.value,
                  })}
                >
                  {EMPLOYEE_ROLES.map((role) => (
                    <option key={role} value={role}>
                      {displayRole(role)}
                    </option>
                  ))}
                </select>
              </label>

              <div className="tip-box">
                <strong>Role permissions</strong>
                <p>
                  Company Admins manage their own company's employees.
                  Managers and Staff receive their respective workspace
                  permissions. Only the Superadmin can appoint Company Admins.
                </p>
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowInvite(false)}
                  disabled={inviting}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={inviting || !companies.some(
                    (company) => company.active,
                  )}
                >
                  {inviting ? 'Sending invitation...' : 'Send invitation'}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {/* ==================================================
          ASSIGN EXISTING EMPLOYEE MODAL
      ================================================== */}

      {showAssign && (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !assigning) {
              setShowAssign(false);
            }
          }}
        >
          <section
            className="modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="assign-employee-title"
          >
            <div className="modal-heading">
              <div>
                <p className="eyebrow">COMPANY MEMBERSHIP</p>
                <h2 id="assign-employee-title">Assign existing account</h2>
              </div>

              <button
                className="icon-button"
                onClick={() => setShowAssign(false)}
                disabled={assigning}
                aria-label="Close"
              >
                <XMarkIcon />
              </button>
            </div>

            <p className="muted company-modal-intro">
              Add an existing BlaQsWatch account to another company without
              creating a duplicate account.
            </p>

            <form onSubmit={assignExistingEmployee}>
              <label className="field">
                Company <em>*</em>
                <select
                  required
                  value={assignForm.businessId}
                  onChange={(event) => setAssignForm({
                    ...assignForm,
                    businessId: event.target.value,
                  })}
                >
                  <option value="">Select a company</option>
                  {companies
                    .filter((company) => company.active)
                    .map((company) => (
                      <option key={company.id} value={company.id}>
                        {company.name}
                      </option>
                    ))}
                </select>
              </label>

              <label className="field">
                Existing employee user ID <em>*</em>
                <input
                  required
                  value={assignForm.userId}
                  onChange={(event) => setAssignForm({
                    ...assignForm,
                    userId: event.target.value,
                  })}
                  placeholder="Supabase user UUID"
                />
              </label>

              <label className="field">
                Company role <em>*</em>
                <select
                  value={assignForm.role}
                  onChange={(event) => setAssignForm({
                    ...assignForm,
                    role: event.target.value,
                  })}
                >
                  {EMPLOYEE_ROLES.map((role) => (
                    <option key={role} value={role}>
                      {displayRole(role)}
                    </option>
                  ))}
                </select>
              </label>

              <div className="tip-box">
                <strong>Important</strong>
                <p>
                  This assigns a company membership to an existing account.
                  It does not change the employee's global account status or
                  remove their memberships in other companies.
                </p>
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowAssign(false)}
                  disabled={assigning}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={assigning || !companies.some(
                    (company) => company.active,
                  )}
                >
                  {assigning ? 'Assigning...' : 'Assign to company'}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {/* ==================================================
          COMPANY DETAILS MODAL
      ================================================== */}

      {selectedCompany && (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setSelectedCompany(null);
            }
          }}
        >
          <section
            className="modal-card company-details-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="company-details-title"
          >
            <div className="modal-heading">
              <div>
                <p className="eyebrow">COMPANY RECORD</p>
                <h2 id="company-details-title">{selectedCompany.name}</h2>
              </div>

              <button
                className="icon-button"
                onClick={() => setSelectedCompany(null)}
                aria-label="Close"
              >
                <XMarkIcon />
              </button>
            </div>

            <p className="muted">
              Status:{' '}
              <span className={`company-status ${selectedCompany.active ? 'active' : 'suspended'}`}>
                {selectedCompany.active ? 'Active' : 'Suspended'}
              </span>
            </p>

            <p className="muted company-id-text">
              Company ID: {selectedCompany.id}
            </p>

            <div className="form-section-title">COMPANY MEMBERS</div>

            {detailsLoading ? (
              <p className="company-empty-state">Loading members...</p>
            ) : members.length === 0 ? (
              <p className="company-empty-state">
                No members have been assigned to this company yet.
              </p>
            ) : (
              <div className="table-wrap">
                <table className="company-table">
                  <thead>
                    <tr>
                      <th>NAME / EMAIL</th>
                      <th>ROLE</th>
                      <th>STATUS</th>
                    </tr>
                  </thead>

                  <tbody>
                    {members.map((member) => (
                      <tr key={member.id}>
                        <td>
                          <strong>{member.full_name || 'Unnamed user'}</strong>
                          <span className="cell-sub">{member.email}</span>
                        </td>

                        <td>{displayRole(member.role)}</td>

                        <td>
                          <span className={`company-status ${member.active ? 'active' : 'suspended'}`}>
                            {member.active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="modal-actions">
              <button
                className="btn btn-secondary"
                onClick={() => setSelectedCompany(null)}
              >
                Close
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
