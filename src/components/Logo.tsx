import sparklyLogo from '@/assets/sparkly-logo.png';

export function Logo() {
  return (
    <a href="https://sparkly.hr" target="_blank" rel="noopener noreferrer">
      <img 
        src={sparklyLogo} 
        alt="Sparkly.hr Logo" 
        className="h-10 sm:h-12 mx-auto object-contain hover:opacity-80 transition-opacity cursor-pointer"
      />
    </a>
  );
}
