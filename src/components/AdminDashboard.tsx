import { useState, useEffect, useMemo } from 'react';
import {
  LayoutDashboard,
  Calendar,
  Stethoscope,
  Users,
  Clock,
  Image as ImageIcon,
  Settings as SettingsIcon,
  MessageSquare,
  LogOut,
  Search,
  Plus,
  Trash2,
  Check,
  X,
  ArrowLeft,
  ShieldCheck,
  RefreshCw,
  Upload,
  ExternalLink,
  Pencil,
  Download,
} from 'lucide-react';
import {
  formatDateReadable,
  formatTime12h,
  getTodayIstIso,
  buildWhatsAppUrl,
  resizeImageFileToDataUrl,
} from '../lib/clinicUtils.ts';
import type {
  Appointment,
  AppointmentStatus,
  AvailabilitySlot,
  BlockedDate,
  ClinicSettings,
  ContactEnquiry,
  Doctor,
  FaqItem,
  GalleryItem,
  IntegrationStatus,
  PatientType,
  PaymentStatus,
  Testimonial,
  Treatment,
} from '../types/clinic.ts';

interface AdminDashboardProps {
  onNavigate: (path: string) => void;
  onDataUpdated: () => void;
}

type AdminTab =
  | 'overview'
  | 'appointments'
  | 'treatments'
  | 'doctors'
  | 'schedule'
  | 'gallery'
  | 'enquiries'
  | 'settings';

