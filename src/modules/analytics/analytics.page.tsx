import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { apiClient } from '../../shared/api/client';

type ProjectOption = {
  id: number;
  name: string;
  active: boolean;
};

type ProjectAnalyticsRow = {
  slackUserId: string;
  displayName: string | null;
  email: string | null;
  projectName: string;
  daysWorked: number;
};

type ProjectAnalyticsResponse = {
  period: { from: string; to: string };
  rows: ProjectAnalyticsRow[];
};

type EmployeeSummaryRow = {
  slackUserId: string;
  displayName: string | null;
  email: string | null;
  activeDays: number;
};

type EmployeeSummaryResponse = {
  period: { from: string; to: string };
  rows: EmployeeSummaryRow[];
};

type ProjectSummaryRow = {
  projectName: string;
  activeDays: number;
};

type ProjectSummaryResponse = {
  period: { from: string; to: string };
  rows: ProjectSummaryRow[];
};

type ProjectUsersResponse = {
  period: { from: string; to: string };
  projectName: string;
  rows: ProjectAnalyticsRow[];
};

function currentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

function isValidMonth(value: string | null): value is string {
  return Boolean(value && /^\d{4}-\d{2}$/.test(value));
}

function monthToRange(month: string): { from: string; to: string } {
  const [year, mon] = month.split('-').map(Number);
  const start = new Date(year, (mon || 1) - 1, 1);
  const end = new Date(year, (mon || 1), 0);
  return {
    from: start.toISOString().slice(0, 10),
    to: end.toISOString().slice(0, 10)
  };
}

type AnalyticsFilters = {
  from: string;
  to: string;
  search?: string;
  slackUserIds?: string;
  projects?: string;
};

function compactCsv(items: string[]): string | undefined {
  const cleaned = items.map((item) => item.trim()).filter(Boolean);
  if (!cleaned.length) return undefined;
  return cleaned.join(',');
}

async function fetchProjectAnalytics(filters: AnalyticsFilters): Promise<ProjectAnalyticsResponse> {
  const response = await apiClient.get('/api/admin/analytics/projects', { params: filters });
  return response.data?.data;
}

async function fetchEmployeeSummary(filters: AnalyticsFilters): Promise<EmployeeSummaryResponse> {
  const response = await apiClient.get('/api/admin/analytics/summary/employees', { params: filters });
  return response.data?.data;
}

async function fetchProjectSummary(filters: AnalyticsFilters): Promise<ProjectSummaryResponse> {
  const response = await apiClient.get('/api/admin/analytics/summary/projects', { params: filters });
  return response.data?.data;
}

async function fetchProjectUsers(projectName: string, filters: AnalyticsFilters): Promise<ProjectUsersResponse> {
  const response = await apiClient.get(`/api/admin/analytics/projects/${encodeURIComponent(projectName)}/users`, {
    params: filters
  });
  return response.data?.data;
}

async function fetchProjects(): Promise<ProjectOption[]> {
  const response = await apiClient.get('/api/admin/projects');
  return response.data?.data || [];
}

function exportBillingCsv(rows: ProjectAnalyticsRow[]): void {
  const header = ['Project', 'Employee', 'Email', 'Slack ID', 'Days Worked'];
  const lines = rows.map((row) => [
    row.projectName,
    row.displayName || row.slackUserId,
    row.email || '',
    row.slackUserId,
    formatDayValue(row.daysWorked)
  ]);

  const csv = [header, ...lines]
    .map((line) => line.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(','))
    .join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'billing-detail.csv';
  link.click();
  URL.revokeObjectURL(url);
}

function formatDayValue(value: number): string {
  if (Number.isInteger(value)) {
    return String(value);
  }

  return value.toFixed(1);
}

