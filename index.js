import { GoogleGenAI } from "@google/genai";
import { CloudClient } from "chromadb";
import multer from "multer";
import cors from "cors";
import express from "express";
import { DefineMenuModel } from "./Shama/DefineMenu.js";
import dotenv from "dotenv";
import mongoose from "mongoose";
import { Teffinmodel } from "./Shama/TiffeenShama.js";
import jwt from 'jsonwebtoken';
import { JoinModel } from "./Shama/JoinShama.js";
import { MessStartedModel } from "./Shama/MessStarted.js";
dotenv.config();
import { InstanceModel } from "./Shama/Instncefood.js";
import CustomMessageModel from "./Shama/custommessages.js";

import path from "path";
import fs from "fs"
import PDFDocument from "pdfkit";

import Razorpay from "razorpay";

const app = express();
app.use("/Upload", express.static("./Upload"));

app.use(cors({
  origin: [
    "https://messwala-meal-subscription.vercel.app",
    "http://localhost:5173",
    "http://localhost:3000"
  ],
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  credentials: true,
  allowedHeaders: ["Content-Type", "Authorization"],
  optionsSuccessStatus: 200
}));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

/* Gemini Key */
const genAi = new GoogleGenAI({
    apiKey: "AIzaSyB3-SP_zDz0_E4mlEJjMk7MhTVLD9dyMEo",
});

/* Connect Chromadb */
const chroma = new CloudClient({
    apiKey: "ck-3vHM1sqv7z2Q6BFTFSeZBWNwPRUz5ch8o833QUTrfT7t",
    tenant: "3a3f5e17-51e5-46dd-81ae-61205805fa88",
    database: "Mess",
});

/* MongoDb Connection */
await mongoose.connect(
   process.env.MONGO_URI
);

console.log("Mongodb Is Connected!!")

/* Set disk Storage For Uploading files */
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, "Upload");
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + "-" + file.originalname);
    },
});

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

const upload = multer({ storage: storage });

/* Mess Register */
app.post("/messregister", upload.array("files"), async (req, resp) => {
    try {
        const files = req.files ? req.files.map((f) => f.filename) : [];
        const { name, surname, email, pass, city, village, gender, type, id,messprice } = req.body;

        const item = {
            id,
            files,
            name,
            surname,
            email,
            pass,
            city,
            village,
            gender,
            type,
            messprice
        };

        // Gemini embedding
        const result = await genAi.models.embedContent({
            model: "models/gemini-embedding-001",
            contents: JSON.stringify(item),
        });

        if (!result || !result.embeddings || result.embeddings.length === 0) {
            throw new Error("Embedding failed");
        }

        const embedding = result.embeddings[0].values;

        // Chroma DB
        const collection = await chroma.getOrCreateCollection({
            name: "registers",
        });

        const data = await collection.add({
            ids: [id],
            documents: [JSON.stringify(item)],
            embeddings: [embedding],
            metadatas: [{
                id,
                name,
                email,
                pass,
                surname,
                city,
                village,
                gender,
                type,
                files,
                messprice
            }],
        });

        resp.status(200).json({
            Message: "Register Successfully",
            data: data,
        });

    } catch (error) {
        console.log("ERROR:", error);
        resp.status(500).json({
            Message: "Server Error",
            error: error.message
        });
    }
});

/* MessLogin */
const SECRATE_KEY = "Abhijeet";
app.post("/messlogin", async (req, resp) => {
    const { email, pass } = req.body;

    try {
        const Name = await chroma.getOrCreateCollection({
            name: "registers"
        });

        const result = await Name.get({
            include: ["metadatas", "documents"]
        });

        const data = result.documents.map((i) => JSON.parse(i));
        const item = data.find((user) => user.email == email);

        if (!item) {
            return resp.status(400).json({
                message: "User Not Found"
            });
        }

        if (pass !== item.pass) {
            return resp.status(400).json({
                message: "Password Is Invalid"
            });
        }

        resp.status(200).json({
            message: "Login Successfully",
            item: item.id
        });

    } catch (error) {
        resp.status(500).json({
            message: "Server Error",
            error: error.message
        });
    }
});

