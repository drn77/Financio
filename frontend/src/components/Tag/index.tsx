/* eslint-disable @next/next/no-img-element */
import { cn } from '@/lib/utils';

import type { Props } from './model';

export function Tag({ name, color, icon, imageUrl, groupName, selected, className }: Props) {
  const resolvedColor = color || '#2ECC71';

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors',
        selected && 'ring-2 ring-offset-1 ring-primary',
        className,
      )}
      style={{
        borderColor: resolvedColor,
        color: resolvedColor,
        backgroundColor: `${resolvedColor}1A`,
      }}
      title={groupName ? `${groupName}: ${name}` : name}
    >
      {imageUrl ? (
        <img src={imageUrl} alt={name} className="h-3.5 w-3.5 rounded-full object-cover" />
      ) : icon ? (
        <span className="leading-none">{icon}</span>
      ) : null}
      <span className="truncate">{name}</span>
    </span>
  );
}
