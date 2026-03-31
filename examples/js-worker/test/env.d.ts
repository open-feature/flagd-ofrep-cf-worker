declare module 'cloudflare:workers' {
  interface ProvidedEnv {
    FLAGS_R2_BUCKET?: R2Bucket;
    FLAG_SOURCE?: string;
  }
}
