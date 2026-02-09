/**
 * Matrix HTML Table Parser
 *
 * Parses CSHSE curriculum matrix HTML tables into structured data
 * (courses, assessments) that can be imported into the CurriculumMatrix model.
 *
 * Cell codes: I=Introduction, T=Theory, K=Knowledge, S=Skills (types)
 *             L=Low, M=Medium, H=High (depth)
 */
import * as cheerio from 'cheerio';

// --- Result types ---

export interface ParsedCourse {
  coursePrefix: string;
  courseNumber: string;
  courseName: string;
}

export interface ParsedAssessment {
  standardCode: string;
  specCode: string;
  coursePrefix: string;
  courseNumber: string;
  type: string[];   // e.g. ['I', 'T', 'K']
  depth: string;    // 'L' | 'M' | 'H'
}

export interface ParsedMatrixResult {
  courses: ParsedCourse[];
  assessments: ParsedAssessment[];
  warnings: string[];
  stats: {
    totalCourses: number;
    totalAssessments: number;
    unparsedCells: number;
  };
}

// --- Cell value types ---

const VALID_TYPES = new Set(['I', 'T', 'K', 'S']);
const VALID_DEPTHS = new Set(['L', 'M', 'H']);

interface CellValue {
  types: string[];
  depth: string | null;
}

/**
 * Parse a single cell's text content into types + depth.
 *
 * Handles formats:
 *   Multi-line: "T\nM" → types=['T'], depth='M'
 *   Comma-separated: "I,K\nL" → types=['I','K'], depth='L'
 *   Concatenated: "ITKSH" → types=['I','T','K','S'], depth='H'
 *   Single type+depth: "TM" → types=['T'], depth='M'
 *   Bare types: "IK" → types=['I','K'], depth=null
 */
export function parseCellValue(raw: string): CellValue | null {
  if (!raw) return null;

  // Normalize: replace <br> variants with newlines, collapse whitespace
  let text = raw
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/&nbsp;/gi, ' ')
    .trim();

  if (!text) return null;

  // Split on newlines - many matrices use line 1 for types, line 2 for depth
  const lines = text.split(/\n/).map(l => l.trim()).filter(Boolean);

  let types: string[] = [];
  let depth: string | null = null;

  if (lines.length >= 2) {
    // Multi-line: first line(s) = types, last line = depth
    const typeLine = lines.slice(0, -1).join('');
    const depthLine = lines[lines.length - 1];

    types = extractTypes(typeLine);
    depth = extractDepth(depthLine);

    // If depth line also has types (e.g. "ITKSH\nM" where first line has types+depth mixed)
    if (!depth && types.length === 0) {
      // Try treating the whole thing as a single line
      const combined = lines.join('');
      return parseSingleLine(combined);
    }
  } else {
    // Single line
    return parseSingleLine(lines[0]);
  }

  if (types.length === 0 && !depth) return null;

  return { types, depth };
}

function parseSingleLine(text: string): CellValue | null {
  // Remove commas, spaces, slashes
  const clean = text.replace(/[,\s/]+/g, '').toUpperCase();
  if (!clean) return null;

  const types: string[] = [];
  let depth: string | null = null;

  for (const ch of clean) {
    if (VALID_TYPES.has(ch)) {
      if (!types.includes(ch)) types.push(ch);
    } else if (VALID_DEPTHS.has(ch)) {
      depth = ch; // last depth wins
    }
    // Ignore other characters
  }

  if (types.length === 0 && !depth) return null;
  return { types, depth };
}

function extractTypes(text: string): string[] {
  const clean = text.replace(/[,\s/]+/g, '').toUpperCase();
  const types: string[] = [];
  for (const ch of clean) {
    if (VALID_TYPES.has(ch) && !types.includes(ch)) {
      types.push(ch);
    }
  }
  return types;
}

function extractDepth(text: string): string | null {
  const clean = text.replace(/[,\s/]+/g, '').toUpperCase();
  for (const ch of clean) {
    if (VALID_DEPTHS.has(ch)) return ch;
  }
  return null;
}

/**
 * Parse a course header cell into prefix + number.
 * Handles: "PSY 101", "PSY101", "PSY\n101", "Psychology 101", etc.
 */
export function parseCourseHeader(text: string): ParsedCourse | null {
  if (!text) return null;
  const clean = text.replace(/\n/g, ' ').trim();
  if (!clean) return null;

  // Pattern: PREFIX NUMBER (optionally with space, dash, or nothing between)
  const match = clean.match(/^([A-Z]{2,6})\s*[-]?\s*(\d{2,6})/i);
  if (match) {
    return {
      coursePrefix: match[1].toUpperCase(),
      courseNumber: match[2],
      courseName: clean,
    };
  }

  // Fallback: if it looks like a course name but no clear prefix/number
  // Only accept if it's reasonably short (course headers, not paragraph text)
  if (clean.length <= 40) {
    return {
      coursePrefix: '',
      courseNumber: '',
      courseName: clean,
    };
  }

  return null;
}

