import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import { INITIAL_CASES } from './src/constants/cases.ts';
import { INITIAL_WORKFLOWS } from './src/constants/workflows.ts';
import { INITIAL_AGENTS } from './src/constants/agents.ts';
import { RoleId, ROLE_PERMISSIONS } from './src/types/auth.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT ?? 8080);
  const API_BASE = process.env.API_BASE_URL ?? 'http://127.0.0.1:8000';

  app.use(express.json({ limit: '30mb' }));

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
  app.get('/api/cases', authMiddleware, async (req: any, res) => {
    try {
      const limit = String(req.query.limit ?? '200');
      const response = await fetch(`${API_BASE}/cases?limit=${encodeURIComponent(limit)}`, {
        headers: buildUpstreamHeaders(req)
      });
      if (!response.ok) {
        const errorText = await response.text();
        res.status(response.status).json({
          error: 'Upstream cases request failed',
          status: response.status,
          details: errorText || 'No response body'
        });
        return;
      }
      const payload = await response.json();
      const apiCases = Array.isArray(payload?.data) ? payload.data : [];
      res.json(apiCases);
      return;
    } catch (error) {
      console.warn('[web] Cases proxy failed:', error);
      res.status(502).json({
        error: 'Cases proxy failed',
        details: error instanceof Error ? error.message : 'Unknown proxy error'
      });
      return;
    }
  });

  app.get('/api/cases/:id', authMiddleware, async (req: any, res) => {
    try {
      const response = await fetch(`${API_BASE}/cases/${encodeURIComponent(req.params.id)}`, {
        headers: buildUpstreamHeaders(req)
      });
      if (response.ok) {
        const payload = await response.json();
        res.json(payload);
        return;
      }
      const errorText = await response.text();
      res.status(response.status).json({
        error: 'Upstream case detail request failed',
        status: response.status,
        details: errorText || 'No response body'
      });
      return;
    } catch (error) {
      console.warn('[web] Case detail proxy failed:', error);
      res.status(502).json({
        error: 'Case detail proxy failed',
        details: error instanceof Error ? error.message : 'Unknown proxy error'
      });
      return;
    }
  });

  app.get('/api/workflows', authMiddleware, (req, res) => {
    fetch(`${API_BASE}/workflows/library`, {
      headers: buildUpstreamHeaders(req)
    })
      .then(async (response) => {
        if (!response.ok) throw new Error(`Upstream returned ${response.status}`);
        const payload = await response.json();
        const data = Array.isArray(payload?.data) ? payload.data : Array.isArray(payload) ? payload : [];
        res.json(data);
      })
      .catch((error) => {
        console.warn('[web] Falling back to local mock workflows:', error);
        res.json(INITIAL_WORKFLOWS);
      });
  });

  app.get('/api/agents', authMiddleware, (req, res) => {
    fetch(`${API_BASE}/agents`, {
      headers: buildUpstreamHeaders(req)
    })
      .then(async (response) => {
        if (!response.ok) throw new Error(`Upstream returned ${response.status}`);
        const payload = await response.json();
        const data = Array.isArray(payload?.data) ? payload.data : Array.isArray(payload) ? payload : [];
        res.json(data);
      })
      .catch((error) => {
        console.warn('[web] Falling back to local mock agents:', error);
        res.json(INITIAL_AGENTS);
      });
  });

  app.get('/api/email/threads', authMiddleware, async (req: any, res) => {
    try {
      const limit = String(req.query.limit ?? '200');
      const caseId = typeof req.query.caseId === 'string' ? req.query.caseId : '';
      const params = new URLSearchParams();
      if (limit) params.set('limit', limit);
      if (caseId) params.set('caseId', caseId);
      const response = await fetch(`${API_BASE}/email/threads?${params.toString()}`, {
        headers: buildUpstreamHeaders(req)
      });
      if (!response.ok) {
        const errorText = await response.text();
        res.status(response.status).json({
          error: 'Upstream email threads request failed',
          status: response.status,
          details: errorText || 'No response body'
        });
        return;
      }
      const payload = await response.json();
      res.json(payload);
      return;
    } catch (error) {
      console.warn('[web] Email threads proxy failed:', error);
      res.status(502).json({
        error: 'Email threads proxy failed',
        details: error instanceof Error ? error.message : 'Unknown proxy error'
      });
      return;
    }
  });

  app.post('/api/portal/requests', authMiddleware, async (req: any, res) => {
    try {
      const response = await fetch(`${API_BASE}/portal/requests`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(req.body ?? {})
      });
      const text = await response.text();
      const payload = text ? JSON.parse(text) : {};
      res.status(response.status).json(payload);
      return;
    } catch (error) {
      console.warn('[web] Portal request proxy failed:', error);
      res.status(502).json({ error: 'Portal request proxy failed' });
    }
  });

  app.post('/api/email/send', authMiddleware, async (req: any, res) => {
    try {
      const response = await fetch(`${API_BASE}/email/send`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(req.body ?? {})
      });
      const text = await response.text();
      const payload = text ? JSON.parse(text) : {};
      res.status(response.status).json(payload);
      return;
    } catch (error) {
      console.warn('[web] Email send proxy failed:', error);
      res.status(502).json({ error: 'Email send proxy failed' });
    }
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
  const buildUpstreamHeaders = (req: any) => {
    const authHeader = typeof req.headers?.authorization === 'string' ? req.headers.authorization : '';
    return authHeader ? { Authorization: authHeader } : {};
  };
