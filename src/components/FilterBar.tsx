import { useState } from 'react';
import { Search, X, User, ChevronsDownUp, ChevronsUpDown, Mail, CalendarOff, Infinity as InfinityIcon, ChevronDown, ArrowUpDown, Check, Tag } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuCheckboxItem, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuLabel, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandInput, CommandList, CommandEmpty, CommandItem } from '@/components/ui/command';
import { Badge } from '@/components/ui/badge';
import type { Tag as TagType } from '@/hooks/useTags';

export type SortOption = 'order' | 'priority' | 'due_date' | 'created';

interface FilterBarProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  allTags: TagType[];
  selectedTagIds: string[];
  onToggleTag: (tagId: string) => void;
  assignees?: string[];
  selectedAssignee?: string;
  onAssigneeChange?: (assignee: string) => void;
  forceExpand?: boolean | null;
  onToggleExpand?: () => void;
  onBulkEmail?: () => void;
  filterNoDueDate?: boolean;
  onToggleNoDueDate?: () => void;
  showOngoing?: boolean;
  showNotOngoing?: boolean;
  onToggleShowOngoing?: () => void;
  onToggleShowNotOngoing?: () => void;
  sortBy?: SortOption;
  onSortChange?: (sort: SortOption) => void;
}

export function FilterBar({ searchQuery, onSearchChange, allTags, selectedTagIds, onToggleTag, assignees, selectedAssignee, onAssigneeChange, forceExpand, onToggleExpand, onBulkEmail, filterNoDueDate, onToggleNoDueDate, showOngoing = true, showNotOngoing = true, onToggleShowOngoing, onToggleShowNotOngoing, sortBy = 'order', onSortChange }: FilterBarProps) {
  const hasOngoingFilter = onToggleShowOngoing && onToggleShowNotOngoing;
  const isFiltered = !showOngoing || !showNotOngoing;
  const sortLabels: Record<SortOption, string> = { order: 'Orden', priority: 'Prioridad', due_date: 'Fecha fin', created: 'Creación' };
  const [tagPopoverOpen, setTagPopoverOpen] = useState(false);
  const [assigneePopoverOpen, setAssigneePopoverOpen] = useState(false);

  const selectedTags = allTags.filter(t => selectedTagIds.includes(t.id));

  return (
    <div className="space-y-2">
      {/* Search input + action buttons */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[150px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Buscar temas..."
            value={searchQuery}
            onChange={e => onSearchChange(e.target.value)}
            className="h-9 text-sm pl-8 pr-8"
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Expand/Collapse all */}
        {onToggleExpand && (
          <Button size="sm" variant="outline" className="h-9 text-xs gap-1 shrink-0" onClick={onToggleExpand}>
            {forceExpand ? <ChevronsDownUp className="h-3.5 w-3.5" /> : <ChevronsUpDown className="h-3.5 w-3.5" />}
            <span className="hidden sm:inline">{forceExpand ? 'Contraer' : 'Expandir'}</span>
          </Button>
        )}

        {/* No due date filter */}
        {onToggleNoDueDate && (
          <Button
            size="sm"
            variant={filterNoDueDate ? "default" : "outline"}
            className="h-9 text-xs gap-1 shrink-0"
            onClick={onToggleNoDueDate}
          >
            <CalendarOff className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Sin fecha fin</span>
          </Button>
        )}

        {/* Ongoing filter dropdown */}
        {hasOngoingFilter && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="sm"
                variant={isFiltered ? "default" : "outline"}
                className="h-9 text-xs gap-1 shrink-0"
              >
                <InfinityIcon className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Continuos</span>
                <ChevronDown className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuCheckboxItem checked={showOngoing} onCheckedChange={onToggleShowOngoing}>
                Continuos
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem checked={showNotOngoing} onCheckedChange={onToggleShowNotOngoing}>
                No continuos
              </DropdownMenuCheckboxItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {/* Sort dropdown */}
        {onSortChange && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="outline" className="h-9 text-xs gap-1 shrink-0">
                <ArrowUpDown className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{sortLabels[sortBy]}</span>
                <ChevronDown className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuLabel className="text-[10px] uppercase text-muted-foreground">Ordenar por</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuRadioGroup value={sortBy} onValueChange={(v) => onSortChange(v as SortOption)}>
                <DropdownMenuRadioItem value="order">Orden de ejecución</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="priority">Prioridad</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="due_date">Fecha de vencimiento</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="created">Fecha de creación</DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {/* Tag filter dropdown */}
        {allTags.length > 0 && (
          <Popover open={tagPopoverOpen} onOpenChange={setTagPopoverOpen}>
            <PopoverTrigger asChild>
              <Button size="sm" variant={selectedTagIds.length > 0 ? "default" : "outline"} className="h-9 text-xs gap-1 shrink-0">
                <Tag className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Etiquetas</span>
                {selectedTagIds.length > 0 && (
                  <Badge variant="secondary" className="text-[9px] h-4 px-1 ml-0.5 bg-primary-foreground/20 text-primary-foreground">{selectedTagIds.length}</Badge>
                )}
                <ChevronDown className="h-3 w-3" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[220px] p-0" align="start">
              <Command>
                <CommandInput placeholder="Buscar etiqueta..." className="h-9" />
                <CommandList>
                  <CommandEmpty>No se encontraron etiquetas</CommandEmpty>
                  {allTags.map(tag => {
                    const isSelected = selectedTagIds.includes(tag.id);
                    return (
                      <CommandItem
                        key={tag.id}
                        onSelect={() => onToggleTag(tag.id)}
                        className="flex items-center gap-2 cursor-pointer"
                      >
                        <div className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: tag.color }} />
                        <span className="flex-1 text-sm truncate">{tag.name}</span>
                        {isSelected && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
                      </CommandItem>
                    );
                  })}
                </CommandList>
              </Command>
              {selectedTagIds.length > 0 && (
                <div className="p-1.5 border-t">
                  <Button variant="ghost" size="sm" className="w-full text-xs h-7" onClick={() => { selectedTagIds.forEach(id => onToggleTag(id)); }}>
                    Limpiar filtros
                  </Button>
                </div>
              )}
            </PopoverContent>
          </Popover>
        )}

        {/* Assignee filter dropdown */}
        {assignees && assignees.length > 0 && onAssigneeChange && (
          <Popover open={assigneePopoverOpen} onOpenChange={setAssigneePopoverOpen}>
            <PopoverTrigger asChild>
              <Button size="sm" variant={selectedAssignee ? "default" : "outline"} className="h-9 text-xs gap-1 shrink-0 max-w-[200px]">
                <User className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate hidden sm:inline">{selectedAssignee || 'Responsable'}</span>
                <ChevronDown className="h-3 w-3 shrink-0" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[220px] p-0" align="start">
              <Command>
                <CommandInput placeholder="Buscar responsable..." className="h-9" />
                <CommandList>
                  <CommandEmpty>No se encontraron responsables</CommandEmpty>
                  <CommandItem
                    onSelect={() => { onAssigneeChange(''); setAssigneePopoverOpen(false); }}
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <span className="flex-1 text-sm">Todos</span>
                    {!selectedAssignee && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
                  </CommandItem>
                  {assignees.map(name => (
                    <CommandItem
                      key={name}
                      onSelect={() => { onAssigneeChange(selectedAssignee === name ? '' : name); setAssigneePopoverOpen(false); }}
                      className="flex items-center gap-2 cursor-pointer"
                    >
                      <span className="flex-1 text-sm truncate">{name}</span>
                      {selectedAssignee === name && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
                    </CommandItem>
                  ))}
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        )}

        {/* Bulk email button */}
        {onBulkEmail && selectedAssignee && selectedAssignee !== '_all' && selectedAssignee !== '' && (
          <Button size="sm" variant="outline" className="h-9 text-xs gap-1 shrink-0" onClick={onBulkEmail}>
            <Mail className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Correo masivo</span>
          </Button>
        )}
      </div>

      {/* Active filter badges */}
      {(selectedTags.length > 0 || selectedAssignee) && (
        <div className="flex items-center gap-1.5 flex-wrap">
          {selectedTags.map(tag => (
            <button
              key={tag.id}
              onClick={() => onToggleTag(tag.id)}
              className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium text-white"
              style={{ backgroundColor: tag.color }}
            >
              {tag.name}
              <X className="h-2.5 w-2.5" />
            </button>
          ))}
          {selectedAssignee && onAssigneeChange && (
            <button
              onClick={() => onAssigneeChange('')}
              className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium bg-primary text-primary-foreground"
            >
              <User className="h-2.5 w-2.5" />
              {selectedAssignee}
              <X className="h-2.5 w-2.5" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
