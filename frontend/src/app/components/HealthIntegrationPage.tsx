// HealthIntegrationPage.tsx — Connect wearables & health platforms
import { useState, useEffect, useCallback } from 'react';
import {
  Watch, Wifi, WifiOff, RefreshCw, Trash2, CheckCircle2,
  Heart, Footprints, Moon, Flame, Activity, Plus, Loader2,
  ChevronRight, AlertCircle, X,
} from 'lucide-react';
import { authFetch } from '../../utils/authToken';
import { toast } from 'sonner';
import { API } from '../../config';

// ── Types ─────────────────────────────────────────────────────────────────────
interface Integration {
  service: string;
  connected: boolean;
  connectedAt?: string;
  lastSync?: string | null;
  scopes?: string[];
}

interface HealthDataPoint {
  id: string;
  type: string;
  value: number;
  unit: string;
  date: string;
  source: string;
}

interface Props {
  userId: string;
}

// ── Service definitions ───────────────────────────────────────────────────────
const SERVICES = [
  {
    id: 'fitbit',
    name: 'Fitbit',
    logo: '🔵',
    description: 'Steps, sleep, heart rate, calories & more',
    color: 'border-sky-500/30 bg-sky-500/5',
    activeColor: 'border-sky-500/50 bg-sky-500/10',
    badgeColor: 'text-sky-400',
    metrics: ['steps', 'heart_rate', 'sleep', 'calories'],
  },
  {
    id: 'garmin',
    name: 'Garmin',
    logo: '⚫',
    description: 'Advanced training metrics, GPS, VO2 max',
    color: 'border-[rgba(201,169,110,0.07)] bg-white/2',
    activeColor: 'border-[#c9a96e]/40 bg-[rgba(201,169,110,0.04)]',
    badgeColor: 'text-[#c9a96e]',
    metrics: ['steps', 'heart_rate', 'vo2_max', 'stress'],
  },
  {
    id: 'apple_health',
    name: 'Apple Health',
    logo: '🍎',
    description: 'HealthKit — steps, workouts, mindfulness',
    color: 'border-[rgba(201,169,110,0.07)] bg-white/2',
    activeColor: 'border-pink-500/40 bg-pink-500/5',
    badgeColor: 'text-pink-400',
    metrics: ['steps', 'heart_rate', 'sleep', 'workouts'],
    iosOnly: true,
  },
  {
    id: 'google_fit',
    name: 'Google Fit',
    logo: '🔴',
    description: 'Activity, heart rate and wellness goals',
    color: 'border-[rgba(201,169,110,0.07)] bg-white/2',
    activeColor: 'border-green-500/40 bg-green-500/5',
    badgeColor: 'text-green-400',
    metrics: ['steps', 'heart_rate', 'calories', 'sleep'],
  },
  {
    id: 'whoop',
    name: 'WHOOP',
    logo: '⚡',
    description: 'Recovery, strain, sleep & HRV tracking',
    color: 'border-[rgba(201,169,110,0.07)] bg-white/2',
    activeColor: 'border-red-500/40 bg-red-500/5',
    badgeColor: 'text-red-400',
    metrics: ['hrv', 'recovery', 'sleep', 'strain'],
  },
  {
    id: 'polar',
    name: 'Polar',
    logo: '🧊',
    description: 'Heart rate, training load & recovery status',
    color: 'border-[rgba(201,169,110,0.07)] bg-white/2',
    activeColor: 'border-orange-500/40 bg-orange-500/5',
    badgeColor: 'text-orange-400',
    metrics: ['heart_rate', 'hrv', 'calories', 'sleep'],
  },
  {
    id: 'samsung_health',
    name: 'Samsung Health',
    logo: '🟦',
    description: 'Steps, sleep, stress, blood oxygen',
    color: 'border-[rgba(201,169,110,0.07)] bg-white/2',
    activeColor: 'border-blue-500/40 bg-blue-500/5',
    badgeColor: 'text-blue-400',
    metrics: ['steps', 'heart_rate', 'sleep', 'stress'],
  },
];

