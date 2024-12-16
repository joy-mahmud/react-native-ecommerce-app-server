const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  
    _id: {
        type: mongoose.Schema.Types.ObjectId,
        required: true
    },
    id: {
        type: Number,
        required: true
    },
    title: {
        type: String,
        required: true
    },
    price: {
        type: Number,
        required: true
    },
    description: {
        type: String,
        required: true
    },
    category: {
        type: String,
        required: true
    },
    image: {
        type: String,
        required: true
    },
    rating: {
        rate: {
            type: Number,
           
        },
        count: {
            type: Number,
         
        }
    }
}, { timestamps: true });

// Export the model
const Product = mongoose.model('Product', productSchema);
module.exports = Product;
