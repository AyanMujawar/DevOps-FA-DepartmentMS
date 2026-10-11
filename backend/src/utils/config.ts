const WEAK_SECRETS = [
  "",
  "secret",
  "changeme",
  "change-this-secret-key",
  "dev-secret-key-change-in-production",
  "your-secret-key",
];

// In production a guessable signing key would let anyone forge login tokens, so refuse to start.
export const assertProductionConfig = (env: NodeJS.ProcessEnv) => {
  if (env.NODE_ENV !== "production") return;

  const secret = env.JWT_SECRET || "";
  if (WEAK_SECRETS.includes(secret) || secret.length < 16) {
    throw new Error(
      "JWT_SECRET must be set to a strong random value (16+ characters) when NODE_ENV=production"
    );
  }
  if (!env.MONGODB_URI) {
    throw new Error("MONGODB_URI must be set when NODE_ENV=production");
  }
};