/* Teffinewala Register */
app.post("/teffinregister", upload.single("file"), async (req, resp) => {
    const file = req.file ? req.file.filename : null;
    const { name, email, pass, gender, contact, city } = req.body;

    const item = {
        file,
        name,
        email,
        pass,
        gender,
        contact,
        city
    };

    try {
        if (!email || !pass || !contact) {
            return resp.status(400).json({
                message: "Required fields are missing"
            });
        }

        const result = await Teffinmodel.create(item);

        if (result) {
            resp.status(200).json({
                message: "Tiffinwala registered successfully"
            });
        } else {
            resp.status(400).json({
                message: "Something went wrong"
            });
        }

    } catch (error) {
        console.error(error);
        resp.status(500).json({
            message: "Server error"
        });
    }
});

/* Teffinewala Login */
app.post("/teffinlogin", async (req, resp) => {
    const { name, email, pass } = req.body;

    try {
        if (!name || !email || !pass) {
            return resp.status(400).json({
                message: "All Fields Are Required"
            });
        }

        const user = await Teffinmodel.findOne({ email });

        if (!user) {
            return resp.status(400).json({
                message: "User Not Found"
            });
        }

        if (pass !== user.pass) {
            return resp.status(400).json({
                message: "Invalid Password"
            });
        }

        // ✅ JOIN DATA CHECK
        const joinData = await JoinModel.findOne({ email });

        const token = jwt.sign(
            { user_id: user._id, email: user.email, file: user.file }, // ✅ Added file
            SECRATE_KEY,
            { expiresIn: "2h" }
        );

        resp.status(200).json({
            message: "Login Success",
            token: token,
            joinData: joinData   
        });

    } catch (err) {
        console.log(err);
        resp.status(500).json({
            message: "Server Error"
        });
    }
});

/* Mess List Get */
app.get("/messlist", async (req, resp) => {
    try {
        const collation = await chroma.getOrCreateCollection({
            name: "registers"
        });

        const data = collation.get({
            include: ["metadatas", "documents"]
        });

        const items = await (await data).documents.map((i) => i);

        resp.status(200).json({
            Message: "Data Is Found",
            items
        });

    } catch {
        resp.status(500).json({
            Message: "Server Error"
        })
    }
});

/* Get Id */
app.get("/viewmess/:id", async (req, resp) => {
    const { id } = req.params;

    try {
        const collection = await chroma.getOrCreateCollection({
            name: "registers"
        });

        const data = await collection.get({
            ids: [id],
            include: ["metadatas", "documents"]
        });

        if (!data || !data.ids || data.ids.length === 0) {
            return resp.status(404).json({
                Message: "No Data Found"
            });
        }

        const result = data.documents.map((i) => {
            try {
                return JSON.parse(i);
            } catch {
                return i;
            }
        });
        resp.status(200).json({
            Message: "Data Is Found",
            result
        });

    } catch (error) {
        console.error(error);
        resp.status(500).json({
            Message: "Server Error"
        });
    }
});

/* Join Mess */
app.post("/joinmess", async (req, resp) => {
    const { name, email, mess, city, village, pincode, type, messId } = req.body;

    try {
        const result = await JoinModel.create({
            name,
            email,
            mess,
            city,
            village,
            pincode,
            type,
            messId
        });

        const messData= await chroma.getOrCreateCollection({

            name:"registre"
        });

        const messIfo=await messData.get({

            ids:[messId],
            include:["metadatas","documents"]

        });

        const res= await messIfo.documents.map((i)=>{

            return JSON.parse(i);

        });


        resp.status(200).json({
            Message: "Join mess Successfully",
            result,
            Messdata:res,
        });

    } catch {
        resp.status(500).json({
            Message: "Server Error"
        })
    }
});

