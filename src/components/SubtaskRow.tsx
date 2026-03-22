import { useState } from 'react';
import { formatStoredDate, parseStoredDate, toStoredDate, isStoredDateOverdue } from '@/lib/date';
import { differenceInDays } from 'date-fns';
import { CalendarIcon, Trash2, Eye, Pencil, Check, X, User } from 'lucide-react';
import { es } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ProgressLog } from '@/components/ProgressLog';
import { cn } from '@/lib/utils';
import type { Database } from '@/integrations/supabase/types';
import type { SubtaskEntry } from '@/hooks/useTopics';

type Subtask = Database['public']['Tables']['subtasks']['Row'] & { subtask_entries: SubtaskEntry[] };

interface SubtaskRowProps {
  subtask: Subtask;
  subtaskIsToday: boolean;
  subtaskIsUpcoming?: boolean;
  onToggleSubtask: (id: string, completed: boolean) => void;
  onUpdateSubtask: (id: string, data: Record<string, unknown>) => void;
  onDeleteSubtask: (id: string) => void;
  onAddSubtaskEntry: (subtaskId: string, content: string) => void;
  onUpdateSubtaskEntry?: (id: string, content: string) => void;
  onDeleteSubtaskEntry?: (id: string) => void;
}

export function SubtaskRow({ subtask, subtaskIsToday, subtaskIsUpcoming = false, onToggleSubtask, onUpdateSubtask, onDeleteSubtask, onAddSubtaskEntry, onUpdateSubtaskEntry, onDeleteSubtaskEntry }: SubtaskRowProps) {
  const [detailOpen, setDetailOpen] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(subtask.title);
  const [editingTitleInSheet, setEditingTitleInSheet] = useState(false);
  const [sheetTitleDraft, setSheetTitleDraft] = useState(subtask.title);
  const [contactDraft, setContactDraft] = useState(subtask.contact || '');
  const [responsibleDraft, setResponsibleDraft] = useState(subtask.responsible || '');

  const entries = subtask.subtask_entries || [];
  const hasEntries = entries.length > 0;
  const isOverdue = !subtask.completed && isStoredDateOverdue(subtask.due_date);

  // Last activity from bitácora
  const lastEntry = hasEntries ? entries[entries.length - 1] : null;
  const lastActivityDate = lastEntry ? new Date(lastEntry.created_at) : null;
  const daysSinceActivity = lastActivityDate ? differenceInDays(new Date(), lastActivityDate) : null;
  const isStale = daysSinceActivity !== null && daysSinceActivity > 5;

  const saveTitle = (draft: string) => {
    if (draft.trim() && draft.trim() !== subtask.title) {
      onUpdateSubtask(subtask.id, { title: draft.trim() });
    }
  };

  return (
    <>
      <div className={cn(
        'rounded-md px-1.5 py-1 -mx-1.5 transition-colors',
        subtaskIsToday && 'bg-accent/50 ring-1 ring-accent',
        isOverdue && 'bg-destructive/10 ring-1 ring-destructive/30',
        subtaskIsUpcoming && !isOverdue && 'bg-yellow-500/10 ring-1 ring-yellow-500/30'
      )}>
        <div className="flex items-center gap-2 group">
          <Checkbox
            checked={subtask.completed}
            onCheckedChange={(checked) => onToggleSubtask(subtask.id, !!checked)}
          />
          <div className={cn('flex-1 min-w-0 flex items-center gap-1.5', subtask.completed && 'line-through text-muted-foreground')}>
            {editingTitle ? (
              <input
                value={titleDraft}
                onChange={(e) => setTitleDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    saveTitle(titleDraft);
                    setEditingTitle(false);
                  }
                  if (e.key === 'Escape') {
                    setTitleDraft(subtask.title);
                    setEditingTitle(false);
                  }
                }}
                onBlur={() => {
                  saveTitle(titleDraft);
                  setEditingTitle(false);
                }}
                className="text-sm bg-transparent border-b border-primary outline-none flex-1 min-w-0"
                autoFocus
              />
            ) : (
              <span
                className={cn(
                  'text-sm truncate cursor-pointer hover:underline',
                  isOverdue && 'text-destructive font-medium',
                  subtaskIsUpcoming && !isOverdue && 'text-yellow-700 font-medium'
                )}
                onDoubleClick={() => {
                  setTitleDraft(subtask.title);
                  setEditingTitle(true);
                }}
                title="Doble clic para editar"
              >{subtask.title}</span>
            )}
            {subtaskIsToday && (
              <Badge className="text-[9px] px-1 py-0 bg-primary text-primary-foreground border-transparent shrink-0">Hoy</Badge>
            )}
            {isOverdue && (
              <Badge variant="destructive" className="text-[9px] px-1 py-0 shrink-0">Atrasada</Badge>
            )}
            {subtaskIsUpcoming && !isOverdue && (
              <Badge className="text-[9px] px-1 py-0 bg-yellow-500 text-white border-transparent shrink-0">Próxima</Badge>
            )}
          </div>

          {/* Detail panel trigger */}
          <button
            type="button"
            onClick={() => {
              setSheetTitleDraft(subtask.title);
              setDetailOpen(true);
            }}
            className="flex items-center gap-0.5 text-[10px] transition-colors shrink-0 rounded p-0.5 hover:bg-accent text-muted-foreground hover:text-foreground"
            title="Ver detalle completo"
          >
            <Eye className="h-3.5 w-3.5" />
            {hasEntries && <span className="text-primary font-medium">{entries.length}</span>}
          </button>

          {/* Last activity indicator */}
          {lastActivityDate && !subtask.completed && (
            <span className={cn(
              'text-[10px] whitespace-nowrap shrink-0',
              isStale ? 'text-destructive font-medium' : 'text-muted-foreground'
            )}>
              últ: {formatStoredDate(lastEntry!.created_at.split('T')[0], 'dd MMM', { locale: es })}
              {daysSinceActivity !== null && ` (${daysSinceActivity}d)`}
            </span>
          )}

          {/* Date */}
          <span
            className={cn(
              'flex items-center gap-1 text-[10px] shrink-0',
              isOverdue ? 'text-destructive font-medium' : 'text-muted-foreground'
            )}
          >
            <CalendarIcon className="h-3 w-3" />
            {subtask.due_date ? (
              formatStoredDate(subtask.due_date, 'dd MMM', { locale: es })
            ) : (
              <span>Sin fecha</span>
            )}
          </span>

          <button
            type="button"
            onClick={() => onDeleteSubtask(subtask.id)}
            className="opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <Trash2 className="h-3 w-3 text-muted-foreground hover:text-destructive" />
          </button>
        </div>
      </div>

      {/* Full detail Sheet */}
      <Sheet open={detailOpen} onOpenChange={setDetailOpen}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader className="pb-4">
            <SheetTitle className="text-base font-semibold text-left">Detalle de Subtarea</SheetTitle>
          </SheetHeader>

          <div className="space-y-5">
            {/* Title */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Título</label>
              {editingTitleInSheet ? (
                <div className="flex items-center gap-1.5">
                  <input
                    value={sheetTitleDraft}
                    onChange={(e) => setSheetTitleDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        saveTitle(sheetTitleDraft);
                        setEditingTitleInSheet(false);
                      }
                      if (e.key === 'Escape') {
                        setSheetTitleDraft(subtask.title);
                        setEditingTitleInSheet(false);
                      }
                    }}
                    className="flex-1 text-sm font-medium bg-transparent border-b border-primary outline-none"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => { saveTitle(sheetTitleDraft); setEditingTitleInSheet(false); }}
                    className="p-1 text-emerald-500 hover:text-emerald-600"
                  >
                    <Check className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => { setSheetTitleDraft(subtask.title); setEditingTitleInSheet(false); }}
                    className="p-1 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span className={cn('text-sm font-medium', subtask.completed && 'line-through text-muted-foreground')}>
                    {subtask.title}
                  </span>
                  <button
                    type="button"
                    onClick={() => { setSheetTitleDraft(subtask.title); setEditingTitleInSheet(true); }}
                    className="p-1 text-muted-foreground hover:text-foreground"
                  >
                    <Pencil className="h-3 w-3" />
                  </button>
                </div>
              )}
            </div>

            {/* Status */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Estado</label>
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={subtask.completed}
                  onCheckedChange={(checked) => onToggleSubtask(subtask.id, !!checked)}
                />
                <span className="text-sm">
                  {subtask.completed ? 'Completada' : isOverdue ? 'Atrasada' : 'Pendiente'}
                </span>
                {isOverdue && <Badge variant="destructive" className="text-[9px] px-1 py-0">Atrasada</Badge>}
                {subtask.completed && subtask.completed_at && (
                  <span className="text-[10px] text-muted-foreground">
                    {formatStoredDate(subtask.completed_at.split('T')[0], 'dd MMM yy', { locale: es })}
                  </span>
                )}
              </div>
            </div>

            {/* Date */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Fecha de vencimiento</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5 w-full justify-start">
                    <CalendarIcon className="h-3.5 w-3.5" />
                    {subtask.due_date
                      ? formatStoredDate(subtask.due_date, 'dd MMMM yyyy', { locale: es })
                      : 'Sin fecha — clic para asignar'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={parseStoredDate(subtask.due_date)}
                    onSelect={(date) => onUpdateSubtask(subtask.id, { due_date: toStoredDate(date) })}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Created date */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Creada</label>
              <span className="text-xs text-muted-foreground">
                {formatStoredDate(subtask.created_at.split('T')[0], 'dd MMMM yyyy', { locale: es })}
              </span>
            </div>

            {/* Contact person */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                <User className="h-3 w-3" /> Persona de contacto
              </label>
              <Input
                placeholder="Ej: Juan Pérez"
                value={contactDraft}
                onChange={(e) => setContactDraft(e.target.value)}
                onBlur={() => {
                  if (contactDraft !== (subtask.contact || '')) {
                    onUpdateSubtask(subtask.id, { contact: contactDraft });
                  }
                }}
                className="h-8 text-sm"
              />
            </div>

            {/* Responsible */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                <User className="h-3 w-3" /> Responsable de cerrar
              </label>
              <Input
                placeholder="Ej: María López"
                value={responsibleDraft}
                onChange={(e) => setResponsibleDraft(e.target.value)}
                onBlur={() => {
                  if (responsibleDraft !== ((subtask as any).responsible || '')) {
                    onUpdateSubtask(subtask.id, { responsible: responsibleDraft });
                  }
                }}
                className="h-8 text-sm"
              />
            </div>

            {/* Bitácora */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                Bitácora de avances ({entries.length})
              </label>
              <ProgressLog
                entries={entries}
                onAdd={(content) => onAddSubtaskEntry(subtask.id, content)}
                onUpdate={onUpdateSubtaskEntry ? (id, content) => onUpdateSubtaskEntry(id, content) : undefined}
                onDelete={onDeleteSubtaskEntry}
                hideTitle
              />
            </div>

            {/* Delete */}
            <div className="pt-2 border-t border-border">
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-destructive hover:text-destructive w-full justify-start gap-1.5"
                onClick={() => {
                  onDeleteSubtask(subtask.id);
                  setDetailOpen(false);
                }}
              >
                <Trash2 className="h-3 w-3" /> Eliminar subtarea
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
