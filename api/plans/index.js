const dailyPlanHandler = require('../../lib/endpoints/daily-plan');
const macroPlanHandler = require('../../lib/endpoints/macro-plan');

/** Consolidates daily and macro planning into one Vercel function. */
module.exports = function plansHandler(req, res) {
  const kind = req.query && req.query.kind;
  if (kind === 'daily') return dailyPlanHandler(req, res);
  if (kind === 'macro') return macroPlanHandler(req, res);
  return res.status(400).json({ error: 'Informe kind=daily ou kind=macro.' });
};
