const http = require("http");
const { getAllEventsForService } = require("../App");
const hostname = "127.0.0.1";
const port = process.env.NODE_PORT || 3000;
const EVENT_INTERVAL = 120000; // Default time interval after which service checks for new events

const server = http.createServer((req, res) => {
  res.end("Livepeer service is running..");
});
server.listen(port, hostname, () => {
  setInterval(getAllEventsForService, EVENT_INTERVAL);
});
