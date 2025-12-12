import sparklyLogo from '@/assets/sparkly-logo.png';

export function Logo() {
  return (
    <a 
      href="https://team-test.sparkly.hr/"
      aria-label="Go to home page"
    >
      <img 
        src={sparklyLogo} 
        alt="Sparkly.hr" 
        className="h-16 sm:h-[4.5rem] mx-auto object-contain hover:opacity-80 transition-opacity cursor-pointer"
      />
    </a>
  );
}
