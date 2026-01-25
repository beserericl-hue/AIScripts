import PDFDocument from 'pdfkit';
import { format } from 'date-fns';
import { IReview, ComplianceStatus, RecommendationType } from '../models/Review';
import { ILeadReaderCompilation } from '../models/LeadReaderCompilation';

// Constants for styling
const COLORS = {
  primary: '#1a5e4a',
  secondary: '#4ca58c',
  compliant: '#059669',
  nonCompliant: '#dc2626',
  notApplicable: '#6b7280',
  text: '#1f2937',
  lightGray: '#f3f4f6',
  border: '#d1d5db'
};

const FONTS = {
  regular: 'Helvetica',
  bold: 'Helvetica-Bold',
  italic: 'Helvetica-Oblique'
};

interface ReaderInfo {
  firstName: string;
  lastName: string;
  email?: string;
  credentials?: string;
}

export class PDFGeneratorService {
  private doc: PDFKit.PDFDocument;
  private pageWidth: number;
  private pageHeight: number;
  private margin: number;
  private contentWidth: number;

  constructor() {
    this.doc = new PDFDocument({
      size: 'LETTER',
      margins: { top: 72, bottom: 72, left: 72, right: 72 }
    });
    this.pageWidth = 612; // Letter width in points
    this.pageHeight = 792; // Letter height in points
    this.margin = 72;
    this.contentWidth = this.pageWidth - (this.margin * 2);
  }

  /**
   * Generate Reader Report PDF
   */
  async generateReaderReport(review: IReview, reader: ReaderInfo): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        const chunks: Buffer[] = [];

        this.doc.on('data', (chunk: Buffer) => chunks.push(chunk));
        this.doc.on('end', () => resolve(Buffer.concat(chunks)));
        this.doc.on('error', reject);

        // Generate content
        this.addReaderReportHeader(review, reader);
        this.addReaderInstructions();
        this.addReaderAssessments(review);
        this.addReaderFinalAssessment(review);
        this.addReaderSignature(review, reader);

        this.doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Generate Lead Reader Compilation Report PDF
   */
  async generateCompilationReport(
    compilation: ILeadReaderCompilation,
    leadReader: ReaderInfo
  ): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        const chunks: Buffer[] = [];

        this.doc.on('data', (chunk: Buffer) => chunks.push(chunk));
        this.doc.on('end', () => resolve(Buffer.concat(chunks)));
        this.doc.on('error', reject);

        // Generate content
        this.addCompilationHeader(compilation, leadReader);
        this.addReaderSummaryTable(compilation);
        this.addCompilationAssessments(compilation);
        this.addCompilationStatistics(compilation);
        this.addCompilationFinalAssessment(compilation);
        this.addCompilationSignature(compilation, leadReader);

