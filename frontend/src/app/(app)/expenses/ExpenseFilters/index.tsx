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
import { Search, X, Filter, Calendar } from 'lucide-react';

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface IExpenseFilterState {
  search: string;
  dateFrom: string;
  dateTo: string;
  category: string;
  person: string;
  paidStatus: 'ALL' | 'PAID' | 'UNPAID';
}

export const EMPTY_FILTERS: IExpenseFilterState = {
  search: '',
  dateFrom: '',
  dateTo: '',
  category: '',
  person: '',
  paidStatus: 'ALL',
};

interface Props {
  filters: IExpenseFilterState;
  onFiltersChange: (filters: IExpenseFilterState) => void;
  categories: any[];
  familyMembers: any[];
}

export function ExpenseFilters({ filters, onFiltersChange, categories, familyMembers }: Props) {
  const hasActiveFilters =
    filters.search !== '' ||
    filters.dateFrom !== '' ||
    filters.dateTo !== '' ||
    filters.category !== '' ||
    filters.person !== '' ||
    filters.paidStatus !== 'ALL';

  const _clearFilters = () => onFiltersChange(EMPTY_FILTERS);

  const memberOptions = familyMembers.map((m: any) => ({
    value: m.nickname || m.user?.firstName || m.user?.username || m.id,
    label: m.nickname || m.user?.firstName || m.user?.username || 'Unknown',
  }));

  return (
    <div className="space-y-3 rounded-lg border bg-card p-3">
      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
        <Filter className="h-4 w-4" />
        Filtry
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={_clearFilters} className="ml-auto gap-1 h-7">
            <X className="h-3.5 w-3.5" />
            Wyczyść
          </Button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {/* Search */}
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={filters.search}
            onChange={(e) => onFiltersChange({ ...filters, search: e.target.value })}
            placeholder="Szukaj w wydatkach..."
            className="pl-9 h-9"
          />
        </div>

        {/* Date range */}
        <div className="flex items-center gap-1.5">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <Input
            type="date"
            value={filters.dateFrom}
            onChange={(e) => onFiltersChange({ ...filters, dateFrom: e.target.value })}
            className="h-9 w-36"
            placeholder="Od"
          />
          <span className="text-muted-foreground">–</span>
          <Input
            type="date"
            value={filters.dateTo}
            onChange={(e) => onFiltersChange({ ...filters, dateTo: e.target.value })}
            className="h-9 w-36"
            placeholder="Do"
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {/* Category filter */}
        {categories.length > 0 && (
          <Select
            value={filters.category || 'all'}
            onValueChange={(v) => onFiltersChange({ ...filters, category: v === 'all' ? '' : v })}
          >
            <SelectTrigger className="w-44 h-9">
              <SelectValue placeholder="Kategoria" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Wszystkie kategorie</SelectItem>
              {categories.map((cat: any) => (
                <SelectItem key={cat.id || cat.name} value={cat.name}>
                  <span className="flex items-center gap-2">
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: cat.color || '#888' }}
                    />
                    {cat.name}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* Person filter */}
        {memberOptions.length > 0 && (
          <Select
            value={filters.person || 'all'}
            onValueChange={(v) => onFiltersChange({ ...filters, person: v === 'all' ? '' : v })}
          >
            <SelectTrigger className="w-40 h-9">
              <SelectValue placeholder="Osoba" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Wszyscy</SelectItem>
              {memberOptions.map((opt: any) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* Paid status */}
        <Select
          value={filters.paidStatus}
          onValueChange={(v) =>
            onFiltersChange({ ...filters, paidStatus: v as 'ALL' | 'PAID' | 'UNPAID' })
          }
        >
          <SelectTrigger className="w-36 h-9">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Wszystkie</SelectItem>
            <SelectItem value="PAID">Opłacone</SelectItem>
            <SelectItem value="UNPAID">Nieopłacone</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Active filter badges */}
      {hasActiveFilters && (
        <div className="flex flex-wrap gap-1.5">
          {filters.dateFrom && (
            <Badge variant="secondary" className="gap-1">
              Od: {filters.dateFrom}
              <X
                className="h-3 w-3 cursor-pointer"
                onClick={() => onFiltersChange({ ...filters, dateFrom: '' })}
              />
            </Badge>
          )}
          {filters.dateTo && (
            <Badge variant="secondary" className="gap-1">
              Do: {filters.dateTo}
              <X
                className="h-3 w-3 cursor-pointer"
                onClick={() => onFiltersChange({ ...filters, dateTo: '' })}
              />
            </Badge>
          )}
          {filters.category && (
            <Badge variant="secondary" className="gap-1">
              {filters.category}
              <X
                className="h-3 w-3 cursor-pointer"
                onClick={() => onFiltersChange({ ...filters, category: '' })}
              />
            </Badge>
          )}
          {filters.person && (
            <Badge variant="secondary" className="gap-1">
              {filters.person}
              <X
                className="h-3 w-3 cursor-pointer"
                onClick={() => onFiltersChange({ ...filters, person: '' })}
              />
            </Badge>
          )}
          {filters.paidStatus !== 'ALL' && (
            <Badge variant="secondary" className="gap-1">
              {filters.paidStatus === 'PAID' ? 'Opłacone' : 'Nieopłacone'}
              <X
                className="h-3 w-3 cursor-pointer"
                onClick={() => onFiltersChange({ ...filters, paidStatus: 'ALL' })}
              />
            </Badge>
          )}
        </div>
      )}
    </div>
  );
}
