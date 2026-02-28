import { useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { collection, onSnapshot } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { useAuth } from '../contexts/authContext';
import { useTheme } from '../contexts/themeContext';
import { firestore, firebaseFunctions } from '../firebase/init';
import { adminNavigation } from '../config/adminNavigation';
import { isAdmin } from '../utils/roleHelpers';
import {
  AppShell,
  Breadcrumbs,
  Button,
  Card,
  ErrorState,
  Input,
  Select,
  SkeletonLoader,
  Textarea,
  useToast,
} from './ui';

const AUDIENCE_OPTIONS = [
  { value: 'all', label: 'All users' },
  { value: 'selected', label: 'Selected users' },
];

const AdminNotificationPage = () => {
  const { profile, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { pushToast } = useToast();
  const adminUser = isAdmin(profile?.role);

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [audience, setAudience] = useState('all');
  const [searchValue, setSearchValue] = useState('');
  const [users, setUsers] = useState([]);
  const [selectedUserIds, setSelectedUserIds] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [errorUsers, setErrorUsers] = useState('');
  const [sending, setSending] = useState(false);
  const [lastResult, setLastResult] = useState(null);

  useEffect(() => {
    if (!adminUser) {
      return undefined;
    }

    const unsubscribe = onSnapshot(
      collection(firestore, 'users'),
      (snapshot) => {
        const nextUsers = snapshot.docs
          .map((docSnap) => normalizeUser(docSnap.id, docSnap.data() ?? {}))
          .sort((a, b) => a.displayName.localeCompare(b.displayName));
        setUsers(nextUsers);
        setLoadingUsers(false);
        setErrorUsers('');
      },
      (loadError) => {
        setErrorUsers(loadError.message || 'Unable to load users.');
        setLoadingUsers(false);
      },
    );

    return () => unsubscribe();
  }, [adminUser]);

  const filteredUsers = useMemo(() => {
    const term = searchValue.trim().toLowerCase();
    if (!term) {
      return users;
    }
    return users.filter((entry) => {
      const haystack = `${entry.displayName} ${entry.username} ${entry.email} ${entry.uid}`.toLowerCase();
      return haystack.includes(term);
    });
  }, [searchValue, users]);

  const selectedSet = useMemo(() => new Set(selectedUserIds), [selectedUserIds]);
  const selectedCount = selectedUserIds.length;

  const toggleUser = (uid) => {
    setSelectedUserIds((current) => {
      if (current.includes(uid)) {
        return current.filter((entry) => entry !== uid);
      }
      return [...current, uid];
    });
  };

  const selectVisibleUsers = () => {
    setSelectedUserIds((current) => {
      const next = new Set(current);
      filteredUsers.forEach((entry) => next.add(entry.uid));
      return [...next];
    });
  };

  const clearSelection = () => setSelectedUserIds([]);

  const handleSendNotification = async (event) => {
    event.preventDefault();
    const safeTitle = title.trim();
    const safeBody = body.trim();

    if (safeTitle.length < 3) {
      pushToast({ type: 'error', title: 'Title required', message: 'Use at least 3 characters for title.' });
      return;
    }
    if (safeBody.length < 3) {
      pushToast({ type: 'error', title: 'Body required', message: 'Use at least 3 characters for body.' });
      return;
    }
    if (audience === 'selected' && selectedCount === 0) {
      pushToast({ type: 'error', title: 'No users selected', message: 'Select at least one user.' });
      return;
    }

    setSending(true);
    setLastResult(null);
    try {
      const sendCustomNotification = httpsCallable(firebaseFunctions, 'sendCustomNotification');
      const payload = {
        title: safeTitle,
        body: safeBody,
        audience,
        userIds: audience === 'selected' ? selectedUserIds : [],
      };
      const response = await sendCustomNotification(payload);
      const result = response?.data ?? {};
      setLastResult(result);
      pushToast({
        type: 'success',
        title: 'Notification sent',
        message: `${result.successCount ?? 0} delivered, ${result.failureCount ?? 0} failed.`,
      });
      setTitle('');
      setBody('');
      if (audience === 'selected') {
        clearSelection();
      }
    } catch (sendError) {
      pushToast({
        type: 'error',
        title: 'Send failed',
        message: sendError instanceof Error ? sendError.message : 'Unable to send notification.',
      });
    } finally {
      setSending(false);
    }
  };

  if (!adminUser) {
    return <Navigate to="/" replace />;
  }

  return (
    <AppShell
      pageTitle="Notifications"
      pageDescription="Send custom push notifications to all users or selected users"
      navItems={adminNavigation}
      profile={profile}
      onSignOut={signOut}
      theme={theme}
      onToggleTheme={toggleTheme}
      searchValue=""
      onSearchChange={null}
    >
      <Breadcrumbs
        items={[
          { label: 'Admin', to: '/admin' },
          { label: 'Notifications' },
        ]}
      />

      {errorUsers ? (
        <ErrorState title="Unable to load users" description={errorUsers} />
      ) : null}

      <form className="ui-stack" onSubmit={handleSendNotification}>
        <Card
          className="admin-analytics-card"
          title="Create Notification"
          subtitle="Compose title and message body for push delivery"
          hover
        >
          <div className="ui-grid cols-2">
            <Input
              id="notification-title"
              label="Title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Market update"
              maxLength={120}
              required
            />
            <Select
              id="notification-audience"
              label="Audience"
              value={audience}
              onChange={(event) => setAudience(event.target.value)}
              options={AUDIENCE_OPTIONS}
            />
          </div>

          <Textarea
            id="notification-body"
            label="Body"
            value={body}
            onChange={(event) => setBody(event.target.value)}
            placeholder="Your message to users..."
            rows={4}
            maxLength={500}
            required
          />

          <div className="notification-compose-foot">
            <p className="ui-card-subtitle">
              {audience === 'all'
                ? `Will send to all users (${users.length} loaded accounts).`
                : `Will send to selected users (${selectedCount} selected).`}
            </p>
            <Button type="submit" variant="primary" disabled={sending || loadingUsers}>
              {sending ? 'Sending...' : 'Send Notification'}
            </Button>
          </div>
        </Card>

        {audience === 'selected' ? (
          <Card
            className="admin-analytics-card"
            title="Select Recipients"
            subtitle="Search and choose users for targeted delivery"
            hover
          >
            {loadingUsers ? (
              <div className="ui-stack">
                <SkeletonLoader size="md" />
                <SkeletonLoader size="xl" />
              </div>
            ) : (
              <>
                <div className="notification-recipient-tools">
                  <Input
                    id="recipient-search"
                    label="Search users"
                    value={searchValue}
                    onChange={(event) => setSearchValue(event.target.value)}
                    placeholder="Search by name, username, email, or uid"
                  />
                  <div className="quick-actions">
                    <Button type="button" size="sm" variant="secondary" onClick={selectVisibleUsers}>
                      Select Visible
                    </Button>
                    <Button type="button" size="sm" variant="secondary" onClick={clearSelection}>
                      Clear
                    </Button>
                  </div>
                </div>

                <div className="notification-recipient-list">
                  {filteredUsers.map((entry) => {
                    const checked = selectedSet.has(entry.uid);
                    return (
                      <label key={entry.uid} className="notification-recipient-row">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleUser(entry.uid)}
                        />
                        <span>
                          <strong>{entry.displayName}</strong>
                          <small>
                            {entry.username ? `@${entry.username}` : entry.email || entry.uid}
                          </small>
                        </span>
                      </label>
                    );
                  })}
                </div>
              </>
            )}
          </Card>
        ) : null}

        {lastResult ? (
          <Card
            className="admin-analytics-card"
            title="Delivery Summary"
            subtitle="Latest send result"
          >
            <div className="admin-snapshot-grid">
              <article className="admin-snapshot-item">
                <p className="admin-snapshot-label">Target users</p>
                <p className="admin-snapshot-value">{Number(lastResult.targetUserCount || 0)}</p>
              </article>
              <article className="admin-snapshot-item">
                <p className="admin-snapshot-label">Tokens</p>
                <p className="admin-snapshot-value">{Number(lastResult.tokenCount || 0)}</p>
              </article>
              <article className="admin-snapshot-item">
                <p className="admin-snapshot-label">Delivered</p>
                <p className="admin-snapshot-value">{Number(lastResult.successCount || 0)}</p>
              </article>
              <article className="admin-snapshot-item">
                <p className="admin-snapshot-label">Failed</p>
                <p className="admin-snapshot-value">{Number(lastResult.failureCount || 0)}</p>
              </article>
            </div>
          </Card>
        ) : null}
      </form>
    </AppShell>
  );
};

export default AdminNotificationPage;

function normalizeUser(uid, data = {}) {
  return {
    uid,
    displayName: String(data.displayName || data.username || data.email || 'Unknown User').trim(),
    username: String(data.username || '').trim(),
    email: String(data.email || '').trim(),
  };
}
