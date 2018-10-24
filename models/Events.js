const mongoose = require('mongoose');

const eventSchema = mongoose.Schema({
  transactionHash: String,
  eventType: String,
  blockNumber: Number,
  eventData: mongoose.Schema.Types.Mixed
});

module.exports = mongoose.model('events', eventSchema);
