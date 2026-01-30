import mammoth from 'mammoth';
import pdfParse from 'pdf-parse';
import { v4 as uuidv4 } from 'uuid';

export interface ParsedMetadata {
  title?: string;
  author?: string;
  createdDate?: Date;
  pageCount: number;
}

export interface ParsedSection {
  id: string;
  type: 'heading' | 'paragraph' | 'list' | 'table';
  content: string;
  pageNumber: number;
  styling?: {
    bold: boolean;
    italic: boolean;
    fontSize?: number;
  };
  suggestedStandard?: {
    code: string;
    confidence: number;
  };
}

export interface ParsedTable {
  id: string;
  pageNumber: number;
  headers: string[];
  rows: string[][];
  tableType?: 'curriculum_matrix' | 'grading_scale' | 'schedule' | 'course_list' | 'unknown';
}

export interface ParsedImage {
  id: string;
  pageNumber: number;
  description?: string;
  base64Data?: string;
  mimeType?: string;
}

export interface ParsedDocument {
  metadata: ParsedMetadata;
  sections: ParsedSection[];
  tables: ParsedTable[];
  images: ParsedImage[];
  rawText: string;
  htmlContent: string;  // Properly formatted HTML with headers (h1, h2, etc.)
}

export interface StandardPattern {
  standardCode: string;
  specCode?: string;
  matchedText: string;
  confidence: number;
}

/**
 * Table of Contents entry parsed from document
 */
export interface TOCEntry {
  title: string;
  pageNumber?: number;
  level: number;  // 1 = main section, 2 = subsection, etc.
  standardCode?: string;
  specCode?: string;
  sectionType: 'standard' | 'matrix' | 'supporting_evidence' | 'intro' | 'appendix' | 'general';
  isMatrix: boolean;
  isSupportingEvidence: boolean;
}

/**
 * A section of content based on TOC parsing
 */
export interface TOCBasedSection {
  id: string;
  tocEntry: TOCEntry;
  content: string;
  htmlContent: string;
  startPosition: number;
  endPosition: number;
  standardHint?: string;  // e.g., "Standard 7" to help AI
  specHint?: string;      // e.g., "Specification b" to help AI
}

// Standard detection patterns for CSHSE standards
const STANDARD_PATTERNS = [
  { pattern: /Standard\s*(\d{1,2})([a-z])?/gi, type: 'explicit' },
  { pattern: /\b(\d{1,2})\.([a-z])\b/g, type: 'numeric' },
  { pattern: /Specification\s*([a-z])/gi, type: 'spec' },
  { pattern: /curriculum\s*matrix/gi, type: 'matrix', standard: '11' },
  { pattern: /field\s*(experience|placement)/gi, type: 'field', standard: '21' },
  { pattern: /faculty\s*credentials?/gi, type: 'faculty', standard: '6' },
  { pattern: /program\s*evaluation/gi, type: 'evaluation', standard: '4' },
  { pattern: /cultural\s*competenc/gi, type: 'cultural', standard: '8' },
  { pattern: /admission|retention|dismissal/gi, type: 'policies', standard: '5' }
];

// Table type detection patterns
const TABLE_PATTERNS = {
  curriculum_matrix: [
    /course/i,
    /standard/i,
    /[ITKS]/,
    /[LMH]/,
    /CHS\s*\d+/i
  ],
  grading_scale: [
    /grade/i,
    /percentage/i,
    /QPA|GPA/i,
    /[A-F][+-]?/
  ],
  schedule: [
    /week/i,
    /date/i,
    /topic/i,
    /assignment/i,
    /reading/i
  ],
  course_list: [
    /course/i,
    /credit/i,
    /semester/i,
    /prerequisite/i
  ]
};

export class DocumentParserService {
  /**
   * Parse a document based on its file type
   */
  async parse(buffer: Buffer, filename: string): Promise<ParsedDocument> {
    const extension = filename.toLowerCase().split('.').pop();

    switch (extension) {
      case 'pdf':
        return this.parsePDF(buffer);
      case 'docx':
        return this.parseDOCX(buffer);
      case 'pptx':
        return this.parsePPTX(buffer);
      default:
        throw new Error(`Unsupported file type: ${extension}`);
    }
  }

  /**
   * Parse PDF document
   */
  async parsePDF(buffer: Buffer): Promise<ParsedDocument> {
    const data = await pdfParse(buffer);

    const sections = this.extractSectionsFromText(data.text, 'pdf');
    const tables = this.detectTablesInText(data.text);

    // Convert raw text to HTML with proper header detection
    const htmlContent = this.convertTextToHtml(data.text);

    return {
      metadata: {
        title: data.info?.Title,
        author: data.info?.Author,
        createdDate: data.info?.CreationDate ? new Date(data.info.CreationDate) : undefined,
        pageCount: data.numpages
      },
      sections,
      tables,
      images: [], // PDF image extraction would require additional processing
      rawText: data.text,
      htmlContent
    };
  }

  /**
   * Parse DOCX document
   */
  async parseDOCX(buffer: Buffer): Promise<ParsedDocument> {
    const result = await mammoth.extractRawText({ buffer });
    // Use mammoth's HTML conversion which preserves headings as h1, h2, etc.
    const htmlResult = await mammoth.convertToHtml({
      buffer,
      styleMap: [
        // Map Word styles to HTML headings
        "p[style-name='Heading 1'] => h1:fresh",
        "p[style-name='Heading 2'] => h2:fresh",
        "p[style-name='Heading 3'] => h3:fresh",
        "p[style-name='Heading 4'] => h4:fresh",
        "p[style-name='Title'] => h1.title:fresh",
        "p[style-name='Subtitle'] => h2.subtitle:fresh",
        // Bold paragraphs often indicate headers in academic documents
        "p[style-name='Intense Emphasis'] => strong"
      ]
    });

    const sections = this.extractSectionsFromText(result.value, 'docx');
    const tables = this.detectTablesInText(result.value);

    // Try to extract tables from HTML
    const htmlTables = this.extractTablesFromHtml(htmlResult.value);
    tables.push(...htmlTables);

    // Clean up and enhance the HTML
    let htmlContent = htmlResult.value;
    // Ensure document has proper structure
    if (!htmlContent.includes('<h1') && !htmlContent.includes('<h2')) {
      // If mammoth didn't detect any headers, try to detect them from text patterns
      htmlContent = this.enhanceHtmlWithHeaders(htmlContent);
    }

    return {
      metadata: {
        pageCount: this.estimatePageCount(result.value)
      },
      sections,
      tables,
      images: [],
      rawText: result.value,
      htmlContent
    };
  }

