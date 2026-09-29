import React from 'react';

// Common base types
export interface AvatarProps extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
}

// 1. Law Student Male
export const LawStudentMale: React.FC<AvatarProps> = ({ size = '100%', ...props }) => (
  <svg viewBox="0 0 100 100" width={size} height={size} {...props}>
    <defs>
      <linearGradient id="bg-student-male" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#6366f1" />
        <stop offset="100%" stopColor="#4f46e5" />
      </linearGradient>
    </defs>
    <rect width="100" height="100" rx="20" fill="url(#bg-student-male)" />
    {/* Body / Collar Shirt */}
    <path d="M25,90 C25,75 35,68 50,68 C65,68 75,75 75,90 Z" fill="#e0e7ff" />
    <path d="M42,68 L50,80 L58,68 Z" fill="#ffffff" />
    <path d="M50,80 L46,90 L54,90 Z" fill="#4f46e5" /> {/* Tie */}
    {/* Face */}
    <circle cx="50" cy="45" r="18" fill="#fbcfe8" />
    <circle cx="50" cy="45" r="18" fill="#fed7aa" /> {/* Skin Tone */}
    {/* Hair */}
    <path d="M32,45 C30,30 45,23 55,25 C68,27 68,36 68,45 C68,45 62,38 50,38 C38,38 32,45 32,45 Z" fill="#1e1b4b" />
    {/* Eyes */}
    <circle cx="44" cy="44" r="2" fill="#1e1b4b" />
    <circle cx="56" cy="44" r="2" fill="#1e1b4b" />
    {/* Glasses */}
    <circle cx="44" cy="44" r="6" stroke="#fbbf24" strokeWidth="1.5" fill="none" />
    <circle cx="56" cy="44" r="6" stroke="#fbbf24" strokeWidth="1.5" fill="none" />
    <line x1="50" y1="44" x2="52" y2="44" stroke="#fbbf24" strokeWidth="1.5" />
    {/* Smile */}
    <path d="M46,52 Q50,56 54,52" stroke="#1e1b4b" strokeWidth="1.5" strokeLinecap="round" fill="none" />
    {/* Academic Cap */}
    <polygon points="50,14 74,22 50,30 26,22" fill="#1e1b4b" />
    <rect x="47" y="24" width="6" height="5" fill="#1e1b4b" />
    <path d="M70,23 L74,36" stroke="#fbbf24" strokeWidth="1.5" fill="none" />
    {/* Small Book Icon */}
    <rect x="70" y="70" width="18" height="22" rx="2" fill="#fbbf24" />
    <line x1="74" y1="74" x2="84" y2="74" stroke="#1e1b4b" strokeWidth="1.5" />
    <line x1="74" y1="80" x2="84" y2="80" stroke="#1e1b4b" strokeWidth="1.5" />
    <line x1="74" y1="86" x2="80" y2="86" stroke="#1e1b4b" strokeWidth="1.5" />
  </svg>
);

// 2. Law Student Female
export const LawStudentFemale: React.FC<AvatarProps> = ({ size = '100%', ...props }) => (
  <svg viewBox="0 0 100 100" width={size} height={size} {...props}>
    <defs>
      <linearGradient id="bg-student-female" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#ec4899" />
        <stop offset="100%" stopColor="#db2777" />
      </linearGradient>
    </defs>
    <rect width="100" height="100" rx="20" fill="url(#bg-student-female)" />
    {/* Hair Back */}
    <path d="M30,42 C20,55 20,80 32,85 C32,85 50,82 68,85 C80,80 80,55 70,42 Z" fill="#312e81" />
    {/* Body / Collar Shirt */}
    <path d="M25,90 C25,75 35,68 50,68 C65,68 75,75 75,90 Z" fill="#fef2f2" />
    <path d="M42,68 L50,78 L58,68 Z" fill="#f43f5e" />
    {/* Face */}
    <circle cx="50" cy="44" r="17" fill="#ffedd5" />
    {/* Hair Front */}
    <path d="M33,40 C33,28 45,22 50,25 C55,22 67,28 67,40 C67,46 64,36 50,36 C36,36 33,46 33,40 Z" fill="#312e81" />
    {/* Eyes */}
    <circle cx="44" cy="43" r="2" fill="#312e81" />
    <circle cx="56" cy="43" r="2" fill="#312e81" />
    <path d="M41,40 Q44,38 46,40" stroke="#312e81" strokeWidth="1.2" fill="none" />
    <path d="M54,40 Q56,38 59,40" stroke="#312e81" strokeWidth="1.2" fill="none" />
    {/* Smile */}
    <path d="M46,51 Q50,55 54,51" stroke="#312e81" strokeWidth="1.5" strokeLinecap="round" fill="none" />
    {/* Academic Cap */}
    <polygon points="50,14 72,21 50,28 28,21" fill="#312e81" />
    <rect x="47" y="22" width="6" height="5" fill="#312e81" />
    <path d="M68,22 L71,33" stroke="#f43f5e" strokeWidth="1.5" fill="none" />
    {/* Mini Binder Icon */}
    <path d="M72,70 L86,74 L84,92 L70,88 Z" fill="#fbbf24" />
    <circle cx="78" cy="81" r="2" fill="#312e81" />
  </svg>
);

