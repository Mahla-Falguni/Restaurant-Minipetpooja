import mongoose from "mongoose";

const feedbackSchema =
new mongoose.Schema({

  restaurant_id:{
    type:mongoose.Schema.Types.ObjectId,
    ref:"Restaurant"
  },

  order_id:{
    type:mongoose.Schema.Types.ObjectId,
    ref:"Order"
  },

  customer_name:String,

  rating:{
    type:Number,
    min:1,
    max:5
  },

  review:String

},
{
  timestamps:true
});

export default mongoose.model(
  "Feedback",
  feedbackSchema
);