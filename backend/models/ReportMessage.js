const mongoose = require('mongoose');

/**
 * ReportMessage Schema
 * Admin sends report messages to specific users
 * Users see these messages in their inbox-style "My Reports" section
 */
const reportMessageSchema = new mongoose.Schema({
  // User who will receive this report message
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required'],
    index: true
  },

  // Optional reference IDs for context
  orderId: {
    type: String,
    trim: true
  },
  
  paymentId: {
    type: String,
    trim: true
  },
  
  invoiceId: {
    type: String,
    trim: true
  },

  // Report message content
  title: {
    type: String,
    required: [true, 'Report title is required'],
    trim: true,
    maxlength: [200, 'Title cannot exceed 200 characters']
  },

  message: {
    type: String,
    required: [true, 'Report message is required'],
    trim: true,
    maxlength: [2000, 'Message cannot exceed 2000 characters']
  },

  // Status/Type of the report
  status: {
    type: String,
    required: [true, 'Report status is required'],
    enum: {
      values: ['Info', 'Warning', 'Issue', 'Summary'],
      message: 'Status must be one of: Info, Warning, Issue, Summary'
    },
    default: 'Info'
  },

  // Admin who sent this report
  sentBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
    required: true
  },

  // Track if user has read the message
  isRead: {
    type: Boolean,
    default: false
  },

  // Read timestamp
  readAt: {
    type: Date
  }
}, {
  timestamps: true // Adds createdAt and updatedAt
});

// Index for efficient queries
reportMessageSchema.index({ userId: 1, createdAt: -1 });
reportMessageSchema.index({ userId: 1, isRead: 1 });

// Virtual for user reference
reportMessageSchema.virtual('user', {
  ref: 'User',
  localField: 'userId',
  foreignField: '_id',
  justOne: true
});

// Virtual for admin reference
reportMessageSchema.virtual('admin', {
  ref: 'Admin',
  localField: 'sentBy',
  foreignField: '_id',
  justOne: true
});

// Ensure virtuals are included in JSON
reportMessageSchema.set('toJSON', { virtuals: true });
reportMessageSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('ReportMessage', reportMessageSchema);
