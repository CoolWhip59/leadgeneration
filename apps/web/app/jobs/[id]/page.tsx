'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000';

type JobCity = {
  id: string;
  city: { name: string };
  status: string;
  progress: number;
  total: number;
  attempt?: number;
  errorCode?: string | null;
  error?: string | null;
};

type Job = {
  id: string;
  status: string;
  progress: number;
  total: number;
  category: { name: string };
  jobCities: JobCity[];
};

type ErrorLog = {
  id: string;
  jobId: string;
  jobCityId: string;
  cityId: string;
  cityName?: string;
  errorCode: string;
  message: string;
  stack?: string | null;
  rawError?: string | null;
  createdAt: string;
  canViewStack?: boolean;
  retryable: boolean;
};

async function apiFetch(path: string, token: string, options: RequestInit = {}) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { ...headers, ...(options.headers || {}) },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || 'Request failed');
  }

  return response.json();
}

export default function JobDetailPage({ params }: { params: { id: string } }) {
  const [token, setToken] = useState<string | null>(null);
  const [job, setJob] = useState<Job | null>(null);
  const [errors, setErrors] = useState<ErrorLog[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [streamSeed, setStreamSeed] = useState(0);
  const loadErrorsTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem('token');
    if (stored) setToken(stored);
  }, []);

  const loadJob = async (jwt: string) => {
    const jobData = await apiFetch(`/jobs/${params.id}`, jwt);
    setJob(jobData);
  };

  const loadErrors = async (jwt: string) => {
    const errorLogs = await apiFetch(`/jobs/${params.id}/errors`, jwt);
    setErrors(errorLogs);
  };

  const loadAll = async (jwt: string) => {
    setLoading(true);
    try {
      await Promise.all([loadJob(jwt), loadErrors(jwt)]);
    } catch (err: any) {
      setError(err.message || 'Load failed');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!token) return;
    loadAll(token);
  }, [token]);

  useEffect(() => {
    if (!token) return;

    const streamUrl = `${API_BASE}/jobs/${params.id}/stream?token=${encodeURIComponent(token)}`;
    const source = new EventSource(streamUrl);

    source.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data) as Job;
        setJob(payload);
      } catch {
        // ignore
      }
    };

    source.addEventListener('city_error', () => {
      if (!token) return;
      if (loadErrorsTimerRef.current) return;
      loadErrorsTimerRef.current = window.setTimeout(async () => {
        loadErrorsTimerRef.current = null;
        await loadErrors(token);
      }, 750);
    });

    source.addEventListener('completed', () => {
      source.close();
    });

    source.addEventListener('failed', (event) => {
      try {
        const payload = JSON.parse((event as MessageEvent).data);
        setError(payload?.error || 'Job failed');
      } catch {
        setError('Job failed');
      }
      source.close();
    });

    source.onerror = () => {
      source.close();
    };

    return () => {
      source.close();
      if (loadErrorsTimerRef.current) {
        window.clearTimeout(loadErrorsTimerRef.current);
        loadErrorsTimerRef.current = null;
      }
    };
  }, [token, params.id, streamSeed]);

  const retry = async (jobCityId: string) => {
    if (!token) return;
    try {
      await apiFetch(`/job-cities/${jobCityId}/retry`, token, { method: 'POST' });
      await loadAll(token);
      setStreamSeed((prev) => prev + 1);
    } catch (err: any) {
      setError(err.message || 'Retry failed');
    }
  };

  const progressPercent = useMemo(() => {
    if (!job || job.total === 0) return 0;
    return Math.min(100, Math.round((job.progress / job.total) * 100));
  }, [job]);

  const retryableMap = useMemo(() => {
    const map = new Map<string, boolean>();
    for (const log of errors) {
      if (!map.has(log.jobCityId)) {
        map.set(log.jobCityId, log.retryable);
      }
    }
    return map;
  }, [errors]);

  const attemptGroups = useMemo(() => {
    if (!job) return [] as { city: string; attempts: JobCity[] }[];
    const map = new Map<string, JobCity[]>();
    for (const jc of job.jobCities) {
      const key = jc.city.name;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(jc);
    }
    return Array.from(map.entries()).map(([city, attempts]) => ({
      city,
      attempts: attempts.sort((a, b) => (a.attempt || 0) - (b.attempt || 0)),
    }));
  }, [job]);

  if (!token) {
    return (
      <main className="grid">
        <div className="panel">
          <h1>Job Detay</h1>
          <p className="muted">Lutfen giris yapin.</p>
          <Link className="secondary" href="/">Geri Don</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="grid">
      <div className="panel">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h1>Job Detay</h1>
          <Link className="secondary" href="/">Geri Don</Link>
        </div>
        {loading && <p className="muted">Yukleniyor...</p>}
        {error && <p className="muted">{error}</p>}
        {job && (
          <div>
            <p className="muted">
              Durum: {job.status} · Kategori: {job.category.name}
            </p>
            <div className="progress">
              <div className="progress-bar" style={{ width: `${progressPercent}%` }} />
            </div>
            <div className="muted" style={{ marginTop: 6 }}>
              {job.progress}/{job.total}
            </div>
          </div>
        )}
      </div>

      <div className="panel">
        <h2>Errors</h2>
        {errors.length === 0 && <p className="muted">Hata kaydi yok.</p>}
        {errors.map((log) => (
          <div key={log.id} style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <strong>{log.errorCode}</strong>
              <span className="muted">{new Date(log.createdAt).toLocaleString()}</span>
            </div>
            <div className="muted" style={{ marginTop: 4, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {log.cityName && (
                <span
                  className="badge-neutral"
                  style={{ cursor: 'pointer' }}
                  onClick={() => {
                    const target = document.getElementById(`jobcity-${log.jobCityId}`);
                    if (target) {
                      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
                      target.classList.remove('highlight-fade');
                      void target.offsetWidth;
                      target.classList.add('highlight-fade');
                    }
                  }}
                >
                  {log.cityName}
                </span>
              )}
              <span>{log.message}</span>
            </div>
            {log.canViewStack && (log.rawError || log.stack) && (
              <details style={{ marginTop: 6 }}>
                <summary className="muted">Raw error</summary>
                <pre className="muted" style={{ whiteSpace: 'pre-wrap', marginTop: 6 }}>
                  {log.rawError || log.stack}
                </pre>
              </details>
            )}
          </div>
        ))}
      </div>

      <div className="panel">
        <h2>Attempt Gecmisi</h2>
        {attemptGroups.length === 0 && <p className="muted">Kayit yok.</p>}
        {attemptGroups.map((group) => (
          <div key={group.city} style={{ marginBottom: 16 }}>
            <strong>{group.city}</strong>
            {group.attempts.map((attempt) => (
              <div id={`jobcity-${attempt.id}`} key={attempt.id} className="muted" style={{ marginTop: 6 }}>
                Attempt {attempt.attempt || 1} · {attempt.status} · {attempt.progress}/{attempt.total}
                {attempt.status === 'FAILED' && (
                  <span>
                    {' '}
                    · {attempt.errorCode || 'FAILED'}: {attempt.error || 'Bilinmeyen hata'}
                  </span>
                )}
                {attempt.status === 'FAILED' && retryableMap.get(attempt.id) && (
                  <span>
                    {' '}
                    · <button onClick={() => retry(attempt.id)}>Retry</button>
                  </span>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
    </main>
  );
}