/* Join Mess Dynamic */
app.post("/viewteffinwala", async (req, res) => {
    try {
        const { messId } = req.body;

        if (!messId) {
            return res.status(400).json({
                message: "messId is required"
            });
        }

        const result = await JoinModel.find({ messId });

        if (!result || result.length === 0) {
            return res.status(404).json({
                message: "No Data Found"
            });
        }

        res.status(200).json({
            message: "Data Found",
            totalJoined: result.length,
            result
        });

    } catch (error) {
        res.status(500).json({
            message: "Server Error",
            error: error.message
        });
    }
});

/* Search Mess */
app.post("/search", async (req, resp) => {
    const { qun } = req.body;

    try {
        const result = await genAi.models.embedContent({
            model: "models/gemini-embedding-001",
            contents: JSON.stringify(qun)
        });

        const embedding = result.embeddings[0].values;

        const collaetion = await chroma.getOrCreateCollection({
            name: "registers"
        });

        const item = await collaetion.query({
            nResults: 1,
            queryEmbeddings: [embedding]
        });

        const documentdata = await item.documents.map((i) => {
            return JSON.parse(i);
        })

        resp.status(201).json({
            massage: "Data is Found",
            item: documentdata
        });

    } catch (err) {
        resp.status(500).json({
            message: "Server Error",
            err: err.message
        });
    }
});

/* Add InstanceFood */
app.post("/addinstance", upload.single("file"), async (req, resp) => {
    const { name, price, description, id } = req.body; // ✅ Changed messid to id
    const file = req.file ? req.file.filename : null;

    const data = {
        name,
        price,
        description,
        file: file,
        messid: id // ✅ Store as messid
    }

    try {
        const result = await InstanceModel.create(data);

        if (!result) {
            return resp.status(400).json({
                message: "Result not found"
            });
        }

        resp.status(200).json({
            message: "Data Is Stored",
            result
        })

    } catch (err) {
        resp.status(500).json({
            err: err
        });

        console.log(err);
    }
});

/* Get Tiffine data  */
app.post("/addinstnceitem", async (req, resp) => {
    const { id } = req.body;

    try {
        const result = await InstanceModel.find({ messid: id });

        if (!result || result.length === 0) {
            return resp.status(404).json({
                message: "Data Not Found"
            });
        }

        resp.status(200).json({
            message: "Data Found",
            data: result   
        });

    } catch (err) {
        console.log(err);
        resp.status(500).json({
            message: "Server Error"
        });
    }
});

/* Find Mess */
app.post("/findmess", async (req, res) => {
    let { messId } = req.body;

    try {
        
        messId = String(messId);

        console.log("Searching ID:", messId);

        const collection = await chroma.getOrCreateCollection({
            name: "registers",
        });

        const data = await collection.get({
            ids: [messId],
            include: ["metadatas", "documents"],
        });

        console.log("Chroma Result:", data);

        if (!data || !data.ids || data.ids.length === 0) {
            return res.status(404).json({
                message: "Not Found",
            });
        }

        const result = data.documents.map((i) => {
            try {
                return JSON.parse(i);
            } catch {
                return i;
            }
        });

        res.status(200).json({
            message: "Data Found",
            data: result[0],
        });

    } catch (err) {
        console.log(err);
        res.status(500).json({
            message: "Server Error",
        });
    }
});

