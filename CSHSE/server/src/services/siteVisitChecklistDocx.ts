import {
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  TextRun,
  AlignmentType,
  Table,
  TableRow,
  TableCell,
  WidthType,
  PageBreak
} from 'docx';
import { Submission } from '../models/Submission';
import { SiteVisitChecklistItem } from '../models/SiteVisitChecklistItem';

// ---------------------------------------------------------------------------
// CR-012 / Sprint 6.1 — Site-visit partial-compliance checklist DOCX.
//
// The visit team prints (or downloads) this and walks the institution with
// it. Rows are sorted by standard then spec. Each row shows the inclusion
// reason + the final score that triggered it + a "Verified" column the
// team can pencil-tick on paper or that already reflects the in-app verify
// state.
// ---------------------------------------------------------------------------

function cell(text: string, opts: { bold?: boolean; widthPct?: number } = {}): TableCell {
  return new TableCell({
    width: opts.widthPct ? { size: opts.widthPct, type: WidthType.PERCENTAGE } : undefined,
    children: [new Paragraph({ children: [new TextRun({ text, bold: opts.bold })] })]
  });
}

function readableReason(reason: string): string {
  if (reason === 'partial') return 'Partial (final = 1)';
  if (reason === 'non_compliant') return 'Non-compliant (final = 0)';
  if (reason === 'follow_up') return 'Follow-up';
  if (reason === 'manual') return 'Manual';
  return reason;
}

export async function generateChecklistDocx(submissionId: string): Promise<Buffer> {
  const submission = await Submission.findById(submissionId).lean();
  if (!submission) throw new Error('Submission not found');

  const items = await SiteVisitChecklistItem.find({ submissionId }).lean();
  items.sort((a, b) => {
    if (a.standardCode !== b.standardCode) {
      return a.standardCode.localeCompare(b.standardCode, undefined, { numeric: true });
    }
    return a.specCode.localeCompare(b.specCode, undefined, { numeric: true });
  });

  const now = new Date();

  const cover: Paragraph[] = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: 'CSHSE Site-Visit Checklist', bold: true, size: 36 })]
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: submission.institutionName, size: 28 })]
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({
          text: `${submission.programName} (${String(submission.programLevel).toUpperCase()})`,
          size: 24
        })
      ]
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({
          text: `Generated ${now.toISOString().slice(0, 10)} · ${items.length} item${items.length === 1 ? '' : 's'}`,
          size: 20
        })
      ]
    }),
    new Paragraph({ children: [new PageBreak()] })
  ];

  const body: Array<Paragraph | Table> = [];
  if (items.length === 0) {
    body.push(
      new Paragraph({
        children: [
          new TextRun(
            'No partial-compliance items. (Every Final score is 2 or 3, or no Final scores have been set yet.)'
          )
        ]
      })
    );
  } else {
    body.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun({ text: 'Items to verify', bold: true })]
      })
    );

    const header = new TableRow({
      children: [
        cell('Spec', { bold: true, widthPct: 14 }),
        cell('Inclusion reason', { bold: true, widthPct: 28 }),
        cell('Verified', { bold: true, widthPct: 16 }),
        cell('Visit-team note', { bold: true, widthPct: 42 })
      ]
    });

    const rows: TableRow[] = [header];
    for (const it of items) {
      const verifiedCell =
        it.verified && it.verifiedByName
          ? `Yes — ${it.verifiedByName}`
          : it.verified
            ? 'Yes'
            : '☐';
      rows.push(
        new TableRow({
          children: [
            cell(`${it.standardCode}.${it.specCode}`),
            cell(readableReason(it.inclusionReason)),
            cell(verifiedCell),
            cell(it.verificationNote || '')
          ]
        })
      );
    }

    body.push(new Table({ rows, width: { size: 100, type: WidthType.PERCENTAGE } }));
  }

  const doc = new Document({
    creator: 'CSHSE Self-Study Portal',
    title: 'CSHSE Site-Visit Checklist',
    description: `Site-visit checklist for ${submission.institutionName}`,
    sections: [{ properties: {}, children: [...cover, ...body] }]
  });

  return Packer.toBuffer(doc);
}
