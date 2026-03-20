const mongoose = require('mongoose');

const commissionSchema = new mongoose.Schema({
  vendorId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Vendor', 
    required: true 
  },
  // month: {
  //   type: String, // YYYY-MM format
  //   required: true
  // },

  // Now stores week key like "2026-W12" instead of "2026-03"
week: {
  type: String,
  required: true
},
month: {
  type: String,
  default: null
},
  totalOrders: {
    type: Number,
    default: 0
  },
  total_earning: {
    type: Number, 
    required: true 
  },
  commission_rate: { 
    type: Number, 
    required: true 
  },
  commission_amount: { 
    type: Number, 
    required: true 
  },
  status: { 
    type: String, 
    enum: ['pending', 'paid', 'overdue'],
    default: 'pending' 
  },
  payment_proof_url: {
    type: String
  },
  payment_date: {
    type: Date
  },
  admin_verified_at: {
    type: Date
  },
  due_date: { 
    type: Date 
  },
  notes: {
    type: String
  }
}, { 
  timestamps: true 
});

// Compound index for efficient monthly queries
commissionSchema.index({ vendorId: 1, month: 1 });
commissionSchema.index({ status: 1, due_date: 1 });

module.exports = mongoose.model('Commission', commissionSchema);

