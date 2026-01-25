import { Request, Response } from 'express';
import { CurriculumMatrix, ICurriculumMatrix } from '../models/CurriculumMatrix';
import { Submission } from '../models/Submission';
import mongoose from 'mongoose';

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    role: string;
  };
}

/**
 * Get curriculum matrix for a submission
 */
export const getMatrix = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { submissionId, matrixId } = req.params;

    let matrix;
    if (matrixId) {
      matrix = await CurriculumMatrix.findById(matrixId);
    } else {
      // Get the first/primary matrix for this submission
      matrix = await CurriculumMatrix.findOne({ submissionId });

      // Create one if it doesn't exist
      if (!matrix) {
        matrix = await CurriculumMatrix.create({
          submissionId,
          courses: [],
          standards: []
        });
      }
    }

    if (!matrix) {
      return res.status(404).json({ error: 'Matrix not found' });
    }

    return res.json(matrix);
  } catch (error) {
    console.error('Get matrix error:', error);
    return res.status(500).json({ error: 'Failed to get matrix' });
  }
};

/**
 * Add a course column to the matrix
 */
export const addCourse = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { submissionId, matrixId } = req.params;
    const { coursePrefix, courseNumber, courseName, credits } = req.body;

    // Validation
    if (!coursePrefix || !courseNumber || !courseName) {
      return res.status(400).json({ error: 'Course prefix, number, and name are required' });
    }

    const matrix = await CurriculumMatrix.findById(matrixId);
    if (!matrix) {
      return res.status(404).json({ error: 'Matrix not found' });
    }

    // Check for duplicate
    const exists = matrix.courses.some(
      c => c.coursePrefix === coursePrefix && c.courseNumber === courseNumber
    );
    if (exists) {
      return res.status(400).json({ error: 'Course already exists in matrix' });
    }

    // Generate unique ID and determine order
    const courseId = new mongoose.Types.ObjectId().toString();
    const maxOrder = matrix.courses.length > 0
      ? Math.max(...matrix.courses.map(c => c.order))
      : 0;

    // Add course
    matrix.courses.push({
      id: courseId,
      coursePrefix: coursePrefix.toUpperCase(),
      courseNumber,
      courseName,
      credits: credits || 3,
      order: maxOrder + 1
    });

    await matrix.save();

    return res.status(201).json({
      message: 'Course added successfully',
      course: matrix.courses[matrix.courses.length - 1],
      matrix
    });
  } catch (error) {
    console.error('Add course error:', error);
    return res.status(500).json({ error: 'Failed to add course' });
  }
};

/**
 * Remove a course column from the matrix
 */
export const removeCourse = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { matrixId, courseId } = req.params;

    const matrix = await CurriculumMatrix.findById(matrixId);
    if (!matrix) {
      return res.status(404).json({ error: 'Matrix not found' });
    }

    // Remove course
    const courseIndex = matrix.courses.findIndex(c => c.id === courseId);
    if (courseIndex === -1) {
      return res.status(404).json({ error: 'Course not found in matrix' });
    }

    matrix.courses.splice(courseIndex, 1);

    // Remove all assessments for this course
    matrix.standards.forEach(standard => {
      standard.courseAssessments = standard.courseAssessments.filter(
        a => a.courseId !== courseId
      );
    });

    await matrix.save();

    return res.json({
      message: 'Course removed successfully',
      matrix
    });
  } catch (error) {
    console.error('Remove course error:', error);
    return res.status(500).json({ error: 'Failed to remove course' });
  }
};

/**
 * Update assessment for a cell (course x specification)
 */
export const updateAssessment = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { matrixId } = req.params;
    const { standardCode, specCode, courseId, type, depth } = req.body;

    // Validation
    if (!standardCode || !specCode || !courseId) {
      return res.status(400).json({
        error: 'standardCode, specCode, and courseId are required'
      });
    }

    const validTypes = ['I', 'T', 'K', 'S', null];
    const validDepths = ['L', 'M', 'H', null];

    if (!validTypes.includes(type)) {
      return res.status(400).json({ error: 'Invalid type. Must be I, T, K, S, or null' });
    }
    if (!validDepths.includes(depth)) {
      return res.status(400).json({ error: 'Invalid depth. Must be L, M, H, or null' });
    }

    const matrix = await CurriculumMatrix.findById(matrixId);
    if (!matrix) {
      return res.status(404).json({ error: 'Matrix not found' });
    }

    // Verify course exists
    const courseExists = matrix.courses.some(c => c.id === courseId);
    if (!courseExists) {
      return res.status(404).json({ error: 'Course not found in matrix' });
    }

    // Find or create standard mapping
    let standardMapping = matrix.standards.find(
      s => s.standardCode === standardCode && s.specCode === specCode
    );

    if (!standardMapping) {
      standardMapping = {
        standardCode,
        specCode,
        courseAssessments: []
      };
      matrix.standards.push(standardMapping);
    }

    // Find or create course assessment
    const assessmentIndex = standardMapping.courseAssessments.findIndex(
      a => a.courseId === courseId
    );

    if (type === null && depth === null) {
      // Remove assessment if both are null
      if (assessmentIndex !== -1) {
        standardMapping.courseAssessments.splice(assessmentIndex, 1);
      }
    } else {
      if (assessmentIndex !== -1) {
        // Update existing
        standardMapping.courseAssessments[assessmentIndex].type = type;
        standardMapping.courseAssessments[assessmentIndex].depth = depth;
      } else {
        // Add new
        standardMapping.courseAssessments.push({
          courseId,
          type,
          depth
        });
      }
    }

    // Mark as modified to ensure save
    matrix.markModified('standards');
    await matrix.save();

    return res.json({
      message: 'Assessment updated successfully',
      standardMapping
    });
  } catch (error) {
    console.error('Update assessment error:', error);
    return res.status(500).json({ error: 'Failed to update assessment' });
  }
};

