// Central route aggregator - maps API paths to module routers
// Imports all domain-specific route modules and mounts them under their respective prefixes.
// Keeps the main server file decoupled from individual route definitions.

import { Router } from 'express';
import authRoutes from '../modules/auth/auth.routes.js';
import usersRoutes from '../modules/users/users.routes.js';
import departmentsRoutes from '../modules/departments/departments.routes.js';
import dashboardMappingsRoutes from '../modules/dashboard-mappings/dashboardMappings.routes.js';
import formsRoutes from '../modules/forms/forms.routes.js';
import isbarRecordsRoutes from '../modules/forms/isbarRecords.routes.js';
import patientsRoutes from '../modules/patients/patients.routes.js';
import resourcesRoutes from '../modules/resources/resources.routes.js';
import inventoryReportsRoutes from '../modules/inventory-reports/inventoryReports.routes.js';
import shiftsRoutes from '../modules/shifts/shifts.routes.js';
import activityRoutes from '../modules/activity/activity.routes.js';
import staffRoutes from '../modules/staff/staff.routes.js';
import unitAuthRoutes from '../modules/staff/unitAuth.routes.js';
import formTemplatesRoutes from '../modules/form-templates/formTemplates.routes.js';
import terminologyRoutes from '../modules/terminology/terminology.routes.js';
import aiInsightsRoutes from '../modules/ai-insights/aiInsights.routes.js';
import integrationRoutes from '../modules/integrations/integration.routes.js';
import adminRoutes from '../modules/admin/admin.routes.js';


const router = Router();

router.use('/api', authRoutes);
router.use('/api', usersRoutes);
router.use('/api/departments', departmentsRoutes);
router.use('/api/dashboard-mappings', dashboardMappingsRoutes);
router.use('/api/form-submissions', formsRoutes);
router.use('/api/isbar-records', isbarRecordsRoutes);
router.use('/api/patient-data', patientsRoutes);
router.use('/api/resources', resourcesRoutes);
router.use('/api/inventory-reports', inventoryReportsRoutes);
router.use('/api/shifts', shiftsRoutes);
router.use('/api/activity', activityRoutes);
router.use('/api/department-staff', staffRoutes);
router.use('/api/units', unitAuthRoutes);
router.use('/api/form-templates', formTemplatesRoutes);
router.use('/api/terminology', terminologyRoutes);
router.use('/api/ai', aiInsightsRoutes);
router.use('/api/integrations', integrationRoutes);
router.use('/api/admin', adminRoutes);


export default router;
