import React from 'react';

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'success' | 'warning' | 'premium';
  children: React.ReactNode;
}

export const Badge: React.FC<BadgeProps> = ({ variant = 'default', children, className = '', ...props }) => {
  const variants = {
    default: 'bg-teal-deep/60 text-cream border-cyan-glow/40',
    success: 'bg-emerald-900/60 text-emerald-200 border-emerald-400/40',
    warning: 'bg-amber-900/60 text-amber-200 border-amber-400/40',
    premium: 'bg-gradient-to-r from-gold-highlight via-gold-primary to-gold-secondary text-abyss border-gold-primary'
  };

  return (
    <span
      className={`
        inline-flex items-center gap-2 px-3 py-1.5 rounded-full
        border-2 backdrop-blur-xl text-xs font-bold uppercase tracking-wider
        transition-all duration-300 hover:scale-110 hover:shadow-lg
        ${variants[variant]}
        ${variant === 'premium' && 'hover:shadow-[0_0_20px_rgba(212,165,116,0.6)] animate-pulse-glow'}
        ${className}
      `}
      {...props}
    >
      {variant === 'premium' && (
        <span className="w-2 h-2 rounded-full bg-cyan-glow animate-pulse shadow-[0_0_8px_#00D4AA]" />
      )}
      {children}
    </span>
  );
};
