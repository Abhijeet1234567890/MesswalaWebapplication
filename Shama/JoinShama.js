import mongoose from "mongoose";

const JoinShama= new mongoose.Schema({

    name:String,
    email:String,
    mess:String,
    city:String,
    village:String,
    pincode:String,
    type:String,
    islive:{

        type:Boolean,
        default:false
    },
    
    messId:String
});

export const JoinModel=mongoose.model("joinmess",JoinShama);