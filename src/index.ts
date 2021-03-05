import "reflect-metadata";
require("dotenv-safe").config();
import express from "express";
import { createConnection } from "typeorm";
import { __prod__ } from "./constants";
import { join } from "path";
import { Strategy as GitHubStrategy } from "passport-github";
import passport from "passport";
import { User } from "./entities/User";
import jwt from "jsonwebtoken";

const main = async () => {
    await createConnection({
        type: "postgres",
        database: "vstodo",
        entities: [join(__dirname, "./entities/*.*")],
        logging: !__prod__,
        synchronize: !__prod__,
    });

    const app = express();

    app.use(passport.initialize());

    passport.serializeUser((user: any, done) => {
        done(null, user.accessToken);
    });

    passport.use(
        new GitHubStrategy(
            {
                clientID: process.env.GITHUB_CLIENT_ID,
                clientSecret: process.env.GITHUB_CLIENT_SECRET,
                callbackURL: "http://localhost:3002/auth/github/callback",
            },
            async (_, __, profile, cb) => {
                let user = await User.findOne({
                    where: { githubId: profile.id },
                });
                if (user) {
                    user.name = profile.displayName;
                    await user.save();
                } else {
                    user = await User.create({
                        name: profile.displayName,
                        githubId: profile.id,
                    }).save();
                }
                cb(null, {
                    accessToken: jwt.sign(
                        { UserId: user.id },
                        process.env.GITHUB_CLIENT_SECRET,
                        {
                            expiresIn: "1d",
                        }
                    ),
                });
            }
        )
    );

    app.get(
        "/auth/github",
        passport.authenticate("github", { session: false })
    );

    app.get(
        "/auth/github/callback",
        passport.authenticate("github", { session: false }),
        (req: any, res) => {
            res.redirect(`http://localhost:54321/auth/${req.user.accessToken}`);
        }
    );

    app.get("/", (_req, res) => {
        res.send({ message: "🎉 API WORKING 🎉" });
    });

    app.listen(3002, () => {
        console.log("listening on localhost:3002");
    });
};

main();
