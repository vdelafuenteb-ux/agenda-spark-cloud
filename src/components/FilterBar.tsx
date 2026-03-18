import { Search, X, User, ChevronsDownUp, ChevronsUpDown, Mail } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { Tag } from '@/hooks/useTags';

interface FilterBarProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  allTags: Tag[];
  selectedTagIds: string[];
  onToggleTag: (tagId: string) => void;
  assignees?: string[];
  selectedAssignee?: string;
  onAssigneeChange?: (assignee: string) => void;
  forceExpand?: boolean | null;
  onToggleExpand?: () => void;
  onBulkEmail?: () => void;
}

export function FilterBar({ searchQuery, onSearchChange, allTags, selectedTagIds, onToggleTag, assignees, selectedAssignee, onAssigneeChange, forceExpand, onToggleExpand }: FilterBarProps) {
  return (
    <div className="space-y-2">
      {/* Search input */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
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
            {forceExpand ? 'Contraer' : 'Expandir'}
          </Button>
        )}

        {/* Assignee filter */}
        {assignees && assignees.length > 0 && onAssigneeChange && (
          <Select value={selectedAssignee || '_all'} onValueChange={(v) => onAssigneeChange(v === '_all' ? '' : v)}>
            <SelectTrigger className="w-44 h-9 text-xs gap-1">
              <User className="h-3 w-3 shrink-0" />
              <SelectValue placeholder="Responsable" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_all">Todos los responsables</SelectItem>
              {assignees.map((name) => (
                <SelectItem key={name} value={name}>{name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Tag chips */}
      {allTags.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mr-1">Filtrar por etiqueta:</span>
          {allTags.map(tag => {
            const isSelected = selectedTagIds.includes(tag.id);
            return (
              <button
                key={tag.id}
                onClick={() => onToggleTag(tag.id)}
                className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium transition-all"
                style={{
                  backgroundColor: isSelected ? tag.color : 'transparent',
                  color: isSelected ? '#fff' : tag.color,
                  border: `1.5px solid ${tag.color}`,
                  opacity: isSelected ? 1 : 0.7,
                }}
              >
                {tag.name}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
