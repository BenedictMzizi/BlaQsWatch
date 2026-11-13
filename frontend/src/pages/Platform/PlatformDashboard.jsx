import { Link } from 'react-router-dom';
import {
  BuildingOffice2Icon,
  UserGroupIcon,
  ClipboardDocumentCheckIcon,
  ShieldCheckIcon,
  ArrowRightIcon,
} from '@heroicons/react/24/outline';

export default function PlatformDashboard() {
  return (
    <div className="dashboard-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">BLAQSWATCH CONTROL CENTRE</p>
          <h1>Platform overview</h1>
          <p className="muted">
            Manage BlaQsWatch companies, onboarding and platform access.
          </p>
        </div>
        <div className="dashboard-heading-icon"><ShieldCheckIcon /></div>
      </div>

      <div className="platform-management-grid">
        <Link to="/platform/companies" className="platform-management-card">
          <span className="platform-management-icon"><BuildingOffice2Icon /></span>
          <span className="platform-management-copy">
            <strong>Company management</strong>
            <small>Register companies, inspect memberships, activate or suspend access.</small>
          </span>
          <ArrowRightIcon className="platform-management-arrow" />
        </Link>

        <Link to="/platform/companies" className="platform-management-card">
          <span className="platform-management-icon"><ClipboardDocumentCheckIcon /></span>
          <span className="platform-management-copy">
            <strong>Company onboarding</strong>
            <small>Register a company and invite its first administrator.</small>
          </span>
          <ArrowRightIcon className="platform-management-arrow" />
        </Link>

        <div className="platform-management-card is-planned">
          <span className="platform-management-icon"><UserGroupIcon /></span>
          <span className="platform-management-copy">
            <strong>Employee administration</strong>
            <small>Employee invitations, role changes and offboarding are the next module.</small>
            <em>Planned next phase</em>
          </span>
        </div>
      </div>

      <section className="platform-workspace-card">
        <div>
          <h2>Return to your company workspace</h2>
          <p>Continue managing products, inventory and stock movements.</p>
        </div>
        <Link to="/" className="btn btn-primary">
          Company workspace <ArrowRightIcon />
        </Link>
      </section>
    </div>
  );
}
