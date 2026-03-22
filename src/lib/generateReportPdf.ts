import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format, isBefore, addDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { parseStoredDate, formatStoredDate } from '@/lib/date';
import type { TopicWithSubtasks } from '@/hooks/useTopics';
import logoIcon from '@/assets/logo_tt_icon.png';

// --- Executive palette: minimal, professional ---
const PURPLE_900: [number, number, number] = [59, 21, 132];
const PURPLE_700: [number, number, number] = [109, 40, 217];
const PURPLE_500: [number, number, number] = [139, 92, 246];

const SLATE_800: [number, number, number] = [30, 41, 59];
const SLATE_700: [number, number, number] = [51, 65, 85];
const SLATE_500: [number, number, number] = [100, 116, 139];
const SLATE_300: [number, number, number] = [203, 213, 225];
const SLATE_200: [number, number, number] = [226, 232, 240];
const SLATE_100: [number, number, number] = [241, 245, 249];
const SLATE_50: [number, number, number] = [248, 250, 252];
const WHITE: [number, number, number] = [255, 255, 255];
const RED: [number, number, number] = [220, 38, 38];
const AMBER: [number, number, number] = [217, 119, 6];
const GREEN: [number, number, number] = [22, 163, 74];

function getTrafficLight(dueDateStr: string | null | undefined): { label: string; color: [number, number, number] } {
  if (!dueDateStr) return { label: 'Al dia', color: GREEN };
  const dueDate = parseStoredDate(dueDateStr);
  if (!dueDate) return { label: 'Al dia', color: GREEN };
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dueCopy = new Date(dueDate);
  dueCopy.setHours(0, 0, 0, 0);
  if (isBefore(dueCopy, today)) return { label: 'Atrasado', color: RED };
  if (isBefore(dueCopy, addDays(today, 4))) return { label: 'Proximo', color: AMBER };
  return { label: 'Al dia', color: GREEN };
}

interface DeptGroup {
  deptName: string;
  topics: TopicWithSubtasks[];
}

function groupByDepartment(
  topics: TopicWithSubtasks[],
  departments?: { id: string; name: string }[],
  defaultOwner: string = 'Yo'
): DeptGroup[] {
  const deptMap = new Map<string, string>();
  (departments || []).forEach(d => deptMap.set(d.id, d.name));

  const groups = new Map<string, TopicWithSubtasks[]>();
  topics.forEach(t => {
    const deptName = t.department_id ? (deptMap.get(t.department_id) || 'Sin Departamento') : 'Sin Departamento';
    if (!groups.has(deptName)) groups.set(deptName, []);
    groups.get(deptName)!.push(t);
  });

  groups.forEach(list => list.sort((a, b) => (a.assignee || defaultOwner).localeCompare(b.assignee || defaultOwner)));

  const sorted = Array.from(groups.entries()).sort(([a], [b]) => {
    if (a === 'Sin Departamento') return 1;
    if (b === 'Sin Departamento') return -1;
    return a.localeCompare(b);
  });

  return sorted.map(([deptName, topics]) => ({ deptName, topics }));
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
  departments?: { id: string; name: string }[];
  subtaskFilter?: Record<string, string[]>;
}

