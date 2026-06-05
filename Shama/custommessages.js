import mongoose from "mongoose";

const CustomMessages = new mongoose.Schema({
  name: {
    type: String,
  },

  description: {
    type: String,
  },

  file: {
    type: String,
  },

  userId: {
    type: String,
  },

  messId: {
    type: String,
  },

  userMessage: {
  type: String,
},

reply: {
  type: String,
  default: "",
},

status: {
  type: String,
  default: "Pending",
},

comment: {
  type: String,
  default: "",
},
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const CustomMessageModel = mongoose.model("custommessages", CustomMessages);

export default CustomMessageModel;