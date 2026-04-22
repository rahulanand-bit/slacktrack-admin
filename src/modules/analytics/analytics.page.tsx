import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { apiClient } from '../../shared/api/client';

type PeriodType = 'week' | 'month';

type AnalyticsOverviewResponse = {
  periodType: PeriodType;
  period: string;
  range: { from: string; to: string };
  kpi: {
    activeUsers: number;
    presentCount: number;
    pendingAttendance: number;
    employeesOnLeave: number;
    highLeaveEmployees: number;
    wfhHeavyEmployees: number;
    attendanceCompliancePct: number;
  };
};

type AnalyticsTrendRow = {
  dateYmd: string;
  wfoCount: number;
  wfhCount: number;
  leaveCount: number;
  halfDayCount: number;
  markedCount: number;
};

type AnalyticsTrendResponse = {
  periodType: PeriodType;
  period: string;
  range: { from: string; to: string };
  rows: AnalyticsTrendRow[];
};

type HighLeaveEmployeeRow = {
  slackUserId: string;
  displayName: string | null;
  email: string | null;
  leaveDays: number;
};

type WfhHeavyEmployeeRow = {
  slackUserId: string;
  displayName: string | null;
  email: string | null;
  wfhDays: number;
  presentDays: number;
  wfhRatioPct: number;
};

type WfoBaselineRow = {
  slackUserId: string;
  displayName: string | null;
  email: string | null;
  wfoDays: number;
  meetsBaseline: boolean;
};

type AnalyticsHrInsightsResponse = {
  periodType: PeriodType;
  period: string;
  range: { from: string; to: string };
  leaveThreshold: number;
  wfhRatioThresholdPct: number;
  baselineWfoDays: number;
  highLeaveEmployees: HighLeaveEmployeeRow[];
  wfhHeavyEmployees: WfhHeavyEmployeeRow[];
  wfoBaseline: WfoBaselineRow[];
};

type ProjectContributionRow = {
  projectName: string;
  activeDays: number;
  sharePct: number;
};

type AnalyticsFinanceResponse = {
  periodType: PeriodType;
  period: string;
  range: { from: string; to: string };
  rows: ProjectContributionRow[];
};

type ChartSlice = {
  key: string;
  label: string;
  value: number;
};

type AnalyticsChartsResponse = {
  periodType: PeriodType;
  period: string;
  range: { from: string; to: string };
  generatedAt: string;
  attendanceMix: ChartSlice[];
  workforceState: ChartSlice[];
  projectShare: ChartSlice[];
};

function todayYmd(): string {
  return new Date().toISOString().slice(0, 10);
}

function currentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