/**
 * Reorder courses in the matrix
 */
export const reorderCourses = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { matrixId } = req.params;
    const { courseIds } = req.body;

    if (!Array.isArray(courseIds)) {
      return res.status(400).json({ error: 'courseIds must be an array' });
    }

    const matrix = await CurriculumMatrix.findById(matrixId);
    if (!matrix) {
      return res.status(404).json({ error: 'Matrix not found' });
    }

    // Reorder courses based on provided IDs
    courseIds.forEach((courseId, index) => {
      const course = matrix.courses.find(c => c.id === courseId);
      if (course) {
        course.order = index;
      }
    });

    // Sort courses by order
    matrix.courses.sort((a, b) => a.order - b.order);

    await matrix.save();

    return res.json({
      message: 'Courses reordered successfully',
      courses: matrix.courses
    });
  } catch (error) {
    console.error('Reorder courses error:', error);
    return res.status(500).json({ error: 'Failed to reorder courses' });
  }
};

/**
 * Import matrix from CSV/Excel data
 */
export const importMatrix = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { matrixId } = req.params;
    const { courses, assessments } = req.body;

    const matrix = await CurriculumMatrix.findById(matrixId);
    if (!matrix) {
      return res.status(404).json({ error: 'Matrix not found' });
    }

    // Add courses
    if (Array.isArray(courses)) {
      for (const course of courses) {
        const exists = matrix.courses.some(
          c => c.coursePrefix === course.coursePrefix &&
               c.courseNumber === course.courseNumber
        );
        if (!exists) {
          const maxOrder = matrix.courses.length > 0
            ? Math.max(...matrix.courses.map(c => c.order))
            : 0;
          matrix.courses.push({
            id: new mongoose.Types.ObjectId().toString(),
            coursePrefix: course.coursePrefix.toUpperCase(),
            courseNumber: course.courseNumber,
            courseName: course.courseName || '',
            credits: course.credits || 3,
            order: maxOrder + 1
          });
        }
      }
    }

    // Add assessments
    if (Array.isArray(assessments)) {
      for (const assessment of assessments) {
        const { standardCode, specCode, coursePrefix, courseNumber, type, depth } = assessment;

        // Find course
        const course = matrix.courses.find(
          c => c.coursePrefix === coursePrefix.toUpperCase() &&
               c.courseNumber === courseNumber
        );
        if (!course) continue;

        // Find or create standard mapping
        let standardMapping = matrix.standards.find(
          s => s.standardCode === standardCode && s.specCode === specCode
        );

        if (!standardMapping) {
          standardMapping = {
            standardCode,
            specCode,
            courseAssessments: []
          };
          matrix.standards.push(standardMapping);
        }

        // Update or add assessment
        const existingIndex = standardMapping.courseAssessments.findIndex(
          a => a.courseId === course.id
        );

        if (existingIndex !== -1) {
          standardMapping.courseAssessments[existingIndex].type = type;
          standardMapping.courseAssessments[existingIndex].depth = depth;
        } else {
          standardMapping.courseAssessments.push({
            courseId: course.id,
            type,
            depth
          });
        }
      }
    }

    matrix.markModified('courses');
    matrix.markModified('standards');
    await matrix.save();

    return res.json({
      message: 'Matrix imported successfully',
      matrix
    });
  } catch (error) {
    console.error('Import matrix error:', error);
    return res.status(500).json({ error: 'Failed to import matrix' });
  }
};

/**
 * Export matrix data
 */
export const exportMatrix = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { matrixId } = req.params;
    const { format } = req.query;

    const matrix = await CurriculumMatrix.findById(matrixId);
    if (!matrix) {
      return res.status(404).json({ error: 'Matrix not found' });
    }

    if (format === 'csv') {
      // Build CSV
      const headers = ['Standard', 'Specification', ...matrix.courses.map(
        c => `${c.coursePrefix} ${c.courseNumber}`
      )];

      // Group assessments by standard/spec
      const rows: string[][] = [];
      const uniqueSpecs = new Set(matrix.standards.map(s => `${s.standardCode}|${s.specCode}`));

      uniqueSpecs.forEach(key => {
        const [standardCode, specCode] = key.split('|');
        const row = [standardCode, specCode];

        matrix.courses.forEach(course => {
          const mapping = matrix.standards.find(
            s => s.standardCode === standardCode && s.specCode === specCode
          );
          const assessment = mapping?.courseAssessments.find(a => a.courseId === course.id);
          row.push(assessment?.type && assessment?.depth
            ? `${assessment.type}/${assessment.depth}`
            : ''
          );
        });

        rows.push(row);
      });

      const csv = [headers, ...rows].map(row => row.join(',')).join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="curriculum-matrix.csv"`);
      return res.send(csv);
    }

    // Default: JSON
    return res.json(matrix);
  } catch (error) {
    console.error('Export matrix error:', error);
    return res.status(500).json({ error: 'Failed to export matrix' });
  }
};
