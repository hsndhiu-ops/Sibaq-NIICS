import { Router, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db';
import { requireAuth, AuthenticatedRequest } from '../auth';

const router = Router();
const uploadsDir = path.resolve(process.cwd(), 'uploads');

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const unique = `${uuidv4()}${ext}`;
    cb(null, unique);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB limit
});

// Authenticated upload endpoint
router.post(
  '/upload',
  requireAuth,
  upload.single('file'),
  (req: AuthenticatedRequest, res: Response) => {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const purpose = (req.body.purpose as any) || 'task_attachment';
    const fileId = uuidv4();

    db.addUploadedFile({
      id: fileId,
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      size: req.file.size,
      filePath: req.file.path,
      uploadedBy: req.user!.id,
      purpose,
      createdAt: new Date().toISOString(),
    });

    res.json({
      fileId,
      originalName: req.file.originalname,
      size: req.file.size,
      mimeType: req.file.mimetype,
    });
  }
);

// File download endpoint with strict role security
router.get(
  '/download/:fileId',
  requireAuth,
  (req: AuthenticatedRequest, res: Response) => {
    const fileRecord = db.getUploadedFile(req.params.fileId);
    if (!fileRecord || !fs.existsSync(fileRecord.filePath)) {
      return res.status(404).json({ error: 'File not found or has been purged.' });
    }

    const user = req.user!;

    // Screenshot permission: STRICTLY ADMIN ONLY
    if (fileRecord.purpose === 'screenshot') {
      if (user.role !== 'admin') {
        return res.status(403).json({ error: 'Screenshots can only be viewed by administrators.' });
      }
    }

    // Task attachment: admin, the guide who uploaded, or students
    // All authenticated users can download legitimate non-screenshot attachments
    res.setHeader('Content-Type', fileRecord.mimeType);
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${encodeURIComponent(fileRecord.originalName)}"`
    );
    res.sendFile(fileRecord.filePath);
  }
);

export default router;
