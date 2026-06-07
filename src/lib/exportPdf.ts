import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Session, Centre } from '../types';
import { computeRow, computeTotals, pct } from './calculations';

function drawHeader(doc: jsPDF, session: Session) {
  const pageW = doc.internal.pageSize.getWidth();
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text(session.ministere, 14, 12);
  doc.text(session.anneeScolaire ? `ANNEE SCOLAIRE\n${session.anneeScolaire}` : '', pageW - 14, 12, { align: 'right' });
  doc.setLineWidth(0.3);
  doc.line(14, 16, 100, 16);
  doc.text(session.drena, 14, 20);
  doc.line(14, 23, 100, 23);
  doc.text(`${session.etablissement}${session.code ? '\n' + session.code : ''}`, 14, 27);
}

export function exportBEPCGeneral(session: Session) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  drawHeader(doc, session);

  const computed = session.classes.map((c) => computeRow(c, 'BEPC'));
  const totals = computeTotals(computed, 'BEPC');

  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  const pageW = doc.internal.pageSize.getWidth();
  doc.text('Statistique générale', pageW / 2, 40, { align: 'center' });

  const head = [[
    'Classe',
    'Candidats inscrits', 'Candidats Présents', 'Admis', "Taux d'admission",
    'Inscrits Garçon', 'Admis Garçon', "Taux d'admission Garçon",
    'Inscrits Fille', 'Admis Fille', "Taux d'admission Fille",
  ]];

  const body = computed.map((r) => [
    r.name,
    r.inscritsTotal, r.presentsTotal, r.admisTotal, pct(r.tauxTotal),
    r.inscritsGarcon, r.admisGarcon, pct(r.tauxGarcon),
    r.inscritsFille, r.admisFille, pct(r.tauxFille),
  ]);

  body.push([
    'TOTAL',
    totals.inscritsTotal, totals.presentsTotal, totals.admisTotal, pct(totals.tauxTotal),
    totals.inscritsGarcon, totals.admisGarcon, pct(totals.tauxGarcon),
    totals.inscritsFille, totals.admisFille, pct(totals.tauxFille),
  ]);

  autoTable(doc, {
    startY: 45,
    head,
    body,
    styles: { fontSize: 8, cellPadding: 2, halign: 'center' },
    headStyles: { fillColor: [255, 255, 255], textColor: [0, 0, 0], fontStyle: 'bold', lineWidth: 0.3, lineColor: [0, 0, 0] },
    bodyStyles: { lineWidth: 0.3, lineColor: [0, 0, 0] },
    didParseCell: (data) => {
      if (data.row.index === body.length - 1) {
        data.cell.styles.fontStyle = 'bold';
      }
    },
    columnStyles: { 0: { halign: 'left' } },
  });

  doc.save(`BEPC_Statistique_Generale_${session.etablissement.replace(/\s+/g, '_')}.pdf`);
}

export function exportBEPCParEtablissement(session: Session) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  drawHeader(doc, session);

  const pageW = doc.internal.pageSize.getWidth();
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('Statistique par établissement', pageW / 2, 40, { align: 'center' });

  const head = [[
    'Classe',
    'Candidats inscrits', 'Candidats Présents', 'Admis', "Taux d'admission",
    'Inscrits Garçon', 'Admis Garçon', "Taux d'admission Garçon",
    'Inscrits Fille', 'Admis Fille', "Taux d'admission Fille",
  ]];

  let currentY = 45;
  const allComputed = session.classes.map((c) => computeRow(c, 'BEPC'));

  const centresWithRows: { centre: Centre | null; rows: typeof allComputed }[] = [];

  session.centres.forEach((centre) => {
    const rows = allComputed.filter((r) => r.centreId === centre.id);
    if (rows.length > 0) centresWithRows.push({ centre, rows });
  });

  // Unassigned
  const unassigned = allComputed.filter((r) => !r.centreId || !session.centres.find((c) => c.id === r.centreId));
  if (unassigned.length > 0) centresWithRows.push({ centre: null, rows: unassigned });

  centresWithRows.forEach(({ centre, rows }) => {
    const totals = computeTotals(rows, 'BEPC');
    const body = rows.map((r) => [
      r.name,
      r.inscritsTotal, r.presentsTotal, r.admisTotal, pct(r.tauxTotal),
      r.inscritsGarcon, r.admisGarcon, pct(r.tauxGarcon),
      r.inscritsFille, r.admisFille, pct(r.tauxFille),
    ]);
    body.push([
      'TOTAL',
      totals.inscritsTotal, totals.presentsTotal, totals.admisTotal, pct(totals.tauxTotal),
      totals.inscritsGarcon, totals.admisGarcon, pct(totals.tauxGarcon),
      totals.inscritsFille, totals.admisFille, pct(totals.tauxFille),
    ]);

    autoTable(doc, {
      startY: currentY,
      head: [[{ content: centre ? centre.name : 'AUTRE', colSpan: 11, styles: { fillColor: [200, 200, 200], fontStyle: 'bold', halign: 'left' } }], ...head],
      body,
      styles: { fontSize: 8, cellPadding: 2, halign: 'center' },
      headStyles: { fillColor: [255, 255, 255], textColor: [0, 0, 0], fontStyle: 'bold', lineWidth: 0.3, lineColor: [0, 0, 0] },
      bodyStyles: { lineWidth: 0.3, lineColor: [0, 0, 0] },
      didParseCell: (data) => {
        if (data.section === 'body' && data.row.index === body.length - 1) {
          data.cell.styles.fontStyle = 'bold';
        }
      },
      columnStyles: { 0: { halign: 'left' } },
    });

    currentY = (doc as any).lastAutoTable.finalY + 8;
  });

  // Total général
  const allTotals = computeTotals(allComputed, 'BEPC');
  autoTable(doc, {
    startY: currentY,
    body: [[
      { content: 'TOTAL GÉNÉRAL', styles: { fontStyle: 'bold', fillColor: [230, 230, 230] } },
      allTotals.inscritsTotal, allTotals.presentsTotal, allTotals.admisTotal, pct(allTotals.tauxTotal),
      allTotals.inscritsGarcon, allTotals.admisGarcon, pct(allTotals.tauxGarcon),
      allTotals.inscritsFille, allTotals.admisFille, pct(allTotals.tauxFille),
    ]],
    styles: { fontSize: 8, cellPadding: 2, halign: 'center', fontStyle: 'bold' },
    bodyStyles: { lineWidth: 0.3, lineColor: [0, 0, 0] },
    columnStyles: { 0: { halign: 'left' } },
  });

  doc.save(`BEPC_Statistique_ParEtablissement_${session.etablissement.replace(/\s+/g, '_')}.pdf`);
}

