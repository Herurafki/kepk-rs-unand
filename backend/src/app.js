'use strict';
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const pool = require('./config/database');
const env = require('./config/env');
const authRoutes = require('./routes/auth.routes');
const sessionSettingsRoutes = require('./routes/session-settings.routes');
const auditTrailRoutes = require('./routes/audit-trail.routes');
const loginHistoryRoutes = require('./routes/login-history.routes');
const applicationMonitoringRoutes = require('./routes/application-monitoring.routes');
const userRoutes = require('./routes/user.routes');
const applicationRoutes = require('./routes/application.routes');
const screeningRoutes = require('./routes/screening.routes');
const documentRoutes = require('./routes/document.routes');
const documentStandaloneRoutes = require('./routes/document.standalone.routes');
const adminRoutes = require('./routes/admin.routes');
const sekretarisRoutes = require('./routes/sekretaris.routes');
const assignmentRoutes = require('./routes/assignment.routes');
const reviewRoutes = require('./routes/review.routes');
const letterRoutes = require('./routes/letter.routes');
const paymentRoutes = require('./routes/payment.routes');
const researcherCategoryRoutes = require('./routes/researchers_category.routes');
const masterRoutes = require('./routes/master.routes');
const { errorHandler } = require('./middleware/error.middleware');
const { authenticate } = require('./middleware/auth.middleware');
const { authorize } = require('./middleware/role.middleware');
const { uploadLetter } = require('./middleware/upload.middleware');
const reviewController = require('./controllers/review.controller');
const assignmentController = require('./controllers/assignment.controller');
const letterController = require('./controllers/letter.controller');
const historyService = require('./services/history.service');
const { success } = require('./utils/response');

