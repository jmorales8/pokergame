'use client';
import { Card as CardType } from '@/lib/poker';

interface CardProps {
  card?: CardType;
  hidden?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const isRed = (suit: string) => suit === '♥' || suit === '♦';

export default function Card({ card, hidden = false, size = 'md', className = '' }: CardProps) {
  const sizeClasses = {
    sm: 'w-10 h-14 text-xs',
    md: 'w-14 h-20 text-sm',
    lg: 'w-16 h-24 text-base',
  };

  if (!card || hidden) {
    return (
      <div className={`${sizeClasses[size]} rounded-lg border-2 border-yellow-600/30 bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center shadow-lg ${className}`}>
        <div className="text-yellow-600/40 text-2xl">🂠</div>
      </div>
    );
  }

  const red = isRed(card.suit);

  return (
    <div className={`${sizeClasses[size]} rounded-lg border border-slate-600 bg-gradient-to-br from-slate-100 to-white flex flex-col justify-between p-1 shadow-lg select-none ${className}`}>
      <div className={`font-bold leading-none ${red ? 'text-red-600' : 'text-slate-900'}`}>
        <div>{card.rank}</div>
        <div className="text-base leading-none">{card.suit}</div>
      </div>
      <div className={`font-bold leading-none self-end rotate-180 ${red ? 'text-red-600' : 'text-slate-900'}`}>
        <div>{card.rank}</div>
        <div className="text-base leading-none">{card.suit}</div>
      </div>
    </div>
  );
}
