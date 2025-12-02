import Order from '../user/models/Order.js';
import User from '../user/models/User.js';
import Product from '../admin/models/Product.js';
import OfflineOrder from '../admin/models/OfflineOrder.js';
import Review from '../user/models/Review.js';
import { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subDays, subMonths } from 'date-fns';

export const getDashboardStats = async (req, res) => {
    try {
        const today = new Date();
        const lastMonth = subMonths(today, 1);
        const twoMonthsAgo = subMonths(today, 2);

        // Get current month's online revenue
        const currentMonthOnlineRevenue = await Order.aggregate([
            { 
                $match: { 
                    status: 'delivered',
                    createdAt: { $gte: lastMonth }
                } 
            },
            { $group: { _id: null, total: { $sum: '$total' } } }
        ]);

        // Get last month's online revenue
        const lastMonthOnlineRevenue = await Order.aggregate([
            { 
                $match: { 
                    status: 'delivered',
                    createdAt: { $gte: twoMonthsAgo, $lt: lastMonth }
                } 
            },
            { $group: { _id: null, total: { $sum: '$total' } } }
        ]);

        // Get current month's offline revenue
        const currentMonthOfflineRevenue = await OfflineOrder.aggregate([
            { 
                $match: { 
                    status: 'completed',
                    createdAt: { $gte: lastMonth }
                } 
            },
            { $group: { _id: null, total: { $sum: '$total' } } }
        ]);

        // Get last month's offline revenue
        const lastMonthOfflineRevenue = await OfflineOrder.aggregate([
            { 
                $match: { 
                    status: 'completed',
                    createdAt: { $gte: twoMonthsAgo, $lt: lastMonth }
                } 
            },
            { $group: { _id: null, total: { $sum: '$total' } } }
        ]);

        // Get current month's online orders
        const currentMonthOnlineOrders = await Order.countDocuments({ 
            status: 'delivered',
            createdAt: { $gte: lastMonth }
        });

        // Get last month's online orders
        const lastMonthOnlineOrders = await Order.countDocuments({ 
            status: 'delivered',
            createdAt: { $gte: twoMonthsAgo, $lt: lastMonth }
        });

        // Get current month's offline orders
        const currentMonthOfflineOrders = await OfflineOrder.countDocuments({ 
            status: 'completed',
            createdAt: { $gte: lastMonth }
        });

        // Get last month's offline orders
        const lastMonthOfflineOrders = await OfflineOrder.countDocuments({ 
            status: 'completed',
            createdAt: { $gte: twoMonthsAgo, $lt: lastMonth }
        });

        // Get current month's users
        const currentMonthUsers = await User.countDocuments({
            createdAt: { $gte: lastMonth }
        });

        // Get last month's users
        const lastMonthUsers = await User.countDocuments({
            createdAt: { $gte: twoMonthsAgo, $lt: lastMonth }
        });

        // Get total products (all time)
        const totalProducts = await Product.countDocuments();

        // Get current month's new products
        const currentMonthProducts = await Product.countDocuments({
            createdAt: { $gte: lastMonth }
        });

        // Get last month's new products
        const lastMonthProducts = await Product.countDocuments({
            createdAt: { $gte: twoMonthsAgo, $lt: lastMonth }
        });

        // Get total reviews (all time)
        const totalReviews = await Review.countDocuments();

        // Get current month's new reviews
        const currentMonthReviews = await Review.countDocuments({
            createdAt: { $gte: lastMonth }
        });

        // Get last month's new reviews
        const lastMonthReviews = await Review.countDocuments({
            createdAt: { $gte: twoMonthsAgo, $lt: lastMonth }
        });

        // Calculate percentage changes
        const calculatePercentageChange = (current, previous) => {
            if (!previous) return 0;
            return ((current - previous) / previous) * 100;
        };

        const onlineRevenueChange = calculatePercentageChange(
            currentMonthOnlineRevenue[0]?.total || 0,
            lastMonthOnlineRevenue[0]?.total || 0
        );

        const offlineRevenueChange = calculatePercentageChange(
            currentMonthOfflineRevenue[0]?.total || 0,
            lastMonthOfflineRevenue[0]?.total || 0
        );

        const onlineOrdersChange = calculatePercentageChange(
            currentMonthOnlineOrders,
            lastMonthOnlineOrders
        );

        const offlineOrdersChange = calculatePercentageChange(
            currentMonthOfflineOrders,
            lastMonthOfflineOrders
        );

        const usersChange = calculatePercentageChange(
            currentMonthUsers,
            lastMonthUsers
        );

        const productsChange = calculatePercentageChange(
            currentMonthProducts,
            lastMonthProducts
        );

        const reviewsChange = calculatePercentageChange(
            currentMonthReviews,
            lastMonthReviews
        );

        res.json({
            success: true,
            data: {
                onlineRevenue: currentMonthOnlineRevenue[0]?.total || 0,
                offlineRevenue: currentMonthOfflineRevenue[0]?.total || 0,
                totalRevenue: (currentMonthOnlineRevenue[0]?.total || 0) + (currentMonthOfflineRevenue[0]?.total || 0),
                onlineOrders: currentMonthOnlineOrders,
                offlineOrders: currentMonthOfflineOrders,
                totalOrders: currentMonthOnlineOrders + currentMonthOfflineOrders,
                totalUsers: currentMonthUsers,
                totalProducts,
                totalReviews,
                onlineRevenueChange: onlineRevenueChange.toFixed(1),
                offlineRevenueChange: offlineRevenueChange.toFixed(1),
                onlineOrdersChange: onlineOrdersChange.toFixed(1),
                offlineOrdersChange: offlineOrdersChange.toFixed(1),
                usersChange: usersChange.toFixed(1),
                productsChange: productsChange.toFixed(1),
                reviewsChange: reviewsChange.toFixed(1)
            }
        });
    } catch (error) {
        console.error('Error in getDashboardStats:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch dashboard statistics'
        });
    }
};

