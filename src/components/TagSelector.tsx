import { useState } from 'react';
import { Tag, X, Plus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import type { Tag as TagType } from '@/hooks/useTags';

const TAG_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e',
  '#f97316', '#eab308', '#22c55e', '#06b6d4',
  '#3b82f6', '#6b7280',
];

interface TagSelectorProps {
  allTags: TagType[];
  topicTags: TagType[];
  onAddTag: (tagId: string) => void;
  onRemoveTag: (tagId: string) => void;
  onCreateTag: (name: string, color: string) => void;
}

export function TagSelector({ allTags, topicTags, onAddTag, onRemoveTag, onCreateTag }: TagSelectorProps) {
  const [newName, setNewName] = useState('');
  const [selectedColor, setSelectedColor] = useState(TAG_COLORS[0]);
  const [open, setOpen] = useState(false);

  const availableTags = allTags.filter(t => !topicTags.some(tt => tt.id === t.id));

  const handleCreate = () => {
    if (!newName.trim()) return;
    onCreateTag(newName.trim(), selectedColor);
    setNewName('');
  };

  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Etiquetas</p>
      <div className="flex items-center gap-1.5 flex-wrap">
        {topicTags.map(tag => (
          <Badge
            key={tag.id}
            className="text-[10px] px-2 py-0.5 gap-1 border-transparent text-white cursor-default"
            style={{ backgroundColor: tag.color }}
          >
            {tag.name}
            <button onClick={() => onRemoveTag(tag.id)} className="hover:opacity-70">
              <X className="h-2.5 w-2.5" />
            </button>
          </Badge>
        ))}
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
              <Tag className="h-3 w-3" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-60 p-3 space-y-3" align="start">
            {/* Existing tags */}
            {availableTags.length > 0 && (
              <div className="space-y-1">
                <p className="text-[10px] text-muted-foreground uppercase font-medium">Agregar existente</p>
                <div className="flex flex-wrap gap-1">
                  {availableTags.map(tag => (
                    <button
                      key={tag.id}
                      onClick={() => { onAddTag(tag.id); }}
                      className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] text-white transition-opacity hover:opacity-80"
                      style={{ backgroundColor: tag.color }}
                    >
                      {tag.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Create new */}
            <div className="space-y-2 border-t border-border pt-2">
              <p className="text-[10px] text-muted-foreground uppercase font-medium">Crear nueva</p>
              <Input
                placeholder="Nombre..."
                value={newName}
                onChange={e => setNewName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleCreate()}
                className="h-7 text-xs"
              />
              <div className="flex gap-1">
                {TAG_COLORS.map(c => (
                  <button
                    key={c}
                    onClick={() => setSelectedColor(c)}
                    className="h-5 w-5 rounded-full transition-transform"
                    style={{
                      backgroundColor: c,
                      transform: selectedColor === c ? 'scale(1.25)' : 'scale(1)',
                      boxShadow: selectedColor === c ? '0 0 0 2px hsl(var(--background)), 0 0 0 3px ' + c : 'none',
                    }}
                  />
                ))}
              </div>
              <Button size="sm" className="w-full h-7 text-xs" onClick={handleCreate} disabled={!newName.trim()}>
                <Plus className="h-3 w-3 mr-1" /> Crear etiqueta
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}
