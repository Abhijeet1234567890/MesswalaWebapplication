import mongoose from "mongoose";

const DefineMenuSchma= new mongoose.Schema({


    name:String,
    file:String,
    desciption:String,
    day:String,
    messid:String
});

export const DefineMenuModel= mongoose.model("definemenus",DefineMenuSchma);