// 3. Constitutional Law Student
export const ConstLawStudent: React.FC<AvatarProps> = ({ size = '100%', ...props }) => (
  <svg viewBox="0 0 100 100" width={size} height={size} {...props}>
    <defs>
      <linearGradient id="bg-const-student" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#06b6d4" />
        <stop offset="100%" stopColor="#0891b2" />
      </linearGradient>
    </defs>
    <rect width="100" height="100" rx="20" fill="url(#bg-const-student)" />
    {/* Body */}
    <path d="M22,90 C22,74 34,68 50,68 C66,68 78,74 78,90 Z" fill="#e0f2fe" />
    <path d="M40,68 L50,78 L60,68 Z" fill="#0284c7" />
    {/* Face */}
    <circle cx="50" cy="45" r="17" fill="#fed7aa" />
    {/* Hair */}
    <path d="M33,43 C33,30 45,20 50,22 C55,20 67,30 67,43 Z" fill="#451a03" />
    {/* Glasses */}
    <rect x="38" y="40" width="10" height="8" rx="2" stroke="#451a03" strokeWidth="1.5" fill="none" />
    <rect x="52" y="40" width="10" height="8" rx="2" stroke="#451a03" strokeWidth="1.5" fill="none" />
    <line x1="48" y1="44" x2="52" y2="44" stroke="#451a03" strokeWidth="1.5" />
    {/* Eyes */}
    <circle cx="43" cy="44" r="1.5" fill="#451a03" />
    <circle cx="57" cy="44" r="1.5" fill="#451a03" />
    {/* Smile */}
    <path d="M47,53 Q50,56 53,53" stroke="#451a03" strokeWidth="1.5" strokeLinecap="round" fill="none" />
    {/* Constitution Book (Large Center/Front) */}
    <rect x="28" y="74" width="44" height="22" rx="3" fill="#1e293b" stroke="#fbbf24" strokeWidth="1" />
    <rect x="30" y="76" width="40" height="4" fill="#fbbf24" />
    <text x="50" y="79.5" fill="#1e293b" fontSize="3" fontWeight="900" textAnchor="middle">CONST.</text>
    <path d="M50,85 L47,89 L53,89 Z" fill="#fbbf24" /> {/* Mini scales symbol */}
    <circle cx="50" cy="84" r="1" fill="#fbbf24" />
  </svg>
);

// 4. Moot Court Student
export const MootCourtStudent: React.FC<AvatarProps> = ({ size = '100%', ...props }) => (
  <svg viewBox="0 0 100 100" width={size} height={size} {...props}>
    <defs>
      <linearGradient id="bg-moot" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#a855f7" />
        <stop offset="100%" stopColor="#7e22ce" />
      </linearGradient>
    </defs>
    <rect width="100" height="100" rx="20" fill="url(#bg-moot)" />
    {/* Body */}
    <path d="M22,90 C22,76 34,70 50,70 C66,70 78,76 78,90 Z" fill="#1e1b4b" /> {/* Black Advocate Robe */}
    {/* White Advocate Bands */}
    <path d="M47,70 L53,70 L55,83 L45,83 Z" fill="#ffffff" />
    <line x1="50" y1="70" x2="50" y2="83" stroke="#e2e8f0" strokeWidth="1" />
    {/* Face */}
    <circle cx="50" cy="45" r="17" fill="#ffedd5" />
    {/* Hair */}
    <path d="M33,40 C30,28 42,22 50,26 C58,22 70,28 67,40 Q71,50 67,52 L65,42 Q50,40 35,42 L33,52 Q29,50 33,40 Z" fill="#27272a" />
    {/* Eyes */}
    <circle cx="43" cy="43" r="2" fill="#27272a" />
    <circle cx="57" cy="43" r="2" fill="#27272a" />
    {/* Smile */}
    <path d="M46,52 Q50,56 54,52" stroke="#27272a" strokeWidth="1.5" strokeLinecap="round" fill="none" />
    {/* Podium/Lectern Front overlay */}
    <path d="M15,86 L85,86 L80,100 L20,100 Z" fill="#78350f" />
    <rect x="25" y="88" width="50" height="4" fill="#fbbf24" rx="1" />
  </svg>
);