  /**
   * Parse PPTX document
   */
  async parsePPTX(buffer: Buffer): Promise<ParsedDocument> {
    // For now, use basic text extraction
    // A full implementation would use a PPTX parser library
    const text = await this.extractTextFromPPTX(buffer);

    const sections = this.extractSectionsFromText(text, 'pptx');
    const tables = this.detectTablesInText(text);

    // Convert raw text to HTML with proper header detection
    const htmlContent = this.convertTextToHtml(text);

    return {
      metadata: {
        pageCount: this.countSlides(text)
      },
      sections,
      tables,
      images: [],
      rawText: text,
      htmlContent
    };
  }

  /**
   * Extract text from PPTX (placeholder - would need proper PPTX parsing)
   */
  private async extractTextFromPPTX(buffer: Buffer): Promise<string> {
    // This is a placeholder. In production, use a proper PPTX parser
    // like officegen or pptx-parser
    try {
      // Basic ZIP extraction for PPTX (which is a ZIP file)
      const AdmZip = require('adm-zip');
      const zip = new AdmZip(buffer);
      const entries = zip.getEntries();
      let text = '';

      for (const entry of entries) {
        if (entry.entryName.startsWith('ppt/slides/') && entry.entryName.endsWith('.xml')) {
          const content = entry.getData().toString('utf8');
          // Extract text from XML (basic extraction)
          const textMatches = content.match(/<a:t>([^<]*)<\/a:t>/g);
          if (textMatches) {
            text += textMatches.map((m: string) => m.replace(/<\/?a:t>/g, '')).join(' ') + '\n';
          }
        }
      }

      return text || 'Unable to extract text from PowerPoint';
    } catch {
      return 'PowerPoint parsing requires additional libraries';
    }
  }

  /**
   * Extract sections from raw text
   */
  private extractSectionsFromText(text: string, source: string): ParsedSection[] {
    const sections: ParsedSection[] = [];
    const lines = text.split('\n').filter(line => line.trim());
    let currentPage = 1;
    let position = 0;

    for (const line of lines) {
      const trimmedLine = line.trim();
      if (!trimmedLine) continue;

      // Detect page breaks (common patterns)
      if (/^page\s+\d+/i.test(trimmedLine) || /^\d+\s*$/.test(trimmedLine)) {
        const pageMatch = trimmedLine.match(/\d+/);
        if (pageMatch) {
          currentPage = parseInt(pageMatch[0], 10);
        }
        continue;
      }

      const section: ParsedSection = {
        id: uuidv4(),
        type: this.detectSectionType(trimmedLine),
        content: trimmedLine,
        pageNumber: currentPage,
        styling: this.detectStyling(trimmedLine)
      };

      // Try to detect standard reference
      const standardPattern = this.detectStandardPatterns(trimmedLine);
      if (standardPattern.length > 0) {
        section.suggestedStandard = {
          code: standardPattern[0].standardCode + (standardPattern[0].specCode || ''),
          confidence: standardPattern[0].confidence
        };
      }

      sections.push(section);
      position += line.length + 1;
    }

    return sections;
  }

  /**
   * Detect section type based on content
   */
  private detectSectionType(line: string): 'heading' | 'paragraph' | 'list' | 'table' {
    // Check for heading patterns
    if (/^(Standard\s*\d|Section\s*[IVX]+|Part\s*[IVX]+|Chapter\s*\d)/i.test(line)) {
      return 'heading';
    }

    // Check for list patterns
    if (/^[\u2022\u2023\u25E6\u2043\u2219\-\*]\s/.test(line) || /^\d+[\.\)]\s/.test(line)) {
      return 'list';
    }

    // Check for table-like patterns (tab-separated)
    if (line.split('\t').length > 2) {
      return 'table';
    }

