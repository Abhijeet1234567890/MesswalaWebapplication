import mongoose from "mongoose";

const MessStartedShama = new mongoose.Schema(
  {
    email: String,
    messId: String,
    date: String,

    subscriptionMonth: {
      type: Number,
      default: 1,
    },

    monthlyPrice: {
      type: Number,
      default: 2500,
    },

    amount: {
      type: Number,
      default: 0,
    },

    currency: {
      type: String,
      default: "INR",
    },

    payment_status: {
      type: String,
      default: "Paid",
    },

    order_status: {
      type: String,
      default: "Active",
    },

    razorpay_order_id: String,
    razorpay_payment_id: String,
    razorpay_signature: String,

    paymentMethod: {
      type: String,
      default: "Razorpay",
    },

    paymentDate: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

export const MessStartedModel = mongoose.model(
  "messstarts",
  MessStartedShama
);