import { Request, Response } from 'express';
import { Review } from '../models/Review';
import { LeadReaderCompilation } from '../models/LeadReaderCompilation';
import { User } from '../models/User';
import { PDFGeneratorService } from '../services/pdfGenerator';

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    role: string;
    firstName?: string;
    lastName?: string;
  };
}

/**
 * Generate PDF for a reader report
 */
export const generateReaderReportPDF = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { reviewId } = req.params;

    const review = await Review.findById(reviewId);
    if (!review) {
      return res.status(404).json({ error: 'Review not found' });
    }

    // Check authorization
    if (
      review.reviewerId.toString() !== req.user?.id &&
      req.user?.role !== 'admin' &&
      req.user?.role !== 'lead_reader'
    ) {
      return res.status(403).json({ error: 'Not authorized to generate this report' });
    }

    // Get reader info
    const reader = await User.findById(review.reviewerId);
    if (!reader) {
      return res.status(404).json({ error: 'Reader not found' });
    }

    // Generate PDF
    const pdfGenerator = new PDFGeneratorService();
    const pdfBuffer = await pdfGenerator.generateReaderReport(review, {
      firstName: reader.firstName,
      lastName: reader.lastName,
      email: reader.email
    });

    // Set response headers
    const filename = `reader-report-${review.institutionName.replace(/\s+/g, '-')}-${review.reviewerNumber}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', pdfBuffer.length);

    return res.send(pdfBuffer);
  } catch (error) {
    console.error('Generate reader report PDF error:', error);
    return res.status(500).json({ error: 'Failed to generate PDF' });
  }
};

/**
 * Generate PDF for a lead reader compilation report
 */
export const generateCompilationReportPDF = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { compilationId } = req.params;

    const compilation = await LeadReaderCompilation.findById(compilationId);
    if (!compilation) {
      return res.status(404).json({ error: 'Compilation not found' });
    }

    // Check authorization
    if (
      compilation.leadReaderId.toString() !== req.user?.id &&
      req.user?.role !== 'admin'
    ) {
      return res.status(403).json({ error: 'Not authorized to generate this report' });
    }

    // Get lead reader info
    const leadReader = await User.findById(compilation.leadReaderId);
    if (!leadReader) {
      return res.status(404).json({ error: 'Lead reader not found' });
    }

    // Generate PDF
    const pdfGenerator = new PDFGeneratorService();
    const pdfBuffer = await pdfGenerator.generateCompilationReport(compilation, {
      firstName: leadReader.firstName,
      lastName: leadReader.lastName,
      email: leadReader.email
    });

    // Set response headers
    const filename = `compilation-report-${compilation.institutionName.replace(/\s+/g, '-')}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', pdfBuffer.length);

    return res.send(pdfBuffer);
  } catch (error) {
    console.error('Generate compilation report PDF error:', error);
    return res.status(500).json({ error: 'Failed to generate PDF' });
  }
};

/**
 * Generate a summary PDF of all reader reports for a submission
 */
export const generateAllReaderReportsPDF = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { submissionId } = req.params;

    if (req.user?.role !== 'admin' && req.user?.role !== 'lead_reader') {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const reviews = await Review.find({
      submissionId,
      status: 'submitted'
    }).populate('reviewerId', 'firstName lastName email');

    if (reviews.length === 0) {
      return res.status(404).json({ error: 'No submitted reviews found' });
    }

    // For now, return the first review's PDF
    // In a full implementation, you might want to combine all PDFs
    const firstReview = reviews[0];
    const reader = firstReview.reviewerId as any;

    const pdfGenerator = new PDFGeneratorService();
    const pdfBuffer = await pdfGenerator.generateReaderReport(firstReview, {
      firstName: reader.firstName,
      lastName: reader.lastName,
      email: reader.email
    });

    const filename = `reader-reports-${submissionId}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', pdfBuffer.length);

    return res.send(pdfBuffer);
  } catch (error) {
    console.error('Generate all reader reports PDF error:', error);
    return res.status(500).json({ error: 'Failed to generate PDF' });
  }
};

/**
 * Preview reader report (returns HTML for preview)
 */
export const previewReaderReport = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { reviewId } = req.params;

    const review = await Review.findById(reviewId)
      .populate('reviewerId', 'firstName lastName email');

    if (!review) {
      return res.status(404).json({ error: 'Review not found' });
    }

    // Check authorization
    if (
      (review.reviewerId as any)._id.toString() !== req.user?.id &&
      req.user?.role !== 'admin' &&
      req.user?.role !== 'lead_reader'
    ) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const reader = review.reviewerId as any;

    // Return data for client-side preview rendering
    return res.json({
      review: {
        institutionName: review.institutionName,
        programName: review.programName,
        programLevel: review.programLevel,
        reviewerNumber: review.reviewerNumber,
        totalReviewers: review.totalReviewers,
        reviewDate: review.reviewDate,
        assessments: review.assessments,
        finalAssessment: review.finalAssessment,
        progress: review.progress
      },
      reader: {
        firstName: reader.firstName,
        lastName: reader.lastName,
        email: reader.email
      }
    });
  } catch (error) {
    console.error('Preview reader report error:', error);
    return res.status(500).json({ error: 'Failed to generate preview' });
  }
};

/**
 * Preview compilation report (returns data for preview)
 */
export const previewCompilationReport = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { compilationId } = req.params;

    const compilation = await LeadReaderCompilation.findById(compilationId)
      .populate('leadReaderId', 'firstName lastName email');

    if (!compilation) {
      return res.status(404).json({ error: 'Compilation not found' });
    }

    // Check authorization
    if (
      (compilation.leadReaderId as any)._id.toString() !== req.user?.id &&
      req.user?.role !== 'admin'
    ) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const leadReader = compilation.leadReaderId as any;

    return res.json({
      compilation: {
        institutionName: compilation.institutionName,
        programName: compilation.programName,
        programLevel: compilation.programLevel,
        totalReaders: compilation.totalReaders,
        completedReviews: compilation.completedReviews,
        compiledAssessments: compilation.compiledAssessments,
        readerRecommendations: compilation.readerRecommendations,
        finalCompilation: compilation.finalCompilation,
        status: compilation.status
      },
      leadReader: {
        firstName: leadReader.firstName,
        lastName: leadReader.lastName,
        email: leadReader.email
      }
    });
  } catch (error) {
    console.error('Preview compilation report error:', error);
    return res.status(500).json({ error: 'Failed to generate preview' });
  }
};
