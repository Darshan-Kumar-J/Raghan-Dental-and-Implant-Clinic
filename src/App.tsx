import { useState, useEffect, useCallback } from 'react';
import {
  Calendar,
  ArrowRight,
  ChevronRight,
  MapPin,
  MessageCircle,
  ExternalLink,
  Check,
  Shield,
  ArrowLeft,
} from 'lucide-react';
import { Header } from './components/Header.tsx';
import { Footer } from './components/Footer.tsx';
import { BookingWizard } from './components/BookingWizard.tsx';
import { TreatmentDetailView } from './components/TreatmentDetailView.tsx';
import { GallerySection } from './components/GallerySection.tsx';
import { FaqSection } from './components/FaqSection.tsx';
import { ContactSection } from './components/ContactSection.tsx';
import { AdminDashboard } from './components/AdminDashboard.tsx';
import { buildWhatsAppUrl } from './lib/clinicUtils.ts';
import type { PublicBootstrapData } from './types/clinic.ts';

function getRouteInfo(fullPath: string) {
  const [pathnameRaw, searchRaw = ''] = fullPath.split('?');
  const [pathname, hash = ''] = pathnameRaw.split('#');
  const cleanPath = pathname === '' ? '/' : pathname.replace(/\/+$/, '') || '/';
  const params = new URLSearchParams(searchRaw);
  return { pathname: cleanPath, hash, params };
}

