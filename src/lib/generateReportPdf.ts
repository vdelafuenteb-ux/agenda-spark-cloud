import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format, isBefore, addDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { parseStoredDate, formatStoredDate } from '@/lib/date';
import type { TopicWithSubtasks } from '@/hooks/useTopics';
import logoIcon from '@/assets/logo_tt_icon.png';

// --- Corporate Colors (T&Transit purple palette) ---
const PURPLE_900: [number, number, number] = [59, 21, 132];   // Deep purple for headers
const PURPLE_700: [number, number, number] = [109, 40, 217];  // Primary purple
const PURPLE_500: [number, number, number] = [139, 92, 246];  // Medium purple
const PURPLE_100: [number, number, number] = [237, 233, 254]; // Light purple bg
const PURPLE_50: [number, number, number] = [245, 243, 255];  // Very light purple

const SLATE_700: [number, number, number] = [51, 65, 85];
const SLATE_500: [number, number, number] = [100, 116, 139];
const SLATE_200: [number, number, number] = [226, 232, 240];
const SLATE_50: [number, number, number] = [248, 250, 252];
const WHITE: [number, number, number] = [255, 255, 255];
const RED: [number, number, number] = [220, 38, 38];
const AMBER: [number, number, number] = [217, 119, 6];
const GREEN: [number, number, number] = [22, 163, 74];

function getTrafficLight(dueDateStr: string | null | undefined): { label: string; color: [number, number, number] } {
  if (!dueDateStr) return { label: 'Al día', color: GREEN };
  const dueDate = parseStoredDate(dueDateStr);
  if (!dueDate) return { label: 'Al día', color: GREEN };
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dueCopy = new Date(dueDate);
  dueCopy.setHours(0, 0, 0, 0);
  if (isBefore(dueCopy, today)) return { label: 'Atrasado', color: RED };
  if (isBefore(dueCopy, addDays(today, 4))) return { label: 'Próximo', color: AMBER };
  return { label: 'Al día', color: GREEN };
}



export interface PdfOptions {
  topics: TopicWithSubtasks[];
  periodStart: Date;
  periodEnd: Date;
  title?: string;
  authorName?: string;
  authorRole?: string;
  includeCompleted?: boolean;
  includeBitacora?: boolean;
  includeResponsables?: boolean;
}

function drawKpiBox(doc: jsPDF, x: number, y: number, w: number, h: number, value: string, label: string, color: [number, number, number]) {
  doc.setFillColor(...SLATE_50);
  doc.roundedRect(x, y, w, h, 2, 2, 'F');
  doc.setDrawColor(...SLATE_200);
  doc.roundedRect(x, y, w, h, 2, 2, 'S');
  
  // Color accent bar at top
  doc.setFillColor(...color);
  doc.rect(x, y, w, 1.5, 'F');
  
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...color);
  doc.text(value, x + w / 2, y + 12, { align: 'center' });
  
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...SLATE_500);
  doc.text(label, x + w / 2, y + 18, { align: 'center' });
}

function checkPageBreak(doc: jsPDF, y: number, needed: number, margin: number): number {
  if (y + needed > doc.internal.pageSize.getHeight() - 15) {
    doc.addPage();
    return margin;
  }
  return y;
}