// 5. Junior Advocate
export const JuniorAdvocate: React.FC<AvatarProps> = ({ size = '100%', ...props }) => (
  <svg viewBox="0 0 100 100" width={size} height={size} {...props}>
    <defs>
      <linearGradient id="bg-junior" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#3b82f6" />
        <stop offset="100%" stopColor="#1d4ed8" />
      </linearGradient>
    </defs>
    <rect width="100" height="100" rx="20" fill="url(#bg-junior)" />
    {/* Body - Professional Coat */}
    <path d="M20,90 C20,72 32,66 50,66 C68,66 80,72 80,90 Z" fill="#18181b" />
    <path d="M40,66 L50,82 L60,66 Z" fill="#ffffff" /> {/* Collar shirt */}
    {/* Advocate Bands */}
    <polygon points="46,74 54,74 56,88 44,88" fill="#ffffff" />
    <line x1="50" y1="74" x2="50" y2="88" stroke="#cbd5e1" strokeWidth="1" />
    <path d="M38,66 L46,78 L46,90 L26,90 Z" fill="#09090b" /> {/* Coat Lapel Left */}
    <path d="M62,66 L54,78 L54,90 L74,90 Z" fill="#09090b" /> {/* Coat Lapel Right */}
    {/* Face */}
    <circle cx="50" cy="42" r="16" fill="#fed7aa" />
    {/* Hair */}
    <path d="M34,38 C34,25 45,18 50,21 C55,18 66,25 66,38 Z" fill="#0f172a" />
    {/* Eyes */}
    <circle cx="44" cy="40" r="1.8" fill="#0f172a" />
    <circle cx="56" cy="40" r="1.8" fill="#0f172a" />
    {/* Confident Smile */}
    <path d="M46,49 Q50,53 54,49" stroke="#0f172a" strokeWidth="1.6" strokeLinecap="round" fill="none" />
  </svg>
);

// 6. Senior Advocate
export const SeniorAdvocate: React.FC<AvatarProps> = ({ size = '100%', ...props }) => (
  <svg viewBox="0 0 100 100" width={size} height={size} {...props}>
    <defs>
      <linearGradient id="bg-senior" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#f59e0b" />
        <stop offset="100%" stopColor="#d97706" />
      </linearGradient>
    </defs>
    <rect width="100" height="100" rx="20" fill="url(#bg-senior)" />
    {/* Body - Senior Robes & Coat */}
    <path d="M18,90 C18,70 30,64 50,64 C70,64 82,70 82,90 Z" fill="#09090b" />
    <path d="M38,64 L50,82 L62,64 Z" fill="#ffffff" />
    {/* Senior Advocate Double Bands */}
    <polygon points="45,70 55,70 58,88 42,88" fill="#ffffff" />
    <line x1="50" y1="70" x2="50" y2="88" stroke="#cbd5e1" strokeWidth="1" />
    {/* Gown Gold borders / tassels (Senior Advocate Signifier) */}
    <path d="M28,68 L34,90" stroke="#d97706" strokeWidth="2.5" strokeLinecap="round" />
    <path d="M72,68 L66,90" stroke="#d97706" strokeWidth="2.5" strokeLinecap="round" />
    {/* Face */}
    <circle cx="50" cy="40" r="16" fill="#ffedd5" />
    {/* Hair - Grey/Silver mature */}
    <path d="M34,36 C32,20 45,14 50,18 C55,14 68,20 66,36 C70,42 66,48 66,48 L63,38 Q50,36 37,38 L34,48 C34,48 30,42 34,36 Z" fill="#cbd5e1" />
    {/* Eye wrinkles / Brows */}
    <path d="M40,32 Q44,30 46,32" stroke="#78350f" strokeWidth="1.2" fill="none" />
    <path d="M54,32 Q56,30 60,32" stroke="#78350f" strokeWidth="1.2" fill="none" />
    {/* Eyes */}
    <circle cx="44" cy="38" r="1.8" fill="#0f172a" />
    <circle cx="56" cy="38" r="1.8" fill="#0f172a" />
    {/* Smile */}
    <path d="M45,48 Q50,52 55,48" stroke="#0f172a" strokeWidth="1.8" strokeLinecap="round" fill="none" />
  </svg>
);