export function AdminDashboard({ onNavigate, onDataUpdated }: AdminDashboardProps) {
  const [authChecking, setAuthChecking] = useState(true);
  const [adminUser, setAdminUser] = useState<{ email: string; name: string } | null>(null);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loggingIn, setLoggingIn] = useState(false);

  const [tab, setTab] = useState<AdminTab>('overview');
  const [loadingData, setLoadingData] = useState(false);
  const [toast, setToast] = useState<string>('');

  // Dashboard data
  const [settings, setSettings] = useState<ClinicSettings | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [treatments, setTreatments] = useState<Treatment[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [blockedDates, setBlockedDates] = useState<BlockedDate[]>([]);
  const [gallery, setGallery] = useState<GalleryItem[]>([]);
  const [testimonials, setTestimonials] = useState<Testimonial[]>([]);
  const [faqs, setFaqs] = useState<FaqItem[]>([]);
  const [enquiries, setEnquiries] = useState<ContactEnquiry[]>([]);
  const [integrations, setIntegrations] = useState<IntegrationStatus | null>(null);

  // Appointment filters
  const [apptSearch, setApptSearch] = useState('');
  const [apptDateFilter, setApptDateFilter] = useState('');
  const [apptTreatmentFilter, setApptTreatmentFilter] = useState('');
  const [apptStatusFilter, setApptStatusFilter] = useState('');

  // Reschedule modal
  const [rescheduleTarget, setRescheduleTarget] = useState<Appointment | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleTime, setRescheduleTime] = useState('');
  const [rescheduleSlots, setRescheduleSlots] = useState<AvailabilitySlot[]>([]);
  const [rescheduleError, setRescheduleError] = useState('');

  // Full Edit / View Appointment modal
  const [editingAppt, setEditingAppt] = useState<Appointment | null>(null);
  const [editApptError, setEditApptError] = useState('');
  const [savingApptEdit, setSavingApptEdit] = useState(false);

  // Create Walk-in / Phone Appointment modal
  const [creatingAppt, setCreatingAppt] = useState(false);
  const [newApptForm, setNewApptForm] = useState({
    treatmentId: 1,
    doctorId: 1,
    appointmentDate: getTodayIstIso(),
    appointmentTime: '10:00',
    patientName: '',
    patientPhone: '',
    patientEmail: '',
    patientType: 'first-time' as PatientType,
    notes: '',
    status: 'Confirmed' as AppointmentStatus,
  });
  const [newApptError, setNewApptError] = useState('');

  // Treatment editing
  const [editingTreatment, setEditingTreatment] = useState<Partial<Treatment> | null>(null);
  const [newFaqQ, setNewFaqQ] = useState('');
  const [newFaqA, setNewFaqA] = useState('');

  // Doctor editing
  const [editingDoctor, setEditingDoctor] = useState<Partial<Doctor> | null>(null);

  // Blocked date form
  const [blockDate, setBlockDate] = useState('');
  const [blockDoctorId, setBlockDoctorId] = useState<string>('');
  const [blockStartTime, setBlockStartTime] = useState('');
  const [blockEndTime, setBlockEndTime] = useState('');
  const [blockReason, setBlockReason] = useState('');

  // Gallery add form
  const [newGalTitle, setNewGalTitle] = useState('');
  const [newGalCat, setNewGalCat] = useState<GalleryItem['category']>('Clinic Interior');
  const [newGalUrl, setNewGalUrl] = useState('');
  const [newGalCaption, setNewGalCaption] = useState('');
  const [newGalOfficial, setNewGalOfficial] = useState(true);

  // Testimonial add form
  const [newTestName, setNewTestName] = useState('');
  const [newTestTreatment, setNewTestTreatment] = useState('');
  const [newTestQuote, setNewTestQuote] = useState('');
  const [newTestDate, setNewTestDate] = useState('');
  const [newTestApproved, setNewTestApproved] = useState(true);

  // FAQ add form
  const [faqQ, setFaqQ] = useState('');
  const [faqA, setFaqA] = useState('');
  const [faqCat, setFaqCat] = useState('General');

  // Password change
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3500);
  };

  const fetchDashboard = async () => {
    setLoadingData(true);
    try {
      const resp = await fetch('/api/admin/dashboard');
      if (resp.status === 401) {
        setAdminUser(null);
        return;
      }
      const data = await resp.json();
      setSettings(data.settings);
      setAppointments(data.appointments);
      setTreatments(data.treatments);
      setDoctors(data.doctors);
      setBlockedDates(data.blockedDates);
      setGallery(data.gallery);
      setTestimonials(data.testimonials);
      setFaqs(data.faqs);
      setEnquiries(data.enquiries);
      setIntegrations(data.integrations);
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    fetch('/api/admin/me')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.authenticated) {
          setAdminUser(data.user);
          fetchDashboard();
        }
      })
      .finally(() => setAuthChecking(false));
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setLoggingIn(true);
    try {
      const resp = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginEmail, password: loginPassword }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        setLoginError(data.error || 'Sign-in failed.');
        return;
      }
      setAdminUser(data.user);
      setLoginPassword('');
      await fetchDashboard();
    } catch {
      setLoginError('Network error while signing in.');
    } finally {
      setLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    await fetch('/api/admin/logout', { method: 'POST' });
    setAdminUser(null);
  };

  const todayIso = getTodayIstIso();

  const stats = useMemo(() => {
    const total = appointments.length;
    const today = appointments.filter(
      (a) => a.appointmentDate === todayIso && a.status !== 'Cancelled',
    ).length;
    const upcoming = appointments.filter(
      (a) =>
        a.appointmentDate >= todayIso &&
        (a.status === 'Pending' || a.status === 'Confirmed' || a.status === 'Rescheduled'),
    ).length;
    const pending = appointments.filter((a) => a.status === 'Pending').length;
    const completed = appointments.filter((a) => a.status === 'Completed').length;
    const cancelled = appointments.filter((a) => a.status === 'Cancelled').length;
    return { total, today, upcoming, pending, completed, cancelled };
  }, [appointments, todayIso]);

  const filteredAppointments = useMemo(() => {
    const q = apptSearch.trim().toLowerCase();
    return appointments.filter((a) => {
      if (
        q &&
        !a.patientName.toLowerCase().includes(q) &&
        !a.patientPhone.toLowerCase().includes(q) &&
        !a.referenceCode.toLowerCase().includes(q)
      ) {
        return false;
      }
      if (apptDateFilter && a.appointmentDate !== apptDateFilter) return false;
      if (apptTreatmentFilter && String(a.treatmentId) !== apptTreatmentFilter) return false;
      if (apptStatusFilter && a.status !== apptStatusFilter) return false;
      return true;
    });
  }, [appointments, apptSearch, apptDateFilter, apptTreatmentFilter, apptStatusFilter]);

  const updateAppointmentStatus = async (id: number, status: AppointmentStatus) => {
    const resp = await fetch(`/api/admin/appointments/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    const data = await resp.json();
    if (!resp.ok) {
      showToast(data.error || 'Could not update appointment.');
      return;
    }
    setAppointments((prev) => prev.map((a) => (a.id === id ? data.appointment : a)));
    if (data.supabaseSynced) {
      showToast(`Appointment marked ${status} & synced to Supabase.`);
    } else if (integrations?.supabaseConfigured && !integrations?.supabaseSecretConfigured) {
      showToast(`Appointment marked ${status} locally (add SUPABASE_SECRET_KEY in .env for Supabase updates).`);
    } else {
      showToast(`Appointment marked ${status}.`);
    }
  };

  const openReschedule = (appt: Appointment) => {
    setRescheduleTarget(appt);
    setRescheduleDate(appt.appointmentDate);
    setRescheduleTime('');
    setRescheduleError('');
    fetch(
      `/api/availability?date=${encodeURIComponent(appt.appointmentDate)}&doctorId=${appt.doctorId}&treatmentId=${appt.treatmentId}`,
    )
      .then((r) => r.json())
      .then((d) => setRescheduleSlots(Array.isArray(d.slots) ? d.slots : []));
  };

  useEffect(() => {
    if (!rescheduleTarget || !rescheduleDate) return;
    fetch(
      `/api/availability?date=${encodeURIComponent(rescheduleDate)}&doctorId=${rescheduleTarget.doctorId}&treatmentId=${rescheduleTarget.treatmentId}`,
    )
      .then((r) => r.json())
      .then((d) => setRescheduleSlots(Array.isArray(d.slots) ? d.slots : []));
  }, [rescheduleDate, rescheduleTarget]);

  const confirmReschedule = async () => {
    if (!rescheduleTarget || !rescheduleDate || !rescheduleTime) return;
    setRescheduleError('');
    const resp = await fetch(`/api/admin/appointments/${rescheduleTarget.id}/reschedule`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ appointmentDate: rescheduleDate, appointmentTime: rescheduleTime }),
    });
    const data = await resp.json();
    if (!resp.ok) {
      setRescheduleError(data.error || 'Failed to reschedule.');
      return;
    }
    setAppointments((prev) => prev.map((a) => (a.id === data.appointment.id ? data.appointment : a)));
    setRescheduleTarget(null);
    showToast(
      data.supabaseSynced
        ? 'Appointment rescheduled & synced to Supabase.'
        : 'Appointment rescheduled locally.',
    );
  };

  const saveClinicSettings = async (next: ClinicSettings) => {
    const resp = await fetch('/api/admin/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(next),
    });
    if (resp.ok) {
      const data = await resp.json();
      setSettings(data.settings);
      onDataUpdated();
      showToast('Clinic settings saved.');
    }
  };

  const saveTreatmentForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTreatment) return;
    const isNew = !editingTreatment.id;
    const url = isNew ? '/api/admin/treatments' : `/api/admin/treatments/${editingTreatment.id}`;
    const resp = await fetch(url, {
      method: isNew ? 'POST' : 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editingTreatment),
    });
    const data = await resp.json();
    if (!resp.ok) {
      showToast(data.error || 'Failed to save treatment.');
      return;
    }
    setTreatments(data.treatments);
    setEditingTreatment(null);
    onDataUpdated();
    showToast(isNew ? 'Treatment added.' : 'Treatment updated.');
  };

  const saveDoctorForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDoctor) return;
    const isNew = !editingDoctor.id;
    const url = isNew ? '/api/admin/doctors' : `/api/admin/doctors/${editingDoctor.id}`;
    const resp = await fetch(url, {
      method: isNew ? 'POST' : 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editingDoctor),
    });
    const data = await resp.json();
    if (!resp.ok) {
      showToast(data.error || 'Failed to save dentist profile.');
      return;
    }
    setDoctors(data.doctors);
    setEditingDoctor(null);
    onDataUpdated();
    showToast('Dentist profile saved.');
  };

  if (authChecking) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center text-sm text-[#71808D]">
        Checking clinic administrator session...
      </div>
    );
  }

  if (!adminUser) {
    return (
      <div className="min-h-[75vh] flex items-center justify-center px-4 py-12 bg-[#F1F7F7]">
        <div className="w-full max-w-md bg-white border border-[#12304A]/15 rounded-2xl p-8 shadow-sm space-y-6">
          <div>
            <button
              type="button"
              onClick={() => onNavigate('/')}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#71808D] hover:text-[#12304A] mb-4 cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Return to Clinic Website</span>
            </button>
            <div className="flex items-center gap-2.5 text-[#12304A]">
              <ShieldCheck className="w-6 h-6 text-[#19A7A1]" />
              <h1 className="font-display text-2xl">Clinic Staff Sign In</h1>
            </div>
            <p className="text-sm text-[#71808D] mt-1">
              Authorized access for Raghan Dental and Implant Care administration.
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[#263746] mb-1.5">Staff Email</label>
              <input
                type="email"
                required
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                placeholder="admin@raghandental.in"
                className="w-full px-3.5 py-2.5 rounded-lg border border-[#12304A]/20 text-sm focus:outline-none focus:border-[#19A7A1]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#263746] mb-1.5">Password</label>
              <input
                type="password"
                required
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                placeholder="Enter password"
                className="w-full px-3.5 py-2.5 rounded-lg border border-[#12304A]/20 text-sm focus:outline-none focus:border-[#19A7A1]"
              />
            </div>
            {loginError && (
              <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {loginError}
              </p>
            )}
            <button
              type="submit"
              disabled={loggingIn}
              className="w-full py-2.5 rounded-lg bg-[#12304A] hover:bg-[#19A7A1] text-white text-sm font-semibold transition-colors cursor-pointer disabled:opacity-60"
            >
              {loggingIn ? 'Signing In...' : 'Sign In to Dashboard'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  const sidebarItems: Array<{ id: AdminTab; label: string; icon: React.ComponentType<{ className?: string }> }> = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'appointments', label: 'Appointments', icon: Calendar },
    { id: 'treatments', label: 'Treatments', icon: Stethoscope },
    { id: 'doctors', label: 'Dentists', icon: Users },
    { id: 'schedule', label: 'Schedule & Holidays', icon: Clock },
    { id: 'gallery', label: 'Gallery & Testimonials', icon: ImageIcon },
    { id: 'enquiries', label: 'Enquiries & FAQs', icon: MessageSquare },
    { id: 'settings', label: 'Website & Settings', icon: SettingsIcon },
  ];

  return (
    <div className="min-h-[85vh] bg-[#F1F7F7] flex flex-col lg:flex-row">
      {/* Sidebar */}
      <aside className="w-full lg:w-64 bg-[#12304A] text-white shrink-0 flex flex-col justify-between">
        <div className="p-5 space-y-6">
          <div>
            <p className="text-xs text-[#C6A66B] font-semibold">Clinic Management</p>
            <h1 className="font-display text-xl mt-0.5">Raghan Dental Admin</h1>
            <p className="text-xs text-white/65 mt-1 truncate">{adminUser.email}</p>
          </div>

          <nav className="flex lg:flex-col gap-1 overflow-x-auto pb-2 lg:pb-0">
            {sidebarItems.map((item) => {
              const Icon = item.icon;
              const active = tab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setTab(item.id)}
                  className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                    active ? 'bg-[#19A7A1] text-white' : 'text-white/80 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        <div className="p-5 border-t border-white/15 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => onNavigate('/')}
            className="text-xs font-medium text-white/80 hover:text-white cursor-pointer"
          >
            View Live Site
          </button>
          <button
            type="button"
            onClick={handleLogout}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#C6A66B] hover:text-white cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-5 sm:p-8 max-w-6xl w-full space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-[#12304A]/10">
          <div className="text-sm text-[#71808D]">
            Clinic Admin <span aria-hidden="true">/</span>{' '}
            <span className="font-semibold text-[#12304A]">
              {sidebarItems.find((i) => i.id === tab)?.label}
            </span>
          </div>
          <div className="flex items-center gap-3">
            {toast && (
              <span className="text-xs font-semibold text-[#12304A] bg-[#19A7A1]/20 px-3 py-1.5 rounded-lg">
                {toast}
              </span>
            )}
            <button
              type="button"
              onClick={fetchDashboard}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-[#12304A]/15 text-xs font-semibold text-[#12304A] hover:bg-[#FAFCFC] cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingData ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* OVERVIEW TAB */}
        {tab === 'overview' && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
              {[
                { label: 'Total', val: stats.total, color: 'text-[#12304A]' },
                { label: "Today's", val: stats.today, color: 'text-[#19A7A1]' },
                { label: 'Upcoming', val: stats.upcoming, color: 'text-[#12304A]' },
                { label: 'Pending', val: stats.pending, color: 'text-amber-700' },
                { label: 'Completed', val: stats.completed, color: 'text-emerald-700' },
                { label: 'Cancelled', val: stats.cancelled, color: 'text-red-700' },
              ].map((m) => (
                <div key={m.label} className="bg-white border border-[#12304A]/10 rounded-xl p-4">
                  <span className="block text-xs text-[#71808D]">{m.label} Appointments</span>
                  <span className={`block font-display text-3xl mt-1 tabular-nums ${m.color}`}>{m.val}</span>
                </div>
              ))}
            </div>

            {integrations && (
              <div className="bg-white border border-[#12304A]/10 rounded-xl p-5 space-y-3">
                <h2 className="font-display text-xl text-[#12304A]">System &amp; Integration Configuration</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
                  <div className="p-3.5 rounded-lg bg-[#FAFCFC] border border-[#12304A]/10 space-y-2">
                    <span className="font-semibold text-[#12304A] block">Supabase Database</span>
                    <span
                      className={`block ${
                        integrations.supabaseAppointmentsTableReady
                          ? 'text-emerald-700'
                          : integrations.supabaseConfigured
                            ? 'text-amber-700'
                            : 'text-[#71808D]'
                      }`}
                    >
                      {integrations.supabaseStatusMessage || 'Checking Supabase connection...'}
                    </span>
                    {integrations.supabaseConfigured && !integrations.supabaseAppointmentsTableReady && (
                      <button
                        type="button"
                        onClick={async () => {
                          const r = await fetch('/api/admin/supabase-schema');
                          if (r.ok) {
                            const d = await r.json();
                            await navigator.clipboard.writeText(d.sql);
                            showToast('Supabase SQL schema copied to clipboard!');
                          }
                        }}
                        className="px-2.5 py-1.5 rounded bg-[#12304A] text-white font-semibold cursor-pointer"
                      >
                        Copy SQL Schema
                      </button>
                    )}
                  </div>
                  <div className="p-3.5 rounded-lg bg-[#FAFCFC] border border-[#12304A]/10">
                    <span className="font-semibold text-[#12304A] block">WhatsApp Business API</span>
                    <span className={integrations.whatsappConfigured ? 'text-emerald-700' : 'text-amber-700'}>
                      {integrations.whatsappConfigured
                        ? 'Configured — automated notifications active'
                        : 'Credentials not configured (set WHATSAPP_API_TOKEN & WHATSAPP_PHONE_NUMBER_ID in .env)'}
                    </span>
                  </div>
                  <div className="p-3.5 rounded-lg bg-[#FAFCFC] border border-[#12304A]/10">
                    <span className="font-semibold text-[#12304A] block">Razorpay Online Payments</span>
                    <span className={integrations.razorpayConfigured ? 'text-emerald-700' : 'text-amber-700'}>
                      {integrations.razorpayConfigured
                        ? 'Credentials configured — toggle in Website & Settings'
                        : 'Keys not configured (set RAZORPAY_KEY_ID & RAZORPAY_KEY_SECRET in .env)'}
                    </span>
                  </div>
                  <div className="p-3.5 rounded-lg bg-[#FAFCFC] border border-[#12304A]/10">
                    <span className="font-semibold text-[#12304A] block">Email Notifications (Resend)</span>
                    <span className={integrations.emailConfigured ? 'text-emerald-700' : 'text-amber-700'}>
                      {integrations.emailConfigured
                        ? 'Configured — email alerts active'
                        : 'Not configured (set RESEND_API_KEY in .env)'}
                    </span>
                  </div>
                </div>
              </div>
            )}

            <div className="bg-white border border-[#12304A]/10 rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-display text-xl text-[#12304A]">Recent &amp; Pending Requests</h2>
                <button
                  type="button"
                  onClick={() => setTab('appointments')}
                  className="text-xs font-semibold text-[#19A7A1] hover:underline cursor-pointer"
                >
                  Manage All Appointments
                </button>
              </div>
              {appointments.length === 0 ? (
                <p className="text-sm text-[#71808D] py-6 text-center">
                  No appointments scheduled yet. New online patient bookings will appear here immediately.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-[#12304A]/10 text-[#71808D]">
                        <th className="py-2 pr-3">Ref</th>
                        <th className="py-2 pr-3">Patient</th>
                        <th className="py-2 pr-3">Treatment</th>
                        <th className="py-2 pr-3">Date &amp; Time</th>
                        <th className="py-2 pr-3">Status</th>
                        <th className="py-2">Quick Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {appointments.slice(0, 8).map((a) => (
                        <tr key={a.id} className="border-b border-[#12304A]/5">
                          <td className="py-2.5 pr-3 font-mono tabular-nums">{a.referenceCode}</td>
                          <td className="py-2.5 pr-3">
                            <span className="font-semibold text-[#12304A] block">{a.patientName}</span>
                            <span className="text-[#71808D] tabular-nums">{a.patientPhone}</span>
                          </td>
                          <td className="py-2.5 pr-3">{a.treatmentTitle}</td>
                          <td className="py-2.5 pr-3 tabular-nums">
                            {formatDateReadable(a.appointmentDate)} · {formatTime12h(a.appointmentTime)}
                          </td>
                          <td className="py-2.5 pr-3 font-semibold">{a.status}</td>
                          <td className="py-2.5 space-x-1.5 whitespace-nowrap">
                            {a.status === 'Pending' && (
                              <button
                                type="button"
                                onClick={() => updateAppointmentStatus(a.id, 'Confirmed')}
                                className="px-2.5 py-1 rounded bg-[#19A7A1] text-white font-semibold cursor-pointer"
                              >
                                Confirm
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => {
                                setEditApptError('');
                                setEditingAppt({ ...a });
                              }}
                              className="px-2.5 py-1 rounded bg-[#12304A] text-white font-semibold cursor-pointer"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => openReschedule(a)}
                              className="px-2.5 py-1 rounded border border-[#12304A]/20 text-[#12304A] font-semibold cursor-pointer"
                            >
                              Reschedule
                            </button>
                            {a.status !== 'Cancelled' && (
                              <button
                                type="button"
                                onClick={() => updateAppointmentStatus(a.id, 'Cancelled')}
                                className="px-2.5 py-1 rounded border border-red-200 text-red-700 font-semibold cursor-pointer"
                              >
                                Cancel
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* APPOINTMENTS TAB */}
        {tab === 'appointments' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs text-[#71808D]">
                  Showing <strong className="text-[#12304A] tabular-nums">{filteredAppointments.length}</strong> of{' '}
                  <strong className="text-[#12304A] tabular-nums">{appointments.length}</strong> bookings
                  {integrations?.supabaseConfigured
                    ? integrations?.supabaseSecretConfigured
                      ? ' · Live Synced with Supabase'
                      : ' · Supabase Insert Active (set SUPABASE_SECRET_KEY in .env to pull/update existing Supabase rows under RLS)'
                    : ''}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const headers = [
                      'Reference',
                      'Date',
                      'Time',
                      'Patient Name',
                      'Phone',
                      'Email',
                      'Treatment',
                      'Dentist',
                      'Status',
                      'Payment Status',
                      'Amount INR',
                      'Notes',
                    ];
                    const escapeCsv = (val: string | number) =>
                      `"${String(val ?? '').replace(/"/g, '""')}"`;
                    const lines = [
                      headers.join(','),
                      ...filteredAppointments.map((a) =>
                        [
                          a.referenceCode,
                          a.appointmentDate,
                          a.appointmentTime,
                          a.patientName,
                          a.patientPhone,
                          a.patientEmail,
                          a.treatmentTitle,
                          a.doctorName,
                          a.status,
                          a.paymentStatus,
                          a.paymentAmountInr,
                          a.notes,
                        ]
                          .map(escapeCsv)
                          .join(','),
                      ),
                    ];
                    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.href = url;
                    link.download = `raghan-appointments-${todayIso}.csv`;
                    link.click();
                    URL.revokeObjectURL(url);
                  }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-white border border-[#12304A]/15 text-xs font-semibold text-[#12304A] hover:bg-[#FAFCFC] cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export CSV</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setNewApptError('');
                    setNewApptForm({
                      treatmentId: treatments[0]?.id || 1,
                      doctorId: doctors[0]?.id || 1,
                      appointmentDate: todayIso,
                      appointmentTime: '10:00',
                      patientName: '',
                      patientPhone: '',
                      patientEmail: '',
                      patientType: 'first-time',
                      notes: '',
                      status: 'Confirmed',
                    });
                    setCreatingAppt(true);
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#12304A] hover:bg-[#19A7A1] text-white text-xs font-semibold transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>New Appointment</span>
                </button>
              </div>
            </div>

            <div className="bg-white border border-[#12304A]/10 rounded-xl p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="relative">
                <Search className="w-4 h-4 text-[#71808D] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="search"
                  placeholder="Search patient, phone, ref..."
                  value={apptSearch}
                  onChange={(e) => setApptSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 rounded-lg border border-[#12304A]/15 text-xs"
                />
              </div>
              <input
                type="date"
                value={apptDateFilter}
                onChange={(e) => setApptDateFilter(e.target.value)}
                className="px-3 py-2 rounded-lg border border-[#12304A]/15 text-xs"
              />
              <select
                value={apptTreatmentFilter}
                onChange={(e) => setApptTreatmentFilter(e.target.value)}
                className="px-3 py-2 rounded-lg border border-[#12304A]/15 text-xs"
              >
                <option value="">All Treatments</option>
                {treatments.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title}
                  </option>
                ))}
              </select>
              <select
                value={apptStatusFilter}
                onChange={(e) => setApptStatusFilter(e.target.value)}
                className="px-3 py-2 rounded-lg border border-[#12304A]/15 text-xs"
              >
                <option value="">All Statuses</option>
                {(['Pending', 'Confirmed', 'Completed', 'Cancelled', 'Rescheduled', 'No-show'] as const).map(
                  (st) => (
                    <option key={st} value={st}>
                      {st}
                    </option>
                  ),
                )}
              </select>
            </div>

            <div className="bg-white border border-[#12304A]/10 rounded-xl overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#12304A]/10 bg-[#FAFCFC] text-[#71808D]">
                    <th className="p-3">Reference</th>
                    <th className="p-3">Patient</th>
                    <th className="p-3">Treatment &amp; Doctor</th>
                    <th className="p-3">Slot</th>
                    <th className="p-3">Payment</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAppointments.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-[#71808D]">
                        No appointments match the current filters.
                      </td>
                    </tr>
                  ) : (
                    filteredAppointments.map((a) => (
                      <tr key={a.id} className="border-b border-[#12304A]/5 align-top">
                        <td className="p-3 font-mono tabular-nums whitespace-nowrap">{a.referenceCode}</td>
                        <td className="p-3">
                          <div className="font-semibold text-[#12304A]">{a.patientName}</div>
                          <div className="text-[#71808D] tabular-nums">{a.patientPhone}</div>
                          {a.patientEmail && <div className="text-[#71808D]">{a.patientEmail}</div>}
                          {a.notes && <div className="text-[#263746] mt-1 italic">Note: {a.notes}</div>}
                        </td>
                        <td className="p-3">
                          <div className="font-medium text-[#12304A]">{a.treatmentTitle}</div>
                          <div className="text-[#71808D]">{a.doctorName}</div>
                        </td>
                        <td className="p-3 tabular-nums whitespace-nowrap">
                          <div>{formatDateReadable(a.appointmentDate)}</div>
                          <div className="font-semibold text-[#12304A]">{formatTime12h(a.appointmentTime)}</div>
                        </td>
                        <td className="p-3 whitespace-nowrap">
                          <div>{a.paymentStatus}</div>
                          {a.paymentAmountInr > 0 && (
                            <div className="text-[#71808D] tabular-nums">₹{a.paymentAmountInr}</div>
                          )}
                        </td>
                        <td className="p-3">
                          <select
                            value={a.status}
                            onChange={(e) =>
                              updateAppointmentStatus(a.id, e.target.value as AppointmentStatus)
                            }
                            className="px-2 py-1 rounded border border-[#12304A]/20 text-xs font-semibold bg-white"
                          >
                            {(['Pending', 'Confirmed', 'Completed', 'Cancelled', 'Rescheduled', 'No-show'] as const).map(
                              (st) => (
                                <option key={st} value={st}>
                                  {st}
                                </option>
                              ),
                            )}
                          </select>
                        </td>
                        <td className="p-3 whitespace-nowrap">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                setEditApptError('');
                                setEditingAppt({ ...a });
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-[#12304A] text-white font-semibold cursor-pointer"
                            >
                              <Pencil className="w-3 h-3" />
                              <span>Edit</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => openReschedule(a)}
                              className="px-2.5 py-1 rounded border border-[#12304A]/20 text-[#12304A] font-semibold cursor-pointer"
                            >
                              Reschedule
                            </button>
                            {a.status !== 'Cancelled' && (
                              <button
                                type="button"
                                onClick={() => updateAppointmentStatus(a.id, 'Cancelled')}
                                className="px-2.5 py-1 rounded border border-red-200 text-red-700 hover:bg-red-50 font-semibold cursor-pointer"
                              >
                                Cancel
                              </button>
                            )}
                            <a
                              href={buildWhatsAppUrl(
                                a.patientPhone,
                                `Hello ${a.patientName}, regarding your dental appointment (${a.referenceCode}) at Raghan Dental and Implant Care on ${formatDateReadable(a.appointmentDate)} at ${formatTime12h(a.appointmentTime)}.`,
                              )}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-[#F1F7F7] text-[#19A7A1] font-semibold"
                            >
                              <span>WhatsApp</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TREATMENTS TAB */}
        {tab === 'treatments' && (
          <div className="space-y-5">
            <div className="flex justify-between items-center">
              <p className="text-sm text-[#71808D]">
                Edit descriptions, toggle clinic confirmation status, update photos, or add services.
              </p>
              <button
                type="button"
                onClick={() =>
                  setEditingTreatment({
                    title: '',
                    category: 'Consultations',
                    shortDescription: '',
                    introduction: '',
                    whatItInvolves: '',
                    whenNeeded: '',
                    procedureOverview: '',
                    faqs: [],
                    imageUrl: '/src/assets/images/dental_care_consultation_1794820374752.jpg',
                    durationMinutes: 30,
                    consultationFeeInr: 500,
                    isConfirmedAvailable: true,
                    isActive: true,
                  })
                }
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#12304A] text-white text-xs font-semibold cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Add Treatment</span>
              </button>
            </div>

            {editingTreatment && (
              <form
                onSubmit={saveTreatmentForm}
                className="bg-white border border-[#12304A]/15 rounded-xl p-6 space-y-4"
              >
                <h3 className="font-display text-xl text-[#12304A]">
                  {editingTreatment.id ? `Edit: ${editingTreatment.title}` : 'New Treatment'}
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                  <div>
                    <label className="block text-xs font-semibold mb-1">Title</label>
                    <input
                      type="text"
                      required
                      value={editingTreatment.title || ''}
                      onChange={(e) => setEditingTreatment({ ...editingTreatment, title: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border border-[#12304A]/20"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1">Category</label>
                    <input
                      type="text"
                      required
                      value={editingTreatment.category || ''}
                      onChange={(e) => setEditingTreatment({ ...editingTreatment, category: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border border-[#12304A]/20"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-semibold mb-1">Duration (min)</label>
                      <input
                        type="number"
                        min={15}
                        step={15}
                        value={editingTreatment.durationMinutes || 30}
                        onChange={(e) =>
                          setEditingTreatment({ ...editingTreatment, durationMinutes: Number(e.target.value) })
                        }
                        className="w-full px-3 py-2 rounded-lg border border-[#12304A]/20 tabular-nums"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold mb-1">Fee (INR)</label>
                      <input
                        type="number"
                        min={0}
                        value={editingTreatment.consultationFeeInr || 0}
                        onChange={(e) =>
                          setEditingTreatment({ ...editingTreatment, consultationFeeInr: Number(e.target.value) })
                        }
                        className="w-full px-3 py-2 rounded-lg border border-[#12304A]/20 tabular-nums"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                  <div>
                    <label className="block text-xs font-semibold mb-1">Short Description</label>
                    <textarea
                      rows={2}
                      value={editingTreatment.shortDescription || ''}
                      onChange={(e) =>
                        setEditingTreatment({ ...editingTreatment, shortDescription: e.target.value })
                      }
                      className="w-full px-3 py-2 rounded-lg border border-[#12304A]/20"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1">Introduction</label>
                    <textarea
                      rows={2}
                      value={editingTreatment.introduction || ''}
                      onChange={(e) =>
                        setEditingTreatment({ ...editingTreatment, introduction: e.target.value })
                      }
                      className="w-full px-3 py-2 rounded-lg border border-[#12304A]/20"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1">What It Involves</label>
                    <textarea
                      rows={2}
                      value={editingTreatment.whatItInvolves || ''}
                      onChange={(e) =>
                        setEditingTreatment({ ...editingTreatment, whatItInvolves: e.target.value })
                      }
                      className="w-full px-3 py-2 rounded-lg border border-[#12304A]/20"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1">When Needed</label>
                    <textarea
                      rows={2}
                      value={editingTreatment.whenNeeded || ''}
                      onChange={(e) =>
                        setEditingTreatment({ ...editingTreatment, whenNeeded: e.target.value })
                      }
                      className="w-full px-3 py-2 rounded-lg border border-[#12304A]/20"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold mb-1">Procedure Overview</label>
                    <textarea
                      rows={2}
                      value={editingTreatment.procedureOverview || ''}
                      onChange={(e) =>
                        setEditingTreatment({ ...editingTreatment, procedureOverview: e.target.value })
                      }
                      className="w-full px-3 py-2 rounded-lg border border-[#12304A]/20"
                    />
                  </div>
                  <div className="sm:col-span-2 flex flex-wrap items-center gap-4">
                    <div className="flex-1 min-w-[220px]">
                      <label className="block text-xs font-semibold mb-1">Image URL or Upload</label>
                      <input
                        type="text"
                        value={editingTreatment.imageUrl || ''}
                        onChange={(e) => setEditingTreatment({ ...editingTreatment, imageUrl: e.target.value })}
                        className="w-full px-3 py-2 rounded-lg border border-[#12304A]/20 text-xs"
                      />
                    </div>
                    <label className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[#12304A]/20 text-xs font-semibold cursor-pointer mt-4">
                      <Upload className="w-3.5 h-3.5" />
                      <span>Upload Photo</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={async (e) => {
                          const f = e.target.files?.[0];
                          if (!f) return;
                          const dataUrl = await resizeImageFileToDataUrl(f, 900);
                          setEditingTreatment({ ...editingTreatment, imageUrl: dataUrl });
                        }}
                      />
                    </label>
                  </div>
                </div>

                {/* Treatment-specific FAQs */}
                <div className="border-t border-[#12304A]/10 pt-3 space-y-2">
                  <span className="text-xs font-semibold text-[#12304A] block">Treatment FAQs</span>
                  {(editingTreatment.faqs || []).map((f, idx) => (
                    <div key={idx} className="flex items-start justify-between gap-2 text-xs bg-[#FAFCFC] p-2 rounded">
                      <div>
                        <strong>{f.question}</strong> — {f.answer}
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setEditingTreatment({
                            ...editingTreatment,
                            faqs: (editingTreatment.faqs || []).filter((_, i) => i !== idx),
                          })
                        }
                        className="text-red-600 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <input
                      type="text"
                      placeholder="New FAQ question"
                      value={newFaqQ}
                      onChange={(e) => setNewFaqQ(e.target.value)}
                      className="px-2.5 py-1.5 rounded border border-[#12304A]/20 text-xs"
                    />
                    <input
                      type="text"
                      placeholder="Answer"
                      value={newFaqA}
                      onChange={(e) => setNewFaqA(e.target.value)}
                      className="px-2.5 py-1.5 rounded border border-[#12304A]/20 text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (!newFaqQ.trim() || !newFaqA.trim()) return;
                        setEditingTreatment({
                          ...editingTreatment,
                          faqs: [...(editingTreatment.faqs || []), { question: newFaqQ, answer: newFaqA }],
                        });
                        setNewFaqQ('');
                        setNewFaqA('');
                      }}
                      className="px-3 py-1.5 rounded bg-[#F1F7F7] text-[#12304A] text-xs font-semibold cursor-pointer"
                    >
                      Add FAQ Item
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-6 pt-2 text-xs">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(editingTreatment.isConfirmedAvailable)}
                      onChange={(e) =>
                        setEditingTreatment({ ...editingTreatment, isConfirmedAvailable: e.target.checked })
                      }
                    />
                    <span>Clinic Confirmed Available (uncheck if still proposed)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editingTreatment.isActive !== false}
                      onChange={(e) =>
                        setEditingTreatment({ ...editingTreatment, isActive: e.target.checked })
                      }
                    />
                    <span>Active on Public Website</span>
                  </label>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-lg bg-[#12304A] text-white text-xs font-semibold cursor-pointer"
                  >
                    Save Treatment
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingTreatment(null)}
                    className="px-4 py-2 text-xs font-semibold text-[#71808D] cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {treatments.map((t) => (
                <div
                  key={t.id}
                  className="bg-white border border-[#12304A]/10 rounded-xl p-4 flex items-start justify-between gap-4"
                >
                  <div>
                    <div className="text-xs text-[#71808D]">
                      {t.category} · {t.durationMinutes} min · ₹{t.consultationFeeInr}
                    </div>
                    <h3 className="font-display text-lg text-[#12304A]">{t.title}</h3>
                    <div className="text-xs mt-1 space-x-2">
                      <span className={t.isConfirmedAvailable ? 'text-emerald-700' : 'text-amber-700'}>
                        {t.isConfirmedAvailable ? 'Confirmed Available' : 'Proposed Category'}
                      </span>
                      <span>·</span>
                      <span>{t.isActive ? 'Visible' : 'Hidden'}</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEditingTreatment(t)}
                    className="px-3 py-1.5 rounded-lg border border-[#12304A]/20 text-xs font-semibold text-[#12304A] cursor-pointer"
                  >
                    Edit
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* DOCTORS TAB */}
        {tab === 'doctors' && (
          <div className="space-y-5">
            <div className="flex justify-between items-center">
              <p className="text-sm text-[#71808D]">
                Update Dr. Deepthi K&apos;s official portrait and details, or add additional dentists.
              </p>
              <button
                type="button"
                onClick={() =>
                  setEditingDoctor({
                    name: '',
                    qualifications: '',
                    specialization: '',
                    experienceNote: '',
                    languages: '',
                    bio: '',
                    photoUrl: '',
                    isPhotoVerified: true,
                    isActive: true,
                  })
                }
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#12304A] text-white text-xs font-semibold cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Add Dentist</span>
              </button>
            </div>

            {editingDoctor && (
              <form
                onSubmit={saveDoctorForm}
                className="bg-white border border-[#12304A]/15 rounded-xl p-6 space-y-4 text-sm"
              >
                <h3 className="font-display text-xl text-[#12304A]">
                  {editingDoctor.id ? `Edit ${editingDoctor.name}` : 'Add Dentist Profile'}
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold mb-1">Full Name</label>
                    <input
                      type="text"
                      required
                      value={editingDoctor.name || ''}
                      onChange={(e) => setEditingDoctor({ ...editingDoctor, name: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border border-[#12304A]/20"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1">Qualifications</label>
                    <input
                      type="text"
                      required
                      value={editingDoctor.qualifications || ''}
                      onChange={(e) => setEditingDoctor({ ...editingDoctor, qualifications: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border border-[#12304A]/20"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1">Specialization</label>
                    <input
                      type="text"
                      value={editingDoctor.specialization || ''}
                      onChange={(e) => setEditingDoctor({ ...editingDoctor, specialization: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border border-[#12304A]/20"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1">Experience Note</label>
                    <input
                      type="text"
                      value={editingDoctor.experienceNote || ''}
                      onChange={(e) => setEditingDoctor({ ...editingDoctor, experienceNote: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border border-[#12304A]/20"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1">Languages</label>
                    <input
                      type="text"
                      value={editingDoctor.languages || ''}
                      onChange={(e) => setEditingDoctor({ ...editingDoctor, languages: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border border-[#12304A]/20"
                    />
                  </div>
                  <div className="flex items-end gap-2">
                    <div className="flex-1">
                      <label className="block text-xs font-semibold mb-1">Official Portrait Photo</label>
                      <input
                        type="text"
                        placeholder="Image URL or upload"
                        value={editingDoctor.photoUrl || ''}
                        onChange={(e) => setEditingDoctor({ ...editingDoctor, photoUrl: e.target.value })}
                        className="w-full px-3 py-2 rounded-lg border border-[#12304A]/20 text-xs"
                      />
                    </div>
                    <label className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[#12304A]/20 text-xs font-semibold cursor-pointer">
                      <Upload className="w-3.5 h-3.5" />
                      <span>Upload</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={async (e) => {
                          const f = e.target.files?.[0];
                          if (!f) return;
                          const dataUrl = await resizeImageFileToDataUrl(f, 800);
                          setEditingDoctor({ ...editingDoctor, photoUrl: dataUrl, isPhotoVerified: true });
                        }}
                      />
                    </label>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold mb-1">Professional Introduction</label>
                    <textarea
                      rows={3}
                      value={editingDoctor.bio || ''}
                      onChange={(e) => setEditingDoctor({ ...editingDoctor, bio: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border border-[#12304A]/20"
                    />
                  </div>
                </div>
                <div className="flex flex-wrap gap-5 text-xs">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(editingDoctor.isPhotoVerified)}
                      onChange={(e) =>
                        setEditingDoctor({ ...editingDoctor, isPhotoVerified: e.target.checked })
                      }
                    />
                    <span>Display Portrait as Verified Official Photograph</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editingDoctor.isActive !== false}
                      onChange={(e) => setEditingDoctor({ ...editingDoctor, isActive: e.target.checked })}
                    />
                    <span>Active for Online Booking</span>
                  </label>
                </div>
                <div className="flex gap-3">
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-lg bg-[#12304A] text-white text-xs font-semibold cursor-pointer"
                  >
                    Save Profile
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingDoctor(null)}
                    className="px-4 py-2 text-xs text-[#71808D] cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {doctors.map((d) => (
                <div key={d.id} className="bg-white border border-[#12304A]/10 rounded-xl p-5 flex justify-between gap-4">
                  <div className="space-y-1">
                    <h3 className="font-display text-xl text-[#12304A]">{d.name}</h3>
                    <p className="text-xs font-semibold text-[#19A7A1]">{d.qualifications}</p>
                    <p className="text-xs text-[#71808D]">{d.experienceNote}</p>
                    <p className="text-xs text-[#71808D]">
                      {d.isActive ? 'Accepting Bookings' : 'Inactive'} ·{' '}
                      {d.photoUrl && d.isPhotoVerified ? 'Official Photo Set' : 'Monogram Emblem Active'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEditingDoctor(d)}
                    className="self-start px-3 py-1.5 rounded-lg border border-[#12304A]/20 text-xs font-semibold text-[#12304A] cursor-pointer"
                  >
                    Edit
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* SCHEDULE & HOLIDAYS TAB */}
        {tab === 'schedule' && settings && (
          <div className="space-y-6">
            <div className="bg-white border border-[#12304A]/10 rounded-xl p-6 space-y-5">
              <h2 className="font-display text-xl text-[#12304A]">Weekly Working Hours &amp; Slot Rules</h2>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 text-xs">
                <div>
                  <label className="block font-semibold mb-1">Default Slot Duration (min)</label>
                  <input
                    type="number"
                    min={15}
                    step={15}
                    value={settings.slotDurationMinutes}
                    onChange={(e) =>
                      setSettings({ ...settings, slotDurationMinutes: Number(e.target.value) })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-[#12304A]/20 tabular-nums"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Advance Booking Limit (days)</label>
                  <input
                    type="number"
                    min={1}
                    max={180}
                    value={settings.advanceBookingDays}
                    onChange={(e) =>
                      setSettings({ ...settings, advanceBookingDays: Number(e.target.value) })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-[#12304A]/20 tabular-nums"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Minimum Notice (hours)</label>
                  <input
                    type="number"
                    min={0}
                    max={72}
                    value={settings.minNoticeHours}
                    onChange={(e) =>
                      setSettings({ ...settings, minNoticeHours: Number(e.target.value) })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-[#12304A]/20 tabular-nums"
                  />
                </div>
                <div className="flex items-end pb-2">
                  <label className="flex items-center gap-2 cursor-pointer font-semibold">
                    <input
                      type="checkbox"
                      checked={settings.autoConfirmBookings}
                      onChange={(e) =>
                        setSettings({ ...settings, autoConfirmBookings: e.target.checked })
                      }
                    />
                    <span>Auto-Confirm Online Bookings</span>
                  </label>
                </div>
              </div>

              <div className="space-y-2">
                {settings.weeklySchedule.map((day, idx) => (
                  <div
                    key={day.day}
                    className="grid grid-cols-2 sm:grid-cols-6 gap-2 items-center text-xs py-2 border-b border-[#12304A]/5"
                  >
                    <label className="flex items-center gap-2 font-semibold text-[#12304A]">
                      <input
                        type="checkbox"
                        checked={day.isOpen}
                        onChange={(e) => {
                          const next = [...settings.weeklySchedule];
                          next[idx] = { ...day, isOpen: e.target.checked };
                          setSettings({ ...settings, weeklySchedule: next });
                        }}
                      />
                      <span>{day.label}</span>
                    </label>
                    <input
                      type="time"
                      disabled={!day.isOpen}
                      value={day.openTime}
                      onChange={(e) => {
                        const next = [...settings.weeklySchedule];
                        next[idx] = { ...day, openTime: e.target.value };
                        setSettings({ ...settings, weeklySchedule: next });
                      }}
                      className="px-2 py-1.5 rounded border border-[#12304A]/20 disabled:opacity-40"
                    />
                    <input
                      type="time"
                      disabled={!day.isOpen}
                      value={day.closeTime}
                      onChange={(e) => {
                        const next = [...settings.weeklySchedule];
                        next[idx] = { ...day, closeTime: e.target.value };
                        setSettings({ ...settings, weeklySchedule: next });
                      }}
                      className="px-2 py-1.5 rounded border border-[#12304A]/20 disabled:opacity-40"
                    />
                    <input
                      type="time"
                      disabled={!day.isOpen}
                      title="Break start"
                      value={day.breakStart}
                      onChange={(e) => {
                        const next = [...settings.weeklySchedule];
                        next[idx] = { ...day, breakStart: e.target.value };
                        setSettings({ ...settings, weeklySchedule: next });
                      }}
                      className="px-2 py-1.5 rounded border border-[#12304A]/20 disabled:opacity-40"
                    />
                    <input
                      type="time"
                      disabled={!day.isOpen}
                      title="Break end"
                      value={day.breakEnd}
                      onChange={(e) => {
                        const next = [...settings.weeklySchedule];
                        next[idx] = { ...day, breakEnd: e.target.value };
                        setSettings({ ...settings, weeklySchedule: next });
                      }}
                      className="px-2 py-1.5 rounded border border-[#12304A]/20 disabled:opacity-40"
                    />
                    <span className="text-[#71808D]">Open · Close · Break</span>
                  </div>
                ))}
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Cancellation Policy</label>
                <input
                  type="text"
                  value={settings.cancellationPolicy}
                  onChange={(e) => setSettings({ ...settings, cancellationPolicy: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-[#12304A]/20 text-xs"
                />
              </div>

              <button
                type="button"
                onClick={() => saveClinicSettings(settings)}
                className="px-5 py-2.5 rounded-lg bg-[#12304A] text-white text-xs font-semibold cursor-pointer"
              >
                Save Schedule Rules
              </button>
            </div>

            {/* Holidays / Blocked Dates */}
            <div className="bg-white border border-[#12304A]/10 rounded-xl p-6 space-y-4">
              <h2 className="font-display text-xl text-[#12304A]">Holidays &amp; Blocked Dates</h2>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  const resp = await fetch('/api/admin/blocked-dates', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      date: blockDate,
                      doctorId: blockDoctorId ? Number(blockDoctorId) : null,
                      startTime: blockStartTime || null,
                      endTime: blockEndTime || null,
                      reason: blockReason || 'Clinic Holiday',
                    }),
                  });
                  if (resp.ok) {
                    const data = await resp.json();
                    setBlockedDates(data.blockedDates);
                    setBlockDate('');
                    setBlockReason('');
                    setBlockStartTime('');
                    setBlockEndTime('');
                    showToast('Blocked date added.');
                  }
                }}
                className="grid grid-cols-1 sm:grid-cols-6 gap-2 text-xs"
              >
                <input
                  type="date"
                  required
                  value={blockDate}
                  onChange={(e) => setBlockDate(e.target.value)}
                  className="px-3 py-2 rounded-lg border border-[#12304A]/20"
                />
                <select
                  value={blockDoctorId}
                  onChange={(e) => setBlockDoctorId(e.target.value)}
                  className="px-3 py-2 rounded-lg border border-[#12304A]/20"
                >
                  <option value="">All Dentists</option>
                  {doctors.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
                <input
                  type="time"
                  placeholder="From (optional)"
                  value={blockStartTime}
                  onChange={(e) => setBlockStartTime(e.target.value)}
                  className="px-3 py-2 rounded-lg border border-[#12304A]/20"
                />
                <input
                  type="time"
                  placeholder="To (optional)"
                  value={blockEndTime}
                  onChange={(e) => setBlockEndTime(e.target.value)}
                  className="px-3 py-2 rounded-lg border border-[#12304A]/20"
                />
                <input
                  type="text"
                  placeholder="Reason (e.g. Festival Holiday)"
                  value={blockReason}
                  onChange={(e) => setBlockReason(e.target.value)}
                  className="px-3 py-2 rounded-lg border border-[#12304A]/20"
                />
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-[#12304A] text-white font-semibold cursor-pointer"
                >
                  Block Date
                </button>
              </form>

              <div className="space-y-2 text-xs">
                {blockedDates.length === 0 ? (
                  <p className="text-[#71808D]">No upcoming holidays or blocked periods configured.</p>
                ) : (
                  blockedDates.map((b) => (
                    <div
                      key={b.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-[#FAFCFC] border border-[#12304A]/10"
                    >
                      <div>
                        <span className="font-semibold text-[#12304A] tabular-nums">
                          {formatDateReadable(b.date)}
                        </span>{' '}
                        ·{' '}
                        <span>
                          {b.startTime && b.endTime ? `${b.startTime}–${b.endTime}` : 'Full Day'}
                        </span>{' '}
                        · <span className="text-[#71808D]">{b.reason}</span>
                      </div>
                      <button
                        type="button"
                        onClick={async () => {
                          const resp = await fetch(`/api/admin/blocked-dates/${b.id}`, {
                            method: 'DELETE',
                          });
                          if (resp.ok) {
                            const data = await resp.json();
                            setBlockedDates(data.blockedDates);
                            showToast('Blocked date removed.');
                          }
                        }}
                        className="text-red-600 hover:underline cursor-pointer"
                      >
                        Remove
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* GALLERY & TESTIMONIALS TAB */}
        {tab === 'gallery' && (
          <div className="space-y-6">
            {/* Gallery Manager */}
            <div className="bg-white border border-[#12304A]/10 rounded-xl p-6 space-y-4">
              <h2 className="font-display text-xl text-[#12304A]">Clinic Gallery Manager</h2>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  const resp = await fetch('/api/admin/gallery', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      title: newGalTitle,
                      category: newGalCat,
                      imageUrl: newGalUrl,
                      caption: newGalCaption,
                      isOfficialPhoto: newGalOfficial,
                    }),
                  });
                  if (resp.ok) {
                    const data = await resp.json();
                    setGallery(data.gallery);
                    setNewGalTitle('');
                    setNewGalUrl('');
                    setNewGalCaption('');
                    onDataUpdated();
                    showToast('Gallery photo added.');
                  }
                }}
                className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-[#FAFCFC] p-4 rounded-xl border border-[#12304A]/10"
              >
                <input
                  type="text"
                  required
                  placeholder="Photo Title (e.g. Clinic Reception Area)"
                  value={newGalTitle}
                  onChange={(e) => setNewGalTitle(e.target.value)}
                  className="px-3 py-2 rounded-lg border border-[#12304A]/20"
                />
                <select
                  value={newGalCat}
                  onChange={(e) => setNewGalCat(e.target.value as GalleryItem['category'])}
                  className="px-3 py-2 rounded-lg border border-[#12304A]/20"
                >
                  {(['Clinic Reception', 'Treatment Rooms', 'Dental Equipment', 'Dentist & Team', 'Clinic Interior'] as const).map(
                    (c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ),
                  )}
                </select>
                <div className="flex gap-2">
                  <input
                    type="text"
                    required
                    placeholder="Image URL or upload"
                    value={newGalUrl}
                    onChange={(e) => setNewGalUrl(e.target.value)}
                    className="flex-1 px-3 py-2 rounded-lg border border-[#12304A]/20"
                  />
                  <label className="inline-flex items-center gap-1 px-3 py-2 rounded-lg border border-[#12304A]/20 font-semibold cursor-pointer bg-white">
                    <Upload className="w-3.5 h-3.5" />
                    <span>Upload</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={async (e) => {
                        const f = e.target.files?.[0];
                        if (!f) return;
                        const dataUrl = await resizeImageFileToDataUrl(f, 1200);
                        setNewGalUrl(dataUrl);
                      }}
                    />
                  </label>
                </div>
                <input
                  type="text"
                  placeholder="Caption"
                  value={newGalCaption}
                  onChange={(e) => setNewGalCaption(e.target.value)}
                  className="px-3 py-2 rounded-lg border border-[#12304A]/20"
                />
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newGalOfficial}
                    onChange={(e) => setNewGalOfficial(e.target.checked)}
                  />
                  <span>Genuine Official Clinic Photograph</span>
                </label>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-[#12304A] text-white font-semibold justify-self-start cursor-pointer"
                >
                  Add to Gallery
                </button>
              </form>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {gallery.map((g) => (
                  <div key={g.id} className="border border-[#12304A]/10 rounded-xl overflow-hidden text-xs">
                    <img
                      src={g.imageUrl}
                      alt={g.title}
                      referrerPolicy="no-referrer"
                      className="w-full h-36 object-cover bg-[#F1F7F7]"
                    />
                    <div className="p-3 flex items-start justify-between gap-2">
                      <div>
                        <span className="text-[#19A7A1] font-semibold">
                          {g.category} · {g.isOfficialPhoto ? 'Official' : 'Illustrative'}
                        </span>
                        <div className="font-semibold text-[#12304A] mt-0.5">{g.title}</div>
                      </div>
                      <button
                        type="button"
                        onClick={async () => {
                          const resp = await fetch(`/api/admin/gallery/${g.id}`, { method: 'DELETE' });
                          if (resp.ok) {
                            const data = await resp.json();
                            setGallery(data.gallery);
                            onDataUpdated();
                            showToast('Gallery item removed.');
                          }
                        }}
                        className="text-red-600 cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Genuine Testimonials Manager */}
            <div className="bg-white border border-[#12304A]/10 rounded-xl p-6 space-y-4">
              <h2 className="font-display text-xl text-[#12304A]">
                Patient Testimonials (Genuine Feedback Only)
              </h2>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  const resp = await fetch('/api/admin/testimonials', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      patientName: newTestName,
                      treatmentName: newTestTreatment,
                      quote: newTestQuote,
                      visitDate: newTestDate,
                      isApproved: newTestApproved,
                    }),
                  });
                  if (resp.ok) {
                    const data = await resp.json();
                    setTestimonials(data.testimonials);
                    setNewTestName('');
                    setNewTestTreatment('');
                    setNewTestQuote('');
                    setNewTestDate('');
                    onDataUpdated();
                    showToast('Testimonial saved.');
                  }
                }}
                className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs bg-[#FAFCFC] p-4 rounded-xl border border-[#12304A]/10"
              >
                <input
                  type="text"
                  required
                  placeholder="Verified Patient Name"
                  value={newTestName}
                  onChange={(e) => setNewTestName(e.target.value)}
                  className="px-3 py-2 rounded-lg border border-[#12304A]/20"
                />
                <input
                  type="text"
                  placeholder="Treatment / Consultation"
                  value={newTestTreatment}
                  onChange={(e) => setNewTestTreatment(e.target.value)}
                  className="px-3 py-2 rounded-lg border border-[#12304A]/20"
                />
                <input
                  type="text"
                  placeholder="Visit Date (e.g. Oct 2026)"
                  value={newTestDate}
                  onChange={(e) => setNewTestDate(e.target.value)}
                  className="px-3 py-2 rounded-lg border border-[#12304A]/20"
                />
                <textarea
                  required
                  rows={2}
                  placeholder="Genuine patient feedback quote..."
                  value={newTestQuote}
                  onChange={(e) => setNewTestQuote(e.target.value)}
                  className="sm:col-span-3 px-3 py-2 rounded-lg border border-[#12304A]/20"
                />
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newTestApproved}
                    onChange={(e) => setNewTestApproved(e.target.checked)}
                  />
                  <span>Approved for Public Display</span>
                </label>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-[#12304A] text-white font-semibold justify-self-start cursor-pointer"
                >
                  Add Verified Testimonial
                </button>
              </form>

              <div className="space-y-2 text-xs">
                {testimonials.length === 0 ? (
                  <p className="text-[#71808D]">
                    No testimonials added yet. Only genuine verified feedback added by clinic staff will display on the public website.
                  </p>
                ) : (
                  testimonials.map((t) => (
                    <div
                      key={t.id}
                      className="p-3.5 rounded-xl border border-[#12304A]/10 flex items-start justify-between gap-4"
                    >
                      <div>
                        <div className="font-semibold text-[#12304A]">
                          {t.patientName}{' '}
                          <span className="font-normal text-[#71808D]">
                            {t.treatmentName ? `· ${t.treatmentName}` : ''} {t.visitDate ? `· ${t.visitDate}` : ''}
                          </span>
                        </div>
                        <p className="text-[#263746] mt-1">&ldquo;{t.quote}&rdquo;</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={async () => {
                            const resp = await fetch(`/api/admin/testimonials/${t.id}`, {
                              method: 'PUT',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ ...t, isApproved: !t.isApproved }),
                            });
                            if (resp.ok) {
                              const data = await resp.json();
                              setTestimonials(data.testimonials);
                              onDataUpdated();
                            }
                          }}
                          className={`px-2.5 py-1 rounded font-semibold cursor-pointer ${
                            t.isApproved
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'bg-amber-50 text-amber-700'
                          }`}
                        >
                          {t.isApproved ? 'Approved' : 'Hidden'}
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            const resp = await fetch(`/api/admin/testimonials/${t.id}`, {
                              method: 'DELETE',
                            });
                            if (resp.ok) {
                              const data = await resp.json();
                              setTestimonials(data.testimonials);
                              onDataUpdated();
                            }
                          }}
                          className="text-red-600 cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* ENQUIRIES & FAQS TAB */}
        {tab === 'enquiries' && (
          <div className="space-y-6">
            <div className="bg-white border border-[#12304A]/10 rounded-xl p-6 space-y-4">
              <h2 className="font-display text-xl text-[#12304A]">Contact Form Enquiries</h2>
              {enquiries.length === 0 ? (
                <p className="text-sm text-[#71808D]">No contact enquiries received yet.</p>
              ) : (
                <div className="space-y-3 text-xs">
                  {enquiries.map((eq) => (
                    <div
                      key={eq.id}
                      className="p-4 rounded-xl border border-[#12304A]/10 flex flex-col sm:flex-row sm:items-start justify-between gap-3"
                    >
                      <div className="space-y-1">
                        <div className="font-semibold text-[#12304A]">
                          {eq.name} · <span className="tabular-nums">{eq.phone}</span>{' '}
                          {eq.email && `· ${eq.email}`}
                        </div>
                        <div className="text-[#19A7A1] font-medium">{eq.subject}</div>
                        <p className="text-[#263746]">{eq.message}</p>
                      </div>
                      <select
                        value={eq.status}
                        onChange={async (e) => {
                          const resp = await fetch(`/api/admin/enquiries/${eq.id}`, {
                            method: 'PATCH',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ status: e.target.value }),
                          });
                          if (resp.ok) {
                            const data = await resp.json();
                            setEnquiries(data.enquiries);
                          }
                        }}
                        className="px-2.5 py-1.5 rounded border border-[#12304A]/20 self-start"
                      >
                        <option value="New">New</option>
                        <option value="Reviewed">Reviewed</option>
                        <option value="Responded">Responded</option>
                      </select>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white border border-[#12304A]/10 rounded-xl p-6 space-y-4">
              <h2 className="font-display text-xl text-[#12304A]">Manage Website FAQs</h2>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  const resp = await fetch('/api/admin/faqs', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ question: faqQ, answer: faqA, category: faqCat }),
                  });
                  if (resp.ok) {
                    const data = await resp.json();
                    setFaqs(data.faqs);
                    setFaqQ('');
                    setFaqA('');
                    onDataUpdated();
                    showToast('FAQ added.');
                  }
                }}
                className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs bg-[#FAFCFC] p-4 rounded-xl border border-[#12304A]/10"
              >
                <input
                  type="text"
                  required
                  placeholder="Question"
                  value={faqQ}
                  onChange={(e) => setFaqQ(e.target.value)}
                  className="sm:col-span-2 px-3 py-2 rounded-lg border border-[#12304A]/20"
                />
                <input
                  type="text"
                  placeholder="Category"
                  value={faqCat}
                  onChange={(e) => setFaqCat(e.target.value)}
                  className="px-3 py-2 rounded-lg border border-[#12304A]/20"
                />
                <textarea
                  required
                  rows={2}
                  placeholder="Verified answer..."
                  value={faqA}
                  onChange={(e) => setFaqA(e.target.value)}
                  className="sm:col-span-3 px-3 py-2 rounded-lg border border-[#12304A]/20"
                />
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-[#12304A] text-white font-semibold justify-self-start cursor-pointer"
                >
                  Add FAQ
                </button>
              </form>

              <div className="space-y-2 text-xs">
                {faqs.map((f) => (
                  <div
                    key={f.id}
                    className="p-3.5 rounded-xl border border-[#12304A]/10 flex items-start justify-between gap-4"
                  >
                    <div>
                      <div className="font-semibold text-[#12304A]">{f.question}</div>
                      <p className="text-[#71808D] mt-1">{f.answer}</p>
                    </div>
                    <button
                      type="button"
                      onClick={async () => {
                        const resp = await fetch(`/api/admin/faqs/${f.id}`, { method: 'DELETE' });
                        if (resp.ok) {
                          const data = await resp.json();
                          setFaqs(data.faqs);
                          onDataUpdated();
                        }
                      }}
                      className="text-red-600 cursor-pointer shrink-0"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* WEBSITE & SETTINGS TAB */}
        {tab === 'settings' && settings && (
          <div className="space-y-6">
            <div className="bg-white border border-[#12304A]/10 rounded-xl p-6 space-y-4 text-xs">
              <h2 className="font-display text-xl text-[#12304A]">
                Homepage Content, Branding &amp; Contact Info
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold mb-1">Hero Headline</label>
                  <input
                    type="text"
                    value={settings.heroHeadline}
                    onChange={(e) => setSettings({ ...settings, heroHeadline: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-[#12304A]/20"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Phone Number</label>
                  <input
                    type="text"
                    value={settings.phone}
                    onChange={(e) => setSettings({ ...settings, phone: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-[#12304A]/20"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block font-semibold mb-1">Hero Supporting Text</label>
                  <textarea
                    rows={2}
                    value={settings.heroSubheadline}
                    onChange={(e) => setSettings({ ...settings, heroSubheadline: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-[#12304A]/20"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">About Heading</label>
                  <input
                    type="text"
                    value={settings.aboutHeading}
                    onChange={(e) => setSettings({ ...settings, aboutHeading: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-[#12304A]/20"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">WhatsApp Number</label>
                  <input
                    type="text"
                    value={settings.whatsappNumber}
                    onChange={(e) => setSettings({ ...settings, whatsappNumber: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-[#12304A]/20"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block font-semibold mb-1">About Clinic Text</label>
                  <textarea
                    rows={3}
                    value={settings.aboutBody}
                    onChange={(e) => setSettings({ ...settings, aboutBody: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-[#12304A]/20"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block font-semibold mb-1">Clinic Address</label>
                  <input
                    type="text"
                    value={settings.address}
                    onChange={(e) => setSettings({ ...settings, address: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-[#12304A]/20"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Google Maps Link</label>
                  <input
                    type="url"
                    value={settings.googleMapsUrl}
                    onChange={(e) => setSettings({ ...settings, googleMapsUrl: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-[#12304A]/20"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Google Reviews Link (Optional)</label>
                  <input
                    type="url"
                    value={settings.googleReviewsUrl}
                    onChange={(e) => setSettings({ ...settings, googleReviewsUrl: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-[#12304A]/20"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Upload Official Clinic Logo</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={async (e) => {
                      const f = e.target.files?.[0];
                      if (!f) return;
                      const dataUrl = await resizeImageFileToDataUrl(f, 400);
                      setSettings({ ...settings, logoUrl: dataUrl });
                    }}
                    className="block w-full text-xs"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Upload Hero Clinic Photograph</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={async (e) => {
                      const f = e.target.files?.[0];
                      if (!f) return;
                      const dataUrl = await resizeImageFileToDataUrl(f, 1400);
                      setSettings({ ...settings, heroImageUrl: dataUrl });
                    }}
                    className="block w-full text-xs"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-[#12304A]/10 space-y-3">
                <h3 className="font-display text-lg text-[#12304A]">Optional Online Payment (Razorpay)</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.razorpayEnabled}
                      onChange={(e) => setSettings({ ...settings, razorpayEnabled: e.target.checked })}
                    />
                    <span>Enable Razorpay Checkout</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.allowPayAtClinic}
                      onChange={(e) => setSettings({ ...settings, allowPayAtClinic: e.target.checked })}
                    />
                    <span>Allow Pay at Clinic Option</span>
                  </label>
                  <div>
                    <label className="block font-semibold mb-1">Default Consultation Fee (INR)</label>
                    <input
                      type="number"
                      min={0}
                      value={settings.defaultConsultationFeeInr}
                      onChange={(e) =>
                        setSettings({ ...settings, defaultConsultationFeeInr: Number(e.target.value) })
                      }
                      className="w-full px-3 py-1.5 rounded-lg border border-[#12304A]/20 tabular-nums"
                    />
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => saveClinicSettings(settings)}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#12304A] text-white font-semibold cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>Save Website &amp; Payment Settings</span>
              </button>
            </div>

            <div className="bg-white border border-[#12304A]/10 rounded-xl p-6 space-y-3 text-xs max-w-md">
              <h2 className="font-display text-lg text-[#12304A]">Change Admin Password</h2>
              <input
                type="password"
                placeholder="Current password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-[#12304A]/20"
              />
              <input
                type="password"
                placeholder="New password (min 8 characters)"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-[#12304A]/20"
              />
              <button
                type="button"
                onClick={async () => {
                  const resp = await fetch('/api/admin/password', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ currentPassword, newPassword }),
                  });
                  const data = await resp.json();
                  if (!resp.ok) {
                    showToast(data.error || 'Could not update password.');
                    return;
                  }
                  setCurrentPassword('');
                  setNewPassword('');
                  showToast('Admin password updated.');
                }}
                className="px-4 py-2 rounded-lg bg-[#12304A] text-white font-semibold cursor-pointer"
              >
                Update Password
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Reschedule Modal */}
      {rescheduleTarget && (
        <div className="fixed inset-0 z-50 bg-[#12304A]/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-xl text-[#12304A]">
                Reschedule {rescheduleTarget.referenceCode}
              </h3>
              <button
                type="button"
                onClick={() => setRescheduleTarget(null)}
                className="p-1 text-[#71808D] hover:text-[#12304A] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-[#71808D]">
              Patient: {rescheduleTarget.patientName} · {rescheduleTarget.treatmentTitle}
            </p>
            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold mb-1">New Date</label>
                <input
                  type="date"
                  value={rescheduleDate}
                  min={todayIso}
                  onChange={(e) => setRescheduleDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-[#12304A]/20"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">Available Time Slots</label>
                <div className="grid grid-cols-3 gap-2 max-h-48 overflow-y-auto">
                  {rescheduleSlots
                    .filter((s) => s.available)
                    .map((s) => (
                      <button
                        key={s.time}
                        type="button"
                        onClick={() => setRescheduleTime(s.time)}
                        className={`py-2 px-2 rounded border tabular-nums font-semibold cursor-pointer ${
                          rescheduleTime === s.time
                            ? 'bg-[#12304A] text-white border-[#12304A]'
                            : 'border-[#12304A]/20 text-[#12304A]'
                        }`}
                      >
                        {s.label}
                      </button>
                    ))}
                </div>
              </div>
            </div>
            {rescheduleError && <p className="text-xs text-red-700">{rescheduleError}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setRescheduleTarget(null)}
                className="px-4 py-2 text-xs text-[#71808D] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!rescheduleTime}
                onClick={confirmReschedule}
                className="px-4 py-2 rounded-lg bg-[#12304A] text-white text-xs font-semibold disabled:opacity-50 cursor-pointer"
              >
                Save New Slot
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Full Edit / View Appointment Modal */}
      {editingAppt && (
        <div className="fixed inset-0 z-50 bg-[#12304A]/60 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 space-y-5 my-8">
            <div className="flex items-center justify-between border-b border-[#12304A]/10 pb-3">
              <div>
                <span className="text-xs font-mono text-[#19A7A1]">{editingAppt.referenceCode}</span>
                <h3 className="font-display text-2xl text-[#12304A]">View &amp; Edit Appointment</h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingAppt(null)}
                className="p-1 text-[#71808D] hover:text-[#12304A] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setEditApptError('');
                setSavingApptEdit(true);
                try {
                  const resp = await fetch(`/api/admin/appointments/${editingAppt.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(editingAppt),
                  });
                  const data = await resp.json();
                  if (!resp.ok) {
                    setEditApptError(data.error || 'Could not save appointment changes.');
                    return;
                  }
                  setAppointments((prev) =>
                    prev.map((a) => (a.id === data.appointment.id ? data.appointment : a)),
                  );
                  setEditingAppt(null);
                  showToast(
                    data.supabaseSynced
                      ? 'Appointment updated and synced to Supabase.'
                      : 'Appointment updated locally.',
                  );
                } catch {
                  setEditApptError('Network error while saving changes.');
                } finally {
                  setSavingApptEdit(false);
                }
              }}
              className="space-y-4 text-xs"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Patient Name</label>
                  <input
                    type="text"
                    required
                    value={editingAppt.patientName}
                    onChange={(e) => setEditingAppt({ ...editingAppt, patientName: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-[#12304A]/20"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Mobile Number</label>
                  <input
                    type="tel"
                    required
                    value={editingAppt.patientPhone}
                    onChange={(e) => setEditingAppt({ ...editingAppt, patientPhone: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-[#12304A]/20 tabular-nums"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Email</label>
                  <input
                    type="email"
                    value={editingAppt.patientEmail}
                    onChange={(e) => setEditingAppt({ ...editingAppt, patientEmail: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-[#12304A]/20"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Visit Type</label>
                  <select
                    value={editingAppt.patientType}
                    onChange={(e) =>
                      setEditingAppt({ ...editingAppt, patientType: e.target.value as PatientType })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-[#12304A]/20 bg-white"
                  >
                    <option value="first-time">First-time Visit</option>
                    <option value="returning">Returning Patient</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold mb-1">Treatment</label>
                  <select
                    value={editingAppt.treatmentId}
                    onChange={(e) =>
                      setEditingAppt({ ...editingAppt, treatmentId: Number(e.target.value) })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-[#12304A]/20 bg-white"
                  >
                    {treatments.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.title}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold mb-1">Dentist</label>
                  <select
                    value={editingAppt.doctorId}
                    onChange={(e) =>
                      setEditingAppt({ ...editingAppt, doctorId: Number(e.target.value) })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-[#12304A]/20 bg-white"
                  >
                    {doctors.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold mb-1">Appointment Date</label>
                  <input
                    type="date"
                    required
                    value={editingAppt.appointmentDate}
                    onChange={(e) =>
                      setEditingAppt({ ...editingAppt, appointmentDate: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-[#12304A]/20"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Time (HH:MM)</label>
                  <input
                    type="time"
                    required
                    value={editingAppt.appointmentTime}
                    onChange={(e) =>
                      setEditingAppt({ ...editingAppt, appointmentTime: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-[#12304A]/20 tabular-nums"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Status</label>
                  <select
                    value={editingAppt.status}
                    onChange={(e) =>
                      setEditingAppt({ ...editingAppt, status: e.target.value as AppointmentStatus })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-[#12304A]/20 bg-white font-semibold"
                  >
                    {(['Pending', 'Confirmed', 'Completed', 'Cancelled', 'Rescheduled', 'No-show'] as const).map(
                      (st) => (
                        <option key={st} value={st}>
                          {st}
                        </option>
                      ),
                    )}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block font-semibold mb-1">Payment Status</label>
                    <select
                      value={editingAppt.paymentStatus}
                      onChange={(e) =>
                        setEditingAppt({
                          ...editingAppt,
                          paymentStatus: e.target.value as PaymentStatus,
                        })
                      }
                      className="w-full px-2 py-2 rounded-lg border border-[#12304A]/20 bg-white"
                    >
                      {(['Not Required', 'Pay at Clinic', 'Pending Payment', 'Paid'] as const).map(
                        (ps) => (
                          <option key={ps} value={ps}>
                            {ps}
                          </option>
                        ),
                      )}
                    </select>
                  </div>
                  <div>
                    <label className="block font-semibold mb-1">Fee (INR)</label>
                    <input
                      type="number"
                      min={0}
                      value={editingAppt.paymentAmountInr}
                      onChange={(e) =>
                        setEditingAppt({
                          ...editingAppt,
                          paymentAmountInr: Number(e.target.value),
                        })
                      }
                      className="w-full px-2 py-2 rounded-lg border border-[#12304A]/20 tabular-nums"
                    />
                  </div>
                </div>
                <div className="sm:col-span-2">
                  <label className="block font-semibold mb-1">Patient / Staff Notes</label>
                  <textarea
                    rows={2}
                    value={editingAppt.notes}
                    onChange={(e) => setEditingAppt({ ...editingAppt, notes: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-[#12304A]/20"
                  />
                </div>
              </div>

              {editingAppt.notificationLog && editingAppt.notificationLog.length > 0 && (
                <div className="bg-[#FAFCFC] border border-[#12304A]/10 rounded-xl p-3 space-y-1">
                  <span className="font-semibold text-[#12304A] block">Sync &amp; Notification Log</span>
                  {editingAppt.notificationLog.map((log, i) => (
                    <div key={i} className="text-[11px] text-[#71808D]">
                      <strong className="text-[#263746]">{log.channel}</strong> ({log.status}): {log.detail}
                    </div>
                  ))}
                </div>
              )}

              {editApptError && (
                <p className="text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  {editApptError}
                </p>
              )}

              <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-[#12304A]/10">
                <button
                  type="button"
                  onClick={async () => {
                    const resp = await fetch(`/api/admin/appointments/${editingAppt.id}`, {
                      method: 'DELETE',
                    });
                    if (resp.ok) {
                      const d = await resp.json();
                      setAppointments((prev) => prev.filter((a) => a.id !== editingAppt.id));
                      setEditingAppt(null);
                      showToast(
                        d.supabaseSynced
                          ? 'Appointment record deleted from clinic & Supabase.'
                          : 'Appointment record deleted locally.',
                      );
                    }
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-red-200 text-red-700 hover:bg-red-50 font-semibold cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete Record</span>
                </button>
                <div className="flex items-center gap-2">
                  {editingAppt.status !== 'Cancelled' && (
                    <button
                      type="button"
                      onClick={async () => {
                        await updateAppointmentStatus(editingAppt.id, 'Cancelled');
                        setEditingAppt(null);
                      }}
                      className="px-4 py-2 rounded-lg border border-red-300 text-red-700 hover:bg-red-50 font-semibold cursor-pointer"
                    >
                      Cancel Booking
                    </button>
                  )}
                  <button
                    type="submit"
                    disabled={savingApptEdit}
                    className="px-5 py-2 rounded-lg bg-[#12304A] hover:bg-[#19A7A1] text-white font-semibold cursor-pointer disabled:opacity-60"
                  >
                    {savingApptEdit ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* New Walk-in / Phone Appointment Modal */}
      {creatingAppt && (
        <div className="fixed inset-0 z-50 bg-[#12304A]/60 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4 my-8">
            <div className="flex items-center justify-between border-b border-[#12304A]/10 pb-3">
              <h3 className="font-display text-2xl text-[#12304A]">New Walk-in / Phone Booking</h3>
              <button
                type="button"
                onClick={() => setCreatingAppt(false)}
                className="p-1 text-[#71808D] hover:text-[#12304A] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setNewApptError('');
                const resp = await fetch('/api/admin/appointments', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(newApptForm),
                });
                const data = await resp.json();
                if (!resp.ok) {
                  setNewApptError(data.error || 'Could not create appointment.');
                  return;
                }
                setAppointments((prev) => [data.appointment, ...prev]);
                setCreatingAppt(false);
                showToast(
                  data.supabaseSynced
                    ? 'New appointment saved & synced to Supabase.'
                    : 'New appointment saved locally.',
                );
              }}
              className="space-y-3 text-xs"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Patient Name</label>
                  <input
                    type="text"
                    required
                    value={newApptForm.patientName}
                    onChange={(e) => setNewApptForm({ ...newApptForm, patientName: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-[#12304A]/20"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Mobile Number</label>
                  <input
                    type="tel"
                    required
                    value={newApptForm.patientPhone}
                    onChange={(e) => setNewApptForm({ ...newApptForm, patientPhone: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-[#12304A]/20 tabular-nums"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Email (Optional)</label>
                  <input
                    type="email"
                    value={newApptForm.patientEmail}
                    onChange={(e) => setNewApptForm({ ...newApptForm, patientEmail: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-[#12304A]/20"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Initial Status</label>
                  <select
                    value={newApptForm.status}
                    onChange={(e) =>
                      setNewApptForm({ ...newApptForm, status: e.target.value as AppointmentStatus })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-[#12304A]/20 bg-white font-semibold"
                  >
                    <option value="Confirmed">Confirmed</option>
                    <option value="Pending">Pending</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold mb-1">Treatment</label>
                  <select
                    value={newApptForm.treatmentId}
                    onChange={(e) =>
                      setNewApptForm({ ...newApptForm, treatmentId: Number(e.target.value) })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-[#12304A]/20 bg-white"
                  >
                    {treatments.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.title}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold mb-1">Dentist</label>
                  <select
                    value={newApptForm.doctorId}
                    onChange={(e) =>
                      setNewApptForm({ ...newApptForm, doctorId: Number(e.target.value) })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-[#12304A]/20 bg-white"
                  >
                    {doctors.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold mb-1">Date</label>
                  <input
                    type="date"
                    required
                    min={todayIso}
                    value={newApptForm.appointmentDate}
                    onChange={(e) =>
                      setNewApptForm({ ...newApptForm, appointmentDate: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-[#12304A]/20"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Time (HH:MM)</label>
                  <input
                    type="time"
                    required
                    value={newApptForm.appointmentTime}
                    onChange={(e) =>
                      setNewApptForm({ ...newApptForm, appointmentTime: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-[#12304A]/20 tabular-nums"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block font-semibold mb-1">Notes (Optional)</label>
                  <textarea
                    rows={2}
                    value={newApptForm.notes}
                    onChange={(e) => setNewApptForm({ ...newApptForm, notes: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-[#12304A]/20"
                  />
                </div>
              </div>
              {newApptError && (
                <p className="text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  {newApptError}
                </p>
              )}
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setCreatingAppt(false)}
                  className="px-4 py-2 text-[#71808D] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg bg-[#12304A] hover:bg-[#19A7A1] text-white font-semibold cursor-pointer"
                >
                  Create Appointment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
