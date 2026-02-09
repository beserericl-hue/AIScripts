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
  specText: string;  // Full spec description from the row label
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
 * Also handles description-only headers with no prefix/number.
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

  // Fallback: accept description-only course names (no prefix/number)
  // Accept up to 120 chars to cover longer course descriptions
  if (clean.length <= 120) {
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
 * Check if a cell's text looks like assessment data (I/T/K/S + L/M/H codes)
 * rather than a header/label.
 */
function looksLikeAssessmentData(text: string): boolean {
  if (!text || !text.trim()) return false;
  const clean = text.replace(/[,\s\n/]+/g, '').toUpperCase();
  if (!clean) return false;
  // All characters should be valid type or depth codes
  return clean.length <= 8 && [...clean].every(ch => VALID_TYPES.has(ch) || VALID_DEPTHS.has(ch));
}

/**
 * Detect which row is the course header row.
 * Strategy 1: Look for PREFIX NUMBER patterns (e.g., "PSY 101").
 * Strategy 2 (fallback): Find a row where columns have non-empty text that
 *   ISN'T assessment data, using data rows below to confirm the pattern.
 */
function findHeaderRowIndex(grid: string[][], startFromRow = 0): number {
  // Strategy 1: Look for rows with PREFIX NUMBER course headers
  for (let r = startFromRow; r < Math.min(grid.length, 10); r++) {
    const row = grid[r];
    if (row.length < 3) continue;

    let courseCount = 0;
    for (let c = 1; c < row.length; c++) {
      const parsed = parseCourseHeader(row[c]);
      if (parsed && parsed.coursePrefix) courseCount++;
    }

    if (courseCount >= 2 && courseCount >= (row.length - 2) * 0.3) {
      return r;
    }
  }

  // Strategy 2: Fallback for description-only headers
  // Find the first row where most cells after the label column(s) are
  // non-empty text that does NOT look like assessment data, and where
  // subsequent rows DO have assessment-like data in those same columns.
  for (let r = startFromRow; r < Math.min(grid.length, 10); r++) {
    const row = grid[r];
    if (row.length < 3) continue;

    // Try different label column counts (1 or 2)
    for (const labelCols of [1, 2]) {
      let headerCells = 0;
      let nonEmptyCells = 0;

      for (let c = labelCols; c < row.length; c++) {
        const text = row[c]?.trim();
        if (!text) continue;
        nonEmptyCells++;
        // Header cell: has text, is NOT just assessment codes, is reasonable length
        if (!looksLikeAssessmentData(text) && text.length <= 120) {
          headerCells++;
        }
      }

      // Need at least 2 header-like cells in the potential header row
      if (headerCells < 2 || nonEmptyCells < 2) continue;

      // Verify: check that some rows below have assessment data in those columns
      let dataRowsFound = 0;
      for (let dr = r + 1; dr < Math.min(r + 10, grid.length); dr++) {
        const dataRow = grid[dr];
        let assessmentCells = 0;
        for (let c = labelCols; c < dataRow.length; c++) {
          if (looksLikeAssessmentData(dataRow[c])) assessmentCells++;
        }
        if (assessmentCells >= 2) dataRowsFound++;
      }

      if (dataRowsFound >= 2) {
        console.log(`[matrixHtmlParser] Fallback header detection: row ${r} with ${labelCols} label col(s)`);
        return r;
      }
    }
  }

  return -1;
}

/**
 * Determine the number of label columns (columns before course data).
 * Strategy 1: Find first column with PREFIX NUMBER course header.
 * Strategy 2: Use data rows to find where assessment data starts.
 */
function countLabelColumns(grid: string[][], headerRow: number): number {
  const row = grid[headerRow];

  // Strategy 1: Find first column with PREFIX NUMBER
  for (let c = 0; c < row.length; c++) {
    const parsed = parseCourseHeader(row[c]);
    if (parsed && (parsed.coursePrefix || parsed.courseNumber)) {
      return c;
    }
  }

  // Strategy 2: Analyze data rows to find where assessment data columns begin.
  // Scan rows below header and count how many have assessment-like values per column.
  const colScores: number[] = new Array(row.length).fill(0);
  const dataRowsChecked = Math.min(15, grid.length - headerRow - 1);

  for (let r = headerRow + 1; r <= headerRow + dataRowsChecked; r++) {
    const dataRow = grid[r];
    if (!dataRow) continue;
    for (let c = 0; c < dataRow.length; c++) {
      if (looksLikeAssessmentData(dataRow[c])) {
        colScores[c] = (colScores[c] || 0) + 1;
      }
    }
  }

  // The first column with a significant number of assessment values is the start of course columns
  const threshold = Math.max(2, dataRowsChecked * 0.15);
  for (let c = 0; c < colScores.length; c++) {
    if (colScores[c] >= threshold) {
      return c;
    }
  }

  return 1; // Default: 1 label column
}

/**
 * Determine label columns from data analysis only (no header row required).
 * Scans all rows for assessment data patterns and returns the first column
 * index that has significant assessment values.
 */
function countLabelColumnsFromData(grid: string[][]): number {
  const maxCols = grid[0]?.length || 0;
  const colScores: number[] = new Array(maxCols).fill(0);

  for (let r = 0; r < grid.length; r++) {
    const row = grid[r];
    if (!row) continue;
    for (let c = 0; c < row.length; c++) {
      if (looksLikeAssessmentData(row[c])) {
        colScores[c]++;
      }
    }
  }

  const threshold = Math.max(2, grid.length * 0.15);
  for (let c = 0; c < colScores.length; c++) {
    if (colScores[c] >= threshold) {
      return c;
    }
  }

  return 1; // Default: 1 label column
}

// Spec letter codes in order
const SPEC_LETTERS = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'];

/**
 * Main entry point: parse a matrix HTML string into structured data.
 * Options:
 *   defaultStandardCode — fallback standard code if none detected in text
 */
export function parseMatrixHtml(html: string, options?: { defaultStandardCode?: string }): ParsedMatrixResult {
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
  let headerRowIdx = findHeaderRowIndex(grid);
  let labelCols: number;
  const courseColumns: (ParsedCourse | null)[] = [];

  if (headerRowIdx === -1) {
    // Headerless mode: no course header row found.
    // Determine column structure from assessment data patterns and create positional courses.
    labelCols = countLabelColumnsFromData(grid);
    const totalDataCols = (grid[0]?.length || 0) - labelCols;

    // Check which columns actually have assessment data (skip always-empty columns)
    const colHasData: boolean[] = new Array(totalDataCols).fill(false);
    for (let r = 0; r < grid.length; r++) {
      for (let dc = 0; dc < totalDataCols; dc++) {
        const colIdx = dc + labelCols;
        if (colIdx < grid[r].length && looksLikeAssessmentData(grid[r][colIdx])) {
          colHasData[dc] = true;
        }
      }
    }

    warnings.push('No course header row found — using positional course columns. You can rename courses before importing.');
    console.log(`[matrixHtmlParser] Headerless mode: ${labelCols} label col(s), ${totalDataCols} data col(s)`);

    let courseNum = 1;
    for (let dc = 0; dc < totalDataCols; dc++) {
      if (colHasData[dc]) {
        const course: ParsedCourse = {
          coursePrefix: '',
          courseNumber: String(courseNum),
          courseName: `Course ${courseNum}`,
        };
        courses.push(course);
        courseColumns.push(course);
        courseNum++;
      } else {
        courseColumns.push(null);
      }
    }

    // In headerless mode, process all rows (headerRowIdx + 1 = 0)
    headerRowIdx = -1;
  } else {
    labelCols = countLabelColumns(grid, headerRowIdx);
    console.log(`[matrixHtmlParser] Header row: ${headerRowIdx}, label columns: ${labelCols}`);

    // Extract courses from header row
    const headerRow = grid[headerRowIdx];
    for (let c = labelCols; c < headerRow.length; c++) {
      const parsed = parseCourseHeader(headerRow[c]);
      if (parsed) {
        // Deduplicate by courseName (handles description-only headers where prefix/number are empty)
        const existing = courses.find(
          co => co.courseName === parsed.courseName
        );
        if (!existing) {
          courses.push(parsed);
        }
        courseColumns.push(parsed);
      } else {
        courseColumns.push(null);
        if (headerRow[c].trim()) {
          warnings.push(`Could not parse course header at column ${c}: "${headerRow[c].substring(0, 60)}"`);
        }
      }
    }
  }

  console.log(`[matrixHtmlParser] Extracted ${courses.length} courses`);

  // Iterate data rows (after header, or all rows in headerless mode)
  let currentStandard: string | null = options?.defaultStandardCode || null;
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
      const isContextRow = /^(context\s*:|standard\s+\d{1,2}\s*[:.]|\d+\.\s+[A-Z]|demonstrate\s+how)/i.test(labelText);

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

    // This is a specification data row.
    // Try to extract the spec letter from the label (e.g., "a. Theories of..." → 'a')
    const specLetterMatch = labelText.match(/^\s*([a-z])\.\s/i);
    let specCode: string;
    if (specLetterMatch) {
      specCode = specLetterMatch[1].toLowerCase();
      // Update specIndex to stay in sync in case later rows lack labels
      const letterIdx = specCode.charCodeAt(0) - 97;
      if (letterIdx >= specIndex) specIndex = letterIdx + 1;
    } else {
      specCode = SPEC_LETTERS[specIndex] || String.fromCharCode(97 + specIndex);
      specIndex++;
    }

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
