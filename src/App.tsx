import { useState, useEffect, useCallback, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Calendar from 'react-calendar';
import Modal from 'react-modal';
import { format } from 'date-fns';
import * as XLSX from 'xlsx';
import { Document, Packer, Paragraph, TextRun } from 'docx';
import jsPDF from 'jspdf';
import type { User } from '@supabase/supabase-js';
import 'react-calendar/dist/Calendar.css';
import './App.css';
import Login from './pages/Login.tsx';
import Register from './pages/Register.tsx';
import ForgotPassword from './pages/ForgotPassword.tsx';
import { supabase } from './supabase.ts';

interface WorkEntry {
  id: string;
  hours: number;
  minutes: number;
  description: string;
}

type WorkLogs = Record<string, WorkEntry[]>;

const LS_KEY = 'worklog_data';
const saveLocal = (data: WorkLogs) => localStorage.setItem(LS_KEY, JSON.stringify(data));
const loadLocal = (): WorkLogs => {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || '{}'); }
  catch { return {}; }
};

Modal.setAppElement('#root');

function LoadingScreen() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 40, marginBottom: 16 }}>📋</div>
        <div style={{ fontSize: 14, color: 'var(--text-muted)', fontWeight: 600 }}>Loading WorkLog…</div>
      </div>
    </div>
  );
}

