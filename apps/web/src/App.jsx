import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import {
  LayoutDashboard, Sparkles, Database, Film,
  Download, Trash2, RefreshCw, Upload, Search,
  Plus, Pencil, Check, X, ChevronDown, Play, Layers, BookMarked,
} from "lucide-react";

const API = "/api";

/* ── Fetch helper ──────────────────────────────────────── */
const api = async (path, opts = {}) => {
  const res = await fetch(`${API}${path}`, opts);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error ?? res.statusText);
  }
  return res.json();
};

/* ── Theme metadata ────────────────────────────────────── */
const THEMES = {
  neon:   { label: "Neon",    grad: "linear-gradient(135deg,#7c3aed,#ec4899)", bg: "#0a0014" },
  sunset: { label: "Sunset",  grad: "linear-gradient(135deg,#f97316,#ef4444)", bg: "#1a0600" },
  ocean:  { label: "Ocean",   grad: "linear-gradient(135deg,#0ea5e9,#06b6d4)", bg: "#001220" },
  forest: { label: "Forest",  grad: "linear-gradient(135deg,#22c55e,#84cc16)", bg: "#0a1400" },
  galaxy: { label: "Galaxy",  grad: "linear-gradient(135deg,#e040fb,#00e5ff)", bg: "#020010" },
  candy:  { label: "Candy",   grad: "linear-gradient(135deg,#ff4081,#ffff00)", bg: "#1a0020" },
  fire:   { label: "Fire",    grad: "linear-gradient(135deg,#ff6d00,#ff1744)", bg: "#120000" },
  retro:  { label: "Retro",   grad: "linear-gradient(135deg,#00ffcc,#ff6ec7)", bg: "#001020" },
};

/* ── Background style metadata ─────────────────────────── */
const BACKGROUNDS = {
  particles:  { label: "Particles",  icon: "✨" },
  geometric:  { label: "Geometric",  icon: "📐" },
  waves:      { label: "Waves",      icon: "🌊" },
  matrix:     { label: "Matrix",     icon: "💻" },
};

/* ── Music track metadata ───────────────────────────────── */
const MUSIC_TRACKS = {
  none:      { label: "No Music",   icon: "🔇" },
  upbeat:    { label: "Upbeat",     icon: "🎵" },
  chill:     { label: "Chill",      icon: "🎶" },
  dramatic:  { label: "Dramatic",   icon: "🎸" },
  energetic: { label: "Energetic",  icon: "⚡" },
  lofi:      { label: "Lo-Fi",      icon: "🎧" },
};

const STATUS_META = {
  queued:    { cls: "badge-queued",    label: "Queued" },
  rendering: { cls: "badge-rendering", label: "Rendering" },
  completed: { cls: "badge-completed", label: "Done" },
  failed:    { cls: "badge-failed",    label: "Failed" },
};

/* ════════════════════════════════════════════════════════
   TOAST
   ════════════════════════════════════════════════════════ */
function ToastContainer({ toasts, dismiss }) {
  const ICONS = { success: "✓", error: "✕", info: "ℹ", warning: "⚠" };
  return (
    <div className="toast-container">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.type} ${t.leaving ? "leaving" : ""}`}>
          <span className="toast-icon">{ICONS[t.type]}</span>
          <div className="toast-body">
            <div className="toast-title">{t.title}</div>
            {t.msg && <div className="toast-msg">{t.msg}</div>}
          </div>
          <button className="toast-close" onClick={() => dismiss(t.id)}>×</button>
        </div>
      ))}
    </div>
  );
}

function useToast() {
  const [toasts, setToasts] = useState([]);
  const add = useCallback((type, title, msg) => {
    const id = Date.now();
    setToasts((p) => [...p, { id, type, title, msg }]);
    setTimeout(() => {
      setToasts((p) => p.map((t) => t.id === id ? { ...t, leaving: true } : t));
      setTimeout(() => setToasts((p) => p.filter((t) => t.id !== id)), 260);
    }, 4000);
  }, []);
  const dismiss = useCallback((id) => {
    setToasts((p) => p.map((t) => t.id === id ? { ...t, leaving: true } : t));
    setTimeout(() => setToasts((p) => p.filter((t) => t.id !== id)), 260);
  }, []);
  return { toasts, add, dismiss };
}

/* ════════════════════════════════════════════════════════
   DASHBOARD PANEL
   ════════════════════════════════════════════════════════ */
function DashboardPanel({ videos, questions, categories, onGenerate }) {
  const completed = videos.filter((v) => v.status === "completed").length;
  const rendering = videos.filter((v) => v.status === "rendering" || v.status === "queued").length;
  const thisMonth = videos.filter((v) => {
    if (!v.createdAt) return false;
    const d = new Date(v.createdAt);
    const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;

  const recent = [...videos].sort((a, b) => (b.id - a.id)).slice(0, 6);

  return (
    <div className="panel">
      {/* Stats */}
      <div className="stats-grid">
        <StatCard icon={<Film size={22} />} label="Total Videos" value={videos.length} grad="var(--grad-primary)" bg="rgba(124,58,237,0.15)" color="var(--violet-2)" />
        <StatCard icon={<Database size={22} />} label="Questions" value={questions} grad="var(--grad-cyan)" bg="rgba(6,182,212,0.15)" color="var(--cyan)" />
        <StatCard icon={<LayoutDashboard size={22} />} label="Categories" value={categories} grad="var(--grad-emerald)" bg="rgba(16,185,129,0.15)" color="var(--emerald)" />
        <StatCard icon={<Sparkles size={22} />} label="This Month" value={thisMonth} grad="var(--grad-amber)" bg="rgba(245,158,11,0.15)" color="var(--amber)" />
      </div>

      <div className="flex gap-6" style={{ flexWrap: "wrap" }}>
        {/* Recent videos */}
        <div className="card" style={{ flex: "2 1 400px" }}>
          <div className="card-header">
            <div>
              <div className="card-title">Recent Videos</div>
              <div className="card-subtitle">{rendering > 0 ? `${rendering} currently rendering` : "No active renders"}</div>
            </div>
            {rendering > 0 && <RefreshCw size={14} className="spin-icon" style={{ color: "var(--blue)", animation: "spin 1.5s linear infinite" }} />}
          </div>

          {recent.length === 0 ? (
            <div className="empty-state" style={{ padding: "40px 0" }}>
              <div className="empty-icon">🎬</div>
              <div className="empty-title">No videos yet</div>
              <div className="empty-desc">Generate your first video from the Generate tab.</div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {recent.map((v) => {
                const m = STATUS_META[v.status] ?? STATUS_META.queued;
                const th = THEMES[v.theme] ?? THEMES.neon;
                return (
                  <div key={v.id} style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px", borderRadius: "var(--r)", background: "var(--surface-2)", border: "1px solid var(--border)" }}>
                    <div style={{ width: 48, height: 36, borderRadius: 8, background: th.bg, border: `1px solid ${th.grad.match(/#[a-f0-9]{6}/i)?.[0] ?? "#7c3aed"}33`, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>🎬</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="truncate" style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>{v.category} — {v.subcategory}</div>
                      <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 2 }}>{v.questionCount} questions · {v.theme}</div>
                    </div>
                    <span className={`badge ${m.cls}`}><span className="badge-dot" />{m.label}</span>
                    {v.status === "completed" && v.publicUrl && (
                      <a href={v.publicUrl} download className="btn btn-sm btn-ghost" style={{ padding: "5px 8px" }}><Download size={13} /></a>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Quick generate */}
        <div className="card" style={{ flex: "1 1 260px" }}>
          <div className="card-header">
            <div className="card-title">Quick Generate</div>
          </div>
          <p style={{ fontSize: 13, color: "var(--text-3)", marginBottom: 20 }}>Create a new quiz video in seconds.</p>
          <button className="btn btn-primary w-full btn-lg" onClick={onGenerate}>
            <Sparkles size={16} />
            Generate Video
          </button>
          <div className="divider" />
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <InfoRow icon="🎨" label="4 visual themes" />
            <InfoRow icon="🔄" label="Anti-repetition logic" />
            <InfoRow icon="📺" label="Remotion-powered renderer" />
            <InfoRow icon="📁" label="1080p MP4 output" />
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, grad, bg, color }) {
  return (
    <div className="stat-card" style={{ "--stat-grad": grad, "--stat-bg": bg, "--stat-color": color }}>
      <div className="stat-icon-wrap">{icon}</div>
      <div>
        <div className="stat-value">{value}</div>
        <div className="stat-label">{label}</div>
      </div>
    </div>
  );
}