const app = express();
app.use(helmet({ frameguard: { action: 'deny' } }));
// const allowedOrigins = ['http://localhost:5173','http://127.0.0.1:5173','http://100.69.73.102:5173','http://100.74.145.117:5173','http://localhost:8080','http://127.0.0.1:8080','http://100.76.193.127:5173','http://100.69.73.102:5173','http://10.16.0.232:5173'];
const allowedOrigins = ['http://localhost:5173','http://127.0.0.1:5173','http://100.69.73.102:5173','http://100.74.145.117:5173','http://laptop-1pfiq0ki.local:5173','http://rsunand.duckdns.org:5173','http://localhost:8080','http://127.0.0.1:8080','http://100.76.193.127:5173',/^http:\/\/10\.16\.(?:25[0-5]|2[0-4]\d|1?\d?\d)\.(?:25[0-5]|2[0-4]\d|1?\d?\d):5173$/];
// app.use(cors({ origin: (origin, callback) => { if (!origin || allowedOrigins.includes(origin)) callback(null, true); else callback(new Error(`CORS not allowed: ${origin}`)); }, methods: ['GET','POST','PUT','DELETE','PATCH','OPTIONS'], allowedHeaders: ['Content-Type','Authorization'], credentials: true, optionsSuccessStatus: 204 }));
app.use(cors({ origin: (origin, callback) => { if (!origin || allowedOrigins.some(allowed => allowed instanceof RegExp ? allowed.test(origin) : allowed === origin)) callback(null, true); else callback(new Error(`CORS not allowed: ${origin}`)); }, methods: ['GET','POST','PUT','DELETE','PATCH','OPTIONS'], allowedHeaders: ['Content-Type','Authorization'], credentials: true, optionsSuccessStatus: 204 }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.get('/api/health', async (req, res) => {
  let database = 'disconnected';
  try {
    const result = await Promise.race([
      pool.query(`SELECT EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = $1) AS schema_exists`, [env.db.schema]),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Database health check timeout')), 2000)),
    ]);
    database = result.rows[0]?.schema_exists ? 'connected' : 'schema_not_found';
  } catch (_) {}
  res.status(200).json({ success: true, message: 'KEPK API is running', data: { status: 'healthy', database, timestamp: new Date().toISOString() } });
});

app.use('/api/auth', authRoutes);
app.use('/api/settings', sessionSettingsRoutes);
app.use('/api/admin/audit-trail', auditTrailRoutes);
app.use('/api/admin/login-history', loginHistoryRoutes);
app.use('/api/admin/application-monitoring', applicationMonitoringRoutes);
app.use('/api/users', userRoutes);
app.use('/api/researchers', authenticate, (req, res, next) => { req.url = '/researchers' + (req.url === '/' ? '/me' : req.url); next(); }, userRoutes);
app.use('/api/researchers-categories', researcherCategoryRoutes);
app.use('/api/master', masterRoutes);
app.use('/api/applications', applicationRoutes);
app.use('/api/applications/:id/screening', screeningRoutes);
app.use('/api/applications/:id/documents', documentRoutes);
app.use('/api/documents', documentStandaloneRoutes);

app.get('/api/applications/:id/reviews', authenticate, authorize('KETUA','SEKRETARIAT','DIKLIT','REVIEWER','SUPERADMIN'), reviewController.getRecommendationsByApplication);
app.get('/api/applications/:id/review-result', authenticate, authorize('KETUA','SEKRETARIAT','DIKLIT','REVIEWER','SUPERADMIN'), reviewController.getReviewResult);
app.post('/api/applications/:id/reviews', authenticate, authorize('REVIEWER'), reviewController.submit);
app.post('/api/applications/:id/assign-reviewer', authenticate, authorize('KETUA'), assignmentController.assign);

// Letters: Diklat and Sekretaris may monitor, generate, and upload signed letters.
app.get('/api/applications/:id/letter', authenticate, authorize('PENELITI','DIKLIT','SEKRETARIAT','KETUA','SUPERADMIN'), letterController.get);
app.post('/api/applications/:id/letter/generate', authenticate, authorize('DIKLIT','SEKRETARIAT'), letterController.generate);
app.post('/api/applications/:id/letter/upload-signed', authenticate, authorize('DIKLIT','SEKRETARIAT'), uploadLetter, letterController.uploadSigned);
app.post('/api/applications/:id/letter', authenticate, authorize('DIKLIT','SEKRETARIAT'), uploadLetter, letterController.issue);

app.get('/api/applications/:id/history', authenticate, authorize('PENELITI','DIKLIT','SEKRETARIAT','KETUA','REVIEWER','SUPERADMIN'), async (req, res, next) => {
  try { return success(res, await historyService.getHistory(req.params.id, req.user.id, req.user.roles), 'Application history retrieved'); }
  catch (err) { next(err); }
});
app.get('/api/applications/:id/revisions', authenticate, authorize('PENELITI','DIKLIT','SEKRETARIAT','KETUA','REVIEWER','SUPERADMIN'), async (req, res, next) => {
  try { return success(res, await historyService.getRevisions(req.params.id, req.user.id, req.user.roles), 'Revisions retrieved'); }
  catch (err) { next(err); }
});

app.put('/api/applications/:id/review-type', authenticate, authorize('KETUA'), reviewController.setReviewType);
app.post('/api/applications/:id/close-forum', authenticate, authorize('KETUA'), reviewController.closeForum);
app.post('/api/applications/:id/decision/approve', authenticate, authorize('KETUA'), reviewController.decideApprove);
app.post('/api/applications/:id/decision/revision', authenticate, authorize('KETUA'), reviewController.decideRevision);
app.post('/api/applications/:id/decision/reject', authenticate, authorize('KETUA'), reviewController.decideReject);
app.post('/api/applications/:id/decision/final', authenticate, authorize('KETUA'), reviewController.decideFinal);
app.use('/api/assignments', assignmentRoutes);
app.post('/api/review-assignments/:id/accept', authenticate, authorize('REVIEWER'), assignmentController.accept);
app.post('/api/review-assignments/:id/reject', authenticate, authorize('REVIEWER'), assignmentController.reject);
app.use('/api/reviews', reviewRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/diklit', applicationRoutes);
app.use('/api/sekretaris', sekretarisRoutes);
app.use('/api/letters', letterRoutes);
app.use('/api', paymentRoutes);

app.use((req, res) => res.status(404).json({ success: false, message: 'Route not found', data: null }));
app.use(errorHandler);
module.exports = app;
