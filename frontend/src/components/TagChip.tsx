import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface TagChipProps {
  name: string;
  color?: string | null;
  icon?: string | null;
  groupName?: string | null;
  className?: string;
}

export function TagChip({ name, color, icon, groupName, className }: TagChipProps) {
  const resolvedColor = color || '#2ECC71';

  return (
    <Badge
      variant="outline"
      className={cn('inline-flex items-center gap-1.5 border text-xs', className)}
      style={{
        borderColor: resolvedColor,
        color: resolvedColor,
        backgroundColor: `${resolvedColor}1A`,
      }}
      title={groupName ? `${groupName}: ${name}` : name}
    >
      {icon ? <span className="leading-none">{icon}</span> : null}
      <span className="truncate">{name}</span>
    </Badge>
  );
}
