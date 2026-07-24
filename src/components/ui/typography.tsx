import React from 'react';
import { cn } from '@/lib/utils';

export const Display: React.FC<React.HTMLAttributes<HTMLHeadingElement>> = ({ className, ...props }) => (
 <h1 className={cn('text-display font-heading tracking-tight', className)} {...props} />
);

export const PageTitle: React.FC<React.HTMLAttributes<HTMLHeadingElement>> = ({ className, ...props }) => (
 <h1 className={cn('text-page font-heading tracking-tight', className)} {...props} />
);

export const WorkspaceTitle: React.FC<React.HTMLAttributes<HTMLHeadingElement>> = ({ className, ...props }) => (
 <h2 className={cn('text-workspace font-heading tracking-tight', className)} {...props} />
);

export const SectionTitle: React.FC<React.HTMLAttributes<HTMLHeadingElement>> = ({ className, ...props }) => (
 <h3 className={cn('text-section font-heading tracking-tight', className)} {...props} />
);

export const CardTitle: React.FC<React.HTMLAttributes<HTMLHeadingElement>> = ({ className, ...props }) => (
 <h4 className={cn('text-card font-heading tracking-tight', className)} {...props} />
);

export const Body: React.FC<React.HTMLAttributes<HTMLParagraphElement>> = ({ className, ...props }) => (
 <p className={cn('text-body', className)} {...props} />
);

export const Secondary: React.FC<React.HTMLAttributes<HTMLParagraphElement>> = ({ className, ...props }) => (
 <p className={cn('text-secondary text-muted-foreground', className)} {...props} />
);

export const Label: React.FC<React.HTMLAttributes<HTMLLabelElement>> = ({ className, ...props }) => (
 <label className={cn('text-label', className)} {...props} />
);

export const Caption: React.FC<React.HTMLAttributes<HTMLSpanElement>> = ({ className, ...props }) => (
 <span className={cn('text-caption text-muted-foreground', className)} {...props} />
);

export const Metric: React.FC<React.HTMLAttributes<HTMLSpanElement>> = ({ className, ...props }) => (
 <span className={cn('text-metric font-mono tracking-tight', className)} {...props} />
);
