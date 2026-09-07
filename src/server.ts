import http from "http";
import app from "./app";
const server = http.createServer(app);

const PORT = 4001;
const startServer = async () => {
  try {


    server.listen(PORT, () => {
      console.log(`🚀 server is running on port ${PORT}`);
    });
  } catch (error) {
    console.log("❌ DB Connection Failed");
    console.error(error);
  }
};

startServer();