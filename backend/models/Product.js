const mongoose = require('mongoose');

/**
 * Product Schema for Electric Shop items
 * Stores all product information including images and inventory
 */
const productSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please provide a product name'],
    trim: true
  },
  description: {
    type: String,
    required: [true, 'Please provide a product description']
  },
  price: {
    type: Number,
    required: [true, 'Please provide a product price'],
    min: 0
  },
  category: {
    type: String,
    required: [true, 'Please provide a product category'],
    enum: ['Wire & Cables', 'Fan', 'Pipes', 'Motors', 'Heater', 'Lights', 'Switches', 'Tank', 'Other']
  },
  brand: {
    type: String,
    required: [true, 'Please provide a brand name']
  },
  image: {
    type: String,
    required: [true, 'Please provide a product image']
  },
  stock: {
    type: Number,
    required: [true, 'Please provide stock quantity'],
    min: 0,
    default: 0
  },
  specifications: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  ratings: {
    average: {
      type: Number,
      default: 0,
      min: 0,
      max: 5
    },
    count: {
      type: Number,
      default: 0
    }
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'out-of-stock'],
    default: 'active'
  },
  featured: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Update status based on stock
productSchema.pre('save', function(next) {
  if (this.stock === 0) {
    this.status = 'out-of-stock';
  } else if (this.status === 'out-of-stock' && this.stock > 0) {
    this.status = 'active';
  }
  next();
});

module.exports = mongoose.model('Product', productSchema);
