'use client';

import { Loader2, Star } from 'lucide-react';
import { cn } from '@/lib/utils';

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn('w-5 h-5 animate-spin text-tg-button', className)} />;
}

export function LoadingScreen({ text }: { text?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12">
      <Spinner className="w-8 h-8" />
      {text && <p className="mt-3 text-sm text-tg-hint">{text}</p>}
    </div>
  );
}

export function Empty({ title, description, icon }: { title: string; description?: string; icon?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      {icon && <div className="text-tg-hint mb-4">{icon}</div>}
      <h3 className="text-lg font-semibold text-tg-text">{title}</h3>
      {description && <p className="mt-1 text-sm text-tg-hint">{description}</p>}
    </div>
  );
}

export function Stars({ value, size = 16 }: { value: number; size?: number }) {
  const v = Math.round(value);
  return (
    <div className="inline-flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          size={size}
          className={i <= v ? 'fill-yellow-400 text-yellow-400' : 'text-tg-hint'}
        />
      ))}
    </div>
  );
}

export function Badge({
  children,
  variant = 'default',
}: {
  children: React.ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info';
}) {
  const variants = {
    default: 'bg-tg-secondary-bg text-tg-text',
    success: 'bg-green-100 text-green-700',
    warning: 'bg-yellow-100 text-yellow-700',
    danger: 'bg-red-100 text-red-700',
    info: 'bg-blue-100 text-blue-700',
  };
  return (
    <span className={cn('inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium', variants[variant])}>
      {children}
    </span>
  );
}

export function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('card p-4', className)}>{children}</div>;
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('skeleton', className)} />;
}
