import { Router } from 'express';
import {
    getAllStoresStatistics,
    getRevenueTrend,
    getItemsStatistics,
    getStoreDetailedStatistics,
    getDashboardSummary,
} from '../controllers/statistics.controller';

const router = Router();

/**
 * @route   GET /api/statistics/dashboard
 * @desc    Get dashboard summary with key metrics
 * @access  Private
 */
router.get('/dashboard', getDashboardSummary);

/**
 * @route   GET /api/statistics/stores
 * @desc    Get statistics for all stores
 * @access  Private
 */
router.get('/stores', getAllStoresStatistics);

/**
 * @route   GET /api/statistics/stores/:storeId
 * @desc    Get detailed statistics for a specific store
 * @access  Private
 */
router.get('/stores/:storeId', getStoreDetailedStatistics);

/**
 * @route   GET /api/statistics/revenue-trend
 * @desc    Get revenue trend for all stores over specified months
 * @query   months - Number of months to fetch (default: 12)
 * @access  Private
 */
router.get('/revenue-trend', getRevenueTrend);

/**
 * @route   GET /api/statistics/items
 * @desc    Get items statistics and trends over time
 * @query   storeId - Filter by store ID (optional)
 * @query   months - Number of months to fetch (default: 6)
 * @access  Private
 */
router.get('/items', getItemsStatistics);

export default router;
