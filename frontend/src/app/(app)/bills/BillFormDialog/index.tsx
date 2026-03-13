'use client';

import { useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { X } from 'lucide-react';
import {
  EMPTY_FORM,
  FREQUENCY_LABELS,
  PAYMENT_TYPE_LABELS,
  type IBillFormData,
  type ITagOption,
  type IBill,
  type Frequency,
  type PaymentType,
} from '../model';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  form: IBillFormData;
  onFormChange: (form: IBillFormData) => void;
  onSubmit: () => void;
  tags: ITagOption[];
  editingBill: IBill | null;
  isSubmitting: boolean;
}

export function BillFormDialog({
  open,
  onOpenChange,
  form,
  onFormChange,
  onSubmit,
  tags,
  editingBill,
  isSubmitting,
}: Props) {
  const hasInvalidDateRange =
    !!form.paymentStartDate
    && !!form.paymentEndDate
    && new Date(form.paymentEndDate) < new Date(form.paymentStartDate);

  const _updateField = useCallback(
    <K extends keyof IBillFormData>(field: K, value: IBillFormData[K]) => {
      onFormChange({ ...form, [field]: value });
    },
    [form, onFormChange],
  );

  const _toggleTag = useCallback(
    (tagId: string) => {
      const current = form.tagIds;
      const next = current.includes(tagId)
        ? current.filter((id) => id !== tagId)
        : [...current, tagId];

      onFormChange({ ...form, tagIds: next });
    },
    [form, onFormChange],
  );

  const _handleSubmit = useCallback(() => {
    if (!form.name || !form.amount || !form.dueDay || !form.paymentStartDate || hasInvalidDateRange) return;
    onSubmit();
  }, [form, hasInvalidDateRange, onSubmit]);

  const _handleClose = useCallback(() => {
    onOpenChange(false);
    onFormChange(EMPTY_FORM);
  }, [onOpenChange, onFormChange]);

  const title = editingBill ? 'Edytuj cykliczny wydatek' : 'Nowy cykliczny wydatek';

  const groupedTags = tags.reduce<Record<string, ITagOption[]>>((acc, tag) => {
    const group = tag.groupName || 'Inne';

    if (!acc[group]) acc[group] = [];
    acc[group].push(tag);

    return acc;
  }, {});

  return (
    <Dialog open={open} onOpenChange={_handleClose}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="bill-name">Nazwa</Label>
            <Input
              id="bill-name"
              value={form.name}
              onChange={(e) => _updateField('name', e.target.value)}
              placeholder="np. Prąd, Internet, Netflix"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="bill-amount">Kwota (PLN)</Label>
              <Input
                id="bill-amount"
                type="number"
                step="0.01"
                min="0.01"
                value={form.amount}
                onChange={(e) => _updateField('amount', e.target.value)}
                placeholder="0.00"
              />
              {form.amount && Number(form.amount) < 0.01 && (
                <p className="text-xs text-destructive mt-1">Kwota musi wynosić co najmniej 0.01 PLN</p>
              )}
            </div>
            <div>
              <Label htmlFor="bill-dueday">Dzień miesiąca</Label>
              <Input
                id="bill-dueday"
                type="number"
                min="1"
                max="31"
                value={form.dueDay}
                onChange={(e) => _updateField('dueDay', e.target.value)}
                placeholder="15"
              />
            </div>
          </div>
          {hasInvalidDateRange && (
            <p className="text-xs text-destructive">Koniec płatności nie może być wcześniejszy niż początek płatności.</p>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="bill-start-date">Początek płatności</Label>
              <Input
                id="bill-start-date"
                type="date"
                value={form.paymentStartDate}
                onChange={(e) => _updateField('paymentStartDate', e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="bill-end-date">Koniec płatności</Label>
              <Input
                id="bill-end-date"
                type="date"
                value={form.paymentEndDate}
                onChange={(e) => _updateField('paymentEndDate', e.target.value)}
                placeholder="Opcjonalnie"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Częstotliwość</Label>
              <Select
                value={form.frequency}
                onValueChange={(v) => _updateField('frequency', v as Frequency)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(FREQUENCY_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Typ płatności</Label>
              <Select
                value={form.paymentType}
                onValueChange={(v) => _updateField('paymentType', v as PaymentType)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(PAYMENT_TYPE_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {tags.length > 0 && (
            <div>
              <Label>Tagi</Label>
              <div className="mt-1.5 space-y-2">
                {Object.entries(groupedTags).map(([groupName, groupTags]) => (
                  <div key={groupName}>
                    <span className="text-xs font-medium text-muted-foreground">{groupName}</span>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {groupTags.map((tag) => {
                        const isSelected = form.tagIds.includes(tag.id);

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
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="bill-reminder">Przypomnienie (dni przed)</Label>
              <Input
                id="bill-reminder"
                type="number"
                min="0"
                max="30"
                value={form.reminderDays}
                onChange={(e) => _updateField('reminderDays', e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="bill-budget">Limit budżetu (PLN)</Label>
              <Input
                id="bill-budget"
                type="number"
                step="0.01"
                min="0"
                value={form.budgetLimit}
                onChange={(e) => _updateField('budgetLimit', e.target.value)}
                placeholder="Opcjonalnie"
              />
            </div>
          </div>

          {tags.length > 0 && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Tag przed opłaceniem</Label>
                <Select
                  value={form.tagBeforePaymentId || '__none'}
                  onValueChange={(value) => _updateField('tagBeforePaymentId', value === '__none' ? '' : value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Brak" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">Brak</SelectItem>
                    {tags.map((tag) => (
                      <SelectItem key={tag.id} value={tag.id}>
                        {tag.groupName}: {tag.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Tag po opłaceniu</Label>
                <Select
                  value={form.tagAfterPaymentId || '__none'}
                  onValueChange={(value) => _updateField('tagAfterPaymentId', value === '__none' ? '' : value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Brak" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">Brak</SelectItem>
                    {tags.map((tag) => (
                      <SelectItem key={tag.id} value={tag.id}>
                        {tag.groupName}: {tag.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          <div className="flex items-center gap-2">
            <Checkbox
              id="bill-auto-expense"
              checked={form.autoCreateExpense}
              onCheckedChange={(checked) =>
                _updateField('autoCreateExpense', checked === true)
              }
            />
            <Label htmlFor="bill-auto-expense" className="cursor-pointer text-sm font-normal">
              Automatycznie twórz wydatek przy opłaceniu
            </Label>
          </div>

          <div>
            <Label htmlFor="bill-notes">Notatki</Label>
            <Textarea
              id="bill-notes"
              value={form.notes}
              onChange={(e) => _updateField('notes', e.target.value)}
              placeholder="Dodatkowe informacje..."
              className="min-h-20 resize-none"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={_handleClose}>
            Anuluj
          </Button>
          <Button
            onClick={_handleSubmit}
            disabled={
              isSubmitting
              || !form.name
              || !form.amount
              || Number(form.amount) < 0.01
              || !form.dueDay
              || !form.paymentStartDate
              || hasInvalidDateRange
            }
          >
            {isSubmitting ? 'Zapisywanie...' : editingBill ? 'Zapisz zmiany' : 'Dodaj cykliczny wydatek'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
