import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import { INITIAL_CASES } from './src/constants/cases';
import { INITIAL_WORKFLOWS } from './src/constants/workflows';
import { INITIAL_AGENTS } from './src/constants/agents';
import { RoleId, ROLE_PERMISSIONS } from './src/types/auth';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Mock Auth Middleware (In a real app, this would use JWT/Session)
  const authMiddleware = (req: any, res: any, next: any) => {
    const userRole = (req.headers['x-user-role'] as RoleId) || 'CASE_REVIEWER';
    req.user = {
      id: 'user-1',
      name: 'Demo User',
      role: userRole,
    };
    next();
  };

  // Compliance & RBAC Filtering Logic
  const filterCaseData = (caseData: any, role: RoleId) => {
    const permissions = ROLE_PERMISSIONS[role] || [];
    const canReadFinancials = permissions.some(p => p.resource === 'FINANCIALS' && p.action === 'READ');
    const canReadFraud = permissions.some(p => p.resource === 'FRAUD_DATA' && p.action === 'READ');
    const canReadMedical = permissions.some(p => p.resource === 'MEDICAL_DATA' && p.action === 'READ');

    // Deep clone to avoid modifying original
    const filtered = JSON.parse(JSON.stringify(caseData));

    if (!canReadFinancials) {
      delete filtered.financials;
      filtered.metadata = { ...filtered.metadata, financials_hidden: true };
    }

    if (!canReadFraud) {
      delete filtered.risk_score;
      filtered.metadata = { ...filtered.metadata, fraud_data_hidden: true };
    }

    if (!canReadMedical) {
      // Mask sensitive medical info if no medical permission
      if (filtered.category === 'MEDICAL') {
        filtered.description = "[MASKED FOR COMPLIANCE]";
        filtered.summary = "[MASKED FOR COMPLIANCE]";
      }
    }

    return filtered;
  };

  // API Routes
  app.get('/api/cases', authMiddleware, (req: any, res) => {
    const filteredCases = INITIAL_CASES.map(c => filterCaseData(c, req.user.role));
    res.json(filteredCases);
  });

  app.get('/api/cases/:id', authMiddleware, (req: any, res) => {
    const caseItem = INITIAL_CASES.find(c => c.id === req.params.id);
    if (!caseItem) return res.status(404).json({ error: 'Case not found' });
    res.json(filterCaseData(caseItem, req.user.role));
  });

  app.get('/api/workflows', authMiddleware, (req, res) => {
    res.json(INITIAL_WORKFLOWS);
  });

  app.get('/api/agents', authMiddleware, (req, res) => {
    res.json(INITIAL_AGENTS);
  });

  // Audit Log Endpoint (HIPAA Accountability)
  app.post('/api/audit', authMiddleware, (req: any, res) => {
    const { action, resourceId, metadata } = req.body;
    console.log(`[AUDIT LOG] User: ${req.user.id}, Role: ${req.user.role}, Action: ${action}, Resource: ${resourceId}, Timestamp: ${new Date().toISOString()}`);
    // In a real app, write to a secure, immutable database
    res.json({ status: 'logged' });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
