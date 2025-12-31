import sparklyLogo from '@/assets/sparkly-logo.png';

interface LogoProps {
  quizSlug?: string;
  onLogoClick?: () => void;
}

export function Logo({ quizSlug, onLogoClick }: LogoProps) {
  const handleClick = (e: React.MouseEvent) => {
    if (onLogoClick) {
      e.preventDefault();
      onLogoClick();
    }
  };

  // If we have a quiz slug, clicking resets the quiz
  if (quizSlug) {
    return (
      <button 
        onClick={handleClick}
        aria-label="Go back to quiz start"
        className="block mx-auto"
      >
        <img 
          src={sparklyLogo} 
          alt="Sparkly.hr" 
          className="h-16 sm:h-[4.5rem] mx-auto object-contain hover:opacity-80 transition-opacity cursor-pointer"
        />
      </button>
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
