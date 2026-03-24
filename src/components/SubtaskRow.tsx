import { useState } from 'react';
import { formatStoredDate, parseStoredDate, toStoredDate, isStoredDateOverdue } from '@/lib/date';
import { differenceInDays } from 'date-fns';
import { CalendarIcon, Trash2, Eye, Pencil, Check, X, UserPlus, Mail } from 'lucide-react';
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
import type { SubtaskEntry, SubtaskContact } from '@/hooks/useTopics';

type Subtask = Database['public']['Tables']['subtasks']['Row'] & { subtask_entries: SubtaskEntry[]; subtask_contacts: SubtaskContact[] };

interface SubtaskRowProps {
  subtask: Subtask;
  subtaskIsToday: boolean;
  subtaskIsUpcoming?: boolean;
  onToggleSubtask: (id: string, completed: boolean) => void;
  onUpdateSubtask: (id: string, data: Record<string, unknown>) => void;
  onDeleteSubtask: (id: string) => void;
  onAddSubtaskEntry: (subtaskId: string, content: string) => Promise<string>;
  onUpdateSubtaskEntry?: (id: string, content: string) => void;
  onDeleteSubtaskEntry?: (id: string) => void;
  onAddSubtaskContact?: (subtaskId: string, name: string, email: string) => void;
  onUpdateSubtaskContact?: (id: string, name?: string, email?: string) => void;
  onDeleteSubtaskContact?: (id: string) => void;
  onUploadFiles?: (entryId: string, files: File[]) => void;
  onDeleteAttachment?: (id: string, fileUrl: string) => void;
}

