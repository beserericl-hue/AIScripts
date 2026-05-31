import fs from 'fs';
import path from 'path';
import {
  Header,
  Footer,
  Paragraph,
  TextRun,
  ImageRun,
  AlignmentType,
  BorderStyle,
  PageNumber
} from 'docx';

// ---------------------------------------------------------------------------
// CR-011 / Sprint 11.4 — shared CSHSE DOCX branding.
//
// The consolidated suggestions DOCX and the site-visit checklist DOCX both
// need a consistent CSHSE-branded header (logo + organization name) and
// footer (confidentiality line + page numbers). This module is the single
// source of that chrome so the two generators stay in sync.
//
// The logo is bundled at server/src/assets/cshse-logo.png and mirrored into
// dist/assets at build time (see build.js). It is read once at module load;
// if it is missing we degrade gracefully to a text-only header.
// ---------------------------------------------------------------------------

const ORG_NAME = 'Council for Standards in Human Service Education';
const ORG_SHORT = 'CSHSE';

// Resolve the logo relative to this file so it works in both ts-node (src/)
// and the compiled dist/ tree.
const LOGO_PATH = path.join(__dirname, '..', 'assets', 'cshse-logo.png');

let logoBuffer: Buffer | null = null;
try {
  logoBuffer = fs.readFileSync(LOGO_PATH);
} catch {
  // Logo asset unavailable (e.g. partial deploy) — header falls back to
  // text-only. Never let a missing brand asset break a report download.
  logoBuffer = null;
}

/**
 * Whether the CSHSE logo image was successfully loaded. Exposed mainly so
 * tests can assert the asset is bundled.
 */
export function hasBrandLogo(): boolean {
  return logoBuffer !== null && logoBuffer.length > 0;
}

/**
 * Branded page header: CSHSE logo (left) + organization name (right),
 * separated from the body by a bottom rule.
 */
export function buildBrandedHeader(): Header {
  const children: Paragraph[] = [];

  if (logoBuffer) {
    children.push(
      new Paragraph({
        alignment: AlignmentType.LEFT,
        children: [
          new ImageRun({
            // docx v9 requires an explicit image type.
            type: 'png',
            data: logoBuffer,
            transformation: { width: 40, height: 40 }
          })
        ]
      })
    );
  }

  children.push(
    new Paragraph({
      alignment: AlignmentType.RIGHT,
      border: {
        bottom: { style: BorderStyle.SINGLE, size: 6, space: 1, color: '1F3864' }
      },
      children: [
        new TextRun({ text: ORG_NAME, bold: true, color: '1F3864', size: 18 })
      ]
    })
  );

  return new Header({ children });
}

/**
 * Branded page footer: confidentiality line (left intent) + page numbers,
 * separated from the body by a top rule.
 */
export function buildBrandedFooter(): Footer {
  return new Footer({
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        border: {
          top: { style: BorderStyle.SINGLE, size: 6, space: 1, color: '1F3864' }
        },
        children: [
          new TextRun({
            text: `${ORG_SHORT} — Confidential accreditation document    `,
            color: '808080',
            size: 16
          }),
          new TextRun({ text: 'Page ', color: '808080', size: 16 }),
          new TextRun({ children: [PageNumber.CURRENT], color: '808080', size: 16 }),
          new TextRun({ text: ' of ', color: '808080', size: 16 }),
          new TextRun({ children: [PageNumber.TOTAL_PAGES], color: '808080', size: 16 })
        ]
      })
    ]
  });
}

/**
 * The `headers` + `footers` section options to spread into a Document
 * section so every page carries CSHSE branding.
 */
export function brandedSectionChrome() {
  return {
    headers: { default: buildBrandedHeader() },
    footers: { default: buildBrandedFooter() }
  };
}