const METRIC_ICONS: Record<string, { Icon: any; color: string; label: string; unit: string }> = {
  steps:       { Icon: Footprints, color: 'text-emerald-400', label: 'Steps',       unit: 'steps' },
  heart_rate:  { Icon: Heart,      color: 'text-red-400',     label: 'Heart Rate',  unit: 'bpm'   },
  sleep:       { Icon: Moon,       color: 'text-[#c9a96e]',  label: 'Sleep',       unit: 'hrs'   },
  calories:    { Icon: Flame,      color: 'text-orange-400',  label: 'Calories',    unit: 'kcal'  },
  hrv:         { Icon: Activity,   color: 'text-[#c9a96e]',  label: 'HRV',         unit: 'ms'    },
  recovery:    { Icon: RefreshCw,  color: 'text-sky-400',     label: 'Recovery',    unit: '%'     },
  strain:      { Icon: Flame,      color: 'text-amber-400',   label: 'Strain',      unit: '/21'   },
  stress:      { Icon: Activity,   color: 'text-yellow-400',  label: 'Stress',      unit: '/100'  },
  vo2_max:     { Icon: Activity,   color: 'text-teal-400',    label: 'VO2 Max',     unit: 'ml/kg' },
  workouts:    { Icon: Activity,   color: 'text-[#c9a96e]',  label: 'Workouts',    unit: 'logs'  },
};

