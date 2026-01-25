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
}

export interface StandardPattern {
  standardCode: string;
  specCode?: string;
  matchedText: string;
  confidence: number;
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
      rawText: data.text
    };
  }

  /**
   * Parse DOCX document
   */
  async parseDOCX(buffer: Buffer): Promise<ParsedDocument> {
    const result = await mammoth.extractRawText({ buffer });
    const htmlResult = await mammoth.convertToHtml({ buffer });

    const sections = this.extractSectionsFromText(result.value, 'docx');
    const tables = this.detectTablesInText(result.value);

    // Try to extract tables from HTML
    const htmlTables = this.extractTablesFromHtml(htmlResult.value);
    tables.push(...htmlTables);

    return {
      metadata: {
        pageCount: this.estimatePageCount(result.value)
      },
      sections,
      tables,
      images: [],
      rawText: result.value
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

    return {
      metadata: {
        pageCount: this.countSlides(text)
      },
      sections,
      tables,
      images: [],
      rawText: text
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
}

export const documentParserService = new DocumentParserService();