// Mess Started
app.post("/messstart", async (req, res) => {
  const {
    email,
    messId,
    date,
    subscriptionMonth,
    monthlyPrice,
    amount,
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature,
  } = req.body;

  try {
    const alreadyJoined = await MessStartedModel.findOne({
      email,
      messId,
      order_status: "Active",
    });

    if (alreadyJoined) {
      return res.status(409).json({
        message: "User already joined this mess",
      });
    }

    const newJoin = new MessStartedModel({
      email,
      messId,
      date,
      subscriptionMonth,
      monthlyPrice,
      amount,
      payment_status: "Paid",
      order_status: "Active",
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      paymentMethod: "Razorpay",
      paymentDate: new Date(),
    });

    await newJoin.save();

    return res.status(201).json({
      message: "Mess Started Successfully",
      data: newJoin,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      message: "Server Error",
    });
  }
});
app.post("/getmessstart", async (req, res) => {
  const { messId } = req.body;

  try {
    const data = await MessStartedModel.find({
      messId: messId,
    }).sort({ createdAt: -1 });

    if (!data || data.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No Started Users Found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Started Users Found",
      data,
    });
  } catch (error) {
    console.log(error);

    return res.status(500).json({
      success: false,
      message: "Server Error",
    });
  }
});app.post("/getmess", async (req, res) => {
  const { email } = req.body;

  try {
    const profile = await Teffinmodel.findOne({
      email: email,
    });

    const messData = await MessStartedModel.find({
      email: email,
    });

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: "User Not Found",
      });
    }

    return res.status(200).json({
      success: true,
      profile,
      messData,
    });
  } catch (error) {
    console.log(error);

    return res.status(500).json({
      success: false,
      message: "Server Error",
    });
  }
});


//Define Mess Menue

app.post("/definemenu", upload.single("file"), async (req, res) => {
  try {
    const { name, discription, day, messId } = req.body;

    if (!name || !discription || !day || !messId || !req.file) {
      return res.status(400).json({
        message: "All fields are required",
      });
    }

    const menu = new DefineMenuModel({
      name,
      discription,
      day,
      messid: messId,
      file: req.file.filename,
    });

    await menu.save();

    return res.status(201).json({
      message: "Menu Added Successfully",
      data: menu,
    });
  } catch (error) {
    console.log("Define Menu Error:", error);

    return res.status(500).json({
      message: "Internal Server Error",
      error: error.message,
    });
  }
});

app.post("/getdefinemenu",async(req,res)=>{

    const {messid}=req.body;
    try{

        const result= await DefineMenuModel.find({
            
            messid

        });

        if(!result)
        {

            res.status(404).json({

                maessage:"Page Not found"
            })
        }

        res.status(201).json({

            message:"Mess Found",
            result
        })


    }catch(err)
    {

        console.log(err);

        res.status(500).json({

            message:"Server Error"
        })
    }
});


app.post("/checkmenu", async (req, res) => {

  const { messid, menu } = req.body;

  try {

    const result = await DefineMenuModel.find({
      messid,
      day: menu
    });

    // ✅ Correct check
    if (result.length === 0) {

      return res.status(400).json({
        message: "Mess Menu Are Not Define"
      });
    }

    res.status(200).json({
      message: "Menu Define",
      result
    });

  } catch (error) {

    console.log(error);

    res.status(500).json({
      message: "Server Error"
    });
  }
});
app.get("/teffincontact/:id", async (req, res) => {
  try {
    const { id } = req.params;

    // 1) This id is coming from JoinModel list
    const joinData = await JoinModel.findById(id);

    if (!joinData) {
      return res.status(404).json({
        message: "Join data not found",
      });
    }

    // 2) Find actual tiffin provider profile by email
    const provider = await Teffinmodel.findOne({
      email: joinData.email,
    });

    if (!provider) {
      return res.status(404).json({
        message: "Provider profile not found",
      });
    }

    return res.status(200).json({
      message: "Provider found",
      data: {
        ...provider._doc,
        joinData,
      },
    });
  } catch (error) {
    console.log("Teffin contact error:", error);

    return res.status(500).json({
      message: "Internal Server Error",
      error: error.message,
    });
  }
});

//====================Live Mess==================================

