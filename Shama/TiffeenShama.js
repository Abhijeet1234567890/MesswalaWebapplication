import mongoose from "mongoose";

const TeffienShcma= new mongoose.Schema({

    name:String,
    email:String,
    pass:String,
    file:String,
    gender:String,
    contact:String,
    city:String
});

export const Teffinmodel= mongoose.model("tiffenregisters",TeffienShcma);