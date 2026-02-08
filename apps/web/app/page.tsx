'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000';

type City = { id: string; name: string };

type Category = { id: string; name: string };

type JobCity = {
  id: string;
  status: string;
  progress: number;
  total: number;
  city: City;
  errorCode?: string | null;
  error?: string | null;
};

type Job = {
  id: string;
  status: string;
  progress: number;
  total: number;
  category: Category;
  jobCities: JobCity[];
  createdAt: string;
  error?: string | null;
};

type Business = {
  id: string;
  name: string;
  address: string;
  phone?: string;
  websiteUrl?: string;
  googleMapsUrl: string;
  rating?: number;
  city: City;
  category: Category;
  websiteStatus: string;
};

type CityError = {
  jobCityId: string;
  city?: string;
  errorCode?: string;
  error?: string;
};

async function apiFetch(path: string, token?: string, options: RequestInit = {}) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { ...headers, ...(options.headers || {}) },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || 'Request failed');
  }

  if (response.headers.get('Content-Type')?.includes('text/csv')) {
    return response.text();
  }

  return response.json();
}

export default function Page() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [token, setToken] = useState<string | null>(null);
  const [cities, setCities] = useState<City[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [jobCityIds, setJobCityIds] = useState<string[]>([]);
  const [jobCategoryId, setJobCategoryId] = useState('');
  const [filterCityId, setFilterCityId] = useState('');
  const [filterCategoryId, setFilterCategoryId] = useState('');
  const [search, setSearch] = useState('');
  const [noWebsiteOnly, setNoWebsiteOnly] = useState(true);
  const [error, setError] = useState('');
  const [streamJobId, setStreamJobId] = useState<string | null>(null);
  const [streamJob, setStreamJob] = useState<Job | null>(null);
  const [cityErrors, setCityErrors] = useState<CityError[]>([]);

  useEffect(() => {
    const stored = localStorage.getItem('token');
    if (stored) setToken(stored);
  }, []);

  useEffect(() => {
    if (!token) return;
    Promise.all([apiFetch('/cities'), apiFetch('/categories')])
      .then(([cityList, categoryList]) => {
        setCities(cityList);
        setCategories(categoryList);
      })
      .catch((err) => setError(err.message));
  }, [token]);

  useEffect(() => {
    if (!token || !streamJobId) return;

    setCityErrors([]);

    const streamUrl = `${API_BASE}/jobs/${streamJobId}/stream?token=${encodeURIComponent(token)}`;
    const source = new EventSource(streamUrl);

    source.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        setStreamJob(payload);
      } catch {
        // ignore malformed packets
      }
    };

    source.addEventListener('city_error', (event) => {
      try {
        const payload = JSON.parse((event as MessageEvent).data) as CityError;
        setCityErrors((prev) => [...prev, payload]);
      } catch {
        // ignore
      }
    });

    source.addEventListener('completed', () => {
      loadJobs();
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
    };
  }, [token, streamJobId]);

  const loadJobs = async () => {
    if (!token) return;
    const data = await apiFetch('/jobs', token);
    setJobs(data);
  };

  const loadBusinesses = async () => {
    if (!token) return;
    const params = new URLSearchParams();
    if (filterCityId) params.set('cityId', filterCityId);
    if (filterCategoryId) params.set('categoryId', filterCategoryId);
    if (search) params.set('search', search);
    if (noWebsiteOnly) params.set('noWebsite', '1');
    const data = await apiFetch(`/businesses?${params.toString()}`, token);
    setBusinesses(data);
  };

  const login = async (mode: 'login' | 'register') => {
    setError('');
    try {
      const data = await apiFetch(`/auth/${mode}`, undefined, {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      setToken(data.accessToken);
      localStorage.setItem('token', data.accessToken);
    } catch (err: any) {
      setError(err.message || 'Auth failed');
    }
  };

  const createJob = async () => {
    if (!token || jobCityIds.length === 0 || !jobCategoryId) return;
    await apiFetch('/jobs', token, {
      method: 'POST',
      body: JSON.stringify({ cityIds: jobCityIds, categoryId: jobCategoryId }),
    });
    await loadJobs();
  };

  const exportCsv = async () => {
    if (!token) return;
    const params = new URLSearchParams();
    if (filterCityId) params.set('cityId', filterCityId);
    if (filterCategoryId) params.set('categoryId', filterCategoryId);
    if (search) params.set('search', search);
    if (noWebsiteOnly) params.set('noWebsite', '1');
    const csv = await apiFetch(`/businesses/export?${params.toString()}`, token);
    const blob = new Blob([csv as string], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'businesses.csv';
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const statusBadge = useMemo(() => {
    if (!noWebsiteOnly) return 'Tumu';
    return 'Websitesi yok';
  }, [noWebsiteOnly]);

  const progressPercent = (progress: number, total: number) => {
    if (!total) return 0;
    return Math.min(100, Math.round((progress / total) * 100));
  };

  if (!token) {
    return (
      <main className="grid">
        <div className="panel">
          <h1>Isletme Lead Sistemi</h1>
          <p className="muted">JWT ile giris yapin veya kaydolun.</p>
          <div className="grid grid-2">
            <div>
              <label>Email</label>
              <input value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div>
              <label>Sifre</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
          </div>
          <div className="actions" style={{ marginTop: 16 }}>
            <button onClick={() => login('login')}>Giris</button>
            <button className="secondary" onClick={() => login('register')}>Kaydol</button>
          </div>
          {error && <p className="muted">{error}</p>}
        </div>
      </main>
    );
  }

  return (
    <main className="grid">
      <div className="panel">
        <h1>Lead Dashboard</h1>
        <p className="muted">Sehir + sektor sec, kuyruga ekle ve ilerlemeyi izle.</p>
        <div className="grid grid-2">
          <div>
            <label>Sehirler (multi)</label>
            <select
              multiple
              value={jobCityIds}
              onChange={(e) =>
                setJobCityIds(Array.from(e.target.selectedOptions).map((opt) => opt.value))
              }
              size={Math.min(6, Math.max(3, cities.length))}
            >
              {cities.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label>Sektor</label>
            <select value={jobCategoryId} onChange={(e) => setJobCategoryId(e.target.value)}>
              <option value="">Seciniz</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="actions" style={{ marginTop: 16 }}>
          <button onClick={createJob}>Taramayi Baslat</button>
          <button className="secondary" onClick={loadJobs}>Joblari Yenile</button>
        </div>
      </div>

      <div className="panel">
        <h2>Aktif Joblar</h2>
        <table className="table">
          <thead>
            <tr>
              <th>Sehirler</th>
              <th>Sektor</th>
              <th>Durum</th>
              <th>Progress</th>
              <th>Takip</th>
              <th>Detay</th>
            </tr>
          </thead>
          <tbody>
            {jobs.map((job) => (
              <tr key={job.id}>
                <td>{job.jobCities.map((jc) => jc.city.name).join(', ')}</td>
                <td>{job.category.name}</td>
                <td>{job.status}</td>
                <td>
                  {job.progress}/{job.total}
                </td>
                <td>
                  <button className="secondary" onClick={() => setStreamJobId(job.id)}>
                    Canli
                  </button>
                </td>
                <td>
                  <Link className="secondary" href={`/jobs/${job.id}`}>
                    Detay
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {streamJob && (
        <div className="panel">
          <h2>Canli Progress</h2>
          <p className="muted">
            Job: {streamJob.category.name} · Durum: {streamJob.status}
          </p>
          <div className="progress">
            <div
              className="progress-bar"
              style={{ width: `${progressPercent(streamJob.progress, streamJob.total)}%` }}
            />
          </div>
          <div className="muted" style={{ marginTop: 6 }}>
            {streamJob.progress}/{streamJob.total}
          </div>

          <div style={{ marginTop: 16 }}>
            {streamJob.jobCities.map((jc) => (
              <div key={jc.id} style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <strong>{jc.city.name}</strong>
                  <span className="muted">
                    {jc.progress}/{jc.total}
                  </span>
                </div>
                <div className="progress">
                  <div
                    className="progress-bar"
                    style={{ width: `${progressPercent(jc.progress, jc.total)}%` }}
                  />
                </div>
                {jc.status === 'FAILED' && (
                  <div className="muted" style={{ marginTop: 4 }}>
                    {jc.errorCode || 'FAILED'}: {jc.error || 'Bilinmeyen hata'}
                  </div>
                )}
              </div>
            ))}
          </div>

          {cityErrors.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <h3 style={{ margin: '0 0 8px' }}>Sehir Hatalari</h3>
              {cityErrors.map((ce) => (
                <div key={ce.jobCityId} className="muted" style={{ marginBottom: 6 }}>
                  {ce.city || 'Sehir'} · {ce.errorCode || 'FAILED'} · {ce.error || 'Bilinmeyen hata'}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="panel">
        <h2>Isletme Sonuclari</h2>
        <div className="grid grid-2">
          <div>
            <label>Arama</label>
            <input value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div>
            <label>Sehir (filtre)</label>
            <select value={filterCityId} onChange={(e) => setFilterCityId(e.target.value)}>
              <option value="">Tum sehirler</option>
              {cities.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="grid grid-2" style={{ marginTop: 12 }}>
          <div>
            <label>Filtre</label>
            <select value={noWebsiteOnly ? 'no' : 'all'} onChange={(e) => setNoWebsiteOnly(e.target.value === 'no')}>
              <option value="no">Websitesi olmayanlar</option>
              <option value="all">Tumu</option>
            </select>
          </div>
          <div>
            <label>Sektor (filtre)</label>
            <select value={filterCategoryId} onChange={(e) => setFilterCategoryId(e.target.value)}>
              <option value="">Tum sektorler</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="actions" style={{ marginTop: 16 }}>
          <button onClick={loadBusinesses}>Sonuclari Getir</button>
          <button className="secondary" onClick={exportCsv}>CSV Export</button>
          <span className="badge">{statusBadge}</span>
        </div>
        <table className="table" style={{ marginTop: 16 }}>
          <thead>
            <tr>
              <th>Isletme</th>
              <th>Adres</th>
              <th>Telefon</th>
              <th>Website</th>
              <th>Durum</th>
            </tr>
          </thead>
          <tbody>
            {businesses.map((b) => (
              <tr key={b.id}>
                <td>{b.name}</td>
                <td>{b.address}</td>
                <td>{b.phone || '-'}</td>
                <td className="muted">{b.websiteUrl || 'Yok'}</td>
                <td>
                  {b.websiteStatus !== 'OK' ? (
                    <span className="badge">Websitesi yok</span>
                  ) : (
                    'OK'
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