export function SubtaskRow({ subtask, subtaskIsToday, subtaskIsUpcoming = false, onToggleSubtask, onUpdateSubtask, onDeleteSubtask, onAddSubtaskEntry, onUpdateSubtaskEntry, onDeleteSubtaskEntry, onAddSubtaskContact, onUpdateSubtaskContact, onDeleteSubtaskContact, onUploadFiles, onDeleteAttachment }: SubtaskRowProps) {
  const [detailOpen, setDetailOpen] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(subtask.title);
  const [editingTitleInSheet, setEditingTitleInSheet] = useState(false);
  const [sheetTitleDraft, setSheetTitleDraft] = useState(subtask.title);
  const [newContactName, setNewContactName] = useState('');
  const [newContactEmail, setNewContactEmail] = useState('');

  const entries = subtask.subtask_entries || [];
  const contacts = subtask.subtask_contacts || [];
  const hasEntries = entries.length > 0;
  const isOverdue = !subtask.completed && isStoredDateOverdue(subtask.due_date);

  const lastEntry = hasEntries ? entries[entries.length - 1] : null;
  const lastActivityDate = lastEntry ? new Date(lastEntry.created_at) : null;
  const daysSinceActivity = lastActivityDate ? differenceInDays(new Date(), lastActivityDate) : null;
  const isStale = daysSinceActivity !== null && daysSinceActivity > 5;

  const saveTitle = (draft: string) => {
    if (draft.trim() && draft.trim() !== subtask.title) {
      onUpdateSubtask(subtask.id, { title: draft.trim() });
    }
  };

  const handleAddContact = () => {
    if ((newContactName.trim() || newContactEmail.trim()) && onAddSubtaskContact) {
      onAddSubtaskContact(subtask.id, newContactName.trim(), newContactEmail.trim());
      setNewContactName('');
      setNewContactEmail('');
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
                  if (e.key === 'Enter') { saveTitle(titleDraft); setEditingTitle(false); }
                  if (e.key === 'Escape') { setTitleDraft(subtask.title); setEditingTitle(false); }
                }}
                onBlur={() => { saveTitle(titleDraft); setEditingTitle(false); }}
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
                onDoubleClick={() => { setTitleDraft(subtask.title); setEditingTitle(true); }}
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

          <button
            type="button"
            onClick={() => { setSheetTitleDraft(subtask.title); setDetailOpen(true); }}
            className="flex items-center gap-0.5 text-[10px] transition-colors shrink-0 rounded p-0.5 hover:bg-accent text-muted-foreground hover:text-foreground"
            title="Ver detalle completo"
          >
            <Eye className="h-3.5 w-3.5" />
            {hasEntries && <span className="text-primary font-medium">{entries.length}</span>}
          </button>

          {lastActivityDate && !subtask.completed && (
            <span className={cn(
              'text-[10px] whitespace-nowrap shrink-0 hidden sm:inline',
              isStale ? 'text-destructive font-medium' : 'text-muted-foreground'
            )}>
              últ: {formatStoredDate(lastEntry!.created_at.split('T')[0], 'dd MMM', { locale: es })}
              {daysSinceActivity !== null && ` (${daysSinceActivity}d)`}
            </span>
          )}

          {subtask.completed && subtask.completed_at ? (
            <span className="flex items-center gap-1 text-[10px] shrink-0 text-emerald-600 font-medium">
              <Check className="h-3 w-3" />
              {formatStoredDate(subtask.completed_at.split('T')[0], 'dd MMM', { locale: es })}
            </span>
          ) : (
            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  onClick={(e) => e.stopPropagation()}
                  className={cn(
                    'flex items-center gap-1 text-[10px] shrink-0 rounded px-1 py-0.5 hover:bg-accent transition-colors cursor-pointer',
                    isOverdue ? 'text-destructive font-medium' : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  <CalendarIcon className="h-3 w-3" />
                  {subtask.due_date ? formatStoredDate(subtask.due_date, 'dd MMM', { locale: es }) : <span>Sin fecha</span>}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end" onClick={(e) => e.stopPropagation()}>
                <Calendar
                  mode="single"
                  selected={subtask.due_date ? parseStoredDate(subtask.due_date) : undefined}
                  onSelect={(date) => {
                    onUpdateSubtask(subtask.id, { due_date: date ? toStoredDate(date) : null });
                  }}
                  initialFocus
                  className="pointer-events-auto"
                />
                {subtask.due_date && (
                  <div className="p-2 border-t">
                    <Button variant="ghost" size="sm" className="w-full text-xs text-destructive" onClick={() => onUpdateSubtask(subtask.id, { due_date: null })}>
                      Quitar fecha
                    </Button>
                  </div>
                )}
              </PopoverContent>
            </Popover>
          )}

          <button type="button" onClick={() => onDeleteSubtask(subtask.id)} className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
            <Trash2 className="h-3 w-3 text-muted-foreground hover:text-destructive" />
          </button>
        </div>
      </div>

      <Sheet open={detailOpen} onOpenChange={setDetailOpen}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader className="pb-4">
            <SheetTitle className="text-base font-semibold text-left">Detalle de Subtarea</SheetTitle>
          </SheetHeader>

          <div className="space-y-3">
            {/* Title */}
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Título</label>
              {editingTitleInSheet ? (
                <div className="flex items-center gap-1.5">
                  <input
                    value={sheetTitleDraft}
                    onChange={(e) => setSheetTitleDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') { saveTitle(sheetTitleDraft); setEditingTitleInSheet(false); }
                      if (e.key === 'Escape') { setSheetTitleDraft(subtask.title); setEditingTitleInSheet(false); }
                    }}
                    className="flex-1 text-sm font-medium bg-transparent border-b border-primary outline-none"
                    autoFocus
                  />
                  <button type="button" onClick={() => { saveTitle(sheetTitleDraft); setEditingTitleInSheet(false); }} className="p-1 text-emerald-500 hover:text-emerald-600">
                    <Check className="h-3.5 w-3.5" />
                  </button>
                  <button type="button" onClick={() => { setSheetTitleDraft(subtask.title); setEditingTitleInSheet(false); }} className="p-1 text-muted-foreground hover:text-foreground">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span className={cn('text-sm font-medium', subtask.completed && 'line-through text-muted-foreground')}>
                    {subtask.title}
                  </span>
                  <button type="button" onClick={() => { setSheetTitleDraft(subtask.title); setEditingTitleInSheet(true); }} className="p-1 text-muted-foreground hover:text-foreground">
                    <Pencil className="h-3 w-3" />
                  </button>
                </div>
              )}
            </div>

            {/* Status + Date + Closed row */}
            <div className={cn("grid gap-3", subtask.completed ? "grid-cols-3" : "grid-cols-2")}>
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Estado</label>
                <div className="flex items-center gap-2">
                  <Checkbox checked={subtask.completed} onCheckedChange={(checked) => onToggleSubtask(subtask.id, !!checked)} />
                  <span className="text-xs">{subtask.completed ? 'Completada' : isOverdue ? 'Atrasada' : 'Pendiente'}</span>
                  {isOverdue && <Badge variant="destructive" className="text-[9px] px-1 py-0">Atrasada</Badge>}
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Vencimiento</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="h-7 text-[11px] gap-1 w-full justify-start px-2">
                      <CalendarIcon className="h-3 w-3" />
                      {subtask.due_date ? formatStoredDate(subtask.due_date, 'dd MMM yyyy', { locale: es }) : 'Sin fecha'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={parseStoredDate(subtask.due_date)} onSelect={(date) => onUpdateSubtask(subtask.id, { due_date: toStoredDate(date) })} initialFocus />
                  </PopoverContent>
                </Popover>
              </div>
              {subtask.completed && subtask.completed_at && (
                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Cerrada</label>
                  <div className="flex items-center gap-1 h-7 text-[11px] text-emerald-600 font-medium px-2 border rounded-md border-emerald-200 bg-emerald-50">
                    <Check className="h-3 w-3" />
                    {formatStoredDate(subtask.completed_at.split('T')[0], 'dd MMM yyyy', { locale: es })}
                  </div>
                </div>
              )}
            </div>

            {/* Contacts section */}
            <div className="space-y-2">
              <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                <Mail className="h-3 w-3" /> Contactos de seguimiento ({contacts.length})
              </label>

              {contacts.map((contact) => (
                <ContactRow
                  key={contact.id}
                  contact={contact}
                  onUpdate={onUpdateSubtaskContact}
                  onDelete={onDeleteSubtaskContact}
                />
              ))}

              {/* Add new contact */}
              <div className="flex gap-1.5 items-end">
                <div className="flex-1 space-y-0.5">
                  <span className="text-[10px] text-muted-foreground">Nombre</span>
                  <Input
                    placeholder="Ej: Juan Pérez"
                    value={newContactName}
                    onChange={(e) => setNewContactName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleAddContact(); }}
                    className="h-7 text-xs"
                  />
                </div>
                <div className="flex-1 space-y-0.5">
                  <span className="text-[10px] text-muted-foreground">Email</span>
                  <Input
                    placeholder="correo@ejemplo.com"
                    value={newContactEmail}
                    onChange={(e) => setNewContactEmail(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleAddContact(); }}
                    className="h-7 text-xs"
                  />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 px-2 shrink-0"
                  onClick={handleAddContact}
                  disabled={!newContactName.trim() && !newContactEmail.trim()}
                >
                  <UserPlus className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            {/* Created date */}
            <p className="text-[10px] text-muted-foreground">
              Creada: {formatStoredDate(subtask.created_at.split('T')[0], 'dd MMMM yyyy', { locale: es })}
            </p>

            {/* Bitácora */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                Bitácora de avances ({entries.length})
              </label>
              <ProgressLog
                entries={entries}
                onAdd={async (content) => {
                  const id = await onAddSubtaskEntry(subtask.id, content);
                  return id;
                }}
                onUpdate={onUpdateSubtaskEntry ? (id, content) => onUpdateSubtaskEntry(id, content) : undefined}
                onDelete={onDeleteSubtaskEntry}
                onUploadFiles={onUploadFiles}
                onDeleteAttachment={onDeleteAttachment}
                hideTitle
              />
            </div>

            {/* Delete */}
            <div className="pt-2 border-t border-border">
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-destructive hover:text-destructive w-full justify-start gap-1.5"
                onClick={() => { onDeleteSubtask(subtask.id); setDetailOpen(false); }}
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

function ContactRow({ contact, onUpdate, onDelete }: {
  contact: SubtaskContact;
  onUpdate?: (id: string, name?: string, email?: string) => void;
  onDelete?: (id: string) => void;
}) {
  const [nameDraft, setNameDraft] = useState(contact.name);
  const [emailDraft, setEmailDraft] = useState(contact.email);

  return (
    <div className="flex gap-1.5 items-center bg-accent/30 rounded-md px-2 py-1.5 group/contact">
      <div className="flex-1 min-w-0">
        <input
          value={nameDraft}
          onChange={(e) => setNameDraft(e.target.value)}
          onBlur={() => { if (nameDraft !== contact.name && onUpdate) onUpdate(contact.id, nameDraft); }}
          className="text-xs font-medium bg-transparent outline-none w-full truncate"
          placeholder="Nombre"
        />
        <input
          value={emailDraft}
          onChange={(e) => setEmailDraft(e.target.value)}
          onBlur={() => { if (emailDraft !== contact.email && onUpdate) onUpdate(contact.id, undefined, emailDraft); }}
          className="text-[11px] text-muted-foreground bg-transparent outline-none w-full truncate"
          placeholder="correo@ejemplo.com"
        />
      </div>
      {onDelete && (
        <button
          type="button"
          onClick={() => onDelete(contact.id)}
          className="opacity-0 group-hover/contact:opacity-100 transition-opacity shrink-0"
        >
          <X className="h-3 w-3 text-muted-foreground hover:text-destructive" />
        </button>
      )}
    </div>
  );
}