// 7. Corporate Lawyer
export const CorporateLawyer: React.FC<AvatarProps> = ({ size = '100%', ...props }) => (
  <svg viewBox="0 0 100 100" width={size} height={size} {...props}>
    <defs>
      <linearGradient id="bg-corporate" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#10b981" />
        <stop offset="100%" stopColor="#047857" />
      </linearGradient>
    </defs>
    <rect width="100" height="100" rx="20" fill="url(#bg-corporate)" />
    {/* Body - Corporate Suit */}
    <path d="M20,90 C20,72 32,66 50,66 C68,66 80,72 80,90 Z" fill="#1e293b" />
    <path d="M42,66 L50,78 L58,66 Z" fill="#ffffff" />
    <path d="M50,78 L47,90 L53,90 Z" fill="#10b981" /> {/* Corporate Emerald Tie */}
    <path d="M32,66 L44,78 L40,90 L20,90 Z" fill="#0f172a" stroke="#10b981" strokeWidth="0.5" />
    <path d="M68,66 L56,78 L60,90 L80,90 Z" fill="#0f172a" stroke="#10b981" strokeWidth="0.5" />
    {/* Face */}
    <circle cx="50" cy="42" r="16" fill="#fed7aa" />
    {/* Hair */}
    <path d="M34,36 C34,22 44,18 50,18 C56,18 66,22 66,36 Z" fill="#1e1b4b" />
    {/* Eyes */}
    <circle cx="43" cy="40" r="1.8" fill="#1e1b4b" />
    <circle cx="57" cy="40" r="1.8" fill="#1e1b4b" />
    {/* Smile */}
    <path d="M46,49 Q50,53 54,49" stroke="#1e1b4b" strokeWidth="1.5" strokeLinecap="round" fill="none" />
    {/* Folder/Tablet */}
    <rect x="70" y="72" width="16" height="20" rx="2" fill="#ffffff" />
    <rect x="73" y="76" width="10" height="2" fill="#10b981" />
    <rect x="73" y="80" width="10" height="1.5" fill="#94a3b8" />
    <rect x="73" y="84" width="7" height="1.5" fill="#94a3b8" />
  </svg>
);

// 8. Legal Researcher
export const LegalResearcher: React.FC<AvatarProps> = ({ size = '100%', ...props }) => (
  <svg viewBox="0 0 100 100" width={size} height={size} {...props}>
    <defs>
      <linearGradient id="bg-researcher" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#14b8a6" />
        <stop offset="100%" stopColor="#0f766e" />
      </linearGradient>
    </defs>
    <rect width="100" height="100" rx="20" fill="url(#bg-researcher)" />
    {/* Body */}
    <path d="M20,90 C20,73 32,68 50,68 C68,68 80,73 80,90 Z" fill="#334155" />
    <path d="M40,68 L50,78 L60,68 Z" fill="#f8fafc" />
    {/* Face */}
    <circle cx="50" cy="44" r="16" fill="#ffedd5" />
    {/* Hair */}
    <path d="M34,42 C30,30 40,22 50,25 C60,22 70,30 66,42 Z" fill="#7c2d12" />
    {/* Glasses */}
    <circle cx="43" cy="42" r="5" stroke="#7c2d12" strokeWidth="1.5" fill="none" />
    <circle cx="57" cy="42" r="5" stroke="#7c2d12" strokeWidth="1.5" fill="none" />
    <line x1="48" y1="42" x2="52" y2="42" stroke="#7c2d12" strokeWidth="1.5" />
    {/* Eyes */}
    <circle cx="43" cy="42" r="1.5" fill="#7c2d12" />
    <circle cx="57" cy="42" r="1.5" fill="#7c2d12" />
    {/* Smile */}
    <path d="M46,51 Q50,54 54,51" stroke="#7c2d12" strokeWidth="1.5" strokeLinecap="round" fill="none" />
    {/* Magnifying Glass (overlaying top right) */}
    <circle cx="76" cy="74" r="7" stroke="#fbbf24" strokeWidth="2" fill="none" />
    <line x1="81" y1="79" x2="88" y2="86" stroke="#fbbf24" strokeWidth="2.5" strokeLinecap="round" />
  </svg>
);

