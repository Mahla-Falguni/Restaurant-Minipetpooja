import mongoose from "mongoose";

const subscriptionSchema =
new mongoose.Schema({

  restaurant_id:{
    type:mongoose.Schema.Types.ObjectId,
    ref:"Restaurant"
  },

  plan_name:String,

  amount:Number,

  start_date:Date,

  end_date:Date,

  status:{
    type:String,
    enum:[
      "active",
      "expired",
      "cancelled"
    ],
    default:"active"
  }

},
{
  timestamps:true
});

export default mongoose.model(
  "Subscription",
  subscriptionSchema
);