function InfoRow({ icon, label }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: "var(--text-2)" }}>
      <span style={{ fontSize: 15 }}>{icon}</span>{label}
    </div>
  );
}

/* ════════════════════════════════════════════════════════
   GENERATE PANEL
   ════════════════════════════════════════════════════════ */
function GeneratePanel({ categories, toast }) {
  const [cfg, setCfg] = useState({
    category: "", subcategory: "", questionCount: 5, theme: "neon",
    questionTime: 10, revealAnswer: true, avoidDays: 30,
    backgroundStyle: "particles", music: "none",
    introMessage: "", outroMessage: "",
    timingSettings: { pauseBetweenOptions: 0, pauseBeforeTimer: 0.67, answerHold: 2.5 },
  });
  const [busy, setBusy] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const catObj = categories.find((c) => c.name === cfg.category);
  const subcats = catObj?.subcategories ?? [];

  const set = (k, v) => setCfg((p) => ({ ...p, [k]: v }));
  const setTiming = (k, v) => setCfg((p) => ({ ...p, timingSettings: { ...p.timingSettings, [k]: v } }));

  const applyTemplate = (tpl) => {
    const s = tpl.settings ?? {};
    setCfg((p) => ({
      ...p,
      ...(s.category        !== undefined ? { category:        s.category }        : {}),
      ...(s.subcategory     !== undefined ? { subcategory:     s.subcategory }     : {}),
      ...(s.questionCount   !== undefined ? { questionCount:   s.questionCount }   : {}),
      ...(s.questionTime    !== undefined ? { questionTime:    s.questionTime }    : {}),
      ...(s.theme           !== undefined ? { theme:           s.theme }           : {}),
      ...(s.backgroundStyle !== undefined ? { backgroundStyle: s.backgroundStyle } : {}),
      ...(s.music           !== undefined ? { music:           s.music }           : {}),
      ...(s.revealAnswer    !== undefined ? { revealAnswer:    s.revealAnswer }    : {}),
      ...(s.avoidDays       !== undefined ? { avoidDays:       s.avoidDays }       : {}),
      ...(s.introMessage    !== undefined ? { introMessage:    s.introMessage }    : {}),
      ...(s.outroMessage    !== undefined ? { outroMessage:    s.outroMessage }    : {}),
      ...(s.timingSettings  !== undefined ? { timingSettings:  { ...p.timingSettings, ...s.timingSettings } } : {}),
    }));
    toast("success", `Template "${tpl.name}" applied`);
  };

  /* target-duration helper: auto-sets questionCount based on minutes.
     Per-question time ≈ timer + overhead:
       question read ~8s + 4 options read ~8s + TIMER_GAP ~0.7s
       + answer narration ~4s + funny feedback ~4s + buffer ~3.3s = ~28s overhead */
  const setTargetDuration = (minutes) => {
    const secondsPerQ = (cfg.questionTime ?? 15) + 28;
    const count = Math.max(1, Math.min(20, Math.round((minutes * 60) / secondsPerQ)));
    set("questionCount", count);
  };

  const handleGenerate = async () => {
    if (!cfg.category) { toast("warning", "Select a category first"); return; }
    setBusy(true);
    try {
      await api("/videos/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cfg),
      });
      toast("success", "Video queued!", `${cfg.category} · ${cfg.subcategory || "all"} · ${cfg.questionCount} questions`);
    } catch (e) {
      toast("error", "Generate failed", e.message);
    } finally {
      setBusy(false);
    }
  };

  const estSec = cfg.questionCount * cfg.questionTime + 3 + 6; // intro 3s + subscribe 6s

  return (
    <div className="panel">
      <div className="flex gap-6" style={{ flexWrap: "wrap", alignItems: "flex-start" }}>

        {/* Left: config */}
        <div className="card" style={{ flex: "1 1 340px" }}>
          <div className="card-header">
            <div className="card-title">Video Settings</div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Category</label>
                <select className="form-select" value={cfg.category} onChange={(e) => set("category", e.target.value)}>
                  <option value="">— pick one —</option>
                  {categories.map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Subcategory</label>
                <select className="form-select" value={cfg.subcategory} onChange={(e) => set("subcategory", e.target.value)}>
                  <option value="">All</option>
                  {subcats.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Questions: {cfg.questionCount}</label>
              <input type="range" className="form-range" min={1} max={20} value={cfg.questionCount} onChange={(e) => set("questionCount", Number(e.target.value))} />
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--text-3)", marginTop: 4 }}>
                <span>1</span><span>20</span>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Seconds per question: {cfg.questionTime}s</label>
              <input type="range" className="form-range" min={5} max={30} value={cfg.questionTime} onChange={(e) => set("questionTime", Number(e.target.value))} />
            </div>

            {/* Target duration shortcut */}
            <div className="form-group">
              <label className="form-label">Target duration (minutes)</label>
              <div className="flex gap-2">
                {[1, 2, 3, 5, 10].map((m) => (
                  <button key={m} className="btn btn-sm btn-ghost" style={{ flex: 1 }} onClick={() => setTargetDuration(m)}>
                    {m}m
                  </button>
                ))}
              </div>
              <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 4 }}>
                Estimated: ~{Math.floor(estSec / 60)}m {estSec % 60}s
              </div>
            </div>

            <div className="toggle-wrap">
              <span style={{ fontSize: 13, color: "var(--text-2)", fontWeight: 500 }}>Reveal correct answer</span>
              <label className="toggle">
                <input type="checkbox" checked={cfg.revealAnswer} onChange={(e) => set("revealAnswer", e.target.checked)} />
                <div className="toggle-track" />
                <div className="toggle-thumb" />
              </label>
            </div>

            <div className="form-group">
              <label className="form-label">Avoid repeat within (days): {cfg.avoidDays}</label>
              <input type="range" className="form-range" min={0} max={90} step={5} value={cfg.avoidDays} onChange={(e) => set("avoidDays", Number(e.target.value))} />
            </div>

            {/* ── Template loader ── */}
            <TemplateLoader onApply={applyTemplate} toast={toast} cfg={cfg} />

            {/* ── Advanced settings toggle ── */}
            <div>
              <button
                className="btn btn-ghost btn-sm"
                style={{ width: "100%", justifyContent: "space-between" }}
                onClick={() => setShowAdvanced((v) => !v)}
              >
                <span>Advanced Settings</span>
                <ChevronDown size={14} style={{ transform: showAdvanced ? "rotate(180deg)" : "none", transition: "transform 0.2s" }} />
              </button>

              {showAdvanced && (
                <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 18, padding: "16px", borderRadius: "var(--r)", background: "var(--surface-2)", border: "1px solid var(--border)" }}>
                  <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1, color: "var(--text-3)", textTransform: "uppercase" }}>Timing</div>

                  <div className="form-group">
                    <label className="form-label">Pause between options: {cfg.timingSettings.pauseBetweenOptions.toFixed(1)}s</label>
                    <input type="range" className="form-range" min={0} max={3} step={0.1}
                      value={cfg.timingSettings.pauseBetweenOptions}
                      onChange={(e) => setTiming("pauseBetweenOptions", Number(e.target.value))} />
                    <div style={{ fontSize: 11, color: "var(--text-3)" }}>Extra silence inserted between each option read-out (default 0s)</div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Pause before timer: {cfg.timingSettings.pauseBeforeTimer.toFixed(1)}s</label>
                    <input type="range" className="form-range" min={0} max={3} step={0.1}
                      value={cfg.timingSettings.pauseBeforeTimer}
                      onChange={(e) => setTiming("pauseBeforeTimer", Number(e.target.value))} />
                    <div style={{ fontSize: 11, color: "var(--text-3)" }}>Gap after last option before countdown starts (default 0.67s)</div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Answer hold time: {cfg.timingSettings.answerHold.toFixed(1)}s</label>
                    <input type="range" className="form-range" min={1} max={10} step={0.5}
                      value={cfg.timingSettings.answerHold}
                      onChange={(e) => setTiming("answerHold", Number(e.target.value))} />
                    <div style={{ fontSize: 11, color: "var(--text-3)" }}>How long the revealed answer stays on screen after funny feedback (default 2.5s)</div>
                  </div>

                  <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1, color: "var(--text-3)", textTransform: "uppercase", marginTop: 4 }}>Messages</div>

                  <div className="form-group">
                    <label className="form-label">Intro message</label>
                    <textarea
                      className="form-input"
                      rows={3}
                      style={{ resize: "vertical", fontFamily: "inherit" }}
                      placeholder={`Welcome to the ${cfg.subcategory || cfg.category || "…"} quiz! Get ready for ${cfg.questionCount} exciting questions! Let's go!`}
                      value={cfg.introMessage}
                      onChange={(e) => set("introMessage", e.target.value)}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Outro / final message</label>
                    <textarea
                      className="form-input"
                      rows={3}
                      style={{ resize: "vertical", fontFamily: "inherit" }}
                      placeholder="Wow, you made it through the whole quiz! Amazing effort! Please smash that subscribe button and hit the bell icon!"
                      value={cfg.outroMessage}
                      onChange={(e) => set("outroMessage", e.target.value)}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right: theme / background / music / generate */}
        <div style={{ flex: "1 1 340px", display: "flex", flexDirection: "column", gap: 20 }}>

          {/* Theme picker */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">Visual Theme</div>
            </div>
            <div className="theme-grid">
              {Object.entries(THEMES).map(([key, th]) => (
                <div
                  key={key}
                  className={`theme-option ${cfg.theme === key ? "selected" : ""}`}
                  style={{ background: th.bg, borderColor: cfg.theme === key ? "rgba(255,255,255,0.5)" : "transparent" }}
                  onClick={() => set("theme", key)}
                >
                  <div className="theme-swatch" style={{ background: th.grad }} />
                  <div className="theme-name" style={{ color: "#fff" }}>{th.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Background style picker */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">Background Style</div>
            </div>
            <div className="bg-style-grid">
              {Object.entries(BACKGROUNDS).map(([key, bg]) => (
                <div
                  key={key}
                  className={`bg-style-option ${cfg.backgroundStyle === key ? "selected" : ""}`}
                  onClick={() => set("backgroundStyle", key)}
                >
                  <span style={{ fontSize: 22 }}>{bg.icon}</span>
                  <span style={{ fontSize: 12, fontWeight: 600 }}>{bg.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Music picker */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">Background Music</div>
            </div>
            <div className="music-grid">
              {Object.entries(MUSIC_TRACKS).map(([key, tr]) => (
                <div
                  key={key}
                  className={`music-option ${cfg.music === key ? "selected" : ""}`}
                  onClick={() => set("music", key)}
                >
                  <span style={{ fontSize: 20 }}>{tr.icon}</span>
                  <span style={{ fontSize: 12, fontWeight: 600 }}>{tr.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Preview + generate */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">Preview</div>
            </div>
            <div style={{
              height: 140,
              borderRadius: "var(--r-lg)",
              background: THEMES[cfg.theme]?.bg,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              position: "relative",
              overflow: "hidden",
            }}>
              <div style={{ position: "absolute", inset: 0, background: THEMES[cfg.theme]?.grad, opacity: 0.2 }} />
              <div style={{ position: "relative", textAlign: "center" }}>
                <div style={{ fontSize: 28, fontWeight: 900, color: "#fff", letterSpacing: -1 }}>{cfg.category || "Category"}</div>
                <div style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", marginTop: 4 }}>
                  {cfg.subcategory || "Subcategory"} · {cfg.questionCount} Qs · {cfg.questionTime}s · {BACKGROUNDS[cfg.backgroundStyle]?.icon} · {MUSIC_TRACKS[cfg.music]?.icon}
                </div>
              </div>
            </div>

            <button
              className={`btn btn-primary w-full btn-lg mt-4 ${busy ? "btn-generating" : ""}`}
              disabled={busy || !cfg.category}
              onClick={handleGenerate}
            >
              {busy ? (
                <><div className="btn-spinner" />Queuing…</>
              ) : (
                <><Play size={18} />Generate Video</>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════
   TEMPLATE LOADER (inline picker inside GeneratePanel)
   ════════════════════════════════════════════════════════ */
function TemplateLoader({ onApply, toast, cfg }) {
  const [templates, setTemplates] = useState([]);
  const [saveName, setSaveName] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try { setTemplates(await api("/templates")); } catch { /* ignore */ }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    if (!saveName.trim()) { toast("warning", "Enter a template name"); return; }
    setSaving(true);
    try {
      await api("/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: saveName.trim(), settings: cfg }),
      });
      toast("success", `Template "${saveName.trim()}" saved`);
      setSaveName("");
      load();
    } catch (e) { toast("error", "Save failed", e.message); }
    finally { setSaving(false); }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1, color: "var(--text-3)", textTransform: "uppercase" }}>Templates</div>

      {templates.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {templates.map((t) => (
            <button key={t.id} className="btn btn-ghost btn-sm" onClick={() => onApply(t)}
              title={`Load template: ${t.name}`}>
              <BookMarked size={12} />{t.name}
            </button>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <input
          className="form-input"
          placeholder="Save current settings as template…"
          value={saveName}
          onChange={(e) => setSaveName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSave()}
          style={{ flex: 1 }}
        />
        <button className="btn btn-ghost btn-sm" onClick={handleSave} disabled={saving}>
          {saving ? <div className="btn-spinner" /> : <Plus size={13} />}
          Save
        </button>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════
   TEMPLATES PANEL (full management tab)
   ════════════════════════════════════════════════════════ */
function TemplatesPanel({ toast }) {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editId, setEditId] = useState(null);
  const [editName, setEditName] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try { setTemplates(await api("/templates")); }
    catch (e) { toast("error", "Failed to load templates", e.message); }
    finally { setLoading(false); }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (id) => {
    try {
      await api(`/templates/${id}`, { method: "DELETE" });
      toast("success", "Template deleted");
      load();
    } catch (e) { toast("error", "Delete failed", e.message); }
  };

  const handleRename = async (id) => {
    if (!editName.trim()) return;
    try {
      await api(`/templates/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editName.trim() }),
      });
      setEditId(null);
      toast("success", "Template renamed");
      load();
    } catch (e) { toast("error", "Rename failed", e.message); }
  };

  const fmt = (v) => (typeof v === "number" ? v : JSON.stringify(v));

  return (
    <div className="panel">
      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">Video Settings Templates</div>
            <div className="card-subtitle">Save and reuse your favourite video configurations</div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={load}><RefreshCw size={13} />Refresh</button>
        </div>

        {loading && <div style={{ padding: "40px 0", textAlign: "center", color: "var(--text-3)" }}>Loading…</div>}

        {!loading && templates.length === 0 && (
          <div className="empty-state">
            <div className="empty-icon">📋</div>
            <div className="empty-title">No templates yet</div>
            <div className="empty-desc">Go to Generate → save your settings as a template to reuse them.</div>
          </div>
        )}

        {!loading && templates.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {templates.map((t) => {
              const s = t.settings ?? {};
              const timing = s.timingSettings ?? {};
              const theme = THEMES[s.theme] ?? THEMES.neon;
              return (
                <div key={t.id} style={{ display: "flex", gap: 16, alignItems: "flex-start", padding: "14px 16px", borderRadius: "var(--r)", background: "var(--surface-2)", border: "1px solid var(--border)" }}>
                  {/* colour swatch */}
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: theme.grad, flexShrink: 0 }} />

                  <div style={{ flex: 1, minWidth: 0 }}>
                    {editId === t.id ? (
                      <div className="flex gap-2" style={{ marginBottom: 8 }}>
                        <input className="form-input" value={editName} onChange={(e) => setEditName(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && handleRename(t.id)} style={{ flex: 1 }} autoFocus />
                        <button className="btn btn-sm btn-primary" onClick={() => handleRename(t.id)}><Check size={12} /></button>
                        <button className="btn btn-sm btn-ghost" onClick={() => setEditId(null)}><X size={12} /></button>
                      </div>
                    ) : (
                      <div style={{ fontWeight: 700, fontSize: 14, color: "var(--text)", marginBottom: 6 }}>{t.name}</div>
                    )}
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 12px", fontSize: 12, color: "var(--text-3)" }}>
                      {s.theme           && <span>🎨 {s.theme}</span>}
                      {s.backgroundStyle && <span>✨ {s.backgroundStyle}</span>}
                      {s.music           && s.music !== "none" && <span>🎵 {s.music}</span>}
                      {s.questionCount   !== undefined && <span>❓ {s.questionCount} questions</span>}
                      {s.questionTime    !== undefined && <span>⏱ {s.questionTime}s</span>}
                      {s.category        && <span>📁 {s.category}{s.subcategory ? ` / ${s.subcategory}` : ""}</span>}
                      {(timing.pauseBetweenOptions ?? 0) > 0 && <span>⏸ opts+{timing.pauseBetweenOptions}s</span>}
                      {timing.pauseBeforeTimer !== undefined && timing.pauseBeforeTimer !== 0.67 && <span>⏸ pre-timer {timing.pauseBeforeTimer}s</span>}
                      {timing.answerHold !== undefined && timing.answerHold !== 2.5 && <span>🔒 hold {timing.answerHold}s</span>}
                      {s.introMessage    && <span>🗣 custom intro</span>}
                      {s.outroMessage    && <span>🗣 custom outro</span>}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 4 }}>
                      Saved {t.createdAt ? new Date(t.createdAt).toLocaleDateString() : "—"}
                    </div>
                  </div>

                  <div className="flex gap-2" style={{ flexShrink: 0 }}>
                    <button className="btn btn-sm btn-ghost" onClick={() => { setEditId(t.id); setEditName(t.name); }}>
                      <Pencil size={12} />
                    </button>
                    <button className="btn btn-sm btn-danger" onClick={() => handleDelete(t.id)}>
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════
   QUESTIONS PANEL
   ════════════════════════════════════════════════════════ */
function QuestionsPanel({ toast }) {
  const [questions, setQuestions] = useState([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("");
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dragOver, setDragOver] = useState(false);
  const [editId, setEditId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const fileRef = useRef(null);

  useEffect(() => {
    api("/categories").then((data) => setCategories(Array.isArray(data) ? data : [])).catch(() => {});
  }, []);

  const loadQuestions = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "500" });
      if (catFilter) params.set("category", catFilter);
      const res = await api(`/questions?${params}`);
      setQuestions(res.items ?? []);
      setTotal(res.total ?? 0);
    } catch (e) {
      toast("error", "Failed to load questions", e.message);
    } finally {
      setLoading(false);
    }
  }, [catFilter, toast]);

  useEffect(() => { loadQuestions(); }, [loadQuestions]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return questions.filter((r) =>
      !q || r.questionText?.toLowerCase().includes(q) || r.category?.toLowerCase().includes(q)
    );
  }, [questions, search]);

  const handleDelete = async (id) => {
    try {
      await api(`/questions/${id}`, { method: "DELETE" });
      toast("success", "Deleted");
      loadQuestions();
    } catch (e) { toast("error", "Delete failed", e.message); }
  };

  const handleEdit = (q) => { setEditId(q.id); setEditForm({ ...q }); };

  const handleSave = async () => {
    try {
      await api(`/questions/${editId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });
      setEditId(null);
      toast("success", "Question saved");
      loadQuestions();
    } catch (e) { toast("error", "Save failed", e.message); }
  };

  const handleCSV = async (file) => {
    if (!file || !file.name.endsWith(".csv")) { toast("warning", "Please upload a .csv file"); return; }
    const fd = new FormData();
    fd.append("file", file);
    try {
      const res = await api("/questions/csv", { method: "POST", body: fd });
      toast("success", `Imported ${res.imported} questions`, res.skipped > 0 ? `${res.skipped} rows skipped` : undefined);
      loadQuestions();
    } catch (e) { toast("error", "CSV import failed", e.message); }
  };

  const onDrop = (e) => {
    e.preventDefault(); setDragOver(false);
    handleCSV(e.dataTransfer.files[0]);
  };

  const downloadTemplate = async () => {
    const res = await fetch(`${API}/csv-template`);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "quizforge-template.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="panel">
      {/* CSV Import */}
      <div className="card mb-6">
        <div className="card-header">
          <div className="card-title">Import Questions</div>
          <button className="btn btn-ghost btn-sm" onClick={downloadTemplate}><Download size={13} />Template</button>
        </div>
        <div
          className={`drop-zone ${dragOver ? "drag-over" : ""}`}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          onClick={() => fileRef.current?.click()}
        >
          <input ref={fileRef} type="file" accept=".csv" onChange={(e) => handleCSV(e.target.files[0])} />
          <div style={{ fontSize: 32, marginBottom: 8 }}>📂</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-2)" }}>Drop a CSV file here or click to browse</div>
          <div style={{ fontSize: 12, color: "var(--text-3)", marginTop: 4 }}>category, subcategory, question, option1–4, correct_option, difficulty</div>
        </div>
      </div>

      {/* Table controls */}
      <div className="flex items-center gap-3 mb-4" style={{ flexWrap: "wrap" }}>
        <div className="search-bar" style={{ flex: "1 1 200px", maxWidth: 340 }}>
          <Search size={14} style={{ color: "var(--text-3)", flexShrink: 0 }} />
          <input placeholder="Search questions…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select className="form-select" style={{ width: 180 }} value={catFilter} onChange={(e) => setCatFilter(e.target.value)}>
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c.name} value={c.name}>{c.name}</option>
          ))}
        </select>
        <button className="btn btn-ghost btn-sm" onClick={loadQuestions}><RefreshCw size={13} />Refresh</button>
        <span style={{ fontSize: 12, color: "var(--text-3)", marginLeft: "auto" }}>{filtered.length} / {total} questions</span>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>#</th><th>Category</th><th>Question</th>
              <th>Correct</th><th>Difficulty</th><th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={6} style={{ textAlign: "center", padding: 40, color: "var(--text-3)" }}>Loading…</td></tr>
            )}
            {!loading && filtered.length === 0 && (
              <tr><td colSpan={6} style={{ textAlign: "center", padding: 40, color: "var(--text-3)" }}>No questions found</td></tr>
            )}
            {filtered.map((q) =>
              editId === q.id ? (
                <tr key={q.id}>
                  <td>{q.id}</td>
                  <td colSpan={3}>
                    <input className="form-input" style={{ marginBottom: 6 }} value={editForm.questionText ?? ""} onChange={(e) => setEditForm((p) => ({ ...p, questionText: e.target.value }))} />
                    <div className="grid-2">
                      {["option1","option2","option3","option4"].map((k, i) => (
                        <input key={k} className="form-input" placeholder={`Option ${i+1}`} value={editForm[k] ?? ""} onChange={(e) => setEditForm((p) => ({ ...p, [k]: e.target.value }))} />
                      ))}
                    </div>
                  </td>
                  <td>
                    <select className="form-select" value={editForm.correctOption} onChange={(e) => setEditForm((p) => ({ ...p, correctOption: Number(e.target.value) }))}>
                      {[1,2,3,4].map((n) => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </td>
                  <td>
                    <div className="flex gap-2">
                      <button className="btn btn-sm btn-primary" onClick={handleSave}><Check size={12} /></button>
                      <button className="btn btn-sm btn-ghost" onClick={() => setEditId(null)}><X size={12} /></button>
                    </div>
                  </td>
                </tr>
              ) : (
                <tr key={q.id}>
                  <td>{q.id}</td>
                  <td><span style={{ fontSize: 12 }}>{q.category}</span><br /><span style={{ fontSize: 11, color: "var(--text-3)" }}>{q.subcategory}</span></td>
                  <td style={{ maxWidth: 360 }}><div className="truncate">{q.questionText}</div></td>
                  <td style={{ fontFamily: "var(--mono)", fontSize: 12 }}>
                    {["A","B","C","D"][q.correctOption - 1]} — {q[`option${q.correctOption}`]?.slice(0, 30)}
                  </td>
                  <td><span className={`badge diff-${q.difficulty}`}>{q.difficulty}</span></td>
                  <td>
                    <div className="flex gap-2">
                      <button className="btn btn-sm btn-ghost" onClick={() => handleEdit(q)}><Pencil size={12} /></button>
                      <button className="btn btn-sm btn-danger" onClick={() => handleDelete(q.id)}><Trash2 size={12} /></button>
                    </div>
                  </td>
                </tr>
              )
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════
   VIDEOS PANEL
   ════════════════════════════════════════════════════════ */
function VideosPanel({ videos, onDelete, onRefresh }) {
  const [filter, setFilter] = useState("all");

  const shown = videos.filter((v) => filter === "all" || v.status === filter);
  const rendering = videos.filter((v) => v.status === "rendering" || v.status === "queued").length;

  return (
    <div className="panel">
      {/* Filter bar */}
      <div className="flex items-center gap-3 mb-6" style={{ flexWrap: "wrap" }}>
        {["all", "queued", "rendering", "completed", "failed"].map((f) => (
          <button key={f} className={`btn btn-sm ${filter === f ? "btn-secondary" : "btn-ghost"}`} onClick={() => setFilter(f)}>
            {f.charAt(0).toUpperCase() + f.slice(1)}
            <span style={{ fontSize: 11, background: "rgba(255,255,255,0.08)", borderRadius: 99, padding: "1px 6px" }}>
              {f === "all" ? videos.length : videos.filter((v) => v.status === f).length}
            </span>
          </button>
        ))}
        <button className="btn btn-ghost btn-sm" style={{ marginLeft: "auto" }} onClick={onRefresh}>
          <RefreshCw size={13} style={rendering > 0 ? { animation: "spin 1.5s linear infinite" } : {}} />
          {rendering > 0 ? `${rendering} rendering` : "Refresh"}
        </button>
      </div>

      {shown.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">🎬</div>
          <div className="empty-title">No videos found</div>
          <div className="empty-desc">Generate your first video from the Generate tab.</div>
        </div>
      ) : (
        <div className="videos-grid">
          {shown.map((v) => {
            const m = STATUS_META[v.status] ?? STATUS_META.queued;
            const th = THEMES[v.theme] ?? THEMES.neon;
            return (
              <div key={v.id} className="video-card">
                <div className="video-thumb" style={{ "--thumb-grad": th.grad, background: th.bg }}>
                  <div className="video-thumb-icon">🎬</div>
                </div>
                <div className="video-card-body">
                  <div className="video-card-title">{v.category} — {v.subcategory || "All"}</div>
                  <div className="video-card-meta">
                    <span className={`badge ${m.cls}`}><span className="badge-dot" />{m.label}</span>
                    <span className="video-card-meta-item">🎨 {v.theme}</span>
                    <span className="video-card-meta-item">❓ {v.questionCount}q</span>
                    <span className="video-card-meta-item">⏱ {v.questionTime}s</span>
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text-3)", marginBottom: 12 }}>
                    {v.createdAt ? new Date(v.createdAt).toLocaleString() : "—"}
                  </div>
                  <div className="video-card-actions">
                    {v.status === "completed" && v.publicUrl && (
                      <a href={v.publicUrl} download className="btn btn-sm btn-primary" style={{ flex: 1 }}>
                        <Download size={13} />Download
                      </a>
                    )}
                    {v.status === "failed" && (
                      <div style={{ fontSize: 11, color: "var(--red)", flex: 1 }}>{v.error}</div>
                    )}
                    <button className="btn btn-sm btn-danger" onClick={() => onDelete(v.id)}>
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════════
   BULK GENERATE PANEL
   ════════════════════════════════════════════════════════ */
const DEFAULT_JOB = () => ({
  category: "", subcategory: "", questionCount: 5, theme: "neon",
  questionTime: 10, revealAnswer: true, backgroundStyle: "particles", music: "none",
});

function BulkGeneratePanel({ categories, toast }) {
  const [jobs, setJobs] = useState([DEFAULT_JOB()]);
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState(null);

  const addRow    = () => setJobs((p) => [...p, DEFAULT_JOB()]);
  const removeRow = (i) => setJobs((p) => p.filter((_, j) => j !== i));
  const setField  = (i, k, v) => setJobs((p) => p.map((r, j) => j === i ? { ...r, [k]: v } : r));

  const handleBulk = async () => {
    const valid = jobs.filter((j) => j.category);
    if (valid.length === 0) { toast("warning", "Add at least one job with a category"); return; }
    setBusy(true);
    setResults(null);
    try {
      const res = await api("/videos/bulk-generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobs: valid }),
      });
      setResults(res);
      toast("success", `${res.queued} videos queued!`);
    } catch (e) {
      toast("error", "Bulk generate failed", e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="panel">
      <div className="card">
        <div className="card-header" style={{ marginBottom: 16 }}>
          <div>
            <div className="card-title">Bulk Video Generation</div>
            <div className="card-subtitle">Queue up to 20 videos at once</div>
          </div>
          <div className="flex gap-2">
            <button className="btn btn-ghost btn-sm" onClick={addRow} disabled={jobs.length >= 20}>
              <Plus size={14} /> Add Row
            </button>
            <button
              className={`btn btn-primary btn-sm ${busy ? "btn-generating" : ""}`}
              disabled={busy || jobs.every((j) => !j.category)}
              onClick={handleBulk}
            >
              {busy ? <><div className="btn-spinner" />Queuing…</> : <><Layers size={14} />Bulk Queue</>}
            </button>
          </div>
        </div>

        <div className="bulk-table-wrap">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Category</th>
                <th>Subcategory</th>
                <th>Qs</th>
                <th>Theme</th>
                <th>Background</th>
                <th>Music</th>
                <th>Reveal</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((job, i) => {
                const catObj = categories.find((c) => c.name === job.category);
                const subcats = catObj?.subcategories ?? [];
                return (
                  <tr key={i}>
                    <td style={{ color: "var(--text-3)", fontSize: 12 }}>{i + 1}</td>
                    <td>
                      <select className="form-select form-select-sm" value={job.category}
                        onChange={(e) => setField(i, "category", e.target.value)}>
                        <option value="">— pick —</option>
                        {categories.map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}
                      </select>
                    </td>
                    <td>
                      <select className="form-select form-select-sm" value={job.subcategory}
                        onChange={(e) => setField(i, "subcategory", e.target.value)}>
                        <option value="">All</option>
                        {subcats.map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </td>
                    <td>
                      <input type="number" className="form-input form-input-sm" min={1} max={20} value={job.questionCount}
                        onChange={(e) => setField(i, "questionCount", Number(e.target.value))}
                        style={{ width: 56 }} />
                    </td>
                    <td>
                      <select className="form-select form-select-sm" value={job.theme}
                        onChange={(e) => setField(i, "theme", e.target.value)}>
                        {Object.entries(THEMES).map(([k, t]) => <option key={k} value={k}>{t.label}</option>)}
                      </select>
                    </td>
                    <td>
                      <select className="form-select form-select-sm" value={job.backgroundStyle}
                        onChange={(e) => setField(i, "backgroundStyle", e.target.value)}>
                        {Object.entries(BACKGROUNDS).map(([k, b]) => <option key={k} value={k}>{b.label}</option>)}
                      </select>
                    </td>
                    <td>
                      <select className="form-select form-select-sm" value={job.music}
                        onChange={(e) => setField(i, "music", e.target.value)}>
                        {Object.entries(MUSIC_TRACKS).map(([k, m]) => <option key={k} value={k}>{m.label}</option>)}
                      </select>
                    </td>
                    <td>
                      <label className="toggle toggle-sm">
                        <input type="checkbox" checked={job.revealAnswer}
                          onChange={(e) => setField(i, "revealAnswer", e.target.checked)} />
                        <div className="toggle-track" />
                        <div className="toggle-thumb" />
                      </label>
                    </td>
                    <td>
                      <button className="btn btn-sm btn-danger" onClick={() => removeRow(i)}
                        disabled={jobs.length === 1}>
                        <X size={12} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {results && (
          <div style={{ marginTop: 20, padding: "14px 18px", borderRadius: "var(--r)", background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.3)", fontSize: 13, color: "var(--emerald)" }}>
            ✓ {results.queued} video{results.queued !== 1 ? "s" : ""} queued successfully!
          </div>
        )}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════
   NAV items
   ════════════════════════════════════════════════════════ */
const NAV = [
  { id: "dashboard", label: "Dashboard",  icon: <LayoutDashboard size={18} /> },
  { id: "generate",  label: "Generate",   icon: <Sparkles size={18} /> },
  { id: "bulk",      label: "Bulk",       icon: <Layers size={18} /> },
  { id: "templates", label: "Templates",  icon: <BookMarked size={18} /> },
  { id: "questions", label: "Questions",  icon: <Database size={18} /> },
  { id: "videos",    label: "Videos",     icon: <Film size={18} /> },
];

export default function App() {
  const [tab, setTab] = useState("dashboard");
  const [categories, setCategories] = useState([]);
  const [videos, setVideos] = useState([]);
  const [qTotal, setQTotal] = useState(0);
  const [apiOnline, setApiOnline] = useState(null);
  const { toasts, add: addToast, dismiss } = useToast();
  const toast = useCallback((type, title, msg) => addToast(type, title, msg), [addToast]);

  const loadAll = useCallback(async () => {
    try {
      const [cats, vids, qs] = await Promise.all([
        api("/categories"),
        api("/videos"),
        api("/questions?limit=1"),
      ]);
      setCategories(cats);
      setVideos(vids);
      setQTotal(qs.total ?? 0);
      setApiOnline(true);
    } catch {
      setApiOnline(false);
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  /* Auto-refresh when renders are active */
  useEffect(() => {
    const active = videos.some((v) => v.status === "queued" || v.status === "rendering");
    if (!active) return;
    const t = setInterval(async () => {
      try {
        const vids = await api("/videos");
        setVideos(vids);
      } catch { /* ignore */ }
    }, 5000);
    return () => clearInterval(t);
  }, [videos]);

  const handleDeleteVideo = async (id) => {
    try {
      await api(`/videos/${id}`, { method: "DELETE" });
      toast("success", "Video removed");
      setVideos((p) => p.filter((v) => v.id !== id));
    } catch (e) { toast("error", "Delete failed", e.message); }
  };

  const PAGE_TITLES = {
    dashboard: "Dashboard",
    generate:  "Generate Video",
    questions: "Question Bank",
    videos:    "My Videos",
    bulk:      "Bulk Generate",
    templates: "Templates",
  };

  return (
    <div className="app">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div className="logo-mark">
            <div className="logo-icon">🎬</div>
            <div>
              <div className="logo-text">QuizForge</div>
              <div className="logo-version">v2.0 · Remotion</div>
            </div>
          </div>
        </div>

        <nav className="sidebar-nav">
          {NAV.map(({ id, label, icon }) => (
            <div key={id} className={`nav-item ${tab === id ? "active" : ""}`} onClick={() => setTab(id)}>
              <span className="nav-icon">{icon}</span>
              <span>{label}</span>
              {id === "videos" && videos.filter((v) => v.status === "rendering" || v.status === "queued").length > 0 && (
                <span style={{ marginLeft: "auto", width: 7, height: 7, borderRadius: "50%", background: "var(--blue)", boxShadow: "0 0 8px var(--blue)" }} />
              )}
            </div>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="api-status">
            <div className={`status-dot ${apiOnline === false ? "offline" : ""}`} />
            {apiOnline === null ? "Connecting…" : apiOnline ? "API connected" : "API offline"}
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="main">
        <header className="topbar">
          <div className="topbar-title">{PAGE_TITLES[tab]}</div>
          <div className="topbar-actions">
            {tab === "generate" && (
              <button className="btn btn-primary" onClick={() => setTab("generate")}>
                <Sparkles size={14} />New Video
              </button>
            )}
            {tab === "questions" && (
              <button className="btn btn-ghost btn-sm" onClick={async () => {
                const res = await fetch(`${API}/csv-template`);
                const blob = await res.blob();
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a"); a.href = url; a.download = "quizforge-template.csv"; a.click();
              }}>
                <Download size={13} />CSV Template
              </button>
            )}
          </div>
        </header>

        {tab === "dashboard" && (
          <DashboardPanel
            videos={videos}
            questions={qTotal}
            categories={categories.length}
            onGenerate={() => setTab("generate")}
          />
        )}
        {tab === "generate" && (
          <GeneratePanel categories={categories} toast={toast} />
        )}
        {tab === "bulk" && (
          <BulkGeneratePanel categories={categories} toast={toast} />
        )}
        {tab === "templates" && (
          <TemplatesPanel toast={toast} />
        )}
        {tab === "questions" && (
          <QuestionsPanel toast={toast} />
        )}
        {tab === "videos" && (
          <VideosPanel
            videos={videos}
            onDelete={handleDeleteVideo}
            onRefresh={loadAll}
          />
        )}
      </div>

      <ToastContainer toasts={toasts} dismiss={dismiss} />
    </div>
  );
}
