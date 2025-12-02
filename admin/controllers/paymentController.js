import { createNotification } from './notificationController.js';

// Add this to your payment processing logic
const handleNewPayment = async (payment) => {
  try {
    await createNotification(
      'payment',
      `New payment of $${payment.amount} received for order #${payment.orderNumber}`,
      {
        paymentId: payment._id,
        orderId: payment.orderId,
        orderNumber: payment.orderNumber,
        amount: payment.amount
      }
    );
  } catch (error) {
    console.error('Error creating payment notification:', error);
  }
};

// Add this to your payment status update logic
const handlePaymentStatusUpdate = async (payment) => {
  try {
    await createNotification(
      'payment',
      `Payment for order #${payment.orderNumber} status updated to ${payment.status}`,
      {
        paymentId: payment._id,
        orderId: payment.orderId,
        orderNumber: payment.orderNumber,
        status: payment.status
      }
    );
  } catch (error) {
    console.error('Error creating payment status notification:', error);
  }
}; 