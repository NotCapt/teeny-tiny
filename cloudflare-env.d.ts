declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    BUCKET?: R2Bucket;
    TINYFISH_API_KEY?: string;
    PUBLIC_ORIGIN?: string;
  }
}
