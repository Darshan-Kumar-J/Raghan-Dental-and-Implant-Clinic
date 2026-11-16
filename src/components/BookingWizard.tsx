import { useState, useEffect, useMemo } from 'react';
import {
  Calendar as CalendarIcon,
  Clock,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  UserCheck,
  MessageCircle,
  Search,
  AlertCircle,
  CreditCard,
  ArrowLeft,
} from 'lucide-react';
import {
  formatTime12h,
  formatDateReadable,
  getTodayIstIso,
  buildWhatsAppUrl,
  buildGoogleCalendarUrl,
} from '../lib/clinicUtils.ts';
import type {
  Appointment,
  AvailabilitySlot,
  ClinicSettings,
  Doctor,
  IntegrationStatus,
  PatientType,
  Treatment,
} from '../types/clinic.ts';

interface BookingWizardProps {
  settings: ClinicSettings;
  treatments: Treatment[];
  doctors: Doctor[];
  integrations: IntegrationStatus;
  initialTreatmentSlug?: string;
  initialDoctorId?: number;
  onNavigate: (path: string) => void;
}

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void };
  }
}

export function BookingWizard({
  settings,
  treatments,
  doctors,
  integrations,
  initialTreatmentSlug,
  initialDoctorId,
  onNavigate,
}: BookingWizardProps) {
  const [mode, setMode] = useState<'book' | 'lookup'>('book');
  const [step, setStep] = useState<number>(1);

  const initialTreatment = useMemo(() => {
    if (initialTreatmentSlug) {
      return treatments.find((t) => t.slug === initialTreatmentSlug) || treatments[0];
    }
    return treatments[0];
  }, [initialTreatmentSlug, treatments]);

  const [selectedTreatmentId, setSelectedTreatmentId] = useState<number>(initialTreatment?.id || 0);
  const [selectedDoctorId, setSelectedDoctorId] = useState<number>(
    initialDoctorId || doctors[0]?.id || 1,
  );
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedTime, setSelectedTime] = useState<string>('');

  // Calendar month navigation
  const todayIso = getTodayIstIso();
  const [calYear, setCalYear] = useState<number>(() => Number(todayIso.slice(0, 4)));
  const [calMonth, setCalMonth] = useState<number>(() => Number(todayIso.slice(5, 7)) - 1);

  // Live availability slots
  const [slots, setSlots] = useState<AvailabilitySlot[]>([]);
  const [closedReason, setClosedReason] = useState<string | undefined>(undefined);
  const [slotsLoading, setSlotsLoading] = useState<boolean>(false);

  // Patient form
  const [patientName, setPatientName] = useState('');
  const [patientPhone, setPatientPhone] = useState('');
  const [patientEmail, setPatientEmail] = useState('');
  const [patientType, setPatientType] = useState<PatientType>('first-time');
  const [notes, setNotes] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState(''); // honeypot

  // Payment choice
  const canPayOnline = settings.razorpayEnabled && integrations.razorpayConfigured;
  const [paymentMode, setPaymentMode] = useState<'clinic' | 'razorpay'>('clinic');

  // Submission & Confirmation
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [confirmedAppointment, setConfirmedAppointment] = useState<Appointment | null>(null);

  // Lookup state
  const [lookupRef, setLookupRef] = useState('');
  const [lookupLast4, setLookupLast4] = useState('');
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState('');
  const [lookupResult, setLookupResult] = useState<Partial<Appointment> | null>(null);

  const selectedTreatment = treatments.find((t) => t.id === selectedTreatmentId) || treatments[0];
  const selectedDoctor = doctors.find((d) => d.id === selectedDoctorId) || doctors[0];

  useEffect(() => {
    if (initialTreatmentSlug) {
      const match = treatments.find((t) => t.slug === initialTreatmentSlug);
      if (match) {
        setSelectedTreatmentId(match.id);
      }
    }
  }, [initialTreatmentSlug, treatments]);

  useEffect(() => {
    if (!selectedDate) return;
    let active = true;
    setSlotsLoading(true);
    setClosedReason(undefined);
    fetch(
      `/api/availability?date=${encodeURIComponent(selectedDate)}&doctorId=${selectedDoctorId}&treatmentId=${selectedTreatmentId}`,
    )
      .then((r) => r.json())
      .then((data) => {
        if (!active) return;
        setSlots(Array.isArray(data.slots) ? data.slots : []);
        setClosedReason(data.closedReason);
        setSelectedTime('');
      })
      .catch(() => {
        if (!active) return;
        setSlots([]);
        setClosedReason('Unable to load available time slots. Please retry.');
      })
      .finally(() => {
        if (active) setSlotsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [selectedDate, selectedDoctorId, selectedTreatmentId]);

  const calendarDays = useMemo(() => {
    const firstDay = new Date(Date.UTC(calYear, calMonth, 1));
    const startWeekday = firstDay.getUTCDay();
    const daysInMonth = new Date(Date.UTC(calYear, calMonth + 1, 0)).getUTCDate();
    const maxDate = new Date(`${todayIso}T00:00:00Z`);
    maxDate.setUTCDate(maxDate.getUTCDate() + (settings.advanceBookingDays || 30));
    const maxIso = maxDate.toISOString().slice(0, 10);

    const cells: Array<{ iso: string; dayNum: number; disabled: boolean; reason?: string } | null> = [];
    for (let i = 0; i < startWeekday; i++) cells.push(null);

    for (let d = 1; d <= daysInMonth; d++) {
      const iso = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dow = new Date(`${iso}T00:00:00Z`).getUTCDay();
      const daySched = settings.weeklySchedule.find((w) => w.day === dow);
      const isPast = iso < todayIso;
      const isTooFar = iso > maxIso;
      const isClosedDay = !daySched || !daySched.isOpen;
      const disabled = isPast || isTooFar || isClosedDay;
      cells.push({
        iso,
        dayNum: d,
        disabled,
        reason: isPast ? 'Past date' : isClosedDay ? 'Clinic closed' : isTooFar ? 'Beyond booking window' : undefined,
      });
    }
    return cells;
  }, [calYear, calMonth, todayIso, settings.advanceBookingDays, settings.weeklySchedule]);

  const monthLabel = new Date(Date.UTC(calYear, calMonth, 1)).toLocaleDateString('en-IN', {
    timeZone: 'UTC',
    month: 'long',
    year: 'numeric',
  });

  const handlePrevMonth = () => {
    if (calMonth === 0) {
      setCalYear((y) => y - 1);
      setCalMonth(11);
    } else {
      setCalMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (calMonth === 11) {
      setCalYear((y) => y + 1);
      setCalMonth(0);
    } else {
      setCalMonth((m) => m + 1);
    }
  };

  const loadRazorpayScript = (): Promise<boolean> => {
    if (window.Razorpay) return Promise.resolve(true);
    return new Promise((resolve) => {
      const s = document.createElement('script');
      s.src = 'https://checkout.razorpay.com/v1/checkout.js';
      s.onload = () => resolve(true);
      s.onerror = () => resolve(false);
      document.body.appendChild(s);
    });
  };

  const submitBookingRequest = async (razorpayPayload?: {
    razorpayOrderId: string;
    razorpayPaymentId: string;
    razorpaySignature: string;
  }) => {
    setSubmitting(true);
    setSubmitError('');
    try {
      const resp = await fetch('/api/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          treatmentId: selectedTreatmentId,
          doctorId: selectedDoctorId,
          appointmentDate: selectedDate,
          appointmentTime: selectedTime,
          patientName,
          patientPhone,
          patientEmail,
          patientType,
          notes,
          websiteUrl,
          paymentMode: razorpayPayload ? 'razorpay' : 'clinic',
          ...razorpayPayload,
        }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        setSubmitError(data.error || 'Could not complete appointment booking.');
        if (resp.status === 409) {
          // Refresh slots so user sees updated live availability
          const avail = await fetch(
            `/api/availability?date=${encodeURIComponent(selectedDate)}&doctorId=${selectedDoctorId}&treatmentId=${selectedTreatmentId}`,
          ).then((r) => r.json());
          setSlots(Array.isArray(avail.slots) ? avail.slots : []);
          setSelectedTime('');
        }
        return;
      }
      setConfirmedAppointment(data.appointment);
    } catch {
      setSubmitError('Network error while saving your appointment. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmClick = async () => {
    setSubmitError('');
    if (patientName.trim().length < 2) {
      setSubmitError('Please enter your full name.');
      setStep(5);
      return;
    }
    if (patientPhone.replace(/[^\d]/g, '').length < 10) {
      setSubmitError('Please enter a valid 10-digit mobile number.');
      setStep(5);
      return;
    }

    if (paymentMode === 'razorpay' && canPayOnline) {
      setSubmitting(true);
      const loaded = await loadRazorpayScript();
      if (!loaded || !window.Razorpay) {
        setSubmitting(false);
        setSubmitError('Could not load Razorpay checkout. You may choose Pay at Clinic instead.');
        return;
      }
      try {
        const orderResp = await fetch('/api/payments/razorpay/order', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ treatmentId: selectedTreatmentId }),
        });
        const orderData = await orderResp.json();
        if (!orderResp.ok) {
          setSubmitting(false);
          setSubmitError(orderData.error || 'Unable to start online payment.');
          return;
        }
        const rzp = new window.Razorpay({
          key: orderData.keyId,
          amount: orderData.amountPaise,
          currency: 'INR',
          name: settings.clinicName,
          description: selectedTreatment?.title || 'Dental Consultation',
          order_id: orderData.orderId,
          prefill: {
            name: patientName,
            contact: patientPhone,
            email: patientEmail,
          },
          theme: { color: '#12304A' },
          handler: (response: Record<string, string>) => {
            submitBookingRequest({
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature,
            });
          },
          modal: {
            ondismiss: () => setSubmitting(false),
          },
        });
        rzp.open();
      } catch {
        setSubmitting(false);
        setSubmitError('Failed to connect to payment gateway.');
      }
      return;
    }

    await submitBookingRequest();
  };

  const handleLookupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLookupError('');
    setLookupResult(null);
    setLookupLoading(true);
    try {
      const resp = await fetch(
        `/api/appointments/lookup?ref=${encodeURIComponent(lookupRef)}&last4=${encodeURIComponent(lookupLast4)}`,
      );
      const data = await resp.json();
      if (!resp.ok) {
        setLookupError(data.error || 'No matching appointment found.');
        return;
      }
      setLookupResult(data);
    } catch {
      setLookupError('Unable to check appointment status right now.');
    } finally {
      setLookupLoading(false);
    }
  };

  const stepLabels = [
    { num: 1, title: 'Treatment' },
    { num: 2, title: 'Dentist' },
    { num: 3, title: 'Date' },
    { num: 4, title: 'Time' },
    { num: 5, title: 'Your Details' },
    { num: 6, title: 'Confirm' },
  ];

  const availableSlotsCount = slots.filter((s) => s.available).length;

  if (confirmedAppointment) {
    const waMessage = `Hello ${settings.clinicName}, I have booked an appointment (${confirmedAppointment.referenceCode}) for ${confirmedAppointment.treatmentTitle} on ${formatDateReadable(confirmedAppointment.appointmentDate)} at ${formatTime12h(confirmedAppointment.appointmentTime)}.`;
    return (
      <section className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
        <div className="bg-white border border-[#12304A]/15 rounded-2xl p-6 sm:p-10 shadow-sm space-y-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-[#19A7A1]/15 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-7 h-7 text-[#19A7A1]" />
            </div>
            <div>
              <p className="text-sm font-medium text-[#19A7A1]">
                {confirmedAppointment.status === 'Confirmed'
                  ? 'Appointment Confirmed'
                  : 'Appointment Request Received'}
              </p>
              <h1 className="font-display text-3xl text-[#12304A] mt-1">
                Thank you, {confirmedAppointment.patientName}
              </h1>
              <p className="text-sm text-[#71808D] mt-2">
                {confirmedAppointment.status === 'Pending'
                  ? 'Your requested slot is reserved as Pending and will be confirmed by clinic staff shortly.'
                  : 'Your appointment slot is confirmed and saved in our clinic schedule.'}
              </p>
            </div>
          </div>

          <div className="bg-[#F1F7F7] rounded-xl p-5 grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm border border-[#12304A]/10">
            <div>
              <span className="block text-xs text-[#71808D]">Booking Reference</span>
              <span className="font-mono font-semibold text-base text-[#12304A] tabular-nums">
                {confirmedAppointment.referenceCode}
              </span>
            </div>
            <div>
              <span className="block text-xs text-[#71808D]">Current Status</span>
              <span className="font-semibold text-[#12304A]">{confirmedAppointment.status}</span>
            </div>
            <div>
              <span className="block text-xs text-[#71808D]">Treatment Category</span>
              <span className="font-medium text-[#263746]">{confirmedAppointment.treatmentTitle}</span>
            </div>
            <div>
              <span className="block text-xs text-[#71808D]">Dentist</span>
              <span className="font-medium text-[#263746]">{confirmedAppointment.doctorName}</span>
            </div>
            <div>
              <span className="block text-xs text-[#71808D]">Date &amp; Time</span>
              <span className="font-semibold text-[#12304A] tabular-nums">
                {formatDateReadable(confirmedAppointment.appointmentDate)} ·{' '}
                {formatTime12h(confirmedAppointment.appointmentTime)}
              </span>
            </div>
            <div>
              <span className="block text-xs text-[#71808D]">Payment Status</span>
              <span className="font-medium text-[#263746]">
                {confirmedAppointment.paymentStatus}
                {confirmedAppointment.paymentAmountInr > 0
                  ? ` (₹${confirmedAppointment.paymentAmountInr})`
                  : ''}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap gap-3 pt-2">
            <a
              href={buildGoogleCalendarUrl(confirmedAppointment, settings.address)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#12304A] hover:bg-[#19A7A1] text-white text-sm font-semibold transition-colors"
            >
              <CalendarIcon className="w-4 h-4" />
              <span>Add to Google Calendar</span>
            </a>
            <a
              href={buildWhatsAppUrl(settings.whatsappNumber, waMessage)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg border border-[#19A7A1] text-[#12304A] hover:bg-[#F1F7F7] text-sm font-semibold transition-colors"
            >
              <MessageCircle className="w-4 h-4 text-[#19A7A1]" />
              <span>Message Clinic on WhatsApp</span>
            </a>
            <button
              type="button"
              onClick={() => {
                setConfirmedAppointment(null);
                setStep(1);
                setSelectedDate('');
                setSelectedTime('');
                setNotes('');
              }}
              className="px-4 py-2.5 rounded-lg text-sm font-medium text-[#71808D] hover:text-[#12304A] cursor-pointer"
            >
              Book Another Visit
            </button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
        <div>
          <button
            type="button"
            onClick={() => onNavigate('/')}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-[#71808D] hover:text-[#12304A] mb-3 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Home</span>
          </button>
          <h1 className="font-display text-3xl sm:text-4xl text-[#12304A]">
            Book Your Dental Appointment
          </h1>
          <p className="text-sm sm:text-base text-[#71808D] mt-1">
            Subramanyanagar, Bengaluru · Real-time slot availability with Dr. Deepthi K
          </p>
        </div>

        {/* Mode Switch */}
        <div className="inline-flex p-1 bg-[#F1F7F7] rounded-lg border border-[#12304A]/10 self-start">
          <button
            type="button"
            onClick={() => setMode('book')}
            className={`px-3.5 py-2 text-xs font-semibold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
              mode === 'book' ? 'bg-white text-[#12304A] shadow-sm' : 'text-[#71808D] hover:text-[#12304A]'
            }`}
          >
            New Appointment
          </button>
          <button
            type="button"
            onClick={() => setMode('lookup')}
            className={`px-3.5 py-2 text-xs font-semibold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
              mode === 'lookup' ? 'bg-white text-[#12304A] shadow-sm' : 'text-[#71808D] hover:text-[#12304A]'
            }`}
          >
            Check Booking Status
          </button>
        </div>
      </div>

      {mode === 'lookup' ? (
        <div className="bg-white border border-[#12304A]/15 rounded-2xl p-6 sm:p-8 max-w-xl">
          <h2 className="font-display text-2xl text-[#12304A] mb-2">Check Appointment Status</h2>
          <p className="text-sm text-[#71808D] mb-6">
            Enter your booking reference code and the last 4 digits of your mobile number.
          </p>
          <form onSubmit={handleLookupSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[#263746] mb-1.5">
                Booking Reference Code
              </label>
              <input
                type="text"
                required
                placeholder="e.g. RD-20261118-A1B2"
                value={lookupRef}
                onChange={(e) => setLookupRef(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-lg border border-[#12304A]/20 text-sm font-mono focus:outline-none focus:border-[#19A7A1]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#263746] mb-1.5">
                Last 4 Digits of Mobile Number
              </label>
              <input
                type="text"
                required
                maxLength={4}
                pattern="\d{4}"
                placeholder="e.g. 0619"
                value={lookupLast4}
                onChange={(e) => setLookupLast4(e.target.value.replace(/\D/g, '').slice(0, 4))}
                className="w-full px-3.5 py-2.5 rounded-lg border border-[#12304A]/20 text-sm font-mono focus:outline-none focus:border-[#19A7A1]"
              />
            </div>
            {lookupError && (
              <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {lookupError}
              </p>
            )}
            <button
              type="submit"
              disabled={lookupLoading}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#12304A] hover:bg-[#19A7A1] text-white text-sm font-semibold transition-colors cursor-pointer disabled:opacity-60"
            >
              <Search className="w-4 h-4" />
              <span>{lookupLoading ? 'Checking...' : 'Check Status'}</span>
            </button>
          </form>

          {lookupResult && (
            <div className="mt-6 pt-6 border-t border-[#12304A]/10 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-[#71808D]">Reference</span>
                <span className="font-mono font-semibold text-[#12304A]">{lookupResult.referenceCode}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#71808D]">Status</span>
                <span className="font-semibold text-[#19A7A1]">{lookupResult.status}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#71808D]">Treatment</span>
                <span className="text-[#263746]">{lookupResult.treatmentTitle}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#71808D]">Date &amp; Time</span>
                <span className="text-[#263746] tabular-nums">
                  {formatDateReadable(String(lookupResult.appointmentDate))} ·{' '}
                  {formatTime12h(String(lookupResult.appointmentTime))}
                </span>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white border border-[#12304A]/15 rounded-2xl overflow-hidden shadow-sm">
          {/* Step Progress Bar */}
          <div className="bg-[#F1F7F7] px-4 sm:px-8 py-4 border-b border-[#12304A]/10 overflow-x-auto">
            <ol className="flex items-center justify-between min-w-[540px] gap-2">
              {stepLabels.map((s) => {
                const isCurrent = step === s.num;
                const isDone = step > s.num;
                const canJump =
                  s.num === 1 ||
                  (s.num === 2 && selectedTreatmentId > 0) ||
                  (s.num === 3 && selectedDoctorId > 0) ||
                  (s.num === 4 && Boolean(selectedDate)) ||
                  (s.num === 5 && Boolean(selectedTime)) ||
                  (s.num === 6 && Boolean(selectedTime) && patientName.trim().length >= 2);
                return (
                  <li key={s.num} className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={!canJump}
                      onClick={() => canJump && setStep(s.num)}
                      className={`flex items-center gap-2 text-xs font-semibold whitespace-nowrap transition-colors ${
                        canJump ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'
                      } ${isCurrent ? 'text-[#12304A]' : isDone ? 'text-[#19A7A1]' : 'text-[#71808D]'}`}
                    >
                      <span
                        className={`w-6 h-6 rounded-full flex items-center justify-center text-xs tabular-nums ${
                          isCurrent
                            ? 'bg-[#12304A] text-white'
                            : isDone
                              ? 'bg-[#19A7A1] text-white'
                              : 'bg-white border border-[#12304A]/20 text-[#71808D]'
                        }`}
                      >
                        {s.num}
                      </span>
                      <span>{s.title}</span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </div>

          <div className="p-6 sm:p-8">
            {/* Step 1: Select Treatment */}
            {step === 1 && (
              <div className="space-y-6">
                <div>
                  <h2 className="font-display text-2xl text-[#12304A]">1. Select Treatment or Consultation</h2>
                  <p className="text-sm text-[#71808D] mt-1">
                    Choose the dental concern or consultation you would like to schedule.
                  </p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {treatments.map((tr) => {
                    const active = tr.id === selectedTreatmentId;
                    return (
                      <button
                        key={tr.id}
                        type="button"
                        onClick={() => {
                          setSelectedTreatmentId(tr.id);
                          setStep(2);
                        }}
                        className={`text-left p-4 rounded-xl border transition-all cursor-pointer ${
                          active
                            ? 'border-[#19A7A1] bg-[#F1F7F7] ring-1 ring-[#19A7A1]'
                            : 'border-[#12304A]/15 hover:border-[#19A7A1]/60 bg-white'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 text-xs text-[#71808D] mb-1">
                          <span>{tr.category}</span>
                          <span className="tabular-nums">{tr.durationMinutes} min</span>
                        </div>
                        <h3 className="font-display text-lg text-[#12304A]">{tr.title}</h3>
                        <p className="text-xs text-[#71808D] mt-1.5 line-clamp-2">{tr.shortDescription}</p>
                        {!tr.isConfirmedAvailable && (
                          <p className="text-[11px] text-[#71808D] mt-2 italic">
                            Availability confirmed by clinic staff upon scheduling
                          </p>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Step 2: Select Dentist */}
            {step === 2 && (
              <div className="space-y-6">
                <div>
                  <h2 className="font-display text-2xl text-[#12304A]">2. Select Dentist</h2>
                  <p className="text-sm text-[#71808D] mt-1">
                    Choose your preferred clinician for this visit.
                  </p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {doctors.map((doc) => {
                    const active = doc.id === selectedDoctorId;
                    return (
                      <button
                        key={doc.id}
                        type="button"
                        onClick={() => {
                          setSelectedDoctorId(doc.id);
                          setStep(3);
                        }}
                        className={`text-left p-5 rounded-xl border transition-all cursor-pointer flex items-start gap-4 ${
                          active
                            ? 'border-[#19A7A1] bg-[#F1F7F7] ring-1 ring-[#19A7A1]'
                            : 'border-[#12304A]/15 hover:border-[#19A7A1]/60 bg-white'
                        }`}
                      >
                        <div className="w-14 h-14 rounded-xl bg-[#12304A] text-white flex items-center justify-center font-display text-xl shrink-0 overflow-hidden">
                          {doc.photoUrl && doc.isPhotoVerified ? (
                            <img
                              src={doc.photoUrl}
                              alt={doc.name}
                              referrerPolicy="no-referrer"
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <span>DK</span>
                          )}
                        </div>
                        <div>
                          <h3 className="font-display text-xl text-[#12304A]">{doc.name}</h3>
                          <p className="text-xs font-semibold text-[#19A7A1] mt-0.5">{doc.qualifications}</p>
                          <p className="text-xs text-[#71808D] mt-1.5">{doc.experienceNote}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
                <div className="flex justify-between pt-4 border-t border-[#12304A]/10">
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="px-4 py-2 text-sm font-medium text-[#71808D] hover:text-[#12304A] cursor-pointer"
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    onClick={() => setStep(3)}
                    className="px-6 py-2.5 rounded-lg bg-[#12304A] hover:bg-[#19A7A1] text-white text-sm font-semibold cursor-pointer"
                  >
                    Continue to Date
                  </button>
                </div>
              </div>
            )}

            {/* Step 3: Select Date */}
            {step === 3 && (
              <div className="space-y-6">
                <div>
                  <h2 className="font-display text-2xl text-[#12304A]">3. Choose Appointment Date</h2>
                  <p className="text-sm text-[#71808D] mt-1">
                    Past dates and closed clinic days are disabled automatically.
                  </p>
                </div>

                <div className="max-w-md border border-[#12304A]/15 rounded-xl p-5 bg-[#FAFCFC]">
                  <div className="flex items-center justify-between mb-4">
                    <button
                      type="button"
                      onClick={handlePrevMonth}
                      aria-label="Previous month"
                      className="p-2 rounded-lg hover:bg-[#F1F7F7] text-[#12304A] cursor-pointer"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                    <span className="font-display text-lg text-[#12304A]">{monthLabel}</span>
                    <button
                      type="button"
                      onClick={handleNextMonth}
                      aria-label="Next month"
                      className="p-2 rounded-lg hover:bg-[#F1F7F7] text-[#12304A] cursor-pointer"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="grid grid-cols-7 text-center text-xs font-semibold text-[#71808D] mb-2">
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                      <div key={d} className="py-1">
                        {d}
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-7 gap-1.5">
                    {calendarDays.map((cell, idx) =>
                      cell === null ? (
                        <div key={`empty-${idx}`} />
                      ) : (
                        <button
                          key={cell.iso}
                          type="button"
                          disabled={cell.disabled}
                          title={cell.reason}
                          onClick={() => {
                            setSelectedDate(cell.iso);
                            setStep(4);
                          }}
                          className={`h-10 rounded-lg text-sm font-medium tabular-nums transition-colors ${
                            cell.disabled
                              ? 'text-[#71808D]/40 cursor-not-allowed'
                              : selectedDate === cell.iso
                                ? 'bg-[#12304A] text-white font-semibold cursor-pointer'
                                : cell.iso === todayIso
                                  ? 'bg-[#19A7A1]/15 text-[#12304A] hover:bg-[#19A7A1] hover:text-white cursor-pointer'
                                  : 'text-[#263746] hover:bg-[#F1F7F7] cursor-pointer'
                          }`}
                        >
                          {cell.dayNum}
                        </button>
                      ),
                    )}
                  </div>
                </div>

                <div className="flex justify-between pt-4 border-t border-[#12304A]/10">
                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    className="px-4 py-2 text-sm font-medium text-[#71808D] hover:text-[#12304A] cursor-pointer"
                  >
                    Previous
                  </button>
                  {selectedDate && (
                    <button
                      type="button"
                      onClick={() => setStep(4)}
                      className="px-6 py-2.5 rounded-lg bg-[#12304A] hover:bg-[#19A7A1] text-white text-sm font-semibold cursor-pointer"
                    >
                      Continue to Time Slots
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Step 4: Select Time Slot */}
            {step === 4 && (
              <div className="space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h2 className="font-display text-2xl text-[#12304A]">4. Select Available Time Slot</h2>
                    <p className="text-sm text-[#71808D] mt-1">
                      {formatDateReadable(selectedDate)} · {selectedDoctor?.name} ({selectedTreatment?.durationMinutes} min)
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setStep(3)}
                    className="text-xs font-semibold text-[#19A7A1] hover:underline self-start cursor-pointer"
                  >
                    Change Date
                  </button>
                </div>

                {slotsLoading ? (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                      <div key={n} className="h-11 rounded-lg bg-[#F1F7F7] animate-pulse" />
                    ))}
                  </div>
                ) : closedReason ? (
                  <div className="p-5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-sm flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold">No slots available on this date</p>
                      <p className="mt-1">{closedReason}</p>
                    </div>
                  </div>
                ) : availableSlotsCount === 0 ? (
                  <div className="p-5 rounded-xl bg-[#F1F7F7] border border-[#12304A]/15 text-sm text-[#263746]">
                    All time slots for {formatDateReadable(selectedDate)} are currently booked or unavailable. Please select another date.
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {slots
                      .filter((s) => s.available)
                      .map((slot) => {
                        const active = selectedTime === slot.time;
                        return (
                          <button
                            key={slot.time}
                            type="button"
                            onClick={() => {
                              setSelectedTime(slot.time);
                              setStep(5);
                            }}
                            className={`py-3 px-3 rounded-lg border text-sm font-semibold tabular-nums flex items-center justify-center gap-2 transition-colors cursor-pointer ${
                              active
                                ? 'bg-[#12304A] text-white border-[#12304A]'
                                : 'bg-white text-[#12304A] border-[#12304A]/20 hover:border-[#19A7A1] hover:bg-[#F1F7F7]'
                            }`}
                          >
                            <Clock className="w-3.5 h-3.5 text-[#19A7A1]" />
                            <span>{slot.label}</span>
                          </button>
                        );
                      })}
                  </div>
                )}

                <div className="flex justify-between pt-4 border-t border-[#12304A]/10">
                  <button
                    type="button"
                    onClick={() => setStep(3)}
                    className="px-4 py-2 text-sm font-medium text-[#71808D] hover:text-[#12304A] cursor-pointer"
                  >
                    Previous
                  </button>
                  {selectedTime && (
                    <button
                      type="button"
                      onClick={() => setStep(5)}
                      className="px-6 py-2.5 rounded-lg bg-[#12304A] hover:bg-[#19A7A1] text-white text-sm font-semibold cursor-pointer"
                    >
                      Continue to Patient Details
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Step 5: Patient Details */}
            {step === 5 && (
              <div className="space-y-6">
                <div>
                  <h2 className="font-display text-2xl text-[#12304A]">5. Patient Information</h2>
                  <p className="text-sm text-[#71808D] mt-1">
                    We collect only the details needed to schedule and coordinate your dental appointment.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Honeypot field hidden from real users */}
                  <input
                    type="text"
                    tabIndex={-1}
                    autoComplete="off"
                    value={websiteUrl}
                    onChange={(e) => setWebsiteUrl(e.target.value)}
                    className="hidden"
                    aria-hidden="true"
                  />
                  <div>
                    <label className="block text-sm font-medium text-[#263746] mb-1.5">
                      Full Name <span className="text-red-600">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={patientName}
                      onChange={(e) => setPatientName(e.target.value)}
                      placeholder="Enter your full name"
                      className="w-full px-3.5 py-2.5 rounded-lg border border-[#12304A]/20 text-sm focus:outline-none focus:border-[#19A7A1]"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[#263746] mb-1.5">
                      Mobile Number <span className="text-red-600">*</span>
                    </label>
                    <input
                      type="tel"
                      required
                      value={patientPhone}
                      onChange={(e) => setPatientPhone(e.target.value)}
                      placeholder="+91 98XXX XXXXX"
                      className="w-full px-3.5 py-2.5 rounded-lg border border-[#12304A]/20 text-sm tabular-nums focus:outline-none focus:border-[#19A7A1]"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[#263746] mb-1.5">
                      Email Address <span className="text-[#71808D] font-normal">(Optional)</span>
                    </label>
                    <input
                      type="email"
                      value={patientEmail}
                      onChange={(e) => setPatientEmail(e.target.value)}
                      placeholder="name@example.com"
                      className="w-full px-3.5 py-2.5 rounded-lg border border-[#12304A]/20 text-sm focus:outline-none focus:border-[#19A7A1]"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[#263746] mb-1.5">Visit Type</label>
                    <div className="grid grid-cols-2 gap-2">
                      {(['first-time', 'returning'] as const).map((pt) => (
                        <button
                          key={pt}
                          type="button"
                          onClick={() => setPatientType(pt)}
                          className={`py-2.5 px-3 rounded-lg border text-sm font-medium transition-colors cursor-pointer ${
                            patientType === pt
                              ? 'bg-[#12304A] text-white border-[#12304A]'
                              : 'bg-white text-[#263746] border-[#12304A]/20 hover:bg-[#F1F7F7]'
                          }`}
                        >
                          {pt === 'first-time' ? 'First-time Visit' : 'Returning Patient'}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-[#263746] mb-1.5">
                      Brief Concern or Note <span className="text-[#71808D] font-normal">(Optional)</span>
                    </label>
                    <textarea
                      rows={3}
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Share any tooth sensitivity, gum concern, or scheduling preference..."
                      className="w-full px-3.5 py-2.5 rounded-lg border border-[#12304A]/20 text-sm focus:outline-none focus:border-[#19A7A1]"
                    />
                  </div>
                </div>

                {submitError && (
                  <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3.5 py-2.5">
                    {submitError}
                  </p>
                )}

                <div className="flex justify-between pt-4 border-t border-[#12304A]/10">
                  <button
                    type="button"
                    onClick={() => setStep(4)}
                    className="px-4 py-2 text-sm font-medium text-[#71808D] hover:text-[#12304A] cursor-pointer"
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (patientName.trim().length < 2) {
                        setSubmitError('Please enter your full name.');
                        return;
                      }
                      if (patientPhone.replace(/[^\d]/g, '').length < 10) {
                        setSubmitError('Please enter a valid 10-digit mobile number.');
                        return;
                      }
                      setSubmitError('');
                      setStep(6);
                    }}
                    className="px-6 py-2.5 rounded-lg bg-[#12304A] hover:bg-[#19A7A1] text-white text-sm font-semibold cursor-pointer"
                  >
                    Review Summary
                  </button>
                </div>
              </div>
            )}

            {/* Step 6: Summary & Confirm */}
            {step === 6 && (
              <div className="space-y-6">
                <div>
                  <h2 className="font-display text-2xl text-[#12304A]">6. Review &amp; Confirm Appointment</h2>
                  <p className="text-sm text-[#71808D] mt-1">
                    Please verify your appointment details before confirming.
                  </p>
                </div>

                <div className="bg-[#F1F7F7] rounded-xl p-5 border border-[#12304A]/10 grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="block text-xs text-[#71808D]">Selected Treatment</span>
                    <span className="font-semibold text-[#12304A]">{selectedTreatment?.title}</span>
                  </div>
                  <div>
                    <span className="block text-xs text-[#71808D]">Dentist</span>
                    <span className="font-semibold text-[#12304A]">{selectedDoctor?.name}</span>
                  </div>
                  <div>
                    <span className="block text-xs text-[#71808D]">Appointment Date</span>
                    <span className="font-semibold text-[#12304A]">{formatDateReadable(selectedDate)}</span>
                  </div>
                  <div>
                    <span className="block text-xs text-[#71808D]">Appointment Time</span>
                    <span className="font-semibold text-[#12304A] tabular-nums">
                      {formatTime12h(selectedTime)} ({selectedTreatment?.durationMinutes} min)
                    </span>
                  </div>
                  <div>
                    <span className="block text-xs text-[#71808D]">Patient Name</span>
                    <span className="font-medium text-[#263746]">{patientName}</span>
                  </div>
                  <div>
                    <span className="block text-xs text-[#71808D]">Mobile &amp; Visit Type</span>
                    <span className="font-medium text-[#263746] tabular-nums">
                      {patientPhone} · {patientType === 'first-time' ? 'First-time' : 'Returning'}
                    </span>
                  </div>
                  {notes && (
                    <div className="sm:col-span-2">
                      <span className="block text-xs text-[#71808D]">Notes</span>
                      <span className="text-[#263746]">{notes}</span>
                    </div>
                  )}
                </div>

                {/* Optional Razorpay Payment Choice */}
                {canPayOnline && (
                  <div className="border border-[#12304A]/15 rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-[#12304A] flex items-center gap-2">
                        <CreditCard className="w-4 h-4 text-[#19A7A1]" />
                        <span>Consultation Fee Payment</span>
                      </span>
                      <span className="text-sm font-semibold text-[#12304A] tabular-nums">
                        ₹{selectedTreatment?.consultationFeeInr || settings.defaultConsultationFeeInr}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {settings.allowPayAtClinic && (
                        <button
                          type="button"
                          onClick={() => setPaymentMode('clinic')}
                          className={`p-3 rounded-lg border text-left text-xs font-medium cursor-pointer ${
                            paymentMode === 'clinic'
                              ? 'border-[#19A7A1] bg-[#F1F7F7] text-[#12304A]'
                              : 'border-[#12304A]/15 text-[#71808D]'
                          }`}
                        >
                          Pay at Clinic Reception
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setPaymentMode('razorpay')}
                        className={`p-3 rounded-lg border text-left text-xs font-medium cursor-pointer ${
                          paymentMode === 'razorpay'
                            ? 'border-[#19A7A1] bg-[#F1F7F7] text-[#12304A]'
                            : 'border-[#12304A]/15 text-[#71808D]'
                        }`}
                      >
                        Pay Now via Razorpay (UPI / Card / NetBanking)
                      </button>
                    </div>
                  </div>
                )}

                <p className="text-xs text-[#71808D]">
                  Cancellation policy: {settings.cancellationPolicy}
                </p>

                {submitError && (
                  <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3.5 py-2.5">
                    {submitError}
                  </p>
                )}

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-4 border-t border-[#12304A]/10">
                  <button
                    type="button"
                    onClick={() => setStep(5)}
                    className="px-4 py-2 text-sm font-medium text-[#71808D] hover:text-[#12304A] self-start cursor-pointer"
                  >
                    Edit Details
                  </button>
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={handleConfirmClick}
                    className="inline-flex items-center justify-center gap-2 px-7 py-3 rounded-lg bg-[#12304A] hover:bg-[#19A7A1] text-white text-sm font-semibold transition-colors cursor-pointer disabled:opacity-60"
                  >
                    <UserCheck className="w-4 h-4" />
                    <span>
                      {submitting
                        ? 'Confirming...'
                        : paymentMode === 'razorpay' && canPayOnline
                          ? 'Pay & Confirm Appointment'
                          : 'Confirm Appointment'}
                    </span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
