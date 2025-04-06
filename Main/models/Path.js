import mongoose from "mongoose";

const PathSchema = new mongoose.Schema(
  {
        email:{
            type: String,
        },
        score: {
          type: Number,
          required: true,
        },
        topic: {
          type: String,
        },
        difficulty: {
          type: String, // Easy, Medium, Hard
          required: true,
        },
        LearningStyle: {
          type: String, // Visual, Auditory, Kinesthetic
          required: true,
        },
        time_commitment: {
          type: Number, // In hours per week
          required: true,
        },
        domain_interest: {
          type: String, // Job Interview, Learning, Startup, Academic
          required: true,
        },
        // correctAnswers: {
        //   type: Number,
        //   required: true,
        // },
        // incorrectAnswers: {
        //   type: Number,
        //   required: true,
        // },
        // timeTaken: {
        //   type: Number, // Time spent on the quiz in minutes
        //   required: true,
        // },
        dateTaken: {
          type: Date,
          default: Date.now,
        },
  }
);

export default mongoose.model("Path", PathSchema);