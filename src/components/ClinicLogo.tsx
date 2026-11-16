interface ClinicLogoProps {
  logoUrl?: string;
  clinicName: string;
  size?: 'sm' | 'md';
}

export function ClinicLogo({ logoUrl, clinicName, size = 'md' }: ClinicLogoProps) {
  const iconDim = size === 'sm' ? 'w-8 h-8' : 'w-9 h-9';
  if (logoUrl) {
    return (
      <img
        src={logoUrl}
        alt={clinicName}
        referrerPolicy="no-referrer"
        className={`${iconDim} object-contain rounded-lg shrink-0`}
      />
    );
  }

  return (
    <svg
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={`${iconDim} shrink-0`}
    >
      <rect x="1" y="1" width="38" height="38" rx="10" fill="#12304A" />
      <path
        d="M13.5 13C13.5 10.6 15.6 9 18 9.6C19.3 9.9 20.7 9.9 22 9.6C24.4 9 26.5 10.6 26.5 13C26.5 16.4 25.1 18.8 24.4 22.8C23.9 25.6 23.3 29.5 21.6 29.5C20.5 29.5 20.4 25.2 20 25.2C19.6 25.2 19.5 29.5 18.4 29.5C16.7 29.5 16.1 25.6 15.6 22.8C14.9 18.8 13.5 16.4 13.5 13Z"
        stroke="#FAFCFC"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M15.5 15.5C17.2 17.1 22.8 17.1 24.5 15.5"
        stroke="#19A7A1"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
      <circle cx="29.5" cy="10.5" r="2" fill="#C6A66B" />
    </svg>
  );
}
