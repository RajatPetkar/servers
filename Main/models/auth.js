import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    password: {
      type: String,
      required: true,
    },
    resetPasswordToken: {
      type: String,
      default: null,
    },
    resetPasswordExpires: {
      type: Date,
      default: null,
    },
    quizResults: [
      {
        score: {
          type: Number,
          required: true,
        },
        topic: {
          type: String,
        },
        questionsAnswered: [
          {
            questionText: {
              type: String,
              required: true,
            },
            userAnswer: {
              type: String,
              required: true,
            },
            correctAnswer: {
              type: String,
              required: true,
            },
          },
        ],
        dateTaken: {
          type: Date,
          default: Date.now,
        },
      },
    ],
  },
  {
    timestamps: true,
  }
);

export default mongoose.models.Users || mongoose.model("Users", userSchema);