// 9. Compliance Officer
export const ComplianceOfficer: React.FC<AvatarProps> = ({ size = '100%', ...props }) => (
  <svg viewBox="0 0 100 100" width={size} height={size} {...props}>
    <defs>
      <linearGradient id="bg-compliance" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#6366f1" />
        <stop offset="100%" stopColor="#4338ca" />
      </linearGradient>
    </defs>
    <rect width="100" height="100" rx="20" fill="url(#bg-compliance)" />
    {/* Body */}
    <path d="M20,90 C20,72 32,66 50,66 C68,66 80,72 80,90 Z" fill="#0f172a" />
    <path d="M42,66 L50,78 L58,66 Z" fill="#ffffff" />
    {/* Gold Badge Tie */}
    <polygon points="50,78 54,82 50,90 46,82" fill="#fbbf24" />
    {/* Face */}
    <circle cx="50" cy="42" r="16" fill="#fed7aa" />
    {/* Hair */}
    <path d="M34,36 C34,20 44,16 50,19 C56,16 66,20 66,36 Z" fill="#1e293b" />
    {/* Eyes */}
    <circle cx="43" cy="40" r="1.8" fill="#1e293b" />
    <circle cx="57" cy="40" r="1.8" fill="#1e293b" />
    {/* Smile */}
    <path d="M46,49 Q50,53 54,49" stroke="#1e293b" strokeWidth="1.5" strokeLinecap="round" fill="none" />
    {/* Compliance Shield (shining gold at right) */}
    <path d="M72,70 C72,70 80,68 80,75 C80,82 72,88 72,88 C72,88 64,82 64,75 C64,68 72,70 72,70 Z" fill="#fbbf24" stroke="#ffffff" strokeWidth="1" />
    <path d="M69,76 L71.5,79 L76,73" stroke="#0f172a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
  </svg>
);

// 10. Male Judge
export const MaleJudge: React.FC<AvatarProps> = ({ size = '100%', ...props }) => (
  <svg viewBox="0 0 100 100" width={size} height={size} {...props}>
    <defs>
      <linearGradient id="bg-judge-m" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#ef4444" />
        <stop offset="100%" stopColor="#991b1b" />
      </linearGradient>
    </defs>
    <rect width="100" height="100" rx="20" fill="url(#bg-judge-m)" />
    {/* Body - Black Robes */}
    <path d="M18,90 C18,70 30,64 50,64 C70,64 82,70 82,90 Z" fill="#18181b" />
    {/* Traditional White Clerical Tabs / Bands */}
    <polygon points="45,64 49,64 49,78 43,78" fill="#ffffff" />
    <polygon points="55,64 51,64 51,78 57,78" fill="#ffffff" />
    {/* Red sash of justice */}
    <path d="M26,74 L32,90" stroke="#ef4444" strokeWidth="3" />
    <path d="M74,74 L68,90" stroke="#ef4444" strokeWidth="3" />
    {/* Face */}
    <circle cx="50" cy="40" r="16" fill="#fed7aa" />
    {/* Hair */}
    <path d="M34,36 C34,22 44,16 50,18 C56,18 66,22 66,36 Z" fill="#27272a" />
    {/* Eyes */}
    <circle cx="43" cy="38" r="2" fill="#27272a" />
    <circle cx="57" cy="38" r="2" fill="#27272a" />
    {/* Smile */}
    <path d="M46,48 Q50,52 54,48" stroke="#27272a" strokeWidth="1.8" strokeLinecap="round" fill="none" />
    {/* Gavel (overlaying bottom right) */}
    <rect x="74" y="76" width="12" height="6" rx="1" fill="#78350f" stroke="#fbbf24" strokeWidth="0.5" />
    <line x1="80" y1="82" x2="80" y2="92" stroke="#78350f" strokeWidth="2.5" strokeLinecap="round" />
    <circle cx="80" cy="92" r="1.5" fill="#fbbf24" />
  </svg>
);

