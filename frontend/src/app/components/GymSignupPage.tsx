// GymSignupPage.tsx — Dedicated registration page for gym owners
import { signIn } from "../../services/authService";
import { useState } from 'react';
import { Building2, MapPin, Phone, Globe, FileText, ArrowRight, ArrowLeft, Loader2, CheckCircle2, Dumbbell } from 'lucide-react';
import { toast } from 'sonner';

import { API } from '../../config';

const AMENITIES_LIST = [
  'Free Weights', 'Cardio Machines', 'Weight Machines', 'Swimming Pool',
  'Sauna', 'Steam Room', 'Showers', 'Lockers', 'Parking', 'Wi-Fi',
  'Personal Training', 'Group Classes', 'Boxing Ring', 'Rock Climbing',
  'Basketball Court', 'Cafe / Juice Bar', 'Towel Service', 'Kids Area',
];

interface GymSignupPageProps {
  onSuccess: (uid: string, email: string, password: string) => void;
  onBack: () => void;
}

export function GymSignupPage({ onSuccess, onBack }: GymSignupPageProps) {
  const [step, setStep] = useState(1); // 1 = gym info, 2 = location, 3 = account
  const [loading, setLoading] = useState(false);
  const [registered, setRegistered] = useState(false);
  const [done, setDone] = useState(false);

  // Step 1 — Gym info
  const [gymName, setGymName]       = useState('');
  const [description, setDescription] = useState('');
  const [selectedAmenities, setSelectedAmenities] = useState<string[]>([]);

  // Step 2 — Location
  const [address, setAddress] = useState('');
  const [city, setCity]       = useState('');
  const [country, setCountry] = useState('');
  const [phone, setPhone]     = useState('');
  const [website, setWebsite] = useState('');

  // Step 3 — Account
  const [email, setEmail]           = useState('');
  const [password, setPassword]     = useState('');
  const [confirmPw, setConfirmPw]   = useState('');

  const toggleAmenity = (a: string) =>
    setSelectedAmenities(prev => prev.includes(a) ? prev.filter(x => x !== a) : [...prev, a]);

  const handleSubmit = async () => {
    if (!email || !password) return toast.error('Email and password required');
    if (password !== confirmPw) return toast.error("Passwords don't match");
    if (password.length < 6) return toast.error('Password must be at least 6 characters');

    setLoading(true);
    try {
      const res = await fetch(`${API}/gyms/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, gymName, address, city, country, phone, website, description }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Registration failed');
      }
      setDone(true);
      setTimeout(() => onSuccess('', email, password), 1500);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  if (done) {
  
  if (registered) {
    return (
      <div className="min-h-screen bg-[#080608] flex items-center justify-center">
        <div className="text-center">
          <svg className="w-16 h-16 text-emerald-400 mx-auto mb-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
          <h2 className="text-2xl font-bold text-white mb-2">Gym registered!</h2>
          <p className="text-white/50">Signing you in…</p>
        </div>
      </div>
    );
  }

  return (
      <div className="min-h-screen bg-[#080608] flex items-center justify-center">
        <div className="text-center">
          <CheckCircle2 className="w-16 h-16 text-emerald-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white mb-2">Gym registered!</h2>
          <p className="text-white/50">Signing you in…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#080608] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-5 border-b border-[rgba(201,169,110,0.08)]">
        <button onClick={step === 1 ? onBack : () => setStep(s => s - 1)} className="flex items-center gap-2 text-white/40 hover:text-white/70 transition-colors text-sm">
          <ArrowLeft className="w-4 h-4" />
          {step === 1 ? 'Back to login' : 'Back'}
        </button>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-[rgba(201,169,110,0.12)] flex items-center justify-center">
            <Dumbbell className="w-4 h-4 text-[#c9a96e]" />
          </div>
          <span className="font-bold text-white text-sm">Flex for Gyms</span>
        </div>
        {/* Step indicator */}
        <div className="flex items-center gap-1.5">
          {[1,2,3].map(s => (
            <div key={s} className={`rounded-full transition-all ${s === step ? 'w-6 h-2 bg-[#c9a96e]' : s < step ? 'w-2 h-2 bg-[#c9a96e]' : 'w-2 h-2 bg-white/15'}`} />
          ))}
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-lg">

          {/* ── Step 1: Gym Info ── */}
          {step === 1 && (
            <div>
              <div className="mb-8">
                <h1 className="text-3xl font-bold text-white mb-2">Tell us about your gym</h1>
                <p className="text-white/40">This is what members will see on your profile.</p>
              </div>

              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-sm text-white/50 mb-1.5">Gym name *</label>
                  <div className="relative">
                    <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                    <input
                      value={gymName}
                      onChange={e => setGymName(e.target.value)}
                      placeholder="e.g. Iron House Gym"
                      className="w-full bg-[rgba(201,169,110,0.04)] border border-[rgba(201,169,110,0.12)] rounded-xl pl-10 pr-4 py-3 text-white placeholder-white/25 focus:outline-none focus:border-[#c9a96e]/50 focus:bg-[#c9a96e]/5 transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm text-white/50 mb-1.5">Description</label>
                  <div className="relative">
                    <FileText className="absolute left-3 top-3.5 w-4 h-4 text-white/30" />
                    <textarea
                      value={description}
                      onChange={e => setDescription(e.target.value)}
                      placeholder="Tell members what makes your gym special…"
                      rows={3}
                      className="w-full bg-[rgba(201,169,110,0.04)] border border-[rgba(201,169,110,0.12)] rounded-xl pl-10 pr-4 py-3 text-white placeholder-white/25 focus:outline-none focus:border-[#c9a96e]/50 focus:bg-[#c9a96e]/5 transition-all resize-none"
                    />
                  </div>
                </div>
              </div>

              {/* Amenities */}
              <div className="mb-8">
                <label className="block text-sm text-white/50 mb-3">Amenities</label>
                <div className="flex flex-wrap gap-2">
                  {AMENITIES_LIST.map(a => (
                    <button
                      key={a}
                      onClick={() => toggleAmenity(a)}
                      className={`px-3 py-1.5 rounded-xl text-sm border transition-all ${
                        selectedAmenities.includes(a)
                          ? 'bg-[rgba(201,169,110,0.12)] border-[#c9a96e]/50 text-[#e8c98a]'
                          : 'bg-[rgba(201,169,110,0.04)] border-[rgba(201,169,110,0.12)] text-white/50 hover:text-white/70 hover:border-[rgba(201,169,110,0.18)]'
                      }`}
                    >
                      {a}
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={() => { if (!gymName.trim()) return toast.error('Gym name is required'); setStep(2); }}
                className="w-full py-3.5 rounded-2xl bg-[#c9a96e] hover:bg-[#c9a96e] text-white font-semibold flex items-center justify-center gap-2 transition-all"
              >
                Continue <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* ── Step 2: Location ── */}
          {step === 2 && (
            <div>
              <div className="mb-8">
                <h1 className="text-3xl font-bold text-white mb-2">Where are you located?</h1>
                <p className="text-white/40">Help members find you on the map.</p>
              </div>

              <div className="space-y-4 mb-8">
                <div>
                  <label className="block text-sm text-white/50 mb-1.5">Street address</label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                    <input
                      value={address}
                      onChange={e => setAddress(e.target.value)}
                      placeholder="123 Fitness Street"
                      className="w-full bg-[rgba(201,169,110,0.04)] border border-[rgba(201,169,110,0.12)] rounded-xl pl-10 pr-4 py-3 text-white placeholder-white/25 focus:outline-none focus:border-[#c9a96e]/50 focus:bg-[#c9a96e]/5 transition-all"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm text-white/50 mb-1.5">City *</label>
                    <input
                      value={city}
                      onChange={e => setCity(e.target.value)}
                      placeholder="Dubai"
                      className="w-full bg-[rgba(201,169,110,0.04)] border border-[rgba(201,169,110,0.12)] rounded-xl px-4 py-3 text-white placeholder-white/25 focus:outline-none focus:border-[#c9a96e]/50 focus:bg-[#c9a96e]/5 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-white/50 mb-1.5">Country *</label>
                    <input
                      value={country}
                      onChange={e => setCountry(e.target.value)}
                      placeholder="UAE"
                      className="w-full bg-[rgba(201,169,110,0.04)] border border-[rgba(201,169,110,0.12)] rounded-xl px-4 py-3 text-white placeholder-white/25 focus:outline-none focus:border-[#c9a96e]/50 focus:bg-[#c9a96e]/5 transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm text-white/50 mb-1.5">Phone number</label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                    <input
                      value={phone}
                      onChange={e => setPhone(e.target.value)}
                      placeholder="+971 50 000 0000"
                      className="w-full bg-[rgba(201,169,110,0.04)] border border-[rgba(201,169,110,0.12)] rounded-xl pl-10 pr-4 py-3 text-white placeholder-white/25 focus:outline-none focus:border-[#c9a96e]/50 focus:bg-[#c9a96e]/5 transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm text-white/50 mb-1.5">Website</label>
                  <div className="relative">
                    <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                    <input
                      value={website}
                      onChange={e => setWebsite(e.target.value)}
                      placeholder="https://yourgym.com"
                      className="w-full bg-[rgba(201,169,110,0.04)] border border-[rgba(201,169,110,0.12)] rounded-xl pl-10 pr-4 py-3 text-white placeholder-white/25 focus:outline-none focus:border-[#c9a96e]/50 focus:bg-[#c9a96e]/5 transition-all"
                    />
                  </div>
                </div>
              </div>

              <button
                onClick={() => { if (!city.trim() || !country.trim()) return toast.error('City and country are required'); setStep(3); }}
                className="w-full py-3.5 rounded-2xl bg-[#c9a96e] hover:bg-[#c9a96e] text-white font-semibold flex items-center justify-center gap-2 transition-all"
              >
                Continue <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* ── Step 3: Account ── */}
          {step === 3 && (
            <div>
              <div className="mb-8">
                <h1 className="text-3xl font-bold text-white mb-2">Create your account</h1>
                <p className="text-white/40">This is how you'll log into your gym dashboard.</p>
              </div>

              {/* Summary card */}
              <div className="bg-[rgba(201,169,110,0.08)] border border-[#c9a96e]/20 rounded-2xl p-4 mb-6 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[rgba(201,169,110,0.12)] flex items-center justify-center shrink-0">
                  <Building2 className="w-5 h-5 text-[#c9a96e]" />
                </div>
                <div>
                  <p className="text-white font-medium text-sm">{gymName}</p>
                  <p className="text-white/40 text-xs">{city}{country ? `, ${country}` : ''}</p>
                </div>
              </div>

              <div className="space-y-4 mb-8">
                <div>
                  <label className="block text-sm text-white/50 mb-1.5">Email address *</label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="owner@yourgym.com"
                    className="w-full bg-[rgba(201,169,110,0.04)] border border-[rgba(201,169,110,0.12)] rounded-xl px-4 py-3 text-white placeholder-white/25 focus:outline-none focus:border-[#c9a96e]/50 focus:bg-[#c9a96e]/5 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm text-white/50 mb-1.5">Password *</label>
                  <input
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="At least 6 characters"
                    className="w-full bg-[rgba(201,169,110,0.04)] border border-[rgba(201,169,110,0.12)] rounded-xl px-4 py-3 text-white placeholder-white/25 focus:outline-none focus:border-[#c9a96e]/50 focus:bg-[#c9a96e]/5 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm text-white/50 mb-1.5">Confirm password *</label>
                  <input
                    type="password"
                    value={confirmPw}
                    onChange={e => setConfirmPw(e.target.value)}
                    placeholder="Repeat password"
                    className="w-full bg-[rgba(201,169,110,0.04)] border border-[rgba(201,169,110,0.12)] rounded-xl px-4 py-3 text-white placeholder-white/25 focus:outline-none focus:border-[#c9a96e]/50 focus:bg-[#c9a96e]/5 transition-all"
                  />
                </div>
              </div>

              <button
                onClick={handleSubmit}
                disabled={loading}
                className="w-full py-3.5 rounded-2xl bg-[#c9a96e] hover:bg-[#c9a96e] disabled:opacity-50 text-white font-semibold flex items-center justify-center gap-2 transition-all"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
                {loading ? 'Registering…' : 'Register gym'}
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
