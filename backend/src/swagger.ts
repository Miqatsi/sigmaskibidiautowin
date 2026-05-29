import swaggerJsdoc from 'swagger-jsdoc';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Sima Arome API',
      version: '1.0.0',
      description: 'Enterprise Manufacturing Intelligence Platform — AI-powered lot traceability, QC management, production tracking, recall simulation, warehouse intelligence.',
      contact: { name: 'CyberHack Team', url: 'https://github.com/Miqatsi/sigmaskibidiautowin' },
    },
    servers: [{ url: 'http://localhost:3000', description: 'Development' }],
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT', description: 'Login via POST /auth/login to get token' },
      },
      schemas: {
        Error: { type: 'object', properties: { success: { type: 'boolean', example: false }, message: { type: 'string' } } },
        Success: { type: 'object', properties: { success: { type: 'boolean', example: true }, data: { type: 'object' } } },
        LoginRequest: { type: 'object', required: ['username', 'password'], properties: { username: { type: 'string', example: 'admin' }, password: { type: 'string', example: 'password123' } } },
        LoginResponse: { type: 'object', properties: { success: { type: 'boolean' }, data: { type: 'object', properties: { token: { type: 'string' }, user: { type: 'object', properties: { id: { type: 'string' }, username: { type: 'string' }, email: { type: 'string' }, fullName: { type: 'string' }, role: { type: 'string' } } } } } } },
        CopilotRequest: { type: 'object', required: ['question'], properties: { question: { type: 'string', example: 'Why is PT Bahan Murah Jaya risky?' } } },
        CopilotResponse: { type: 'object', properties: { success: { type: 'boolean' }, data: { type: 'object', properties: { summary: { type: 'string' }, confidence: { type: 'number' }, riskLevel: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] }, intent: { type: 'string' }, evidence: { type: 'array', items: { type: 'string' } }, recommendations: { type: 'array', items: { type: 'string' } } } } } },
      },
    },
    security: [{ bearerAuth: [] }],
    tags: [
      { name: 'Authentication', description: 'Login and profile' },
      { name: 'Master Data', description: 'Suppliers, Materials, Products' },
      { name: 'Operations', description: 'Lots, QC, Production' },
      { name: 'Inventory', description: 'Transactions and balance' },
      { name: 'Warehouse Intelligence', description: 'Floor map, cold chain, hazard, smart slotting' },
      { name: 'AI Services', description: 'Copilot, Reports, Alerts' },
      { name: 'Analytics', description: 'Traceability and Recall Simulator' },
    ],
    paths: {
      '/health': { get: { tags: ['Authentication'], summary: 'Health check', security: [], responses: { '200': { description: 'OK', content: { 'application/json': { schema: { type: 'object', properties: { status: { type: 'string', example: 'ok' }, timestamp: { type: 'string' } } } } } } } } },
      '/auth/login': { post: { tags: ['Authentication'], summary: 'Login and get JWT token', security: [], requestBody: { required: true, content: { 'application/json': { schema: { '$ref': '#/components/schemas/LoginRequest' } } } }, responses: { '200': { description: 'Token returned', content: { 'application/json': { schema: { '$ref': '#/components/schemas/LoginResponse' } } } }, '401': { description: 'Invalid credentials' } } } },
      '/auth/profile': { get: { tags: ['Authentication'], summary: 'Get current user profile', responses: { '200': { description: 'User profile' }, '401': { description: 'Unauthorized' } } } },
      '/suppliers': { get: { tags: ['Master Data'], summary: 'List all suppliers', parameters: [{ name: 'page', in: 'query', schema: { type: 'integer' } }, { name: 'limit', in: 'query', schema: { type: 'integer' } }], responses: { '200': { description: 'Paginated supplier list' } } }, post: { tags: ['Master Data'], summary: 'Create supplier', requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { name: { type: 'string' }, code: { type: 'string' } } } } } }, responses: { '201': { description: 'Created' } } } },
      '/suppliers/{id}': { get: { tags: ['Master Data'], summary: 'Get supplier by ID', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Supplier details' } } }, patch: { tags: ['Master Data'], summary: 'Update supplier', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Updated' } } }, delete: { tags: ['Master Data'], summary: 'Soft-delete supplier', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Deleted' } } } },
      '/materials': { get: { tags: ['Master Data'], summary: 'List all materials', responses: { '200': { description: 'Material list' } } }, post: { tags: ['Master Data'], summary: 'Create material', responses: { '201': { description: 'Created' } } } },
      '/lots': { get: { tags: ['Operations'], summary: 'List lots (filterable by status, supplier, material)', parameters: [{ name: 'status', in: 'query', schema: { type: 'string', enum: ['PENDING_QC', 'APPROVED', 'REJECTED', 'CONSUMED'] } }, { name: 'supplierId', in: 'query', schema: { type: 'string' } }], responses: { '200': { description: 'Lot list' } } }, post: { tags: ['Operations'], summary: 'Receive new lot', responses: { '201': { description: 'Lot created with PENDING_QC status' } } } },
      '/lots/{id}/status': { patch: { tags: ['Operations'], summary: 'Update lot status (state machine)', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { status: { type: 'string', enum: ['APPROVED', 'REJECTED', 'CONSUMED'] } } } } } }, responses: { '200': { description: 'Status updated' }, '422': { description: 'Invalid transition' } } } },
      '/qc': { get: { tags: ['Operations'], summary: 'List QC logs', responses: { '200': { description: 'QC log list' } } }, post: { tags: ['Operations'], summary: 'Create QC inspection (auto-updates lot status)', requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { type: { type: 'string', enum: ['INCOMING', 'IN_PROCESS', 'FINAL'] }, result: { type: 'string', enum: ['PASS', 'FAIL', 'CONDITIONAL'] }, rawMaterialLotId: { type: 'string' }, notes: { type: 'string' } } } } } }, responses: { '201': { description: 'QC created, lot status updated' } } } },
      '/production/orders': { get: { tags: ['Operations'], summary: 'List production orders', responses: { '200': { description: 'Order list' } } }, post: { tags: ['Operations'], summary: 'Create production order', responses: { '201': { description: 'Created' } } } },
      '/production/batches': { get: { tags: ['Operations'], summary: 'List production batches', responses: { '200': { description: 'Batch list' } } }, post: { tags: ['Operations'], summary: 'Create batch (consumes APPROVED lots)', responses: { '201': { description: 'Batch created, lots consumed' }, '422': { description: 'Lot not APPROVED' } } } },
      '/inventory/transactions': { get: { tags: ['Inventory'], summary: 'Transaction history', responses: { '200': { description: 'Transaction list' } } }, post: { tags: ['Inventory'], summary: 'Record inventory movement', requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { type: { type: 'string', enum: ['IN', 'OUT', 'TRANSFER', 'ADJUSTMENT', 'CONSUME', 'SHIP'] }, storageLocationId: { type: 'string' }, quantity: { type: 'number' }, unit: { type: 'string' } } } } } }, responses: { '201': { description: 'Transaction recorded' } } } },
      '/inventory/balance/{locationId}': { get: { tags: ['Inventory'], summary: 'Get stock balance at location', parameters: [{ name: 'locationId', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Balance data' } } } },
      '/warehouses/intelligence/map': { get: { tags: ['Warehouse Intelligence'], summary: 'Warehouse floor map with zones', responses: { '200': { description: 'Zone data with temperature, capacity, risk' } } } },
      '/warehouses/intelligence/health': { get: { tags: ['Warehouse Intelligence'], summary: 'Warehouse health score (0-100)', responses: { '200': { description: 'Health score with factors' } } } },
      '/warehouses/intelligence/cold-chain': { get: { tags: ['Warehouse Intelligence'], summary: 'Cold chain monitoring alerts', responses: { '200': { description: 'Temperature alerts' } } } },
      '/warehouses/intelligence/recommend-slot': { get: { tags: ['Warehouse Intelligence'], summary: 'AI slot recommendation', parameters: [{ name: 'lotNumber', in: 'query', schema: { type: 'string' } }], responses: { '200': { description: 'Recommended location with confidence' } } } },
      '/warehouses/intelligence/hazard-violations': { get: { tags: ['Warehouse Intelligence'], summary: 'Detect hazard segregation violations', responses: { '200': { description: 'List of violations' } } } },
      '/warehouses/intelligence/hazard-matrix': { get: { tags: ['Warehouse Intelligence'], summary: 'Hazard compatibility matrix', responses: { '200': { description: 'Compatibility data' } } } },
      '/traceability/{lotNumber}': { get: { tags: ['Analytics'], summary: 'Full lot traceability (forward + backward)', parameters: [{ name: 'lotNumber', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Traceability chain' }, '404': { description: 'Lot not found' } } } },
      '/traceability/recall/{lotNumber}': { get: { tags: ['Analytics'], summary: 'Recall impact simulation', parameters: [{ name: 'lotNumber', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Recall impact with risk score' } } } },
      '/traceability/recall/{lotNumber}/graph': { get: { tags: ['Analytics'], summary: 'Recall contamination graph (nodes + edges)', parameters: [{ name: 'lotNumber', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Graph data for visualization' } } } },
      '/ai/copilot': { post: { tags: ['AI Services'], summary: 'AI Manufacturing Copilot — ask any manufacturing question', requestBody: { required: true, content: { 'application/json': { schema: { '$ref': '#/components/schemas/CopilotRequest' } } } }, responses: { '200': { description: 'AI analysis result', content: { 'application/json': { schema: { '$ref': '#/components/schemas/CopilotResponse' } } } } } } },
      '/ai/report': { post: { tags: ['AI Services'], summary: 'Generate Manufacturing Intelligence Report', requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { reportType: { type: 'string', example: 'executive' } } } } } }, responses: { '200': { description: 'Full executive report' } } } },
      '/ai/summary': { get: { tags: ['AI Services'], summary: 'Manufacturing health summary (dashboard widget)', responses: { '200': { description: 'Health score + KPIs' } } } },
      '/alerts': { get: { tags: ['AI Services'], summary: 'Operational alerts (auto-detected risks)', responses: { '200': { description: 'Alert list with severity' } } } },
      '/alerts/summary': { get: { tags: ['AI Services'], summary: 'Alert count by severity', responses: { '200': { description: 'Summary counts' } } } },
    },
  },
  apis: [], // We define paths inline above
};

export const swaggerSpec = swaggerJsdoc(options);
