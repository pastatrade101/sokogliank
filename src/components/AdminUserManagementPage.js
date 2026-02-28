import { useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import {
  collection,
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import { useAuth } from '../contexts/authContext';
import { useTheme } from '../contexts/themeContext';
import { firestore } from '../firebase/init';
import { adminNavigation } from '../config/adminNavigation';
import { normalizeMembership } from '../utils/membershipHelpers';
import { isAdmin } from '../utils/roleHelpers';
import { formatDateTime, timestampToDate } from '../utils/tradingData';
import {
  AppShell,
  Breadcrumbs,
  Button,
  Card,
  EmptyState,
  ErrorState,
  FiltersPanel,
  Input,
  Modal,
  Select,
  SkeletonLoader,
  StatCard,
  Table,
  Tabs,
  useToast,
} from './ui';
import AppIcon from './icons/AppIcon';

const ROLE_TABS = ['all', 'member', 'trader', 'trader_admin', 'admin'];
const ROLE_EDIT_OPTIONS = [
  { value: 'member', label: 'Member' },
  { value: 'trader', label: 'Trader' },
  { value: 'trader_admin', label: 'Trader Admin' },
  { value: 'admin', label: 'Admin' },
];
const TRADER_STATUS_OPTIONS = [
  { value: 'none', label: 'None' },
  { value: 'pending', label: 'Pending' },
  { value: 'active', label: 'Active' },
  { value: 'rejected', label: 'Rejected' },
];
const MEMBERSHIP_FILTER_OPTIONS = [
  { value: 'all', label: 'All membership' },
  { value: 'premium_active', label: 'Premium active' },
  { value: 'premium', label: 'Premium all' },
  { value: 'trial', label: 'Trial accounts' },
  { value: 'free', label: 'Free' },
];
const STATUS_FILTER_OPTIONS = [
  { value: 'all', label: 'All status' },
  { value: 'banned', label: 'Banned only' },
  { value: 'unbanned', label: 'Not banned' },
];

const AdminUserManagementPage = () => {
  const { profile, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { pushToast } = useToast();
  const adminUser = isAdmin(profile?.role);
  const [isMobileViewport, setIsMobileViewport] = useState(
    typeof window !== 'undefined' && window.matchMedia('(max-width: 760px)').matches,
  );

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchValue, setSearchValue] = useState('');
  const [activeRoleTab, setActiveRoleTab] = useState('all');
  const [membershipFilter, setMembershipFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedUserId, setSelectedUserId] = useState('');
  const [editDisplayName, setEditDisplayName] = useState('');
  const [editCountry, setEditCountry] = useState('');
  const [editRole, setEditRole] = useState('member');
  const [editTraderStatus, setEditTraderStatus] = useState('none');
  const [editBanned, setEditBanned] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }
    const mediaQuery = window.matchMedia('(max-width: 760px)');
    const onChange = (event) => setIsMobileViewport(event.matches);
    setIsMobileViewport(mediaQuery.matches);
    mediaQuery.addEventListener('change', onChange);
    return () => mediaQuery.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    if (!adminUser) {
      return undefined;
    }

    const unsubscribe = onSnapshot(
      collection(firestore, 'users'),
      (snapshot) => {
        const next = snapshot.docs
          .map((docSnap) => normalizeAdminUser(docSnap.id, docSnap.data() ?? {}))
          .sort((a, b) => {
            const aTime = a.createdAtDate?.getTime?.() ?? 0;
            const bTime = b.createdAtDate?.getTime?.() ?? 0;
            return bTime - aTime;
          });
        setUsers(next);
        setLoading(false);
        setError('');
      },
      (snapshotError) => {
        setError(snapshotError.message || 'Unable to load users.');
        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, [adminUser]);

  const selectedUser = useMemo(
    () => users.find((entry) => entry.uid === selectedUserId) ?? null,
    [users, selectedUserId],
  );

  useEffect(() => {
    if (!selectedUser) {
      return;
    }
    setEditDisplayName(selectedUser.displayName);
    setEditCountry(selectedUser.country);
    setEditRole(selectedUser.role);
    setEditTraderStatus(selectedUser.traderStatus);
    setEditBanned(selectedUser.isBanned);
  }, [selectedUser]);

  const roleCounts = useMemo(() => {
    const next = {
      all: users.length,
      member: 0,
      trader: 0,
      trader_admin: 0,
      admin: 0,
    };
    users.forEach((entry) => {
      if (next[entry.role] !== undefined) {
        next[entry.role] += 1;
      }
    });
    return next;
  }, [users]);

  const filteredUsers = useMemo(() => {
    return users.filter((entry) => {
      if (activeRoleTab !== 'all' && entry.role !== activeRoleTab) {
        return false;
      }
      if (statusFilter === 'banned' && !entry.isBanned) {
        return false;
      }
      if (statusFilter === 'unbanned' && entry.isBanned) {
        return false;
      }
      if (membershipFilter === 'premium_active' && !entry.premiumActive) {
        return false;
      }
      if (membershipFilter === 'premium' && entry.membership.tier !== 'premium') {
        return false;
      }
      if (membershipFilter === 'trial' && !entry.trialAccount) {
        return false;
      }
      if (membershipFilter === 'free' && entry.membership.tier !== 'free') {
        return false;
      }

      const term = searchValue.trim().toLowerCase();
      if (!term) {
        return true;
      }
      const haystack = `${entry.uid} ${entry.displayName} ${entry.username} ${entry.email} ${entry.country}`.toLowerCase();
      return haystack.includes(term);
    });
  }, [activeRoleTab, membershipFilter, searchValue, statusFilter, users]);

  const stats = useMemo(() => {
    const total = users.length;
    const banned = users.filter((entry) => entry.isBanned).length;
    const premiumActive = users.filter((entry) => entry.premiumActive).length;
    const trialAccounts = users.filter((entry) => entry.trialAccount).length;
    const traders = users.filter((entry) => entry.role === 'trader' || entry.role === 'trader_admin').length;
    const newThisWeek = users.filter((entry) => isWithinDays(entry.createdAtDate, 7)).length;
    return {
      total,
      banned,
      premiumActive,
      trialAccounts,
      traders,
      newThisWeek,
    };
  }, [users]);

  const tableColumns = useMemo(() => {
    return [
      {
        key: 'user',
        label: 'User',
        sortable: true,
        sortValue: (row) => `${row.displayName} ${row.username} ${row.email}`.toLowerCase(),
        render: (row) => (
          <div className="user-mgmt-user-cell">
            <span className={`user-mgmt-avatar ${row.avatarUrl ? '' : 'is-fallback'}`.trim()}>
              {row.avatarUrl ? <img src={row.avatarUrl} alt="" /> : initialsFor(row.displayName)}
            </span>
            <div>
              <p className="user-mgmt-primary">{row.displayName}</p>
              <p className="user-mgmt-secondary">
                {row.username ? `@${row.username}` : row.email}
              </p>
            </div>
          </div>
        ),
      },
      {
        key: 'role',
        label: 'Role',
        sortable: true,
        render: (row) => <span className={`user-mgmt-badge role-${row.role}`.trim()}>{roleLabel(row.role)}</span>,
      },
      {
        key: 'membership',
        label: 'Membership',
        sortable: true,
        sortValue: (row) => `${row.membership.tier}-${row.membership.status}`,
        render: (row) => (
          <div className="user-mgmt-membership-cell">
            <span className={`user-mgmt-badge membership-${row.membership.tier}`.trim()}>
              {membershipLabel(row)}
            </span>
            <p>{row.membership.expiresAt ? formatDateTime(row.membership.expiresAt) : 'No expiry'}</p>
          </div>
        ),
      },
      {
        key: 'country',
        label: 'Country',
        sortable: true,
        render: (row) => row.country || '--',
      },
      {
        key: 'status',
        label: 'Status',
        sortable: true,
        render: (row) => (
          <div className="user-mgmt-status-cell">
            <span className={`user-mgmt-badge ${row.isBanned ? 'status-banned' : 'status-live'}`.trim()}>
              {row.isBanned ? 'Banned' : 'Active'}
            </span>
            <p>{humanize(row.traderStatus)}</p>
          </div>
        ),
      },
      {
        key: 'joined',
        label: 'Joined',
        sortable: true,
        sortValue: (row) => row.createdAtDate?.getTime?.() ?? 0,
        render: (row) => row.createdAtDate ? formatDateTime(row.createdAtDate) : '--',
      },
      {
        key: 'actions',
        label: 'Actions',
        render: (row) => (
          <Button
            size="sm"
            variant="secondary"
            onClick={(event) => {
              event.stopPropagation();
              setSelectedUserId(row.uid);
            }}
          >
            View
          </Button>
        ),
      },
    ];
  }, []);

  const handleSaveUser = async () => {
    if (!selectedUser) {
      return;
    }
    const safeName = editDisplayName.trim();
    if (safeName.length < 2) {
      pushToast({ type: 'error', title: 'Name required', message: 'Display name must be at least 2 characters.' });
      return;
    }
    setSaving(true);
    try {
      await setDoc(doc(firestore, 'users', selectedUser.uid), {
        displayName: safeName,
        country: editCountry.trim(),
        role: editRole,
        traderStatus: editTraderStatus,
        isBanned: editBanned,
        updatedAt: serverTimestamp(),
      }, { merge: true });
      pushToast({ type: 'success', title: 'User updated', message: 'Changes saved successfully.' });
    } catch (saveError) {
      pushToast({
        type: 'error',
        title: 'Update failed',
        message: saveError instanceof Error ? saveError.message : 'Unable to update user right now.',
      });
    } finally {
      setSaving(false);
    }
  };

  if (!adminUser) {
    return <Navigate to="/" replace />;
  }

  return (
    <AppShell
      pageTitle="User Management"
      pageDescription="Manage users, roles, and membership quality at scale"
      navItems={adminNavigation}
      profile={profile}
      onSignOut={signOut}
      theme={theme}
      onToggleTheme={toggleTheme}
      searchValue={searchValue}
      onSearchChange={setSearchValue}
      topbarActions={<span className="status-badge live">{filteredUsers.length} visible</span>}
    >
      <Breadcrumbs
        items={[
          { label: 'Admin', to: '/admin' },
          { label: 'User Management' },
        ]}
      />

      <section className="ui-grid cols-3">
        <StatCard label="Total Users" value={stats.total} trend={`${stats.newThisWeek} joined in 7d`} icon="user" />
        <StatCard label="Traders" value={stats.traders} trend={`${roleCounts.trader_admin} trader admins`} icon="chart" />
        <StatCard label="Membership" value={stats.premiumActive} trend={`${stats.trialAccounts} on trial`} icon="upgrade" />
        <StatCard label="Banned" value={stats.banned} trend={stats.banned === 0 ? 'All clear' : 'Requires review'} trendDirection={stats.banned > 0 ? 'negative' : 'positive'} icon="alert" />
      </section>

      <FiltersPanel
        title="Filters"
        actions={<span className="status-badge">{users.length} total records</span>}
      >
        <Tabs
          tabs={ROLE_TABS.map((role) => ({
            key: role,
            label: `${roleLabel(role)} (${roleCounts[role] ?? 0})`,
          }))}
          activeKey={activeRoleTab}
          onChange={setActiveRoleTab}
          ariaLabel="Role filter tabs"
          className="user-mgmt-role-tabs"
        />
        <div className="user-mgmt-filter-grid">
          <Select
            id="membership-filter"
            label="Membership"
            value={membershipFilter}
            onChange={(event) => setMembershipFilter(event.target.value)}
            options={MEMBERSHIP_FILTER_OPTIONS}
          />
          <Select
            id="status-filter"
            label="Account status"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            options={STATUS_FILTER_OPTIONS}
          />
        </div>
      </FiltersPanel>

      <Card title="Users Directory" subtitle="Sortable, paginated records with quick profile actions" hover>
        {loading ? (
          <div className="ui-stack">
            <SkeletonLoader size="xl" />
            <SkeletonLoader size="xl" />
          </div>
        ) : error ? (
          <ErrorState description={error} onRetry={() => window.location.reload()} />
        ) : filteredUsers.length === 0 ? (
          <EmptyState
            title="No users match this filter"
            description="Adjust role, status, or membership filters to see more records."
            icon="filter"
          />
        ) : isMobileViewport ? (
          <div className="user-mgmt-mobile-list">
            {filteredUsers.map((row) => (
              <article key={row.uid} className="user-mgmt-mobile-card">
                <div className="user-mgmt-mobile-head">
                  <div className="user-mgmt-user-cell">
                    <span className={`user-mgmt-avatar ${row.avatarUrl ? '' : 'is-fallback'}`.trim()}>
                      {row.avatarUrl ? <img src={row.avatarUrl} alt="" /> : initialsFor(row.displayName)}
                    </span>
                    <div>
                      <p className="user-mgmt-primary">{row.displayName}</p>
                      <p className="user-mgmt-secondary">
                        {row.username ? `@${row.username}` : row.email}
                      </p>
                    </div>
                  </div>
                  <Button size="sm" variant="secondary" onClick={() => setSelectedUserId(row.uid)}>
                    View
                  </Button>
                </div>

                <div className="user-mgmt-mobile-badges">
                  <span className={`user-mgmt-badge role-${row.role}`.trim()}>{roleLabel(row.role)}</span>
                  <span className={`user-mgmt-badge membership-${row.membership.tier}`.trim()}>
                    {membershipLabel(row)}
                  </span>
                  <span className={`user-mgmt-badge ${row.isBanned ? 'status-banned' : 'status-live'}`.trim()}>
                    {row.isBanned ? 'Banned' : 'Active'}
                  </span>
                </div>

                <div className="user-mgmt-mobile-meta">
                  <p>
                    <span>Joined</span>
                    <strong>{row.createdAtDate ? formatDateTime(row.createdAtDate) : '--'}</strong>
                  </p>
                  <p>
                    <span>Country</span>
                    <strong>{row.country || '--'}</strong>
                  </p>
                  <p>
                    <span>Trader Status</span>
                    <strong>{humanize(row.traderStatus)}</strong>
                  </p>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <Table
            columns={tableColumns}
            rows={filteredUsers}
            pageSize={10}
            getRowId={(row) => row.uid}
            onRowClick={(row) => setSelectedUserId(row.uid)}
          />
        )}
      </Card>

      <Modal
        open={Boolean(selectedUser)}
        title="User Profile"
        onClose={() => {
          if (!saving) {
            setSelectedUserId('');
          }
        }}
        footer={(
          <>
            <Button
              type="button"
              variant="ghost"
              disabled={saving}
              onClick={() => setSelectedUserId('')}
            >
              Close
            </Button>
            <Button type="button" variant="primary" disabled={saving} onClick={handleSaveUser}>
              {saving ? 'Saving...' : 'Save changes'}
            </Button>
          </>
        )}
      >
        {selectedUser ? (
          <section className="user-mgmt-modal-stack">
            <div className="user-mgmt-modal-head">
              <span className={`user-mgmt-avatar user-mgmt-avatar-lg ${selectedUser.avatarUrl ? '' : 'is-fallback'}`.trim()}>
                {selectedUser.avatarUrl ? <img src={selectedUser.avatarUrl} alt="" /> : initialsFor(selectedUser.displayName)}
              </span>
              <div>
                <p className="user-mgmt-modal-name">{selectedUser.displayName}</p>
                <p className="user-mgmt-modal-email">{selectedUser.email || '--'}</p>
                <div className="user-mgmt-modal-meta">
                  <span className={`user-mgmt-badge role-${selectedUser.role}`.trim()}>{roleLabel(selectedUser.role)}</span>
                  <span className={`user-mgmt-badge ${selectedUser.isBanned ? 'status-banned' : 'status-live'}`.trim()}>
                    {selectedUser.isBanned ? 'Banned' : 'Active'}
                  </span>
                </div>
              </div>
            </div>

            <div className="user-mgmt-modal-grid">
              <article className="user-mgmt-modal-item">
                <p className="profile-modal-label">UID</p>
                <p className="profile-modal-value profile-modal-value-mono">{selectedUser.uid}</p>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(selectedUser.uid);
                      pushToast({ type: 'success', title: 'Copied', message: 'UID copied.' });
                    } catch {
                      pushToast({ type: 'error', title: 'Copy failed', message: 'Clipboard unavailable.' });
                    }
                  }}
                >
                  <AppIcon name="copy" size={14} />
                  Copy UID
                </Button>
              </article>
              <article className="user-mgmt-modal-item">
                <p className="profile-modal-label">Joined</p>
                <p className="profile-modal-value">{selectedUser.createdAtDate ? formatDateTime(selectedUser.createdAtDate) : '--'}</p>
              </article>
              <article className="user-mgmt-modal-item">
                <p className="profile-modal-label">Membership</p>
                <p className="profile-modal-value">{membershipLabel(selectedUser)}</p>
                <p className="ui-card-subtitle">
                  {selectedUser.membership.expiresAt ? `Valid until ${formatDateTime(selectedUser.membership.expiresAt)}` : 'No expiry'}
                </p>
              </article>
              <article className="user-mgmt-modal-item">
                <p className="profile-modal-label">Trader Status</p>
                <p className="profile-modal-value">{humanize(selectedUser.traderStatus)}</p>
              </article>
            </div>

            <div className="user-mgmt-edit-grid">
              <Input
                id="edit-user-name"
                label="Display name"
                value={editDisplayName}
                onChange={(event) => setEditDisplayName(event.target.value)}
              />
              <Input
                id="edit-user-country"
                label="Country"
                value={editCountry}
                onChange={(event) => setEditCountry(event.target.value)}
              />
              <Select
                id="edit-user-role"
                label="Role"
                value={editRole}
                onChange={(event) => setEditRole(event.target.value)}
                options={ROLE_EDIT_OPTIONS}
              />
              <Select
                id="edit-user-trader-status"
                label="Trader status"
                value={editTraderStatus}
                onChange={(event) => setEditTraderStatus(event.target.value)}
                options={TRADER_STATUS_OPTIONS}
              />
            </div>

            <div className="quick-actions">
              <Button
                type="button"
                variant={editBanned ? 'secondary' : 'danger'}
                disabled={saving}
                onClick={() => setEditBanned((current) => !current)}
              >
                <AppIcon name="alert" size={14} />
                {editBanned ? 'Unban account' : 'Ban account'}
              </Button>
            </div>
          </section>
        ) : null}
      </Modal>
    </AppShell>
  );
};

export default AdminUserManagementPage;

function normalizeAdminUser(uid, data = {}) {
  const membership = normalizeMembership(data.membership, data.membershipTier);
  const expiresAt = membership.expiresAt;
  const premiumActive = membership.tier === 'premium'
    && membership.status === 'active'
    && (!expiresAt || expiresAt.getTime() > Date.now());
  const trialAccount = String(membership.source || '').toLowerCase() === 'trial' || membership.trialUsed === true;

  return {
    uid,
    displayName: String(data.displayName || data.username || data.email || 'Unknown User').trim(),
    username: String(data.username || '').trim(),
    email: String(data.email || '').trim(),
    country: String(data.country || '').trim(),
    role: normalizeRole(data.role),
    traderStatus: String(data.traderStatus || 'none').toLowerCase(),
    isBanned: data.isBanned === true,
    avatarUrl: String(data.avatarUrl || data.photoURL || data.photoUrl || '').trim(),
    createdAtDate: timestampToDate(data.createdAt),
    membership,
    premiumActive,
    trialAccount,
  };
}

function normalizeRole(value) {
  const role = String(value || 'member').toLowerCase();
  if (role === 'trader_admin' || role === 'trader' || role === 'admin') {
    return role;
  }
  return 'member';
}

function roleLabel(role) {
  if (role === 'trader_admin') {
    return 'Trader Admin';
  }
  if (role === 'trader') {
    return 'Trader';
  }
  if (role === 'admin') {
    return 'Admin';
  }
  if (role === 'all') {
    return 'All';
  }
  return 'Member';
}

function membershipLabel(user) {
  if (user.trialAccount) {
    return 'Trial';
  }
  if (user.premiumActive) {
    return 'Premium Active';
  }
  if (user.membership.tier === 'premium') {
    return 'Premium';
  }
  return 'Free';
}

function initialsFor(name) {
  const text = String(name || '').trim();
  if (!text) {
    return 'U';
  }
  return text
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('');
}

function humanize(value) {
  return String(value || '')
    .replace(/[_-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase()) || '--';
}

function isWithinDays(date, days) {
  if (!(date instanceof Date)) {
    return false;
  }
  const threshold = Date.now() - days * 24 * 60 * 60 * 1000;
  return date.getTime() >= threshold;
}