        this.doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }

  // ============================================
  // READER REPORT SECTIONS
  // ============================================

  private addReaderReportHeader(review: IReview, reader: ReaderInfo): void {
    // Logo placeholder / Title
    this.doc
      .fillColor(COLORS.primary)
      .font(FONTS.bold)
      .fontSize(20)
      .text('CSHSE Reader Report', { align: 'center' });

    this.doc.moveDown(0.5);

    // Report identifier
    this.doc
      .fillColor(COLORS.text)
      .font(FONTS.regular)
      .fontSize(12)
      .text(`Reader ${review.reviewerNumber} of ${review.totalReviewers}`, { align: 'center' });

    this.doc.moveDown(1);

    // Institution and Program Info Box
    this.drawInfoBox([
      { label: 'Institution Name', value: review.institutionName },
      { label: 'Program Name', value: review.programName },
      { label: 'Program Level', value: this.formatProgramLevel(review.programLevel) },
      { label: 'Reader Name', value: `${reader.firstName} ${reader.lastName}${reader.credentials ? `, ${reader.credentials}` : ''}` },
      { label: 'Review Date', value: format(new Date(review.reviewDate), 'MMMM d, yyyy') }
    ]);

    this.doc.moveDown(1);
  }

  private addReaderInstructions(): void {
    this.doc
      .fillColor(COLORS.primary)
      .font(FONTS.bold)
      .fontSize(14)
      .text('Instructions');

    this.doc.moveDown(0.5);

    this.doc
      .fillColor(COLORS.text)
      .font(FONTS.regular)
      .fontSize(10)
      .text(
        'This report documents the reader\'s evaluation of the self-study submission against CSHSE National Standards. ' +
        'Each specification has been assessed as Compliant (Y), Non-Compliant (N), or Not Applicable (N/A). ' +
        'Comments are provided to explain non-compliant assessments and to note program strengths.',
        { align: 'justify' }
      );

    this.doc.moveDown(1);

    // Legend
    this.doc.font(FONTS.bold).text('Compliance Legend:');
    this.doc.font(FONTS.regular);
    this.doc.fillColor(COLORS.compliant).text('✓ Compliant (Y) - The program meets this requirement', { continued: false });
    this.doc.fillColor(COLORS.nonCompliant).text('✗ Non-Compliant (N) - The program does not meet this requirement');
    this.doc.fillColor(COLORS.notApplicable).text('— Not Applicable (N/A) - This requirement does not apply');

    this.doc.fillColor(COLORS.text);
    this.doc.moveDown(1);
  }

  private addReaderAssessments(review: IReview): void {
    this.doc
      .fillColor(COLORS.primary)
      .font(FONTS.bold)
      .fontSize(14)
      .text('Standards Assessment');

    this.doc.moveDown(0.5);

    for (const assessment of review.assessments) {
      // Check if we need a new page
      if (this.doc.y > this.pageHeight - 200) {
        this.doc.addPage();
      }

      // Standard header
      this.doc
        .fillColor(COLORS.primary)
        .font(FONTS.bold)
        .fontSize(12)
        .text(`Standard ${assessment.standardCode}`, {
          underline: true
        });

      this.doc.moveDown(0.3);

      // Specifications table
      for (const spec of assessment.specifications) {
        this.addSpecificationRow(assessment.standardCode, spec);
      }

      // Overall comments for standard
      if (assessment.overallComments) {
        this.doc.moveDown(0.3);
        this.doc
          .font(FONTS.italic)
          .fontSize(9)
          .fillColor(COLORS.text)
          .text(`Standard Comments: ${assessment.overallComments}`);
      }

      this.doc.moveDown(0.5);
    }
  }

  private addSpecificationRow(
    standardCode: string,
    spec: { specCode: string; compliance: ComplianceStatus; comments: string }
  ): void {
    const startY = this.doc.y;

    // Spec code
    this.doc
      .font(FONTS.regular)
      .fontSize(10)
      .fillColor(COLORS.text)
      .text(`${standardCode}.${spec.specCode}`, this.margin, startY, { width: 40 });

    // Compliance indicator
    const complianceX = this.margin + 50;
    this.doc
      .fillColor(this.getComplianceColor(spec.compliance))
      .text(this.getComplianceSymbol(spec.compliance), complianceX, startY, { width: 30 });

    // Comments
    const commentsX = this.margin + 90;
    const commentsWidth = this.contentWidth - 90;

    if (spec.comments) {
      this.doc
        .fillColor(COLORS.text)
        .font(FONTS.regular)
        .fontSize(9)
        .text(spec.comments, commentsX, startY, {
          width: commentsWidth,
          align: 'left'
        });
    }

    // Draw separator line
    const endY = Math.max(this.doc.y, startY + 15);
    this.doc
      .strokeColor(COLORS.border)
      .lineWidth(0.5)
      .moveTo(this.margin, endY + 3)
      .lineTo(this.pageWidth - this.margin, endY + 3)
      .stroke();

    this.doc.y = endY + 8;
  }

  private addReaderFinalAssessment(review: IReview): void {
    this.doc.addPage();

    this.doc
      .fillColor(COLORS.primary)
      .font(FONTS.bold)
      .fontSize(14)
      .text('Final Assessment');

    this.doc.moveDown(0.5);

    // Completeness question
    this.doc
      .font(FONTS.bold)
      .fontSize(11)
      .fillColor(COLORS.text)
      .text('Is this self-study sufficiently complete to make a recommendation to the Board?');

    this.doc.moveDown(0.3);

    const isComplete = review.finalAssessment.recommendation !== undefined;
    this.doc
      .font(FONTS.regular)
      .fontSize(10)
      .text(isComplete ? '☑ Yes' : '☐ Yes', { continued: true })
      .text('    ')
      .text(!isComplete ? '☑ No' : '☐ No');

    this.doc.moveDown(0.5);

    // Recommendation
    if (review.finalAssessment.recommendation) {
      this.doc
        .font(FONTS.bold)
        .fontSize(11)
        .text('Recommendation:');

      this.doc.moveDown(0.3);

      const recommendations = [
        { value: 'accreditation_no_conditions', label: 'Accreditation with no conditions' },
        { value: 'conditional_accreditation', label: 'Conditional accreditation' },
        { value: 'deny_accreditation', label: 'Deny accreditation due to significant noncompliance' },
        { value: 'hold_decision', label: 'Hold a decision' }
      ];

      for (const rec of recommendations) {
        const isSelected = review.finalAssessment.recommendation === rec.value;
        this.doc
          .font(FONTS.regular)
          .fontSize(10)
          .text(isSelected ? `☑ ${rec.label}` : `☐ ${rec.label}`);

        // Show details if selected
        if (isSelected && rec.value === 'conditional_accreditation' && review.finalAssessment.conditionDetails) {
          this.doc
            .font(FONTS.italic)
            .fontSize(9)
            .text(`   Conditions: ${review.finalAssessment.conditionDetails}`);
        }
        if (isSelected && rec.value === 'deny_accreditation' && review.finalAssessment.denyExplanation) {
          this.doc
            .font(FONTS.italic)
            .fontSize(9)
            .text(`   Explanation: ${review.finalAssessment.denyExplanation}`);
        }
        if (isSelected && rec.value === 'hold_decision' && review.finalAssessment.holdExplanation) {
          this.doc
            .font(FONTS.italic)
            .fontSize(9)
            .text(`   Explanation: ${review.finalAssessment.holdExplanation}`);
        }
      }
    }

    this.doc.moveDown(1);

    // Strengths
    this.addTextSection('Program Strengths', review.finalAssessment.programStrengths);

    // Weaknesses
    this.addTextSection('Program Weaknesses', review.finalAssessment.programWeaknesses);

    // Additional Comments
    if (review.finalAssessment.additionalComments) {
      this.addTextSection('Additional Comments', review.finalAssessment.additionalComments);
    }
  }

  private addReaderSignature(review: IReview, reader: ReaderInfo): void {
    this.doc.moveDown(2);

    // Signature line
    this.doc
      .strokeColor(COLORS.text)
      .lineWidth(1)
      .moveTo(this.margin, this.doc.y)
      .lineTo(this.margin + 200, this.doc.y)
      .stroke();

    this.doc.moveDown(0.3);

    this.doc
      .font(FONTS.regular)
      .fontSize(10)
      .text('Reader Signature', this.margin);

    // Electronic signature if present
    if (review.finalAssessment.signature) {
      this.doc
        .font(FONTS.italic)
        .fontSize(12)
        .text(review.finalAssessment.signature, this.margin, this.doc.y - 30);
    }

    // Date
    this.doc.moveDown(1);
    this.doc
      .font(FONTS.regular)
      .fontSize(10)
      .text(`Date: ${review.finalAssessment.signedAt ? format(new Date(review.finalAssessment.signedAt), 'MMMM d, yyyy') : '_________________'}`);
  }

  // ============================================
  // LEAD READER COMPILATION SECTIONS
  // ============================================

  private addCompilationHeader(compilation: ILeadReaderCompilation, leadReader: ReaderInfo): void {
    this.doc
      .fillColor(COLORS.primary)
      .font(FONTS.bold)
      .fontSize(20)
      .text('CSHSE Lead Reader Compilation Report', { align: 'center' });

    this.doc.moveDown(1);

    this.drawInfoBox([
      { label: 'Institution Name', value: compilation.institutionName },
      { label: 'Program Name', value: compilation.programName },
      { label: 'Program Level', value: this.formatProgramLevel(compilation.programLevel) },
      { label: 'Lead Reader', value: `${leadReader.firstName} ${leadReader.lastName}` },
      { label: 'Total Readers', value: compilation.totalReaders.toString() },
      { label: 'Completed Reviews', value: compilation.completedReviews.toString() },
      { label: 'Report Date', value: format(new Date(), 'MMMM d, yyyy') }
    ]);

    this.doc.moveDown(1);
  }

  private addReaderSummaryTable(compilation: ILeadReaderCompilation): void {
    this.doc
      .fillColor(COLORS.primary)
      .font(FONTS.bold)
      .fontSize(14)
      .text('Reader Recommendations Summary');

    this.doc.moveDown(0.5);

    // Table header
    const colWidths = [150, 150, 100];
    const startX = this.margin;
    let currentY = this.doc.y;

    this.doc
      .rect(startX, currentY, this.contentWidth, 20)
      .fill(COLORS.lightGray);

    this.doc
      .fillColor(COLORS.text)
      .font(FONTS.bold)
      .fontSize(10);

    this.doc.text('Reader', startX + 5, currentY + 5, { width: colWidths[0] });
    this.doc.text('Recommendation', startX + colWidths[0] + 5, currentY + 5, { width: colWidths[1] });
    this.doc.text('Status', startX + colWidths[0] + colWidths[1] + 5, currentY + 5, { width: colWidths[2] });

    currentY += 22;

    // Table rows
    this.doc.font(FONTS.regular).fontSize(9);

    for (const rec of compilation.readerRecommendations) {
      this.doc.text(rec.reviewerName, startX + 5, currentY, { width: colWidths[0] });
      this.doc.text(this.formatRecommendation(rec.recommendation), startX + colWidths[0] + 5, currentY, { width: colWidths[1] });
      this.doc.text('Submitted', startX + colWidths[0] + colWidths[1] + 5, currentY, { width: colWidths[2] });

      currentY += 15;

      // Draw row border
      this.doc
        .strokeColor(COLORS.border)
        .lineWidth(0.5)
        .moveTo(startX, currentY - 2)
        .lineTo(startX + this.contentWidth, currentY - 2)
        .stroke();
    }

    this.doc.y = currentY + 10;
    this.doc.moveDown(1);
  }

  private addCompilationAssessments(compilation: ILeadReaderCompilation): void {
    this.doc.addPage();

    this.doc
      .fillColor(COLORS.primary)
      .font(FONTS.bold)
      .fontSize(14)
      .text('Compiled Standards Assessment');

    this.doc.moveDown(0.5);

    for (const assessment of compilation.compiledAssessments) {
      if (this.doc.y > this.pageHeight - 200) {
        this.doc.addPage();
      }

      this.doc
        .fillColor(COLORS.primary)
        .font(FONTS.bold)
        .fontSize(12)
        .text(`Standard ${assessment.standardCode}`);

      this.doc.moveDown(0.3);

      for (const spec of assessment.specifications) {
        this.addCompilationSpecRow(assessment.standardCode, spec);
      }

      this.doc.moveDown(0.5);
    }
  }

  private addCompilationSpecRow(
    standardCode: string,
    spec: {
      specCode: string;
      consensusCompliance?: ComplianceStatus;
      finalDetermination?: ComplianceStatus;
      hasDisagreement: boolean;
      readerVotes: { reviewerName: string; compliance: ComplianceStatus }[];
      compiledComments: string;
    }
  ): void {
    const startY = this.doc.y;

    // Spec code with disagreement indicator
    this.doc
      .font(FONTS.bold)
      .fontSize(10)
      .fillColor(spec.hasDisagreement ? COLORS.nonCompliant : COLORS.text)
      .text(
        `${standardCode}.${spec.specCode}${spec.hasDisagreement ? ' ⚠' : ''}`,
        this.margin,
        startY,
        { width: 60 }
      );

    // Final determination
    const determination = spec.finalDetermination || spec.consensusCompliance;
    this.doc
      .fillColor(this.getComplianceColor(determination || null))
      .font(FONTS.bold)
      .text(
        `Final: ${this.getComplianceSymbol(determination || null)}`,
        this.margin + 65,
        startY,
        { width: 60 }
      );

    // Reader votes summary
    const voteSummary = this.summarizeVotes(spec.readerVotes);
    this.doc
      .fillColor(COLORS.text)
      .font(FONTS.regular)
      .fontSize(8)
      .text(voteSummary, this.margin + 130, startY, { width: 150 });

    // Move to next line for comments
    this.doc.y = Math.max(this.doc.y, startY + 15);

    if (spec.compiledComments) {
      this.doc
        .font(FONTS.italic)
        .fontSize(8)
        .fillColor(COLORS.text)
        .text(spec.compiledComments.substring(0, 300) + (spec.compiledComments.length > 300 ? '...' : ''), {
          width: this.contentWidth - 20,
          indent: 10
        });
    }

    // Separator
    this.doc
      .strokeColor(COLORS.border)
      .lineWidth(0.5)
      .moveTo(this.margin, this.doc.y + 3)
      .lineTo(this.pageWidth - this.margin, this.doc.y + 3)
      .stroke();

    this.doc.y += 8;
  }

  private addCompilationStatistics(compilation: ILeadReaderCompilation): void {
    this.doc.moveDown(1);

    this.doc
      .fillColor(COLORS.primary)
      .font(FONTS.bold)
      .fontSize(14)
      .text('Compliance Statistics');

    this.doc.moveDown(0.5);

    const stats = compilation.finalCompilation.complianceStatistics;

    this.drawInfoBox([
      { label: 'Total Specifications', value: stats.totalSpecifications.toString() },
      { label: 'Compliant', value: `${stats.compliantCount} (${Math.round(stats.compliantCount / stats.totalSpecifications * 100)}%)` },
      { label: 'Non-Compliant', value: `${stats.nonCompliantCount} (${Math.round(stats.nonCompliantCount / stats.totalSpecifications * 100)}%)` },
      { label: 'Not Applicable', value: stats.notApplicableCount.toString() },
      { label: 'Overall Compliance Rate', value: `${stats.complianceRate}%` }
    ]);

    this.doc.moveDown(1);
  }

  private addCompilationFinalAssessment(compilation: ILeadReaderCompilation): void {
    this.doc.addPage();

    this.doc
      .fillColor(COLORS.primary)
      .font(FONTS.bold)
      .fontSize(14)
      .text('Lead Reader Final Assessment');

    this.doc.moveDown(0.5);

    // Final Recommendation
    if (compilation.finalCompilation.finalRecommendation) {
      this.doc
        .font(FONTS.bold)
        .fontSize(11)
        .fillColor(COLORS.text)
        .text('Final Recommendation:');

      this.doc
        .font(FONTS.regular)
        .fontSize(10)
        .text(this.formatRecommendation(compilation.finalCompilation.finalRecommendation));

      if (compilation.finalCompilation.conditionDetails) {
        this.doc
          .font(FONTS.italic)
          .fontSize(9)
          .text(`Conditions: ${compilation.finalCompilation.conditionDetails}`);
      }
    }

    this.doc.moveDown(1);

    // Strengths
    this.addTextSection('Compiled Program Strengths', compilation.finalCompilation.finalStrengths);

    // Weaknesses
    this.addTextSection('Compiled Program Weaknesses', compilation.finalCompilation.finalWeaknesses);

    // Lead Reader Summary
    if (compilation.finalCompilation.leadReaderSummary) {
      this.addTextSection('Lead Reader Summary', compilation.finalCompilation.leadReaderSummary);
    }
  }

  private addCompilationSignature(compilation: ILeadReaderCompilation, leadReader: ReaderInfo): void {
    this.doc.moveDown(2);

    this.doc
      .strokeColor(COLORS.text)
      .lineWidth(1)
      .moveTo(this.margin, this.doc.y)
      .lineTo(this.margin + 200, this.doc.y)
      .stroke();

    this.doc.moveDown(0.3);

    this.doc
      .font(FONTS.regular)
      .fontSize(10)
      .text('Lead Reader Signature', this.margin);

    if (compilation.finalCompilation.signature) {
      this.doc
        .font(FONTS.italic)
        .fontSize(12)
        .text(compilation.finalCompilation.signature, this.margin, this.doc.y - 30);
    }

    this.doc.moveDown(1);
    this.doc
      .font(FONTS.regular)
      .fontSize(10)
      .text(`Date: ${compilation.finalCompilation.signedAt ? format(new Date(compilation.finalCompilation.signedAt), 'MMMM d, yyyy') : '_________________'}`);
  }

  // ============================================
  // HELPER METHODS
  // ============================================

  private drawInfoBox(items: { label: string; value: string }[]): void {
    const boxStartY = this.doc.y;
    const boxPadding = 10;
    const lineHeight = 18;
    const boxHeight = items.length * lineHeight + boxPadding * 2;

    // Draw box background
    this.doc
      .rect(this.margin, boxStartY, this.contentWidth, boxHeight)
      .fill(COLORS.lightGray);

    // Draw box border
    this.doc
      .strokeColor(COLORS.border)
      .lineWidth(1)
      .rect(this.margin, boxStartY, this.contentWidth, boxHeight)
      .stroke();

    // Add items
    let currentY = boxStartY + boxPadding;
    for (const item of items) {
      this.doc
        .fillColor(COLORS.text)
        .font(FONTS.bold)
        .fontSize(10)
        .text(`${item.label}:`, this.margin + boxPadding, currentY, { continued: true })
        .font(FONTS.regular)
        .text(` ${item.value}`);

      currentY += lineHeight;
    }

    this.doc.y = boxStartY + boxHeight + 10;
  }

  private addTextSection(title: string, content: string): void {
    if (!content) return;

    this.doc
      .font(FONTS.bold)
      .fontSize(11)
      .fillColor(COLORS.text)
      .text(title);

    this.doc.moveDown(0.3);

    this.doc
      .font(FONTS.regular)
      .fontSize(10)
      .text(content, {
        width: this.contentWidth,
        align: 'justify'
      });

    this.doc.moveDown(1);
  }

  private getComplianceColor(compliance: ComplianceStatus): string {
    switch (compliance) {
      case 'compliant': return COLORS.compliant;
      case 'non_compliant': return COLORS.nonCompliant;
      case 'not_applicable': return COLORS.notApplicable;
      default: return COLORS.text;
    }
  }

  private getComplianceSymbol(compliance: ComplianceStatus): string {
    switch (compliance) {
      case 'compliant': return '✓ Y';
      case 'non_compliant': return '✗ N';
      case 'not_applicable': return '— N/A';
      default: return '○';
    }
  }

  private formatProgramLevel(level: string): string {
    switch (level) {
      case 'associate': return 'Associate Degree';
      case 'bachelors': return 'Baccalaureate Degree';
      case 'masters': return "Master's Degree";
      default: return level;
    }
  }

  private formatRecommendation(rec: RecommendationType): string {
    switch (rec) {
      case 'accreditation_no_conditions': return 'Accreditation with no conditions';
      case 'conditional_accreditation': return 'Conditional accreditation';
      case 'deny_accreditation': return 'Deny accreditation';
      case 'hold_decision': return 'Hold decision';
      default: return rec;
    }
  }

  private summarizeVotes(votes: { reviewerName: string; compliance: ComplianceStatus }[]): string {
    const compliant = votes.filter(v => v.compliance === 'compliant').length;
    const nonCompliant = votes.filter(v => v.compliance === 'non_compliant').length;
    const na = votes.filter(v => v.compliance === 'not_applicable').length;

    return `Y: ${compliant} | N: ${nonCompliant} | N/A: ${na}`;
  }
}

export const pdfGeneratorService = new PDFGeneratorService();
