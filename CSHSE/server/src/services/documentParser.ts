import mammoth from 'mammoth';
import pdfParse from 'pdf-parse';
import { v4 as uuidv4 } from 'uuid';
import * as tempFileService from './tempFileService';
import * as gridFsService from './gridFsService';

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

/**
 * Detected section for user selection before AI processing
 * Uses structural headers (Roman numerals, Letters, Numbers)
 */
export interface DetectedSection {
  id: string;
  level: 1 | 2 | 3;  // Hierarchy level
  headerType: 'roman' | 'letter' | 'number' | 'standard' | 'appendix' | 'heading';
  headerText: string;  // e.g., "I. GENERAL PROGRAM CHARACTERISTICS"
  previewText: string;  // First 200 chars of content
  fullContent: string;  // Complete section content
  htmlContent: string;  // HTML version for display
  startPosition: number;
  endPosition: number;
  isAppendix: boolean;
  isSelected: boolean;  // Default true, user can uncheck
  parentId?: string;    // For hierarchy tracking
  children: DetectedSection[];  // Nested sub-sections
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
   * Parse DOCX document for manual tagging workflow
   * Extracts HTML with images saved to temp files
   * Images are referenced via API URLs for serving
   */
  async parseDOCXForManualTagging(
    buffer: Buffer,
    importId: string
  ): Promise<{ htmlContent: string; rawText: string; imageCount: number }> {
    console.log(`[DocumentParser] Parsing DOCX for manual tagging, importId: ${importId}`);

    // Initialize temp directory
    await tempFileService.initTempDirectory(importId);

    let imageCount = 0;

    // Extract raw text
    const textResult = await mammoth.extractRawText({ buffer });
    const rawText = textResult.value;

    // Convert to HTML with images saved to temp files
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
        "p[style-name='Intense Emphasis'] => strong"
      ],
      convertImage: mammoth.images.imgElement(async (image) => {
        try {
          // Read image data
          const imageBuffer = await image.read();
          const contentType = image.contentType || 'image/png';

          // Generate unique filename
          const extension = contentType.split('/')[1] || 'png';
          const filename = `image_${uuidv4()}.${extension}`;

          // Save to GridFS for persistence (temp files are lost on Railway)
          await gridFsService.storeImage(importId, imageBuffer, filename, contentType);
          imageCount++;

          // Return img tag pointing to our API endpoint
          return {
            src: `/api/imports/${importId}/images/${filename}`
          };
        } catch (error) {
          console.error(`[DocumentParser] Error saving image:`, error);
          // Return placeholder on error
          return { src: '' };
        }
      })
    });

    let htmlContent = htmlResult.value;

    // Log any conversion messages
    if (htmlResult.messages && htmlResult.messages.length > 0) {
      console.log(`[DocumentParser] Mammoth messages:`, htmlResult.messages);
    }

    // Enhance HTML with headers if none detected
    if (!htmlContent.includes('<h1') && !htmlContent.includes('<h2')) {
      htmlContent = this.enhanceHtmlWithHeaders(htmlContent);
    }

    // Wrap in basic HTML structure for better display
    htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; padding: 20px; max-width: 100%; }
          h1 { color: #1a365d; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px; margin-top: 24px; }
          h2 { color: #2d3748; margin-top: 20px; }
          h3 { color: #4a5568; margin-top: 16px; }
          table { border-collapse: collapse; width: 100%; margin: 16px 0; }
          th, td { border: 1px solid #e2e8f0; padding: 8px; text-align: left; }
          th { background-color: #f7fafc; }
          img { max-width: 100%; height: auto; margin: 8px 0; }
          p { margin: 8px 0; }
          ul, ol { margin: 8px 0; padding-left: 24px; }
        </style>
      </head>
      <body>
        ${htmlContent}
      </body>
      </html>
    `;

    // Save HTML to temp file
    await tempFileService.saveHtmlContent(importId, htmlContent);

    console.log(`[DocumentParser] Manual tagging parse complete: ${rawText.length} chars text, ${imageCount} images`);

    return {
      htmlContent,
      rawText,
      imageCount
    };
  }

  /**
   * Parse PDF document for manual tagging workflow
   * Converts text to HTML and saves to temp files
   */
  async parsePDFForManualTagging(
    buffer: Buffer,
    importId: string
  ): Promise<{ htmlContent: string; rawText: string; imageCount: number }> {
    console.log(`[DocumentParser] Parsing PDF for manual tagging, importId: ${importId}`);

    // Initialize temp directory
    await tempFileService.initTempDirectory(importId);

    // Parse PDF
    const data = await pdfParse(buffer);
    const rawText = data.text;

    // Convert text to HTML
    let htmlContent = this.convertTextToHtml(rawText);

    // Wrap in basic HTML structure
    htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; padding: 20px; max-width: 100%; }
          h1 { color: #1a365d; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px; margin-top: 24px; }
          h2 { color: #2d3748; margin-top: 20px; }
          h3 { color: #4a5568; margin-top: 16px; }
          table { border-collapse: collapse; width: 100%; margin: 16px 0; }
          th, td { border: 1px solid #e2e8f0; padding: 8px; text-align: left; }
          th { background-color: #f7fafc; }
          p { margin: 8px 0; }
          ul, ol { margin: 8px 0; padding-left: 24px; }
        </style>
      </head>
      <body>
        ${htmlContent}
      </body>
      </html>
    `;

    // Save HTML to temp file
    await tempFileService.saveHtmlContent(importId, htmlContent);

    console.log(`[DocumentParser] PDF manual tagging parse complete: ${rawText.length} chars text`);

    return {
      htmlContent,
      rawText,
      imageCount: 0 // PDF image extraction not implemented yet
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

      console.log(`[DocumentParser] Starting TOC parsing from line ${tocStartIndex}`);

      // DEBUG: Log the first 30 lines after TOC start to see what we're working with
      console.log('[DocumentParser] === FIRST 30 LINES AFTER TOC START ===');
      for (let debugIdx = tocStartIndex; debugIdx < Math.min(tocStartIndex + 30, lines.length); debugIdx++) {
        const debugLine = lines[debugIdx];
        const trimmed = debugLine.trim();
        const endsWithNum = /\d{1,3}\s*$/.test(trimmed);
        console.log(`[DocumentParser] L${debugIdx}: [${trimmed.length}ch] ${endsWithNum ? '✓NUM' : '     '} "${trimmed.substring(0, 70)}${trimmed.length > 70 ? '...' : ''}"`);
      }
      console.log('[DocumentParser] === END DEBUG ===');

      // Parse TOC entries until we hit content that's clearly not TOC
      for (let i = tocStartIndex; i < maxLines && tocEntries.length < maxEntries; i++) {
        const line = lines[i].trim();

        // Skip empty lines (don't count as non-TOC)
        if (!line) continue;

        // STRONG END DETECTION: Lines that are clearly content, not TOC
        // 1. Very long lines (>120 chars) are paragraphs, not TOC entries
        if (line.length > 120) {
          console.log(`[DocumentParser] Line ${i}: TOO LONG (${line.length} chars): "${line.substring(0, 50)}..."`);
          consecutiveNonTocLines++;
          if (consecutiveNonTocLines >= maxConsecutiveNonToc) {
            console.log(`[DocumentParser] Stopping TOC parsing: ${consecutiveNonTocLines} consecutive non-TOC lines`);
            break;
          }
          continue;
        }

        // 2. Lines without page numbers are NOT TOC entries - they're sub-items that should stay as content
        // Check for both separator-based and concatenated page numbers
        // Pattern 1: separator then digits: "Title...123" or "Title    123"
        // Pattern 2: just ends with digits: "Title123" or "Title 123"
        const separatorPattern = /[.\s…\t]+(\d{1,3})\s*$/.test(line);
        const endsWithDigits = /\d{1,3}\s*$/.test(line);
        const hasPageNumberPattern = separatorPattern || endsWithDigits;

        if (!hasPageNumberPattern) {
          // Check if this is a section header like "PART I: GENERAL STANDARDS" - don't count these against consecutive limit
          const isSectionHeader = /^(PART\s+[IVX]+|SECTION\s+\d+)/i.test(line);
          if (isSectionHeader) {
            console.log(`[DocumentParser] Line ${i}: SECTION HEADER (skipping): "${line.substring(0, 60)}"`);
            // Don't increment consecutiveNonTocLines for section headers
            continue;
          }

          // Check if this looks like a TOC sub-entry (short, no punctuation at end, likely a nested item)
          // Sub-entries are part of TOC structure but don't have page numbers - don't count against limit
          const looksLikeTocSubEntry = line.length < 60 && !/[.!?]$/.test(line) && !/^\d+\.\s/.test(line);
          if (looksLikeTocSubEntry) {
            console.log(`[DocumentParser] Line ${i}: TOC SUB-ENTRY (skipping, not counting): "${line.substring(0, 60)}"`);
            // Don't increment consecutiveNonTocLines for TOC sub-entries
            continue;
          }

          console.log(`[DocumentParser] Line ${i}: NO PAGE NUMBER (${consecutiveNonTocLines + 1}/${maxConsecutiveNonToc}): "${line.substring(0, 60)}"`);
          consecutiveNonTocLines++;
          if (consecutiveNonTocLines >= maxConsecutiveNonToc) {
            console.log(`[DocumentParser] Stopping TOC parsing: no page numbers detected`);
            break;
          }
          continue;
        }

        // Log successful pattern match
        console.log(`[DocumentParser] Line ${i}: HAS PAGE NUMBER: "${line.substring(0, 60)}"`)

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
        console.log(`[DocumentParser] parseTOCEntry: REJECTED (too short or digits only): "${line}"`);
        return null;
      }

      // Skip lines that are too long to be TOC entries (likely paragraphs)
      if (line.length > 100) {
        console.log(`[DocumentParser] parseTOCEntry: REJECTED (too long): "${line.substring(0, 50)}..."`);
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
        // Use NON-GREEDY quantifier (.{5,}?) to avoid capturing digits in the title
        // E.g., "Standard 4 – Program Evaluation20" should extract "20" not "0"
        pageMatch = line.match(/^(.{5,}?)(\d{1,3})\s*$/);
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
        console.log(`[DocumentParser] parseTOCEntry: REJECTED (empty title after page extraction): "${line.substring(0, 50)}"`);
        return null;
      }

      // STRICT VALIDATION: REQUIRE page number for all TOC entries
      // Sub-entries without page numbers (like "1. Title" or "a. Title") stay as document content
      if (!hasPageNumber) {
        console.log(`[DocumentParser] parseTOCEntry: REJECTED (no page number found): "${line.substring(0, 50)}"`);
        return null;
      }

      console.log(`[DocumentParser] parseTOCEntry: ACCEPTED "${title.substring(0, 40)}" page=${pageNumber}`);

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
   * First tries HTML headers, then falls back to text-based extraction
   */
  splitDocumentByTOC(text: string, htmlContent: string, tocEntries: TOCEntry[]): TOCBasedSection[] {
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

    // Try HTML header-based extraction first
    const htmlSections = this.extractSectionsViaHtmlHeaders(htmlContent, tocEntries);

    if (htmlSections.length > 0) {
      console.log(`[DocumentParser] HTML header extraction succeeded: ${htmlSections.length} sections`);
      return htmlSections;
    }

    // Fallback: Use text-based extraction
    console.log('[DocumentParser] HTML header matching failed, falling back to text-based extraction');
    const textSections = this.extractSectionsViaText(text, htmlContent, tocEntries);

    console.log(`[DocumentParser] Text-based extraction: ${textSections.length} sections`);
    return textSections;
  }

  /**
   * Extract sections by matching TOC entries to HTML headers
   */
  private extractSectionsViaHtmlHeaders(htmlContent: string, tocEntries: TOCEntry[]): TOCBasedSection[] {
    const sections: TOCBasedSection[] = [];

    // Step 1: Find all HTML headers in the document
    const htmlHeaders = this.extractHtmlHeaders(htmlContent);
    console.log(`[DocumentParser] Found ${htmlHeaders.length} HTML headers in document`);

    if (htmlHeaders.length === 0) {
      return sections;
    }

    // Step 2: Find where TOC ends - look for first content header after TOC
    const tocEndIndex = this.findTocEndIndex(htmlHeaders);
    console.log(`[DocumentParser] TOC ends at header index ${tocEndIndex}`);

    // Step 3: Get only the content headers (after TOC)
    const contentHeaders = htmlHeaders.slice(tocEndIndex);
    console.log(`[DocumentParser] ${contentHeaders.length} content headers after TOC`);

    // Step 4: For each TOC entry, find matching header in document body and extract content
    for (let i = 0; i < tocEntries.length; i++) {
      const entry = tocEntries[i];

      // Skip TOC itself
      if (entry.title.toLowerCase().includes('table of contents')) {
        continue;
      }

      // Find matching header in content (after TOC)
      const matchingHeaderIndex = this.findMatchingHeader(entry.title, contentHeaders);

      if (matchingHeaderIndex === -1) {
        console.log(`[DocumentParser] No matching header found for TOC entry: ${entry.title.substring(0, 40)}`);
        continue;
      }

      const matchingHeader = contentHeaders[matchingHeaderIndex];
      const nextHeader = contentHeaders[matchingHeaderIndex + 1];

      // Extract HTML content from this header to the next header
      const startPos = matchingHeader.position;
      const endPos = nextHeader ? nextHeader.position : htmlContent.length;

      const sectionHtml = htmlContent.substring(startPos, endPos);
      const sectionText = sectionHtml.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

      if (sectionText.length > 50) {  // Only include substantial sections
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
          content: sectionText,
          htmlContent: sectionHtml,
          startPosition: startPos,
          endPosition: endPos,
          standardHint,
          specHint
        });

        console.log(`[DocumentParser] Extracted section "${entry.title.substring(0, 30)}..." (${sectionText.length} chars)`);
      }
    }

    return sections;
  }

  /**
   * Extract sections by finding TOC entry titles in the document body
   * Strategy: Find where TOC ends, then search globally for each section title
   * Uses page-based estimation as fallback for sections that can't be found by title
   */
  private extractSectionsViaText(text: string, htmlContent: string, tocEntries: TOCEntry[]): TOCBasedSection[] {
    const sections: TOCBasedSection[] = [];
    const MAX_SECTION_SIZE = 50000; // 50KB max per section

    // Filter out TOC entry itself
    const contentEntries = tocEntries.filter(e =>
      !e.title.toLowerCase().includes('table of contents')
    );

    if (contentEntries.length === 0) {
      console.log('[DocumentParser] No content entries to extract');
      return sections;
    }

    const textLength = text.length;
    console.log(`[DocumentParser] Document stats: ${textLength} chars, ${contentEntries.length} TOC entries to find`);

    // Step 1: Find where the TOC ends in the document
    // TOC is usually in the first 5-15% of the document
    const tocEndPosition = this.findTocEndPosition(text);
    console.log(`[DocumentParser] TOC ends at approximately position ${tocEndPosition} (${Math.round(tocEndPosition / textLength * 100)}% of document)`);

    // Step 2: Estimate characters per page for page-number fallback
    // Get max page number from TOC entries
    const maxPage = Math.max(...contentEntries.map(e => e.pageNumber || 0), 1);
    const charsPerPage = Math.round((textLength - tocEndPosition) / Math.max(maxPage, 1));
    console.log(`[DocumentParser] Estimated ${charsPerPage} chars per page (max page: ${maxPage})`);

    // Step 3: Search for each section title globally from TOC end
    // Sort entries by page number to search in expected order
    const sortedEntries = [...contentEntries].sort((a, b) => (a.pageNumber || 0) - (b.pageNumber || 0));

    const sectionPositions: Array<{ entry: TOCEntry; position: number; foundByTitle: boolean }> = [];
    let lastFoundPosition = tocEndPosition; // Track last found position to search sequentially

    for (const entry of sortedEntries) {
      const isMatrixEntry = this.isTOCEntryMatrix(entry.title);
      console.log(`[DocumentParser] Searching for: "${entry.title.substring(0, 40)}..." (page ${entry.pageNumber || '?'})${isMatrixEntry ? ' [MATRIX]' : ''}`);

      // Search from last found position (sections should appear in order)
      let position = this.findSectionTitlePosition(text, entry.title, lastFoundPosition);

      if (position !== -1) {
        sectionPositions.push({ entry, position, foundByTitle: true });
        lastFoundPosition = position + 1; // Next section should be after this one
        console.log(`[DocumentParser] ✓ Found at position ${position}`);
      } else {
        // Fallback: search from TOC end (section might be out of expected order)
        position = this.findSectionTitlePosition(text, entry.title, tocEndPosition);
        if (position !== -1) {
          sectionPositions.push({ entry, position, foundByTitle: true });
          console.log(`[DocumentParser] ✓ Found via global search at position ${position}`);
        } else {
          // Last resort: search entire document
          position = this.findSectionTitlePosition(text, entry.title, 0);
          if (position !== -1 && position > tocEndPosition * 0.5) {
            // Only accept if it's after at least half the TOC area
            sectionPositions.push({ entry, position, foundByTitle: true });
            console.log(`[DocumentParser] ✓ Found via full search at position ${position}`);
          } else {
            // PAGE NUMBER FALLBACK: Estimate position based on page number
            // This is crucial for matrix sections that may not have matching headers
            if (entry.pageNumber && entry.pageNumber > 0) {
              const estimatedPosition = tocEndPosition + ((entry.pageNumber - 1) * charsPerPage);
              // Clamp to document bounds
              const clampedPosition = Math.min(Math.max(estimatedPosition, tocEndPosition), textLength - 100);
              sectionPositions.push({ entry, position: clampedPosition, foundByTitle: false });
              console.log(`[DocumentParser] ⚠ Using page-based estimate for "${entry.title.substring(0, 30)}..." at position ${clampedPosition} (page ${entry.pageNumber})`);
            } else {
              console.log(`[DocumentParser] ✗ Could not find: "${entry.title.substring(0, 30)}..." (no page number for fallback)`);
            }
          }
        }
      }
    }

    // Sort by position to ensure correct extraction order
    sectionPositions.sort((a, b) => a.position - b.position);

    // Log summary of found vs estimated sections
    const foundByTitle = sectionPositions.filter(s => s.foundByTitle).length;
    const foundByPage = sectionPositions.filter(s => !s.foundByTitle).length;
    console.log(`[DocumentParser] Found ${sectionPositions.length} section positions: ${foundByTitle} by title, ${foundByPage} by page estimate`);

    // Log any matrix sections that were estimated
    const matrixSections = sectionPositions.filter(s => this.isTOCEntryMatrix(s.entry.title));
    if (matrixSections.length > 0) {
      console.log(`[DocumentParser] Matrix sections found: ${matrixSections.map(s => `"${s.entry.title.substring(0, 30)}" (${s.foundByTitle ? 'title' : 'page estimate'})`).join(', ')}`);
    }

    // Now extract content between consecutive sections
    for (let i = 0; i < sectionPositions.length; i++) {
      const current = sectionPositions[i];
      const next = sectionPositions[i + 1];

      // Section content goes from current position to next position (or end of document)
      const startPos = current.position;
      let endPos = next ? next.position : text.length;

      // Cap section size
      if (endPos - startPos > MAX_SECTION_SIZE) {
        endPos = startPos + MAX_SECTION_SIZE;
        console.log(`[DocumentParser] Section capped at ${MAX_SECTION_SIZE} chars`);
      }

      const content = text.substring(startPos, endPos).trim();

      // Lower threshold for estimated sections (they might not start exactly at a header)
      // Also, matrix sections often contain tables which might be short in text form
      const isMatrixSection = this.isTOCEntryMatrix(current.entry.title);
      const minContentLength = isMatrixSection ? 20 : 50;

      if (content.length > minContentLength) {
        // Build standard hint for AI
        let standardHint = '';
        let specHint = '';

        if (current.entry.standardCode) {
          standardHint = `Standard ${current.entry.standardCode}`;
          if (current.entry.specCode) {
            specHint = `Specification ${current.entry.specCode}`;
          }
        }

        sections.push({
          id: uuidv4(),
          tocEntry: current.entry,
          content: content,
          htmlContent: this.convertTextToHtml(content),
          startPosition: startPos,
          endPosition: endPos,
          standardHint,
          specHint
        });

        const methodNote = current.foundByTitle ? '' : ' [PAGE ESTIMATE]';
        console.log(`[DocumentParser] Extracted: "${current.entry.title.substring(0, 30)}..." (${content.length} chars)${methodNote}${isMatrixSection ? ' [MATRIX]' : ''}`);
      } else {
        console.log(`[DocumentParser] ⚠ Skipped short section: "${current.entry.title.substring(0, 30)}..." (${content.length} chars, min: ${minContentLength})`);
      }
    }

    return sections;
  }

  /**
   * Find where the Table of Contents ends in the document text
   * TOC typically ends with patterns like page numbers, followed by actual content
   * Returns the position after which content begins
   */
  private findTocEndPosition(text: string): number {
    const textLower = text.toLowerCase();

    // Strategy 1: Look for "Table of Contents" and find where it ends
    const tocIndex = textLower.indexOf('table of contents');
    if (tocIndex === -1) {
      // No TOC found, assume content starts after first 5% of document
      return Math.floor(text.length * 0.05);
    }

    // Strategy 2: After TOC header, look for markers that indicate content start
    // Content typically starts with headers like "Certification", "Introductory", "Part I", "Standard 1"
    const contentStartPatterns = [
      /certification\s+of\s+the\s+self[\s-]*study/i,
      /introductory\s+information/i,
      /introductory\s+section/i,
      /part\s+i\s*[:\-–—]/i,
      /part\s+one\s*[:\-–—]/i,
      /standard\s+1\s*[:\-–—]/i,
      /general\s+standards/i,
      /^\s*I\.\s+[A-Z]/m,
      /^\s*1\.\s+[A-Z]/m
    ];

    // Search for content start patterns after the TOC header
    // TOC entries usually span 2-8 pages worth of text (roughly 6000-24000 chars)
    const searchStart = tocIndex + 500; // Start searching past "Table of Contents" text
    const searchEnd = Math.min(tocIndex + 50000, text.length); // Don't search too far
    const searchArea = text.substring(searchStart, searchEnd);

    for (const pattern of contentStartPatterns) {
      const match = searchArea.match(pattern);
      if (match && match.index !== undefined) {
        const position = searchStart + match.index;
        console.log(`[DocumentParser] Found content start marker "${match[0].substring(0, 30)}" at position ${position}`);
        return position;
      }
    }

    // Strategy 3: Look for a blank line followed by non-TOC content
    // TOC entries typically have page numbers at the end (e.g., "...12" or "....45")
    // Content doesn't have these trailing numbers
    const lines = text.substring(tocIndex, searchEnd).split('\n');
    let lastTocLineIndex = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      // TOC entries typically end with page numbers: "Title...12" or "Title    45"
      const hasTocPageNumber = /[.\s…]+\d{1,3}\s*$/.test(line) || /\d{1,3}\s*$/.test(line);

      if (hasTocPageNumber) {
        lastTocLineIndex = i;
      } else if (i > lastTocLineIndex + 3 && line.length > 50) {
        // We've gone 3+ lines without TOC-style entries and found substantial content
        // This is likely where content begins
        const linesBeforeContent = lines.slice(0, i).join('\n');
        const position = tocIndex + linesBeforeContent.length;
        console.log(`[DocumentParser] Content appears to start at position ${position} (after line ${i})`);
        return position;
      }
    }

    // Fallback: estimate based on document size
    // TOC is usually 2-5% of a self-study document
    const estimatedTocEnd = Math.min(
      tocIndex + 15000, // ~5 pages of TOC
      Math.floor(text.length * 0.08) // 8% of document
    );
    console.log(`[DocumentParser] Using fallback TOC end estimate: ${estimatedTocEnd}`);
    return estimatedTocEnd;
  }

  /**
   * Find position of a section title in text, starting from a given position
   * Returns -1 if not found
   *
   * Uses multiple matching strategies since TOC titles often differ from actual headers:
   * - TOC: "Standard 1 – Institutional Requirements..." but document header is just "Institutional Requirements..."
   * - Different dash types, spacing, punctuation
   *
   * IMPORTANT: Validates matches to ensure they're actual content headers, not TOC entries
   */
  private findSectionTitlePosition(text: string, title: string, startFrom: number): number {
    const searchText = text.substring(startFrom);
    const searchTextLower = searchText.toLowerCase();

    // IMPORTANT: Strip common prefixes from title since document headers often don't include them
    // TOC says "Standard 1 – Institutional Requirements" but header is just "Institutional Requirements"
    const titleWithoutPrefix = this.stripStandardPrefix(title);
    console.log(`[DocumentParser] Searching for: "${title.substring(0, 40)}" → stripped: "${titleWithoutPrefix.substring(0, 40)}"`);

    // Helper to validate a match is not inside TOC (doesn't have trailing page numbers)
    const isValidContentMatch = (pos: number): boolean => {
      // Get the line at this position
      const lineStart = searchText.lastIndexOf('\n', pos) + 1;
      const lineEnd = searchText.indexOf('\n', pos);
      const line = searchText.substring(lineStart, lineEnd !== -1 ? lineEnd : lineStart + 200);

      // TOC entries have trailing page numbers like "...12" or "    45"
      const hasTocPageNumber = /[.\s…]+\d{1,3}\s*$/.test(line.trim());
      if (hasTocPageNumber) {
        console.log(`[DocumentParser] Skipping TOC-like match: "${line.substring(0, 50)}..."`);
        return false;
      }
      return true;
    };

    // Strategy 1: Match on the title WITHOUT the prefix (most common case)
    if (titleWithoutPrefix.length >= 8) {
      // Try key word matching on stripped title
      const strippedKeyWords = this.extractKeyWords(titleWithoutPrefix);
      if (strippedKeyWords.length >= 2) {
        const position = this.findKeyWordSequence(searchText, strippedKeyWords);
        if (position !== -1 && isValidContentMatch(position)) {
          console.log(`[DocumentParser] Matched on stripped title key words: ${strippedKeyWords.slice(0, 3).join(', ')}`);
          return startFrom + position;
        }
      }

      // Try direct substring match on stripped title (first 20-30 chars)
      const strippedNormalized = this.normalizeTitleForSearch(titleWithoutPrefix);
      for (const len of [30, 20, 15]) {
        const searchChunk = strippedNormalized.substring(0, len);
        if (searchChunk.length >= 8) {
          const normalizedSearch = this.normalizeTitleForSearch(searchText.substring(0, Math.min(searchText.length, 500000)));
          const pos = normalizedSearch.indexOf(searchChunk);
          if (pos !== -1 && isValidContentMatch(pos)) {
            console.log(`[DocumentParser] Matched on stripped normalized title (${len} chars)`);
            return startFrom + pos;
          }
        }
      }
    }

    // Strategy 2: Try to match on "Standard X" pattern (for documents that DO include it)
    const standardMatch = title.match(/standard\s*(\d+)/i);
    if (standardMatch) {
      const standardNum = standardMatch[1];
      // Build a flexible regex: "Standard" + optional whitespace/separator + number
      const standardRegex = new RegExp(`standard\\s*${standardNum}\\b`, 'gi');
      let match;
      while ((match = standardRegex.exec(searchText)) !== null) {
        // Found "Standard X" - verify it's not inside TOC
        if (isValidContentMatch(match.index)) {
          console.log(`[DocumentParser] Matched on "Standard ${standardNum}" pattern`);
          return startFrom + match.index;
        }
      }
    }

    // Strategy 3: Full key words match (original title)
    const keyWords = this.extractKeyWords(title);
    if (keyWords.length >= 2) {
      const position = this.findKeyWordSequence(searchText, keyWords);
      if (position !== -1 && isValidContentMatch(position)) {
        console.log(`[DocumentParser] Matched on full title key words: ${keyWords.slice(0, 3).join(', ')}`);
        return startFrom + position;
      }
    }

    // Strategy 4: Simple substring match on stripped title
    const firstPart = titleWithoutPrefix.substring(0, 25).toLowerCase()
      .replace(/[–—:;\-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (firstPart.length >= 8) {
      let searchPos = 0;
      while (searchPos < searchTextLower.length) {
        const simplePos = searchTextLower.indexOf(firstPart, searchPos);
        if (simplePos === -1) break;
        if (isValidContentMatch(simplePos)) {
          console.log(`[DocumentParser] Matched on simple substring: "${firstPart}"`);
          return startFrom + simplePos;
        }
        searchPos = simplePos + 1;
      }
    }

    // Strategy 5: Try matching individual significant words (last resort)
    // Find the first unique-ish word from the title that's long enough
    const significantWords = this.extractKeyWords(titleWithoutPrefix)
      .filter(w => w.length >= 6);  // Only words 6+ chars

    for (const word of significantWords.slice(0, 3)) {
      let searchPos = 0;
      while (searchPos < searchTextLower.length) {
        const wordPos = searchTextLower.indexOf(word, searchPos);
        if (wordPos === -1) break;
        if (isValidContentMatch(wordPos)) {
          console.log(`[DocumentParser] Matched on significant word: "${word}"`);
          return startFrom + wordPos;
        }
        searchPos = wordPos + 1;
      }
    }

    return -1;
  }

  /**
   * Strip common prefixes from a title that may not appear in the document header
   * TOC often has "Standard 1 – Title" but document header is just "Title"
   *
   * Handles various prefix patterns:
   * - "Standard 1 – Title"
   * - "Standard 1: Title"
   * - "Part I: Title"
   * - "Part II – Title"
   * - "Section 1 - Title"
   * - "Chapter 1: Title"
   * - "1. Title"
   * - "a. Title"
   * - "I. Title"
   */
  private stripStandardPrefix(title: string): string {
    // List of prefix patterns to strip (order matters - try most specific first)
    const prefixPatterns = [
      /^standard\s*\d+\s*[–—:\-\.]\s*/i,           // Standard 1 – Title, Standard 1: Title
      /^part\s*[IVXLCDM]+\s*[–—:\-\.]\s*/i,        // Part I: Title, Part II – Title
      /^section\s*[IVXLCDM\d]+\s*[–—:\-\.]\s*/i,   // Section I: Title, Section 1 - Title
      /^chapter\s*\d+\s*[–—:\-\.]\s*/i,            // Chapter 1: Title
      /^appendix\s*[A-Z\d]+\s*[–—:\-\.]\s*/i,      // Appendix A: Title
      /^\d+\.\d*\s+/,                               // 1. Title, 1.1 Title
      /^[a-z]\.\s+/i,                               // a. Title
      /^[IVXLCDM]+\.\s+/,                           // I. Title, II. Title
      /^\([a-z\d]+\)\s*/i,                          // (a) Title, (1) Title
    ];

    let result = title;
    for (const pattern of prefixPatterns) {
      const stripped = result.replace(pattern, '').trim();
      if (stripped.length > 5 && stripped.length < result.length) {
        result = stripped;
        break;  // Only strip one prefix
      }
    }

    return result;
  }

  /**
   * Extract key words from a title (nouns, important words)
   */
  private extractKeyWords(title: string): string[] {
    const stopWords = new Set(['the', 'and', 'of', 'in', 'to', 'for', 'a', 'an', 'with', 'on', 'at', 'by', 'is', 'are']);

    return title
      .toLowerCase()
      .replace(/[–—:;\-.,()]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2 && !stopWords.has(word))
      .slice(0, 6); // Take first 6 significant words
  }

  /**
   * Find a sequence of key words appearing close together in text
   */
  private findKeyWordSequence(text: string, keyWords: string[]): number {
    if (keyWords.length < 2) return -1;

    const textLower = text.toLowerCase();
    const firstWord = keyWords[0];

    // Find all occurrences of the first key word
    let searchPos = 0;
    while (searchPos < textLower.length) {
      const pos = textLower.indexOf(firstWord, searchPos);
      if (pos === -1) break;

      // Check if other key words appear within reasonable distance (300 chars)
      const windowStart = pos;
      const windowEnd = Math.min(pos + 300, textLower.length);
      const window = textLower.substring(windowStart, windowEnd);

      // Count how many key words appear in this window
      let matchCount = 0;
      for (const word of keyWords) {
        if (window.includes(word)) {
          matchCount++;
        }
      }

      // If at least 60% of key words found in window, consider it a match
      if (matchCount >= Math.ceil(keyWords.length * 0.6)) {
        return pos;
      }

      searchPos = pos + 1;
    }

    return -1;
  }

  /**
   * Normalize a title for flexible search matching
   */
  private normalizeTitleForSearch(text: string): string {
    return text
      .toLowerCase()
      .replace(/[–—:;\-.,()'"]/g, ' ')  // Replace separators with space
      .replace(/\s+/g, ' ')              // Collapse whitespace
      .trim();
  }

  /**
   * Extract all HTML headers (h1-h4) from HTML content with their positions
   */
  private extractHtmlHeaders(htmlContent: string): Array<{ level: number; text: string; position: number }> {
    const headers: Array<{ level: number; text: string; position: number }> = [];

    // Match h1-h4 tags
    const headerRegex = /<h([1-4])[^>]*>(.*?)<\/h\1>/gi;
    let match;

    while ((match = headerRegex.exec(htmlContent)) !== null) {
      const level = parseInt(match[1], 10);
      const rawText = match[2];
      // Strip any inner HTML tags and trim
      const text = rawText.replace(/<[^>]*>/g, '').trim();

      headers.push({
        level,
        text,
        position: match.index
      });
    }

    return headers;
  }

  /**
   * Find where the TOC ends by looking for first substantive content header
   * TOC entries often have page numbers (dots followed by number) or are in the first headers
   */
  private findTocEndIndex(headers: Array<{ level: number; text: string; position: number }>): number {
    // Look for markers that indicate end of TOC / start of content
    const contentStartMarkers = [
      /certification\s+of\s+the\s+self.?study/i,
      /introductory\s+information/i,
      /part\s+i[:\s]/i,
      /^standard\s+\d/i,
      /^I\.\s+/,
    ];

    // TOC entries typically have page numbers like "...1" or "....42"
    const tocEntryPattern = /\.{2,}\s*\d+\s*$/;

    for (let i = 0; i < headers.length; i++) {
      const header = headers[i];

      // Check if this looks like a content header (not a TOC entry)
      // TOC entries have page numbers, content headers don't
      const hasTocPageNumber = tocEntryPattern.test(header.text);

      if (!hasTocPageNumber) {
        // Check if it matches a content start marker
        for (const marker of contentStartMarkers) {
          if (marker.test(header.text)) {
            console.log(`[DocumentParser] Found content start marker at header ${i}: "${header.text.substring(0, 40)}"`);
            return i;
          }
        }
      }

      // After the first few headers, if we haven't found TOC indicators, assume TOC has ended
      // Most TOCs are in the first 20-30 headers
      if (i > 5 && !hasTocPageNumber) {
        // This header doesn't look like a TOC entry, content might be starting
        const nextFewHeaders = headers.slice(i, i + 3);
        const anyTocLike = nextFewHeaders.some(h => tocEntryPattern.test(h.text));

        if (!anyTocLike) {
          console.log(`[DocumentParser] TOC appears to end around header ${i}: "${header.text.substring(0, 40)}"`);
          return i;
        }
      }
    }

    // Default: assume first 5 headers are TOC-related
    return Math.min(5, headers.length);
  }

  /**
   * Find the header in the document body that matches a TOC entry title
   */
  private findMatchingHeader(
    tocTitle: string,
    contentHeaders: Array<{ level: number; text: string; position: number }>
  ): number {
    // Normalize the TOC title for comparison
    const normalizedTocTitle = this.normalizeTitle(tocTitle);

    // First pass: look for exact or near-exact match
    for (let i = 0; i < contentHeaders.length; i++) {
      const normalizedHeader = this.normalizeTitle(contentHeaders[i].text);

      // Exact match
      if (normalizedHeader === normalizedTocTitle) {
        return i;
      }

      // Check if one contains the other (for cases like "Standard 1 – Title" vs "Standard 1 - Title")
      if (normalizedHeader.includes(normalizedTocTitle) || normalizedTocTitle.includes(normalizedHeader)) {
        // Make sure it's a significant overlap (not just matching "Standard")
        const minLength = Math.min(normalizedHeader.length, normalizedTocTitle.length);
        if (minLength >= 10) {
          return i;
        }
      }
    }

    // Second pass: fuzzy match on key components
    // Extract standard code from TOC title if present
    const tocStandardMatch = tocTitle.match(/standard\s*(\d+)/i);
    const tocSpecMatch = tocTitle.match(/\b([a-z])\.\s/i) || tocTitle.match(/specification\s*([a-z])/i);

    if (tocStandardMatch) {
      const standardNum = tocStandardMatch[1];

      for (let i = 0; i < contentHeaders.length; i++) {
        const headerText = contentHeaders[i].text;
        const headerStandardMatch = headerText.match(/standard\s*(\d+)/i);

        if (headerStandardMatch && headerStandardMatch[1] === standardNum) {
          // Check if spec codes also match (if present)
          if (tocSpecMatch) {
            const headerSpecMatch = headerText.match(/\b([a-z])\.\s/i) || headerText.match(/specification\s*([a-z])/i);
            if (headerSpecMatch && headerSpecMatch[1].toLowerCase() === tocSpecMatch[1].toLowerCase()) {
              return i;
            }
          } else {
            // No spec code to match, just match on standard
            return i;
          }
        }
      }
    }

    // Third pass: match on first significant words
    const tocWords = normalizedTocTitle.split(/\s+/).filter(w => w.length > 3).slice(0, 5);
    if (tocWords.length >= 2) {
      for (let i = 0; i < contentHeaders.length; i++) {
        const headerWords = this.normalizeTitle(contentHeaders[i].text).split(/\s+/).filter(w => w.length > 3);

        // Check how many words match
        const matchingWords = tocWords.filter(w => headerWords.includes(w));
        if (matchingWords.length >= Math.min(3, tocWords.length)) {
          return i;
        }
      }
    }

    return -1;
  }

  /**
   * Normalize a title for comparison by removing special chars and extra whitespace
   */
  private normalizeTitle(title: string): string {
    return title
      .toLowerCase()
      .replace(/[–—-]/g, ' ')  // Normalize dashes
      .replace(/[^\w\s]/g, '') // Remove special chars
      .replace(/\s+/g, ' ')    // Normalize whitespace
      .trim();
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
    const matches: Array<{ level: number; text: string; index: number }> = [];
    let match;
    while ((match = headerRegex.exec(htmlContent)) !== null) {
      matches.push({
        level: parseInt(match[1], 10),
        text: match[2].replace(/<[^>]*>/g, '').trim(),
        index: match.index
      });
    }

    console.log(`[DocumentParser] Found ${matches.length} HTML headers for header-based splitting`);

    if (matches.length > 0) {
      // Split by HTML headers
      for (let i = 0; i < matches.length; i++) {
        const matchItem = matches[i];
        const headerLevel = matchItem.level;
        const headerText = matchItem.text;
        const headerIndex = matchItem.index;

        // Find end of this section (start of next header or end of document)
        const nextMatch = matches[i + 1];
        const endIndex = nextMatch ? nextMatch.index : htmlContent.length;

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
   * Enhanced parse method that uses HEADING STYLES as the PRIMARY method
   * for sectioning, with TOC used only for enrichment (standard code hints).
   *
   * This approach is more reliable because:
   * 1. Word heading styles (Heading 1, Heading 2) are preserved by mammoth as h1/h2
   * 2. The Table of Contents is generated FROM heading styles, so headings are authoritative
   * 3. Text matching TOC entries to document body is fragile and error-prone
   *
   * Process:
   * 1. Parse document - mammoth converts Word heading styles to HTML h1/h2/h3
   * 2. Split document by HTML headings (PRIMARY)
   * 3. Extract TOC for standard code hints (SECONDARY - enrichment only)
   * 4. Enrich sections with hints from TOC entries
   */
  async parseWithTOC(buffer: Buffer, filename: string): Promise<{
    document: ParsedDocument;
    tocEntries: TOCEntry[];
    sections: TOCBasedSection[];
  }> {
    // 1. Parse document - mammoth converts Word heading styles to HTML headings
    const document = await this.parse(buffer, filename);

    console.log(`[DocumentParser] Parsed document: ${document.rawText.length} chars, HTML: ${document.htmlContent.length} chars`);

    // 2. PRIMARY: Split document by HTML headings (from Word heading styles)
    // This is the authoritative structure - headings define sections
    const sections = this.splitByHtmlHeadings(document.htmlContent);

    console.log(`[DocumentParser] Found ${sections.length} sections from heading styles`);

    if (sections.length === 0) {
      // No headings found - try text pattern detection as fallback
      console.log('[DocumentParser] No HTML headings found, trying text pattern detection');
      const patternSections = this.splitByTextPatterns(document.rawText);

      if (patternSections.length > 1) {
        console.log(`[DocumentParser] Found ${patternSections.length} sections from text patterns`);

        // Still try to extract TOC for hints
        const tocEntries = this.extractTableOfContents(document.rawText);
        this.enrichSectionsWithTocHints(patternSections, tocEntries);

        return {
          document,
          tocEntries,
          sections: patternSections
        };
      }

      // No structure detected
      const isPDF = filename.toLowerCase().endsWith('.pdf');
      const errorMessage = isPDF
        ? 'PDF_NO_STRUCTURE: This PDF does not have recognizable section headers. Please use a DOCX document with proper heading styles (Heading 1, Heading 2).'
        : 'NO_STRUCTURE: This document does not have heading styles applied. Please ensure your document uses Word heading styles (Heading 1, Heading 2, etc.) for section headers.';

      console.error(`[DocumentParser] ${errorMessage}`);
      throw new Error(errorMessage);
    }

    // 3. SECONDARY: Extract TOC for standard code hints (enrichment only)
    const tocEntries = this.extractTableOfContents(document.rawText);
    console.log(`[DocumentParser] Found ${tocEntries.length} TOC entries for enrichment`);

    // 4. Enrich sections with hints from TOC (standard codes, section types)
    this.enrichSectionsWithTocHints(sections, tocEntries);

    // Log section summary
    const sectionSummary = sections.map(s => ({
      title: s.tocEntry.title.substring(0, 50),
      type: s.tocEntry.sectionType,
      isMatrix: s.tocEntry.isMatrix,
      standardHint: s.standardHint,
      contentLength: s.content.length
    }));
    console.log('[DocumentParser] Section summary:', JSON.stringify(sectionSummary, null, 2));

    return {
      document,
      tocEntries,
      sections
    };
  }

  /**
   * Split document by HTML heading tags (h1, h2, h3)
   * This is the PRIMARY method for sectioning - it uses the document's actual structure
   * as defined by Word heading styles.
   */
  private splitByHtmlHeadings(htmlContent: string): TOCBasedSection[] {
    const sections: TOCBasedSection[] = [];

    // Match h1, h2, h3 tags - these come from Word heading styles
    const headingRegex = /<h([1-3])[^>]*>(.*?)<\/h\1>/gi;
    const matches: Array<{ level: number; text: string; index: number; fullMatch: string }> = [];
    let match;

    while ((match = headingRegex.exec(htmlContent)) !== null) {
      const headingText = match[2].replace(/<[^>]*>/g, '').trim();

      // Skip empty headings and TOC itself
      if (!headingText || headingText.length < 2) continue;
      if (headingText.toLowerCase().includes('table of contents')) continue;
      if (headingText.toLowerCase() === 'contents') continue;

      matches.push({
        level: parseInt(match[1], 10),
        text: headingText,
        index: match.index,
        fullMatch: match[0]
      });
    }

    console.log(`[DocumentParser] Found ${matches.length} heading tags in HTML`);

    if (matches.length === 0) {
      return sections;
    }

    // Create sections from headings
    for (let i = 0; i < matches.length; i++) {
      const currentMatch = matches[i];
      const nextMatch = matches[i + 1];

      // Extract content from this heading to the next heading (or end of document)
      const startPos = currentMatch.index;
      const endPos = nextMatch ? nextMatch.index : htmlContent.length;
      const sectionHtml = htmlContent.substring(startPos, endPos);

      // Convert to plain text for content
      const sectionText = sectionHtml.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

      // Skip very short sections (likely just the heading with no content)
      if (sectionText.length < 50) {
        console.log(`[DocumentParser] Skipping short section: "${currentMatch.text.substring(0, 40)}..." (${sectionText.length} chars)`);
        continue;
      }

      // Determine section type from title
      const { standardCode, specCode } = this.extractStandardFromTOCTitle(currentMatch.text);
      const sectionType = this.determineSectionType(currentMatch.text, standardCode);
      const isMatrix = this.isTOCEntryMatrix(currentMatch.text);
      const isSupportingEvidence = this.isTOCSupportingEvidence(currentMatch.text);

      // Build hints
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
          title: currentMatch.text,
          level: currentMatch.level,
          standardCode,
          specCode,
          sectionType,
          isMatrix,
          isSupportingEvidence
        },
        content: sectionText,
        htmlContent: sectionHtml,
        startPosition: startPos,
        endPosition: endPos,
        standardHint,
        specHint
      });
    }

    return sections;
  }

  /**
   * Enrich sections with hints from TOC entries
   * This matches section titles to TOC entries to get standard codes and section types
   */
  private enrichSectionsWithTocHints(sections: TOCBasedSection[], tocEntries: TOCEntry[]): void {
    if (tocEntries.length === 0) return;

    for (const section of sections) {
      // Try to find a matching TOC entry
      const matchingToc = this.findMatchingTocEntry(section.tocEntry.title, tocEntries);

      if (matchingToc) {
        // Update section with TOC info
        if (matchingToc.standardCode && !section.tocEntry.standardCode) {
          section.tocEntry.standardCode = matchingToc.standardCode;
          section.standardHint = `Standard ${matchingToc.standardCode}`;
        }
        if (matchingToc.specCode && !section.tocEntry.specCode) {
          section.tocEntry.specCode = matchingToc.specCode;
          section.specHint = `Specification ${matchingToc.specCode}`;
        }
        if (matchingToc.isMatrix) {
          section.tocEntry.isMatrix = true;
          section.tocEntry.sectionType = 'matrix';
        }
        if (matchingToc.isSupportingEvidence) {
          section.tocEntry.isSupportingEvidence = true;
          section.tocEntry.sectionType = 'supporting_evidence';
        }
        if (matchingToc.sectionType !== 'general' && section.tocEntry.sectionType === 'general') {
          section.tocEntry.sectionType = matchingToc.sectionType;
        }

        console.log(`[DocumentParser] Enriched section "${section.tocEntry.title.substring(0, 30)}..." with TOC hints: std=${matchingToc.standardCode}, matrix=${matchingToc.isMatrix}`);
      }
    }
  }

  /**
   * Find a TOC entry that matches a section title
   * Uses fuzzy matching to handle minor differences
   */
  private findMatchingTocEntry(sectionTitle: string, tocEntries: TOCEntry[]): TOCEntry | null {
    const normalizedTitle = this.normalizeTitle(sectionTitle);

    for (const entry of tocEntries) {
      const normalizedEntry = this.normalizeTitle(entry.title);

      // Exact match
      if (normalizedEntry === normalizedTitle) {
        return entry;
      }

      // One contains the other (for cases with numbering differences)
      if (normalizedEntry.includes(normalizedTitle) || normalizedTitle.includes(normalizedEntry)) {
        const minLength = Math.min(normalizedEntry.length, normalizedTitle.length);
        if (minLength >= 10) {
          return entry;
        }
      }

      // Match on key words
      const titleWords = normalizedTitle.split(/\s+/).filter(w => w.length > 3);
      const entryWords = normalizedEntry.split(/\s+/).filter(w => w.length > 3);

      if (titleWords.length >= 2 && entryWords.length >= 2) {
        const matchingWords = titleWords.filter(w => entryWords.includes(w));
        if (matchingWords.length >= Math.min(3, titleWords.length * 0.6)) {
          return entry;
        }
      }
    }

    return null;
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

  /**
   * Detect structural headers for user section selection
   * Finds Roman numerals, Letters, Numbers, and Standard patterns
   * Returns hierarchical structure with sections for user to select/deselect
   *
   * IMPORTANT: Only detects STRUCTURAL headers, not all HTML headings.
   * Structural headers are:
   * - Roman numerals: "I. GENERAL PROGRAM CHARACTERISTICS"
   * - Letters: "A. Institutional Requirements"
   * - Standards: "Standard 1:", "Standard 2:"
   * - Part headers: "Part I:", "Part II:"
   * - Appendix: "Appendix", "Appendices"
   */
  detectStructuralHeaders(htmlContent: string, rawText: string): {
    sections: DetectedSection[];
    appendixSection?: DetectedSection;
    totalSections: number;
  } {
    console.log(`[DocumentParser] detectStructuralHeaders called`);
    console.log(`[DocumentParser] HTML content length: ${htmlContent?.length || 0}`);
    console.log(`[DocumentParser] Raw text length: ${rawText?.length || 0}`);

    // SAFEGUARD: If HTML is too large (>5MB), skip HTML parsing and use text-based detection
    // This prevents regex timeouts on very large documents (e.g., 370MB HTML)
    const MAX_HTML_SIZE = 5 * 1024 * 1024; // 5MB
    if (htmlContent && htmlContent.length > MAX_HTML_SIZE) {
      console.log(`[DocumentParser] HTML too large (${Math.round(htmlContent.length / 1024 / 1024)}MB > 5MB limit), using text-based detection`);
      return this.detectStructuralHeadersFromText(rawText);
    }

    const sections: DetectedSection[] = [];
    let appendixSection: DetectedSection | undefined;

    // Patterns for detecting STRUCTURAL headers only
    // These must be single-line section titles, not course content
    const STRUCTURAL_PATTERNS = {
      // Roman numerals I-V only: "I. GENERAL...", "II. CURRICULUM...", "III. ..."
      // Document outlines rarely go past V (5 sections)
      roman: /^(I|II|III|IV|V)\.\s+(.+)/i,
      // Part with Roman numeral: "Part I: General Standards", "PART II: CURRICULUM"
      partRoman: /^Part\s+([IVXLCDM]+)[:\s]+(.+)/i,
      // Numbered sections: "1. History", "3. Human Services Delivery Systems"
      // Single word allowed if not blacklisted (e.g., "1. History" is valid)
      number: /^(\d{1,2})\.\s+([A-Z][a-z]+.*)/,
      // Letters at start: "A. Knowledge, Theory, Skills", "B. Primary Objective"
      // Single word allowed if not blacklisted, commas allowed in title
      letter: /^([A-Z])\.\s+([A-Z][a-z]+.*)/,
      // Standard headers: "Standard 1:", "Standard 12 –"
      standard: /^Standard\s+(\d{1,2})\s*[:\-–—]/i,
      // Matrix headers: "Matrix for Human Services Courses", "Curriculum Matrix"
      matrix: /^Matrix\s+for|^Curriculum\s+Matrix/i,
      // Appendix headers: "Appendix", "Appendices", "Appendix A"
      appendix: /^Appendix|^Appendices/i,
    };

    // Terms that look like headers but are actually course assignment components
    const NON_STRUCTURAL_TERMS = [
      'summary', 'reaction', 'introduction', 'conclusion', 'overview',
      'objectives', 'assignment', 'homework', 'quiz', 'exam', 'test',
      'reading', 'discussion', 'activity', 'exercise', 'project',
      'presentation', 'paper', 'essay', 'report', 'review', 'analysis'
    ];

    // Helper function to check if text matches any structural pattern
    const isStructuralHeader = (text: string): {
      isStructural: boolean;
      type: 'roman' | 'letter' | 'number' | 'standard' | 'appendix' | 'heading';
      level: 1 | 2 | 3;
      isMatrix?: boolean;
    } => {
      const trimmedText = text.trim();

      // Check appendix first (highest priority)
      if (STRUCTURAL_PATTERNS.appendix.test(trimmedText)) {
        return { isStructural: true, type: 'appendix', level: 1 };
      }

      // Check Matrix sections (e.g., "Matrix for Human Services Courses")
      if (STRUCTURAL_PATTERNS.matrix.test(trimmedText)) {
        return { isStructural: true, type: 'heading', level: 2, isMatrix: true };
      }

      // Check Part Roman (e.g., "Part I: General Standards")
      if (STRUCTURAL_PATTERNS.partRoman.test(trimmedText)) {
        return { isStructural: true, type: 'roman', level: 1 };
      }

      // Check Roman numerals (e.g., "I. GENERAL PROGRAM CHARACTERISTICS")
      if (STRUCTURAL_PATTERNS.roman.test(trimmedText)) {
        return { isStructural: true, type: 'roman', level: 1 };
      }

      // Check Standard headers (e.g., "Standard 1: Program Identity")
      if (STRUCTURAL_PATTERNS.standard.test(trimmedText)) {
        return { isStructural: true, type: 'standard', level: 2 };
      }

      // Check Numbered sections (e.g., "3. Human Services Delivery Systems")
      // Must have at least 2 words in title
      if (STRUCTURAL_PATTERNS.number.test(trimmedText)) {
        const numberMatch = trimmedText.match(STRUCTURAL_PATTERNS.number);
        if (numberMatch) {
          const afterNumber = numberMatch[2].toLowerCase();
          const firstWord = afterNumber.split(/\s+/)[0];
          // Check if it's a non-structural term
          const isNonStructural = NON_STRUCTURAL_TERMS.some(term => firstWord === term);
          if (!isNonStructural) {
            return { isStructural: true, type: 'number', level: 2 };
          }
        }
      }

      // Check Letter sections (e.g., "A. Institutional Requirements")
      // Must start with single capital letter followed by period and at least 2 words
      // Excludes course assignment headers like "B. Summary", "C. Reaction"
      if (STRUCTURAL_PATTERNS.letter.test(trimmedText)) {
        const letterMatch = trimmedText.match(STRUCTURAL_PATTERNS.letter);
        if (letterMatch) {
          const afterLetter = letterMatch[2].toLowerCase();
          const firstWord = afterLetter.split(/\s+/)[0];
          // Check if it's a non-structural term (course assignment component)
          const isNonStructural = NON_STRUCTURAL_TERMS.some(term => firstWord === term);
          if (!isNonStructural) {
            return { isStructural: true, type: 'letter', level: 2 };
          }
        }
      }

      return { isStructural: false, type: 'heading', level: 1 };
    };

    // First, try to extract structural headers from HTML headings
    const headingRegex = /<h([1-4])[^>]*>(.*?)<\/h\1>/gi;
    const allHeadings: Array<{
      level: number;
      text: string;
      index: number;
      fullMatch: string;
    }> = [];

    // Helper to decode HTML entities and clean up text
    const cleanHtmlText = (html: string): string => {
      return html
        .replace(/<[^>]*>/g, '')           // Remove HTML tags
        .replace(/&nbsp;/g, ' ')           // Non-breaking space
        .replace(/&amp;/g, '&')            // Ampersand
        .replace(/&lt;/g, '<')             // Less than
        .replace(/&gt;/g, '>')             // Greater than
        .replace(/&quot;/g, '"')           // Quote
        .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10))) // Numeric entities
        .replace(/\s+/g, ' ')              // Normalize whitespace
        .trim();
    };

    let match;
    while ((match = headingRegex.exec(htmlContent)) !== null) {
      const headingText = cleanHtmlText(match[2]);
      if (!headingText || headingText.length < 2) continue;
      if (headingText.toLowerCase().includes('table of contents')) continue;
      if (headingText.toLowerCase() === 'contents') continue;

      allHeadings.push({
        level: parseInt(match[1], 10),
        text: headingText,
        index: match.index,
        fullMatch: match[0]
      });
    }

    console.log(`[DocumentParser] detectStructuralHeaders: Found ${allHeadings.length} total HTML headings`);
    // Log first 20 headings for debugging
    console.log(`[DocumentParser] First 20 headings:`, allHeadings.slice(0, 20).map(h => h.text.substring(0, 80)));

    // Filter to only structural headers
    const structuralHeadings = allHeadings.filter(h => {
      const result = isStructuralHeader(h.text);
      if (result.isStructural) {
        console.log(`[DocumentParser] MATCHED: "${h.text.substring(0, 60)}" as ${result.type}`);
      }
      return result.isStructural;
    });

    console.log(`[DocumentParser] detectStructuralHeaders: ${structuralHeadings.length} are structural headers`);
    if (structuralHeadings.length > 0) {
      console.log(`[DocumentParser] Structural headers found:`, structuralHeadings.slice(0, 10).map(h => h.text.substring(0, 60)));
    }

    // If no structural headers found in HTML, fall back to text-based detection
    if (structuralHeadings.length === 0) {
      console.log(`[DocumentParser] No structural headers in HTML, falling back to text detection`);
      return this.detectStructuralHeadersFromText(rawText);
    }

    // Also check raw text for appendix if not found in HTML headings
    let appendixTextPosition = -1;
    if (!structuralHeadings.some(h => STRUCTURAL_PATTERNS.appendix.test(h.text))) {
      // Look for appendix in raw text
      const appendixMatch = rawText.match(/\n(Appendix|Appendices)[^\n]*/i);
      if (appendixMatch && appendixMatch.index) {
        appendixTextPosition = appendixMatch.index;
        console.log(`[DocumentParser] Found appendix in raw text at position ${appendixTextPosition}`);
      }
    }

    // Process structural headings into DetectedSection structure
    for (let i = 0; i < structuralHeadings.length; i++) {
      const heading = structuralHeadings[i];
      const nextHeading = structuralHeadings[i + 1];

      // Get structural info
      const structInfo = isStructuralHeader(heading.text);

      // Extract content between this heading and the next structural heading
      const startPos = heading.index;
      let endPos = nextHeading ? nextHeading.index : htmlContent.length;

      // If appendix found in text and this is the last structural heading before it,
      // end this section at the appendix
      if (appendixTextPosition > 0 && !nextHeading) {
        // Find approximate HTML position for appendix (rough estimate)
        const textRatio = appendixTextPosition / rawText.length;
        const estimatedHtmlPos = Math.floor(textRatio * htmlContent.length);
        if (estimatedHtmlPos > startPos && estimatedHtmlPos < htmlContent.length) {
          endPos = estimatedHtmlPos;
        }
      }

      const sectionHtml = htmlContent.substring(startPos, endPos);
      const sectionText = sectionHtml.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

      // Check if this is an appendix
      const isAppendix = structInfo.type === 'appendix';

      // Create preview text (first 200 chars)
      const previewText = sectionText.substring(0, 200) + (sectionText.length > 200 ? '...' : '');

      const section: DetectedSection = {
        id: uuidv4(),
        level: structInfo.level,
        headerType: structInfo.type,
        headerText: heading.text,
        previewText,
        fullContent: sectionText,
        htmlContent: sectionHtml,
        startPosition: startPos,
        endPosition: endPos,
        isAppendix,
        isSelected: !isAppendix, // Appendix not selected by default
        children: []
      };

      if (isAppendix) {
        // If appendix, capture everything from here to end
        const appendixHtml = htmlContent.substring(startPos);
        const appendixText = appendixHtml.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
        section.fullContent = appendixText;
        section.htmlContent = appendixHtml;
        section.endPosition = htmlContent.length;
        section.previewText = appendixText.substring(0, 200) + (appendixText.length > 200 ? '...' : '');
        appendixSection = section;
        console.log(`[DocumentParser] Appendix section created: "${heading.text.substring(0, 50)}"`);
        // Don't add to regular sections, break here
        break;
      }

      sections.push(section);
    }

    // If appendix was found in text but not as a heading, create appendix section from text
    if (!appendixSection && appendixTextPosition > 0) {
      // Find the HTML position roughly corresponding to the text position
      const textRatio = appendixTextPosition / rawText.length;
      const estimatedHtmlPos = Math.floor(textRatio * htmlContent.length);

      const appendixHtml = htmlContent.substring(estimatedHtmlPos);
      const appendixText = appendixHtml.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

      appendixSection = {
        id: uuidv4(),
        level: 1,
        headerType: 'appendix',
        headerText: 'Appendices',
        previewText: appendixText.substring(0, 200) + (appendixText.length > 200 ? '...' : ''),
        fullContent: appendixText,
        htmlContent: appendixHtml,
        startPosition: estimatedHtmlPos,
        endPosition: htmlContent.length,
        isAppendix: true,
        isSelected: false,
        children: []
      };
      console.log(`[DocumentParser] Appendix section created from text position`);
    }

    // Build hierarchy based on section levels
    const hierarchicalSections = this.buildSectionHierarchy(sections);

    console.log(`[DocumentParser] detectStructuralHeaders: Created ${hierarchicalSections.length} top-level sections` +
      (appendixSection ? ', 1 appendix section' : ''));

    return {
      sections: hierarchicalSections,
      appendixSection,
      totalSections: this.countAllSections(hierarchicalSections)
    };
  }

  /**
   * Detect structural headers from raw text when HTML headings aren't available
   * Uses strict patterns to only detect actual structural headers
   */
  private detectStructuralHeadersFromText(rawText: string): {
    sections: DetectedSection[];
    appendixSection?: DetectedSection;
    totalSections: number;
  } {
    const sections: DetectedSection[] = [];
    let appendixSection: DetectedSection | undefined;
    const lines = rawText.split('\n');

    // Structural patterns - single-line section titles (blacklist filters bad ones)
    const headerPatterns = [
      // Appendix (check first - highest priority)
      { pattern: /^Appendix|^Appendices/i, type: 'appendix' as const, level: 1 as const },
      // Matrix sections: "Matrix for Human Services Courses"
      { pattern: /^Matrix\s+for|^Curriculum\s+Matrix/i, type: 'heading' as const, level: 2 as const },
      // Part with Roman numeral: "Part I: General Standards"
      { pattern: /^Part\s+([IVXLCDM]+)[:\s]+(.+)/i, type: 'roman' as const, level: 1 as const },
      // Roman numerals I-V only: "I. GENERAL...", "II. CURRICULUM..."
      { pattern: /^(I|II|III|IV|V)\.\s+(.+)/i, type: 'roman' as const, level: 1 as const },
      // Standard headers: "Standard 1:", "Standard 12 –"
      { pattern: /^Standard\s+(\d{1,2})\s*[:\-–—]/i, type: 'standard' as const, level: 2 as const },
      // Numbered sections: "1. History", "3. Human Services Delivery Systems"
      { pattern: /^(\d{1,2})\.\s+([A-Z][a-z]+.*)/, type: 'number' as const, level: 2 as const },
      // Letters: "A. Knowledge, Theory, Skills", "B. Primary Objective"
      { pattern: /^([A-Z])\.\s+([A-Z][a-z]+.*)/, type: 'letter' as const, level: 2 as const },
    ];

    // Terms that are course assignment components, not structural headers
    const nonStructuralTerms = [
      'summary', 'reaction', 'introduction', 'conclusion', 'overview',
      'objectives', 'assignment', 'homework', 'quiz', 'exam', 'test',
      'reading', 'discussion', 'activity', 'exercise', 'project',
      'presentation', 'paper', 'essay', 'report', 'review', 'analysis'
    ];

    let currentPosition = 0;
    const detectedHeaders: Array<{
      lineIndex: number;
      text: string;
      type: 'roman' | 'letter' | 'number' | 'standard' | 'appendix' | 'heading';
      level: 1 | 2 | 3;
      position: number;
    }> = [];

    console.log(`[DocumentParser] detectStructuralHeadersFromText: Scanning ${lines.length} lines`);

    // Find all structural headers
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      // Skip empty lines, very long lines (paragraphs), and very short lines
      if (!line || line.length > 200 || line.length < 3) {
        currentPosition += lines[i].length + 1;
        continue;
      }

      for (const { pattern, type, level } of headerPatterns) {
        if (pattern.test(line)) {
          // For letter and number patterns, check if it's a non-structural term
          if (type === 'letter' || type === 'number') {
            const match = line.match(pattern);
            if (match && match[2]) {
              const firstWord = match[2].toLowerCase().split(/[\s,]+/)[0];
              if (nonStructuralTerms.includes(firstWord)) {
                continue; // Skip non-structural terms like "B. Summary"
              }
            }
          }
          detectedHeaders.push({
            lineIndex: i,
            text: line,
            type,
            level,
            position: currentPosition
          });
          break;
        }
      }
      currentPosition += lines[i].length + 1; // +1 for newline
    }

    console.log(`[DocumentParser] detectStructuralHeadersFromText: Found ${detectedHeaders.length} structural headers`);
    if (detectedHeaders.length > 0) {
      console.log(`[DocumentParser] Headers:`, detectedHeaders.slice(0, 10).map(h => h.text.substring(0, 60)));
    }

    // Create sections from headers
    for (let i = 0; i < detectedHeaders.length; i++) {
      const header = detectedHeaders[i];
      const nextHeader = detectedHeaders[i + 1];

      // Extract content
      const startLine = header.lineIndex;
      const endLine = nextHeader ? nextHeader.lineIndex : lines.length;
      const content = lines.slice(startLine, endLine).join('\n').trim();
      const previewText = content.substring(0, 200) + (content.length > 200 ? '...' : '');

      const isAppendix = header.type === 'appendix';

      const section: DetectedSection = {
        id: uuidv4(),
        level: header.level,
        headerType: header.type,
        headerText: header.text,
        previewText,
        fullContent: content,
        htmlContent: `<div>${content.replace(/\n/g, '<br/>')}</div>`,
        startPosition: header.position,
        endPosition: nextHeader ? nextHeader.position : rawText.length,
        isAppendix,
        isSelected: !isAppendix,
        children: []
      };

      if (isAppendix) {
        // Capture everything from appendix to end
        const appendixContent = lines.slice(startLine).join('\n').trim();
        section.fullContent = appendixContent;
        section.htmlContent = `<div>${appendixContent.replace(/\n/g, '<br/>')}</div>`;
        section.endPosition = rawText.length;
        section.previewText = appendixContent.substring(0, 200) + (appendixContent.length > 200 ? '...' : '');
        appendixSection = section;
        console.log(`[DocumentParser] Appendix found in text: "${header.text.substring(0, 50)}"`);
        break;
      }

      sections.push(section);
    }

    const hierarchicalSections = this.buildSectionHierarchy(sections);

    return {
      sections: hierarchicalSections,
      appendixSection,
      totalSections: this.countAllSections(hierarchicalSections)
    };
  }


  /**
   * Build hierarchical structure from flat sections based on levels
   */
  private buildSectionHierarchy(sections: DetectedSection[]): DetectedSection[] {
    const result: DetectedSection[] = [];
    const stack: DetectedSection[] = [];

    for (const section of sections) {
      // Pop sections from stack that are at same or higher level
      while (stack.length > 0 && stack[stack.length - 1].level >= section.level) {
        stack.pop();
      }

      if (stack.length === 0) {
        // This is a top-level section
        result.push(section);
      } else {
        // This is a child of the last section in stack
        const parent = stack[stack.length - 1];
        section.parentId = parent.id;
        parent.children.push(section);
      }

      stack.push(section);
    }

    return result;
  }

  /**
   * Count all sections including nested children
   */
  private countAllSections(sections: DetectedSection[]): number {
    let count = 0;
    for (const section of sections) {
      count++;
      if (section.children.length > 0) {
        count += this.countAllSections(section.children);
      }
    }
    return count;
  }

  /**
   * Get all selected sections as a flat array (for processing)
   */
  getSelectedSectionsFlat(sections: DetectedSection[]): DetectedSection[] {
    const selected: DetectedSection[] = [];

    const traverse = (sectionList: DetectedSection[]) => {
      for (const section of sectionList) {
        if (section.isSelected && !section.isAppendix) {
          selected.push(section);
        }
        if (section.children.length > 0) {
          traverse(section.children);
        }
      }
    };

    traverse(sections);
    return selected;
  }
}

export const documentParserService = new DocumentParserService();