app.post("/livemess", async (req, res) => {
  const { messId } = req.body;

  try {
    if (!messId) {
      return res.status(400).json({
        success: false,
        message: "messId is required",
      });
    }

    const updateJoinMess = await JoinModel.findOneAndUpdate(
      { messId: messId },
      {
        $set: { islive: true },
      },
      { new: true }
    );

    if (!updateJoinMess) {
      return res.status(404).json({
        success: false,
        message: "Join mess data not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Mess is live now",
      data: updateJoinMess,
    });
  } catch (error) {
    console.log(error);

    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
});


// ==============Get Custmization Message Teffinwala================

app.post("/getcustomization", async (req, res) => {
  const { userid, definemenu, customMessage } = req.body;

  try {
    if (!userid || !customMessage) {
      return res.status(400).json({
        success: false,
        message: "userid and customMessage required",
      });
    }

    if (!definemenu || definemenu.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Menu data required",
      });
    }

    const menuData = definemenu[0];

    const response = await CustomMessageModel.create({
      userId: userid,
      name: menuData.name,
      description:
        menuData.description ||
        menuData.discription ||
        menuData.desciption ||
        "",
      file: menuData.file,
      messId: menuData.messid || menuData.messId,
      userMessage: customMessage,
    });

    return res.status(201).json({
      success: true,
      message: "Custom message saved successfully",
      data: response,
    });
  } catch (error) {
    console.log(error);

    return res.status(500).json({
      success: false,
      message: "Server Error",
    });
  }
});


// Get Mess Customization  Data==================================

app.post("/custommessagemess", async (req, res) => {
  const { messId } = req.body;

  try {
    const response = await CustomMessageModel.find({ messId });

    return res.status(200).json({
      message: "Messages Found",
      data: response,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      message: "Server Error",
    });
  }
});

app.post("/getuserdetails", async (req, res) => {
  const { userId } = req.body;

  try {
    const result = await Teffinmodel.findById(userId);

    if (!result) {
      return res.status(404).json({
        message: "User Not Found",
      });
    }

    return res.status(200).json({
      message: "Data Is Found",
      data: result,
    });
  } catch (err) {
    console.log(err);
    return res.status(500).json({
      message: "Internal Server Error",
    });
  }
});

app.put("/replycustommessage/:id", async (req, res) => {
  const { status,response } = req.body;

  try {
    const updated = await CustomMessageModel.findByIdAndUpdate(
      req.params.id,
      { status,
reply:response },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({
        message: "Message Not Found",
      });
    }

    return res.status(200).json({
      message: "Status Updated",
      data: updated,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      message: "Server Error",
    });
  }
});


app.post("/create-order", async (req, res) => {
  try {
    const { amount, messId, email, subscriptionMonth } = req.body;

    if (!amount || !messId || !email) {
      return res.status(400).json({
        message: "amount, messId, email required",
      });
    }

    const order = await razorpay.orders.create({
      amount: Number(amount) * 100,
      currency: "INR",
      receipt: `receipt_${Date.now()}`,
      notes: {
        messId,
        email,
        subscriptionMonth,
      },
    });

    return res.status(200).json({
      message: "Order Created",
      order,
    });
  } catch (error) {
    console.log("CREATE ORDER ERROR:", error);
    return res.status(500).json({
      message: error.message || "Order create failed",
    });
  }
});

app.post("/verify-payment", async (req, res) => {
  try {
    const {
      email,
      messId,
      date,
      subscriptionMonth,
      monthlyPrice,
      amount,
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    } = req.body;

    const body = razorpay_order_id + "|" + razorpay_payment_id;

    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(body)
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({
        message: "Payment verification failed",
      });
    }

    const saveData = new MessStartedModel({
      email,
      messId,
      date,
      subscriptionMonth,
      monthlyPrice,
      amount,
      currency: "INR",
      payment_status: "Paid",
      order_status: "Active",
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      paymentMethod: "Razorpay",
      paymentDate: new Date(),
    });

    await saveData.save();

    return res.status(201).json({
      message: "Payment Successful And Mess Started",
      data: saveData,
    });
  } catch (error) {
    console.log("VERIFY PAYMENT ERROR:", error);
    return res.status(500).json({
      message: error.message || "Payment verify failed",
    });
  }
});