function drawKpiBox(doc: jsPDF, x: number, y: number, w: number, h: number, value: string, label: string, color: [number, number, number]) {
  doc.setFillColor(...SLATE_50);
  doc.roundedRect(x, y, w, h, 2, 2, 'F');
  doc.setDrawColor(...SLATE_200);
  doc.roundedRect(x, y, w, h, 2, 2, 'S');

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

/** Build rows for a department group: topic rows + indented subtask rows */
function buildIntegratedRows(
  topics: TopicWithSubtasks[],
  columnsMode: 'active' | 'completed' | 'paused',
  ownerName: string = 'Yo',
  groupIndex: number = 1,
  subtaskFilter?: Record<string, string[]>
): { body: string[][]; subtaskRowIndices: Set<number> } {
  const body: string[][] = [];
  const subtaskRowIndices = new Set<number>();

  for (let ti = 0; ti < topics.length; ti++) {
    const t = topics[ti];
    const topicNum = `${groupIndex}.${ti + 1}`;
    const lastEntry = t.progress_entries.length > 0
      ? t.progress_entries[t.progress_entries.length - 1].content
      : '';

    if (columnsMode === 'active') {
      const tl = getTrafficLight(t.due_date);
      const fSubs = subtaskFilter && subtaskFilter[t.id]
        ? t.subtasks.filter(s => subtaskFilter[t.id].includes(s.id))
        : t.subtasks;
      const done = fSubs.filter(s => s.completed).length;
      const total = fSubs.length;
      const dueStr = t.due_date ? formatStoredDate(t.due_date, 'dd MMM yyyy', { locale: es }) : '';
      body.push([
        `${topicNum}  ${t.title}`,
        t.assignee || ownerName,
        t.priority.charAt(0).toUpperCase() + t.priority.slice(1),
        tl.label,
        dueStr,
        total > 0 ? `${done}/${total}` : '',
        lastEntry,
      ]);
    } else if (columnsMode === 'completed') {
      const closeDateStr = t.updated_at ? format(new Date(t.updated_at), 'dd MMM yyyy', { locale: es }) : '';
      body.push([`${topicNum}  ${t.title}`, t.assignee || ownerName, closeDateStr, '✓', lastEntry]);
    } else {
      const pauseReason = t.pause_reason || '';
      const pausedAt = t.paused_at ? format(new Date(t.paused_at), 'dd MMM yyyy', { locale: es }) : '';
      body.push([`${topicNum}  ${t.title}`, t.assignee || ownerName, pauseReason, pausedAt]);
    }

    // Filter subtasks if subtaskFilter is provided
    const filteredSubtasks = subtaskFilter && subtaskFilter[t.id]
      ? t.subtasks.filter(s => subtaskFilter[t.id].includes(s.id))
      : t.subtasks;

    // Add subtask rows indented
    for (let si = 0; si < filteredSubtasks.length; si++) {
      const s = filteredSubtasks[si];
      const subNum = `${topicNum}.${si + 1}`;
      const idx = body.length;
      subtaskRowIndices.add(idx);
      const status = s.completed ? '✓' : 'Pendiente';
      const dueStr = s.due_date ? formatStoredDate(s.due_date, 'dd MMM yyyy', { locale: es }) : '';
      const lastSubEntry = s.subtask_entries && s.subtask_entries.length > 0
        ? s.subtask_entries[s.subtask_entries.length - 1].content
        : '';

      if (columnsMode === 'active') {
        body.push([`  ${subNum}  ${s.title}`, s.responsible || '', '', status, dueStr, '', lastSubEntry]);
      } else if (columnsMode === 'completed') {
        body.push([`  ${subNum}  ${s.title}`, s.responsible || '', dueStr, '✓', lastSubEntry]);
      } else {
        body.push([`  ${subNum}  ${s.title}`, s.responsible || '', '', dueStr]);
      }
    }
  }

  return { body, subtaskRowIndices };
}

/** Draw a chapter-style department heading */
function drawChapterHeading(doc: jsPDF, label: string, y: number, margin: number, contentW: number): number {
  y = checkPageBreak(doc, y, 14, margin);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...SLATE_800);
  doc.text(label, margin, y);
  y += 1.5;
  doc.setDrawColor(...SLATE_300);
  doc.setLineWidth(0.3);
  doc.line(margin, y, margin + contentW, y);
  y += 4;
  return y;
}

