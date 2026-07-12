const notFoundMiddleware = (req, res) => {

  res.status(404).json({

    success: false,

    message: `Route Not Found - ${req.originalUrl}`,
  });
};

export default notFoundMiddleware;