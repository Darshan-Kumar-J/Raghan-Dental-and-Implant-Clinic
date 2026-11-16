import { ArrowLeft, Calendar, Clock, ChevronRight, Info } from 'lucide-react';
import type { Treatment } from '../types/clinic.ts';

interface TreatmentDetailViewProps {
  treatment?: Treatment;
  allTreatments: Treatment[];
  onNavigate: (path: string) => void;
}

export function TreatmentDetailView({
  treatment,
  allTreatments,
  onNavigate,
}: TreatmentDetailViewProps) {
  if (!treatment) {
    // Render full Treatments Catalog page (/treatments)
    return (
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        <button
          type="button"
          onClick={() => onNavigate('/')}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-[#71808D] hover:text-[#12304A] mb-4 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Home</span>
        </button>

        <div className="max-w-3xl mb-10">
          <h1 className="font-display text-3xl sm:text-5xl text-[#12304A]">
            Dental Treatments &amp; Consultations
          </h1>
          <p className="text-base text-[#71808D] mt-3 leading-relaxed">
            Explore our proposed dental care categories at Raghan Dental and Implant Care, Subramanyanagar, Bengaluru. Select any service below to read what it involves or book a consultation.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {allTreatments.map((tr) => (
            <article
              key={tr.id}
              className="bg-white border border-[#12304A]/12 rounded-2xl overflow-hidden flex flex-col hover:border-[#19A7A1]/60 transition-colors"
            >
              <div className="aspect-[4/3] bg-[#F1F7F7] overflow-hidden">
                {tr.imageUrl ? (
                  <img
                    src={tr.imageUrl}
                    alt={tr.title}
                    loading="lazy"
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-sm text-[#71808D]">
                    {tr.category}
                  </div>
                )}
              </div>
              <div className="p-6 flex-1 flex flex-col justify-between space-y-4">
                <div>
                  <div className="flex items-center gap-2 text-xs text-[#71808D] mb-2">
                    <span className="font-medium text-[#19A7A1]">{tr.category}</span>
                    <span aria-hidden="true">·</span>
                    <span className="tabular-nums">{tr.durationMinutes} min</span>
                  </div>
                  <h2 className="font-display text-xl text-[#12304A]">{tr.title}</h2>
                  <p className="text-sm text-[#71808D] mt-2 leading-relaxed">{tr.shortDescription}</p>
                </div>

                <div className="pt-3 border-t border-[#12304A]/10 flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => onNavigate(`/treatments/${tr.slug}`)}
                    className="inline-flex items-center gap-1 text-sm font-semibold text-[#12304A] hover:text-[#19A7A1] cursor-pointer"
                  >
                    <span>Read Details</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onNavigate(`/book?treatment=${encodeURIComponent(tr.slug)}`)}
                    className="px-4 py-2 rounded-lg bg-[#12304A] hover:bg-[#19A7A1] text-white text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap"
                  >
                    Book Appointment
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>
    );
  }

  return (
    <article className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-10">
      <div>
        <button
          type="button"
          onClick={() => onNavigate('/treatments')}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-[#71808D] hover:text-[#12304A] mb-4 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>All Dental Treatments</span>
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
          <div className="lg:col-span-7 flex flex-col justify-center space-y-4">
            <div className="flex items-center gap-2 text-xs text-[#71808D]">
              <span className="font-semibold text-[#19A7A1]">{treatment.category}</span>
              <span aria-hidden="true">·</span>
              <span className="inline-flex items-center gap-1 tabular-nums">
                <Clock className="w-3.5 h-3.5" />
                {treatment.durationMinutes} minutes
              </span>
              <span aria-hidden="true">·</span>
              <span>
                {treatment.isConfirmedAvailable ? 'Available at Clinic' : 'Enquiry / Consultation Category'}
              </span>
            </div>

            <h1 className="font-display text-3xl sm:text-5xl text-[#12304A]">{treatment.title}</h1>
            <p className="text-base text-[#263746] leading-relaxed">{treatment.introduction}</p>

            {!treatment.isConfirmedAvailable && (
              <div className="p-3.5 rounded-xl bg-[#F1F7F7] border border-[#12304A]/12 text-xs text-[#263746] flex items-start gap-2.5">
                <Info className="w-4 h-4 text-[#19A7A1] shrink-0 mt-0.5" />
                <span>
                  Proposed clinic consultation category. Final treatment suitability and availability are confirmed by Dr. Deepthi K and clinic staff upon booking and examination.
                </span>
              </div>
            )}

            <div className="pt-2">
              <button
                type="button"
                onClick={() => onNavigate(`/book?treatment=${encodeURIComponent(treatment.slug)}`)}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-[#12304A] hover:bg-[#19A7A1] text-white text-sm font-semibold transition-colors cursor-pointer"
              >
                <Calendar className="w-4 h-4" />
                <span>Book Appointment for {treatment.title}</span>
              </button>
            </div>
          </div>

          <div className="lg:col-span-5">
            <div className="h-full min-h-[260px] rounded-2xl overflow-hidden bg-[#F1F7F7] border border-[#12304A]/10">
              {treatment.imageUrl ? (
                <img
                  src={treatment.imageUrl}
                  alt={treatment.title}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {/* Structured Educational Sections */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4 border-t border-[#12304A]/10">
        <div className="bg-white border border-[#12304A]/12 rounded-xl p-6 space-y-2">
          <h2 className="font-display text-xl text-[#12304A]">What It Involves</h2>
          <p className="text-sm text-[#263746] leading-relaxed">{treatment.whatItInvolves}</p>
        </div>
        <div className="bg-white border border-[#12304A]/12 rounded-xl p-6 space-y-2">
          <h2 className="font-display text-xl text-[#12304A]">When You Might Need It</h2>
          <p className="text-sm text-[#263746] leading-relaxed">{treatment.whenNeeded}</p>
        </div>
        <div className="bg-white border border-[#12304A]/12 rounded-xl p-6 space-y-2">
          <h2 className="font-display text-xl text-[#12304A]">General Procedure Overview</h2>
          <p className="text-sm text-[#263746] leading-relaxed">{treatment.procedureOverview}</p>
        </div>
      </div>

      {/* Treatment FAQs */}
      {treatment.faqs && treatment.faqs.length > 0 && (
        <div className="bg-[#F1F7F7] rounded-2xl p-6 sm:p-8 space-y-5">
          <h2 className="font-display text-2xl text-[#12304A]">
            Common Questions About {treatment.title}
          </h2>
          <div className="space-y-4">
            {treatment.faqs.map((faq, idx) => (
              <div key={idx} className="bg-white border border-[#12304A]/10 rounded-xl p-5">
                <h3 className="font-sans font-semibold text-base text-[#12304A]">{faq.question}</h3>
                <p className="text-sm text-[#263746] mt-2 leading-relaxed">{faq.answer}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Ethical Medical Notice & Bottom CTA */}
      <div className="bg-[#12304A] text-white rounded-2xl p-6 sm:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="space-y-2 max-w-2xl">
          <h2 className="font-display text-2xl">Schedule an In-Clinic Assessment</h2>
          <p className="text-sm text-white/80 leading-relaxed">
            Every patient&apos;s oral health is unique. Clinical decisions and treatment recommendations are made after a personal examination.
          </p>
        </div>
        <button
          type="button"
          onClick={() => onNavigate(`/book?treatment=${encodeURIComponent(treatment.slug)}`)}
          className="px-6 py-3 rounded-lg bg-[#19A7A1] hover:bg-[#15938D] text-white text-sm font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          Book Consultation
        </button>
      </div>
    </article>
  );
}