export function AnalyticsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const month = isValidMonth(searchParams.get('month')) ? String(searchParams.get('month')) : currentMonth();
  const initialProjectId = (searchParams.get('projectId') || '').trim();
  const initialRange = monthToRange(month);
  const [fromDate, setFromDate] = useState(initialRange.from);
  const [toDate, setToDate] = useState(initialRange.to);
  const [search, setSearch] = useState('');
  const [selectedUserId, setSelectedUserId] = useState('all');
  const [selectedProjectId, setSelectedProjectId] = useState(initialProjectId || 'all');
  const [drillProject, setDrillProject] = useState<string | null>(null);

  const projectsQuery = useQuery({ queryKey: ['projects'], queryFn: fetchProjects });
  const projects = useMemo(() => projectsQuery.data || [], [projectsQuery.data]);
  const selectedProjectName = useMemo(() => {
    if (selectedProjectId === 'all') {
      return undefined;
    }

    const matched = projects.find((project) => String(project.id) === selectedProjectId);
    return matched?.name;
  }, [projects, selectedProjectId]);

  const filters = useMemo<AnalyticsFilters>(
    () => ({
      from: fromDate,
      to: toDate,
      search: search.trim() || undefined,
      slackUserIds: selectedUserId !== 'all' ? compactCsv([selectedUserId]) : undefined,
      projects: selectedProjectName ? compactCsv([selectedProjectName]) : undefined
    }),
    [fromDate, toDate, search, selectedUserId, selectedProjectName]
  );

  const monthForUrl = useMemo(() => fromDate.slice(0, 7), [fromDate]);

  const query = useQuery({
    queryKey: ['analytics-projects', filters],
    queryFn: () => fetchProjectAnalytics(filters)
  });

  const employeeSummaryQuery = useQuery({
    queryKey: ['analytics-summary-employees', filters],
    queryFn: () => fetchEmployeeSummary(filters)
  });

  const projectSummaryQuery = useQuery({
    queryKey: ['analytics-summary-projects', filters],
    queryFn: () => fetchProjectSummary(filters)
  });

  const projectUsersQuery = useQuery({
    queryKey: ['analytics-project-users', drillProject, filters],
    queryFn: () => fetchProjectUsers(String(drillProject), { ...filters, projects: undefined }),
    enabled: Boolean(drillProject)
  });

  const rows = useMemo(() => query.data?.rows || [], [query.data?.rows]);
  const employeeRows = useMemo(() => employeeSummaryQuery.data?.rows || [], [employeeSummaryQuery.data?.rows]);
  const projectRows = useMemo(() => projectSummaryQuery.data?.rows || [], [projectSummaryQuery.data?.rows]);

  const employeeOptions = useMemo(() => {
    const options = Array.from(new Map(employeeRows.map((row) => [row.slackUserId, row])).values());
    return options.sort((a, b) => (a.displayName || a.slackUserId).localeCompare(b.displayName || b.slackUserId));
  }, [employeeRows]);

  const projectOptions = useMemo(
    () => [...projects].sort((a, b) => a.name.localeCompare(b.name)),
    [projects]
  );

  useEffect(() => {
    if (selectedProjectId === 'all') {
      return;
    }

    const exists = projects.some((project) => String(project.id) === selectedProjectId);
    if (!exists) {
      setSelectedProjectId('all');
    }
  }, [projects, selectedProjectId]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (selectedProjectId !== 'all') {
      params.set('projectId', selectedProjectId);
    }
    params.set('month', monthForUrl);
    setSearchParams(params, { replace: true });
  }, [monthForUrl, selectedProjectId, setSearchParams]);

  const periodLabel = `${query.data?.period.from || fromDate} to ${query.data?.period.to || toDate}`;

  return (
    <section>
      <div className="section-head">
        <div>
          <h2>Analytics</h2>
          <p className="muted">Finance billing analytics (WFO/WFH = 1, Half Day = 0.5).</p>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 14 }}>
        <div className="action-row">
          <label className="inline-field">
            From
            <input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} />
          </label>
          <label className="inline-field">
            To
            <input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} />
          </label>
          <label className="inline-field">
            Employee
            <select value={selectedUserId} onChange={(event) => setSelectedUserId(event.target.value)}>
              <option value="all">All</option>
              {employeeOptions.map((row) => (
                <option key={row.slackUserId} value={row.slackUserId}>
                  {row.displayName || row.slackUserId}
                </option>
              ))}
            </select>
          </label>
          <label className="inline-field">
            Project
            <select
              value={selectedProjectId}
              onChange={(event) => {
                setSelectedProjectId(event.target.value);
                setDrillProject(null);
              }}
            >
              <option value="all">All</option>
              {projectOptions.map((project) => (
                <option key={project.id} value={String(project.id)}>
                  {project.name}
                </option>
              ))}
            </select>
          </label>
          <label className="inline-field" style={{ minWidth: 240 }}>
            Search
            <input
              type="text"
              placeholder="Name, email, project"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
          <button
            type="button"
            className="ghost-btn"
            onClick={() => {
              const resetRange = monthToRange(currentMonth());
              setFromDate(resetRange.from);
              setToDate(resetRange.to);
              setSelectedUserId('all');
              setSelectedProjectId('all');
              setSearch('');
              setDrillProject(null);
            }}
          >
            Reset
          </button>
        </div>
        <p className="muted" style={{ marginTop: 10, marginBottom: 0 }}>
          Period: {periodLabel}
        </p>
      </div>

      <div className="card table-card">
        <div className="section-head">
          <h3>Billing Detail</h3>
          <button type="button" className="ghost-btn" onClick={() => exportBillingCsv(rows)} disabled={!rows.length}>
            Export CSV
          </button>
        </div>
        {query.isLoading ? <p>Loading analytics...</p> : null}
        {query.isError ? <p>Could not load analytics data.</p> : null}

        {rows.length ? (
          <table>
            <thead>
              <tr>
                <th>Project</th>
                <th>Employee</th>
                <th>Email</th>
                <th>Slack ID</th>
                <th>Days Worked</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={`${row.projectName}:${row.slackUserId}`}>
                  <td>{row.projectName}</td>
                  <td>{row.displayName || row.slackUserId}</td>
                  <td>{row.email || '-'}</td>
                  <td>{row.slackUserId}</td>
                  <td>{formatDayValue(row.daysWorked)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          !query.isLoading && <p>No analytics data found for this month.</p>
        )}
      </div>

      <div className="grid-cards" style={{ marginTop: 14 }}>
        <div className="card table-card">
          <h3>Employee Summary</h3>
          {employeeSummaryQuery.isLoading ? <p>Loading employee summary...</p> : null}
          {employeeRows.length ? (
            <table>
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Email</th>
                  <th>Active Days</th>
                </tr>
              </thead>
              <tbody>
                {employeeRows.map((row) => (
                  <tr key={row.slackUserId}>
                    <td>{row.displayName || row.slackUserId}</td>
                    <td>{row.email || '-'}</td>
                    <td>{formatDayValue(row.activeDays)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            !employeeSummaryQuery.isLoading && <p>No employee summary rows.</p>
          )}
        </div>

        <div className="card table-card">
          <h3>Project Summary</h3>
          {projectSummaryQuery.isLoading ? <p>Loading project summary...</p> : null}
          {projectRows.length ? (
            <table>
              <thead>
                <tr>
                  <th>Project</th>
                  <th>Active Days</th>
                </tr>
              </thead>
              <tbody>
                {projectRows.map((row) => (
                  <tr key={row.projectName}>
                    <td>
                      <button
                        type="button"
                        className="link-btn"
                        onClick={() => setDrillProject((prev) => (prev === row.projectName ? null : row.projectName))}
                      >
                        {row.projectName}
                      </button>
                    </td>
                    <td>{formatDayValue(row.activeDays)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            !projectSummaryQuery.isLoading && <p>No project summary rows.</p>
          )}
        </div>
      </div>

      {drillProject ? (
        <div className="card table-card" style={{ marginTop: 14 }}>
          <h3>Project Users - {drillProject}</h3>
          {projectUsersQuery.isLoading ? <p>Loading project users...</p> : null}
          {projectUsersQuery.data?.rows?.length ? (
            <table>
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Email</th>
                  <th>Slack ID</th>
                  <th>Days Worked</th>
                </tr>
              </thead>
              <tbody>
                {projectUsersQuery.data.rows.map((row) => (
                  <tr key={`${row.projectName}:${row.slackUserId}`}>
                    <td>{row.displayName || row.slackUserId}</td>
                    <td>{row.email || '-'}</td>
                    <td>{row.slackUserId}</td>
                    <td>{formatDayValue(row.daysWorked)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            !projectUsersQuery.isLoading && <p>No users found for this project in selected period.</p>
          )}
        </div>
      ) : null}
    </section>
  );
}