function formatYmd(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function weekRangeFromSeed(seedYmd: string): { from: string; to: string } {
  const safeSeed = /^\d{4}-\d{2}-\d{2}$/.test(seedYmd) ? seedYmd : todayYmd();
  const seedDate = new Date(`${safeSeed}T00:00:00`);
  const weekDay = seedDate.getDay();
  const diffToMonday = (weekDay + 6) % 7;
  const start = new Date(seedDate);
  start.setDate(seedDate.getDate() - diffToMonday);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return { from: formatYmd(start), to: formatYmd(end) };
}

function monthRange(monthValue: string): { from: string; to: string } {
  const safe = /^\d{4}-\d{2}$/.test(monthValue) ? monthValue : currentMonth();
  const [year, month] = safe.split('-').map(Number);
  const start = new Date(year, (month || 1) - 1, 1);
  const end = new Date(year, month || 1, 0);
  return { from: formatYmd(start), to: formatYmd(end) };
}

function formatValue(value: number, digits = 1): string {
  if (Number.isInteger(value)) {
    return String(value);
  }
  return value.toFixed(digits);
}

function formatPct(value: number): string {
  if (!Number.isFinite(value)) {
    return '0%';
  }
  return `${value.toFixed(1)}%`;
}

async function fetchOverview(params: {
  periodType: PeriodType;
  period: string;
  leaveThreshold: number;
  wfhRatioThresholdPct: number;
  minPresentDaysForWfhRatio: number;
}): Promise<AnalyticsOverviewResponse> {
  const response = await apiClient.get('/api/admin/analytics/overview', { params });
  return response.data?.data;
}

async function fetchTrend(params: { periodType: PeriodType; period: string }): Promise<AnalyticsTrendResponse> {
  const response = await apiClient.get('/api/admin/analytics/trend', { params });
  return response.data?.data;
}

async function fetchHrInsights(params: {
  periodType: PeriodType;
  period: string;
  leaveThreshold: number;
  wfhRatioThresholdPct: number;
  minPresentDaysForWfhRatio: number;
  baselineWfoDays: number;
  limit: number;
}): Promise<AnalyticsHrInsightsResponse> {
  const response = await apiClient.get('/api/admin/analytics/hr/insights', { params });
  return response.data?.data;
}

async function fetchFinanceProjectContribution(params: {
  periodType: PeriodType;
  period: string;
}): Promise<AnalyticsFinanceResponse> {
  const response = await apiClient.get('/api/admin/analytics/finance/project-contribution', { params });
  return response.data?.data;
}

async function fetchCharts(params: { periodType: PeriodType; period: string }): Promise<AnalyticsChartsResponse> {
  const response = await apiClient.get('/api/admin/analytics/charts', { params });
  return response.data?.data;
}

function DonutCard({
  title,
  slices,
  colors,
  onSliceClick
}: {
  title: string;
  slices: ChartSlice[];
  colors: string[];
  onSliceClick?: (slice: ChartSlice) => void;
}) {
  const total = slices.reduce((sum, slice) => sum + slice.value, 0);
  let cursor = 0;
  const segments: string[] = [];
  slices.forEach((slice, index) => {
    const portion = total > 0 ? (slice.value / total) * 100 : 0;
    const next = cursor + portion;
    segments.push(`${colors[index % colors.length]} ${cursor}% ${next}%`);
    cursor = next;
  });

  return (
    <div className="card">
      <h3 className="analytics-section-title">{title}</h3>
      <div className="donut-wrap">
        <div
          className="analytics-donut"
          style={{
            background:
              total > 0
                ? `conic-gradient(${segments.join(', ')})`
                : 'conic-gradient(#e6edf8 0% 100%)'
          }}
        >
          <div className="analytics-donut-center">
            <strong>{formatPct(total)}</strong>
            <span>Total</span>
          </div>
        </div>
        <div className="donut-legend">
          {slices.map((slice, index) => (
            <button
              key={slice.key}
              type="button"
              className="donut-legend-item"
              onClick={() => onSliceClick?.(slice)}
              title={`Show ${slice.label} details`}
            >
              <i style={{ background: colors[index % colors.length] }} />
              <span>{slice.label}</span>
              <strong>{formatPct(slice.value)}</strong>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export function AnalyticsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialPeriodType: PeriodType = searchParams.get('periodType') === 'week' ? 'week' : 'month';
  const initialPeriod =
    (searchParams.get('period') || '').trim() || (initialPeriodType === 'week' ? todayYmd() : currentMonth());

  const [periodType, setPeriodType] = useState<PeriodType>(initialPeriodType);
  const [period, setPeriod] = useState(initialPeriod);
  const [focus, setFocus] = useState((searchParams.get('focus') || '').trim());
  const highLeaveRef = useRef<HTMLDivElement | null>(null);
  const wfhHeavyRef = useRef<HTMLDivElement | null>(null);
  const trendRef = useRef<HTMLDivElement | null>(null);
  const baselineRef = useRef<HTMLDivElement | null>(null);
  const financeRef = useRef<HTMLDivElement | null>(null);

  const leaveThreshold = 2;
  const wfhRatioThresholdPct = 70;
  const minPresentDaysForWfhRatio = 3;
  const baselineWfoDays = 3;

  useEffect(() => {
    const params = new URLSearchParams();
    params.set('periodType', periodType);
    params.set('period', period);
    if (focus) {
      params.set('focus', focus);
    }
    setSearchParams(params, { replace: true });
  }, [periodType, period, focus, setSearchParams]);

  const overviewQuery = useQuery({
    queryKey: ['analytics-overview', periodType, period, leaveThreshold, wfhRatioThresholdPct, minPresentDaysForWfhRatio],
    queryFn: () =>
      fetchOverview({
        periodType,
        period,
        leaveThreshold,
        wfhRatioThresholdPct,
        minPresentDaysForWfhRatio
      })
  });

  const trendQuery = useQuery({
    queryKey: ['analytics-trend', periodType, period],
    queryFn: () => fetchTrend({ periodType, period })
  });

  const hrInsightsQuery = useQuery({
    queryKey: [
      'analytics-hr-insights',
      periodType,
      period,
      leaveThreshold,
      wfhRatioThresholdPct,
      minPresentDaysForWfhRatio,
      baselineWfoDays
    ],
    queryFn: () =>
      fetchHrInsights({
        periodType,
        period,
        leaveThreshold,
        wfhRatioThresholdPct,
        minPresentDaysForWfhRatio,
        baselineWfoDays,
        limit: 20
      })
  });

  const financeQuery = useQuery({
    queryKey: ['analytics-finance-project-contribution', periodType, period],
    queryFn: () => fetchFinanceProjectContribution({ periodType, period })
  });

  const chartsQuery = useQuery({
    queryKey: ['analytics-charts', periodType, period],
    queryFn: () => fetchCharts({ periodType, period })
  });

  const loading =
    overviewQuery.isLoading ||
    trendQuery.isLoading ||
    hrInsightsQuery.isLoading ||
    financeQuery.isLoading ||
    chartsQuery.isLoading;
  const hasError =
    overviewQuery.isError ||
    trendQuery.isError ||
    hrInsightsQuery.isError ||
    financeQuery.isError ||
    chartsQuery.isError;

  const overview = overviewQuery.data;
  const trendRows = trendQuery.data?.rows || [];
  const hrInsights = hrInsightsQuery.data;
  const financeRows = financeQuery.data?.rows || [];
  const charts = chartsQuery.data;

  const rangeLabel = overview ? `${overview.range.from} to ${overview.range.to}` : '-';
  const presentLabel = periodType === 'week' ? 'Present In Week' : 'Present In Period';

  const localRange = periodType === 'week' ? weekRangeFromSeed(period) : monthRange(period);

  useEffect(() => {
    if (!focus || loading) return;
    if (focus === 'high-leave' && highLeaveRef.current) {
      highLeaveRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    if (focus === 'wfh-heavy' && wfhHeavyRef.current) {
      wfhHeavyRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    if (focus === 'trend' && trendRef.current) {
      trendRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    if (focus === 'wfo-baseline' && baselineRef.current) {
      baselineRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    if (focus === 'finance' && financeRef.current) {
      financeRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [focus, loading]);

  return (
    <section>
      <div className="section-head">
        <div>
          <h2>Analytics</h2>
          <p className="muted">HR and finance attendance analytics with compliance insights.</p>
        </div>
        <div className="action-row">
          <label className="inline-field">
            Period
            <select
              value={periodType}
              onChange={(event) => {
                const next = event.target.value === 'week' ? 'week' : 'month';
                setPeriodType(next);
                setPeriod(next === 'week' ? todayYmd() : currentMonth());
              }}
            >
              <option value="month">Monthly</option>
              <option value="week">Weekly</option>
            </select>
          </label>
          <label className="inline-field">
            {periodType === 'week' ? 'Week Seed Date' : 'Month'}
            {periodType === 'week' ? (
              <input type="date" value={period} onChange={(event) => setPeriod(event.target.value)} />
            ) : (
              <input type="month" value={period} onChange={(event) => setPeriod(event.target.value)} />
            )}
          </label>
        </div>
      </div>

      <p className="muted" style={{ marginTop: 8 }}>
        Range: {rangeLabel}
      </p>
      <p className="muted" style={{ marginTop: 0 }}>
        Thresholds: High leave {leaveThreshold}+ days, WFH-heavy {wfhRatioThresholdPct}%+, WFO baseline {baselineWfoDays}
        days/week.
      </p>

      {loading ? <p>Loading analytics...</p> : null}
      {hasError ? <p>Could not load analytics data.</p> : null}

      <div className="grid-cards">
        <article className="card stat-card mint">
          <span>{presentLabel}</span>
          <strong>{overview?.kpi.presentCount ?? '-'}</strong>
        </article>
        <article className="card stat-card sun">
          <span>Pending Attendance</span>
          <strong>{overview?.kpi.pendingAttendance ?? '-'}</strong>
        </article>
        <article className="card stat-card rose">
          <span>Employees on Leave</span>
          <strong>{overview?.kpi.employeesOnLeave ?? '-'}</strong>
        </article>
        <article className="card stat-card sky kpi-clickable" onClick={() => setFocus('high-leave')}>
          <span>High Leave Employees</span>
          <strong>{overview?.kpi.highLeaveEmployees ?? '-'}</strong>
        </article>
        <article className="card stat-card sky kpi-clickable" onClick={() => setFocus('wfh-heavy')}>
          <span>WFH-heavy Employees</span>
          <strong>{overview?.kpi.wfhHeavyEmployees ?? '-'}</strong>
        </article>
        <article className="card stat-card mint">
          <span>Attendance Compliance %</span>
          <strong>{overview ? `${formatValue(overview.kpi.attendanceCompliancePct)}%` : '-'}</strong>
        </article>
      </div>

      <div className="grid-cards" style={{ marginTop: 14 }}>
        <DonutCard
          title="Attendance Mix"
          slices={charts?.attendanceMix || []}
          colors={['#4db88a', '#5fa7ea', '#f2be66', '#a785db']}
          onSliceClick={(slice) => {
            if (slice.key === 'LEAVE') setFocus('high-leave');
            else if (slice.key === 'WFH') setFocus('wfh-heavy');
            else if (slice.key === 'WFO') setFocus('wfo-baseline');
            else setFocus('trend');
          }}
        />
        <DonutCard
          title="Workforce State"
          slices={charts?.workforceState || []}
          colors={['#4db88a', '#f59e0b', '#ef7f7f']}
          onSliceClick={(slice) => {
            if (slice.key === 'LEAVE') setFocus('high-leave');
            else if (slice.key === 'PENDING') setFocus('trend');
            else setFocus('wfo-baseline');
          }}
        />
        <DonutCard
          title="Project Share"
          slices={charts?.projectShare || []}
          colors={['#1b73dd', '#0eb39b', '#7f82f7', '#f59e0b', '#d5658f', '#94a3b8']}
          onSliceClick={() => setFocus('finance')}
        />
      </div>

      <p className="muted" style={{ marginTop: 8 }}>
        Data generated at: {charts?.generatedAt ? new Date(charts.generatedAt).toLocaleString() : '-'}
      </p>

      <div className="card table-card" style={{ marginTop: 14 }} ref={trendRef}>
        <h3 className="analytics-section-title">Attendance Trend</h3>
        <div className="analytics-legend">
          <span>
            <i className="seg-wfo" />
            WFO
          </span>
          <span>
            <i className="seg-wfh" />
            WFH
          </span>
          <span>
            <i className="seg-leave" />
            Leave
          </span>
          <span>
            <i className="seg-halfday" />
            Half Day
          </span>
        </div>
        {trendRows.length ? (
          <div className="analytics-trend-list">
            {trendRows.map((row) => {
              const total = row.wfoCount + row.wfhCount + row.leaveCount + row.halfDayCount;
              const wfoWidth = total > 0 ? (row.wfoCount / total) * 100 : 0;
              const wfhWidth = total > 0 ? (row.wfhCount / total) * 100 : 0;
              const leaveWidth = total > 0 ? (row.leaveCount / total) * 100 : 0;
              const halfDayWidth = total > 0 ? (row.halfDayCount / total) * 100 : 0;
              return (
                <div key={row.dateYmd} className="analytics-trend-row">
                  <span className="analytics-trend-date">{row.dateYmd}</span>
                  <div className="analytics-trend-bar">
                    <span className="seg-wfo" style={{ width: `${wfoWidth}%` }} />
                    <span className="seg-wfh" style={{ width: `${wfhWidth}%` }} />
                    <span className="seg-leave" style={{ width: `${leaveWidth}%` }} />
                    <span className="seg-halfday" style={{ width: `${halfDayWidth}%` }} />
                  </div>
                  <span className="analytics-trend-meta">
                    WFO {row.wfoCount} | WFH {row.wfhCount} | Leave {row.leaveCount} | Half {row.halfDayCount}
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          !loading && <p>No trend data found for selected period.</p>
        )}
      </div>

      <div className="grid-cards" style={{ marginTop: 14 }}>
        <div className="card table-card" ref={highLeaveRef}>
          <h3 className="analytics-section-title">HR: High Leave Employees</h3>
          {hrInsights?.highLeaveEmployees.length ? (
            <table>
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Email</th>
                  <th>Leave Days</th>
                </tr>
              </thead>
              <tbody>
                {hrInsights.highLeaveEmployees.map((row) => (
                  <tr key={row.slackUserId}>
                    <td>{row.displayName || row.slackUserId}</td>
                    <td>{row.email || '-'}</td>
                    <td>{row.leaveDays}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            !loading && <p>No employees crossed leave threshold in this period.</p>
          )}
        </div>

        <div className="card table-card" ref={wfhHeavyRef}>
          <h3 className="analytics-section-title">HR: WFH-heavy Employees</h3>
          {hrInsights?.wfhHeavyEmployees.length ? (
            <table>
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>WFH Days</th>
                  <th>Present Days</th>
                  <th>WFH Ratio</th>
                </tr>
              </thead>
              <tbody>
                {hrInsights.wfhHeavyEmployees.map((row) => (
                  <tr key={row.slackUserId}>
                    <td>{row.displayName || row.slackUserId}</td>
                    <td>{row.wfhDays}</td>
                    <td>{row.presentDays}</td>
                    <td>{formatValue(row.wfhRatioPct)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            !loading && <p>No WFH-heavy employees in selected period.</p>
          )}
        </div>
      </div>

      <div className="card table-card" style={{ marginTop: 14 }} ref={baselineRef}>
        <h3 className="analytics-section-title">HR: WFO Baseline (3 Days/Week)</h3>
        {hrInsights?.wfoBaseline.length ? (
          <table>
            <thead>
              <tr>
                <th>Employee</th>
                <th>Email</th>
                <th>WFO Days ({localRange.from} to {localRange.to})</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {hrInsights.wfoBaseline.map((row) => (
                <tr key={row.slackUserId}>
                  <td>{row.displayName || row.slackUserId}</td>
                  <td>{row.email || '-'}</td>
                  <td>{row.wfoDays}</td>
                  <td>
                    <span className={`pill ${row.meetsBaseline ? 'on' : 'off'}`}>
                      {row.meetsBaseline ? 'Meets Baseline' : 'Below Baseline'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          !loading && <p>No baseline rows available for selected period.</p>
        )}
      </div>

      <div className="card table-card" style={{ marginTop: 14 }} ref={financeRef}>
        <h3 className="analytics-section-title">Finance: Project Contribution</h3>
        {financeRows.length ? (
          <div className="analytics-project-bars">
            {financeRows.map((row) => (
              <div key={row.projectName} className="analytics-project-row">
                <div className="analytics-project-label">{row.projectName}</div>
                <div className="analytics-project-track">
                  <div className="analytics-project-fill" style={{ width: `${row.sharePct}%` }} />
                </div>
                <div className="analytics-project-value">
                  {formatValue(row.activeDays)} days ({formatValue(row.sharePct)}%)
                </div>
              </div>
            ))}
          </div>
        ) : (
          !loading && <p>No project contribution data found.</p>
        )}
      </div>
    </section>
  );
}
