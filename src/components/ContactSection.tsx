import { useState } from 'react';
import { MapPin, Phone, MessageCircle, Clock, Navigation, Send, CheckCircle2, ArrowLeft } from 'lucide-react';
import { buildWhatsAppUrl, formatTime12h } from '../lib/clinicUtils.ts';
import type { ClinicSettings } from '../types/clinic.ts';

interface ContactSectionProps {
  settings: ClinicSettings;
  standalonePage?: boolean;
  onNavigate?: (path: string) => void;
}

export function ContactSection({ settings, standalonePage = false, onNavigate }: ContactSectionProps) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('Appointment or Treatment Enquiry');
  const [message, setMessage] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState(''); // honeypot
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  const waUrl = buildWhatsAppUrl(
    settings.whatsappNumber,
    'Hello Raghan Dental and Implant Care, I would like to enquire about booking a dental appointment.',
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSending(true);
    try {
      const resp = await fetch('/api/enquiries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, phone, email, subject, message, websiteUrl }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        setError(data.error || 'Could not send enquiry.');
        return;
      }
      setSent(true);
      setName('');
      setPhone('');
      setEmail('');
      setMessage('');
    } catch {
      setError('Network error. Please call or WhatsApp the clinic directly.');
    } finally {
      setSending(false);
    }
  };

  return (
    <section
      id="contact"
      className={standalonePage ? 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14' : 'py-20 bg-[#F1F7F7]'}
    >
      <div className={standalonePage ? '' : 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'}>
        {standalonePage && onNavigate && (
          <button
            type="button"
            onClick={() => onNavigate('/')}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-[#71808D] hover:text-[#12304A] mb-4 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Home</span>
          </button>
        )}

        <div className="max-w-2xl mb-10">
          <p className="text-sm font-semibold text-[#19A7A1]">Visit &amp; Enquiries</p>
          <h2 className="font-display text-3xl sm:text-4xl text-[#12304A] mt-1">
            Contact Raghan Dental and Implant Care
          </h2>
          <p className="text-sm sm:text-base text-[#71808D] mt-2">
            Conveniently situated in Subramanyanagar, Bengaluru. Call, message on WhatsApp, or send an enquiry below.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
          {/* Left Column: Address, Map, Quick Actions, Hours */}
          <div className="lg:col-span-6 space-y-6 flex flex-col">
            <div className="bg-white border border-[#12304A]/12 rounded-2xl p-6 space-y-5">
              <div className="flex items-start gap-3">
                <MapPin className="w-5 h-5 text-[#19A7A1] shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-display text-xl text-[#12304A]">{settings.clinicName}</h3>
                  <p className="text-sm text-[#263746] mt-1 leading-relaxed">{settings.address}</p>
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <a
                  href={`tel:${settings.phone.replace(/\s+/g, '')}`}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#12304A] hover:bg-[#19A7A1] text-white text-sm font-semibold transition-colors tabular-nums"
                >
                  <Phone className="w-4 h-4" />
                  <span>Call {settings.phone}</span>
                </a>
                <a
                  href={waUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-[#19A7A1] text-[#12304A] hover:bg-[#F1F7F7] text-sm font-semibold transition-colors"
                >
                  <MessageCircle className="w-4 h-4 text-[#19A7A1]" />
                  <span>WhatsApp</span>
                </a>
                <a
                  href={settings.googleMapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-[#12304A]/20 text-[#12304A] hover:bg-[#F1F7F7] text-sm font-semibold transition-colors"
                >
                  <Navigation className="w-4 h-4 text-[#C6A66B]" />
                  <span>Get Directions</span>
                </a>
              </div>

              {/* Working Hours */}
              <div className="pt-4 border-t border-[#12304A]/10">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-semibold text-[#12304A] flex items-center gap-2">
                    <Clock className="w-4 h-4 text-[#19A7A1]" />
                    <span>Clinic Hours</span>
                  </span>
                  <span className="text-[11px] text-[#71808D]">Subject to holiday updates</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 text-xs">
                  {settings.weeklySchedule.map((d) => (
                    <div key={d.day} className="flex items-center justify-between py-1 border-b border-[#12304A]/5">
                      <span className="font-medium text-[#263746]">{d.label}</span>
                      <span className="text-[#71808D] tabular-nums">
                        {d.isOpen ? `${formatTime12h(d.openTime)} – ${formatTime12h(d.closeTime)}` : 'Closed'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Embedded Google Map */}
            <div className="bg-white border border-[#12304A]/12 rounded-2xl overflow-hidden flex-1 min-h-[260px]">
              <iframe
                title="Raghan Dental and Implant Care Location Map"
                src="https://maps.google.com/maps?q=Raghan+Dental+and+Implant+Care+Subramanyanagar+Bengaluru+560010&t=&z=16&ie=UTF8&iwloc=&output=embed"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                className="w-full h-full min-h-[260px] border-0"
              />
            </div>
          </div>

          {/* Right Column: Contact Enquiry Form */}
          <div className="lg:col-span-6 bg-white border border-[#12304A]/12 rounded-2xl p-6 sm:p-8 flex flex-col justify-between">
            <div>
              <h3 className="font-display text-2xl text-[#12304A]">Send a Clinic Enquiry</h3>
              <p className="text-sm text-[#71808D] mt-1 mb-6">
                Have a question before booking? Leave your contact details and clinic staff will get back to you.
              </p>

              {sent ? (
                <div className="p-6 rounded-xl bg-[#F1F7F7] border border-[#19A7A1]/30 space-y-3">
                  <div className="flex items-center gap-2.5 text-[#12304A] font-semibold">
                    <CheckCircle2 className="w-5 h-5 text-[#19A7A1]" />
                    <span>Enquiry Received</span>
                  </div>
                  <p className="text-sm text-[#263746]">
                    Thank you for reaching out to Raghan Dental and Implant Care. Our team will respond shortly, or you can call {settings.phone} for immediate assistance.
                  </p>
                  <button
                    type="button"
                    onClick={() => setSent(false)}
                    className="text-xs font-semibold text-[#19A7A1] hover:underline cursor-pointer"
                  >
                    Send another enquiry
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <input
                    type="text"
                    tabIndex={-1}
                    autoComplete="off"
                    value={websiteUrl}
                    onChange={(e) => setWebsiteUrl(e.target.value)}
                    className="hidden"
                    aria-hidden="true"
                  />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-[#263746] mb-1.5">
                        Full Name <span className="text-red-600">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Your name"
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
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="+91 98XXX XXXXX"
                        className="w-full px-3.5 py-2.5 rounded-lg border border-[#12304A]/20 text-sm tabular-nums focus:outline-none focus:border-[#19A7A1]"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-[#263746] mb-1.5">
                        Email <span className="text-[#71808D] font-normal">(Optional)</span>
                      </label>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="name@example.com"
                        className="w-full px-3.5 py-2.5 rounded-lg border border-[#12304A]/20 text-sm focus:outline-none focus:border-[#19A7A1]"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-[#263746] mb-1.5">Subject</label>
                      <input
                        type="text"
                        value={subject}
                        onChange={(e) => setSubject(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-lg border border-[#12304A]/20 text-sm focus:outline-none focus:border-[#19A7A1]"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[#263746] mb-1.5">
                      Message <span className="text-red-600">*</span>
                    </label>
                    <textarea
                      rows={4}
                      required
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder="How can we help you?"
                      className="w-full px-3.5 py-2.5 rounded-lg border border-[#12304A]/20 text-sm focus:outline-none focus:border-[#19A7A1]"
                    />
                  </div>
                  {error && (
                    <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3.5 py-2">
                      {error}
                    </p>
                  )}
                  <button
                    type="submit"
                    disabled={sending}
                    className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg bg-[#12304A] hover:bg-[#19A7A1] text-white text-sm font-semibold transition-colors cursor-pointer disabled:opacity-60"
                  >
                    <Send className="w-4 h-4" />
                    <span>{sending ? 'Sending...' : 'Send Enquiry'}</span>
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