export function exportBACStatistique(session: Session) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

  const pageW = doc.internal.pageSize.getWidth();
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text(session.ministere, 14, 12);
  doc.text(session.anneeScolaire ? `ANNEE SCOLAIRE\n${session.anneeScolaire}` : '', pageW - 14, 12, { align: 'right' });
  doc.setLineWidth(0.3);
  doc.line(14, 16, 100, 16);
  doc.text(session.drena, 14, 20);
  doc.line(14, 23, 100, 23);
  doc.text(session.etablissement, 14, 27);

  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text(`STATISTIQUE ${session.etablissement.toUpperCase()}`, pageW / 2, 38, { align: 'center' });
  doc.setFontSize(11);
  doc.setFillColor(220, 220, 220);
  const titleText = `Baccalauréat ${session.examSession}`;
  const titleW = doc.getTextWidth(titleText) + 20;
  doc.roundedRect(pageW / 2 - titleW / 2, 41, titleW, 7, 1, 1, 'F');
  doc.text(titleText, pageW / 2, 46, { align: 'center' });

  const computed = session.classes.map((c) => computeRow(c, 'BAC'));
  const totals = computeTotals(computed, 'BAC');

  const head = [[
    'Classe & Série',
    'Candidats inscrits', 'Candidats Présents', 'Candidats absents', 'Admis', "Taux d'admission",
    'Inscrits (Garçon)', 'Présents (Garçon)', 'Admis (Garçon)', "Taux d'admission (Garçon)",
    'Inscrits (Fille)', 'Présents (Fille)', 'Admis (Fille)', "Taux d'admission (Fille)",
  ]];

  const body = computed.map((r) => [
    r.name,
    r.inscritsTotal, r.presentsTotal, r.absents, r.admisTotal, pct(r.tauxTotal),
    r.inscritsGarcon, r.presentsGarcon, r.admisGarcon, pct(r.tauxGarcon),
    r.inscritsFille, r.presentsFille, r.admisFille, pct(r.tauxFille),
  ]);

  body.push([
    'TOTAL',
    totals.inscritsTotal, totals.presentsTotal, totals.absents, totals.admisTotal, pct(totals.tauxTotal),
    totals.inscritsGarcon, totals.presentsGarcon, totals.admisGarcon, pct(totals.tauxGarcon),
    totals.inscritsFille, totals.presentsFille, totals.admisFille, pct(totals.tauxFille),
  ]);

  autoTable(doc, {
    startY: 52,
    head,
    body,
    styles: { fontSize: 7.5, cellPadding: 2, halign: 'center' },
    headStyles: { fillColor: [255, 255, 255], textColor: [0, 0, 0], fontStyle: 'bold', lineWidth: 0.3, lineColor: [0, 0, 0] },
    bodyStyles: { lineWidth: 0.3, lineColor: [0, 0, 0] },
    didParseCell: (data) => {
      if (data.section === 'body' && data.row.index === body.length - 1) {
        data.cell.styles.fontStyle = 'bold';
      }
    },
    columnStyles: { 0: { halign: 'left' } },
  });

  doc.save(`BAC_Statistique_${session.etablissement.replace(/\s+/g, '_')}.pdf`);
}