// 11. Female Judge
export const FemaleJudge: React.FC<AvatarProps> = ({ size = '100%', ...props }) => (
  <svg viewBox="0 0 100 100" width={size} height={size} {...props}>
    <defs>
      <linearGradient id="bg-judge-f" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#ef4444" />
        <stop offset="100%" stopColor="#991b1b" />
      </linearGradient>
    </defs>
    <rect width="100" height="100" rx="20" fill="url(#bg-judge-f)" />
    {/* Hair Back */}
    <path d="M32,40 C22,50 22,70 32,80 L68,80 C78,70 78,50 68,40 Z" fill="#3f2305" />
    {/* Body - Black Robes */}
    <path d="M18,90 C18,70 30,64 50,64 C70,64 82,70 82,90 Z" fill="#18181b" />
    {/* White Collar tabs */}
    <polygon points="45,64 49,64 49,76 43,76" fill="#ffffff" />
    <polygon points="55,64 51,64 51,76 57,76" fill="#ffffff" />
    {/* Face */}
    <circle cx="50" cy="40" r="16" fill="#ffedd5" />
    {/* Hair Front */}
    <path d="M34,36 C34,22 45,18 50,21 C55,18 66,22 66,36 C66,42 63,34 50,34 C37,34 34,42 34,36 Z" fill="#3f2305" />
    {/* Eyes */}
    <circle cx="43" cy="38" r="1.8" fill="#3f2305" />
    <circle cx="57" cy="38" r="1.8" fill="#3f2305" />
    {/* Smile */}
    <path d="M46,48 Q50,52 54,48" stroke="#3f2305" strokeWidth="1.6" strokeLinecap="round" fill="none" />
    {/* Gavel (overlaying bottom right) */}
    <rect x="74" y="76" width="12" height="6" rx="1" fill="#78350f" stroke="#fbbf24" strokeWidth="0.5" />
    <line x1="80" y1="82" x2="80" y2="92" stroke="#78350f" strokeWidth="2.5" strokeLinecap="round" />
  </svg>
);

// 12. Constitutional Judge
export const ConstJudge: React.FC<AvatarProps> = ({ size = '100%', ...props }) => (
  <svg viewBox="0 0 100 100" width={size} height={size} {...props}>
    <defs>
      <linearGradient id="bg-const-judge" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#7c3aed" />
        <stop offset="100%" stopColor="#4c1d95" />
      </linearGradient>
    </defs>
    <rect width="100" height="100" rx="20" fill="url(#bg-const-judge)" />
    {/* Pillars of Court background */}
    <rect x="12" y="10" width="8" height="60" fill="rgba(255,255,255,0.08)" />
    <rect x="80" y="10" width="8" height="60" fill="rgba(255,255,255,0.08)" />
    {/* Body - Judicial Robes */}
    <path d="M18,90 C18,68 30,62 50,62 C70,62 82,68 82,90 Z" fill="#111827" />
    <polygon points="44,62 49,62 49,78 42,78" fill="#ffffff" />
    <polygon points="56,62 51,62 51,78 58,78" fill="#ffffff" />
    {/* Gold Robe Border */}
    <path d="M30,66 L36,90" stroke="#fbbf24" strokeWidth="2.5" />
    <path d="M70,66 L64,90" stroke="#fbbf24" strokeWidth="2.5" />
    {/* Face */}
    <circle cx="50" cy="38" r="16" fill="#fed7aa" />
    {/* Hair */}
    <path d="M34,34 C34,18 45,12 50,15 C55,12 66,18 66,34 Z" fill="#111827" />
    {/* Eyes */}
    <circle cx="43" cy="36" r="2" fill="#111827" />
    <circle cx="57" cy="36" r="2" fill="#111827" />
    {/* Smile */}
    <path d="M46,46 Q50,50 54,46" stroke="#111827" strokeWidth="1.8" strokeLinecap="round" fill="none" />
    {/* Scales of Justice Icon overlay at top right */}
    <g transform="translate(68, 14) scale(0.24)">
      <line x1="50" y1="10" x2="50" y2="90" stroke="#fbbf24" strokeWidth="6" />
      <line x1="10" y1="30" x2="90" y2="30" stroke="#fbbf24" strokeWidth="6" />
      {/* Left pan */}
      <line x1="20" y1="30" x2="20" y2="60" stroke="#fbbf24" strokeWidth="3" />
      <path d="M10,60 Q20,70 30,60 Z" fill="#fbbf24" />
      {/* Right pan */}
      <line x1="80" y1="30" x2="80" y2="60" stroke="#fbbf24" strokeWidth="3" />
      <path d="M70,60 Q80,70 90,60 Z" fill="#fbbf24" />
      {/* Stand */}
      <rect x="30" y="86" width="40" height="8" rx="2" fill="#fbbf24" />
    </g>
  </svg>
);

