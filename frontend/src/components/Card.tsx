import { useRef } from 'react';
import { useMousePosition } from '../hooks/useMousePosition';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export const Card: React.FC<CardProps> = ({
  children,
  className = "",
  ...props
}) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const mousePos = useMousePosition(cardRef);

  return (
    <div
      ref={cardRef}
      className={`glass-panel rounded-xl p-6 shadow-xl transition-all duration-500 group hover:-translate-y-1 ${className}`}
      {...props}
    >
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none rounded-xl"
        style={{
          background: `radial-gradient(circle at ${mousePos.x}% ${mousePos.y}%, rgba(0,212,170,0.2) 0%, transparent 50%)`
        }}
      />

      <div className="absolute top-0 left-1/4 w-1/2 h-32 bg-gradient-to-b from-cyan-glow/10 to-transparent opacity-0 group-hover:opacity-100 blur-2xl transition-opacity duration-700 pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-1/2 h-32 bg-gradient-to-t from-gold-primary/8 to-transparent opacity-0 group-hover:opacity-100 blur-2xl transition-opacity duration-700 pointer-events-none" />

      <div className="relative z-10">{children}</div>
    </div>
  );
};

export const CardHeader: React.FC<CardProps> = ({
  children,
  className = "",
  ...props
}) => {
  return (
    <div className={`pb-4 mb-4 border-b border-[#c8a051]/30 ${className}`} {...props}>
      {children}
    </div>
  );
};

export const CardContent: React.FC<CardProps> = ({
  children,
  className = "",
  ...props
}) => {
  return (
    <div className={`pt-4 ${className}`} {...props}>
      {children}
    </div>
  );
};
