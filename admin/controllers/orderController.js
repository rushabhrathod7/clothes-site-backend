import Order from "../../user/models/Order.js";
import User from "../../user/models/User.js";
import { createNotification } from "./notificationController.js";

// Get all orders
export const getAllOrders = async (req, res) => {
  try {
    console.log("Fetching all orders...");

    // Fetch orders with populate, but handle errors gracefully
    let orders;
    try {
      orders = await Order.find()
        .populate({
          path: "userId",
          select: "firstName lastName email",
        })
        .populate({
          path: "items.productId",
          select: "name price images",
          // Allow null values if product doesn't exist
          justOne: false,
        })
        .sort({ createdAt: -1 })
        .lean();
    } catch (populateError) {
      console.error("Error during populate:", populateError);
      // If populate fails, try without populating products
      orders = await Order.find()
        .populate({
          path: "userId",
          select: "firstName lastName email",
        })
        .sort({ createdAt: -1 })
        .lean();
    }

    // Map through orders and add product images to items
    const ordersWithImages = (orders || []).map((order) => {
      // Ensure order.items exists and is an array
      if (!order.items || !Array.isArray(order.items)) {
        order.items = [];
      }

      return {
        ...order,
        items: order.items.map((item) => {
          // Handle case where productId might be null, undefined, or an object
          let productData = null;
          if (item.productId) {
            // If productId is populated (object), use it
            if (
              typeof item.productId === "object" &&
              item.productId !== null &&
              !item.productId._id
            ) {
              productData = item.productId;
            }
          }

          // Get first image from product data if available
          let firstImage = null;
          if (productData?.images) {
            if (Array.isArray(productData.images)) {
              firstImage =
                productData.images[0]?.url || productData.images[0] || null;
            }
          }

          return {
            ...item,
            // Keep the original product name or fallback to the one from product data
            name: item.name || productData?.name || "Deleted Product",
            // Use the first image from product data if available, otherwise keep existing image
            image: firstImage || item.image || null,
            // Keep the original price or fallback to product price
            price: item.price || productData?.price || 0,
            // Keep track if the product exists (check if productData has name property)
            productExists: !!(productData && productData.name),
          };
        }),
      };
    });

    console.log(`Found ${ordersWithImages.length} orders`);

    res.status(200).json({
      success: true,
      data: ordersWithImages,
    });
  } catch (error) {
    console.error("Error fetching orders:", error);
    console.error("Error stack:", error.stack);
    return res.status(500).json({
      success: false,
      error: "Failed to fetch orders",
      message: error.message,
    });
  }
};

// Get single order details
export const getOrderDetails = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate({
        path: "userId",
        select: "firstName lastName email",
      })
      .populate({
        path: "items.productId",
        select: "name price images",
      });

    if (!order) {
      return res.status(404).json({ success: false, error: "Order not found" });
    }

    res.status(200).json({
      success: true,
      data: order,
    });
  } catch (error) {
    console.error("Error fetching order details:", error);
    return res
      .status(500)
      .json({ success: false, error: "Failed to fetch order details" });
  }
};

// Update order status
export const updateOrderStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const order = await Order.findByIdAndUpdate(
      req.params.id,
      {
        status,
        updatedAt: new Date(),
      },
      { new: true }
    );

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    await handleOrderStatusUpdate(order);

    res.status(200).json({
      success: true,
      data: order,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error updating order status",
      error: error.message,
    });
  }
};

// Delete order
export const deleteOrder = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    // Delete the order
    await Order.findByIdAndDelete(req.params.id);

    // Update user's orders array
    await User.findByIdAndUpdate(order.userId, {
      $pull: {
        orders: {
          orderId: order._id,
        },
      },
    });

    res.status(200).json({
      success: true,
      message: "Order deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting order:", error);
    res.status(500).json({
      success: false,
      message: "Error deleting order",
      error: error.message,
    });
  }
};

// Add this to your order creation/update logic
const handleNewOrder = async (order) => {
  try {
    await createNotification(
      "order",
      `New order #${order.orderNumber} received from ${order.customerName}`,
      {
        orderId: order._id,
        orderNumber: order.orderNumber,
        amount: order.totalAmount,
      }
    );
  } catch (error) {
    console.error("Error creating order notification:", error);
  }
};

// Add this to your order status update logic
const handleOrderStatusUpdate = async (order) => {
  try {
    await createNotification(
      "order",
      `Order #${order.orderNumber} status updated to ${order.status}`,
      {
        orderId: order._id,
        orderNumber: order.orderNumber,
        status: order.status,
      }
    );
  } catch (error) {
    console.error("Error creating order status notification:", error);
  }
};
