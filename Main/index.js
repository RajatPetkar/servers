import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import colors from "colors";
import connectDB from "./config/connectDB.js";
import bodyParser from "body-parser";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { GoogleGenerativeAI } from '@google/generative-ai';
import Users from "./models/auth.js";
import Path from "./models/Path.js";
import nodemailer from 'nodemailer';
import crypto from 'crypto';
import Event from "./models/Event.js";

dotenv.config();
connectDB();

const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || "your_jwt_secret_key";

// Configure nodemailer
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USERNAME,
    pass: process.env.EMAIL_PASSWORD
  }
});

const genAI = new GoogleGenerativeAI(process.env.API);

const app = express();

app.use(express.json({ limit: "300mb", extended: true }));
app.use(express.urlencoded({ limit: "300mb", extended: true }));
app.use(cors({
  origin: "*",
  methods: "GET,POST,DELETE",
  credentials: true
}));
app.use(bodyParser.json());

app.get("/", (req, res) => {
  res.send("This is an API by Rajat Petkar");
});


app.post("/api/events", async (req, res) => {
  try {
    const newEvent = new Event(req.body);
    await newEvent.save();
    res.status(201).json(newEvent);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get Events for Today
app.get("/api/events/today", async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    const events = await Event.find({
      start: { $gte: today, $lt: tomorrow }
    });

    res.json(events);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get All Events
app.get("/api/events", async (req, res) => {
  try {
    const events = await Event.find();
    res.json(events);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Delete Event
app.delete("/api/events/:id", async (req, res) => {
  try {
    await Event.findByIdAndDelete(req.params.id);
    res.json({ message: "Event deleted" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Existing signup endpoint
app.post("/signup", async (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password ) {
    return res.status(400).json({ message: "All fields are required." });
  }

  try {
    const existingUser = await Users.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "User already exists." });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = new Users({
      name,
      email,
      password: hashedPassword,
      
    });

    await newUser.save();

    res.status(201).json({ message: "User registered successfully." });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error." });
  }
});

// Existing login endpoint
app.post("/login", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: "Email and password are required." });
  }

  try {
    const user = await Users.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: "Invalid credentials." });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid credentials." });
    }

    const token = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: "1h" });
   
    res.json({
      message: "Login successful",
      token,
      api: user.api,
      name: user.name,
      email: user.email
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error." });
  }
});

// New forgot password endpoint
app.post("/forgot-password", async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ message: "Email is required." });
  }

  try {
    const user = await Users.findOne({ email });
    
    // Generate reset code
    const resetCode = crypto.randomBytes(3).toString('hex').toUpperCase();
    const resetPasswordToken = await bcrypt.hash(resetCode, 10);
    
    // Set token and expiration
    if (user) {
      user.resetPasswordToken = resetPasswordToken;
      user.resetPasswordExpires = Date.now() + 3600000; // 1 hour
      await user.save();
      
      // Send email
      const mailOptions = {
        from: process.env.EMAIL_USERNAME,
        to: email,
        subject: 'Password Reset Request',
        text: `Hello,

We received a request to reset your password. Here's your password reset code:

${resetCode}

This code will expire in 1 hour.

Please note:
- If you didn't request this password reset, please ignore this email
- For security reasons, do not share this code with anyone
- The code is case-sensitive

Need help?
If you have any questions or concerns, please contact our support team.

Best regards,
Your Learning Platform Team

This is an automated message, please do not reply.`
      };

      await transporter.sendMail(mailOptions);
    }

    // Always return success to prevent email enumeration
    res.json({ message: "If an account exists with this email, a reset code has been sent." });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error." });
  }
});