// 13. Grand Jurist
export const GrandJurist: React.FC<AvatarProps> = ({ size = '100%', ...props }) => (
  <svg viewBox="0 0 100 100" width={size} height={size} {...props}>
    <defs>
      <linearGradient id="bg-jurist" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#b45309" />
        <stop offset="50%" stopColor="#f59e0b" />
        <stop offset="100%" stopColor="#92400e" />
      </linearGradient>
    </defs>
    <rect width="100" height="100" rx="20" fill="url(#bg-jurist)" />
    {/* Body - Red & Gold robe */}
    <path d="M18,90 C18,68 30,62 50,62 C70,62 82,68 82,90 Z" fill="#7f1d1d" />
    <path d="M38,62 L50,82 L62,62 Z" fill="#ffffff" />
    <path d="M30,62 L36,90" stroke="#fbbf24" strokeWidth="3" />
    <path d="M70,62 L64,90" stroke="#fbbf24" strokeWidth="3" />
    {/* Face */}
    <circle cx="50" cy="38" r="16" fill="#fed7aa" />
    {/* Hair - Grey wisdom cut */}
    <path d="M34,34 C32,20 44,14 50,17 C56,14 68,20 66,34 Z" fill="#e2e8f0" />
    {/* Eye details */}
    <circle cx="43" cy="36" r="1.8" fill="#1e293b" />
    <circle cx="57" cy="36" r="1.8" fill="#1e293b" />
    {/* Smile */}
    <path d="M46,46 Q50,50 54,46" stroke="#1e293b" strokeWidth="1.6" strokeLinecap="round" fill="none" />
    {/* Gold laurel wreath behind the head */}
    <path d="M28,38 C28,26 36,22 44,24" stroke="#fbbf24" strokeWidth="2.5" fill="none" strokeLinecap="round" />
    <path d="M72,38 C72,26 64,22 56,24" stroke="#fbbf24" strokeWidth="2.5" fill="none" strokeLinecap="round" />
    {/* Mini Scroll overlay */}
    <rect x="70" y="70" width="18" height="22" rx="1" fill="#fef08a" stroke="#d97706" strokeWidth="1" />
    <line x1="74" y1="74" x2="84" y2="74" stroke="#d97706" strokeWidth="1.2" />
    <line x1="74" y1="80" x2="84" y2="80" stroke="#d97706" strokeWidth="1.2" />
    <line x1="74" y1="86" x2="80" y2="86" stroke="#d97706" strokeWidth="1.2" />
  </svg>
);

