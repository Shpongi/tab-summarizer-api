module.exports = async (req, res) => {
  res.status(200).json({
    ok: true,
    route: "/api/tabs",
    method: req.method,
    now: new Date().toISOString()
  });
};
