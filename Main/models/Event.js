import mongoose from "mongoose";

const eventSchema = new mongoose.Schema({
  title: { type: String, required: true },
  start: { type: Date, required: true },
  end: { type: Date, required: true },
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model("Events", eventSchema);