// 14. LEGATRIXON Scholar
export const LegatrixonScholar: React.FC<AvatarProps> = ({ size = '100%', ...props }) => (
  <svg viewBox="0 0 100 100" width={size} height={size} {...props}>
    <defs>
      <linearGradient id="bg-scholar" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#4c1d95" />
        <stop offset="50%" stopColor="#1e1b4b" />
        <stop offset="100%" stopColor="#3b0764" />
      </linearGradient>
      <linearGradient id="gold-neon" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#ffe4e6" />
        <stop offset="50%" stopColor="#fbbf24" />
        <stop offset="100%" stopColor="#f59e0b" />
      </linearGradient>
    </defs>
    <rect width="100" height="100" rx="20" fill="url(#bg-scholar)" stroke="url(#gold-neon)" strokeWidth="1.5" />
    {/* Glowing Circuit background sparks */}
    <path d="M10,20 L30,40 M90,20 L70,40" stroke="rgba(251,191,36,0.12)" strokeWidth="1.5" />
    <circle cx="30" cy="40" r="2" fill="#fbbf24" opacity="0.3" />
    <circle cx="70" cy="40" r="2" fill="#fbbf24" opacity="0.3" />
    {/* Body - Futuristic academic robe */}
    <path d="M20,90 C20,70 32,64 50,64 C68,64 80,70 80,90 Z" fill="#09090b" />
    <path d="M40,64 L50,80 L60,64 Z" fill="url(#gold-neon)" />
    <path d="M50,80 L46,90 L54,90 Z" fill="#4c1d95" />
    {/* Face */}
    <circle cx="50" cy="40" r="16" fill="#ffedd5" />
    {/* Hair */}
    <path d="M34,34 C34,20 44,14 50,17 C56,17 66,20 66,34 Z" fill="#1e1b4b" />
    {/* Eyes - Glowing futuristic teal */}
    <circle cx="43" cy="36" r="2" fill="#14b8a6" />
    <circle cx="57" cy="36" r="2" fill="#14b8a6" />
    {/* Smile */}
    <path d="M46,46 Q50,49 54,46" stroke="#fbbf24" strokeWidth="1.5" strokeLinecap="round" fill="none" />
    {/* Futuristic Neon Gold Mortarboard cap */}
    <polygon points="50,12 76,20 50,28 24,20" fill="#1e1b4b" stroke="url(#gold-neon)" strokeWidth="1.5" />
    <rect x="47" y="22" width="6" height="5" fill="#fbbf24" />
    {/* Star Sparkles */}
    <path d="M18,14 L20,10 L22,14 L26,16 L22,18 L20,22 L18,18 L14,16 Z" fill="#fbbf24" />
    <path d="M82,14 L84,10 L86,14 L90,16 L86,18 L84,22 L82,18 L78,16 Z" fill="#fbbf24" />
  </svg>
);

// Metadata collection of all avatars
export interface AvatarItem {
  id: string;
  name: string;
  category: 'Students' | 'Professionals' | 'Judiciary' | 'Elite';
  component: React.FC<AvatarProps>;
}

export const AVATARS: AvatarItem[] = [
  // Students
  { id: 'law_student_male', name: 'Law Student Male', category: 'Students', component: LawStudentMale },
  { id: 'law_student_female', name: 'Law Student Female', category: 'Students', component: LawStudentFemale },
  { id: 'const_law_student', name: 'Constitutional Law Student', category: 'Students', component: ConstLawStudent },
  { id: 'moot_court_student', name: 'Moot Court Student', category: 'Students', component: MootCourtStudent },

  // Professionals
  { id: 'junior_advocate', name: 'Junior Advocate', category: 'Professionals', component: JuniorAdvocate },
  { id: 'senior_advocate', name: 'Senior Advocate', category: 'Professionals', component: SeniorAdvocate },
  { id: 'corporate_lawyer', name: 'Corporate Lawyer', category: 'Professionals', component: CorporateLawyer },
  { id: 'legal_researcher', name: 'Legal Researcher', category: 'Professionals', component: LegalResearcher },
  { id: 'compliance_officer', name: 'Compliance Officer', category: 'Professionals', component: ComplianceOfficer },

  // Judiciary
  { id: 'male_judge', name: 'Male Judge', category: 'Judiciary', component: MaleJudge },
  { id: 'female_judge', name: 'Female Judge', category: 'Judiciary', component: FemaleJudge },
  { id: 'const_judge', name: 'Constitutional Judge', category: 'Judiciary', component: ConstJudge },

  // Elite
  { id: 'grand_jurist', name: 'Grand Jurist', category: 'Elite', component: GrandJurist },
  { id: 'legatrixon_scholar', name: 'LEGATRIXON Scholar', category: 'Elite', component: LegatrixonScholar },
];

// Utility: render chosen avatar
export function renderAvatar(
  id: string | null | undefined,
  className?: string,
  style?: React.CSSProperties,
  size?: number | string
) {
  const targetId = id || 'law_student_male';
  const found = AVATARS.find((av) => av.id === targetId);
  const Component = found ? found.component : LawStudentMale;
  return <Component className={className} style={style} size={size} />;
}

// Utility: get avatar name
export function getAvatarName(id: string | null | undefined): string {
  const targetId = id || 'law_student_male';
  const found = AVATARS.find((av) => av.id === targetId);
  return found ? found.name : 'Law Student Male';
}
