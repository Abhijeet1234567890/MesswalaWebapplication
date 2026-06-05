import mongoose from "mongoose";

const Instancefood= new mongoose.Schema({

    name:String,
    price:String,
    description:String,
    file:String,
    messid:String

});

export const InstanceModel= mongoose.model("instancefoods",Instancefood);
