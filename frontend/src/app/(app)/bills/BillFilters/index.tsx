'use client';

import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Search, X, Filter, ArrowUpDown } from 'lucide-react';
import {
  STATUS_LABELS,
  SORT_LABELS,
  type IFilterState,
  type ITagOption,
  type BillStatus,
  type SortDirection,
  type SortField,
} from '../model';

interface Props {
  filters: IFilterState;
  onFiltersChange: (filters: IFilterState) => void;
  tags: ITagOption[];
  sortField: SortField | '';
  sortDirection: SortDirection;
  onSortFieldChange: (field: SortField | '') => void;
  onSortDirectionToggle: () => void;
}

export function BillFilters({
  filters,
  onFiltersChange,
  tags,
  sortField,
  sortDirection,
  onSortFieldChange,
  onSortDirectionToggle,
}: Props) {
  const hasActiveFilters =
    filters.status !== 'ALL' || filters.tagIds.length > 0 || filters.search !== '' || !!sortField;

  const _clearFilters = () => {
    onFiltersChange({ status: 'ALL', tagIds: [], search: '' });
    onSortFieldChange('');
  };

  const selectedTagId = filters.tagIds[0] ?? '__all';

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={filters.search}
            onChange={(e) => onFiltersChange({ ...filters, search: e.target.value })}
            placeholder="Wyszukaj cykliczne wydatki..."
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

        <Select
          value={selectedTagId}
          onValueChange={(value) => onFiltersChange({ ...filters, tagIds: value === '__all' ? [] : [value] })}
        >
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Tag" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all">Wszystkie tagi</SelectItem>
            {tags.map((tag) => (
              <SelectItem key={tag.id} value={tag.id}>
                {tag.groupName}: {tag.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex items-center gap-2">
          <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
          <Select
            value={sortField || '__none'}
            onValueChange={(value) => onSortFieldChange(value === '__none' ? '' : value as SortField)}
          >
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Sortuj" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none">Bez sortowania</SelectItem>
              {(Object.entries(SORT_LABELS) as [SortField, string][]).map(([key, label]) => (
                <SelectItem key={key} value={key}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {sortField && (
            <Button variant="ghost" size="sm" className="h-8 px-2" onClick={onSortDirectionToggle}>
              {sortDirection === 'asc' ? '↑' : '↓'}
            </Button>
          )}
        </div>

        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={_clearFilters} className="gap-1">
            <X className="h-3.5 w-3.5" />
            Wyczyść
          </Button>
        )}
      </div>
    </div>
  );
}
