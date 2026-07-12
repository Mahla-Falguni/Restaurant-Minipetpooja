const errorMiddleware = (err, req, res, next) => {

  console.log(err);

  res.status(err.statusCode || 500).json({

    success: false,

    message: err.message || "Internal Server Error",

    stack:
      process.env.NODE_ENV ===
        "development"
        ? err.stack
        : null,
  });
};

export default errorMiddleware;