import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import type { Tag } from '@/hooks/useTags';

interface FilterBarProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  allTags: Tag[];
  selectedTagIds: string[];
  onToggleTag: (tagId: string) => void;
}

export function FilterBar({ searchQuery, onSearchChange, allTags, selectedTagIds, onToggleTag }: FilterBarProps) {
  return (
    <div className="space-y-2">
      {/* Search input */}
      <div className="relative">
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
