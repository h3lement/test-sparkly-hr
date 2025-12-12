import { Link } from 'react-router-dom';
import sparklyLogo from '@/assets/sparkly-logo.png';

export function Logo() {
  return (
    <Link 
      to="/"
      aria-label="Go to home page"
    >
      <img 
        src={sparklyLogo} 
        alt="Sparkly.hr" 
        className="h-16 sm:h-[4.5rem] mx-auto object-contain hover:opacity-80 transition-opacity cursor-pointer"
      />
    </Link>
  );
}