export function generateReportPdf(opts: PdfOptions) {
  const { topics, periodStart, periodEnd, title, authorName, authorRole, includeCompleted = true, includeResponsables = true, departments, subtaskFilter } = opts;
  const ownerName = authorName || 'Yo';

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 14;
  const contentW = pageW - margin * 2;
  let y = 0;

  const periodStr = `${format(periodStart, 'dd MMM yyyy', { locale: es })} — ${format(periodEnd, 'dd MMM yyyy', { locale: es })}`;
  const emittedStr = format(new Date(), "dd MMM yyyy 'a las' HH:mm", { locale: es });
  const reportTitle = title || 'Informe Ejecutivo';

  const activeTopics = topics.filter(t => t.status === 'activo' || t.status === 'seguimiento');
  const completedTopics = topics.filter(t => t.status === 'completado');
  const pausedTopics = topics.filter(t => t.status === 'pausado');

  // ==========================================
  // HEADER - Clean, no background
  // ==========================================
  y = 14;

  // Logo on the left
  try {
    const logoSize = 10;
    doc.addImage(logoIcon, 'PNG', margin, y - 4, logoSize, logoSize);
  } catch (_e) {}

  // Title centered
  doc.setTextColor(...SLATE_800);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text(`${reportTitle} T&Transit`, pageW / 2, y, { align: 'center' });
  y += 6;

  // Period centered
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...SLATE_500);
  doc.text(`Periodo: ${periodStr}`, pageW / 2, y, { align: 'center' });

  if (authorName) {
    y += 4.5;
    const authorText = authorRole ? `${authorName} — ${authorRole}` : authorName;
    doc.text(authorText, pageW / 2, y, { align: 'center' });
  }

  y += 4.5;
  doc.setFontSize(7);
  doc.setTextColor(...SLATE_300);
  doc.text(`Emitido: ${emittedStr}`, pageW / 2, y, { align: 'center' });

  // Thin separator line
  y += 3;
  doc.setDrawColor(...SLATE_200);
  doc.setLineWidth(0.4);
  doc.line(margin, y, pageW - margin, y);
  y += 6;

  // ==========================================
  // KPIs
  // ==========================================
  const totalSubs = topics.reduce((a, t) => a + t.subtasks.length, 0);
  const doneSubs = topics.reduce((a, t) => a + t.subtasks.filter(s => s.completed).length, 0);
  const pct = totalSubs > 0 ? Math.round((doneSubs / totalSubs) * 100) : 0;
  const delayed = activeTopics.filter(t => getTrafficLight(t.due_date).label === 'Atrasado').length;
  const warning = activeTopics.filter(t => getTrafficLight(t.due_date).label === 'Proximo').length;
  const onTrack = activeTopics.length - delayed - warning;

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...SLATE_800);
  doc.text('Resumen Ejecutivo', margin, y);
  y += 3;

  const kpiW = (contentW - 12) / 5;
  const kpiH = 22;
  const kpis = [
    { value: String(topics.length), label: 'Temas Totales', color: PURPLE_700 },
    { value: String(onTrack), label: 'Al Dia', color: GREEN },
    { value: String(warning), label: 'Proximos', color: AMBER },
    { value: String(delayed), label: 'Atrasados', color: RED },
    { value: `${pct}%`, label: 'Avance Subtareas', color: PURPLE_500 },
  ];

  kpis.forEach((kpi, i) => {
    drawKpiBox(doc, margin + i * (kpiW + 3), y, kpiW, kpiH, kpi.value, kpi.label, kpi.color as [number, number, number]);
  });

  y += kpiH + 6;

  // Narrative
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...SLATE_700);
  let narrative = `Durante el periodo evaluado se gestionaron ${topics.length} temas en total.`;
  if (completedTopics.length > 0) narrative += ` Se completaron ${completedTopics.length} exitosamente.`;
  if (delayed > 0) narrative += ` ${delayed} tema(s) presentan atrasos que requieren atencion.`;
  narrative += ` El avance global en subtareas es de ${pct}% (${doneSubs}/${totalSubs}).`;

  const narrativeLines = doc.splitTextToSize(narrative, contentW);
  doc.text(narrativeLines, margin, y);
  y += narrativeLines.length * 3.5 + 4;

  // ==========================================
  // RESUMEN POR RESPONSABLE (right after executive summary)
  // ==========================================
  if (includeResponsables) {
    const assigneeMap = new Map<string, TopicWithSubtasks[]>();
    topics.forEach(t => {
      let key = t.assignee || ownerName;
      // Unify: if assignee matches ownerName (case-insensitive), group under ownerName
      if (key.toLowerCase() === ownerName.toLowerCase()) key = ownerName;
      if (!assigneeMap.has(key)) assigneeMap.set(key, []);
      assigneeMap.get(key)!.push(t);
    });

    if (assigneeMap.size > 0) {
      y = checkPageBreak(doc, y, 16, margin);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...SLATE_800);
      doc.text('Resumen por Responsable', margin, y);
      y += 3;

      // Compact centered table
      const tableW = 160;
      const tableMarginL = margin + (contentW - tableW) / 2;

      autoTable(doc, {
        startY: y,
        margin: { left: tableMarginL, right: pageW - tableMarginL - tableW },
        head: [['Responsable', 'Temas', 'Activos', 'Seguim.', 'Pausados', 'Completados', 'Atrasados']],
        body: Array.from(assigneeMap.entries())
          .sort(([, a], [, b]) => b.length - a.length)
          .map(([name, tList]) => {
            const active = tList.filter(t => t.status === 'activo').length;
            const seguimiento = tList.filter(t => t.status === 'seguimiento').length;
            const paused = tList.filter(t => t.status === 'pausado').length;
            const completed = tList.filter(t => t.status === 'completado').length;
            const overdue = tList.filter(t => getTrafficLight(t.due_date).label === 'Atrasado').length;
            return [name, String(tList.length), String(active), String(seguimiento), String(paused), String(completed), String(overdue)];
          }),
        styles: { fontSize: 7, cellPadding: 1.8, lineColor: SLATE_200 as any, lineWidth: 0.15, halign: 'center' },
        headStyles: { fillColor: SLATE_700 as any, textColor: WHITE as any, fontStyle: 'bold', fontSize: 7 },
        alternateRowStyles: { fillColor: SLATE_50 as any },
        columnStyles: {
          0: { cellWidth: 38, halign: 'left' },
          1: { cellWidth: 16 },
          2: { cellWidth: 18 },
          3: { cellWidth: 18 },
          4: { cellWidth: 18 },
          5: { cellWidth: 26 },
          6: { cellWidth: 22 },
        },
        didParseCell: (data) => {
          if (data.section === 'body' && data.column.index === 6) {
            const val = parseInt(data.cell.raw as string);
            if (val > 0) {
              data.cell.styles.textColor = RED as any;
              data.cell.styles.fontStyle = 'bold';
            }
          }
        },
      });
      y = (doc as any).lastAutoTable.finalY + 6;
    }
  }

  // ==========================================
  // SECTION HELPER: render grouped table
  // ==========================================
  function renderSection(
    sectionTitle: string,
    sectionTopics: TopicWithSubtasks[],
    mode: 'active' | 'completed' | 'paused',
    headerColor: [number, number, number]
  ) {
    y = checkPageBreak(doc, y, 20, 20);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...SLATE_800);
    doc.text(sectionTitle, margin, y);
    y += 2;
    doc.setDrawColor(...SLATE_800);
    doc.setLineWidth(0.5);
    doc.line(margin, y, margin + contentW, y);
    y += 6;

    const groups = groupByDepartment(sectionTopics, departments, ownerName);

    const heads: Record<string, string[]> = {
      active: ['Tema', 'Responsable', 'Prioridad', 'Estado', 'Vencimiento', 'Avance', 'Ultimo Comentario'],
      completed: ['Tema Completado', 'Responsable', 'Fecha Cierre', '✓', 'Ultimo Comentario'],
      paused: ['Tema', 'Responsable', 'Motivo de Pausa', 'Fecha Pausa'],
    };

    const colStyles: Record<string, any> = {
      active: { 0: { cellWidth: 30 }, 1: { cellWidth: 24 }, 2: { cellWidth: 16 }, 3: { cellWidth: 16 }, 4: { cellWidth: 22 }, 5: { cellWidth: 14 }, 6: { cellWidth: 'auto' } },
      completed: { 0: { cellWidth: 36 }, 1: { cellWidth: 24 }, 2: { cellWidth: 24 }, 3: { cellWidth: 10, halign: 'center' }, 4: { cellWidth: 'auto' } },
      paused: { 0: { cellWidth: 38 }, 1: { cellWidth: 26 }, 2: { cellWidth: 'auto' }, 3: { cellWidth: 26 } },
    };

    groups.forEach((group, gi) => {
      y = drawChapterHeading(doc, `${gi + 1}. ${group.deptName}`, y, margin, contentW);

      const { body, subtaskRowIndices } = buildIntegratedRows(group.topics, mode, ownerName, gi + 1, subtaskFilter);

      autoTable(doc, {
        startY: y,
        margin: { left: margin, right: margin },
        head: [heads[mode]],
        body,
        styles: { fontSize: 7, cellPadding: 2, overflow: 'linebreak', lineColor: SLATE_200 as any, lineWidth: 0.2 },
        headStyles: { fillColor: headerColor as any, textColor: WHITE as any, fontStyle: 'bold', fontSize: 7 },
        columnStyles: colStyles[mode],
        didParseCell: (data) => {
          if (data.section !== 'body') return;
          const isSubtask = subtaskRowIndices.has(data.row.index);

          if (isSubtask) {
            data.cell.styles.fillColor = SLATE_100 as any;
            data.cell.styles.fontSize = 6.5;
            data.cell.styles.fontStyle = 'italic';
            data.cell.styles.textColor = SLATE_500 as any;

            // Status column coloring for subtasks
            if (mode === 'active' && data.column.index === 3) {
              const val = data.cell.raw as string;
              if (val === '✓') {
                data.cell.styles.textColor = GREEN as any;
                data.cell.styles.fontStyle = 'bold';
              } else if (val === 'Pendiente') {
                data.cell.styles.textColor = AMBER as any;
              }
            }
            // Checkmark column for completed
            if (mode === 'completed' && data.column.index === 3) {
              data.cell.styles.textColor = GREEN as any;
              data.cell.styles.fontStyle = 'bold';
            }
          } else {
            // Topic row: alternate white
            data.cell.styles.fillColor = (data.row.index % 2 === 0 ? WHITE : SLATE_50) as any;
            data.cell.styles.fontStyle = 'normal';
            data.cell.styles.textColor = SLATE_700 as any;

            // Bold topic name
            if (data.column.index === 0) {
              data.cell.styles.fontStyle = 'bold';
              data.cell.styles.textColor = SLATE_800 as any;
            }

            // Traffic light for active topics
            if (mode === 'active' && data.column.index === 3) {
              const val = data.cell.raw as string;
              if (val === 'Atrasado') data.cell.styles.textColor = RED as any;
              else if (val === 'Proximo') data.cell.styles.textColor = AMBER as any;
              else data.cell.styles.textColor = GREEN as any;
              data.cell.styles.fontStyle = 'bold';
            }
            // Checkmark column for completed topics
            if (mode === 'completed' && data.column.index === 3) {
              data.cell.styles.textColor = GREEN as any;
              data.cell.styles.fontStyle = 'bold';
            }
          }
        },
      });
      y = (doc as any).lastAutoTable.finalY + 6;
    });
    y += 2;
  }

  // ==========================================
  // SECTIONS
  // ==========================================
  if (includeCompleted && completedTopics.length > 0) {
    renderSection('Logros del Periodo', completedTopics, 'completed', SLATE_700);
  }

  if (activeTopics.length > 0) {
    renderSection('Temas Activos', activeTopics, 'active', SLATE_700);
  }

  if (pausedTopics.length > 0) {
    renderSection('Temas en Pausa', pausedTopics, 'paused', SLATE_500);
  }



  // ==========================================
  // FOOTER
  // ==========================================
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    const pageH = doc.internal.pageSize.getHeight();
    doc.setDrawColor(...SLATE_300);
    doc.setLineWidth(0.3);
    doc.line(margin, pageH - 12, pageW - margin, pageH - 12);
    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...SLATE_500);
    doc.text(`Generado automaticamente — ${emittedStr}`, margin, pageH - 7);
    doc.text(`Pagina ${i} de ${totalPages}`, pageW - margin, pageH - 7, { align: 'right' });
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

  doc.setTextColor(...SLATE_800);
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
