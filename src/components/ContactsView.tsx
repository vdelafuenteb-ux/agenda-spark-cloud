import { useState, useMemo } from 'react';
import { useContacts, type Contact } from '@/hooks/useContacts';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Label } from '@/components/ui/label';
import { Search, Plus, Pencil, Trash2, Phone, Mail, Building2, Briefcase } from 'lucide-react';
import { toast } from 'sonner';
import { useIsMobile } from '@/hooks/use-mobile';

const emptyForm = { name: '', email: '', phone: '', position: '', company: '' };

export function ContactsView() {
  const { contacts, isLoading, createContact, updateContact, deleteContact } = useContacts();
  const isMobile = useIsMobile();
  const [search, setSearch] = useState('');
  const [selectedCompany, setSelectedCompany] = useState<string>('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const companies = useMemo(() => {
    const set = new Set(contacts.map(c => c.company).filter(Boolean));
    return Array.from(set).sort();
  }, [contacts]);

  const filtered = useMemo(() => {
    let result = contacts;
    if (selectedCompany) {
      result = result.filter(c => c.company === selectedCompany);
    }
    if (!search) return result;
    const q = search.toLowerCase();
    return result.filter(c =>
      c.name.toLowerCase().includes(q) ||
      c.email.toLowerCase().includes(q) ||
      c.company.toLowerCase().includes(q) ||
      c.position.toLowerCase().includes(q) ||
      c.phone.includes(q)
    );
  }, [contacts, search, selectedCompany]);

  const openNew = () => {
    setEditingContact(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (c: Contact) => {
    setEditingContact(c);
    setForm({ name: c.name, email: c.email, phone: c.phone, position: c.position, company: c.company });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('El nombre es obligatorio'); return; }
    try {
      if (editingContact) {
        await updateContact.mutateAsync({ id: editingContact.id, ...form });
        toast.success('Contacto actualizado');
      } else {
        await createContact.mutateAsync(form);
        toast.success('Contacto creado');
      }
      setDialogOpen(false);
    } catch {
      toast.error('Error al guardar contacto');
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteContact.mutateAsync(deleteId);
      toast.success('Contacto eliminado');
    } catch {
      toast.error('Error al eliminar');
    }
    setDeleteId(null);
  };

  return (
    <main className="flex-1 overflow-auto p-3 md:p-4">
      <div className="max-w-6xl mx-auto space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nombre, correo, empresa, cargo..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-8 h-9 text-sm"
            />
          </div>
          <Button size="sm" className="h-9 gap-1" onClick={openNew}>
            <Plus className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Nuevo Contacto</span>
            <span className="sm:hidden">Nuevo</span>
          </Button>
        </div>

        {companies.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            <span className="text-xs text-muted-foreground whitespace-nowrap flex items-center gap-1"><Building2 className="h-3 w-3" />Empresa:</span>
            <Button
              size="sm"
              variant={selectedCompany === '' ? 'default' : 'outline'}
              className="h-7 text-xs px-2.5 rounded-full"
              onClick={() => setSelectedCompany('')}
            >
              Todas
            </Button>
            {companies.map(company => (
              <Button
                key={company}
                size="sm"
                variant={selectedCompany === company ? 'default' : 'outline'}
                className="h-7 text-xs px-2.5 rounded-full whitespace-nowrap"
                onClick={() => setSelectedCompany(prev => prev === company ? '' : company)}
              >
                {company}
              </Button>
            ))}
          </div>
        )}

        {isLoading ? (
          <p className="text-sm text-muted-foreground text-center py-8">Cargando contactos...</p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            {search || selectedCompany ? 'No hay contactos que coincidan.' : 'No hay contactos aún. Crea el primero.'}
          </p>
        ) : isMobile ? (
          <div className="space-y-2">
            {filtered.map(c => (
              <Card key={c.id} className="cursor-pointer" onClick={() => openEdit(c)}>
                <CardContent className="p-3 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm">{c.name}</span>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={e => { e.stopPropagation(); setDeleteId(c.id); }}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                  {c.position && <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><Briefcase className="h-3 w-3" />{c.position}</div>}
                  {c.company && <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><Building2 className="h-3 w-3" />{c.company}</div>}
                  {c.email && <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><Mail className="h-3 w-3" />{c.email}</div>}
                  {c.phone && <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><Phone className="h-3 w-3" />{c.phone}</div>}
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[180px]">Nombre</TableHead>
                  <TableHead>Correo</TableHead>
                  <TableHead className="w-[160px]">Cargo</TableHead>
                  <TableHead className="w-[150px]">Celular</TableHead>
                  <TableHead className="w-[120px]">Empresa</TableHead>
                  <TableHead className="w-[80px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(c => (
                  <TableRow key={c.id} className="cursor-pointer" onClick={() => openEdit(c)}>
                    <TableCell className="font-medium text-sm whitespace-nowrap">{c.name}</TableCell>
                    <TableCell className="text-muted-foreground text-xs truncate max-w-[250px]">{c.email}</TableCell>
                    <TableCell className="text-muted-foreground text-xs truncate max-w-[160px]">{c.position}</TableCell>
                    <TableCell className="text-muted-foreground text-xs whitespace-nowrap">{c.phone}</TableCell>
                    <TableCell className="text-muted-foreground text-xs">{c.company}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={e => { e.stopPropagation(); openEdit(c); }}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={e => { e.stopPropagation(); setDeleteId(c.id); }}>
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingContact ? 'Editar Contacto' : 'Nuevo Contacto'}</DialogTitle>
            <DialogDescription>
              {editingContact ? 'Modifica los datos del contacto.' : 'Ingresa los datos del nuevo contacto.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div><Label>Nombre *</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Nombre completo" /></div>
            <div><Label>Correo</Label><Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="correo@empresa.com" /></div>
            <div><Label>Cargo</Label><Input value={form.position} onChange={e => setForm(f => ({ ...f, position: e.target.value }))} placeholder="Gerente, Director, etc." /></div>
            <div><Label>Celular</Label><Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+56 9 1234 5678" /></div>
            <div><Label>Empresa</Label><Input value={form.company} onChange={e => setForm(f => ({ ...f, company: e.target.value }))} placeholder="Nombre de la empresa" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={createContact.isPending || updateContact.isPending}>
              {editingContact ? 'Guardar' : 'Crear'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={open => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar contacto?</AlertDialogTitle>
            <AlertDialogDescription>Esta acción no se puede deshacer.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}
