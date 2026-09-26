import React from 'react';
import { PackageOpen } from 'lucide-react';
import { Button } from './Button';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  actionText?: string;
  onAction?: () => void;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon = <PackageOpen className="w-12 h-12 text-slate-500" />,
  title,
  description,
  actionText,
  onAction,
  className = ''
}) => {
  return (
    <div className={`flex flex-col items-center justify-center text-center p-8 rounded-2xl border border-dashed border-slate-800 bg-slate-900/30 ${className}`}>
      <div className="w-16 h-16 rounded-2xl bg-slate-800/60 flex items-center justify-center mb-4 text-slate-400">
        {icon}
      </div>
      <h4 className="text-base font-bold text-slate-200 mb-1">{title}</h4>
      {description && <p className="text-sm text-slate-400 max-w-sm mb-5 leading-relaxed">{description}</p>}
      {actionText && onAction && (
        <Button size="sm" onClick={onAction} variant="secondary">
          {actionText}
        </Button>
      )}
    </div>
  );
};
