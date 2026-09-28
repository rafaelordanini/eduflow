const progressHandler = require('../../lib/endpoints/progress');
const performanceHandler = require('../../lib/endpoints/performance');

/** Consolidates lesson progress and performance reports into one Vercel function. */
module.exports = function activityHandler(req, res) {
  const resource = req.query && req.query.resource;
  if (resource === 'progress') return progressHandler(req, res);
  if (resource === 'performance') return performanceHandler(req, res);
  return res.status(400).json({ error: 'Informe resource=progress ou resource=performance.' });
};
