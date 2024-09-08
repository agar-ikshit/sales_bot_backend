export default async function healthCheckHandler(req, res) {
    try {
      res.status(200).json({ message: "Server is running correctly" });
    } catch (error) {
      console.error("Health check error:", error);
      res.status(500).json({ error: "Error during health check" });
    }
  }
  