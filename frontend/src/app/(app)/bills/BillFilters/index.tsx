'use client';

import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Search, X, Filter } from 'lucide-react';
import type { ICategory } from '@shared/models';
import { STATUS_LABELS, type IFilterState, type ITagOption, type BillStatus } from '../model';

interface Props {
  filters: IFilterState;
  onFiltersChange: (filters: IFilterState) => void;
  categories: ICategory[];
  tags: ITagOption[];
}

export function BillFilters({ filters, onFiltersChange, categories, tags }: Props) {
  const hasActiveFilters =
    filters.status !== 'ALL' || filters.tagIds.length > 0 || filters.categoryId !== '' || filters.search !== '';

  const _clearFilters = () => {
    onFiltersChange({ status: 'ALL', tagIds: [], categoryId: '', search: '' });
  };

  const _toggleTag = (tagId: string) => {
    const current = filters.tagIds;
    const next = current.includes(tagId)
      ? current.filter((id) => id !== tagId)
      : [...current, tagId];
    onFiltersChange({ ...filters, tagIds: next });
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={filters.search}
            onChange={(e) => onFiltersChange({ ...filters, search: e.target.value })}
            placeholder="Szukaj rachunku..."
            className="pl-9"
          />
        </div>

        <Select
          value={filters.status}
          onValueChange={(v) => onFiltersChange({ ...filters, status: v as BillStatus | 'ALL' })}
        >
          <SelectTrigger className="w-40">
            <Filter className="mr-1.5 h-3.5 w-3.5" />
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Wszystkie</SelectItem>
            {Object.entries(STATUS_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {categories.length > 0 && (
          <Select
            value={filters.categoryId || 'all'}
            onValueChange={(v) => onFiltersChange({ ...filters, categoryId: v === 'all' ? '' : v })}
          >
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Kategoria" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Wszystkie kategorie</SelectItem>
              {categories.map((cat) => (
                <SelectItem key={cat.id} value={cat.id}>
                  <span className="flex items-center gap-2">
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: cat.color }}
                    />
                    {cat.name}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={_clearFilters} className="gap-1">
            <X className="h-3.5 w-3.5" />
            Wyczyść
          </Button>
        )}
      </div>

      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          <Badge
            variant={filters.tagIds.length === 0 ? 'default' : 'outline'}
            className="cursor-pointer select-none"
            onClick={() => onFiltersChange({ ...filters, tagIds: [] })}
          >
            Wszystkie tagi
          </Badge>
          {tags.map((tag) => {
            const isSelected = filters.tagIds.includes(tag.id);
            return (
              <Badge
                key={tag.id}
                variant={isSelected ? 'default' : 'outline'}
                className="cursor-pointer select-none transition-colors"
                style={
                  isSelected
                    ? { backgroundColor: tag.color, borderColor: tag.color }
                    : { borderColor: tag.color, color: tag.color }
                }
                onClick={() => _toggleTag(tag.id)}
              >
                {tag.name}
                {isSelected && <X className="ml-1 h-3 w-3" />}
              </Badge>
            );
          })}
        </div>
      )}
    </div>
  );
}