// New reset password endpoint
app.post("/reset-password", async (req, res) => {
  const { email, resetCode, newPassword } = req.body;

  if (!email || !resetCode || !newPassword) {
    return res.status(400).json({ message: "All fields are required." });
  }

  try {
    const user = await Users.findOne({
      email,
      resetPasswordExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({ message: "Invalid or expired reset code." });
    }

    // Verify reset code
    const isValidCode = await bcrypt.compare(resetCode, user.resetPasswordToken);
    if (!isValidCode) {
      return res.status(400).json({ message: "Invalid or expired reset code." });
    }

    // Update password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    res.json({ message: "Password reset successful." });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error." });
  }
});

// Existing logout endpoint
app.post("/logout", async (req, res) => {
  try {
    res.clearCookie("token", { httpOnly: true, secure: true, sameSite: "None" });
    res.status(200).json({ message: "Logout successful" });
  } catch (error) {
    res.status(500).json({ error: "Logout failed" });
  }
});

// Existing saveQuiz endpoint
app.post("/saveQuiz", async (req, res) => {
  console.log("inside api call");

  try {
    console.log("insidde try");
    console.log("Received request body:", req.body);

    const { email, score, topic, questionsAnswered } = req.body;

    if (!email || score === undefined || !questionsAnswered || !topic) {
      console.error("Missing fields:", { email, score, topic, questionsAnswered });
      return res.status(400).json({ success: false, message: "Missing required fields" });
    }

    const user = await Users.findOne({ email });

    if (!user) {
      console.error("User not found:", email);
      return res.status(404).json({ success: false, message: "User not found" });
    }

    if (!user.quizResults) user.quizResults = [];
    user.quizResults.push({ score, topic, questionsAnswered });

    await user.save();

    return res.json({ success: true, message: "Quiz results saved successfully" });
  } catch (error) {
    console.error("Server error:", error);
    return res.status(500).json({ success: false, message: "Internal Server Error" });
  }
});


app.post("/savePath", async (req, res) => {
  console.log("inside api call");

  try {
    console.log("insidde try");
    console.log("Received request body:", req.body);

    const {  email,score,topic,LearningStyle,difficulty,time_commitment,domain_interest } = req.body;

    if ( score === undefined || !topic || !LearningStyle || !difficulty || !time_commitment || !domain_interest) {
      console.error("Missing fields:", { email, score, topic });
      return res.status(400).json({ success: false, message: "Missing required fields" });
    }

    const user = await Path.findOne({ email });

    if (!user) {
      console.error("User not found:", email);
      return res.status(404).json({ success: false, message: "User not found" });
    }

    if (!user.quizResults) user.quizResults = [];
    user.quizResults.push({ score, topic, questionsAnswered });

    await user.save();

    return res.json({ success: true, message: "Quiz results saved successfully" });
  } catch (error) {
    console.error("Server error:", error);
    return res.status(500).json({ success: false, message: "Internal Server Error" });
  }
});

// Existing user-count endpoint
app.get('/user-count', async (req, res) => {
  try {
    const count = await Users.countDocuments();
    console.log("Total Users:", count);
    res.json({ count });
  } catch (error) {
    console.error("Error fetching user count:", error);
    res.status(500).json({ error: 'Failed to fetch user count' });
  }
});

// Existing quiz-results endpoint
app.get('/api/quiz-results/:email', async (req, res) => {
  try {
    const email = req.params.email;
    console.log("Fetching quiz results for email:", email);

    const user = await Users.findOne({ email: email });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({quizResults: user.quizResults });
  } catch (error) {
    console.error("Error fetching quiz results:", error);
    res.status(500).json({ error: 'Failed to fetch quiz results' });
  }
});

// Existing roadmap template and endpoint
const PROMPT_TEMPLATE = `
Create a detailed learning roadmap for {TOPIC}. Include:


1. Clear learning path with main concepts
2. Highly specific, working resource links (IMPORTANT: Only include:)
   - Official documentation links
   - Specific YouTube video links (full URLs)
   - GitHub repositories with tutorials/examples
   - Free online course links (Coursera, edX, etc.)
   - Popular blog tutorials from well-known platforms
3. Realistic time estimates for each section
4. Essential prerequisites

Format the response as a JSON object with this structure:
{
  "prerequisites": [
    "string" // List of required prerequisite knowledge
  ],
  "stages": [
    {
      "name": "string", // Clear, concise stage name
      "description": "string", // 2-3 sentence description of this stage
      "duration": "string", // Realistic time estimate (e.g., "2-3 weeks")
      "concepts": [
        "string" // 3-5 key concepts for this stage
      ],
      "resources": [
        {
          "name": "string", // Descriptive name of the resource
          "url": "string", // Full, working URL
          "type": "string", // One of: "documentation", "video", "tutorial", "course", "github"
          "duration": "string" // Estimated time to complete this resource
        }
      ]
    }
  ]
}

IMPORTANT GUIDELINES:
1. Ensure all URLs are complete and from reputable sources
2. Include a mix of resource types for each stage
3. Keep concepts focused and specific
4. Provide realistic time estimates
5. Order stages from basic to advanced
6. Include 3-5 high-quality resources per stage
7. Ensure resource names are descriptive and specific
8. user wants to learn this in 3 hours`;

app.post('/get-roadmap', async (req, res) => {
  try {
    const { topic } = req.body;
    
    if (!topic) {
      return res.status(400).json({ error: 'Topic is required' });
    }

    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const prompt = PROMPT_TEMPLATE.replace('{TOPIC}', topic);
    const result = await model.generateContent(prompt);
    const response = await result.response;
    let text = response.text();
    text = text.replace('```json\n', '');
    text = text.replace('```', '');
    const roadmapData = JSON.parse(text);

    const mermaidDiagram = generateMermaidDiagram(roadmapData);

    return res.json({
      success: true,
      roadmap: roadmapData,
      mermaidDiagram
    });

  } catch (error) {
    console.error('Error generating roadmap:', error);
    return res.status(500).json({ 
      error: 'Failed to generate roadmap',
      details: error.message 
    });
  }
});

// Existing report template and endpoint
const REPORT_TEMPLATE = `
ou are an AI assistant that generates personalized learning pathways for students based on their quiz performance, learning preferences, and available study time.  

*Student Profile:*  
- *Quiz Score*: 14/20  
- *Learning Style*: Visual, prefers video-based learning  
- *Available Study Time*: 10 minutes per week  

*Task:*  
1. Based on the quiz score, identify areas where the student is strong and where they need improvement.  
2. Recommend a *personalized learning pathway* with topics arranged in an *optimal sequence* to strengthen weak areas and build upon existing knowledge.  
3. Suggest *video-based resources* tailored for *visual learners*.  
4. Break down the pathway into *weekly learning plans* that fit within a *10-minute study session per week*.  
5. Keep the pathway *engaging, structured, and goal-oriented* to maximize efficiency.  

*Output Format:*  
- *Overview of Strengths & Weaknesses*  
- *Week-by-Week Learning Plan* (with specific topics and short explanations)  
- *Recommended Video Resources* (YouTube, Coursera, Udemy, etc.)  
- *Final Milestone & Expected Learning Outcome*  

Generate the response in a *clear, structured format*, ensuring the plan is achievable within the given time constraints.`;

app.post('/get-report', async(req, res) => {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const result = await model.generateContent(REPORT_TEMPLATE);
    const response = await result.response;
    let text = response.text();

    return res.json({
      success: true,
      report: text
    });

  } catch (error) {
    console.error('Error generating report:', error);
    return res.status(500).json({ 
      error: 'Failed to generate report',
      details: error.message 
    });
  }
});