export const getSalesData = async (req, res) => {
    try {
        const { period } = req.query; // 'daily', 'weekly', 'monthly'
        const now = new Date();
        let startDate;

        switch (period) {
            case 'daily':
                startDate = new Date(now.setDate(now.getDate() - 7));
                break;
            case 'weekly':
                startDate = new Date(now.setDate(now.getDate() - 30));
                break;
            case 'monthly':
                startDate = new Date(now.setMonth(now.getMonth() - 12));
                break;
            default:
                startDate = new Date(now.setDate(now.getDate() - 7));
        }

        // Get online sales data
        const onlineSales = await Order.aggregate([
            {
                $match: {
                    status: 'delivered',
                    createdAt: { $gte: startDate }
                }
            },
            {
                $group: {
                    _id: {
                        $dateToString: {
                            format: period === 'daily' ? '%Y-%m-%d' : 
                                   period === 'weekly' ? '%Y-%U' : '%Y-%m',
                            date: '$createdAt'
                        }
                    },
                    total: { $sum: '$total' },
                    count: { $sum: 1 }
                }
            },
            {
                $sort: { '_id': 1 }
            }
        ]);

        // Get offline sales data
        const offlineSales = await OfflineOrder.aggregate([
            {
                $match: {
                    status: 'completed',
                    createdAt: { $gte: startDate }
                }
            },
            {
                $group: {
                    _id: {
                        $dateToString: {
                            format: period === 'daily' ? '%Y-%m-%d' : 
                                   period === 'weekly' ? '%Y-%U' : '%Y-%m',
                            date: '$createdAt'
                        }
                    },
                    total: { $sum: '$total' },
                    count: { $sum: 1 }
                }
            },
            {
                $sort: { '_id': 1 }
            }
        ]);

        // Combine online and offline sales data
        const combinedSales = onlineSales.map(onlineSale => {
            const offlineSale = offlineSales.find(sale => sale._id === onlineSale._id);
            return {
                _id: onlineSale._id,
                onlineTotal: onlineSale.total,
                offlineTotal: offlineSale ? offlineSale.total : 0,
                total: onlineSale.total + (offlineSale ? offlineSale.total : 0),
                onlineCount: onlineSale.count,
                offlineCount: offlineSale ? offlineSale.count : 0,
                count: onlineSale.count + (offlineSale ? offlineSale.count : 0)
            };
        });

        // Add any offline sales that don't have corresponding online sales
        offlineSales.forEach(offlineSale => {
            if (!onlineSales.find(sale => sale._id === offlineSale._id)) {
                combinedSales.push({
                    _id: offlineSale._id,
                    onlineTotal: 0,
                    offlineTotal: offlineSale.total,
                    total: offlineSale.total,
                    onlineCount: 0,
                    offlineCount: offlineSale.count,
                    count: offlineSale.count
                });
            }
        });

        // Sort the combined data
        combinedSales.sort((a, b) => a._id.localeCompare(b._id));

        res.json({
            success: true,
            data: combinedSales
        });
    } catch (error) {
        console.error('Error in getSalesData:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch sales data'
        });
    }
};

export const getProductData = async (req, res) => {
    try {
        const topProducts = await Order.aggregate([
            { $unwind: '$items' },
            {
                $group: {
                    _id: '$items.productId',
                    totalSold: { $sum: '$items.quantity' },
                    totalRevenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } }
                }
            },
            { $sort: { totalSold: -1 } },
            { $limit: 10 },
            {
                $lookup: {
                    from: 'products',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'productDetails'
                }
            }
        ]);

        res.json({
            success: true,
            data: topProducts
        });
    } catch (error) {
        console.error('Error in getProductData:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch product data'
        });
    }
};

export const getUserData = async (req, res) => {
    try {
        const thirtyDaysAgo = subDays(new Date(), 30);

        const userStats = await User.aggregate([
            {
                $match: {
                    createdAt: { $gte: thirtyDaysAgo }
                }
            },
            {
                $group: {
                    _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
                    newUsers: { $sum: 1 }
                }
            },
            { $sort: { _id: 1 } }
        ]);

        const activeUsers = await Order.aggregate([
            {
                $group: {
                    _id: '$userId',
                    orderCount: { $sum: 1 },
                    totalSpent: { $sum: '$total' }
                }
            },
            { $sort: { totalSpent: -1 } },
            { $limit: 10 },
            {
                $lookup: {
                    from: 'users',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'userDetails'
                }
            }
        ]);

        res.json({
            success: true,
            data: {
                userStats,
                activeUsers
            }
        });
    } catch (error) {
        console.error('Error in getUserData:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch user data'
        });
    }
}; 