// ── Manual entry modal ────────────────────────────────────────────────────────
function ManualEntryModal({ userId, onClose, onSaved }: { userId: string; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ type: 'steps', value: '', unit: 'steps', date: new Date().toISOString().slice(0, 10) });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!form.value) return toast.error('Enter a value');
    setSaving(true);
    try {
      const r = await authFetch(`${API}/users/${userId}/integrations/health-data`, {
        method: 'POST',
        body: JSON.stringify({ ...form, source: 'manual' }),
      });
      if (!r.ok) throw new Error('Failed to save');
      toast.success('Health data logged!');
      onSaved();
    } catch { toast.error('Failed to save'); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-[#0d0b08] border border-[rgba(201,169,110,0.12)] rounded-2xl w-full max-w-sm shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[rgba(201,169,110,0.07)]">
          <h2 className="text-white font-semibold text-sm flex items-center gap-2">
            <Plus className="w-4 h-4 text-[#c9a96e]" /> Log Health Data
          </h2>
          <button onClick={onClose} className="text-white/40 hover:text-white/70"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 space-y-3">
          <div>
            <label className="text-white/50 text-xs block mb-1.5">Metric</label>
            <select value={form.type}
              onChange={e => {
                const meta = METRIC_ICONS[e.target.value];
                setForm(f => ({ ...f, type: e.target.value, unit: meta?.unit || '' }));
              }}
              className="w-full bg-[rgba(201,169,110,0.04)] border border-[rgba(201,169,110,0.12)] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-[rgba(201,169,110,0.5)]">
              {Object.entries(METRIC_ICONS).map(([key, { label }]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-white/50 text-xs block mb-1.5">Value</label>
              <input type="number" value={form.value} onChange={e => setForm(f => ({ ...f, value: e.target.value }))}
                placeholder="0"
                className="w-full bg-[rgba(201,169,110,0.04)] border border-[rgba(201,169,110,0.12)] rounded-xl px-3 py-2 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-[rgba(201,169,110,0.5)]" />
            </div>
            <div>
              <label className="text-white/50 text-xs block mb-1.5">Unit</label>
              <input type="text" value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}
                className="w-full bg-[rgba(201,169,110,0.04)] border border-[rgba(201,169,110,0.12)] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-[rgba(201,169,110,0.5)]" />
            </div>
          </div>
          <div>
            <label className="text-white/50 text-xs block mb-1.5">Date</label>
            <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
              className="w-full bg-[rgba(201,169,110,0.04)] border border-[rgba(201,169,110,0.12)] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-[rgba(201,169,110,0.5)]" />
          </div>
        </div>
        <div className="px-5 pb-5 flex gap-2">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-[rgba(201,169,110,0.12)] text-white/60 text-sm hover:bg-[rgba(201,169,110,0.04)]">Cancel</button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 py-2.5 rounded-xl bg-[#c9a96e] hover:bg-[#c9a96e] text-white text-sm font-medium disabled:opacity-50">
            {saving ? 'Saving…' : 'Log'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Service card ──────────────────────────────────────────────────────────────
function ServiceCard({ service, integration, onConnect, onDisconnect, onSync, syncing }:
  { service: typeof SERVICES[0]; integration?: Integration; onConnect: () => void;
    onDisconnect: () => void; onSync: () => void; syncing: boolean }) {
  const connected = !!integration;
  const lastSync  = integration?.lastSync;

  return (
    <div className={`border rounded-2xl p-4 transition-all ${connected ? service.activeColor : service.color}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="text-2xl leading-none mt-0.5">{service.logo}</div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-white text-sm font-medium">{service.name}</h3>
              {service.iosOnly && (
                <span className="text-[9px] border border-[rgba(201,169,110,0.18)] text-white/30 px-1.5 py-0.5 rounded-full">iOS</span>
              )}
              {connected && (
                <span className={`text-[10px] font-medium ${service.badgeColor} flex items-center gap-0.5`}>
                  <CheckCircle2 className="w-2.5 h-2.5" /> Connected
                </span>
              )}
            </div>
            <p className="text-white/35 text-[11px] mt-0.5">{service.description}</p>
            {lastSync && (
              <p className="text-white/20 text-[10px] mt-1">
                Last sync {new Date(lastSync).toLocaleString('en', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </p>
            )}
          </div>
        </div>
        <div className="shrink-0 flex flex-col items-end gap-1.5">
          {connected ? (
            <>
              <button onClick={onSync} disabled={syncing}
                className="flex items-center gap-1 text-white/40 hover:text-white/70 text-[11px] transition-colors">
                <RefreshCw className={`w-3 h-3 ${syncing ? 'animate-spin' : ''}`} />
                {syncing ? 'Syncing…' : 'Sync'}
              </button>
              <button onClick={onDisconnect}
                className="flex items-center gap-1 text-red-400/60 hover:text-red-400 text-[11px] transition-colors">
                <Trash2 className="w-3 h-3" /> Disconnect
              </button>
            </>
          ) : (
            <button onClick={onConnect}
              className="flex items-center gap-1.5 bg-[rgba(201,169,110,0.06)] hover:bg-white/12 border border-[rgba(201,169,110,0.12)] text-white/70 text-xs px-3 py-1.5 rounded-xl transition-all">
              <Wifi className="w-3 h-3" /> Connect
            </button>
          )}
        </div>
      </div>

      {/* Metrics tags */}
      {connected && (
        <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-[rgba(201,169,110,0.07)]">
          {service.metrics.map(m => {
            const meta = METRIC_ICONS[m];
            if (!meta) return null;
            return (
              <span key={m} className={`flex items-center gap-1 text-[10px] bg-[rgba(201,169,110,0.04)] rounded-full px-2 py-0.5 ${meta.color}`}>
                <meta.Icon className="w-2.5 h-2.5" /> {meta.label}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Connect modal ─────────────────────────────────────────────────────────────
function ConnectModal({ service, userId, onClose, onConnected }:
  { service: typeof SERVICES[0]; userId: string; onClose: () => void; onConnected: () => void }) {
  const [connecting, setConnecting] = useState(false);

  const handleConnect = async () => {
    setConnecting(true);
    try {
      // For OAuth services, redirect to OAuth flow
      // For demo / manual, directly connect
      const r = await authFetch(`${API}/users/${userId}/integrations`, {
        method: 'POST',
        body: JSON.stringify({
          service: service.id,
          scopes: service.metrics,
        }),
      });
      if (!r.ok) throw new Error('Connection failed');
      toast.success(`${service.name} connected!`);
      onConnected();
    } catch { toast.error('Connection failed'); }
    finally { setConnecting(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-[#0d0b08] border border-[rgba(201,169,110,0.12)] rounded-2xl w-full max-w-sm shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[rgba(201,169,110,0.07)]">
          <h2 className="text-white font-semibold text-sm flex items-center gap-2">
            <span className="text-xl">{service.logo}</span> Connect {service.name}
          </h2>
          <button onClick={onClose} className="text-white/40 hover:text-white/70"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 space-y-4">
          <p className="text-white/50 text-sm leading-relaxed">{service.description}</p>

          {/* What will be synced */}
          <div>
            <p className="text-white/30 text-[10px] uppercase tracking-wider mb-2">Data we'll sync</p>
            <div className="flex flex-wrap gap-2">
              {service.metrics.map(m => {
                const meta = METRIC_ICONS[m];
                if (!meta) return null;
                return (
                  <div key={m} className={`flex items-center gap-1.5 bg-[rgba(201,169,110,0.04)] border border-[rgba(201,169,110,0.07)] rounded-lg px-2.5 py-1.5 text-xs ${meta.color}`}>
                    <meta.Icon className="w-3 h-3" /> {meta.label}
                  </div>
                );
              })}
            </div>
          </div>

          {service.iosOnly && (
            <div className="flex items-start gap-2 bg-amber-500/10 border border-amber-500/20 rounded-xl px-3 py-2.5">
              <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <p className="text-amber-300/80 text-xs leading-relaxed">
                Apple Health requires the iOS app. This will connect once you install Flex on your iPhone.
              </p>
            </div>
          )}

          <div className="flex items-start gap-2 bg-[rgba(201,169,110,0.03)] border border-[rgba(201,169,110,0.07)] rounded-xl px-3 py-2.5">
            <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0 mt-0.5" />
            <p className="text-white/40 text-xs leading-relaxed">
              Your data stays private. We only read activity data and never share it with third parties.
            </p>
          </div>
        </div>
        <div className="px-5 pb-5 flex gap-2">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-[rgba(201,169,110,0.12)] text-white/60 text-sm hover:bg-[rgba(201,169,110,0.04)]">Cancel</button>
          <button onClick={handleConnect} disabled={connecting}
            className="flex-1 py-2.5 rounded-xl bg-[#c9a96e] hover:bg-[#c9a96e] text-white text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2">
            {connecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wifi className="w-4 h-4" />}
            {connecting ? 'Connecting…' : `Connect ${service.name}`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Health data summary ───────────────────────────────────────────────────────
function HealthSummary({ data }: { data: HealthDataPoint[] }) {
  // Get latest value per type
  const latest: Record<string, HealthDataPoint> = {};
  for (const d of data) {
    if (!latest[d.type] || d.date > latest[d.type].date) latest[d.type] = d;
  }

  const metrics = Object.values(latest);
  if (metrics.length === 0) return null;

  return (
    <div>
      <p className="text-white/30 text-[10px] uppercase tracking-wider mb-2">Today's Data</p>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {metrics.map(m => {
          const meta = METRIC_ICONS[m.type];
          if (!meta) return null;
          return (
            <div key={m.id} className="bg-[rgba(201,169,110,0.03)] border border-[rgba(201,169,110,0.07)] rounded-xl p-3">
              <div className={`flex items-center gap-1.5 mb-1.5 ${meta.color}`}>
                <meta.Icon className="w-3.5 h-3.5" />
                <span className="text-[10px] font-medium">{meta.label}</span>
              </div>
              <p className="text-white font-bold text-base">{m.value.toLocaleString()}</p>
              <p className="text-white/25 text-[10px]">{m.unit} · {m.source}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export function HealthIntegrationPage({ userId }: Props) {
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [healthData, setHealthData]     = useState<HealthDataPoint[]>([]);
  const [loading, setLoading]           = useState(true);
  const [syncing, setSyncing]           = useState<string | null>(null);
  const [connecting, setConnecting]     = useState<typeof SERVICES[0] | null>(null);
  const [showManual, setShowManual]     = useState(false);

  const load = useCallback(async () => {
    try {
      const [intRes, dataRes] = await Promise.all([
        authFetch(`${API}/users/${userId}/integrations`),
        authFetch(`${API}/users/${userId}/integrations/health-data`),
      ]);
      const intData  = await intRes.json();
      const dataData = await dataRes.json();
      setIntegrations(intData.integrations || []);
      setHealthData(dataData.data || []);
    } catch {}
    finally { setLoading(false); }
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  const handleSync = async (serviceId: string) => {
    setSyncing(serviceId);
    try {
      const r = await authFetch(`${API}/users/${userId}/integrations/${serviceId}/sync`, { method: 'POST' });
      if (!r.ok) throw new Error();
      toast.success('Synced!');
      await load();
    } catch { toast.error('Sync failed'); }
    finally { setSyncing(null); }
  };

  const handleDisconnect = async (serviceId: string) => {
    try {
      await authFetch(`${API}/users/${userId}/integrations/${serviceId}`, { method: 'DELETE' });
      toast.success('Disconnected');
      await load();
    } catch { toast.error('Failed to disconnect'); }
  };

  const connectedCount = integrations.length;

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 text-[#c9a96e] animate-spin" /></div>;
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-white font-semibold flex items-center gap-2">
            <Watch className="w-4 h-4 text-[#c9a96e]" /> Wearables & Health
          </h2>
          <p className="text-white/35 text-xs mt-0.5">
            {connectedCount > 0 ? `${connectedCount} device${connectedCount > 1 ? 's' : ''} connected` : 'Connect your wearable or health app'}
          </p>
        </div>
        <button onClick={() => setShowManual(true)}
          className="flex items-center gap-1.5 bg-[rgba(201,169,110,0.05)] hover:bg-[rgba(201,169,110,0.08)] border border-[rgba(201,169,110,0.12)] text-white/60 text-xs font-medium px-3 py-1.5 rounded-xl transition-all">
          <Plus className="w-3.5 h-3.5" /> Manual
        </button>
      </div>

      {/* Summary of today's health data */}
      {healthData.length > 0 && <HealthSummary data={healthData} />}

      {/* No data prompt */}
      {connectedCount === 0 && healthData.length === 0 && (
        <div className="bg-[rgba(201,169,110,0.04)] border border-[#c9a96e]/15 rounded-2xl px-4 py-4 flex items-start gap-3">
          <Watch className="w-5 h-5 text-[#c9a96e] shrink-0 mt-0.5" />
          <div>
            <p className="text-white/70 text-sm font-medium">Connect a wearable to auto-sync your data</p>
            <p className="text-white/30 text-xs mt-0.5 leading-relaxed">
              Steps, heart rate, sleep, and calories will appear here automatically after each sync.
            </p>
          </div>
        </div>
      )}

      {/* Service cards */}
      <div>
        <p className="text-white/30 text-[10px] uppercase tracking-wider mb-3">Available Integrations</p>
        <div className="space-y-3">
          {SERVICES.map(service => {
            const integration = integrations.find(i => i.service === service.id);
            return (
              <ServiceCard
                key={service.id}
                service={service}
                integration={integration}
                onConnect={() => setConnecting(service)}
                onDisconnect={() => handleDisconnect(service.id)}
                onSync={() => handleSync(service.id)}
                syncing={syncing === service.id}
              />
            );
          })}
        </div>
      </div>

      {/* Data history */}
      {healthData.length > 0 && (
        <div>
          <p className="text-white/30 text-[10px] uppercase tracking-wider mb-2">Recent Data</p>
          <div className="space-y-1.5">
            {healthData.slice(0, 10).map(d => {
              const meta = METRIC_ICONS[d.type];
              return (
                <div key={d.id} className="bg-[rgba(201,169,110,0.03)] border border-[rgba(201,169,110,0.06)] rounded-xl px-3 py-2.5 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    {meta && <meta.Icon className={`w-4 h-4 ${meta.color}`} />}
                    <div>
                      <p className="text-white/70 text-xs font-medium">{meta?.label || d.type}</p>
                      <p className="text-white/25 text-[10px]">
                        {new Date(d.date).toLocaleDateString('en', { weekday: 'short', month: 'short', day: 'numeric' })}
                        {' · '}{d.source}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`font-bold text-sm ${meta?.color || 'text-white/60'}`}>
                      {d.value.toLocaleString()}
                    </p>
                    <p className="text-white/25 text-[10px]">{d.unit}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Modals */}
      {connecting && (
        <ConnectModal
          service={connecting}
          userId={userId}
          onClose={() => setConnecting(null)}
          onConnected={() => { setConnecting(null); load(); }}
        />
      )}
      {showManual && (
        <ManualEntryModal
          userId={userId}
          onClose={() => setShowManual(false)}
          onSaved={() => { setShowManual(false); load(); }}
        />
      )}
    </div>
  );
}
