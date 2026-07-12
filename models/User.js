import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
{
  restaurant_id:{
    type:mongoose.Schema.Types.ObjectId,
    ref:"Restaurant"
  },

  first_name:{
    type:String,
    required:true
  },

  last_name:{
    type:String,
    required:true
  },

  email:{
    type:String,
    unique:true,
    required:true
  },

  phone:String,

  password:{
    type:String,
    required:true
  },

  role:{
    type:String,
    enum:[
      "Admin",
      "Manager",
      "Waiter",
      "Cashier",
      "Kitchen"
    ],
    default:"Admin"
  },

  status:{
    type:Boolean,
    default:true
  },

  reset_password_token:{
    type:String,
    select:false
  },

  reset_password_expires:{
    type:Date,
    select:false
  }
},
{
  timestamps:true
});

export default mongoose.model(
  "User",
  userSchema
);