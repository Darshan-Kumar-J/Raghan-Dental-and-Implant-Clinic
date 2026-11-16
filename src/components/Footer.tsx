import { Phone, MapPin, MessageCircle, ArrowRight } from 'lucide-react';
import { ClinicLogo } from './ClinicLogo.tsx';
import { buildWhatsAppUrl } from '../lib/clinicUtils.ts';
import type { ClinicSettings, Treatment } from '../types/clinic.ts';

interface FooterProps {
  settings: ClinicSettings;
  treatments: Treatment[];
  onNavigate: (path: string) => void;
}

export function Footer({ settings, treatments, onNavigate }: FooterProps) {
  const waUrl = buildWhatsAppUrl(
    settings.whatsappNumber,
    'Hello Raghan Dental and Implant Care, I would like to enquire about booking a dental appointment.',
  );

  return (
    <footer className="bg-[#12304A] text-white pt-16 pb-20 md:pb-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10 pb-12 border-b border-white/15">
          {/* Column 1: Clinic Identity */}
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <ClinicLogo logoUrl={settings.logoUrl} clinicName={settings.clinicName} size="sm" />
              <span className="font-display text-xl text-white">{settings.clinicName}</span>
            </div>
            <p className="text-sm text-white/75 leading-relaxed">
              Patient-focused dental care and periodontics practice in Subramanyanagar, Bengaluru, led by Dr. Deepthi K (BDS, MDS – Periodontics).
            </p>
            <button
              type="button"
              onClick={() => onNavigate('/book')}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#19A7A1] hover:bg-[#15938D] text-white text-sm font-semibold transition-colors cursor-pointer"
            >
              <span>Book Appointment</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          {/* Column 2: Navigation */}
          <div>
            <h3 className="font-sans text-sm font-semibold text-[#C6A66B] mb-4">Clinic Navigation</h3>
            <ul className="space-y-2.5 text-sm text-white/80">
              {[
                { label: 'Home', path: '/' },
                { label: 'About Clinic', path: '/#about' },
                { label: 'Our Dentist', path: '/#doctor' },
                { label: 'Clinic Gallery', path: '/gallery' },
                { label: 'FAQs', path: '/#faqs' },
                { label: 'Contact & Directions', path: '/contact' },
                { label: 'Book Appointment', path: '/book' },
              ].map((link) => (
                <li key={link.path}>
                  <a
                    href={link.path}
                    onClick={(e) => {
                      e.preventDefault();
                      onNavigate(link.path);
                    }}
                    className="hover:text-white transition-colors"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Column 3: Treatments */}
          <div>
            <h3 className="font-sans text-sm font-semibold text-[#C6A66B] mb-4">Dental Care Areas</h3>
            <ul className="space-y-2.5 text-sm text-white/80">
              {treatments.slice(0, 8).map((tr) => (
                <li key={tr.id}>
                  <a
                    href={`/treatments/${tr.slug}`}
                    onClick={(e) => {
                      e.preventDefault();
                      onNavigate(`/treatments/${tr.slug}`);
                    }}
                    className="hover:text-white transition-colors"
                  >
                    {tr.title}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Column 4: Contact & Location */}
          <div className="space-y-4">
            <h3 className="font-sans text-sm font-semibold text-[#C6A66B]">Visit &amp; Contact</h3>
            <div className="space-y-3 text-sm text-white/80">
              <div className="flex items-start gap-2.5">
                <MapPin className="w-4 h-4 text-[#19A7A1] shrink-0 mt-1" />
                <span>{settings.address}</span>
              </div>
              <div className="flex items-center gap-2.5">
                <Phone className="w-4 h-4 text-[#19A7A1] shrink-0" />
                <a
                  href={`tel:${settings.phone.replace(/\s+/g, '')}`}
                  className="hover:text-white tabular-nums"
                >
                  {settings.phone}
                </a>
              </div>
              <div className="flex flex-wrap gap-3 pt-1">
                <a
                  href={settings.googleMapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-semibold text-[#C6A66B] hover:text-white underline underline-offset-4"
                >
                  Open in Google Maps
                </a>
                <a
                  href={waUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs font-semibold text-[#19A7A1] hover:text-white"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  <span>WhatsApp Us</span>
                </a>
              </div>
            </div>
          </div>
        </div>

        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-white/65">
          <p>© 2026 {settings.clinicName}. All Rights Reserved.</p>
          <div className="flex items-center gap-5">
            <a
              href="/privacy-policy"
              onClick={(e) => {
                e.preventDefault();
                onNavigate('/privacy-policy');
              }}
              className="hover:text-white transition-colors"
            >
              Privacy Policy
            </a>
            <a
              href="/terms-and-conditions"
              onClick={(e) => {
                e.preventDefault();
                onNavigate('/terms-and-conditions');
              }}
              className="hover:text-white transition-colors"
            >
              Terms &amp; Conditions
            </a>
            <a
              href="/admin"
              onClick={(e) => {
                e.preventDefault();
                onNavigate('/admin');
              }}
              className="hover:text-white transition-colors"
            >
              Clinic Admin
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
