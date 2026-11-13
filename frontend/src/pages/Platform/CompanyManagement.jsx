import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import {
  ArrowPathIcon,
  BuildingOffice2Icon,
  MagnifyingGlassIcon,
  PlusIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { supabase } from '../../lib/supabase';
import '../../styles/platform-management.css';

const EMPTY_FORM = { companyName: '', administratorName: '', administratorEmail: '' };

function formatDate(value) {
  if (!value) return '—';
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
  }).format(new Date(value));
}

export default function CompanyManagement() {
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

  const invoke = useCallback(async (body) => {
    const { data, error } = await supabase.functions.invoke('platform-companies', { body });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    return data;
  }, []);

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

  useEffect(() => { loadCompanies(); }, [loadCompanies]);

  const filteredCompanies = useMemo(() => {
    const term = search.trim().toLowerCase();
    return companies.filter((company) => {
      const matchesSearch = !term || company.name.toLowerCase().includes(term);
      const matchesStatus = statusFilter === 'all'
        || (statusFilter === 'active' ? company.active : !company.active);
      return matchesSearch && matchesStatus;
    });
  }, [companies, search, statusFilter]);

  const counts = useMemo(() => ({
    total: companies.length,
    active: companies.filter((item) => item.active).length,
    suspended: companies.filter((item) => !item.active).length,
  }), [companies]);

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
      await loadCompanies(true);
    } catch (error) {
      console.error('Company creation failed:', error);
      toast.error(error.message || 'Unable to create company.');
    } finally {
      setSaving(false);
    }
  }

  async function toggleCompany(company) {
    const nextActive = !company.active;
    const confirmed = window.confirm(
      nextActive
        ? `Activate ${company.name}? Its members will regain workspace access.`
        : `Suspend ${company.name}? Its members will lose workspace access, but company records will be retained.`
    );
    if (!confirmed) return;

    setWorkingId(company.id);
    try {
      await invoke({ action: 'set_status', businessId: company.id, active: nextActive });
      toast.success(nextActive ? 'Company activated.' : 'Company suspended.');
      await loadCompanies(true);
      if (selectedCompany?.id === company.id) {
        setSelectedCompany((current) => current ? { ...current, active: nextActive } : current);
      }
    } catch (error) {
      console.error('Company status update failed:', error);
      toast.error(error.message || 'Unable to update company status.');
    } finally {
      setWorkingId(null);
    }
  }

  async function openDetails(company) {
    setSelectedCompany(company);
    setMembers([]);
    setDetailsLoading(true);
    try {
      const data = await invoke({ action: 'details', businessId: company.id });
      setMembers(data.members || []);
    } catch (error) {
      console.error('Company details failed:', error);
      toast.error(error.message || 'Unable to load company members.');
    } finally {
      setDetailsLoading(false);
    }
  }

  return (
    <div className="dashboard-page company-management-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">PLATFORM CONTROL CENTRE</p>
          <h1>Company management</h1>
          <p className="muted">Register companies, manage platform access and inspect company memberships.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
          <PlusIcon /> Register company
        </button>
      </div>

      <div className="company-stat-grid">
        <div className="stat-card"><span className="stat-label">Registered companies</span><div className="stat-value">{counts.total}</div><span className="stat-detail">All companies on BlaQsWatch</span></div>
        <div className="stat-card"><span className="stat-label">Active companies</span><div className="stat-value">{counts.active}</div><span className="stat-detail">Workspace access enabled</span></div>
        <div className="stat-card"><span className="stat-label">Suspended companies</span><div className="stat-value">{counts.suspended}</div><span className="stat-detail">Workspace access disabled</span></div>
      </div>

      <section className="panel list-panel">
        <div className="panel-heading">
          <div><h2>Registered companies</h2><p>Company access and administrator onboarding</p></div>
          <button className="btn btn-secondary btn-small" onClick={() => loadCompanies(true)} disabled={refreshing}>
            <ArrowPathIcon className={refreshing ? 'is-spinning' : ''} /> Refresh
          </button>
        </div>

        <div className="filter-toolbar company-filter-toolbar">
          <label className="search-field">
            <MagnifyingGlassIcon />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search companies..." />
          </label>
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} aria-label="Filter by company status">
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
          </select>
          <span className="result-count">{filteredCompanies.length} result(s)</span>
        </div>

        {loading ? (
          <div className="company-empty-state">Loading registered companies...</div>
        ) : filteredCompanies.length === 0 ? (
          <div className="company-empty-state">
            <BuildingOffice2Icon />
            <strong>{companies.length ? 'No matching companies' : 'No companies registered yet'}</strong>
            <span>{companies.length ? 'Try changing your search or status filter.' : 'Register your first company to begin onboarding.'}</span>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="company-table">
              <thead><tr><th>COMPANY</th><th>STATUS</th><th>CREATED</th><th>MEMBERS</th><th className="company-actions-heading">ACTIONS</th></tr></thead>
              <tbody>
                {filteredCompanies.map((company) => (
                  <tr key={company.id}>
                    <td><strong>{company.name}</strong><span className="cell-sub">ID: {company.id}</span></td>
                    <td><span className={`company-status ${company.active ? 'active' : 'suspended'}`}>{company.active ? 'Active' : 'Suspended'}</span></td>
                    <td>{formatDate(company.created_at)}</td>
                    <td>{company.member_count ?? 0}</td>
                    <td>
                      <div className="company-row-actions">
                        <button className="btn btn-secondary btn-small" onClick={() => openDetails(company)}>Details</button>
                        <button
                          className={`btn btn-small ${company.active ? 'btn-danger-outline' : 'btn-primary'}`}
                          onClick={() => toggleCompany(company)}
                          disabled={workingId === company.id}
                        >
                          {workingId === company.id ? 'Updating...' : company.active ? 'Suspend' : 'Activate'}
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

      {showCreate && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget && !saving) setShowCreate(false);
        }}>
          <section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="create-company-title">
            <div className="modal-heading">
              <div><p className="eyebrow">COMPANY ONBOARDING</p><h2 id="create-company-title">Register a company</h2></div>
              <button className="icon-button" onClick={() => setShowCreate(false)} disabled={saving} aria-label="Close"><XMarkIcon /></button>
            </div>
            <p className="muted company-modal-intro">Create the company workspace and send an invitation to its first administrator.</p>
            <form onSubmit={createCompany}>
              <label className="field">Company name <em>*</em>
                <input required maxLength={120} value={form.companyName} onChange={(e) => setForm({ ...form, companyName: e.target.value })} placeholder="e.g. Amigos Workshop" />
              </label>
              <div className="form-section-title">FIRST COMPANY ADMINISTRATOR</div>
              <label className="field">Administrator full name <em>*</em>
                <input required maxLength={120} value={form.administratorName} onChange={(e) => setForm({ ...form, administratorName: e.target.value })} placeholder="Full name" />
              </label>
              <label className="field">Administrator email <em>*</em>
                <input required type="email" maxLength={254} value={form.administratorEmail} onChange={(e) => setForm({ ...form, administratorEmail: e.target.value })} placeholder="name@company.com" />
              </label>
              <div className="tip-box">
                <strong>What happens next?</strong>
                <p>The company is created as active. An administrator invitation is sent by Supabase Auth. The invitee receives company administrator access after accepting the invitation.</p>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowCreate(false)} disabled={saving}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Creating...' : 'Create company & invite admin'}</button>
              </div>
            </form>
          </section>
        </div>
      )}

      {selectedCompany && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setSelectedCompany(null);
        }}>
          <section className="modal-card company-details-modal" role="dialog" aria-modal="true" aria-labelledby="company-details-title">
            <div className="modal-heading">
              <div><p className="eyebrow">COMPANY RECORD</p><h2 id="company-details-title">{selectedCompany.name}</h2></div>
              <button className="icon-button" onClick={() => setSelectedCompany(null)} aria-label="Close"><XMarkIcon /></button>
            </div>
            <p className="muted">Status: <span className={`company-status ${selectedCompany.active ? 'active' : 'suspended'}`}>{selectedCompany.active ? 'Active' : 'Suspended'}</span></p>
            <p className="muted company-id-text">Company ID: {selectedCompany.id}</p>
            <div className="form-section-title">COMPANY MEMBERS</div>
            {detailsLoading ? <p className="company-empty-state">Loading members...</p> : members.length === 0 ? (
              <p className="company-empty-state">No members have been assigned to this company yet.</p>
            ) : (
              <div className="table-wrap">
                <table className="company-table">
                  <thead><tr><th>NAME / EMAIL</th><th>ROLE</th><th>STATUS</th></tr></thead>
                  <tbody>{members.map((member) => (
                    <tr key={member.id}>
                      <td><strong>{member.full_name || 'Unnamed user'}</strong><span className="cell-sub">{member.email}</span></td>
                      <td>{member.role}</td>
                      <td><span className={`company-status ${member.active ? 'active' : 'suspended'}`}>{member.active ? 'Active' : 'Inactive'}</span></td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            )}
            <div className="modal-actions"><button className="btn btn-secondary" onClick={() => setSelectedCompany(null)}>Close</button></div>
          </section>
        </div>
      )}
    </div>
  );
}