export default function App() {
  const [data, setData] = useState<PublicBootstrapData | null>(null);
  const [loadError, setLoadError] = useState('');
  const [currentUrl, setCurrentUrl] = useState<string>(
    () => window.location.pathname + window.location.search + window.location.hash,
  );

  const loadBootstrap = useCallback(async () => {
    try {
      const resp = await fetch('/api/bootstrap');
      if (!resp.ok) throw new Error('Unable to load clinic information.');
      const json = (await resp.json()) as PublicBootstrapData;
      setData(json);
      setLoadError('');
    } catch {
      setLoadError('Unable to connect to Raghan Dental and Implant Care server. Please refresh.');
    }
  }, []);

  useEffect(() => {
    loadBootstrap();
  }, [loadBootstrap]);

  useEffect(() => {
    const onPopState = () => {
      setCurrentUrl(window.location.pathname + window.location.search + window.location.hash);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const navigate = useCallback((target: string) => {
    const [pathAndSearch, hash] = target.split('#');
    const nextPath = pathAndSearch || '/';
    const finalUrl = hash ? `${nextPath}#${hash}` : nextPath;

    window.history.pushState({}, '', finalUrl);
    setCurrentUrl(finalUrl);

    if (hash) {
      setTimeout(() => {
        const el = document.getElementById(hash);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth' });
        }
      }, 60);
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, []);

  const { pathname, params } = getRouteInfo(currentUrl);

  // Dynamic SEO page title & meta description
  useEffect(() => {
    if (!data) return;
    let title = `${data.settings.clinicName} | Subramanyanagar, Bengaluru`;
    let desc =
      'Raghan Dental and Implant Care in Subramanyanagar, Bengaluru. Periodontics, dental implant consultations, and patient-focused dental care with Dr. Deepthi K.';

    if (pathname === '/book') {
      title = `Book Appointment | ${data.settings.clinicName}`;
      desc = 'Book your dental consultation online at Raghan Dental and Implant Care, Subramanyanagar, Bengaluru.';
    } else if (pathname === '/treatments') {
      title = `Dental Treatments | ${data.settings.clinicName}`;
    } else if (pathname.startsWith('/treatments/')) {
      const slug = pathname.replace('/treatments/', '');
      const tr = data.treatments.find((t) => t.slug === slug);
      if (tr) {
        title = `${tr.title} | ${data.settings.clinicName}`;
        desc = tr.shortDescription;
      }
    } else if (pathname === '/gallery') {
      title = `Clinic Gallery | ${data.settings.clinicName}`;
    } else if (pathname === '/contact') {
      title = `Contact & Directions | ${data.settings.clinicName}`;
    } else if (pathname === '/admin') {
      title = `Clinic Staff Admin | ${data.settings.clinicName}`;
    }

    document.title = title;
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) metaDesc.setAttribute('content', desc);
  }, [pathname, data]);

  if (loadError) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-[#FAFCFC]">
        <div className="max-w-md text-center space-y-4 bg-white p-8 rounded-2xl border border-[#12304A]/15">
          <h1 className="font-display text-2xl text-[#12304A]">Raghan Dental and Implant Care</h1>
          <p className="text-sm text-[#71808D]">{loadError}</p>
          <button
            type="button"
            onClick={loadBootstrap}
            className="px-5 py-2.5 rounded-lg bg-[#12304A] text-white text-sm font-semibold cursor-pointer"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-[#FAFCFC] flex items-center justify-center">
        <div className="text-sm text-[#71808D]">Loading Raghan Dental and Implant Care...</div>
      </div>
    );
  }

  const { settings, doctors, treatments, gallery, testimonials, faqs, integrations } = data;
  const isAdminRoute = pathname === '/admin';

  const waFloatingUrl = buildWhatsAppUrl(
    settings.whatsappNumber,
    'Hello Raghan Dental and Implant Care, I would like to enquire about booking a dental appointment.',
  );

  // Determine active route view
  let pageContent: React.ReactNode = null;

  if (isAdminRoute) {
    pageContent = <AdminDashboard onNavigate={navigate} onDataUpdated={loadBootstrap} />;
  } else if (pathname === '/book') {
    pageContent = (
      <BookingWizard
        settings={settings}
        treatments={treatments}
        doctors={doctors}
        integrations={integrations}
        initialTreatmentSlug={params.get('treatment') || undefined}
        initialDoctorId={params.get('doctor') ? Number(params.get('doctor')) : undefined}
        onNavigate={navigate}
      />
    );
  } else if (pathname === '/treatments') {
    pageContent = <TreatmentDetailView allTreatments={treatments} onNavigate={navigate} />;
  } else if (pathname.startsWith('/treatments/')) {
    const slug = pathname.replace('/treatments/', '');
    const matchedTreatment = treatments.find((t) => t.slug === slug);
    pageContent = (
      <TreatmentDetailView
        treatment={matchedTreatment}
        allTreatments={treatments}
        onNavigate={navigate}
      />
    );
  } else if (pathname === '/gallery') {
    pageContent = <GallerySection items={gallery} standalonePage onNavigate={navigate} />;
  } else if (pathname === '/contact') {
    pageContent = <ContactSection settings={settings} standalonePage onNavigate={navigate} />;
  } else if (pathname === '/privacy-policy' || pathname === '/terms-and-conditions') {
    const isPrivacy = pathname === '/privacy-policy';
    pageContent = (
      <section className="max-w-3xl mx-auto px-4 sm:px-6 py-14 space-y-6">
        <button
          type="button"
          onClick={() => navigate('/')}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-[#71808D] hover:text-[#12304A] cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Home</span>
        </button>
        <h1 className="font-display text-3xl sm:text-4xl text-[#12304A]">
          {isPrivacy ? 'Privacy Policy' : 'Terms and Conditions'}
        </h1>
        <div className="bg-white border border-[#12304A]/12 rounded-2xl p-6 sm:p-8 text-sm text-[#263746] leading-relaxed space-y-4">
          <p>{isPrivacy ? settings.privacyPolicy : settings.termsAndConditions}</p>
          <p className="text-[#71808D]">
            For questions regarding your appointment or personal details, please contact {settings.clinicName} at{' '}
            {settings.phone} or visit {settings.address}.
          </p>
        </div>
      </section>
    );
  } else {
    // HOMEPAGE (/)
    const leadDoctor = doctors[0];
    pageContent = (
      <>
        {/* 1. HERO SECTION */}
        <section className="bg-[#FAFCFC] pt-10 pb-14 lg:pt-16 lg:pb-20 border-b border-[#12304A]/10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-stretch">
              {/* Left Column: Headline, Subheadline, Primary + Secondary CTAs */}
              <div className="lg:col-span-6 flex flex-col justify-center space-y-6">
                <div className="text-xs sm:text-sm font-semibold text-[#19A7A1]">
                  Subramanyanagar, Bengaluru <span aria-hidden="true">·</span> Periodontics &amp; Implant Care
                </div>

                <h1 className="font-display text-4xl sm:text-5xl lg:text-[3.5rem] leading-[1.1] text-[#12304A]">
                  {settings.heroHeadline}
                </h1>

                <p className="text-base sm:text-lg text-[#263746] leading-relaxed max-w-xl">
                  {settings.heroSubheadline}
                </p>

                <div className="flex flex-wrap items-center gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => navigate('/book')}
                    className="inline-flex items-center gap-2 px-6 py-3.5 rounded-lg bg-[#12304A] hover:bg-[#19A7A1] text-white text-sm font-semibold transition-colors cursor-pointer"
                  >
                    <Calendar className="w-4 h-4 text-[#C6A66B]" />
                    <span>Book Your Appointment</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate('/#treatments')}
                    className="inline-flex items-center gap-2 px-6 py-3.5 rounded-lg border border-[#12304A]/20 text-[#12304A] hover:bg-[#F1F7F7] text-sm font-semibold transition-colors cursor-pointer"
                  >
                    <span>Explore Our Treatments</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>

                <div className="pt-2 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-[#71808D]">
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-[#19A7A1]" />
                    <span>2nd Stage, Subramanyanagar, Bengaluru</span>
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>Dr. Deepthi K, BDS, MDS – Periodontics</span>
                </div>
              </div>

              {/* Right Column: Hero Clinic Visual (Equal Height Stretch) */}
              <div className="lg:col-span-6">
                <div className="h-full min-h-[280px] sm:min-h-[380px] rounded-2xl overflow-hidden border border-[#12304A]/10 bg-[#F1F7F7]">
                  <img
                    src={settings.heroImageUrl}
                    alt="Modern dental treatment suite at Raghan Dental and Implant Care"
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>
            </div>

            {/* Verified Trust Information Strip (4-column row below Hero Split) */}
            <div className="mt-12 pt-8 border-t border-[#12304A]/10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                {
                  title: 'Experienced Dental Professional',
                  detail: 'Led by Dr. Deepthi K with ~13–14 years of clinical background (subject to clinic verification).',
                },
                {
                  title: 'Periodontics Specialization',
                  detail: 'Postgraduate MDS training focused on gum health, periodontal support, and implant readiness.',
                },
                {
                  title: 'Patient-Focused Consultations',
                  detail: 'Unhurried discussions, clear explanations, and transparent guidance before any procedure.',
                },
                {
                  title: 'Subramanyanagar Location',
                  detail: 'Accessible neighborhood clinic on 14th Main, 2nd Stage, Subramanyanagar, Bengaluru.',
                },
              ].map((item) => (
                <div key={item.title} className="space-y-1">
                  <h2 className="font-sans font-semibold text-sm text-[#12304A]">{item.title}</h2>
                  <p className="text-xs text-[#71808D] leading-relaxed">{item.detail}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 2. ABOUT THE CLINIC */}
        <section id="about" className="py-20 bg-[#F1F7F7]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-stretch">
              <div className="lg:col-span-5">
                <div className="h-full min-h-[280px] rounded-2xl overflow-hidden border border-[#12304A]/10 bg-white">
                  <img
                    src={settings.aboutImageUrl}
                    alt="Reception and patient lounge concept for Raghan Dental and Implant Care"
                    loading="lazy"
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>

              <div className="lg:col-span-7 flex flex-col justify-center space-y-5">
                <p className="text-sm font-semibold text-[#19A7A1]">About Our Practice</p>
                <h2 className="font-display text-3xl sm:text-4xl text-[#12304A]">
                  {settings.aboutHeading}
                </h2>
                <p className="text-base text-[#263746] leading-relaxed">{settings.aboutBody}</p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 text-sm text-[#263746]">
                  {[
                    'Personalized one-on-one consultations',
                    'Clear explanations before treatment',
                    'Focus on patient comfort and hygiene',
                    'Dedicated gum health and oral care',
                  ].map((point) => (
                    <div key={point} className="flex items-center gap-2.5">
                      <Check className="w-4 h-4 text-[#19A7A1] shrink-0" />
                      <span>{point}</span>
                    </div>
                  ))}
                </div>

                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => navigate('/book')}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#12304A] hover:bg-[#19A7A1] text-white text-sm font-semibold transition-colors cursor-pointer"
                  >
                    <span>Schedule a Consultation</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 3. OUR DENTIST / DOCTOR PROFILE */}
        {leadDoctor && (
          <section id="doctor" className="py-20 bg-[#FAFCFC]">
            <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="bg-white border border-[#12304A]/12 rounded-2xl p-6 sm:p-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
                <div className="lg:col-span-4">
                  {leadDoctor.photoUrl && leadDoctor.isPhotoVerified ? (
                    <div className="aspect-[3/4] rounded-xl overflow-hidden border border-[#12304A]/10 bg-[#F1F7F7]">
                      <img
                        src={leadDoctor.photoUrl}
                        alt={leadDoctor.name}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ) : (
                    <div className="aspect-[3/4] rounded-xl bg-[#12304A] text-white p-8 flex flex-col justify-between border border-[#12304A]/15">
                      <div className="text-xs font-medium text-[#C6A66B]">Lead Clinician</div>
                      <div className="my-auto text-center space-y-3">
                        <div className="w-24 h-24 mx-auto rounded-full border border-[#C6A66B]/60 flex items-center justify-center font-display text-4xl text-[#FAFCFC]">
                          DK
                        </div>
                        <div className="font-display text-2xl">{leadDoctor.name}</div>
                        <div className="text-xs text-[#19A7A1] font-semibold">
                          {leadDoctor.qualifications}
                        </div>
                      </div>
                      <div className="text-[11px] text-white/65 text-center">
                        Official portrait can be uploaded by clinic staff in Admin
                      </div>
                    </div>
                  )}
                </div>

                <div className="lg:col-span-8 space-y-5">
                  <div>
                    <p className="text-sm font-semibold text-[#19A7A1]">Our Dentist</p>
                    <h2 className="font-display text-3xl sm:text-4xl text-[#12304A] mt-1">
                      {leadDoctor.name}
                    </h2>
                    <p className="text-sm font-semibold text-[#C6A66B] mt-1">
                      {leadDoctor.qualifications}
                    </p>
                  </div>

                  <p className="text-base text-[#263746] leading-relaxed">{leadDoctor.bio}</p>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-3 border-t border-[#12304A]/10 text-sm">
                    <div>
                      <span className="block text-xs text-[#71808D]">Specialization</span>
                      <span className="font-semibold text-[#12304A]">{leadDoctor.specialization}</span>
                    </div>
                    <div>
                      <span className="block text-xs text-[#71808D]">Experience</span>
                      <span className="font-medium text-[#263746]">{leadDoctor.experienceNote}</span>
                    </div>
                    <div>
                      <span className="block text-xs text-[#71808D]">Languages</span>
                      <span className="font-medium text-[#263746]">{leadDoctor.languages}</span>
                    </div>
                  </div>

                  {doctors.length > 1 && (
                    <div className="pt-2 text-xs text-[#71808D]">
                      Additional clinicians available: {doctors.slice(1).map((d) => d.name).join(', ')}
                    </div>
                  )}

                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => navigate(`/book?doctor=${leadDoctor.id}`)}
                      className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-[#12304A] hover:bg-[#19A7A1] text-white text-sm font-semibold transition-colors cursor-pointer"
                    >
                      <Calendar className="w-4 h-4" />
                      <span>Book Consultation with {leadDoctor.name}</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* 4. DENTAL TREATMENTS SECTION */}
        <section id="treatments" className="py-20 bg-[#F1F7F7]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-10">
              <div className="max-w-2xl">
                <p className="text-sm font-semibold text-[#19A7A1]">Clinical Care Areas</p>
                <h2 className="font-display text-3xl sm:text-4xl text-[#12304A] mt-1">
                  Dental Treatments &amp; Consultations
                </h2>
                <p className="text-sm sm:text-base text-[#71808D] mt-2">
                  Explore our proposed consultation and treatment categories. Select any service to view detailed information or request an appointment.
                </p>
              </div>
              <button
                type="button"
                onClick={() => navigate('/treatments')}
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#12304A] hover:text-[#19A7A1] self-start cursor-pointer"
              >
                <span>View All Treatments</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {treatments.map((tr) => (
                <article
                  key={tr.id}
                  className="bg-white border border-[#12304A]/12 rounded-2xl overflow-hidden flex flex-col hover:border-[#19A7A1]/60 transition-colors"
                >
                  <div className="aspect-[4/3] bg-[#E8F0F0] overflow-hidden">
                    {tr.imageUrl && (
                      <img
                        src={tr.imageUrl}
                        alt={tr.title}
                        loading="lazy"
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                    )}
                  </div>
                  <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                    <div>
                      <div className="flex items-center gap-2 text-xs text-[#71808D] mb-1.5">
                        <span className="font-medium text-[#19A7A1]">{tr.category}</span>
                        <span aria-hidden="true">·</span>
                        <span className="tabular-nums">{tr.durationMinutes} min</span>
                      </div>
                      <h3 className="font-display text-lg text-[#12304A] leading-snug">{tr.title}</h3>
                      <p className="text-xs text-[#71808D] mt-2 leading-relaxed">{tr.shortDescription}</p>
                    </div>

                    <div className="pt-3 border-t border-[#12304A]/10 flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => navigate(`/treatments/${tr.slug}`)}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-[#12304A] hover:text-[#19A7A1] cursor-pointer"
                      >
                        <span>Details</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => navigate(`/book?treatment=${encodeURIComponent(tr.slug)}`)}
                        className="px-3.5 py-2 rounded-lg bg-[#12304A] hover:bg-[#19A7A1] text-white text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap"
                      >
                        Book Appointment
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* 5. PATIENT TESTIMONIALS (GENUINE FEEDBACK ONLY) */}
        <section className="py-20 bg-[#FAFCFC]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-10">
              <div>
                <p className="text-sm font-semibold text-[#19A7A1]">Patient Experiences</p>
                <h2 className="font-display text-3xl sm:text-4xl text-[#12304A] mt-1">
                  Verified Patient Feedback
                </h2>
              </div>
              {settings.googleReviewsUrl && (
                <a
                  href={settings.googleReviewsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#12304A] hover:text-[#19A7A1]"
                >
                  <span>View Clinic Profile on Google Maps</span>
                  <ExternalLink className="w-4 h-4" />
                </a>
              )}
            </div>

            {testimonials.length === 0 ? (
              <div className="bg-white border border-[#12304A]/12 rounded-2xl p-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="space-y-2 max-w-2xl">
                  <div className="inline-flex items-center gap-2 text-xs font-semibold text-[#19A7A1]">
                    <Shield className="w-4 h-4" />
                    <span>Genuine Feedback Policy</span>
                  </div>
                  <h3 className="font-display text-2xl text-[#12304A]">
                    Verified patient stories will appear here as approved by the clinic.
                  </h3>
                  <p className="text-sm text-[#71808D] leading-relaxed">
                    We publish only genuine, verified patient feedback without fabricated reviews or invented ratings. You can view public clinic information and reviews directly on Google Maps.
                  </p>
                </div>
                {settings.googleReviewsUrl && (
                  <a
                    href={settings.googleReviewsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-5 py-3 rounded-lg bg-[#12304A] hover:bg-[#19A7A1] text-white text-sm font-semibold transition-colors whitespace-nowrap shrink-0"
                  >
                    <span>Open Google Reviews</span>
                    <ExternalLink className="w-4 h-4" />
                  </a>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {testimonials.map((t) => (
                  <blockquote
                    key={t.id}
                    className="bg-white border border-[#12304A]/12 rounded-2xl p-6 flex flex-col justify-between space-y-4"
                  >
                    <p className="text-sm text-[#263746] leading-relaxed">&ldquo;{t.quote}&rdquo;</p>
                    <footer className="pt-3 border-t border-[#12304A]/10 text-xs">
                      <div className="font-semibold text-[#12304A]">{t.patientName}</div>
                      <div className="text-[#71808D] mt-0.5">
                        {t.treatmentName || t.source}
                        {t.visitDate ? ` · ${t.visitDate}` : ''}
                      </div>
                    </footer>
                  </blockquote>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* 6. GALLERY */}
        <GallerySection items={gallery} />

        {/* 7. FAQ SECTION */}
        <FaqSection faqs={faqs} />

        {/* 8. CONTACT & LOCATION */}
        <ContactSection settings={settings} />
      </>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#FAFCFC] text-[#263746]">
      {!isAdminRoute && (
        <Header settings={settings} currentPath={pathname} onNavigate={navigate} />
      )}

      <main className="flex-1">{pageContent}</main>

      {!isAdminRoute && (
        <>
          <Footer settings={settings} treatments={treatments} onNavigate={navigate} />

          {/* Floating WhatsApp Button (Desktop/Tablet — Mobile has bottom action bar) */}
          <a
            href={waFloatingUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Chat with Raghan Dental and Implant Care on WhatsApp"
            className="hidden md:inline-flex fixed bottom-6 right-6 z-40 items-center gap-2.5 px-4 py-3 rounded-full bg-[#19A7A1] hover:bg-[#12304A] text-white text-sm font-semibold shadow-lg transition-colors"
          >
            <MessageCircle className="w-5 h-5" />
            <span>WhatsApp Clinic</span>
          </a>
        </>
      )}
    </div>
  );
}