function WorkLogApp({ user }: { user: User }) {
  const [workLogs, setWorkLogs] = useState<WorkLogs>(loadLocal);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [newHours, setNewHours] = useState(0);
  const [newMinutes, setNewMinutes] = useState(0);
  const [newDescription, setNewDescription] = useState('');
  const [dark, setDark] = useState(() => localStorage.getItem('theme') === 'dark');
  const [online, setOnline] = useState(navigator.onLine);
  const [syncing, setSyncing] = useState(false);
  const [username, setUsername] = useState('');
  const [showUserMenu, setShowUserMenu] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editHours, setEditHours] = useState(0);
  const [editMinutes, setEditMinutes] = useState(0);
  const [editDescription, setEditDescription] = useState('');

  // ── Theme ──────────────────────────────────────────────
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
    localStorage.setItem('theme', dark ? 'dark' : 'light');
  }, [dark]);

  // ── Online / offline ───────────────────────────────────
  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => { window.removeEventListener('online', up); window.removeEventListener('offline', down); };
  }, []);

  // ── Close user menu on outside click ──────────────────
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node))
        setShowUserMenu(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // ── Load profile ───────────────────────────────────────
  useEffect(() => {
    supabase.from('profiles').select('username').eq('id', user.id).single()
      .then(({ data }) => { if (data?.username) setUsername(data.username); });
  }, [user.id]);

  // ── Load from Supabase ─────────────────────────────────
  const loadFromSupabase = useCallback(async () => {
    if (!navigator.onLine) return;
    setSyncing(true);
    try {
      const { data, error } = await supabase.from('work_entries').select('*').eq('user_id', user.id);
      if (error) throw error;
      const rebuilt: WorkLogs = {};
      for (const row of data) {
        if (!rebuilt[row.date_key]) rebuilt[row.date_key] = [];
        rebuilt[row.date_key].push({ id: row.id, hours: row.hours, minutes: row.minutes, description: row.description });
      }
      setWorkLogs(rebuilt);
      saveLocal(rebuilt);
    } catch (e) {
      console.warn('Load failed, using local data', e);
    } finally {
      setSyncing(false);
    }
  }, [user.id]);

  useEffect(() => { loadFromSupabase(); }, [loadFromSupabase]);
  useEffect(() => { if (online) loadFromSupabase(); }, [online, loadFromSupabase]);

  // ── Add / Delete ───────────────────────────────────────
  const addEntry = async () => {
    if (!selectedDate || (newHours === 0 && newMinutes === 0) || !newDescription.trim()) return;
    const dateKey = format(selectedDate, 'yyyy-MM-dd');
    const entry: WorkEntry = { id: Date.now().toString(), hours: newHours, minutes: newMinutes, description: newDescription.trim() };
    const updated = { ...workLogs, [dateKey]: [...(workLogs[dateKey] || []), entry] };
    setWorkLogs(updated); saveLocal(updated);
    setNewHours(0); setNewMinutes(0); setNewDescription('');
    if (navigator.onLine) {
      const { error } = await supabase.from('work_entries').insert({ id: entry.id, date_key: dateKey, hours: entry.hours, minutes: entry.minutes, description: entry.description, user_id: user.id });
      if (error) console.warn('Insert failed:', error.message);
    }
  };

  const deleteEntry = async (dateKey: string, id: string) => {
    const list = workLogs[dateKey].filter(e => e.id !== id);
    const updated: WorkLogs = list.length === 0
      ? (() => { const { [dateKey]: _, ...rest } = workLogs; return rest; })()
      : { ...workLogs, [dateKey]: list };
    setWorkLogs(updated); saveLocal(updated);
    if (navigator.onLine) {
      await supabase.from('work_entries').delete().eq('id', id).eq('user_id', user.id);
    }
  };

  const startEdit = (entry: WorkEntry) => {
    setEditingId(entry.id);
    setEditHours(entry.hours);
    setEditMinutes(entry.minutes);
    setEditDescription(entry.description);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditHours(0);
    setEditMinutes(0);
    setEditDescription('');
  };

  const saveEdit = async (dateKey: string) => {
    if (!editingId || (!editHours && !editMinutes) || !editDescription.trim()) return;
    const updated: WorkLogs = {
      ...workLogs,
      [dateKey]: workLogs[dateKey].map(e =>
        e.id === editingId
          ? { ...e, hours: editHours, minutes: editMinutes, description: editDescription.trim() }
          : e
      ),
    };
    setWorkLogs(updated);
    saveLocal(updated);
    if (navigator.onLine) {
      const { error } = await supabase.from('work_entries')
        .update({ hours: editHours, minutes: editMinutes, description: editDescription.trim() })
        .eq('id', editingId).eq('user_id', user.id);
      if (error) console.warn('Update failed:', error.message);
    }
    cancelEdit();
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem(LS_KEY);
  };

  // ── Calendar ───────────────────────────────────────────
  const TARGET = 8 * 60;
  const getDayMins = (k: string) => (workLogs[k] || []).reduce((s, e) => s + e.hours * 60 + e.minutes, 0);

  const tileClassName = ({ date, view }: { date: Date; view: string }) => {
    if (view !== 'month') return null;
    const k = format(date, 'yyyy-MM-dd');
    if (!workLogs[k]?.length) return 'worklog-missing';
    return getDayMins(k) >= TARGET ? 'worklog-complete' : 'worklog-partial';
  };

  const tileContent = ({ date, view }: { date: Date; view: string }) => {
    if (view !== 'month') return null;
    const k = format(date, 'yyyy-MM-dd');
    if (!workLogs[k]?.length) return null;
    const mins = getDayMins(k);
    const h = Math.floor(mins / 60), m = mins % 60;
    const prog = Math.min(mins / TARGET, 1);
    const done = prog >= 1;
    const r = 9, circ = 2 * Math.PI * r;
    const fill = done ? '#16a34a' : '#d97706';
    return (
      <div className="tile-content">
        <svg className="tile-ring" viewBox="0 0 26 26" width="26" height="26">
          <circle cx="13" cy="13" r={r} fill="none" stroke="rgba(0,0,0,0.1)" strokeWidth="2.5" />
          <circle cx="13" cy="13" r={r} fill="none" stroke={fill} strokeWidth="2.5"
            strokeDasharray={circ} strokeDashoffset={circ * (1 - prog)}
            strokeLinecap="round" transform="rotate(-90 13 13)" />
          <text x="13" y="17" textAnchor="middle" fontSize="9" fill={fill} fontWeight="bold">{done ? '✓' : '⏱'}</text>
        </svg>
        <span className="tile-hours">{h}h{m > 0 ? ` ${m}m` : ''}</span>
      </div>
    );
  };

  // ── Exports ────────────────────────────────────────────
  const exportToExcel = () => {
    const data = [
      { Date: `User: ${username}`, Total: '', Entries: '' },
      { Date: '', Total: '', Entries: '' },
      ...Object.entries(workLogs).map(([date, entries]) => {
        const t = entries.reduce((s, e) => s + e.hours * 60 + e.minutes, 0);
        return { Date: date, Total: `${Math.floor(t / 60)}h ${t % 60}m`, Entries: entries.map(e => `${e.hours}h ${e.minutes}m: ${e.description}`).join('; ') };
      }),
    ];
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'WorkLogs');
    XLSX.writeFile(wb, `worklogs_${username}.xlsx`);
  };

  const exportToWord = () => {
    const sections = [
      new Paragraph({ children: [new TextRun({ text: `Work Log Report`, bold: true, size: 32 })] }),
      new Paragraph({ children: [new TextRun({ text: `User: ${username}`, italics: true })] }),
      new Paragraph({ children: [new TextRun('')] }),
      ...Object.entries(workLogs).flatMap(([date, entries]) => {
        const t = entries.reduce((s, e) => s + e.hours * 60 + e.minutes, 0);
        return [
          new Paragraph({ children: [new TextRun({ text: `Date: ${date}`, bold: true })] }),
          new Paragraph({ children: [new TextRun({ text: `Total: ${Math.floor(t / 60)}h ${t % 60}m`, italics: true })] }),
          ...entries.map(e => new Paragraph({ children: [new TextRun(`  • ${e.hours}h ${e.minutes}m — ${e.description}`)] })),
          new Paragraph({ children: [new TextRun('')] }),
        ];
      }),
    ];
    const doc = new Document({ sections: [{ children: sections }] });
    Packer.toBlob(doc).then(blob => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `worklogs_${username}.docx`; a.click();
      URL.revokeObjectURL(url);
    });
  };

  const exportToPDF = () => {
    const doc = new jsPDF();
    let y = 20;
    const line = (text: string, indent = 0, bold = false) => {
      doc.setFont('helvetica', bold ? 'bold' : 'normal');
      doc.setFontSize(bold ? 12 : 10);
      doc.text(text, 14 + indent, y);
      y += bold ? 8 : 6;
      if (y > 270) { doc.addPage(); y = 20; }
    };
    // Header
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.text('Work Log Report', 14, y); y += 10;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.text(`User: ${username}`, 14, y); y += 6;
    doc.text(`Generated: ${format(new Date(), 'MMMM d, yyyy')}`, 14, y); y += 12;
    doc.setLineWidth(0.3);
    doc.line(14, y, 196, y); y += 8;

    Object.entries(workLogs).forEach(([date, entries]) => {
      const t = entries.reduce((s, e) => s + e.hours * 60 + e.minutes, 0);
      line(`${date}  —  Total: ${Math.floor(t / 60)}h ${t % 60}m`, 0, true);
      entries.forEach(e => line(`• ${e.hours}h ${e.minutes}m  ${e.description}`, 4));
      y += 4;
    });

    doc.save(`worklogs_${username}.pdf`);
  };

  // ── Stats ──────────────────────────────────────────────
  const daysLogged = Object.keys(workLogs).length;
  const totalMinsAll = Object.values(workLogs).flat().reduce((s, e) => s + e.hours * 60 + e.minutes, 0);

  const selKey = selectedDate ? format(selectedDate, 'yyyy-MM-dd') : '';
  const entries = selKey ? workLogs[selKey] || [] : [];
  const selMins = entries.reduce((s, e) => s + e.hours * 60 + e.minutes, 0);
  const canAdd = (newHours > 0 || newMinutes > 0) && newDescription.trim().length > 0;
  const closeModal = () => { setShowModal(false); setNewHours(0); setNewMinutes(0); setNewDescription(''); };

  return (
    <div className="app">
      {/* ── Header ── */}
      <header className="app-header">
        <div className="header-brand">
          <div className="header-logo">📋</div>
          <span className="header-title">WorkLog</span>
        </div>
        <div className="header-right">
          {/* Stats — hidden on small screens */}
          <div className="header-stats">
            <div className="stat-pill">
              <span className="stat-pill-dot green" />
              <span><span className="stat-pill-value">{daysLogged}</span> days</span>
            </div>
            <div className="stat-pill">
              <span className="stat-pill-dot indigo" />
              <span><span className="stat-pill-value">{Math.floor(totalMinsAll / 60)}h {totalMinsAll % 60}m</span></span>
            </div>
            <div className={`sync-status ${online ? 'online' : 'offline'}`}>
              {syncing ? '⟳' : online ? '☁' : '⚡'}
              <span className="sync-label">{syncing ? 'Syncing' : online ? 'Cloud' : 'Offline'}</span>
            </div>
          </div>

          {/* Theme toggle */}
          <button className="theme-toggle" onClick={() => setDark(d => !d)} title={dark ? 'Light mode' : 'Dark mode'}>
            {dark ? '☀️' : '🌙'}
          </button>

          {/* User avatar menu */}
          <div className="user-menu-wrap" ref={userMenuRef}>
            <button className="user-avatar-btn" onClick={() => setShowUserMenu(v => !v)} title="Account">
              <span className="avatar-initials">{username ? username[0].toUpperCase() : '?'}</span>
            </button>
            {showUserMenu && (
              <div className="user-dropdown">
                <div className="user-dropdown-header">
                  <div className="user-dropdown-avatar">{username ? username[0].toUpperCase() : '?'}</div>
                  <div>
                    <div className="user-dropdown-name">{username}</div>
                    <div className="user-dropdown-role">WorkLog User</div>
                  </div>
                </div>
                <div className="user-dropdown-divider" />
                <button className="user-dropdown-item logout" onClick={handleLogout}>
                  <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" />
                  </svg>
                  Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ── Body ── */}
      <main className="app-body">
        <p className="section-label">Monthly Overview</p>
        <div className="calendar-card">
          <Calendar onClickDay={d => { setSelectedDate(d); setShowModal(true); }}
            tileClassName={tileClassName} tileContent={tileContent} />
        </div>

        <div className="legend">
          <div className="legend-item"><div className="legend-dot green" />Complete (8h+)</div>
          <div className="legend-item"><div className="legend-dot amber" />In progress</div>
          <div className="legend-item"><div className="legend-dot red" />No entry</div>
        </div>

        <p className="section-label">Export</p>
        <div className="export-section">
          <button className="btn btn-excel" onClick={exportToExcel}>📊 Excel</button>
          <button className="btn btn-word" onClick={exportToWord}>📄 Word</button>
          <button className="btn btn-pdf" onClick={exportToPDF}>🧾 PDF</button>
        </div>
      </main>

      {/* ── Modal ── */}
      <Modal isOpen={showModal} onRequestClose={closeModal}
        contentLabel="Work Log" className="modal" overlayClassName="overlay">
        <div className="modal-header">
          <div>
            <div className="modal-date">{selectedDate ? format(selectedDate, 'MMMM d, yyyy') : ''}</div>
            <div className="modal-weekday">{selectedDate ? format(selectedDate, 'EEEE') : ''}</div>
          </div>
          <button className="modal-close" onClick={closeModal}>×</button>
        </div>
        <div className="modal-total">
          <span className="modal-total-label">Total Time</span>
          <span className="modal-total-value">{Math.floor(selMins / 60)}h {selMins % 60}m</span>
        </div>
        <div className="entries-section">
          <p className="entries-section-title">Entries ({entries.length})</p>
          <div className="entries-list">
            {entries.length === 0
              ? <div className="empty-state"><div className="empty-state-icon">📭</div>No entries yet — add one below</div>
              : entries.map(entry => (
                <div className={`entry-card${editingId === entry.id ? ' editing' : ''}`} key={entry.id}>
                  {editingId === entry.id ? (
                    /* ── Edit mode ── */
                    <div className="entry-edit-row">
                      <div className="time-group">
                        <input className="time-input" type="number" min="0" max="24" value={editHours}
                          onChange={e => setEditHours(parseInt(e.target.value) || 0)} />
                        <span className="time-label">h</span>
                        <span className="time-sep">:</span>
                        <input className="time-input" type="number" min="0" max="59" value={editMinutes}
                          onChange={e => setEditMinutes(parseInt(e.target.value) || 0)} />
                        <span className="time-label">m</span>
                      </div>
                      <input className="desc-input" type="text" value={editDescription}
                        onChange={e => setEditDescription(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') saveEdit(selKey); if (e.key === 'Escape') cancelEdit(); }}
                        autoFocus />
                      <div className="entry-edit-actions">
                        <button className="entry-save" onClick={() => saveEdit(selKey)} title="Save">✓</button>
                        <button className="entry-cancel" onClick={cancelEdit} title="Cancel">✕</button>
                      </div>
                    </div>
                  ) : (
                    /* ── View mode ── */
                    <>
                      <span className="entry-time-badge">{entry.hours}h {entry.minutes}m</span>
                      <span className="entry-desc">{entry.description}</span>
                      <div className="entry-actions">
                        <button className="entry-edit-btn" onClick={() => startEdit(entry)} title="Edit">✎</button>
                        <button className="entry-delete" onClick={() => deleteEntry(selKey, entry.id)} title="Delete">✕</button>
                      </div>
                    </>
                  )}
                </div>
              ))}
          </div>
        </div>
        <div className="add-entry-section">
          <p className="add-entry-title">Add Entry</p>
          <div className="add-entry-row">
            <div className="time-group">
              <input className="time-input" type="number" min="0" max="24" value={newHours}
                onChange={e => setNewHours(parseInt(e.target.value) || 0)} />
              <span className="time-label">h</span>
              <span className="time-sep">:</span>
              <input className="time-input" type="number" min="0" max="59" value={newMinutes}
                onChange={e => setNewMinutes(parseInt(e.target.value) || 0)} />
              <span className="time-label">m</span>
            </div>
            <input className="desc-input" type="text" value={newDescription}
              onChange={e => setNewDescription(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addEntry()}
              placeholder="What did you work on?" />
            <button className="btn-add" onClick={addEntry} disabled={!canAdd}>Add</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  if (loading) return <LoadingScreen />;

  return (
    <Router>
      <Routes>
        <Route path="/login" element={!user ? <Login /> : <Navigate to="/" replace />} />
        <Route path="/register" element={!user ? <Register /> : <Navigate to="/" replace />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/" element={user ? <WorkLogApp user={user} /> : <Navigate to="/login" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