app.post("/get-payment-history", async (req, res) => {
  const { messId } = req.body;

  try {
    const data = await MessStartedModel.find({ messId }).sort({
      createdAt: -1,
    });

    return res.status(200).json({
      success: true,
      message: "Payment History Found",
      data,
    });
  } catch (error) {
    console.log(error);

    return res.status(500).json({
      success: false,
      message: "Server Error",
    });
  }
});



app.get("/get-pdf/:id", async (req, res) => {
  try {
    const result = await MessStartedModel.findById(req.params.id);

    if (!result) {
      return res.status(404).json({ message: "Payment Data Not Found" });
    }

    const userData = await Teffinmodel.findOne({ email: result.email });

    if (!userData) {
      return res.status(404).json({ message: "User Data Not Found" });
    }

    const doc = new PDFDocument({
      size: "A4",
      margin: 35,
    });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=mess-receipt-${result._id}.pdf`
    );

    doc.pipe(res);

    const green = "#064e3b";
    const lightGreen = "#ecfdf5";
    const gold = "#d4af37";
    const gray = "#374151";
    const border = "#d1d5db";

    const safe = (v) => v || "N/A";

    // ================= HEADER =================
    doc.rect(0, 0, 595, 145).fill(green);

    doc
      .fillColor(gold)
      .font("Helvetica-Bold")
      .fontSize(16)
      .text("🍽️", 45, 25);

    doc
      .fillColor("#ffffff")
      .fontSize(23)
      .font("Helvetica-Bold")
      .text("MESS PAYMENT", 45, 55);

    doc
      .fillColor(gold)
      .fontSize(42)
      .text("RECEIPT", 45, 82);

    doc
      .strokeColor(gold)
      .lineWidth(2)
      .moveTo(45, 132)
      .lineTo(260, 132)
      .stroke();

    doc
      .fillColor("#ffffff")
      .fontSize(10)
      .font("Helvetica")
      .text("Thank you for choosing our mess services", 45, 138);

    // Right badge
    doc
      .roundedRect(385, 45, 160, 55, 8)
      .fill("#ffffff");

    doc
      .fillColor(green)
      .fontSize(15)
      .font("Helvetica-Bold")
      .text("GOOD FOOD", 405, 58, { align: "center", width: 120 });

    doc
      .fillColor(gold)
      .fontSize(10)
      .text("GOOD MOOD", 405, 78, { align: "center", width: 120 });

    doc
      .roundedRect(385, 110, 160, 38, 6)
      .fill(green);

    doc
      .fillColor("#ffffff")
      .fontSize(9)
      .text("RECEIPT ID", 405, 118, { width: 120, align: "center" })
      .fontSize(12)
      .font("Helvetica-Bold")
      .text(`#MSR-${String(result._id).slice(-6)}`, 405, 132, {
        width: 120,
        align: "center",
      });

    // ================= TOP INFO BAR =================
    const topY = 175;

    doc
      .roundedRect(35, topY, 525, 60, 8)
      .fill("#ffffff")
      .stroke(border);

    const topItems = [
      ["DATE", safe(result.date)],
      [
        "PAYMENT DATE",
        result.paymentDate
          ? new Date(result.paymentDate).toLocaleString()
          : new Date().toLocaleString(),
      ],
      ["PAYMENT METHOD", safe(result.paymentMethod || "Online Payment")],
      ["PAYMENT STATUS", safe(result.payment_status || "Paid")],
    ];

    let x = 50;

    topItems.forEach((item, index) => {
      doc
        .circle(x + 12, topY + 30, 14)
        .fill(green);

      doc
        .fillColor("#ffffff")
        .fontSize(10)
        .text(index === 0 ? "📅" : index === 1 ? "🕒" : index === 2 ? "💳" : "✓", x + 5, topY + 23);

      doc
        .fillColor("#111827")
        .fontSize(8)
        .font("Helvetica-Bold")
        .text(item[0], x + 35, topY + 17);

      doc
        .fillColor("#111827")
        .fontSize(10)
        .font("Helvetica")
        .text(item[1], x + 35, topY + 31, { width: 85 });

      if (index !== 3) {
        doc
          .strokeColor(border)
          .moveTo(x + 115, topY + 12)
          .lineTo(x + 115, topY + 48)
          .stroke();
      }

      x += 125;
    });

    // ================= SECTION TITLE FUNCTION =================
    const sectionTitle = (title, x, y, w) => {
      doc.roundedRect(x, y, w, 28, 4).fill(green);
      doc
        .fillColor("#ffffff")
        .font("Helvetica-Bold")
        .fontSize(13)
        .text(title, x + 15, y + 8);
    };

    const row = (label, value, x, y, w) => {
      doc
        .fillColor("#111827")
        .font("Helvetica-Bold")
        .fontSize(9)
        .text(label, x, y);

      doc
        .fillColor("#111827")
        .font("Helvetica")
        .fontSize(10)
        .text(value, x, y + 14, { width: w });
    };

    // ================= USER DETAILS CARD =================
    sectionTitle("USER DETAILS", 35, 260, 180);

    doc
      .roundedRect(35, 288, 250, 150, 6)
      .fill("#ffffff")
      .stroke(border);

    row("NAME", safe(userData.name), 55, 310, 130);
    row("EMAIL", safe(userData.email), 55, 350, 150);
    row(
      "CONTACT",
      safe(userData.contact || userData.phone || userData.mobile),
      55,
      390,
      130
    );

    // User image
    const userFile = userData.file || userData.image || userData.photo;

    if (userFile) {
      const imagePath = path.join(process.cwd(), "Upload", userFile);

      if (fs.existsSync(imagePath)) {
        doc
          .roundedRect(190, 320, 75, 85, 8)
          .stroke(green);

        doc.image(imagePath, 195, 325, {
          width: 65,
          height: 75,
        });
      } else {
        doc
          .roundedRect(190, 320, 75, 85, 8)
          .stroke(border);

        doc
          .fillColor(gray)
          .fontSize(9)
          .text("No Image", 205, 360);
      }
    }

    // ================= PAYMENT DETAILS CARD =================
    sectionTitle("PAYMENT DETAILS", 310, 260, 190);

    doc
      .roundedRect(310, 288, 250, 150, 6)
      .fill(lightGreen)
      .stroke(border);

    const paymentRows = [
      ["ORDER ID", safe(result.razorpay_order_id)],
      ["RAZORPAY PAYMENT ID", safe(result.razorpay_payment_id)],
      ["AMOUNT", `₹ ${safe(result.amount)}`],
      ["CURRENCY", safe(result.currency || "INR")],
      ["PAYMENT STATUS", safe(result.payment_status || "Paid")],
      ["ORDER STATUS", safe(result.order_status || "Completed")],
    ];

    let py = 302;

    paymentRows.forEach(([label, value]) => {
      doc
        .strokeColor(border)
        .moveTo(310, py + 22)
        .lineTo(560, py + 22)
        .stroke();

      doc
        .fillColor("#111827")
        .font("Helvetica")
        .fontSize(9)
        .text(label, 325, py);

      doc
        .font("Helvetica-Bold")
        .text(value, 440, py, { width: 105, align: "right" });

      py += 22;
    });

    // ================= SUBSCRIPTION DETAILS =================
    sectionTitle("SUBSCRIPTION DETAILS", 35, 470, 230);

    doc
      .roundedRect(35, 500, 525, 80, 6)
      .fill("#ffffff")
      .stroke(border);

    const subHeaders = [
      "MESS ID",
      "JOIN DATE",
      "SUBSCRIPTION",
      "MONTHLY PRICE",
      "TOTAL AMOUNT",
    ];

    const subValues = [
      safe(result.messId),
      safe(result.date),
      `${safe(result.subscriptionMonth)} Month`,
      `₹ ${safe(result.monthlyPrice)}`,
      `₹ ${safe(result.amount)}`,
    ];

    let colX = 45;
    const colW = 102;

    subHeaders.forEach((h, i) => {
      doc
        .fillColor(green)
        .font("Helvetica-Bold")
        .fontSize(9)
        .text(h, colX, 520, { width: colW, align: "center" });

      doc
        .fillColor("#111827")
        .font("Helvetica")
        .fontSize(10)
        .text(subValues[i], colX, 550, { width: colW, align: "center" });

      if (i !== subHeaders.length - 1) {
        doc
          .strokeColor(border)
          .moveTo(colX + colW, 510)
          .lineTo(colX + colW, 570)
          .stroke();
      }

      colX += colW;
    });

    // ================= THANK YOU CARD =================
    doc
      .roundedRect(185, 615, 225, 80, 10)
      .fill("#f0fdfa")
      .stroke(border);

    doc
      .fillColor(green)
      .font("Helvetica-BoldOblique")
      .fontSize(22)
      .text("Thank You!", 215, 630, { width: 160, align: "center" });

    doc
      .fillColor("#111827")
      .font("Helvetica")
      .fontSize(9)
      .text(
        "We truly appreciate your trust in our mess service. We look forward to serving you with delicious meals and great care.",
        205,
        660,
        { width: 185, align: "center" }
      );

    // Signature
    doc
      .strokeColor("#111827")
      .moveTo(445, 655)
      .lineTo(540, 655)
      .stroke();

    doc
      .fillColor("#111827")
      .fontSize(9)
      .text("Authorised Signature", 445, 665, {
        width: 95,
        align: "center",
      });

    doc
      .fillColor(green)
      .fontSize(9)
      .text("Good Food Mess Service", 430, 680, {
        width: 125,
        align: "center",
      });

    // Seal
    doc
      .circle(90, 655, 35)
      .fill("#ffffff")
      .stroke(gold);

    doc
      .fillColor(green)
      .font("Helvetica-Bold")
      .fontSize(12)
      .text("THANK", 64, 642, { width: 52, align: "center" });

    doc
      .fontSize(12)
      .text("YOU!", 64, 657, { width: 52, align: "center" });

    // ================= FOOTER =================
    doc.rect(0, 805, 595, 37).fill(green);

    doc
      .fillColor("#ffffff")
      .font("Helvetica")
      .fontSize(9)
      .text(
        `☎ ${safe(userData.contact || userData.phone || userData.mobile)}     ✉ ${safe(
          userData.email
        )}     📍 Pune, Maharashtra`,
        40,
        818,
        { align: "center", width: 515 }
      );

    doc.end();
  } catch (err) {
    console.log(err);
    return res.status(500).json({
      message: "Server Error",
      error: err.message,
    });
  }
});


// Live Mess
app.post("/endmess", async (req, res) => {
  const { email } = req.body;

  try {
    const deletedData = await JoinModel.findOneAndDelete({
      email,
    });

    if (!deletedData) {
      return res.status(404).json({
        success: false,
        message: "No Active Mess Found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Mess Ended Successfully",
      data: deletedData,
    });
  } catch (error) {
    console.log(error);

    return res.status(500).json({
      success: false,
      message: "Server Error",
    });
  }
});

console.log("Mongo URI exists:", !!process.env.MONGO_URI);
app.listen(2000, () => {
    console.log("Server Run On 2000 port");
});