app.post("/pictoflow",async (req, res) => {
  try {
    const { topic } = req.body;
    console.log(topic)
    if (!topic) {
      return res.status(400).json({ error: 'Topic is required' });
    }

    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const prompt = PROMPT_TEMPLATE.replace('{TOPIC}', topic);
    const result = await model.generateContent(prompt);
    const response = await result.response;
    let text = response.text();
    text = text.replace('```json\n', '');
    text = text.replace('```', '');
    const roadmapData = JSON.parse(text);

    const mermaidDiagram = generateMermaidDiagram(roadmapData);

    return res.json({
      success: true,
      roadmap: roadmapData,
      mermaidDiagram
    });

  } catch (error) {
    console.error('Error generating roadmap:', error);
    return res.status(500).json({ 
      error: 'Failed to generate roadmap',
      details: error.message 
    });
  }
})

// Existing mermaid diagram generation function
function generateMermaidDiagram(roadmapData) {
  let diagram = 'graph TD\n';
  
  // Add prerequisites if any
  if (roadmapData.prerequisites && roadmapData.prerequisites.length > 0) {
    diagram += '    Prerequisites[Prerequisites];\n';
    roadmapData.prerequisites.forEach((prereq, index) => {
      diagram += `    Prereq${index}[${prereq}];\n`;
      diagram += `    Prerequisites --> Prereq${index};\n`;
    });
  }

  // Add stages
  roadmapData.stages.forEach((stage, index) => {
    // Create node for stage
    diagram += `    Stage${index}[${stage.name}];\n`;
    
    // Connect to previous stage
    if (index > 0) {
      diagram += `    Stage${index-1} --> Stage${index};\n`;
    } else if (roadmapData.prerequisites && roadmapData.prerequisites.length > 0) {
      // Connect prerequisites to first stage
      diagram += `    Prerequisites --> Stage0;\n`;
    }

    // Add concepts as sub-nodes
    stage.concepts.forEach((concept, conceptIndex) => {
      const conceptId = `Concept${index}_${conceptIndex}`;
      diagram += `    ${conceptId}[${concept}];\n`;
      diagram += `    Stage${index} --> ${conceptId};\n`;
    });
  });

  return diagram;
}

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`.bgBlue.white);
});