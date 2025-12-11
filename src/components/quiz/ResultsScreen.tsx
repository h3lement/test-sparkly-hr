import { Button } from '@/components/ui/button';
import { useQuiz, quizQuestions } from './QuizContext';
import { Footer } from './Footer';
import { Logo } from '@/components/Logo';
import { cn } from '@/lib/utils';

interface ResultLevel {
  min: number;
  max: number;
  title: string;
  emoji: string;
  description: string;
  insights: string[];
  color: string;
}

const resultLevels: ResultLevel[] = [
  {
    min: 6,
    max: 10,
    title: 'High-Performing Team',
    emoji: '🌟',
    description: 'Congratulations! Your team is operating at a high level. You\'ve built a solid foundation that allows you to focus on growth.',
    insights: [
      'Your delegation skills are strong',
      'Team members show initiative and ownership',
      'You have time to focus on strategic priorities',
    ],
    color: 'from-emerald-500 to-green-600',
  },
  {
    min: 11,
    max: 16,
    title: 'Room for Improvement',
    emoji: '⚡',
    description: 'Your team has potential, but there are clear areas where performance improvements could significantly impact your business.',
    insights: [
      'Some tasks take longer than they should',
      'Communication gaps may be causing delays',
      'Clearer expectations could boost results',
    ],
    color: 'from-amber-500 to-orange-600',
  },
  {
    min: 17,
    max: 20,
    title: 'Performance Challenges',
    emoji: '🔥',
    description: 'You\'re likely spending significant time managing issues rather than growing your business. This is holding you back.',
    insights: [
      'You\'re frequently re-doing delegated work',
      'Employee issues consume your daily focus',
      'Scaling feels impossible right now',
    ],
    color: 'from-rose-500 to-red-600',
  },
  {
    min: 21,
    max: 24,
    title: 'Critical Performance Gap',
    emoji: '🚨',
    description: 'Your team performance is significantly impacting your ability to run and grow your business. Immediate action is needed.',
    insights: [
      'You\'re essentially doing everything yourself',
      'Taking time off feels impossible',
      'Employee issues are your biggest bottleneck',
    ],
    color: 'from-red-600 to-rose-700',
  },
];

export function ResultsScreen() {
  const { totalScore, email, resetQuiz } = useQuiz();
  
  const result = resultLevels.find(
    (level) => totalScore >= level.min && totalScore <= level.max
  ) || resultLevels[resultLevels.length - 1];

  const maxScore = quizQuestions.length * 4;
  const percentage = Math.round((totalScore / maxScore) * 100);
  const inversePercentage = 100 - percentage; // Lower score = better

  return (
    <div className="animate-fade-in max-w-2xl mx-auto">
      <div className="text-center mb-8">
        <div className="mb-6">
          <Logo />
        </div>
        
        <p className="text-muted-foreground mb-2">Results for {email}</p>
        
        <h2 className="font-heading text-3xl md:text-4xl font-bold mb-2">
          {result.emoji} {result.title}
        </h2>
      </div>

      {/* Score visualization */}
      <div className="glass rounded-2xl p-8 mb-8">
        <div className="text-center mb-6">
          <div className="text-6xl font-bold gradient-text mb-2">
            {totalScore}
          </div>
          <p className="text-muted-foreground">out of {maxScore} points</p>
        </div>
        
        <div className="h-4 bg-secondary rounded-full overflow-hidden mb-4">
          <div 
            className={cn('h-full bg-gradient-to-r transition-all duration-1000', result.color)}
            style={{ width: `${percentage}%` }}
          />
        </div>
        
        <div className="flex justify-between text-sm text-muted-foreground">
          <span>Best</span>
          <span>Needs Work</span>
        </div>
      </div>

      {/* Result description */}
      <div className="glass rounded-2xl p-8 mb-8">
        <h3 className="font-heading text-xl font-semibold mb-4">What This Means</h3>
        <p className="text-muted-foreground leading-relaxed mb-6">
          {result.description}
        </p>
        
        <h4 className="font-semibold mb-3">Key Insights:</h4>
        <ul className="space-y-3">
          {result.insights.map((insight, i) => (
            <li key={i} className="flex items-start gap-3">
              <span className="gradient-primary w-6 h-6 rounded-full flex items-center justify-center text-primary-foreground text-sm shrink-0 mt-0.5">
                {i + 1}
              </span>
              <span>{insight}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* CTA */}
      <div className="glass rounded-2xl p-8 text-center">
        <h3 className="font-heading text-xl font-semibold mb-3">
          Want to Improve Your Team's Performance?
        </h3>
        <p className="text-muted-foreground mb-6">
          We've sent a detailed breakdown and personalized recommendations to your email.
        </p>
        
        <Button
          onClick={resetQuiz}
          variant="outline"
          className="mr-4"
        >
          Take Quiz Again
        </Button>
      </div>
      
      <Footer />
    </div>
  );
}