export function generateReportPdf(opts: PdfOptions) {
  const { topics, periodStart, periodEnd, title, authorName, authorRole, includeCompleted = true, includeResponsables = true } = opts;
  
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 14;
  const contentW = pageW - margin * 2;
  let y = 0;

  const periodStr = `${format(periodStart, 'dd MMM yyyy', { locale: es })} — ${format(periodEnd, 'dd MMM yyyy', { locale: es })}`;
  const emittedStr = format(new Date(), "dd MMM yyyy 'a las' HH:mm", { locale: es });
  const reportTitle = title || 'Informe Ejecutivo';

  // Classify topics
  const activeTopics = topics.filter(t => t.status === 'activo' || t.status === 'seguimiento');
  const completedTopics = topics.filter(t => t.status === 'completado');
  const pausedTopics = topics.filter(t => t.status === 'pausado');

  // ==========================================
  // HEADER - Corporate purple bar with logo
  // ==========================================
  const headerH = authorName ? 44 : 38;
  doc.setFillColor(...PURPLE_900);
  doc.rect(0, 0, pageW, headerH, 'F');
  
  // Accent line
  doc.setFillColor(...PURPLE_500);
  doc.rect(0, headerH, pageW, 1.5, 'F');

  // Logo in header (right side)
  try {
    const logoSize = 14;
    doc.addImage(logoIcon, 'PNG', pageW - margin - logoSize, (headerH - logoSize) / 2, logoSize, logoSize);
  } catch (e) {
    // Logo loading failed, continue without it
  }

  y = 16;
  doc.setTextColor(...WHITE);
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text(reportTitle, margin, y);
  y += 7;
  
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`Período: ${periodStr}`, margin, y);
  
  if (authorName) {
    y += 5;
    const authorText = authorRole ? `${authorName} — ${authorRole}` : authorName;
    doc.text(authorText, margin, y);
    y += 5;
    doc.setFontSize(7.5);
    doc.setTextColor(180, 190, 210);
    doc.text(`Emitido: ${emittedStr}`, margin, y);
  } else {
    doc.setFontSize(7.5);
    doc.setTextColor(180, 190, 210);
    doc.text(`Emitido: ${emittedStr}`, pageW - margin, y, { align: 'right' });
  }

  y = headerH + 8;
  doc.setTextColor(...PURPLE_900);

  // ==========================================
  // KPIs
  // ==========================================
  const totalSubs = topics.reduce((a, t) => a + t.subtasks.length, 0);
  const doneSubs = topics.reduce((a, t) => a + t.subtasks.filter(s => s.completed).length, 0);
  const pct = totalSubs > 0 ? Math.round((doneSubs / totalSubs) * 100) : 0;
  const delayed = activeTopics.filter(t => getTrafficLight(t.due_date).label === 'Atrasado').length;
  const warning = activeTopics.filter(t => getTrafficLight(t.due_date).label === 'Próximo').length;
  const onTrack = activeTopics.length - delayed - warning;

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('Resumen Ejecutivo', margin, y);
  y += 3;

  // KPI boxes
  const kpiW = (contentW - 12) / 5;
  const kpiH = 22;
  const kpis = [
    { value: String(topics.length), label: 'Temas Totales', color: PURPLE_700 },
    { value: String(onTrack), label: 'Al Día', color: GREEN },
    { value: String(warning), label: 'Próximos', color: AMBER },
    { value: String(delayed), label: 'Atrasados', color: RED },
    { value: `${pct}%`, label: 'Avance Subtareas', color: PURPLE_500 },
  ];

  kpis.forEach((kpi, i) => {
    drawKpiBox(doc, margin + i * (kpiW + 3), y, kpiW, kpiH, kpi.value, kpi.label, kpi.color as [number, number, number]);
  });

  y += kpiH + 6;

  // Narrative summary
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...SLATE_700);
  let narrative = `Durante el período evaluado se gestionaron ${topics.length} temas en total.`;
  if (completedTopics.length > 0) narrative += ` Se completaron ${completedTopics.length} exitosamente.`;
  if (delayed > 0) narrative += ` ${delayed} tema(s) presentan atrasos que requieren atención.`;
  narrative += ` El avance global en subtareas es de ${pct}% (${doneSubs}/${totalSubs}).`;
  
  const narrativeLines = doc.splitTextToSize(narrative, contentW);
  doc.text(narrativeLines, margin, y);
  y += narrativeLines.length * 3.5 + 6;

  // ==========================================
  // LOGROS DEL PERÍODO (Completados)
  // ==========================================
  if (includeCompleted && completedTopics.length > 0) {
    y = checkPageBreak(doc, y, 20, 20);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...PURPLE_900);
    doc.text('Logros del Período', margin, y);
    y += 2;

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [['Tema Completado', 'Responsable', 'Fecha Cierre', 'Último Comentario']],
      body: completedTopics.map(t => {
        const closeDateStr = formatStoredDate(t.updated_at, 'dd MMM yyyy', { locale: es });
        const lastEntry = t.progress_entries.length > 0
          ? t.progress_entries[t.progress_entries.length - 1].content
          : '—';
        const truncated = lastEntry.length > 80 ? lastEntry.substring(0, 77) + '...' : lastEntry;
        return [
          t.title,
          t.assignee || 'Yo',
          closeDateStr,
          truncated,
        ];
      }),
      styles: { fontSize: 7.5, cellPadding: 2.5, overflow: 'linebreak' },
      headStyles: { fillColor: GREEN as any, textColor: 255, fontStyle: 'bold', fontSize: 7.5 },
      alternateRowStyles: { fillColor: SLATE_50 as any },
      columnStyles: {
        0: { cellWidth: 45 },
        1: { cellWidth: 28 },
        2: { cellWidth: 25 },
        3: { cellWidth: 'auto' },
      },
    });
    y = (doc as any).lastAutoTable.finalY + 8;
  }

  // ==========================================
  // TEMAS ACTIVOS (activo + seguimiento)
  // ==========================================
  if (activeTopics.length > 0) {
    y = checkPageBreak(doc, y, 20, 20);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...PURPLE_900);
    doc.text('Temas Activos', margin, y);
    y += 2;

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [['Tema', 'Responsable', 'Prioridad', 'Estado', 'Fecha Cierre', 'Progreso']],
      body: activeTopics.map(t => {
        const tl = getTrafficLight(t.due_date);
        const done = t.subtasks.filter(s => s.completed).length;
        const total = t.subtasks.length;
        const dueStr = t.due_date ? formatStoredDate(t.due_date, 'dd MMM yyyy', { locale: es }) : '—';
        return [
          t.title,
          t.assignee || 'Yo',
          t.priority.charAt(0).toUpperCase() + t.priority.slice(1),
          tl.label,
          dueStr,
          total > 0 ? `${done}/${total}` : '—',
        ];
      }),
      styles: { fontSize: 7.5, cellPadding: 2.5 },
      headStyles: { fillColor: PURPLE_900 as any, textColor: 255, fontStyle: 'bold', fontSize: 7.5 },
      alternateRowStyles: { fillColor: SLATE_50 as any },
      columnStyles: {
        0: { cellWidth: 'auto' },
        3: { cellWidth: 22 },
        5: { cellWidth: 18 },
      },
      didParseCell: (data) => {
        if (data.section === 'body' && data.column.index === 3) {
          const val = data.cell.raw as string;
          if (val === 'Atrasado') data.cell.styles.textColor = RED as any;
          else if (val === 'Próximo') data.cell.styles.textColor = AMBER as any;
          else data.cell.styles.textColor = GREEN as any;
          data.cell.styles.fontStyle = 'bold';
        }
      },
    });
    y = (doc as any).lastAutoTable.finalY + 8;
  }

  // ==========================================
  // TEMAS EN PAUSA
  // ==========================================
  if (pausedTopics.length > 0) {
    y = checkPageBreak(doc, y, 20, 20);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...PURPLE_900);
    doc.text('Temas en Pausa', margin, y);
    y += 2;

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [['Tema', 'Responsable', 'Prioridad', 'Último Comentario']],
      body: pausedTopics.map(t => {
        const lastEntry = t.progress_entries.length > 0
          ? t.progress_entries[t.progress_entries.length - 1].content
          : '—';
        const truncated = lastEntry.length > 80 ? lastEntry.substring(0, 77) + '...' : lastEntry;
        return [
          t.title,
          t.assignee || 'Yo',
          t.priority.charAt(0).toUpperCase() + t.priority.slice(1),
          truncated,
        ];
      }),
      styles: { fontSize: 7.5, cellPadding: 2.5, overflow: 'linebreak' },
      headStyles: { fillColor: SLATE_500 as any, textColor: 255, fontStyle: 'bold', fontSize: 7.5 },
      alternateRowStyles: { fillColor: SLATE_50 as any },
      columnStyles: {
        0: { cellWidth: 45 },
        3: { cellWidth: 'auto' },
      },
    });
    y = (doc as any).lastAutoTable.finalY + 8;
  }

  // ==========================================
  // RESUMEN POR RESPONSABLE
  // ==========================================
  if (includeResponsables) {
    const assigneeMap = new Map<string, TopicWithSubtasks[]>();
    topics.forEach(t => {
      const key = t.assignee || 'Yo';
      if (!assigneeMap.has(key)) assigneeMap.set(key, []);
      assigneeMap.get(key)!.push(t);
    });

    if (assigneeMap.size > 0) {
      y = checkPageBreak(doc, y, 20, 20);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...PURPLE_900);
      doc.text('Resumen por Responsable', margin, y);
      y += 2;

      autoTable(doc, {
        startY: y,
        margin: { left: margin, right: margin },
        head: [['Responsable', 'Temas', 'Activos', 'Completados', 'Atrasados']],
        body: Array.from(assigneeMap.entries()).map(([name, tList]) => {
          const active = tList.filter(t => t.status === 'activo' || t.status === 'seguimiento').length;
          const completed = tList.filter(t => t.status === 'completado').length;
          const overdue = tList.filter(t => getTrafficLight(t.due_date).label === 'Atrasado').length;
          return [name, String(tList.length), String(active), String(completed), String(overdue)];
        }),
        styles: { fontSize: 7.5, cellPadding: 2.5 },
        headStyles: { fillColor: PURPLE_700 as any, textColor: 255, fontStyle: 'bold', fontSize: 7.5 },
        alternateRowStyles: { fillColor: SLATE_50 as any },
        didParseCell: (data) => {
          if (data.section === 'body' && data.column.index === 4) {
            const val = parseInt(data.cell.raw as string);
            if (val > 0) {
              data.cell.styles.textColor = RED as any;
              data.cell.styles.fontStyle = 'bold';
            }
          }
        },
      });
      y = (doc as any).lastAutoTable.finalY + 8;
    }
  }

  // ==========================================
  // FOOTER
  // ==========================================
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    const pageH = doc.internal.pageSize.getHeight();
    
    // Bottom accent line (purple)
    doc.setFillColor(...PURPLE_500);
    doc.rect(0, pageH - 12, pageW, 0.5, 'F');
    
    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...SLATE_500);
    doc.text(`Generado automáticamente — ${emittedStr}`, margin, pageH - 6);
    doc.text(`Página ${i} de ${totalPages}`, pageW - margin, pageH - 6, { align: 'right' });
  }

  return doc;
}