    return 'paragraph';
  }

  /**
   * Detect text styling hints
   */
  private detectStyling(line: string): { bold: boolean; italic: boolean; fontSize?: number } {
    return {
      bold: /^[A-Z\s]+$/.test(line) || line.length < 50 && /^[A-Z]/.test(line),
      italic: false
    };
  }

  /**
   * Detect standard references in text
   */
  detectStandardPatterns(text: string): StandardPattern[] {
    const patterns: StandardPattern[] = [];

    for (const { pattern, type, standard } of STANDARD_PATTERNS) {
      const regex = new RegExp(pattern.source, pattern.flags);
      let match;

      while ((match = regex.exec(text)) !== null) {
        if (type === 'explicit' || type === 'numeric') {
          patterns.push({
            standardCode: match[1],
            specCode: match[2]?.toLowerCase(),
            matchedText: match[0],
            confidence: type === 'explicit' ? 0.95 : 0.8
          });
        } else if (standard) {
          patterns.push({
            standardCode: standard,
            matchedText: match[0],
            confidence: 0.6
          });
        }
      }
    }

    return patterns;
  }

  /**
   * Detect tables in text
   */
  private detectTablesInText(text: string): ParsedTable[] {
    const tables: ParsedTable[] = [];
    const lines = text.split('\n');
    let tableLines: string[] = [];
    let inTable = false;

    for (const line of lines) {
      const tabCount = (line.match(/\t/g) || []).length;

      if (tabCount >= 2) {
        if (!inTable) {
          inTable = true;
          tableLines = [];
        }
        tableLines.push(line);
      } else if (inTable && tableLines.length > 0) {
        // End of table
        const table = this.parseTableFromLines(tableLines);
        if (table) {
          tables.push(table);
        }
        inTable = false;
        tableLines = [];
      }
    }

    // Handle last table if any
    if (tableLines.length > 0) {
      const table = this.parseTableFromLines(tableLines);
      if (table) {
        tables.push(table);
      }
    }

    return tables;
  }

  /**
   * Parse table from lines of text
   */
  private parseTableFromLines(lines: string[]): ParsedTable | null {
    if (lines.length < 2) return null;

    const rows = lines.map(line => line.split('\t').map(cell => cell.trim()));
    const headers = rows[0];
    const dataRows = rows.slice(1);

    const table: ParsedTable = {
      id: uuidv4(),
      pageNumber: 1,
      headers,
      rows: dataRows,
      tableType: this.detectTableType(headers, dataRows)
    };

    return table;
  }

  /**
   * Detect table type based on content
   */
  private detectTableType(headers: string[], rows: string[][]): ParsedTable['tableType'] {
    const allText = [...headers, ...rows.flat()].join(' ');

    for (const [tableType, patterns] of Object.entries(TABLE_PATTERNS)) {
      const matchCount = patterns.filter(p => p.test(allText)).length;
      if (matchCount >= 2) {
        return tableType as ParsedTable['tableType'];
      }
    }

    return 'unknown';
  }

  /**
   * Extract tables from HTML
   */
  private extractTablesFromHtml(html: string): ParsedTable[] {
    const tables: ParsedTable[] = [];
    const tableMatches = html.match(/<table[^>]*>([\s\S]*?)<\/table>/gi);

    if (!tableMatches) return tables;

    for (const tableHtml of tableMatches) {
      const rows: string[][] = [];
      const rowMatches = tableHtml.match(/<tr[^>]*>([\s\S]*?)<\/tr>/gi);

      if (!rowMatches) continue;

      for (const rowHtml of rowMatches) {
        const cells: string[] = [];
        const cellMatches = rowHtml.match(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi);

        if (cellMatches) {
          for (const cellHtml of cellMatches) {
            const text = cellHtml.replace(/<[^>]*>/g, '').trim();
            cells.push(text);
          }
        }

        if (cells.length > 0) {
          rows.push(cells);
        }
      }

      if (rows.length >= 2) {
        tables.push({
          id: uuidv4(),
          pageNumber: 1,
          headers: rows[0],
          rows: rows.slice(1),
          tableType: this.detectTableType(rows[0], rows.slice(1))
        });
      }
    }

    return tables;
  }

  /**
   * Estimate page count from text length
   */
  private estimatePageCount(text: string): number {
    // Average ~3000 characters per page
    return Math.max(1, Math.ceil(text.length / 3000));
  }

  /**
   * Count slides in PPTX text
   */
  private countSlides(text: string): number {
    // This is a rough estimate
    const slideBreaks = text.split(/\n{3,}/).length;
    return Math.max(1, slideBreaks);
  }

  /**
   * Detect if a table is a curriculum matrix
   */
  isCurriculumMatrix(table: ParsedTable): boolean {
    const hasCourseCodes = table.headers.some(h => /CHS|course/i.test(h));
    const hasStandardRefs = table.rows.some(row =>
      row.some(cell => /^[ITKS]+[,\s]*[LMH]?$/i.test(cell))
    );
    return hasCourseCodes || hasStandardRefs || table.tableType === 'curriculum_matrix';
  }

  /**
   * Parse curriculum matrix values
   */
  parseCurriculumMatrixCell(cellValue: string): {
    types: ('I' | 'T' | 'K' | 'S')[];
    depth: 'L' | 'M' | 'H' | null;
  } {
    const types: ('I' | 'T' | 'K' | 'S')[] = [];
    let depth: 'L' | 'M' | 'H' | null = null;

    const upperValue = cellValue.toUpperCase().replace(/[^ITKS LMH,]/g, '');

    // Extract coverage types
    if (upperValue.includes('I')) types.push('I');
    if (upperValue.includes('T')) types.push('T');
    if (upperValue.includes('K')) types.push('K');
    if (upperValue.includes('S')) types.push('S');

    // Extract depth
    if (upperValue.includes('H')) depth = 'H';
    else if (upperValue.includes('M')) depth = 'M';
    else if (upperValue.includes('L')) depth = 'L';

    return { types, depth };
  }

  /**
   * Convert plain text to HTML with proper header detection
   * Detects headers based on patterns like "Standard X", "Section X", uppercase lines, etc.
   */
  private convertTextToHtml(text: string): string {
    const lines = text.split('\n');
    const htmlParts: string[] = [];
    let inParagraph = false;
    let paragraphContent: string[] = [];

    const flushParagraph = () => {
      if (paragraphContent.length > 0) {
        const content = paragraphContent.join(' ').trim();
        if (content) {
          htmlParts.push(`<p>${this.escapeHtml(content)}</p>`);
        }
        paragraphContent = [];
      }
      inParagraph = false;
    };

    for (const line of lines) {
      const trimmedLine = line.trim();

      // Skip empty lines - they end paragraphs
      if (!trimmedLine) {
        flushParagraph();
        continue;
      }

      // Detect header patterns
      const headerLevel = this.detectHeaderLevel(trimmedLine);

      if (headerLevel > 0) {
        flushParagraph();
        htmlParts.push(`<h${headerLevel}>${this.escapeHtml(trimmedLine)}</h${headerLevel}>`);
      } else if (this.isListItem(trimmedLine)) {
        flushParagraph();
        htmlParts.push(`<li>${this.escapeHtml(trimmedLine.replace(/^[\u2022\u2023\u25E6\u2043\u2219\-\*]\s*/, '').replace(/^\d+[\.\)]\s*/, ''))}</li>`);
      } else {
        // Regular paragraph content
        paragraphContent.push(trimmedLine);
        inParagraph = true;
      }
    }

    // Flush any remaining paragraph
    flushParagraph();

    // Wrap consecutive list items in <ul>
    const html = htmlParts.join('\n');
    return this.wrapListItems(html);
  }

  /**
   * Detect header level based on text patterns
   * Returns 0 if not a header, 1-4 for h1-h4
   */
  private detectHeaderLevel(line: string): number {
    // H1: Major sections - "STANDARD X", "PART X", "CHAPTER X"
    if (/^(STANDARD|PART|CHAPTER|SECTION)\s+[IVXLCDM\d]+/i.test(line)) {
      return 1;
    }

    // H1: All caps titles (typically document titles or major sections)
    if (/^[A-Z][A-Z\s\d:,\-]{10,}$/.test(line) && line.length < 100) {
      return 1;
    }

    // H2: Standard specifications - "Standard 1", "Specification A"
    if (/^Standard\s+\d+/i.test(line)) {
      return 2;
    }

    // H2: Numbered sections with periods - "1. Introduction", "2.1 Overview"
    if (/^\d+(\.\d+)?\s+[A-Z]/.test(line) && line.length < 80) {
      return 2;
    }

    // H3: Lettered subsections - "a. ", "A) ", "(a)"
    if (/^[a-zA-Z][\.\)]\s+/.test(line) || /^\([a-zA-Z]\)\s+/.test(line)) {
      return 3;
    }

    // H3: Specification references
    if (/^Specification\s+[a-zA-Z]/i.test(line)) {
      return 3;
    }

    // H4: Roman numeral subsections
    if (/^[ivxIVX]+[\.\)]\s+/.test(line)) {
      return 4;
    }

    // Short bold-like lines (typically headers in academic documents)
    if (line.length < 60 && /^[A-Z][a-zA-Z\s]+:?\s*$/.test(line)) {
      // Check if it looks like a section header
      if (/^(Introduction|Overview|Background|Purpose|Objective|Mission|Vision|Goal|Summary|Conclusion|Recommendation|Discussion|Result|Method|Finding|Analysis|Assessment|Evaluation|Review)/i.test(line)) {
        return 2;
      }
    }

    return 0;
  }

  /**
   * Check if a line is a list item
   */
  private isListItem(line: string): boolean {
    return /^[\u2022\u2023\u25E6\u2043\u2219\-\*]\s/.test(line) || /^\d+[\.\)]\s/.test(line);
  }

  /**
   * Wrap consecutive <li> elements in <ul> tags
   */
  private wrapListItems(html: string): string {
    return html.replace(/(<li>.*?<\/li>\n?)+/g, (match) => {
      return `<ul>\n${match}</ul>\n`;
    });
  }

  /**
   * Escape HTML special characters
   */
  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  /**
   * Enhance existing HTML with headers if none were detected
   * Used when mammoth doesn't find Word heading styles
   */
  private enhanceHtmlWithHeaders(html: string): string {
    // If there are already headers, return as-is
    if (/<h[1-6]/i.test(html)) {
      return html;
    }

    // Split by paragraphs and check each for header patterns
    return html.replace(/<p>([^<]+)<\/p>/g, (match, content) => {
      const headerLevel = this.detectHeaderLevel(content.trim());
      if (headerLevel > 0) {
        return `<h${headerLevel}>${content}</h${headerLevel}>`;
      }
      return match;
    });
  }

  // ==================== TOC-BASED PARSING METHODS ====================

  /**
   * Extract Table of Contents from document text
   * Looks for patterns like "Table of Contents" followed by entries
   * Handles both main sections and subsections (a. Title, 1. Title, etc.)
   */
  extractTableOfContents(text: string): TOCEntry[] {
    const tocEntries: TOCEntry[] = [];

    try {
      const lines = text.split('\n');

      // Find TOC start
      let tocStartIndex = -1;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim().toLowerCase();
        if (line.includes('table of contents') || line === 'contents') {
          tocStartIndex = i + 1;
          break;
        }
      }

      if (tocStartIndex === -1) {
        console.log('[DocumentParser] No Table of Contents found');
        return tocEntries;
      }

      // Track current standard for subsection inheritance
      let currentStandardCode: string | undefined;

      // STRICT LIMITS: A realistic TOC has 20-150 entries and spans 2-5 pages max
      const maxEntries = 150;
      const maxLines = Math.min(tocStartIndex + 300, lines.length);

      // Track consecutive non-TOC lines to detect end of TOC
      let consecutiveNonTocLines = 0;
      const maxConsecutiveNonToc = 5; // If we see 5 non-TOC lines in a row, we've left the TOC

      // Parse TOC entries until we hit content that's clearly not TOC
      for (let i = tocStartIndex; i < maxLines && tocEntries.length < maxEntries; i++) {
        const line = lines[i].trim();

        // Skip empty lines (don't count as non-TOC)
        if (!line) continue;

        // STRONG END DETECTION: Lines that are clearly content, not TOC
        // 1. Very long lines (>120 chars) are paragraphs, not TOC entries
        if (line.length > 120) {
          consecutiveNonTocLines++;
          if (consecutiveNonTocLines >= maxConsecutiveNonToc) {
            console.log(`[DocumentParser] Stopping TOC parsing: ${consecutiveNonTocLines} consecutive non-TOC lines`);
            break;
          }
          continue;
        }

        // 2. Lines without page numbers are NOT TOC entries - they're sub-items that should stay as content
        // Check for both separator-based and concatenated page numbers
        const hasPageNumberPattern = /[.\s…]+\d{1,3}\s*$/.test(line) || /\d{1,3}\s*$/.test(line);
        if (!hasPageNumberPattern) {
          // No page number = not a TOC entry, skip it (sub-entries stay as document content)
          consecutiveNonTocLines++;
          if (consecutiveNonTocLines >= maxConsecutiveNonToc) {
            console.log(`[DocumentParser] Stopping TOC parsing: no page numbers detected`);
            break;
          }
          continue;
        }

        // Parse TOC entry, passing current standard for subsection inheritance
        try {
          const entry = this.parseTOCEntry(line, currentStandardCode);
          if (entry) {
            tocEntries.push(entry);
            consecutiveNonTocLines = 0; // Reset counter on successful parse

            // Update current standard if this entry has one (for subsection inheritance)
            if (entry.standardCode && entry.level === 1) {
              currentStandardCode = entry.standardCode;
            }
          } else {
            // parseTOCEntry returned null - this line doesn't look like a TOC entry
            consecutiveNonTocLines++;
            if (consecutiveNonTocLines >= maxConsecutiveNonToc) {
              console.log(`[DocumentParser] Stopping TOC parsing: too many non-matching lines`);
              break;
            }
          }
        } catch (entryError) {
          console.error('[DocumentParser] Error parsing TOC entry:', line.substring(0, 50), entryError);
          consecutiveNonTocLines++;
        }
      }

      console.log(`[DocumentParser] Extracted ${tocEntries.length} TOC entries`);
      if (tocEntries.length > 0) {
        const sample = tocEntries.slice(0, 5).map(e =>
          `${(e.title || '').substring(0, 40)}${e.pageNumber ? ' p' + e.pageNumber : ''}`
        );
        console.log(`[DocumentParser] First 5 entries:`, sample);
      }
    } catch (error) {
      console.error('[DocumentParser] Error extracting TOC:', error);
    }

    return tocEntries;
  }

  /**
   * Parse a single TOC entry line
   * Handles both main sections (Standard 1, Part I) and subsections (a. Title, 1. Title)
   * STRICT: Requires page number OR recognized header pattern to be considered a TOC entry
   */
  private parseTOCEntry(line: string, currentStandardCode?: string): TOCEntry | null {
    try {
      // Skip if line is too short or looks like page number only
      if (!line || line.length < 3 || /^\d+$/.test(line.trim())) {
        return null;
      }

      // Skip lines that are too long to be TOC entries (likely paragraphs)
      if (line.length > 100) {
        return null;
      }

      // Extract page number if present
      let title = line;
      let pageNumber: number | undefined;
      let hasPageNumber = false;

      // Try multiple patterns for page numbers:
      // 1. With separator: "Title...123" or "Title … 123" or "Title    123"
      // 2. Direct concatenation: "Title123" (common in Word TOC exports)
      let pageMatch = line.match(/[.\s…]+(\d{1,3})\s*$/);

      if (!pageMatch) {
        // Try concatenated pattern: title ending directly with digits
        // Must have at least some text before the number
        pageMatch = line.match(/^(.{5,})(\d{1,3})\s*$/);
        if (pageMatch) {
          // Reformat match to be consistent
          pageMatch = [pageMatch[2], pageMatch[2]];
          title = line.replace(/\d{1,3}\s*$/, '').trim();
        }
      }

      if (pageMatch) {
        const parsedPage = parseInt(pageMatch[1], 10);
        // Reasonable page numbers are 1-500
        if (parsedPage >= 1 && parsedPage <= 500) {
          pageNumber = parsedPage;
          hasPageNumber = true;
          // Only extract title from match if we haven't already (non-concatenated case)
          if (title === line) {
            const matchIndex = line.indexOf(pageMatch[0]);
            if (matchIndex > 0) {
              title = line.substring(0, matchIndex).trim();
            }
          }
        }
      }

      // Skip if title is empty after removing page number
      if (!title || title.length < 2) {
        return null;
      }

      // STRICT VALIDATION: REQUIRE page number for all TOC entries
      // Sub-entries without page numbers (like "1. Title" or "a. Title") stay as document content
      if (!hasPageNumber) {
        return null;
      }

      // Use trimmed title for further processing
      title = title.trim();

      // Determine level and extract spec code from subsection patterns
      let level = 1;
      let specCode: string | undefined;

      // Check for lettered subsections: "a. Title", "b) Title", "(a) Title"
      const letteredMatch = title.match(/^([a-z])[\.\)]\s+(.+)/i) ||
                            title.match(/^\(([a-z])\)\s+(.+)/i);
      if (letteredMatch && letteredMatch[2]) {
        level = 2;
        specCode = letteredMatch[1].toLowerCase();
        title = letteredMatch[2].trim();
      }

      // Check for numbered subsections under standards: "1. Title", "2. Title"
      // But NOT main numbered items like "Standard 1" and only if not already matched as lettered
      if (level === 1) {
        const numberedMatch = title.match(/^(\d+)[\.\)]\s+(.+)/);
        if (numberedMatch && numberedMatch[2] && !title.toLowerCase().includes('standard')) {
          level = 2;
          // Map numbers to letters for spec codes (1->a, 2->b, etc.) if within range
          const num = parseInt(numberedMatch[1], 10);
          if (num >= 1 && num <= 26) {
            specCode = String.fromCharCode(96 + num); // 1->a, 2->b, etc.
          }
          title = numberedMatch[2].trim();
        }
      }

      // Check for indentation (tabs or multiple spaces)
      if (line.startsWith('\t') || /^\s{2,}/.test(line)) {
        level = Math.max(level, 2);
      }

      // Extract standard code from title (for main standard headers)
      const extracted = this.extractStandardFromTOCTitle(title);
      let standardCode = extracted.standardCode;

      // If this is a subsection and we have a current standard, inherit it
      if (level === 2 && !standardCode && currentStandardCode) {
        standardCode = currentStandardCode;
      }

      // Use extracted spec code if we didn't get one from the pattern
      if (!specCode && extracted.specCode) {
        specCode = extracted.specCode;
      }

      // Determine section type
      const sectionType = this.determineSectionType(title, standardCode);
      const isMatrix = this.isTOCEntryMatrix(title);
      const isSupportingEvidence = this.isTOCSupportingEvidence(title);

      // Final safety check - ensure title is valid
      const finalTitle = (title || '').replace(/^[\t\s]+/, '').trim();
      if (!finalTitle || finalTitle.length < 2) {
        return null;
      }

      return {
        title: finalTitle,
        pageNumber,
        level,
        standardCode,
        specCode,
        sectionType,
        isMatrix,
        isSupportingEvidence
      };
    } catch (error) {
      console.error('[DocumentParser] Error in parseTOCEntry:', error);
      return null;
    }
  }

  /**
   * Extract standard code and spec code from TOC title
   */
  private extractStandardFromTOCTitle(title: string): { standardCode?: string; specCode?: string } {
    // Pattern: "Standard 1", "Standard 11", etc.
    const standardMatch = title.match(/Standard\s*(\d{1,2})/i);
    if (standardMatch) {
      const standardCode = standardMatch[1];

      // Check for spec in same line: "1.a" or "Standard 1a" or "Specification a"
      const specMatch = title.match(/(\d{1,2})[.\s]*([a-z])\b/i) ||
                        title.match(/Specification\s*([a-z])/i);
      const specCode = specMatch ? specMatch[specMatch.length === 3 ? 2 : 1].toLowerCase() : undefined;

      return { standardCode, specCode };
    }

    // Pattern: "Part II: Curriculum" -> Standards 11-20
    if (/Part\s*II.*Curriculum/i.test(title)) {
      return { standardCode: '11' };
    }

    return {};
  }

  /**
   * Determine section type from TOC title
   */
  private determineSectionType(title: string, standardCode?: string): TOCEntry['sectionType'] {
    const lowerTitle = title.toLowerCase();

    if (standardCode) {
      return 'standard';
    }

    if (lowerTitle.includes('matrix')) {
      return 'matrix';
    }

    if (
      lowerTitle.includes('appendix') ||
      lowerTitle.includes('appendices') ||
      lowerTitle.includes('supporting document') ||
      lowerTitle.includes('course syllabi') ||
      lowerTitle.includes('syllabus') ||
      lowerTitle.includes('materials')
    ) {
      return 'supporting_evidence';
    }

    if (
      lowerTitle.includes('introductory') ||
      lowerTitle.includes('introduction') ||
      lowerTitle.includes('glossary') ||
      lowerTitle.includes('certification')
    ) {
      return 'intro';
    }

    return 'general';
  }

  /**
   * Check if TOC entry is for a curriculum matrix
   */
  private isTOCEntryMatrix(title: string): boolean {
    const lowerTitle = title.toLowerCase();
    return lowerTitle.includes('matrix') ||
           (lowerTitle.includes('curriculum') && !lowerTitle.includes('standard'));
  }

  /**
   * Check if TOC entry is for supporting evidence
   */
  private isTOCSupportingEvidence(title: string): boolean {
    const lowerTitle = title.toLowerCase();
    return lowerTitle.includes('appendix') ||
           lowerTitle.includes('appendices') ||
           lowerTitle.includes('supporting document') ||
           lowerTitle.includes('course syllabi') ||
           lowerTitle.includes('syllabus') ||
           lowerTitle.includes('materials') ||
           lowerTitle.includes('cv') ||
           lowerTitle.includes('vitae');
  }

  /**
   * Split document content into sections based on TOC entries
   * Each section contains the content from one TOC entry to the next
   */
  splitDocumentByTOC(text: string, htmlContent: string, tocEntries: TOCEntry[]): TOCBasedSection[] {
    const sections: TOCBasedSection[] = [];

    if (tocEntries.length === 0) {
      console.log('[DocumentParser] No TOC entries, returning single section');
      return [{
        id: uuidv4(),
        tocEntry: {
          title: 'Full Document',
          level: 1,
          sectionType: 'general',
          isMatrix: false,
          isSupportingEvidence: false
        },
        content: text,
        htmlContent: htmlContent,
        startPosition: 0,
        endPosition: text.length
      }];
    }

    // Remove TOC from the text first
    const tocEndMarkers = ['certification of the self-study', 'introductory information', 'part i:'];
    let contentStartIndex = 0;

    for (const marker of tocEndMarkers) {
      const idx = text.toLowerCase().indexOf(marker);
      if (idx > 0 && idx < text.length / 4) {  // TOC should be in first quarter
        contentStartIndex = idx;
        break;
      }
    }

    const contentText = text.substring(contentStartIndex);

    // For each TOC entry, find its content in the document
    for (let i = 0; i < tocEntries.length; i++) {
      const entry = tocEntries[i];
      const nextEntry = tocEntries[i + 1];

      // Skip TOC itself and very short entries
      if (entry.title.toLowerCase().includes('table of contents')) {
        continue;
      }

      // Find the section content
      const sectionContent = this.extractSectionContent(
        contentText,
        entry.title,
        nextEntry?.title
      );

      if (sectionContent.content.length > 50) {  // Only include substantial sections
        // Build standard hint for AI
        let standardHint = '';
        let specHint = '';

        if (entry.standardCode) {
          standardHint = `Standard ${entry.standardCode}`;
          if (entry.specCode) {
            specHint = `Specification ${entry.specCode}`;
          }
        }

        sections.push({
          id: uuidv4(),
          tocEntry: entry,
          content: sectionContent.content,
          htmlContent: sectionContent.htmlContent,
          startPosition: sectionContent.startPosition,
          endPosition: sectionContent.endPosition,
          standardHint,
          specHint
        });
      }
    }

    console.log(`[DocumentParser] Split document into ${sections.length} TOC-based sections`);
    return sections;
  }

  /**
   * Extract content for a section based on its title and the next section's title
   */
  private extractSectionContent(
    text: string,
    sectionTitle: string,
    nextSectionTitle?: string
  ): { content: string; htmlContent: string; startPosition: number; endPosition: number } {
    // Truncate BEFORE escaping to avoid cutting in the middle of escape sequences
    // Also sanitize: remove problematic characters that could break regex
    const sanitizedTitle = sectionTitle
      .substring(0, 40)  // Take first 40 chars of original
      .replace(/[^\w\s\-:.,]/g, '.');  // Replace special chars with dots for flexible matching

    let startPosition = 0;
    let endPosition = text.length;

    try {
      // Create regex to find section title (case insensitive)
      const escapedTitle = sanitizedTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const titleRegex = new RegExp(escapedTitle, 'i');

      const startMatch = text.match(titleRegex);
      if (startMatch) {
        startPosition = text.indexOf(startMatch[0]);
      }
    } catch (e) {
      // If regex fails, fall back to simple string search
      console.log('[DocumentParser] Regex failed for title, using string search:', sectionTitle.substring(0, 30));
      const simpleSearch = text.toLowerCase().indexOf(sectionTitle.substring(0, 20).toLowerCase());
      if (simpleSearch >= 0) {
        startPosition = simpleSearch;
      }
    }

    // If there's a next section, find where it starts
    if (nextSectionTitle) {
      try {
        const sanitizedNextTitle = nextSectionTitle
          .substring(0, 40)
          .replace(/[^\w\s\-:.,]/g, '.');
        const escapedNextTitle = sanitizedNextTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const nextTitleRegex = new RegExp(escapedNextTitle, 'i');
        const nextMatch = text.substring(startPosition + 100).match(nextTitleRegex);  // +100 to skip current title

        if (nextMatch) {
          endPosition = startPosition + 100 + text.substring(startPosition + 100).indexOf(nextMatch[0]);
        }
      } catch (e) {
        // If regex fails, fall back to simple string search
        const simpleSearch = text.toLowerCase().indexOf(nextSectionTitle.substring(0, 20).toLowerCase(), startPosition + 100);
        if (simpleSearch >= 0) {
          endPosition = simpleSearch;
        }
      }
    }

    const content = text.substring(startPosition, endPosition).trim();

    // Generate HTML for this section
    const htmlContent = this.convertTextToHtml(content);

    return {
      content,
      htmlContent,
      startPosition,
      endPosition
    };
  }

  /**
   * Split document by headers when no TOC is found
   * Detects headers from HTML tags and text patterns
   * Returns sections based on detected headers
   */
  splitByHeaders(htmlContent: string, rawText: string): TOCBasedSection[] {
    const sections: TOCBasedSection[] = [];

    // First, try to split by HTML header tags (h1, h2)
    const headerRegex = /<h([1-2])[^>]*>(.*?)<\/h\1>/gi;
    const matches = [...htmlContent.matchAll(headerRegex)];

    console.log(`[DocumentParser] Found ${matches.length} HTML headers for header-based splitting`);

    if (matches.length > 0) {
      // Split by HTML headers
      for (let i = 0; i < matches.length; i++) {
        const match = matches[i];
        const headerLevel = parseInt(match[1], 10);
        const headerText = match[2].replace(/<[^>]*>/g, '').trim(); // Strip inner tags
        const headerIndex = match.index!;

        // Find end of this section (start of next header or end of document)
        const nextMatch = matches[i + 1];
        const endIndex = nextMatch ? nextMatch.index! : htmlContent.length;

        // Extract content between headers
        const sectionHtml = htmlContent.substring(headerIndex, endIndex);

        // Try to detect standard code from header text
        const { standardCode, specCode } = this.extractStandardFromTOCTitle(headerText);

        // Determine section type
        const sectionType = this.determineSectionType(headerText, standardCode);
        const isMatrix = this.isTOCEntryMatrix(headerText);
        const isSupportingEvidence = this.isTOCSupportingEvidence(headerText);

        // Build hints for AI
        let standardHint = '';
        let specHint = '';
        if (standardCode) {
          standardHint = `Standard ${standardCode}`;
          if (specCode) {
            specHint = `Specification ${specCode}`;
          }
        }

        sections.push({
          id: uuidv4(),
          tocEntry: {
            title: headerText,
            level: headerLevel,
            standardCode,
            specCode,
            sectionType,
            isMatrix,
            isSupportingEvidence
          },
          content: sectionHtml.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim(), // Plain text
          htmlContent: sectionHtml,
          startPosition: headerIndex,
          endPosition: endIndex,
          standardHint,
          specHint
        });
      }

      console.log(`[DocumentParser] Created ${sections.length} sections from HTML headers`);
      return sections;
    }

    // Fallback: Try to detect headers from raw text patterns
    console.log('[DocumentParser] No HTML headers found, trying text pattern detection');
    const textSections = this.splitByTextPatterns(rawText);

    if (textSections.length > 0) {
      console.log(`[DocumentParser] Created ${textSections.length} sections from text patterns`);
      return textSections;
    }

    // No structure found - return empty (caller should handle this)
    console.log('[DocumentParser] No document structure detected');
    return [];
  }

  /**
   * Split document by text patterns when no HTML headers exist
   * Detects patterns like "STANDARD X", "Standard X:", numbered sections, etc.
   */
  private splitByTextPatterns(rawText: string): TOCBasedSection[] {
    const sections: TOCBasedSection[] = [];
    const lines = rawText.split('\n');

    // Patterns that indicate headers
    const headerPatterns = [
      /^STANDARD\s+\d+/i,                           // STANDARD 1, Standard 1
      /^Standard\s+\d+[\s:.\-]/i,                   // Standard 1:, Standard 1 -
      /^PART\s+[IVXLCDM]+[\s:.\-]/i,               // PART I:, Part II -
      /^CHAPTER\s+\d+[\s:.\-]/i,                   // Chapter 1:
      /^SECTION\s+[IVXLCDM\d]+[\s:.\-]/i,          // Section I:, Section 1:
      /^[A-Z][A-Z\s]{10,}$/,                        // ALL CAPS HEADERS (min 10 chars)
      /^\d+\.\s+[A-Z]/,                             // 1. Title (numbered sections)
      /^\d+\.\d+\s+[A-Z]/,                          // 1.1 Title (sub-numbered sections)
    ];

    let currentSection: { title: string; startLine: number; content: string[] } | null = null;
    let sectionIndex = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      // Check if this line matches a header pattern
      const isHeader = headerPatterns.some(pattern => pattern.test(line)) && line.length < 150;

      if (isHeader) {
        // Save previous section if exists
        if (currentSection && currentSection.content.length > 0) {
          const content = currentSection.content.join('\n').trim();
          if (content.length > 50) { // Only save substantial sections
            const { standardCode, specCode } = this.extractStandardFromTOCTitle(currentSection.title);
            const sectionType = this.determineSectionType(currentSection.title, standardCode);

            sections.push({
              id: uuidv4(),
              tocEntry: {
                title: currentSection.title,
                level: 1,
                standardCode,
                specCode,
                sectionType,
                isMatrix: this.isTOCEntryMatrix(currentSection.title),
                isSupportingEvidence: this.isTOCSupportingEvidence(currentSection.title)
              },
              content: content,
              htmlContent: this.convertTextToHtml(content),
              startPosition: sectionIndex,
              endPosition: i,
              standardHint: standardCode ? `Standard ${standardCode}` : '',
              specHint: specCode ? `Specification ${specCode}` : ''
            });
          }
        }

        // Start new section
        currentSection = {
          title: line,
          startLine: i,
          content: [line]
        };
        sectionIndex = i;
      } else if (currentSection) {
        // Add line to current section
        currentSection.content.push(line);
      }
    }

    // Save last section
    if (currentSection && currentSection.content.length > 0) {
      const content = currentSection.content.join('\n').trim();
      if (content.length > 50) {
        const { standardCode, specCode } = this.extractStandardFromTOCTitle(currentSection.title);
        const sectionType = this.determineSectionType(currentSection.title, standardCode);

        sections.push({
          id: uuidv4(),
          tocEntry: {
            title: currentSection.title,
            level: 1,
            standardCode,
            specCode,
            sectionType,
            isMatrix: this.isTOCEntryMatrix(currentSection.title),
            isSupportingEvidence: this.isTOCSupportingEvidence(currentSection.title)
          },
          content: content,
          htmlContent: this.convertTextToHtml(content),
          startPosition: sectionIndex,
          endPosition: lines.length,
          standardHint: standardCode ? `Standard ${standardCode}` : '',
          specHint: specCode ? `Specification ${specCode}` : ''
        });
      }
    }

    return sections;
  }

  /**
   * Enhanced parse method that uses TOC for intelligent sectioning
   * This should be called instead of the basic parse() for self-study documents
   *
   * Fallback order:
   * 1. TOC-based parsing (if Table of Contents found)
   * 2. Header-based parsing (split by h1, h2 or text patterns)
   * 3. Error if no structure detected
   */
  async parseWithTOC(buffer: Buffer, filename: string): Promise<{
    document: ParsedDocument;
    tocEntries: TOCEntry[];
    sections: TOCBasedSection[];
  }> {
    // First, do the basic parse
    const document = await this.parse(buffer, filename);

    // Extract TOC
    const tocEntries = this.extractTableOfContents(document.rawText);

    // If TOC found, use TOC-based splitting
    if (tocEntries.length > 0) {
      console.log(`[DocumentParser] Using TOC-based parsing (${tocEntries.length} entries)`);
      const sections = this.splitDocumentByTOC(
        document.rawText,
        document.htmlContent,
        tocEntries
      );

      return {
        document,
        tocEntries,
        sections
      };
    }

    // No TOC found - fall back to header-based splitting
    console.log('[DocumentParser] No TOC found, falling back to header-based splitting');
    const headerSections = this.splitByHeaders(document.htmlContent, document.rawText);

    if (headerSections.length > 1) {
      console.log(`[DocumentParser] Header-based parsing found ${headerSections.length} sections`);
      return {
        document,
        tocEntries: [], // No TOC
        sections: headerSections
      };
    }

    // No structure detected - throw error for documents that can't be processed
    const isPDF = filename.toLowerCase().endsWith('.pdf');
    const errorMessage = isPDF
      ? 'PDF_NO_STRUCTURE: This PDF does not have recognizable section headers. Please use a document with clear section headings (e.g., "Standard 1: Program Identity", "STANDARD 1", or numbered sections like "1. Introduction") or convert to DOCX format with proper heading styles.'
      : 'NO_STRUCTURE: This document does not have recognizable section headers. Please ensure your document has clear section headings using heading styles (Heading 1, Heading 2) or patterns like "Standard 1:", "SECTION I:", etc.';

    console.error(`[DocumentParser] ${errorMessage}`);
    throw new Error(errorMessage);
  }

  /**
   * Format section content for AI processing
   * Adds hints about standard/spec and section type
   */
  formatSectionForAI(section: TOCBasedSection): string {
    let formattedContent = '';

    // Add section title as heading
    formattedContent += `# ${section.tocEntry.title}\n\n`;

    // Add standard/spec hints if available
    if (section.standardHint) {
      formattedContent += `[STANDARD HINT: ${section.standardHint}`;
      if (section.specHint) {
        formattedContent += ` - ${section.specHint}`;
      }
      formattedContent += ']\n\n';
    }

    // Add section type hint
    if (section.tocEntry.isMatrix) {
      formattedContent += '[SECTION TYPE: CURRICULUM MATRIX - This should be imported into the curriculum matrix grid]\n\n';
    } else if (section.tocEntry.isSupportingEvidence) {
      formattedContent += '[SECTION TYPE: SUPPORTING EVIDENCE - This is supplementary documentation]\n\n';
    }

    // Add the actual content
    formattedContent += section.content;

    return formattedContent;
  }

  /**
   * Get sections filtered by type for specific processing
   */
  filterSectionsByType(sections: TOCBasedSection[], type: 'standard' | 'matrix' | 'supporting_evidence'): TOCBasedSection[] {
    return sections.filter(s => {
      if (type === 'matrix') {
        return s.tocEntry.isMatrix;
      }
      if (type === 'supporting_evidence') {
        return s.tocEntry.isSupportingEvidence;
      }
      return s.tocEntry.sectionType === type;
    });
  }
}

export const documentParserService = new DocumentParserService();