/**
 * Detect the standard code from a row's first-column text.
 * Looks for patterns like "Standard 11", "Specifications for Standard 12", etc.
 */
export function detectStandardCode(text: string): string | null {
  if (!text) return null;

  // "Standard 11", "Standard 11:", "Standard 11 -", etc.
  const match = text.match(/Standard\s+(\d{1,2})/i);
  if (match) return match[1];

  // "Specifications for Standard 11"
  const specMatch = text.match(/Specifications?\s+(?:for\s+)?Standard\s+(\d{1,2})/i);
  if (specMatch) return specMatch[1];

  return null;
}

/**
 * Build a virtual grid that accounts for rowspan/colspan merged cells.
 * Returns a 2D array where each cell has { text, rowIdx, colIdx }.
 */
function buildVirtualGrid($: cheerio.CheerioAPI, table: cheerio.Cheerio<any>): string[][] {
  const rows = table.find('tr');
  const grid: string[][] = [];
  // Track which cells are occupied by rowspan/colspan
  const occupied: Map<string, string> = new Map();

  rows.each((rowIdx, rowEl) => {
    const cells = $(rowEl).find('td, th');
    const row: string[] = [];
    let colIdx = 0;

    cells.each((_, cellEl) => {
      const $cell = $(cellEl);

      // Skip past occupied cells (from previous rowspan/colspan)
      while (occupied.has(`${rowIdx},${colIdx}`)) {
        row.push(occupied.get(`${rowIdx},${colIdx}`) || '');
        colIdx++;
      }

      // Get cell text - replace <br> with newlines
      let cellHtml = $cell.html() || '';
      let cellText = cellHtml
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/gi, ' ')
        .replace(/&amp;/gi, '&')
        .replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>')
        .trim();

      const rowspan = parseInt($cell.attr('rowspan') || '1', 10);
      const colspan = parseInt($cell.attr('colspan') || '1', 10);

      // Fill the grid for this cell and any spanned cells
      for (let r = 0; r < rowspan; r++) {
        for (let c = 0; c < colspan; c++) {
          if (r === 0 && c === 0) continue; // Current cell, handled below
          const key = `${rowIdx + r},${colIdx + c}`;
          // For spanned cells, propagate the text only to the "origin" column
          occupied.set(key, c === 0 ? cellText : '');
        }
      }

      row.push(cellText);
      colIdx++;
    });

    // Fill remaining occupied cells in this row
    while (occupied.has(`${rowIdx},${colIdx}`)) {
      row.push(occupied.get(`${rowIdx},${colIdx}`) || '');
      colIdx++;
    }

    grid.push(row);
  });

  return grid;
}

/**
 * Detect which row is the course header row.
 * Usually the first row with many cells that look like course codes.
 */
function findHeaderRowIndex(grid: string[][], startFromRow = 0): number {
  for (let r = startFromRow; r < Math.min(grid.length, 10); r++) {
    const row = grid[r];
    if (row.length < 3) continue; // Need at least label col + 2 course cols

    // Count how many cells (after first 1-2) look like course headers
    let courseCount = 0;
    for (let c = 1; c < row.length; c++) {
      const parsed = parseCourseHeader(row[c]);
      if (parsed && parsed.coursePrefix) courseCount++;
    }

    // If majority of cells parse as courses, this is the header row
    if (courseCount >= 2 && courseCount >= (row.length - 2) * 0.3) {
      return r;
    }
  }
  return -1;
}

/**
 * Determine the number of label columns (columns before course data).
 * These contain standard/spec text descriptions.
 */
function countLabelColumns(grid: string[][], headerRow: number): number {
  const row = grid[headerRow];
  for (let c = 0; c < row.length; c++) {
    const parsed = parseCourseHeader(row[c]);
    if (parsed && (parsed.coursePrefix || parsed.courseNumber)) {
      return c;
    }
  }
  return 1; // Default: 1 label column
}

// Spec letter codes in order
const SPEC_LETTERS = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'];

/**
 * Main entry point: parse a matrix HTML string into structured data.
 */
