import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });

  const PORT = 3000;

  // Logging middleware
  app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
    next();
  });

  // Health check route
  app.get("/api/health", (req, res) => {
    console.log("Health check requested");
    res.json({ 
      status: "ok", 
      mode: process.env.NODE_ENV || "development",
      hasDist: fs.existsSync(path.join(process.cwd(), 'dist')),
      time: new Date().toISOString()
    });
  });

  // Debug route for mobile
  app.get("/api/debug", (req, res) => {
    res.send(`
      <html>
        <body style="font-family: sans-serif; padding: 20px;">
          <h1>Mobile Debug Info</h1>
          <p><strong>Mode:</strong> ${process.env.NODE_ENV || "development"}</p>
          <p><strong>Time:</strong> ${new Date().toISOString()}</p>
          <p><strong>User Agent:</strong> ${req.headers['user-agent']}</p>
          <p><strong>Host:</strong> ${req.headers['host']}</p>
          <hr/>
          <button onclick="window.location.href='/'">Go to App</button>
        </body>
      </html>
    `);
  });

  // Track rooms and their client counts
  const rooms = new Map<string, Set<string>>();

  io.on("connection", (socket) => {
    console.log("A user connected:", socket.id);

    socket.on("join-room", (userId: string) => {
      socket.join(userId);
      
      if (!rooms.has(userId)) {
        rooms.set(userId, new Set());
      }
      rooms.get(userId)?.add(socket.id);

      const count = rooms.get(userId)?.size || 0;
      console.log(`User ${userId} has ${count} devices connected.`);
      
      // Notify all devices in the room about the connection status
      io.to(userId).emit("connected-status", {
        isConnected: count > 1,
        deviceCount: count
      });
    });

    socket.on("disconnecting", () => {
      for (const room of socket.rooms) {
        if (rooms.has(room)) {
          rooms.get(room)?.delete(socket.id);
          const count = rooms.get(room)?.size || 0;
          io.to(room).emit("connected-status", {
            isConnected: count > 1,
            deviceCount: count
          });
        }
      }
    });

    socket.on("disconnect", () => {
      console.log("User disconnected:", socket.id);
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);

    // Explicitly serve manifest from public in dev if vite doesn't
    app.get("/manifest.json", (req, res) => {
      res.sendFile(path.resolve(__dirname, "public", "manifest.json"));
    });

    // Manual SPA fallback for development to ensure index.html is always served
    app.use("*", async (req, res, next) => {
      res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
      res.setHeader("Pragma", "no-cache");
      res.setHeader("Expires", "0");
      
      const url = req.originalUrl;
      console.log(`[DEV] SPA Fallback for: ${url}`);
      try {
        let template = await fs.promises.readFile(path.resolve(__dirname, "index.html"), "utf-8");
        template = await vite.transformIndexHtml(url, template);
        res.status(200).set({ "Content-Type": "text/html" }).end(template);
      } catch (e) {
        vite.ssrFixStacktrace(e as Error);
        next(e);
      }
    });
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    console.log(`[PROD] Serving static files from: ${distPath}`);
    
    if (!fs.existsSync(distPath)) {
      console.error(`[PROD] ERROR: dist folder not found at ${distPath}`);
    }

    app.use(express.static(distPath));
    
    // Handle SPA routing
    app.get('*', (req, res) => {
      console.log(`[PROD] Request for: ${req.url}`);
      const indexPath = path.join(distPath, 'index.html');
      if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        console.error(`[PROD] ERROR: index.html not found at ${indexPath}`);
        res.status(404).send("Application build files missing. Please try refreshing or contact support.");
      }
    });
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
