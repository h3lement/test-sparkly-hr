import { Link } from 'react-router-dom';
import sparklyLogo from '@/assets/sparkly-logo.png';

interface LogoProps {
  quizSlug?: string;
}

export function Logo({ quizSlug }: LogoProps) {
  const handleClick = () => {
    // If we have a quiz slug, scroll to top to reset the quiz view
    if (quizSlug) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // If we have a quiz slug, link back to the quiz start
  if (quizSlug) {
    return (
      <Link 
        to={`/${quizSlug}`}
        onClick={handleClick}
        aria-label="Go back to quiz start"
      >
        <img 
          src={sparklyLogo} 
          alt="Sparkly.hr" 
          className="h-16 sm:h-[4.5rem] mx-auto object-contain hover:opacity-80 transition-opacity cursor-pointer"
        />
      </Link>
    );
  }

  // Default behavior - link to homepage
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
