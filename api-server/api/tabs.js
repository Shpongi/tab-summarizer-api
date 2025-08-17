module.exports = async (req, res) => {
  res.status(200).json({
    ok: true,
    route: "/api/tabs",
    now: new Date().toISOString()
  });
};