export function parseMatrixHtml(html: string): ParsedMatrixResult {
  const $ = cheerio.load(html);
  const warnings: string[] = [];
  const courses: ParsedCourse[] = [];
  const assessments: ParsedAssessment[] = [];
  let unparsedCells = 0;

  // Find all tables
  const tables = $('table');
  if (tables.length === 0) {
    warnings.push('No <table> elements found in the HTML content');
    return { courses, assessments, warnings, stats: { totalCourses: 0, totalAssessments: 0, unparsedCells: 0 } };
  }

  // Use the largest table (most rows) as the matrix
  let mainTable = tables.first();
  let maxRows = 0;
  tables.each((_, el) => {
    const rowCount = $(el).find('tr').length;
    if (rowCount > maxRows) {
      maxRows = rowCount;
      mainTable = $(el);
    }
  });

  console.log(`[matrixHtmlParser] Found ${tables.length} table(s), using largest with ${maxRows} rows`);

  // Build virtual grid (handles rowspan/colspan)
  const grid = buildVirtualGrid($, mainTable);
  console.log(`[matrixHtmlParser] Virtual grid: ${grid.length} rows x ${grid[0]?.length || 0} cols`);

  if (grid.length < 2) {
    warnings.push('Table has fewer than 2 rows — cannot extract matrix data');
    return { courses, assessments, warnings, stats: { totalCourses: 0, totalAssessments: 0, unparsedCells: 0 } };
  }

  // Find header row with course names
  const headerRowIdx = findHeaderRowIndex(grid);
  if (headerRowIdx === -1) {
    warnings.push('Could not identify a course header row in the table');
    return { courses, assessments, warnings, stats: { totalCourses: 0, totalAssessments: 0, unparsedCells: 0 } };
  }

  const labelCols = countLabelColumns(grid, headerRowIdx);
  console.log(`[matrixHtmlParser] Header row: ${headerRowIdx}, label columns: ${labelCols}`);

  // Extract courses from header row
  const courseColumns: (ParsedCourse | null)[] = [];
  const headerRow = grid[headerRowIdx];
  for (let c = labelCols; c < headerRow.length; c++) {
    const parsed = parseCourseHeader(headerRow[c]);
    if (parsed) {
      // Deduplicate
      const existing = courses.find(
        co => co.coursePrefix === parsed.coursePrefix && co.courseNumber === parsed.courseNumber && co.courseName === parsed.courseName
      );
      if (!existing) {
        courses.push(parsed);
      }
      courseColumns.push(parsed);
    } else {
      courseColumns.push(null);
      if (headerRow[c].trim()) {
        warnings.push(`Could not parse course header at column ${c}: "${headerRow[c].substring(0, 40)}"`);
      }
    }
  }

  console.log(`[matrixHtmlParser] Extracted ${courses.length} courses from header row`);

  // Iterate data rows (after header) to extract assessments
  let currentStandard: string | null = null;
  let specIndex = 0; // Resets when standard changes

  for (let r = headerRowIdx + 1; r < grid.length; r++) {
    const row = grid[r];
    if (!row || row.length === 0) continue;

    // Get the label cell(s) text
    const labelText = row.slice(0, labelCols).join(' ').trim();

    // Check if this row declares a new standard
    const detectedStd = detectStandardCode(labelText);
    if (detectedStd) {
      // Check if it's a "Specifications for Standard X" header row or context row
      const isSpecHeader = /specifications?\s+(for\s+)?standard/i.test(labelText);
      const isContextRow = /^(context|standard\s+\d{1,2}\s*:)/i.test(labelText);

      if (currentStandard !== detectedStd) {
        currentStandard = detectedStd;
        specIndex = 0;
        console.log(`[matrixHtmlParser] Row ${r}: Detected standard ${currentStandard}`);
      }

      // If it's a header/context row, skip it (no assessment data)
      if (isSpecHeader || isContextRow) {
        continue;
      }
    }

    if (!currentStandard) {
      // Haven't reached a standard section yet — could be title/header rows
      continue;
    }

    // Check if this row has any assessment data in the course columns
    let hasData = false;
    for (let c = labelCols; c < row.length; c++) {
      if (row[c] && row[c].trim()) {
        hasData = true;
        break;
      }
    }

    if (!hasData) {
      // Empty data row - might be a sub-header or separator
      // Check if label text looks like a section header (bold text, context, etc.)
      if (labelText && !labelText.match(/^\s*[a-h]\./i)) {
        // Non-spec row with text but no data — likely a context/header row
        continue;
      }
      continue;
    }

    // This is a specification data row
    const specCode = SPEC_LETTERS[specIndex] || String.fromCharCode(97 + specIndex);
    specIndex++;

    // Parse each course cell
    for (let c = 0; c < courseColumns.length; c++) {
      const course = courseColumns[c];
      if (!course) continue;

      const cellIdx = c + labelCols;
      const cellText = row[cellIdx] || '';
      if (!cellText.trim()) continue;

      const cellValue = parseCellValue(cellText);
      if (cellValue && (cellValue.types.length > 0 || cellValue.depth)) {
        assessments.push({
          standardCode: currentStandard,
          specCode,
          coursePrefix: course.coursePrefix,
          courseNumber: course.courseNumber,
          type: cellValue.types,
          depth: cellValue.depth || 'M', // Default to medium if depth not specified
        });
      } else if (cellText.trim()) {
        unparsedCells++;
        if (unparsedCells <= 10) {
          warnings.push(`Row ${r}, col ${cellIdx}: Could not parse "${cellText.substring(0, 30)}"`);
        }
      }
    }
  }

  if (unparsedCells > 10) {
    warnings.push(`...and ${unparsedCells - 10} more unparsed cells`);
  }

  console.log(`[matrixHtmlParser] Result: ${courses.length} courses, ${assessments.length} assessments, ${unparsedCells} unparsed, ${warnings.length} warnings`);

  return {
    courses,
    assessments,
    warnings,
    stats: {
      totalCourses: courses.length,
      totalAssessments: assessments.length,
      unparsedCells,
    },
  };
}