export function downloadReportPdf(options: PdfOptions) {
  const doc = generateReportPdf(options);
  const fileName = `informe_${format(options.periodStart, 'yyyyMMdd')}_${format(options.periodEnd, 'yyyyMMdd')}.pdf`;
  doc.save(fileName);
}

export function downloadPdfFromContent(content: string, title: string, periodStart: string, periodEnd: string) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 14;
  let y = 20;

  // Header
  doc.setFillColor(...PURPLE_900);
  doc.rect(0, 0, pageW, 32, 'F');
  doc.setFillColor(...PURPLE_500);
  doc.rect(0, 32, pageW, 1.5, 'F');
  try { doc.addImage(logoIcon, 'PNG', pageW - margin - 10, 6, 10, 10); } catch {}
  
  doc.setTextColor(...WHITE);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(title, margin, y);
  y = 40;

  doc.setTextColor(...PURPLE_900);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');

  const lines = doc.splitTextToSize(content, pageW - margin * 2);
  lines.forEach((line: string) => {
    if (y > doc.internal.pageSize.getHeight() - 15) {
      doc.addPage();
      y = 20;
    }
    if (line.startsWith('# ') || line.startsWith('## ') || line.startsWith('### ')) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(line.startsWith('# ') ? 14 : line.startsWith('## ') ? 11 : 9);
      doc.text(line.replace(/^#+\s/, ''), margin, y);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      y += 6;
    } else {
      doc.text(line, margin, y);
      y += 4;
    }
  });

  const fileName = `informe_${periodStart.replace(/-/g, '')}_${periodEnd.replace(/-/g, '')}.pdf`;
  doc.save(fileName);
}
