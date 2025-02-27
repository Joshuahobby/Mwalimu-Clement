import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express } from "express";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { storage } from "./storage";
import { User as SelectUser } from "@shared/schema";
import { log } from "./vite";

declare global {
  namespace Express {
    interface User extends SelectUser {}
  }
}

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function comparePasswords(supplied: string, stored: string) {
  const [hashed, salt] = stored.split(".");
  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  return timingSafeEqual(hashedBuf, suppliedBuf);
}

export function setupAuth(app: Express) {
  // Enhanced session configuration with secure settings
  const sessionSettings: session.SessionOptions = {
    secret: process.env.SESSION_SECRET!,
    resave: false,
    saveUninitialized: false,
    store: storage.sessionStore,
    name: 'sid', // Change session cookie name from default 'connect.sid'
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
  };

  app.set("trust proxy", 1);
  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(
    new LocalStrategy(async (username, password, done) => {
      try {
        log(`Attempting login for user: ${username}`);
        const user = await storage.getUserByUsername(username);

        if (!user) {
          log(`Login failed: User ${username} not found`);
          return done(null, false);
        }

        const isValid = await comparePasswords(password, user.password);
        if (!isValid) {
          log(`Login failed: Invalid password for user ${username}`);
          return done(null, false);
        }

        log(`Login successful for user: ${username}`);
        return done(null, user);
      } catch (error) {
        log(`Login error: ${error.message}`);
        return done(error);
      }
    }),
  );

  passport.serializeUser((user, done) => {
    log(`Serializing user: ${user.id}`);
    done(null, user.id);
  });

  passport.deserializeUser(async (id: number, done) => {
    try {
      log(`Deserializing user: ${id}`);
      const user = await storage.getUser(id);
      if (!user) {
        log(`Deserialization failed: User ${id} not found`);
        return done(null, false);
      }
      done(null, user);
    } catch (error) {
      log(`Deserialization error: ${error.message}`);
      done(error);
    }
  });

  app.post("/api/register", async (req, res, next) => {
    try {
      const { username, password } = req.body;

      if (!username || !password) {
        return res.status(400).send("Username and password are required");
      }

      const existingUser = await storage.getUserByUsername(username);
      if (existingUser) {
        return res.status(400).send("Username already exists");
      }

      const hashedPassword = await hashPassword(password);
      const user = await storage.createUser({
        username,
        password: hashedPassword,
      });

      log(`New user registered: ${username}`);

      req.login(user, (err) => {
        if (err) return next(err);
        res.status(201).json(user);
      });
    } catch (error) {
      log(`Registration error: ${error.message}`);
      next(error);
    }
  });

  app.post("/api/login", (req, res, next) => {
    passport.authenticate("local", (err, user, info) => {
      if (err) {
        log(`Login error: ${err.message}`);
        return next(err);
      }
      if (!user) {
        log(`Login failed: Invalid credentials`);
        return res.status(401).send("Invalid credentials");
      }
      req.login(user, (err) => {
        if (err) {
          log(`Login error: ${err.message}`);
          return next(err);
        }
        log(`User logged in: ${user.username}`);
        res.status(200).json(user);
      });
    })(req, res, next);
  });

  app.post("/api/logout", (req, res, next) => {
    const username = req.user?.username;
    req.logout((err) => {
      if (err) {
        log(`Logout error: ${err.message}`);
        return next(err);
      }
      log(`User logged out: ${username}`);
      res.sendStatus(200);
    });
  });

  app.get("/api/user", (req, res) => {
    if (!req.isAuthenticated()) {
      log(`Unauthorized access attempt to /api/user`);
      return res.sendStatus(401);
    }
    log(`User data retrieved for: ${req.user.username}`);
    res.json(req.user);
  });
}